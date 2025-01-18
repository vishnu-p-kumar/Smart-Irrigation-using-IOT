const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
app.use(bodyParser.json());
app.use(cors());

// MongoDB connection setup
const uri = "Replace with your MongoDB address  provided in the interface while creating the database";
mongoose.connect(uri)
  .then(() => console.log('MongoDB connected successfully'))
  .catch(err => console.error('MongoDB connection error:', err));

// MongoDB Schemas
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
});

const sensorDataSchema = new mongoose.Schema({
  soilMoisture: Number,
  temperature: Number,
  humidity: Number,
  timestamp: { type: Date, default: Date.now },
});

const User = mongoose.model('User', userSchema);
const SensorData = mongoose.model('SensorData', sensorDataSchema);

// Track ESP32 connection status
let lastConnectionTime = null; // Track last connection time for ESP32
const connectionTimeout = 60 * 1000; // 60 seconds timeout for ESP32 connection

// Track motor state and control mode
let motorState = false;
let manualMode = false;

// Register endpoint
app.post('/register', async (req, res) => {
  const { username, password } = req.body;

  try {
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({ message: 'Username already exists.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({ username, password: hashedPassword });
    await newUser.save();

    res.status(201).json({ message: 'User created successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Login endpoint
app.post('/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(400).json({ message: 'Invalid username or password.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid username or password.' });
    }

    const token = jwt.sign({ userId: user._id }, 'secret', { expiresIn: '1h' });
    res.json({ token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ESP32 sensor data reception
app.post('/esp32-data', async (req, res) => {
  const { soilMoisture, temperature, humidity } = req.body;

  try {
    // Update last connection time
    lastConnectionTime = Date.now();

    // Save sensor data to MongoDB
    const newSensorData = new SensorData({ soilMoisture, temperature, humidity });
    await newSensorData.save();

    console.log('Received data from ESP32:', { soilMoisture, temperature, humidity });
    res.status(200).json({ message: 'Data received successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to save sensor data.' });
  }
});

// Fetch real-time sensor data
app.get('/sensor-data', async (req, res) => {
  const { authorization } = req.headers;

  // Check if the Authorization header is present
  if (!authorization || !authorization.startsWith('Bearer ')) {
    return res.status(401).json({ 
      message: 'Unauthorized: Missing or malformed token.',
      soilMoisture: null,
      temperature: null,
      humidity: null,
      esp32Connected: false
    });
  }

  const token = authorization.split(' ')[1]; // Extract the token after "Bearer"
  try {
    // Verify the token
    jwt.verify(token, 'secret');

    // Check if ESP32 is connected
    const currentTime = Date.now();
    const isEsp32Connected = lastConnectionTime && (currentTime - lastConnectionTime) < connectionTimeout;

    // Fetch the latest sensor data
    const latestData = await SensorData.findOne().sort({ timestamp: -1 }).limit(1);

    if (!latestData) {
      return res.status(200).json({ 
        message: 'No sensor data available.',
        soilMoisture: null,
        temperature: null,
        humidity: null,
        esp32Connected: isEsp32Connected 
      });
    }

    res.json({
      soilMoisture: latestData.soilMoisture,
      temperature: latestData.temperature,
      humidity: latestData.humidity,
      esp32Connected: isEsp32Connected,
    });
  } catch (err) {
    console.error(err);
    return res.status(401).json({ 
      message: 'Unauthorized: Invalid token.',
      soilMoisture: null,
      temperature: null,
      humidity: null,
      esp32Connected: false
    });
  }
});

// Motor control endpoint
app.post('/toggle-motor', (req, res) => {
  const { manual, state } = req.body;
  manualMode = manual !== undefined ? manual : manualMode;
  motorState = state !== undefined ? state : motorState;

  console.log(`Motor state: ${motorState ? 'ON' : 'OFF'}, Mode: ${manualMode ? 'Manual' : 'Automatic'}`);

  res.status(200).json({
    motorState,
    controlMode: manualMode ? 'Manual' : 'Automatic',
  });
});

// Start server
app.listen(5000, () => {
  console.log('Server is running on http://localhost:5000');
});
