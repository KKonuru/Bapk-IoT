#include <BLEDevice.h>
#include <BLEUtils.h>
#include <BLEScan.h>
#include <BLEAdvertisedDevice.h>

#include "../safestep_config.h"

// ============================================================
// Globals
// ============================================================

// Motor pins array (front, back, left, right)
const uint8_t motorPins[NUM_SENSORS] = {
  MOTOR_PIN_FRONT, MOTOR_PIN_BACK, MOTOR_PIN_LEFT, MOTOR_PIN_RIGHT
};

// Calibration
volatile uint16_t thresholdMm = DEFAULT_THRESHOLD_MM;

// BLE
BLEScan* pBLEScan = NULL;
BLEClient* pClient = NULL;
BLERemoteCharacteristic* pSensorChar = NULL;
BLERemoteCharacteristic* pCalibrationChar = NULL;
bool connected = false;
bool doConnect = false;
BLEAdvertisedDevice* targetDevice = NULL;

// Timing
unsigned long lastReconnectAttempt = 0;

// ============================================================
// Motor Control
// ============================================================

void initMotors() {
  for (int i = 0; i < NUM_SENSORS; i++) {
    ledcAttach(motorPins[i], MOTOR_PWM_FREQ, MOTOR_PWM_RESOLUTION);
    ledcWrite(motorPins[i], 0);  // Motors off
  }
  Serial.println("Motors initialized");
}

void setMotorIntensity(uint8_t motorIndex, uint8_t intensity) {
  if (motorIndex < NUM_SENSORS) {
    ledcWrite(motorPins[motorIndex], intensity);
  }
}

void allMotorsOff() {
  for (int i = 0; i < NUM_SENSORS; i++) {
    ledcWrite(motorPins[i], 0);
  }
}

// ============================================================
// BLE Notification Callbacks
// ============================================================

// Called at ~10 Hz when head module sends new sensor data
void sensorNotifyCallback(
  BLERemoteCharacteristic* pChar,
  uint8_t* pData,
  size_t length,
  bool isNotify
) {
  if (length < 8) return;

  for (int i = 0; i < NUM_SENSORS; i++) {
    uint16_t dist = pData[i * 2] | (pData[i * 2 + 1] << 8);

    if (dist >= thresholdMm) {
      setMotorIntensity(i, 0);
    } else {
      // Inverse proportional: closer = stronger vibration
      uint8_t intensity = map(dist, 0, thresholdMm, 255, 0);
      setMotorIntensity(i, intensity);
    }
  }

  // Debug output
  Serial.print("Distances - F:");
  Serial.print(pData[0] | (pData[1] << 8));
  Serial.print(" B:");
  Serial.print(pData[2] | (pData[3] << 8));
  Serial.print(" L:");
  Serial.print(pData[4] | (pData[5] << 8));
  Serial.print(" R:");
  Serial.print(pData[6] | (pData[7] << 8));
  Serial.print(" | Threshold:");
  Serial.println(thresholdMm);
}

// Called when head module updates the calibration threshold
void calibrationNotifyCallback(
  BLERemoteCharacteristic* pChar,
  uint8_t* pData,
  size_t length,
  bool isNotify
) {
  if (length < 2) return;

  thresholdMm = pData[0] | (pData[1] << 8);
  Serial.print("Calibration updated - Threshold: ");
  Serial.print(thresholdMm);
  Serial.println(" mm");
}

// ============================================================
// BLE Client Callbacks
// ============================================================

class ClientCallbacks : public BLEClientCallbacks {
  void onConnect(BLEClient* client) {
    Serial.println("Connected to head module");
  }
  void onDisconnect(BLEClient* client) {
    connected = false;
    allMotorsOff();  // Safety: turn off motors when disconnected
    Serial.println("Disconnected from head module");
  }
};

// ============================================================
// BLE Scan Callback
// ============================================================

