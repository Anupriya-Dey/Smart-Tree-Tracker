// public/alerts.js

const GLOBAL_TEMP_THRESHOLD = 100;

function checkForTemperatureAlert(data) {
  const latestTemp = data.latest;
  if (latestTemp > GLOBAL_TEMP_THRESHOLD) {
    // alert("⚠️ Forest Fire Alert! Temperature has risen above 100°C!");
    console.log(latestTemp)
    showForestFireBanner();
    socket.emit('sendTemperatureAlert', { temperature: latestTemp });
  }
}

function showForestFireBanner() {
    if (document.getElementById("forestFireBanner")) return;
  
    const banner = document.createElement("div");
    banner.id = "forestFireBanner";
    banner.innerHTML = `
      <span>🔥 Forest Fire Alert! Temperature exceeds 100°C!</span>
      <button id="closeBanner" style="margin-left: 20px; background-color: #ff0000; color: #fff; padding: 5px 10px; border: none; cursor: pointer;">Close</button>
    `;
    
    banner.style.position = "fixed";
    banner.style.top = "0";
    banner.style.left = "0";
    banner.style.width = "100%";
    banner.style.backgroundColor = "#ff4d4d";
    banner.style.color = "#fff";
    banner.style.fontWeight = "bold";
    banner.style.padding = "1rem";
    banner.style.textAlign = "center";
    banner.style.zIndex = "9999";
    banner.style.boxShadow = "0 2px 10px rgba(0,0,0,0.5)";
    banner.style.fontSize = "1.2rem";
  
    document.body.appendChild(banner);
  
    // Close the banner when the user clicks the close button
    document.getElementById("closeBanner").addEventListener("click", () => {
      banner.remove();
      alertShown = false; // Allow alert again for the next instance
    });
  }
