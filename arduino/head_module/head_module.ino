#include <WiFi.h>
#include <Wire.h>
#include <VL53L0X.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>
#include <Firebase_ESP_Client.h>
#include "addons/TokenHelper.h"
#include "addons/RTDBHelper.h"

#include "../safestep_config.h"

// ============================================================
// Globals
// ============================================================

// Sensors
VL53L0X sensors[NUM_SENSORS];
uint8_t sensorChannels[NUM_SENSORS] = {
  SENSOR_CH_FRONT, SENSOR_CH_BACK, SENSOR_CH_LEFT, SENSOR_CH_RIGHT
};
uint16_t distances[NUM_SENSORS] = {0, 0, 0, 0};

// Calibration
uint16_t thresholdMm = DEFAULT_THRESHOLD_MM;
uint16_t heightCm = DEFAULT_HEIGHT_CM;
unsigned long lastCalibrationUpdate = 0;

// Firebase
FirebaseData fbdo;
FirebaseAuth auth;
FirebaseConfig firebaseConfig;
bool firebaseReady = false;
String uid = "";
String basePath = "";

// BLE
BLEServer* pServer = NULL;
BLECharacteristic* pSensorChar = NULL;
BLECharacteristic* pCalibrationChar = NULL;
bool bleClientConnected = false;

// Timing
unsigned long lastSensorRead = 0;
unsigned long lastCalibrationPoll = 0;
unsigned long lastSensorUpload = 0;

const unsigned long SENSOR_UPLOAD_INTERVAL_MS = 1000;

// ============================================================
// TCA9548A Multiplexer
// ============================================================

void tcaSelect(uint8_t channel) {
  if (channel > 7) return;
  Wire.beginTransmission(TCA9548A_ADDR);
  Wire.write(1 << channel);
  Wire.endTransmission();
}

// ============================================================
// BLE Callbacks
// ============================================================

class ServerCallbacks : public BLEServerCallbacks {
  void onConnect(BLEServer* pServer) {
    bleClientConnected = true;
    Serial.println("BLE client connected");
  }
  void onDisconnect(BLEServer* pServer) {
    bleClientConnected = false;
    Serial.println("BLE client disconnected");
    // Restart advertising so chest module can reconnect
    pServer->startAdvertising();
  }
};

// ============================================================
// Sensor Initialization
// ============================================================

void initSensors() {
  Serial.println("Initializing VL53L0X sensors via TCA9548A...");

  for (int i = 0; i < NUM_SENSORS; i++) {
    tcaSelect(sensorChannels[i]);
    delay(10);

    sensors[i].setTimeout(500);
    if (!sensors[i].init()) {
      Serial.print("WARNING: Failed to init sensor on channel ");
      Serial.println(sensorChannels[i]);
      continue;
    }
    sensors[i].startContinuous();
    Serial.print("Sensor on channel ");
    Serial.print(sensorChannels[i]);
    Serial.println(" initialized OK");
  }
}

// ============================================================
// WiFi Connection
// ============================================================

void connectWiFi() {
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  WiFi.setSleep(false);  // Prevent WiFi sleep for BLE coexistence
  Serial.print("Connecting to Wi-Fi");
  while (WiFi.status() != WL_CONNECTED) {
    Serial.print(".");
    delay(300);
  }
  Serial.println();
  Serial.print("Connected with IP: ");
  Serial.println(WiFi.localIP());
}

// ============================================================
// Firebase Initialization
// ============================================================

void initFirebase() {
  firebaseConfig.api_key = FIREBASE_API_KEY;
  firebaseConfig.database_url = FIREBASE_DB_URL;
  firebaseConfig.token_status_callback = tokenStatusCallback;

  auth.user.email = FIREBASE_USER_EMAIL;
  auth.user.password = FIREBASE_USER_PASSWORD;

  Firebase.begin(&firebaseConfig, &auth);
  Firebase.reconnectWiFi(true);

  Serial.print("Waiting for Firebase auth");
  while (auth.token.uid == "") {
    Serial.print(".");
    delay(300);
  }

  uid = auth.token.uid.c_str();
  basePath = "/users/" + uid + "/";
  firebaseReady = true;

  Serial.println();
  Serial.println("Firebase signin OK");
  Serial.println("UID: " + uid);
  Serial.println("Base path: " + basePath);
}

// ============================================================
// Load Calibration from Firebase
// ============================================================

void loadCalibrationFromFirebase() {
  if (!firebaseReady || !Firebase.ready()) return;

  Serial.println("Loading calibration from Firebase...");

  if (Firebase.RTDB.getInt(&fbdo, basePath + "calibration/threshold_mm")) {
    thresholdMm = fbdo.intData();
    Serial.print("Threshold: ");
    Serial.print(thresholdMm);
    Serial.println(" mm");
  } else {
    Serial.println("No threshold in Firebase, using default");
  }

  if (Firebase.RTDB.getInt(&fbdo, basePath + "calibration/height_cm")) {
    heightCm = fbdo.intData();
    Serial.print("Height: ");
    Serial.print(heightCm);
    Serial.println(" cm");
  } else {
    Serial.println("No height in Firebase, using default");
  }

  if (Firebase.RTDB.getInt(&fbdo, basePath + "calibration/last_updated")) {
    lastCalibrationUpdate = fbdo.intData();
  }

  // Update BLE calibration characteristic
  if (pCalibrationChar != NULL) {
    uint8_t calData[2];
    calData[0] = thresholdMm & 0xFF;
    calData[1] = (thresholdMm >> 8) & 0xFF;
    pCalibrationChar->setValue(calData, 2);
    if (bleClientConnected) {
      pCalibrationChar->notify();
    }
  }
}

