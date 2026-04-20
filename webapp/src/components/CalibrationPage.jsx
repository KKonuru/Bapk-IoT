import { useState, useEffect } from 'react';
import { ref, get, onValue, set } from 'firebase/database';
import { db } from '../firebase';

const SENSITIVITY_OPTIONS = [
  { value: 'LOW', label: 'Low', desc: 'Gentle buzz' },
  { value: 'MEDIUM', label: 'Medium', desc: 'Balanced' },
  { value: 'HIGH', label: 'High', desc: 'Strong buzz' },
];

const MM_PER_FOOT = 304.8;
const SENSOR_FIELDS = [
  { key: 'front_mm', label: 'Front', emoji: 'F' },
  { key: 'left_mm', label: 'Left', emoji: 'L' },
  { key: 'right_mm', label: 'Right', emoji: 'R' },
];

// Sensitivity scales the buzz strength (mirror chest module). Alert range is the
// trigger distance; sensitivity is independent — it only affects how hard the
// motor is driven once we're inside the range. Keep in sync with chest_module.ino.
const SENSITIVITY_SCALE = { LOW: 0.6, MEDIUM: 1.0, HIGH: 1.4 };
const THRESHOLD_MIN_MM = 200;
const THRESHOLD_MAX_MM = 1200;

function clamp(v, lo, hi) {
  return Math.min(hi, Math.max(lo, v));
}

function vibrationIntensity(distMm, thresholdMm, sensitivity) {
  if (typeof distMm !== 'number' || distMm <= 0) return 0;
  if (distMm >= thresholdMm) return 0;
  const base = 255 * (1 - distMm / thresholdMm);
  const scale = SENSITIVITY_SCALE[sensitivity] ?? 1;
  return Math.min(255, Math.round(base * scale));
}

function mmToFeet(mm) {
  return (mm / MM_PER_FOOT).toFixed(1);
}

function formatDistance(mm, useFeet) {
  if (typeof mm !== 'number') return '--';
  if (useFeet) return `${mmToFeet(mm)} ft`;
  if (mm >= 9999) return 'out of range';
  return `${mm} mm`;
}

function thresholdSpoken(mm, useFeet) {
  if (useFeet) return `${mmToFeet(mm)} feet`;
  return `${(mm / 1000).toFixed(2)} meters`;
}

function sensitivityLabel(value) {
  return SENSITIVITY_OPTIONS.find((o) => o.value === value)?.label ?? value;
}

function Compass({ thresholdMm, sensitivity, useFeet }) {
  const rangePercent = 20 + ((thresholdMm - 200) / 1000) * 75;
  const pulseSpeed = sensitivity === 'HIGH' ? '1.5s' : sensitivity === 'MEDIUM' ? '2.5s' : '4s';

  const displayDist = useFeet
    ? `${mmToFeet(thresholdMm)} ft`
    : `${(thresholdMm / 1000).toFixed(2)} m`;

  return (
    <div className="compass" aria-hidden="true">
      <div className="compass-zone" style={{ inset: `${50 - rangePercent / 2}%` }} />
      <div
        className="compass-zone-pulse"
        style={{ inset: `${50 - rangePercent / 2}%`, animationDuration: pulseSpeed }}
      />
      <div className="compass-ring outer" />
      <div className="compass-ring inner" />
      <div className="compass-line vertical" />
      <div className="compass-line horizontal" />
      <div className="compass-center" />
      <span className="compass-label front">Front</span>
      <span className="compass-label left">Left</span>
      <span className="compass-label right">Right</span>
      <span className="compass-distance">{displayDist}</span>
    </div>
  );
}

