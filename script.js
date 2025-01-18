let manualMode = false; // Flag for manual motor control
let autoPumpEnabled = true; // Automatic pump control enabled by default

// Show the login page
function showLoginPage() {
  document.getElementById("register-container").style.display = "none";
  document.getElementById("login-container").style.display = "block";
  document.getElementById("login-error").textContent = "";
}

// Show the registration page
function showRegisterPage() {
  document.getElementById("login-container").style.display = "none";
  document.getElementById("register-container").style.display = "block";
  document.getElementById("register-error").textContent = "";
}

// Login functionality
async function login() {
  const username = document.getElementById("login-username").value.trim();
  const password = document.getElementById("login-password").value.trim();

  try {
    const response = await fetch("http://localhost:5000/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    const data = await response.json();
    if (response.ok && data.token) {
      localStorage.setItem("authToken", data.token);
      document.getElementById("login-container").style.display = "none";
      document.getElementById("dashboard-container").style.display = "block";
      fetchAndUpdateSensorData(); // Start fetching sensor data
      fetchAndDisplayWeather(); // Start fetching weather data
    } else {
      document.getElementById("login-error").textContent = "Invalid username or password.";
    }
  } catch (error) {
    console.error(error);
    document.getElementById("login-error").textContent = "An error occurred. Please try again.";
  }
}

// Registration functionality
async function register() {
  const username = document.getElementById("register-username").value.trim();
  const password = document.getElementById("register-password").value.trim();
  const confirmPassword = document.getElementById("register-confirm-password").value.trim();

  if (password !== confirmPassword) {
    document.getElementById("register-error").textContent = "Passwords do not match.";
    return;
  }

  try {
    const response = await fetch("http://localhost:5000/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    const data = await response.json();
    if (response.ok) {
      alert("Registration successful! You can now log in.");
      showLoginPage(); // Redirect to login page
    } else {
      document.getElementById("register-error").textContent = data.message || "Registration failed.";
    }
  } catch (error) {
    console.error(error);
    document.getElementById("register-error").textContent = "An error occurred. Please try again.";
  }
}

// Weather functionality
async function fetchAndDisplayWeather() {
  const apiKey = "Enter the weather API"; // Replace with your OpenWeatherMap API key
  const city = "Enter the city name";  // City name
  const url = `https://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${apiKey}`;

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error("Failed to fetch weather data.");

    const data = await response.json();
    const weatherCondition = data.weather[0].description.toLowerCase(); // Corrected to access description properly
    const weatherDescription = `Weather: ${weatherCondition}`;
    
    // Displaying the weather description in the HTML
    document.getElementById("weather-display").textContent = weatherDescription;
  } catch (error) {
    console.error("Error fetching weather data:", error);
    document.getElementById("weather-display").textContent = "Weather: (unavailable)";
  }
}


// Fetch and display sensor data every second
function fetchAndUpdateSensorData() {
  const intervalId = setInterval(async () => {
    const token = localStorage.getItem("authToken");
    if (!token) {
      clearInterval(intervalId);
      return;
    }

    try {
      const response = await fetch("http://localhost:5000/sensor-data", {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await response.json();
      
      // If unauthorized, clear interval and return
      if (response.status === 401) {
        clearInterval(intervalId);
        logout();
        return;
      }

      // Update sensor displays
      document.getElementById("soil-moisture").textContent = data.soilMoisture || '-';
      document.getElementById("temperature").textContent = data.temperature || '-';
      document.getElementById("humidity").textContent = data.humidity || '-';

      // Update ESP32 connection status
      document.getElementById("esp32-status").textContent = data.esp32Connected
        ? "ESP32 Connection Status: Connected"
        : "ESP32 Connection Status: Not Connected";

      if (autoPumpEnabled && data.esp32Connected) {
        checkAutomaticPumpControl(data.soilMoisture);
      }
    } catch (error) {
      console.error(error);
      document.getElementById("esp32-status").textContent = "ESP32 Connection Status: Disconnected";
    }
  }, 1000);
}

// Check automatic pump control based on soil moisture
function checkAutomaticPumpControl(soilMoisture) {
  const waterPumpStatus = document.getElementById("water-pump-status");
  const pumpControlMode = document.getElementById("pump-control-mode");
  const minThreshold = 24; // Example minimum threshold
  const maxThreshold = 32; // Example maximum threshold

  if (soilMoisture < minThreshold && waterPumpStatus.textContent === "Water Pump is OFF") {
    waterPumpStatus.textContent = "Water Pump is ON (Automatic)";
    pumpControlMode.textContent = "Control Mode: Automatic";
  } else if (soilMoisture > maxThreshold && waterPumpStatus.textContent.startsWith("Water Pump is ON")) {
    waterPumpStatus.textContent = "Water Pump is OFF";
    pumpControlMode.textContent = "Control Mode: Automatic";
  }
}

// Manual toggle of water pump
function toggleWaterPump() {
  const waterPumpStatus = document.getElementById("water-pump-status");
  const pumpControlMode = document.getElementById("pump-control-mode");

  manualMode = !manualMode; // Toggle manual mode
  autoPumpEnabled = !manualMode; // Disable auto control if manual mode is enabled

  if (manualMode) {
    if (waterPumpStatus.textContent === "Water Pump is OFF") {
      waterPumpStatus.textContent = "Water Pump is ON (Automatic)";
    } else {
      waterPumpStatus.textContent = "Water Pump is OFF";
    }
    pumpControlMode.textContent = "Control Mode: Manual";
  } else {
    pumpControlMode.textContent = "Control Mode: Automatic";
  }
}

// Update crop suggestions
function updateCropSuggestions() {
  const cropName = document.getElementById("crop-name").value.toLowerCase().trim();
  const suggestionsList = document.getElementById("suggestions-list");

  const suggestions = Object.keys(cropDetails).filter(crop =>
    crop.toLowerCase().startsWith(cropName)
  );

  if (cropName && suggestions.length > 0) {
    document.getElementById("crop-suggestions").style.display = "block";
    suggestionsList.innerHTML = suggestions
      .map(crop => `<li onclick="selectCrop('${crop}')">${crop.charAt(0).toUpperCase() + crop.slice(1)}</li>`)
      .join('');
  } else {
    document.getElementById("crop-suggestions").style.display = "none";
    suggestionsList.innerHTML = '';
  }
}

// Select a crop from the suggestion box
function selectCrop(crop) {
  document.getElementById("crop-name").value = crop.charAt(0).toUpperCase() + crop.slice(1);
  document.getElementById("crop-suggestions").style.display = "none";
  document.getElementById("crop-name-display").textContent = crop.charAt(0).toUpperCase() + crop.slice(1);
  displayCropDetails(crop);
}

// Display crop details
function displayCropDetails(crop) {
  const details = cropDetails[crop];
  if (details) {
    document.getElementById("crop-details").textContent = `Temperature: ${details.temperature}, Soil Moisture Range: ${details.soilMoistureRange}, Optimal Moisture: ${details.optimalMoisture},Humidity: ${details.optimalHumidity}`;
  }
}

// Reset crop name and display input again
function resetCrop() {
  document.getElementById("crop-name").value = "";
  document.getElementById("crop-name-display").textContent = "";
  document.getElementById("crop-details").textContent = "";
  document.getElementById("crop-suggestions").style.display = "none";
}

// Logout functionality
function logout() {
  // Clear the authentication token
  localStorage.removeItem("authToken");
  
  // Reset all displays
  document.getElementById("dashboard-container").style.display = "none";
  document.getElementById("login-container").style.display = "block";
  document.getElementById("login-error").textContent = "";
  document.getElementById("login-username").value = "";
  document.getElementById("login-password").value = "";
  
  // Reset any other relevant states
  document.getElementById("soil-moisture").textContent = "-";
  document.getElementById("temperature").textContent = "-";
  document.getElementById("humidity").textContent = "-";
  document.getElementById("weather-display").textContent = "Weather: (unavailable)";
  document.getElementById("esp32-status").textContent = "ESP32 Connection Status: Not Connected";
}

// Crop details
const cropDetails = {
  maize: { temperature: "22-30°C", soilMoistureRange: "24-32%", optimalMoisture: "60-80%", optimalHumidity: "60-80%" },
  ragi: { temperature: "22-30°C", soilMoistureRange: "22-30%", optimalMoisture: "55-75%", optimalHumidity: "60-70%" },
  tomato: { temperature: "18-30°C", soilMoistureRange: "26-32%", optimalMoisture: "65-80%", optimalHumidity: "65-75%" },
  wheat: { temperature: "10-20°C", soilMoistureRange: "25-35%", optimalMoisture: "60-70%", optimalHumidity: "55-65%" },
  paddy: { temperature: "25-35°C", soilMoistureRange: "30-45%", optimalMoisture: "70-85%", optimalHumidity: "75-85%" },
  potato: { temperature: "18-22°C", soilMoistureRange: "20-30%", optimalMoisture: "60-70%", optimalHumidity: "65-75%" },
  barley: { temperature: "10-18°C", soilMoistureRange: "22-28%", optimalMoisture: "55-70%", optimalHumidity: "50-60%" },
  sugarcane: { temperature: "20-30°C", soilMoistureRange: "30-40%", optimalMoisture: "65-75%", optimalHumidity: "70-80%" },
  cotton: { temperature: "25-35°C", soilMoistureRange: "20-30%", optimalMoisture: "50-70%", optimalHumidity: "60-70%" },
  cucumber: { temperature: "20-30°C", soilMoistureRange: "30-40%", optimalMoisture: "70-85%", optimalHumidity: "65-75%" },
  carrot: { temperature: "16-22°C", soilMoistureRange: "20-30%", optimalMoisture: "60-70%", optimalHumidity: "60-70%" },
  onion: { temperature: "15-25°C", soilMoistureRange: "25-35%", optimalMoisture: "60-70%", optimalHumidity: "60-70%" },
  lettuce: { temperature: "15-20°C", soilMoistureRange: "30-40%", optimalMoisture: "70-80%", optimalHumidity: "70-80%" },
  spinach: { temperature: "10-20°C", soilMoistureRange: "25-35%", optimalMoisture: "65-75%", optimalHumidity: "60-70%" },
  peas: { temperature: "15-20°C", soilMoistureRange: "20-30%", optimalMoisture: "60-70%", optimalHumidity: "60-70%" },
  beans: { temperature: "18-24°C", soilMoistureRange: "25-35%", optimalMoisture: "60-75%", optimalHumidity: "60-70%" },
  chili: { temperature: "20-30°C", soilMoistureRange: "25-35%", optimalMoisture: "60-70%", optimalHumidity: "60-70%" },
  strawberry: { temperature: "15-25°C", soilMoistureRange: "30-40%", optimalMoisture: "70-80%", optimalHumidity: "70-80%" },
  grapes: { temperature: "25-30°C", soilMoistureRange: "20-30%", optimalMoisture: "55-65%", optimalHumidity: "55-65%" },
  avocado: { temperature: "18-25°C", soilMoistureRange: "30-40%", optimalMoisture: "60-70%", optimalHumidity: "60-70%" },
  banana: { temperature: "25-30°C", soilMoistureRange: "30-45%", optimalMoisture: "70-80%", optimalHumidity: "70-80%" },
  papaya: { temperature: "25-30°C", soilMoistureRange: "30-40%", optimalMoisture: "65-75%", optimalHumidity: "70-80%" },
  mango: { temperature: "25-35°C", soilMoistureRange: "25-35%", optimalMoisture: "60-70%", optimalHumidity: "60-70%" },
  brinjal: { temperature: "20-30°C", soilMoistureRange: "25-35%", optimalMoisture: "60-70%", optimalHumidity: "60-70%" },
  bittergourd: { temperature: "25-30°C", soilMoistureRange: "30-40%", optimalMoisture: "60-75%", optimalHumidity: "60-70%" },
  pumpkin: { temperature: "20-30°C", soilMoistureRange: "30-40%", optimalMoisture: "70-80%", optimalHumidity: "70-80%" },
  watermelon: { temperature: "20-30°C", soilMoistureRange: "25-35%", optimalMoisture: "60-70%", optimalHumidity: "60-70%" },
  okra: { temperature: "22-35°C", soilMoistureRange: "20-30%", optimalMoisture: "60-70%", optimalHumidity: "60-70%" },
  sweetcorn: { temperature: "22-30°C", soilMoistureRange: "20-30%", optimalMoisture: "60-80%", optimalHumidity: "60-70%" },
  sweetpotato: { temperature: "20-30°C", soilMoistureRange: "20-30%", optimalMoisture: "60-75%", optimalHumidity: "60-70%" },
  asparagus: { temperature: "10-18°C", soilMoistureRange: "25-35%", optimalMoisture: "60-70%", optimalHumidity: "50-60%" },
  cauliflower: { temperature: "15-20°C", soilMoistureRange: "30-40%", optimalMoisture: "70-80%", optimalHumidity: "70-80%" },
  cabbage: { temperature: "15-20°C", soilMoistureRange: "30-40%", optimalMoisture: "70-80%", optimalHumidity: "70-80%" },
  cauliflower: { temperature: "18-22°C", soilMoistureRange: "25-35%", optimalMoisture: "60-70%", optimalHumidity: "60-70%" },
  celery: { temperature: "15-20°C", soilMoistureRange: "25-35%", optimalMoisture: "60-70%", optimalHumidity: "60-70%" },
  leeks: { temperature: "10-20°C", soilMoistureRange: "25-35%", optimalMoisture: "60-70%", optimalHumidity: "50-60%" },
  radish: { temperature: "12-18°C", soilMoistureRange: "20-30%", optimalMoisture: "60-70%", optimalHumidity: "60-70%" },
  zucchini: { temperature: "22-30°C", soilMoistureRange: "30-40%", optimalMoisture: "70-80%", optimalHumidity: "70-80%" },
  artichoke: { temperature: "15-22°C", soilMoistureRange: "30-40%", optimalMoisture: "70-80%", optimalHumidity: "70-80%" },
  chard: { temperature: "15-25°C", soilMoistureRange: "30-40%", optimalMoisture: "70-80%", optimalHumidity: "70-80%" },
  dill: { temperature: "18-24°C", soilMoistureRange: "25-35%", optimalMoisture: "60-70%", optimalHumidity: "60-70%" },
  fennel: { temperature: "18-25°C", soilMoistureRange: "25-35%", optimalMoisture: "60-70%", optimalHumidity: "60-70%" },
  tarragon: { temperature: "18-25°C", soilMoistureRange: "20-30%", optimalMoisture: "60-70%", optimalHumidity: "60-70%" },
  ginger: { temperature: "25-30°C", soilMoistureRange: "30-40%", optimalMoisture: "65-75%", optimalHumidity: "70-80%" },
  turmeric: { temperature: "25-30°C", soilMoistureRange: "30-40%", optimalMoisture: "65-75%", optimalHumidity: "70-80%" },
  coriander: { temperature: "18-30°C", soilMoistureRange: "25-35%", optimalMoisture: "60-70%", optimalHumidity: "60-70%" },
  basil: { temperature: "20-30°C", soilMoistureRange: "25-35%", optimalMoisture: "60-70%", optimalHumidity: "60-70%" },
  parsley: { temperature: "15-25°C", soilMoistureRange: "25-35%", optimalMoisture: "60-70%", optimalHumidity: "60-70%" },
  mint: { temperature: "20-30°C", soilMoistureRange: "25-35%", optimalMoisture: "60-80%", optimalHumidity: "70-80%" },
  oregano: { temperature: "18-24°C", soilMoistureRange: "20-30%", optimalMoisture: "60-70%", optimalHumidity: "60-70%" },
  thyme: { temperature: "20-30°C", soilMoistureRange: "20-30%", optimalMoisture: "60-70%", optimalHumidity: "60-70%" },
  justicia_carnea: { temperature: "20-30°C", soilMoistureRange: "40-60%", optimalMoisture: "60-70%", optimalHumidity: "50-80%" }
};
