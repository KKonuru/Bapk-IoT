#include <WiFi.h>
#include <template.h>
#include "addons/TokenHelper.h"
#include "addons/RTDBHelper.h"

#define WIFI_SSID       "YOUR_WIFI_SSID"
#define WIFI_PASSWORD   "YOUR_WIFI_PASSWORD"

#define DATABASE_URL    "YOUR_DATABASE_URL"
#define API_KEY         "YOUR_API_KEY"
#define USER_EMAIL      "your@email.com"
#define USER_PASSWORD   "yourpassword"


FirebaseData fbdo;
FirebaseAuth auth;
FirebaseConfig config;

unsigned long sendDataPrevMillis = 0;
bool signinOK = false;
String uid = "";
String basePath = "";


void setup() {
  Serial.begin(115200);



  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("Connecting to Wi-Fi");
  while (WiFi.status() != WL_CONNECTED) {
    Serial.print(".");
    delay(300);
  }
  Serial.println();
  Serial.print("Connected with IP: ");
  Serial.println(WiFi.localIP());
  Serial.println();

  config.api_key = API_KEY;
  config.database_url = DATABASE_URL;
  config.token_status_callback = tokenStatusCallback;

  auth.user.email = USER_EMAIL;
  auth.user.password = USER_PASSWORD;

  Firebase.begin(&config, &auth);
  Firebase.reconnectWiFi(true);

  Serial.print("Waiting for Firebase auth");
  while (auth.token.uid == "") {
    Serial.print(".");
    delay(300);
  }

  uid = auth.token.uid.c_str();
  basePath = "/users/" + uid + "/";
  signinOK = true;

  Serial.println();
  Serial.println("Firebase signin OK");
  Serial.println("UID: " + uid);
  Serial.println("Base path: " + basePath);
}


void loop() {
  if (Firebase.ready() && signinOK && (millis() - sendDataPrevMillis > 5000 || sendDataPrevMillis == 0)) {
    sendDataPrevMillis = millis();
    //WRITE Example 

    //Write an int
    //int sensorValue = analogRead(YOUR_PIN);
    //if (Firebase.RTDB.setInt(&fbdo, basePath + "Sensor/your_sensor", sensorValue)) {
    //  Serial.println("Write OK: " + String(sensorValue));
    //} else {
    //  Serial.println("Write FAILED: " + fbdo.errorReason());
    //}



    
  }
}