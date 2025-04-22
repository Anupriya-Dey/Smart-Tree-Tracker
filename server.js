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
    'Longitude'
];

const latestSensorData = {}; // Store latest data for each sensor
let latestPrediction = null;

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

        // Real-time prediction for Temperature sensor
        if (sensor === 'Temperature') {
            const last512 = keys.slice(-512).map(k => ({ [k]: data[k] }));
            const python = spawn('./venv/Scripts/python.exe', ['prediction.py', JSON.stringify(last512)]);

            python.stdout.on('data', (data) => {
                console.log(`Python process finished. Now reading prediction from file...`);
            
                const filePath = path.join(__dirname, 'prediction_output.json');
                
                // Wait for the file to be written and then read it
                fs.readFile(filePath, 'utf8', (err, data) => {
                    if (err) {
                        console.error(`Failed to read prediction_output.json: ${err.toString()}`);
                        return;
                    }
            
                    try {
                        latestPrediction = JSON.parse(data.toString());
                        console.log("Prediction result from file:", latestPrediction);
                        io.emit('temperaturePrediction', JSON.stringify(latestPrediction));
                    } catch (e) {
                        console.error(`Failed to parse JSON from file: ${e.toString()}`);
                    }
                });
            });

            python.stderr.on('data', (err) => {
                console.error(`Error from prediction.py: ${err.toString()}`);
            });
        }
    });
});

// WebSocket connection
io.on('connection', (socket) => {
    console.log('Client connected');

    // Send all latest sensor data on new connection
    for (const [sensor, data] of Object.entries(latestSensorData)) {
        socket.emit(`sensorData-${sensor}`, data);
    }
    if (latestPrediction) {
        socket.emit('temperaturePrediction', JSON.stringify(latestPrediction));
    }

    socket.on('disconnect', () => console.log('Client disconnected'));
});

// Start Server
const PORT = 3000;
server.listen(PORT, () => {
    console.log("Server running at http://localhost:3000");
});

const nodemailer = require('nodemailer');

// Configure email transport
const GLOBAL_TEMP_THRESHOLD = 100;
const transporter = nodemailer.createTransport({
    service: 'gmail',  // Use Gmail, or change to any email service provider
    auth: {
        user: 'iotgroupproject12@gmail.com',
        pass: 'xehb stuv bhmu dibe',  // Ensure to use environment variables for security
    },
});

let subscribedEmails = [];

const loadSubscribedEmails = async () => {
  const emailRef = db.ref('SubscribedEmails');
  const snapshot = await emailRef.once('value');
  const data = snapshot.val();

  if (data) {
    subscribedEmails = Object.values(data);
    console.log("✅ Subscribed emails loaded:", subscribedEmails);
  } else {
    console.log("📭 No subscribed emails found.");
  }
};


// Store the last time an email was sent
let lastEmailTime = null;

const sendEmailAlert = async (temperature) => {
    // Get the current time
    const currentTime = new Date();
    await loadSubscribedEmails(); // wait for emails to load!

    if (subscribedEmails.length === 0) {
        console.log("🚫 No subscribed emails to send alert to.");
        return;
    }

    // If no email has been sent yet or it has been more than 3 hours since the last email
    if (temperature > GLOBAL_TEMP_THRESHOLD) {
        // if (!lastEmailTime || (currentTime - lastEmailTime) >= 3 * 60 * 60 * 1000) {
            // Create the email content
            const mailOptions = {
                from: 'iotgroupproject12@gmail.com',
                to: subscribedEmails.join(','),
                subject: 'Forest Fire Alert: High Temperature',
                text: `Warning! The temperature has risen above 100°C. Current temperature: ${temperature}°C. Please take precautions.`,
            };

            // Send the email
            transporter.sendMail(mailOptions, (error, info) => {
                if (error) {
                    console.log('Error sending email:', error);
                } else {
                    console.log('Email sent: ' + info.response);
                    lastEmailTime = currentTime;  // Update the last email sent time
                }

            });
        // } else {
        //     console.log('Email not sent. Less than 3 hours since the last alert.');
        // }
    }
};

// const io1 = require('socket.io')(server); // Assuming you use express server

io.on('connection', (socket) => {
    console.log('Client connected.');
    socket.on('sendTemperatureAlert', ({ temperature }) => {
        console.log("📧 Preparing to send alert email for temperature:", temperature);
        sendEmailAlert(temperature);
    });
});