class ScanCallbacks : public BLEAdvertisedDeviceCallbacks {
  void onResult(BLEAdvertisedDevice advertisedDevice) {
    if (advertisedDevice.haveServiceUUID() &&
        advertisedDevice.isAdvertisingService(BLEUUID(BLE_SERVICE_UUID))) {
      Serial.print("Found SafeStep Head: ");
      Serial.println(advertisedDevice.toString().c_str());

      targetDevice = new BLEAdvertisedDevice(advertisedDevice);
      doConnect = true;
      pBLEScan->stop();
    }
  }
};

// ============================================================
// Connect to Head Module
// ============================================================

bool connectToServer() {
  if (targetDevice == NULL) return false;

  Serial.print("Connecting to ");
  Serial.println(targetDevice->getAddress().toString().c_str());

  pClient = BLEDevice::createClient();
  pClient->setClientCallbacks(new ClientCallbacks());

  if (!pClient->connect(targetDevice)) {
    Serial.println("Failed to connect");
    return false;
  }
  Serial.println("Connected to BLE server");

  // Get service
  BLERemoteService* pService = pClient->getService(BLE_SERVICE_UUID);
  if (pService == NULL) {
    Serial.println("Failed to find service");
    pClient->disconnect();
    return false;
  }

  // Get sensor data characteristic and register for notifications
  pSensorChar = pService->getCharacteristic(BLE_SENSOR_CHAR_UUID);
  if (pSensorChar == NULL) {
    Serial.println("Failed to find sensor characteristic");
    pClient->disconnect();
    return false;
  }
  if (pSensorChar->canNotify()) {
    pSensorChar->registerForNotify(sensorNotifyCallback);
    Serial.println("Subscribed to sensor notifications");
  }

  // Get calibration characteristic and register for notifications
  pCalibrationChar = pService->getCharacteristic(BLE_CALIBRATION_CHAR_UUID);
  if (pCalibrationChar != NULL) {
    // Read initial threshold value
    if (pCalibrationChar->canRead()) {
      String value = pCalibrationChar->readValue();
      if (value.length() >= 2) {
        thresholdMm = (uint8_t)value[0] | ((uint8_t)value[1] << 8);
        Serial.print("Initial threshold from head: ");
        Serial.print(thresholdMm);
        Serial.println(" mm");
      }
    }
    if (pCalibrationChar->canNotify()) {
      pCalibrationChar->registerForNotify(calibrationNotifyCallback);
      Serial.println("Subscribed to calibration notifications");
    }
  } else {
    Serial.println("Calibration characteristic not found, using default threshold");
  }

  connected = true;
  return true;
}

// ============================================================
// Setup
// ============================================================

void setup() {
  Serial.begin(115200);
  Serial.println("\n=== SafeStep Chest Module ===");

  // Init motors
  initMotors();

  // Init BLE
  BLEDevice::init("SafeStep-Chest");
  pBLEScan = BLEDevice::getScan();
  pBLEScan->setAdvertisedDeviceCallbacks(new ScanCallbacks());
  pBLEScan->setActiveScan(true);
  pBLEScan->setInterval(100);
  pBLEScan->setWindow(99);

  // Start initial scan
  Serial.println("Scanning for SafeStep Head module...");
  pBLEScan->start(5, false);

  Serial.println("Setup complete.");
}

// ============================================================
// Loop
// ============================================================

void loop() {
  unsigned long now = millis();

  // Attempt connection if device was found
  if (doConnect) {
    if (connectToServer()) {
      Serial.println("Successfully connected to head module");
    } else {
      Serial.println("Connection failed, will retry...");
    }
    doConnect = false;
  }

  // If disconnected, attempt reconnection periodically
  if (!connected && (now - lastReconnectAttempt >= BLE_RECONNECT_MS)) {
    lastReconnectAttempt = now;
    Serial.println("Scanning for SafeStep Head module...");
    pBLEScan->start(5, false);
  }
}