// ============================================================
// Poll Firebase for Calibration Changes
// ============================================================

void pollCalibration() {
  if (!firebaseReady || !Firebase.ready()) return;

  unsigned long remoteTimestamp = 0;
  if (Firebase.RTDB.getInt(&fbdo, basePath + "calibration/last_updated")) {
    remoteTimestamp = fbdo.intData();
  }

  if (remoteTimestamp != 0 && remoteTimestamp != lastCalibrationUpdate) {
    Serial.println("Calibration changed, reloading...");
    loadCalibrationFromFirebase();
  }
}

// ============================================================
// BLE Initialization
// ============================================================

void initBLE() {
  Serial.println("Initializing BLE...");

  BLEDevice::init("SafeStep-Head");
  pServer = BLEDevice::createServer();
  pServer->setCallbacks(new ServerCallbacks());

  BLEService* pService = pServer->createService(BLE_SERVICE_UUID);

  // Sensor data characteristic: 8 bytes (4x uint16_t), READ + NOTIFY
  pSensorChar = pService->createCharacteristic(
    BLE_SENSOR_CHAR_UUID,
    BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_NOTIFY
  );
  pSensorChar->addDescriptor(new BLE2902());

  // Calibration characteristic: 2 bytes (uint16_t threshold_mm), READ + NOTIFY
  pCalibrationChar = pService->createCharacteristic(
    BLE_CALIBRATION_CHAR_UUID,
    BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_NOTIFY
  );
  pCalibrationChar->addDescriptor(new BLE2902());

  // Set initial calibration value
  uint8_t calData[2];
  calData[0] = thresholdMm & 0xFF;
  calData[1] = (thresholdMm >> 8) & 0xFF;
  pCalibrationChar->setValue(calData, 2);

  pService->start();

  BLEAdvertising* pAdvertising = BLEDevice::getAdvertising();
  pAdvertising->addServiceUUID(BLE_SERVICE_UUID);
  pAdvertising->setScanResponse(true);
  pAdvertising->setMinPreferred(0x06);
  BLEDevice::startAdvertising();

  Serial.println("BLE advertising started");
}

// ============================================================
// Read Sensors and Update BLE
// ============================================================

void pushSensorsToFirebase(unsigned long nowMs) {
  if (!firebaseReady || !Firebase.ready()) return;
  if (nowMs - lastSensorUpload < SENSOR_UPLOAD_INTERVAL_MS) return;

  lastSensorUpload = nowMs;

  FirebaseJson json;
  json.set("front_mm", distances[0]);
  json.set("back_mm", distances[1]);
  json.set("left_mm", distances[2]);
  json.set("right_mm", distances[3]);
  json.set("last_updated/.sv", "timestamp");

  if (!Firebase.RTDB.updateNode(&fbdo, basePath + "sensors", &json)) {
    Serial.print("Sensor upload failed: ");
    Serial.println(fbdo.errorReason());
  }
}

void readAndBroadcastSensors() {
  uint8_t bleData[8];

  for (int i = 0; i < NUM_SENSORS; i++) {
    tcaSelect(sensorChannels[i]);
    uint16_t dist = sensors[i].readRangeContinuousMillimeters();

    if (sensors[i].timeoutOccurred()) {
      dist = SENSOR_OUT_OF_RANGE;
    }

    distances[i] = dist;

    // Pack as little-endian uint16_t
    bleData[i * 2] = dist & 0xFF;
    bleData[i * 2 + 1] = (dist >> 8) & 0xFF;
  }

  // Update BLE characteristic and notify
  pSensorChar->setValue(bleData, 8);
  if (bleClientConnected) {
    pSensorChar->notify();
  }

  // Debug output
  Serial.print("F:");
  Serial.print(distances[0]);
  Serial.print(" B:");
  Serial.print(distances[1]);
  Serial.print(" L:");
  Serial.print(distances[2]);
  Serial.print(" R:");
  Serial.println(distances[3]);
}

// ============================================================
// Setup
// ============================================================

void setup() {
  Serial.begin(115200);
  Serial.println("\n=== SafeStep Head Module ===");

  // Init I2C
  Wire.begin(I2C_SDA_PIN, I2C_SCL_PIN);

  // Init sensors
  initSensors();

  // Connect WiFi
  connectWiFi();

  // Init Firebase and load calibration
  initFirebase();
  loadCalibrationFromFirebase();

  // Init BLE (after calibration is loaded so initial value is correct)
  initBLE();

  Serial.println("Setup complete. Running...");
}

// ============================================================
// Loop
// ============================================================

void loop() {
  unsigned long now = millis();

  // Read sensors at 10 Hz
  if (now - lastSensorRead >= SENSOR_POLL_MS) {
    lastSensorRead = now;
    readAndBroadcastSensors();
    pushSensorsToFirebase(now);
  }

  // Poll Firebase for calibration changes every 30s
  if (now - lastCalibrationPoll >= CALIBRATION_POLL_MS) {
    lastCalibrationPoll = now;
    pollCalibration();
  }
}
