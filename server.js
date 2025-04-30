// Import required modules

console.log("Starting the server...");
const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const cors = require('cors');
const admin = require('firebase-admin');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const { spawn } = require("child_process");

// Initialize Firebase Admin SDK
const serviceAccount = require("./iotgroup-12-firebase-adminsdk-fbsvc-e6bea30e7a.json");
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://iotgroup-12-default-rtdb.asia-southeast1.firebasedatabase.app/"
});

const db = admin.database();

// Initialize Express app
const app = express();
const server = http.createServer(app);
const io = socketIO(server);

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(__dirname + '/public')); // Serve frontend files
app.post('/subscribe', async (req, res) => {
    const { email } = req.body;

    if (!email || !email.includes('@')) {
        return res.status(400).json({ message: 'Invalid email format' });
    }

    try {
        const emailRef = db.ref('SubscribedEmails');
        await emailRef.push(email);
        subscribedEmails.push(email); // Optional: update runtime list

        return res.status(200).json({ message: 'Subscribed successfully' });
    } catch (err) {
        console.error("Failed to subscribe email:", err);
        return res.status(500).json({ message: 'Subscription failed' });
    }
});


// List of sensors including GPS data
const sensorPaths = [
    'Temperature',
    'Pressure',
    'AccelerationX',
    'AccelerationY',
    'AccelerationZ',
    'GyroscopeX',
    'GyroscopeY',
    'GyroscopeZ',
    'Latitude',
    'Longitude',
    'GPS_Latitude',
    'GPS_Longitude',
    'GPS_Altitude',
    'GPS_Speed'
];

const latestSensorData = {}; // Store latest data for each sensor
let latestTemperaturePrediction = null;
let latestPressurePrediction = null;

// Set up Firebase listeners for each sensor
sensorPaths.forEach(sensor => {
    const sensorRef = db.ref(sensor);

    sensorRef.on("value", (snapshot) => {
        const data = snapshot.val();
        if (!data) return;

        const keys = Object.keys(data).sort();
        const latestKey = keys[keys.length - 1];
        const latestValue = data[latestKey];

        latestSensorData[sensor] = {
            latest: latestValue,
            history: keys.map((k) => ({ key: k, value: data[k] }))
        };

        console.log(`Emitting for ${sensor}:`, latestSensorData[sensor]);
        io.emit(`sensorData-${sensor}`, latestSensorData[sensor]);

        // Real-time prediction
        if (sensor === 'Temperature') {
            const last512 = keys.slice(-512).map(k => ({ [k]: data[k] }));

            const python = spawn('./venv/Scripts/python.exe', ['pred.py', JSON.stringify(last512), sensor]);

            python.stdout.on('data', () => {
                console.log(`Python process finished for ${sensor}. Reading prediction...`);

                const filePath = path.join(__dirname, `prediction_output_${sensor}.json`);
                setTimeout(() => {
                    fs.readFile(filePath, 'utf8', (err, fileData) => {
                        if (err) {
                            console.error(`Failed to read prediction_output_${sensor}.json: ${err.toString()}`);
                            return;
                        }

                        try {
                            const parsedPrediction = JSON.parse(fileData);
                            if (sensor === 'Temperature') {
                                latestTemperaturePrediction = parsedPrediction;
                                io.emit('temperaturePrediction', JSON.stringify(parsedPrediction));
                            } else if (sensor === 'Pressure') {
                                latestPressurePrediction = parsedPrediction;
                                io.emit('pressurePrediction', JSON.stringify(parsedPrediction));
                            }
                            console.log(`${sensor} prediction result emitted.`);
                        } catch (e) {
                            console.error(`Failed to parse ${sensor} prediction JSON: ${e.toString()}`);
                        }
                    });
                });
            }, 200); // Delay of 200ms

            python.stderr.on('data', (err) => {
                console.error(`Error from pred.py for ${sensor}: ${err.toString()}`);
            });
        }
    });
});