function CloudIcon() {
  return (
    <svg className="btn-icon" width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M4.5 12.5h7a3 3 0 001.12-5.786A4.001 4.001 0 005.1 5.4a3.5 3.5 0 00-.6 7.1z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8 9v-4M6 7l2-2 2 2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg className="check-icon" width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.2" />
      <path d="M4.5 7l1.8 1.8L9.5 5.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SensorCard({ field, distMm, thresholdMm, sensitivity, useFeet }) {
  const intensity = vibrationIntensity(distMm, thresholdMm, sensitivity);
  const intensityPct = Math.round((intensity / 255) * 100);
  const buzzing = intensity > 0;
  const distLabel = formatDistance(distMm, useFeet);

  const ariaLabel = typeof distMm === 'number'
    ? `${field.label}: ${distLabel}, vibration ${intensityPct} percent${buzzing ? ', buzzing' : ''}`
    : `${field.label}: no reading yet`;

  return (
    <article className="sensor-card" aria-label={ariaLabel}>
      <div className="sensor-card-head">
        <p className="sensor-label">
          <span aria-hidden="true">{field.emoji}</span> {field.label}
        </p>
        {buzzing && (
          <span className="buzzing-pill" aria-hidden="true">BUZZING</span>
        )}
      </div>
      <p className="sensor-value">{distLabel}</p>
      <div className="intensity-bar" aria-hidden="true">
        <div
          className={`intensity-fill ${buzzing ? 'on' : ''}`}
          style={{ width: `${intensityPct}%` }}
          data-intensity={intensityPct >= 66 ? 'high' : intensityPct >= 33 ? 'mid' : 'low'}
        />
      </div>
      <p className="intensity-readout" aria-hidden="true">
        Vibration {intensityPct}%
      </p>
    </article>
  );
}

export default function CalibrationPage({ uid, onSignOut }) {
  const [activeTab, setActiveTab] = useState('calibration');
  const [thresholdMm, setThresholdMm] = useState(1000);
  const [sensitivity, setSensitivity] = useState('MEDIUM');
  const [useFeet, setUseFeet] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState('');
  const [loadingData, setLoadingData] = useState(true);
  const [sensorData, setSensorData] = useState({});
  const [sensorError, setSensorError] = useState('');

  useEffect(() => {
    async function loadCalibration() {
      try {
        const snapshot = await get(ref(db, `users/${uid}/calibration`));
        if (snapshot.exists()) {
          const data = snapshot.val();
          if (data.threshold_mm) setThresholdMm(clamp(data.threshold_mm, THRESHOLD_MIN_MM, THRESHOLD_MAX_MM));
          if (data.sensitivity) setSensitivity(data.sensitivity);
        }
      } catch (err) {
        console.error('Failed to load calibration:', err);
      } finally {
        setLoadingData(false);
      }
    }
    loadCalibration();
  }, [uid]);

  useEffect(() => {
    const sensorRef = ref(db, `users/${uid}/sensors`);

    const unsubscribe = onValue(
      sensorRef,
      (snapshot) => {
        setSensorError('');
        setSensorData(snapshot.exists() ? snapshot.val() : {});
      },
      (error) => {
        setSensorError(error.message);
      }
    );

    return unsubscribe;
  }, [uid]);

  const handleSave = async () => {
    setSaving(true);
    setSaveStatus('');

    try {
      await set(ref(db, `users/${uid}/calibration`), {
        threshold_mm: thresholdMm,
        sensitivity,
        last_updated: Date.now(),
      });
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus(''), 4000);
    } catch (err) {
      console.error('Save failed:', err);
      setSaveStatus('error');
    } finally {
      setSaving(false);
    }
  };

  const thresholdDisplay = useFeet
    ? mmToFeet(thresholdMm)
    : (thresholdMm / 1000).toFixed(2);
  const thresholdUnit = useFeet ? 'ft' : 'm';

  const lastSensorUpdate = Number(sensorData.last_updated || 0);
  const hasSensorData = SENSOR_FIELDS.some((field) => typeof sensorData[field.key] === 'number');
  const sensorAgeMs = lastSensorUpdate > 0 ? Date.now() - lastSensorUpdate : null;
  const sensorStatus =
    lastSensorUpdate === 0 ? 'waiting' : sensorAgeMs !== null && sensorAgeMs > 15000 ? 'stale' : 'live';

  const buzzingDirections = SENSOR_FIELDS
    .filter((field) => vibrationIntensity(sensorData[field.key], thresholdMm, sensitivity) > 0)
    .map((field) => field.label);

  if (loadingData) {
    return (
      <div className="loading" role="status" aria-live="polite">
        Loading calibration...
      </div>
    );
  }

  return (
    <div className="calibration-container">
      <header className="page-header">
        <div className="header-brand">
          <div className="header-logo" aria-hidden="true">
            <div className="mini-ring" />
            <div className="mini-ring" />
            <div className="mini-dot" />
          </div>
          <h1>SafeStep</h1>
        </div>
        <button onClick={onSignOut} className="btn-secondary">
          Sign Out
        </button>
      </header>

      <p className="page-subtitle">Configure your device</p>

      <div className="page-tabs" role="tablist" aria-label="SafeStep pages">
        <button
          type="button"
          role="tab"
          id="tab-calibration"
          aria-selected={activeTab === 'calibration'}
          aria-controls="panel-calibration"
          className={`tab-btn ${activeTab === 'calibration' ? 'active' : ''}`}
          onClick={() => setActiveTab('calibration')}
        >
          Calibration
        </button>
        <button
          type="button"
          role="tab"
          id="tab-debug"
          aria-selected={activeTab === 'debug'}
          aria-controls="panel-debug"
          className={`tab-btn ${activeTab === 'debug' ? 'active' : ''}`}
          onClick={() => setActiveTab('debug')}
        >
          Sensor Debug
        </button>
      </div>

      <main id="main">
        {activeTab === 'calibration' ? (
          <section
            id="panel-calibration"
            role="tabpanel"
            aria-labelledby="tab-calibration"
            className="calibration-form glass-card"
          >
            <Compass thresholdMm={thresholdMm} sensitivity={sensitivity} useFeet={useFeet} />
            <p className="visually-hidden" aria-live="polite">
              Detection zone visualization. Alert range {thresholdSpoken(thresholdMm, useFeet)} in
              front, left, and right directions. Sensitivity {sensitivityLabel(sensitivity).toLowerCase()}.
            </p>

            <div className="unit-toggle-row">
              <span className="unit-label" id="unit-toggle-label">Display units</span>
              <div className="unit-toggle" role="group" aria-labelledby="unit-toggle-label">
                <button
                  className={`unit-btn ${!useFeet ? 'active' : ''}`}
                  onClick={() => setUseFeet(false)}
                  aria-pressed={!useFeet}
                >
                  Metric
                </button>
                <button
                  className={`unit-btn ${useFeet ? 'active' : ''}`}
                  onClick={() => setUseFeet(true)}
                  aria-pressed={useFeet}
                >
                  Imperial
                </button>
              </div>
            </div>

            <hr className="section-divider" />

            <div className="sensitivity-group">
              <label id="sensitivity-label">Sensitivity</label>
              <p id="sensitivity-desc" className="slider-desc">
                How strong the vibration feels when something is detected.
              </p>
              <div
                className="segmented-control"
                role="group"
                aria-labelledby="sensitivity-label"
                aria-describedby="sensitivity-desc"
              >
                {SENSITIVITY_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    className={`segment-btn ${sensitivity === opt.value ? 'active' : ''}`}
                    onClick={() => setSensitivity(opt.value)}
                    aria-pressed={sensitivity === opt.value}
                    aria-label={`${opt.label}: ${opt.desc}`}
                  >
                    {opt.label}
                    <span className="segment-desc" aria-hidden="true">{opt.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="slider-group">
              <div className="slider-header">
                <label htmlFor="threshold">Alert Range</label>
                <div className="slider-value" aria-live="polite" aria-atomic="true">
                  {thresholdDisplay}
                  <span className="slider-unit">{thresholdUnit}</span>
                </div>
              </div>
              <p id="threshold-desc" className="slider-desc">
                How close an obstacle must be before the device vibrates
              </p>
              <input
                id="threshold"
                type="range"
                min={200}
                max={1200}
                step={50}
                value={thresholdMm}
                onChange={(e) => setThresholdMm(Number(e.target.value))}
                aria-valuetext={thresholdSpoken(thresholdMm, useFeet)}
                aria-describedby="threshold-desc threshold-range-labels"
                style={{
                  background: `linear-gradient(to right, var(--accent) 0%, var(--accent) ${((thresholdMm - 200) / 1000) * 100}%, rgba(124,163,206,0.1) ${((thresholdMm - 200) / 1000) * 100}%, rgba(124,163,206,0.1) 100%)`
                }}
              />
              <div className="range-labels" id="threshold-range-labels">
                <span>{useFeet ? '0.7 ft' : '0.2 m'}</span>
                <span>{useFeet ? '3.9 ft' : '1.2 m'}</span>
              </div>
            </div>

            <hr className="section-divider" />

            <button
              onClick={handleSave}
              disabled={saving}
              aria-busy={saving}
              aria-label="Save calibration to cloud"
              className={`btn-primary ${saveStatus === 'saved' ? 'saved' : ''}`}
            >
              <CloudIcon />
              <span>
                {saving ? 'Saving...' : saveStatus === 'saved' ? 'Saved!' : 'Save to Cloud'}
              </span>
            </button>

            <div role="status" aria-live="polite" className="status-region">
              {saveStatus === 'saved' && (
                <p className="status-message success">
                  <CheckIcon />
                  Settings saved. Your device will sync automatically.
                </p>
              )}
            </div>
            {saveStatus === 'error' && (
              <p className="status-message error" role="alert">
                Failed to save. Please try again.
              </p>
            )}

            <div className="sync-info">
              <span className="sync-dot" aria-hidden="true" />
              Device syncs every 10 seconds
            </div>
          </section>
        ) : (
          <section
            id="panel-debug"
            role="tabpanel"
            aria-labelledby="tab-debug"
            className="debug-panel glass-card"
          >
            <div className="debug-heading-row">
              <h2>Live Sensor Readings</h2>
              <span className={`sensor-badge ${sensorStatus}`} aria-label={`Stream status: ${sensorStatus}`}>
                {sensorStatus === 'live' ? 'LIVE' : sensorStatus === 'stale' ? 'STALE' : 'WAITING'}
              </span>
            </div>

            <p className="debug-subtitle">
              Realtime distances from the head module, with the per-direction vibration the
              chest module would deliver at your current sensitivity ({sensitivityLabel(sensitivity)})
              and alert range ({thresholdSpoken(thresholdMm, useFeet)}).
            </p>

            <p className="visually-hidden" aria-live="polite" aria-atomic="true">
              {buzzingDirections.length === 0
                ? 'No directions buzzing.'
                : `Buzzing: ${buzzingDirections.join(', ')}.`}
            </p>

            {sensorError && (
              <p className="status-message error" role="alert">
                {sensorError}
              </p>
            )}

            <div className="sensor-grid">
              {SENSOR_FIELDS.map((field) => (
                <SensorCard
                  key={field.key}
                  field={field}
                  distMm={sensorData[field.key]}
                  thresholdMm={thresholdMm}
                  sensitivity={sensitivity}
                  useFeet={useFeet}
                />
              ))}
            </div>

            <div className="sync-info debug-sync">
              <span className="sync-dot" aria-hidden="true" />
              {hasSensorData
                ? sensorStatus === 'stale'
                  ? 'Sensor stream stale — head module may be offline.'
                  : 'Sensor stream live (1 Hz Firebase upload).'
                : 'Waiting for head module sensor uploads...'}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
