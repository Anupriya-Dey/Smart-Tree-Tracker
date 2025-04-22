#include <ESP8266WiFi.h>
#include <Wire.h>
#include <Adafruit_BMP280.h>
#include <Adafruit_MPU6050.h>
#include <Adafruit_Sensor.h>
#include <TinyGPS++.h>
#include <time.h>
#include <ESP8266Firebase.h>
#include <NTPClient.h>
#include <WiFiUdp.h>
#include <SoftwareSerial.h>

// WiFi & Firebase config
#define _SSID "Manu"
#define _PASSWORD "12345678"
#define REFERENCE_URL "https://iotalternateproject-default-rtdb.asia-southeast1.firebasedatabase.app/"
Firebase firebase(REFERENCE_URL);

// Pins
#define SDA_PIN 2  // D4
#define SCL_PIN 5  // D1
#define GPS_RX_PIN 4  // D2
#define GPS_TX_PIN 0  // D3

// Sensors
Adafruit_BMP280 bmp;
Adafruit_MPU6050 mpu;
TinyGPSPlus gps;
SoftwareSerial gpsSerial(GPS_RX_PIN, GPS_TX_PIN);

WiFiUDP ntpUDP;
NTPClient timeClient(ntpUDP, "pool.ntp.org", 19800); // IST offset

void initSensors();
void readIMU(const String &timestamp);
void readBarometer(const String &timestamp);
//void readGPS(const String &timestamp);
String getTimestamp();

void setup() {
  Serial.begin(115200);
  gpsSerial.begin(9600);
  WiFi.begin(_SSID, _PASSWORD);

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi Connected. IP Address: " + WiFi.localIP().toString());

  Wire.begin(SDA_PIN, SCL_PIN);
  initSensors();

  timeClient.begin();
  
  Serial.println();
  Serial.println("Time client synced");
}

void loop() {
  timeClient.update();

  time_t epochTime = timeClient.getEpochTime();
  struct tm *ptm = gmtime((time_t *)&epochTime);

//   String currentDate = String(ptm->tm_year + 1900) + "-" + String(ptm->tm_mon + 1) + "-" + String(ptm->tm_mday);
  String timeStr = String(currentDate + " " + String(timeClient.getHours()) + ":" + String(timeClient.getMinutes()));

  Serial.println("Timestamp: " + timeStr);

  readIMU(timeStr);
  readBarometer(timeStr);
  readGPS(timeStr);

  delay(60000);
}

void initSensors() {
  if (!bmp.begin(0x76)) Serial.println("BMP280 not found!");
  if (!mpu.begin()) Serial.println("MPU6050 not found!");
}

void readIMU(String &timestamp) {
  sensors_event_t accel, gyro, temp;
  mpu.getEvent(&accel, &gyro, &temp);

  Serial.println(timestamp);
  bool success = firebase.setFloat("AccelerationX/" + timestamp, accel.acceleration.x);
    if (!success) {
    Serial.println("Firebase update failed!");
  } else {
    Serial.println("Firebase update successful.");
  }
  firebase.setFloat("AccelerationY/" + timestamp, accel.acceleration.y);
  firebase.setFloat("AccelerationZ/" + timestamp, accel.acceleration.z);
  firebase.setFloat("GyroscopeX/" + timestamp, gyro.gyro.x);
  firebase.setFloat("GyroscopeY/" + timestamp, gyro.gyro.y);
  firebase.setFloat("GyroscopeZ/" + timestamp, gyro.gyro.z);

  Serial.printf("IMU - Accel: X=%.2f, Y=%.2f, Z=%.2f | Gyro: X=%.2f, Y=%.2f, Z=%.2f [%s]\n",
                accel.acceleration.x, accel.acceleration.y, accel.acceleration.z,
                gyro.gyro.x, gyro.gyro.y, gyro.gyro.z, timestamp.c_str());
}

void readBarometer(String &timestamp) {
  float temperature = bmp.readTemperature();
  float pressure = bmp.readPressure();

  Serial.println(timestamp);
  //Serial.println("Temperature/" + timestamp, temperature);
  firebase.setFloat("Temperature/" + timestamp, temperature);
  firebase.setFloat("Pressure/" + timestamp, pressure);

  Serial.printf("Barometer - Temp: %.2f°C, Pressure: %.2f hPa [%s]\n", temperature, pressure, timestamp.c_str());
}

void readGPS(String &timestamp) {
  while (gpsSerial.available()) {
    gps.encode(gpsSerial.read());
  }

  if (gps.location.isValid()) {
    float lat = gps.location.lat();
    float lng = gps.location.lng();

    firebase.setFloat("GPS_Latitude/" + timestamp, lat);
    firebase.setFloat("GPS_Longitude/" + timestamp, lng);

    Serial.printf("GPS - Lat: %.6f, Lng: %.6f [%s]\n", lat, lng, timestamp.c_str());
  } else {
    Serial.println("GPS - No fix.");
  }
}
