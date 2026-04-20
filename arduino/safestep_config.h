#ifndef SAFESTEP_CONFIG_H
#define SAFESTEP_CONFIG_H

// ============================================================
// BLE Configuration
// ============================================================
#define BLE_SERVICE_UUID        "4fafc201-1fb5-459e-8fcc-c5c9c331914b"
#define BLE_SENSOR_CHAR_UUID    "beb5483e-36e1-4688-b7f5-ea07361b26a8"
#define BLE_CALIBRATION_CHAR_UUID "beb5483e-36e1-4688-b7f5-ea07361b26a9"

// ============================================================
// WiFi Credentials (update before flashing)
// ============================================================
#define WIFI_SSID       "YOUR_WIFI_SSID"
#define WIFI_PASSWORD   "YOUR_WIFI_PASSWORD"

// ============================================================
// Firebase Configuration
// DO NOT commit real values — set these before flashing only
// ============================================================
#define FIREBASE_API_KEY      "YOUR_API_KEY"
#define FIREBASE_DB_URL       "YOUR_DATABASE_URL"
#define FIREBASE_USER_EMAIL   "your@email.com"
#define FIREBASE_USER_PASSWORD "yourpassword"

// ============================================================
// I2C / Sensor Configuration
// ============================================================
#define I2C_SDA_PIN     21
#define I2C_SCL_PIN     22
#define TCA9548A_ADDR   0x70
#define NUM_SENSORS     3

// TCA9548A channels for each sensor direction
// Channel 0 = Front, 1 = Left, 2 = Right
#define SENSOR_CH_FRONT 0
#define SENSOR_CH_LEFT  1
#define SENSOR_CH_RIGHT 2

// ============================================================
// Motor Pin Definitions (Chest Module)
// ============================================================
// GPIO pins for each vibration motor, driven via N-channel MOSFETs
#define MOTOR_PIN_FRONT 25
#define MOTOR_PIN_BACK  26
#define MOTOR_PIN_LEFT  27
#define MOTOR_PIN_RIGHT 14

#define MOTOR_PWM_FREQ       5000  // 5 kHz
#define MOTOR_PWM_RESOLUTION 8     // 8-bit (0-255)

// ============================================================
// Default Calibration Values
// ============================================================
#define DEFAULT_THRESHOLD_MM  1000  // 1.0 meter (sensor max ~1.2m). Must match webapp DEFAULT_CALIBRATION.threshold_mm in src/hooks/useAuth.js
#define DEFAULT_HEIGHT_CM     170

// Sensitivity enum sent over BLE (1 byte). Web app stores the string
// "LOW"/"MEDIUM"/"HIGH"; the head module maps it to this enum before sending.
#define SENSITIVITY_LOW       0
#define SENSITIVITY_MEDIUM    1
#define SENSITIVITY_HIGH      2
#define DEFAULT_SENSITIVITY   SENSITIVITY_MEDIUM

// Sensor reliable max (VL53L0X is rated ~2m but tails off; we clamp HIGH here).
#define SENSOR_MAX_MM         1200

// Calibration BLE characteristic payload layout (3 bytes, little-endian):
//   [0] threshold_mm low byte
//   [1] threshold_mm high byte
//   [2] sensitivity enum (SENSITIVITY_LOW | _MEDIUM | _HIGH)
#define CALIBRATION_PAYLOAD_LEN 3

// ============================================================
// Timing
// ============================================================
#define SENSOR_POLL_MS        100    // 10 Hz sensor reading
#define CALIBRATION_POLL_MS   10000  // 10s Firebase calibration poll (settings apply within ~10s)
#define BLE_RECONNECT_MS      5000   // 5s BLE reconnect interval

// ============================================================
// Sensor out-of-range value
// ============================================================
#define SENSOR_OUT_OF_RANGE   9999

#endif
