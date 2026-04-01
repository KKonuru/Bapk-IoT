import { useState, useEffect } from 'react';
import { ref, get, set } from 'firebase/database';
import { db } from '../firebase';

const SENSITIVITY_OPTIONS = [
  { value: 'LOW', label: 'Low', desc: 'Nearby only' },
  { value: 'MEDIUM', label: 'Medium', desc: 'Balanced' },
  { value: 'HIGH', label: 'High', desc: 'Max range' },
];

const MM_PER_FOOT = 304.8;

function cmToFeetIn(cm) {
  const totalInches = cm / 2.54;
  const feet = Math.floor(totalInches / 12);
  const inches = Math.round(totalInches % 12);
  return `${feet}'${inches}"`;
}

function mmToFeet(mm) {
  return (mm / MM_PER_FOOT).toFixed(1);
}

// Interactive compass that reacts to threshold and sensitivity
function Compass({ thresholdMm, sensitivity, useFeet }) {
  // Map threshold (200–1200mm) to a visual radius percentage (20%–95%)
  const rangePercent = 20 + ((thresholdMm - 200) / 1000) * 75;

  // Sensitivity affects pulse speed
  const pulseSpeed = sensitivity === 'HIGH' ? '1.5s' : sensitivity === 'MEDIUM' ? '2.5s' : '4s';

  const displayDist = useFeet
    ? `${mmToFeet(thresholdMm)} ft`
    : `${(thresholdMm / 1000).toFixed(2)} m`;

  return (
    <div className="compass" role="img" aria-label={`Detection zone: ${displayDist} in all directions`}>
      {/* Detection zone — scales with threshold */}
      <div
        className="compass-zone"
        style={{ inset: `${50 - rangePercent / 2}%` }}
      />
      <div
        className="compass-zone-pulse"
        style={{
          inset: `${50 - rangePercent / 2}%`,
          animationDuration: pulseSpeed,
        }}
      />

      {/* Rings */}
      <div className="compass-ring outer" />
      <div className="compass-ring inner" />

      {/* Crosshair */}
      <div className="compass-line vertical" />
      <div className="compass-line horizontal" />

      {/* Center dot (you) */}
      <div className="compass-center" />

      {/* Direction labels */}
      <span className="compass-label front">Front</span>
      <span className="compass-label back">Back</span>
      <span className="compass-label left">Left</span>
      <span className="compass-label right">Right</span>

      {/* Distance readout */}
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

export default function CalibrationPage({ uid, onSignOut }) {
  const [heightCm, setHeightCm] = useState(170);
  const [thresholdMm, setThresholdMm] = useState(800);
  const [sensitivity, setSensitivity] = useState('MEDIUM');
  const [useFeet, setUseFeet] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState('');
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    async function loadCalibration() {
      try {
        const snapshot = await get(ref(db, `users/${uid}/calibration`));
        if (snapshot.exists()) {
          const data = snapshot.val();
          if (data.height_cm) setHeightCm(data.height_cm);
          if (data.threshold_mm) setThresholdMm(data.threshold_mm);
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

  const handleSave = async () => {
    setSaving(true);
    setSaveStatus('');

    try {
      await set(ref(db, `users/${uid}/calibration`), {
        height_cm: heightCm,
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

  const heightDisplay = useFeet ? cmToFeetIn(heightCm) : `${heightCm}`;
  const heightUnit = useFeet ? '' : 'cm';
  const thresholdDisplay = useFeet
    ? mmToFeet(thresholdMm)
    : (thresholdMm / 1000).toFixed(2);
  const thresholdUnit = useFeet ? 'ft' : 'm';

  if (loadingData) {
    return <div className="loading">Loading calibration...</div>;
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

      <div className="calibration-form glass-card">
        {/* Interactive compass reacts to threshold + sensitivity */}
        <Compass thresholdMm={thresholdMm} sensitivity={sensitivity} useFeet={useFeet} />

        {/* Unit Toggle */}
        <div className="unit-toggle-row">
          <span className="unit-label">Display units</span>
          <div className="unit-toggle" role="radiogroup" aria-label="Unit system">
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

        {/* Height Slider */}
        <div className="slider-group">
          <div className="slider-header">
            <label htmlFor="height">Your Height</label>
            <div className="slider-value">
              {heightDisplay}
              {heightUnit && <span className="slider-unit">{heightUnit}</span>}
            </div>
          </div>
          <input
            id="height"
            type="range"
            min={100}
            max={220}
            step={1}
            value={heightCm}
            onChange={(e) => setHeightCm(Number(e.target.value))}
            aria-label={`Height: ${heightCm} centimeters`}
            style={{
              background: `linear-gradient(to right, var(--accent) 0%, var(--accent) ${((heightCm - 100) / 120) * 100}%, rgba(124,163,206,0.1) ${((heightCm - 100) / 120) * 100}%, rgba(124,163,206,0.1) 100%)`
            }}
          />
          <div className="range-labels">
            <span>{useFeet ? "3'3\"" : '100 cm'}</span>
            <span>{useFeet ? "7'3\"" : '220 cm'}</span>
          </div>
        </div>

        {/* Sensitivity */}
        <div className="sensitivity-group">
          <label>Sensitivity</label>
          <div className="segmented-control" role="group" aria-label="Sensitivity level">
            {SENSITIVITY_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                className={`segment-btn ${sensitivity === opt.value ? 'active' : ''}`}
                onClick={() => setSensitivity(opt.value)}
                aria-pressed={sensitivity === opt.value}
              >
                {opt.label}
                <span className="segment-desc">{opt.desc}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Alert Range */}
        <div className="slider-group">
          <div className="slider-header">
            <label htmlFor="threshold">Alert Range</label>
            <div className="slider-value">
              {thresholdDisplay}
              <span className="slider-unit">{thresholdUnit}</span>
            </div>
          </div>
          <p className="slider-desc">
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
            aria-label={`Alert range: ${(thresholdMm / 1000).toFixed(2)} meters`}
            style={{
              background: `linear-gradient(to right, var(--accent) 0%, var(--accent) ${((thresholdMm - 200) / 1000) * 100}%, rgba(124,163,206,0.1) ${((thresholdMm - 200) / 1000) * 100}%, rgba(124,163,206,0.1) 100%)`
            }}
          />
          <div className="range-labels">
            <span>{useFeet ? '0.7 ft' : '0.2 m'}</span>
            <span>{useFeet ? '3.9 ft' : '1.2 m'}</span>
          </div>
        </div>

        <hr className="section-divider" />

        {/* Save Button */}
        <button
          onClick={handleSave}
          disabled={saving}
          className={`btn-primary ${saveStatus === 'saved' ? 'saved' : ''}`}
        >
          <CloudIcon />
          <span>
            {saving ? 'Saving...' : saveStatus === 'saved' ? 'Saved!' : 'Save to Cloud'}
          </span>
        </button>

        {saveStatus === 'saved' && (
          <p className="status-message success" role="status">
            <CheckIcon />
            Settings saved. Your device will sync automatically.
          </p>
        )}
        {saveStatus === 'error' && (
          <p className="status-message error" role="alert">
            Failed to save. Please try again.
          </p>
        )}

        <div className="sync-info">
          <span className="sync-dot" />
          Device syncs every 30 seconds
        </div>
      </div>
    </div>
  );
}
