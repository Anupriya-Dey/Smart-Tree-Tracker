const socket = io();

// Sensor data listeners
const sensorList = [
  'Temperature',
  'Pressure',
  'AccelerationX',
  'AccelerationY',
  'AccelerationZ',
  'GyroscopeX',
  'GyroscopeY',
  'GyroscopeZ',
  'GPS_Latitude',
  'GPS_Longitude',
  'GPS_Altitude',
  'GPS_Speed'
];

sensorList.forEach(sensor => {
  socket.on(`sensorData-${sensor}`, (data) => {
    const element = document.getElementById(sensor);
    if (element) element.textContent = data.latest;
  });
});

// GPS data
socket.on('sensorData-Latitude', (data) => {
  const lat = document.getElementById('Latitude');
  if (lat) lat.textContent = data.latest;
});

socket.on('sensorData-Longitude', (data) => {
  const lng = document.getElementById('Longitude');
  if (lng) lng.textContent = data.latest;
});

// Actual GPS data
socket.on('sensorData-GPS_Latitude', (data) => {
  const lat = document.getElementById('GPS_Latitude');
  if (lat) lat.textContent = data.latest;
});

socket.on('sensorData-GPS_Longitude', (data) => {
  const lng = document.getElementById('GPS_Longitude');
  if (lng) lng.textContent = data.latest;
});

socket.on('sensorData-Latitude', (data) => {
  const lat = document.getElementById('GPS_Altitude');
  if (lat) lat.textContent = data.latest;
});

socket.on('sensorData-Longitude', (data) => {
  const lng = document.getElementById('GPS_Speed');
  if (lng) lng.textContent = data.latest;
});

// // Chart setup
// const ctx = document.getElementById('sensorChart').getContext('2d');

// let labels = [];
// let predictionData = [];

// // Create gradient for the line
// const gradient = ctx.createLinearGradient(0, 0, 0, 400);
// gradient.addColorStop(0, '#ff6384');
// gradient.addColorStop(1, '#ffa4a4');

// const sensorChart = new Chart(ctx, {
//   type: 'line',
//   data: {
//     labels: labels,
//     datasets: [{
//       label: 'Forecasted Temperature (°C)',
//       data: predictionData,
//       fill: false,
//       borderColor: gradient,
//       backgroundColor: gradient,
//       borderWidth: 2,
//       pointRadius: 4,
//       pointHoverRadius: 6,
//       pointBackgroundColor: '#ff6384',
//       tension: 0.3
//     }]
//   },
//   options: {
//     responsive: true,
//     animation: {
//       duration: 1000,
//       easing: 'easeOutQuart'
//     },
//     interaction: {
//       mode: 'nearest',
//       intersect: false
//     },
//     plugins: {
//       legend: {
//         labels: {
//           color: '#9effa8'
//         }
//       }
//     },
//     scales: {
//       x: {
//         title: {
//           display: true,
//           text: 'Future Time (1-min steps)',
//           color: '#9effa8'
//         },
//         ticks: {
//           color: '#e0ffe3'
//         }
//       },
//       y: {
//         title: {
//           display: true,
//           text: 'Temperature (°C)',
//           color: '#9effa8'
//         },
//         ticks: {
//           color: '#e0ffe3'
//         },
//         min: 0,
//         max: 100
//       }
//     }
//   }
// });

// // Handle predicted temperature from server
// socket.on('temperaturePrediction', (predictionStr) => {
//   try {
//     const predictions = JSON.parse(predictionStr);
//     if (!Array.isArray(predictions) || predictions.length !== 96) {
//       console.error("Invalid predictions data");
//       return;
//     }

//     const now = new Date();
//     const futureLabels = [];
//     for (let i = 73; i <= 96; i++) {
//       const future = new Date(now.getTime() + i * 60000);
//       futureLabels.push(future.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
//     }

//     labels = futureLabels;
//     predictionData = predictions.slice(-24);

//     sensorChart.data.labels = labels;
//     sensorChart.data.datasets[0].data = predictionData;
//     sensorChart.update();
//   } catch (err) {
//     console.error("Failed to parse predictions:", err);
//   }
// });

const ctx = document.getElementById('sensorChart').getContext('2d');
const sensorSelect = document.getElementById('sensorSelect');

let labels = [];
let temperatureData = [];
let pressureData = [];

const gradient = ctx.createLinearGradient(0, 0, 0, 400);
gradient.addColorStop(0, '#ff6384');
gradient.addColorStop(1, '#ffa4a4');

