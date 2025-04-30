// alerts.js

const GLOBAL_TEMP_THRESHOLD = 60;      // in °C
const GLOBAL_PRESSURE_THRESHOLD = 90;   // in kPa
const ORIGIN_LAT = 29.87;
const ORIGIN_LON = 77.9;
const GLOBAL_GPS_SPEED_THRESHOLD = 10;
const GLOBAL_GPS_ALTITUDE_THRESHOLD = 265;

// Temperature Alert
function checkForTemperatureAlert(data) {
  const latestTemp = data.latest;
  if (latestTemp > GLOBAL_TEMP_THRESHOLD) {
    console.log(`Temperature: ${latestTemp}°C`);
    showForestFireBanner();
    socket.emit('sendTemperatureAlert', { temperature: latestTemp });
  }
}

// Pressure Alert
function checkForPressureAlert(data) {
  const latestPressure = data.latest;
  if (latestPressure < GLOBAL_PRESSURE_THRESHOLD) {
    console.log(`Pressure: ${latestPressure} kPa`);
    showPressureAlertBanner();
    socket.emit('sendPressureAlert', { pressure: latestPressure });
  }
}

// GPS_Speed Alert
function checkForGPS_SpeedAlert(data) {
  const latestGPS_Speed = data.latest;
  if (latestGPS_Speed > GLOBAL_GPS_SPEED_THRESHOLD) {
    console.log(`GPS_Speed: ${latestGPS_Speed} km/h`);
    showGPS_SpeedAlertBanner();
    socket.emit('sendGPS_SpeedAlert', { gps_speed: latestGPS_Speed });
  }
}

// GPS_Altitude Alert
function checkForGPS_AltitudeAlert(data) {
  const latestGPS_Altitude = data.latest;
  if (latestGPS_Altitude < GLOBAL_GPS_ALTITUDE_THRESHOLD) {
    console.log(`GPS_Altitude: ${latestGPS_Altitude} m`);
    showGPS_AltitudeAlertBanner();
    socket.emit('sendGPS_AltitudeAlert', { gps_altitude: latestGPS_Altitude });
  }
}

// GPS Position Alert

function triggerPositionCheckIfReady() {
  if (latestLatitude !== null && latestLongitude !== null) {
    checkForPositionAlert({
      latest_lat: latestLatitude,
      latest_lon: latestLongitude
    });
  }
}

function checkForPositionAlert(data) {
  const latestLat = data.latest_lat;
  const latestLon = data.latest_lon;

  const latDiff = Math.abs(latestLat - ORIGIN_LAT);
  const lonDiff = Math.abs(latestLon - ORIGIN_LON);

  if (latDiff > 0.009 || lonDiff > 0.0089) {
    console.log(`Position Alert: Latitude or Longitude deviation too high!`);
    showPositionAlertBanner();
    socket.emit('sendPositionAlert', {
      latitude: latestLat,
      longitude: latestLon
    });
  }
}


function showAlertBanner({ id, message, backgroundColor = "#ff1a1a" }) {
  if (document.getElementById(id)) return; // Prevent duplicate banners

  const banner = document.createElement("div");
  banner.id = id;

  banner.innerHTML = `
    <span>${message}</span>
    <button style="
      margin-left: 20px;
      background-color: #0000aa;
      color: #fff;
      padding: 8px 16px;
      font-size: 1.1rem;
      border: none;
      border-radius: 6px;
      cursor: pointer;
    ">Close</button>
  `;

  styleBanner(banner, backgroundColor);
  document.body.appendChild(banner);

  banner.querySelector("button").addEventListener("click", () => banner.remove());
}

function styleBanner(banner, bgColor) {
  banner.style.position = "fixed";
  banner.style.top = "0";
  banner.style.left = "0";
  banner.style.width = "100%";
  banner.style.backgroundColor = bgColor;
  banner.style.color = "#fff";
  banner.style.fontWeight = "bold";
  banner.style.padding = "1.5rem 1rem";
  banner.style.textAlign = "center";
  banner.style.zIndex = "9999";
  banner.style.boxShadow = "0 4px 15px rgba(0,0,0,0.6)";
  banner.style.fontSize = "2rem";
  banner.style.letterSpacing = "0.5px";
}

function showForestFireBanner() {
  showAlertBanner({
    id: "forestFireBanner",
    message: "🔥 Forest Fire Alert! Temperature exceeds 100°C!"
  });
}

function showPressureAlertBanner() {
  showAlertBanner({
    id: "pressureBanner",
    message: `⚠️ Storm Alert! Atmospheric pressure is below ${GLOBAL_PRESSURE_THRESHOLD} kPa!`
  });
}

function showGPS_AltitudeAlertBanner() {
  showAlertBanner({
    id: "altitudeBanner",
    message: "🗻 Fall Alert! Unusual altitude detected!"
  });
}

function showGPS_SpeedAlertBanner() {
  showAlertBanner({
    id: "speedBanner",
    message: `🚗 Speed Alert! Speed exceeds ${GLOBAL_GPS_SPEED_THRESHOLD} km/h!`
  });
}

function showPositionAlertBanner() {
  showAlertBanner({
    id: "positionBanner",
    message: "📍 Position Change Alert! Device has moved from original location!"
  });
}
