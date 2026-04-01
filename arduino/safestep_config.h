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
#define TCA9548A_ADDR   0x70
#define NUM_SENSORS     4

// TCA9548A channels for each sensor direction
// Channel 0 = Front, 1 = Back, 2 = Left, 3 = Right
#define SENSOR_CH_FRONT 0
#define SENSOR_CH_BACK  1
#define SENSOR_CH_LEFT  2
#define SENSOR_CH_RIGHT 3

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
#define DEFAULT_THRESHOLD_MM  800   // 0.8 meter (sensor max ~1.2m)
#define DEFAULT_HEIGHT_CM     170

// ============================================================
// Timing
// ============================================================
#define SENSOR_POLL_MS        100    // 10 Hz sensor reading
#define CALIBRATION_POLL_MS   30000  // 30s Firebase calibration poll
#define BLE_RECONNECT_MS      5000   // 5s BLE reconnect interval

// ============================================================
// Sensor out-of-range value
// ============================================================
#define SENSOR_OUT_OF_RANGE   9999

#endif