const sensorChart = new Chart(ctx, {
  type: 'line',
  data: {
    labels: labels,
    datasets: [{
      label: 'Forecasted Temperature (°C)',
      data: temperatureData,
      fill: false,
      borderColor: gradient,
      backgroundColor: gradient,
      borderWidth: 2,
      pointRadius: 4,
      pointHoverRadius: 6,
      pointBackgroundColor: '#ff6384',
      tension: 0.3
    }]
  },
  options: {
    responsive: true,
    animation: {
      duration: 1000,
      easing: 'easeOutQuart'
    },
    interaction: {
      mode: 'nearest',
      intersect: false
    },
    plugins: {
      legend: {
        labels: {
          color: '#9effa8'
        }
      }
    },
    scales: {
      x: {
        title: {
          display: true,
          text: 'Future Time (10-min steps)',
          color: '#9effa8'
        },
        ticks: {
          color: '#e0ffe3'
        }
      },
      y: {
        title: {
          display: true,
          text: 'Temperature (°C)',
          color: '#9effa8'
        },
        ticks: {
          color: '#e0ffe3'
        },
        min: 30,
        max: 45
      }
    }
  }
});

function updateChart(sensorType) {
  sensorChart.data.datasets[0].data = sensorType === 'temperature' ? temperatureData : pressureData;
  sensorChart.data.datasets[0].label = sensorType === 'temperature' ? 'Forecasted Temperature (°C)' : 'Forecasted Pressure (kPa)';
  sensorChart.options.scales.y.title.text = sensorChart.data.datasets[0].label;
  sensorChart.options.scales.y.min = sensorType === 'temperature' ? -10 : 70;
  sensorChart.options.scales.y.max = sensorType === 'temperature' ? 60 : 120;


  sensorChart.update();
}

// Handle dropdown change
sensorSelect.addEventListener('change', (e) => {
  updateChart(e.target.value);
});

// Handle predicted temperature from server
socket.on('temperaturePrediction', (predictionStr) => {
  try {
    const predictions = JSON.parse(predictionStr);
    console.log(predictions)
    if (!Array.isArray(predictions)) {
      console.error("Invalid temperature prediction data");
      return;
    }

    const now = new Date();
    labels = [];
    for (let i = 1; i <= 100; i++) { //earlier 73
      const future = new Date(now.getTime() + i * 10000);
      labels.push(future.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    }

    // temperatureData = predictions.slice(-24);
    temperatureData = predictions;

    sensorChart.data.labels = labels;

    if (sensorSelect.value === 'temperature') updateChart('temperature');
  } catch (err) {
    console.error("Failed to parse temperature predictions:", err);
  }
});

// Handle predicted pressure from server
socket.on('pressurePrediction', (predictionStr) => {
  try {
    const predictions = JSON.parse(predictionStr);
    if (!Array.isArray(predictions)) {
      console.error("Invalid pressure prediction data");
      return;
    }

    // pressureData = predictions.slice(-24);
    pressureData = predictions;


    if (sensorSelect.value === 'pressure') updateChart('pressure');
  } catch (err) {
    console.error("Failed to parse pressure predictions:", err);
  }
});


// Handle email subscription
document.getElementById('subscribeForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('emailInput').value;

  try {
    const response = await fetch('/subscribe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email })
    });

    const result = await response.json();
    document.getElementById('subscriptionMessage').textContent = result.message;
    document.getElementById('emailInput').value = '';
  } catch (error) {
    document.getElementById('subscriptionMessage').textContent = 'Subscription failed. Try again later.';
    console.error("Subscription error:", error);
  }
});

socket.on(`sensorData-Temperature`, (data) => {
  const temperatureElement = document.getElementById("Temperature");
  const fill = document.getElementById("thermometerFill");

  if (temperatureElement && fill) {
    const temp = parseFloat(data.latest);
    temperatureElement.textContent = `${temp} °C`;

    // Normalize to 0–100%
    const percent = Math.min(Math.max((temp / 100) * 100, 0), 100);
    fill.style.height = `${percent}%`;

    // Set color based on temperature range
    let color;
    if (temp < 20) {
      color = "#4fc3f7"; // Cool blue
    } else if (temp < 40) {
      color = "#81c784"; // Mild green
    } else if (temp < 60) {
      color = "#ffd54f"; // Warm yellow
    } else if (temp < 80) {
      color = "#ffb74d"; // Hot orange
    } else {
      color = "#e57373"; // Very hot red
    }

    fill.style.backgroundColor = color;
  }
});