// WebSocket connection
io.on('connection', (socket) => {
    console.log('Client connected');

    // Send all latest sensor data
    for (const [sensor, data] of Object.entries(latestSensorData)) {
        socket.emit(`sensorData-${sensor}`, data);
    }

    if (latestTemperaturePrediction) {
        socket.emit('temperaturePrediction', JSON.stringify(latestTemperaturePrediction));
    }
    if (latestPressurePrediction) {
        socket.emit('pressurePrediction', JSON.stringify(latestPressurePrediction));
    }

    socket.on('disconnect', () => console.log('Client disconnected'));
});

// Start Server
const PORT = 3000;
server.listen(PORT, () => {
    console.log("Server running at http://localhost:3000");
});

const nodemailer = require('nodemailer');
const GLOBAL_TEMP_THRESHOLD = 60;
// const PRESSURE_DROP_THRESHOLD = 950; // example value in hPa
// const ALTITUDE_THRESHOLD = 5;        // meters (drastic drop = fall)
// const SPEED_THRESHOLD = 10;          // m/s (for movement alert)

let subscribedEmails = [];
let lastSent = {
    temperature: null,
    pressure: null,
    fall: null,
    speed: null,
    position: null,
};

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'iotgroupproject12@gmail.com',
        pass: 'xehb stuv bhmu dibe',
    },
});

const loadSubscribedEmails = async () => {
    const emailRef = db.ref('SubscribedEmails');
    const snapshot = await emailRef.once('value');
    const data = snapshot.val();
    subscribedEmails = data ? Object.values(data) : [];
};

const shouldSend = (lastTimeKey) => {
    const now = new Date();
    return !lastSent[lastTimeKey] || (now - lastSent[lastTimeKey] > 3 * 60 * 60 * 1000); // every 3 hours
};

const sendAlert = async (subject, message, type) => {
    await loadSubscribedEmails();
    if (subscribedEmails.length === 0) return;

    if (!shouldSend(type)) {
        console.log(`Alert for ${type} suppressed (sent recently).`);
        return;
    }

    const mailOptions = {
        from: 'iotgroupproject12@gmail.com',
        to: subscribedEmails.join(','),
        subject,
        text: message,
    };

    transporter.sendMail(mailOptions, (error, info) => {
        if (error) console.log(`Error sending ${type} alert:`, error);
        else {
            console.log(`${type} alert sent:`, info.response);
            lastSent[type] = new Date();
        }
    });
};

io.on('connection', (socket) => {
    console.log('Client connected.');

    socket.on('sendTemperatureAlert', ({ temperature }) => {
        // if (temperature > GLOBAL_TEMP_THRESHOLD) {
        sendAlert(
            'Forest Fire Alert',
            `Warning! Temperature exceeds ${GLOBAL_TEMP_THRESHOLD}°C. Current: ${temperature}°C.`,
            'temperature'
        );
        // }
    });

    socket.on('sendPressureAlert', ({ pressure }) => {
        // if (pressure < PRESSURE_DROP_THRESHOLD) {
        sendAlert(
            'Storm Alert',
            `Possible storm detected due to pressure drop. Current pressure: ${pressure} kPa.`,
            'pressure'
        );
        // }
    });

    socket.on('sendGPS_AltitudeAlert', ({ gps_altitude }) => {
        // if (altitude < ALTITUDE_THRESHOLD) {
        sendAlert(
            'Fall Alert',
            `Fall detected. Current altitude is unusually low: ${gps_altitude} meters.`,
            'fall'
        );
        // }
    });

    socket.on('sendGPS_SpeedAlert', ({ gps_speed }) => {
        // if (speed > SPEED_THRESHOLD) {
        sendAlert(
            'Movement Alert',
            `Significant movement detected. Current speed: ${gps_speed} m/s.`,
            'speed'
        );
        // }
    });

    socket.on('sendPositionAlert', ({ latitude, longitude }) => {
        // if (oldLat !== newLat || oldLong !== newLong) {
        sendAlert(
            'Position Change Alert',
            `Device has changed position:\nNew Latitude and Longitude are (${latitude}, ${longitude})`,
            'position'
        );
        // }
    });
});
