// ------------ Startup ------------
document.addEventListener("DOMContentLoaded", () => {
  // nav
  const pages = document.querySelectorAll(".page");
  const navItems = document.querySelectorAll(".nav-item");
  navItems.forEach(it => {
    it.addEventListener("click", () => {
      navItems.forEach(i=>i.classList.remove("active"));
      it.classList.add("active");
      pages.forEach(p=>p.classList.remove("active"));
      document.getElementById(it.dataset.page).classList.add("active");
    });
  });



  document.querySelectorAll('.fan-card').forEach((card, index) => {
  const powerBtn = card.querySelector('.power');
  const slider = card.querySelector('.speed-slider');
  const label = card.querySelector('.speed-label');

  powerBtn.addEventListener('click', async () => {
    const isActive = powerBtn.classList.toggle('active');
    const command = isActive ? 'on' : 'off';
    await fetch('/control', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fan_id: index + 1, command })
    });
  });

  slider.addEventListener('input', async (e) => {
    const speed = e.target.value;
    label.textContent = `Speed: ${speed}`;
    await fetch('/control', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fan_id: index + 1, command: `speed:${speed}` })
    });
  });
});
 
  // theme toggle
  const themeToggle = document.getElementById("themeToggle");
  themeToggle.addEventListener("click", toggleTheme);
  applyStoredTheme();

  // bind train
  document.getElementById("trainModelBtn").addEventListener("click", uploadModelFile);

  // init chart + load
  initChart();
  fetchFans();
  setInterval(refreshLiveData, 5000);
});

// ------------- Theme -------------
function applyStoredTheme(){
  const t = localStorage.getItem("ui-theme") || "light";
  document.body.classList.remove("light","dark");
  document.body.classList.add(t);
}
function toggleTheme(){
  const cur = document.body.classList.contains("dark") ? "dark" : "light";
  const next = cur === "dark" ? "light" : "dark";
  localStorage.setItem("ui-theme", next);
  applyStoredTheme();
}

// ------------- Fan SVG Helper -------------
function fanSVG(){
  return `
  <svg class="fan-svg" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <circle cx="12" cy="12" r="2.2" fill="#0f172a"/>
    <g fill="#111827" opacity="0.95">
      <path d="M12 12c0 0 3.2-.3 4.8-1.8 1.6-1.6 1.8-4.8 1.8-4.8s-3.2.2-4.8 1.8C12.2 9 12 12 12 12z"/>
      <path d="M12 12c0 0-3.2.3-4.8 1.8-1.6 1.6-1.8 4.8-1.8 4.8s3.2-.2 4.8-1.8C11.8 15 12 12 12 12z"/>
      <path d="M12 12c0 0 .3-3.2 1.8-4.8 1.6-1.6 4.8-1.8 4.8-1.8s-.2 3.2-1.8 4.8C15 11.8 12 12 12 12z"/>
    </g>
  </svg>
  `;
}

// ------------- Render Dashboard -------------
async function fetchFans(){
  const grid = document.getElementById("fans-grid");
  grid.innerHTML = `<div class="card settings-card">Loading fans...</div>`;
  try {
    const res = await fetch("http://localhost:4000/api/fans");
    const data = await res.json();
    if(data.ok && data.fans){
      renderDashboard(data.fans);
      renderAlerts(data.fans);
      document.getElementById("connBadge").textContent = "Backend: online";
      document.getElementById("fbBadge").textContent = "Firebase: configured";
    } else {
      grid.innerHTML = `<div class="card settings-card">Failed to load fans</div>`;
      document.getElementById("connBadge").textContent = "Backend: offline";
    }
  } catch(err){
    grid.innerHTML = `<div class="card settings-card">Error: ${err.message}</div>`;
    document.getElementById("connBadge").textContent = "Backend: error";
  }
}

function renderDashboard(fans){
  const fansGrid = document.getElementById("fans-grid");
  fansGrid.innerHTML = "";
  fans.forEach(f => {
    // determine state class
    let stateClass = "fan-running";
    const st = (f.status || "").toLowerCase();
    if(st.includes("warning") || st.includes("needs")) stateClass = "fan-warning";
    if(st.includes("critical") || st.includes("fault")) stateClass = "fan-critical";
    if(st.includes("normal") || st.includes("healthy") || st.includes("✅")) stateClass = "fan-running";

    const col = document.createElement("div");
    col.className = "fan-card " + stateClass;
    col.innerHTML = `
      <div class="fan-visual">${fanSVG()}</div>
      <div class="fan-info">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div>
            <h4 class="fan-title">${f.name}</h4>
            <div class="fan-status">${f.status}</div>
          </div>
          <div class="action-row">
            <button class="btn primary details-btn">View Details</button>
          </div>
        </div>
        <div class="progress-bar"><div class="progress-bar-inner" style="width:${(f.health||0)*100}%"></div></div>
      </div>
    `;
    fansGrid.appendChild(col);

    // details button behaviour (navigate to details and render)
    col.querySelector(".details-btn").addEventListener("click", ()=>{
      document.querySelectorAll(".nav-item").forEach(i=>i.classList.remove("active"));
      document.querySelector('.nav-item[data-page="fan-details"]').classList.add("active");
      document.querySelectorAll(".page").forEach(p=>p.classList.remove("active"));
      document.getElementById("fan-details").classList.add("active");
      renderFanDetails(f);
    });
  });
}

// ------------- Render Alerts -------------
function renderAlerts(fans){
  const alerts = [];
  fans.forEach(f=>{
    if((f.status||"").includes("⚠️") || (f.status||"").includes("❌") || /warning|needs|fault|critical/i.test(f.status||"")){
      alerts.push(`${f.name}: ${f.status}`);
    }
  });
  const list = document.getElementById("alerts-list");
  const listPage = document.getElementById("alertsListPage");
  list.innerHTML = alerts.length ? alerts.map(a=>`<li>${a}</li>`).join("") : "<li>No alerts</li>";
  listPage.innerHTML = list.innerHTML;
}

// ------------- Fan Details page -------------

function renderFanDetails(fan) {
  const container = document.getElementById("fanDetailCards");

  container.innerHTML = `
    <div class="card settings-card">
      <h4>${fan.name}</h4>
      <p class="muted">Status: ${fan.status}</p>
      <div class="progress-bar">
        <div class="progress-bar-inner" style="width:${(fan.health || 0) * 100}%"></div>
      </div>

      <div style="margin-top:10px;">
        <input id="datasetUpload" type="file" accept=".csv" class="form-control mb-2">
        <button id="uploadBtn" class="btn primary">Upload Dataset</button>
        <p id="uploadMessage" class="upload-message"></p>

        <!-- جدول المعاينة -->
        <table id="dataPreview" class="data-table" 
               style="margin-top:10px; width:100%; border-collapse:collapse; border:1px solid #ccc;"></table>

        <button id="trainBtn" class="btn secondary" style="margin-top:8px;">Train Model</button>
        <p id="trainMessage" class="upload-message"></p>

        <div id="topValuesContainer" style="margin-top:15px;"></div>
      </div>
    </div>
  `;

  document.getElementById("uploadBtn").addEventListener("click", async () => {
    const fileInput = document.getElementById("datasetUpload");
    const msg = document.getElementById("uploadMessage");
    const table = document.getElementById("dataPreview");

    if (!fileInput.files[0]) {
      msg.textContent = "Choose CSV first";
      msg.style.color = "red";
      return;
    }

    const file = fileInput.files[0];
    const reader = new FileReader();
    reader.onload = function (e) {
      const text = e.target.result;
      const rows = text.trim().split('\n').slice(0, 10);
      table.innerHTML = rows
        .map(
          (r) =>
            `<tr><td>${r
              .split(',')
              .map((cell) => cell.trim())
              .join('</td><td>')}</td></tr>`
        )
        .join('');
    };
    reader.readAsText(file);

    msg.textContent = "✅ Dataset loaded successfully";
    msg.style.color = "green";
  });

  document.getElementById("trainBtn").addEventListener("click", async () => {
    const fileInput = document.getElementById("datasetUpload");
    const msg = document.getElementById("trainMessage");
    const topValuesDiv = document.getElementById("topValuesContainer");

    if (!fileInput.files[0]) {
      msg.textContent = "Please upload a CSV first";
      msg.style.color = "red";
      return;
    }

    msg.textContent = "Training model...";
    msg.style.color = "black";

    const fd = new FormData();
    fd.append("file", fileInput.files[0]);

    try {
      const r = await fetch("https://dc-fan-backend.onrender.com/train", {
        method: "POST",
        body: fd,
      });
      const j = await r.json();
      msg.textContent = j.ok
        ? `✅ Model trained successfully! Accuracy: ${j.accuracy}`
        : "❌ Error: " + (j.error || j.message);
      msg.style.color = j.ok ? "green" : "red";

      const reader = new FileReader();
      reader.onload = function (e) {
        const text = e.target.result;
        const lines = text.trim().split("\n").slice(1); 
        const data = lines.map(line => {
          const [v, c, f] = line.split(",").map(Number);
          return { vibration: v, current: c, fault: f };
        });

        const topVibration = [...data].sort((a,b)=>b.vibration - a.vibration).slice(0,5);
        const topCurrent = [...data].sort((a,b)=>b.current - a.current).slice(0,5);

        topValuesDiv.innerHTML = `
          <h4>📊 Top 5 Vibration Values</h4>
          <table class="data-table" style="width:100%; border:1px solid #ccc;">
            <tr><th>Vibration</th><th>Current</th><th>Fault</th></tr>
            ${topVibration.map(d=>`<tr><td>${d.vibration}</td><td>${d.current}</td><td>${d.fault}</td></tr>`).join('')}
          </table>

          <h4 style="margin-top:10px;">⚡ Top 5 Current Values</h4>
          <table class="data-table" style="width:100%; border:1px solid #ccc;">
            <tr><th>Vibration</th><th>Current</th><th>Fault</th></tr>
            ${topCurrent.map(d=>`<tr><td>${d.vibration}</td><td>${d.current}</td><td>${d.fault}</td></tr>`).join('')}
          </table>
        `;
      };
      reader.readAsText(fileInput.files[0]);
    } catch (err) {
      msg.textContent = "Error connecting to backend";
      msg.style.color = "red";
    }
  });
}


  document.getElementById("uploadBtn").addEventListener("click", async () => {
    const fileInput = document.getElementById("datasetUpload");
    const msg = document.getElementById("uploadMessage");
    const table = document.getElementById("dataPreview");

    if (!fileInput.files[0]) {
      msg.textContent = "Choose CSV first";
      msg.style.color = "red";
      return;
    }

    const file = fileInput.files[0];
    const reader = new FileReader();
    reader.onload = function (e) {
      const text = e.target.result;
      const rows = text.trim().split('\n').slice(0, 10);
      table.innerHTML = rows
        .map(
          (r) =>
            `<tr><td>${r
              .split(',')
              .map((cell) => cell.trim())
              .join('</td><td>')}</td></tr>`
        )
        .join('');
    };
    reader.readAsText(file);

    msg.textContent = "✅ Dataset loaded: preview below";
    msg.style.color = "green";
  });

  // 🔹 زر تدريب النموذج
  document.getElementById("trainBtn").addEventListener("click", async () => {
    const fileInput = document.getElementById("datasetUpload");
    const msg = document.getElementById("trainMessage");

    if (!fileInput.files[0]) {
      msg.textContent = "Please upload a CSV first";
      msg.style.color = "red";
      return;
    }

    const fd = new FormData();
    fd.append("file", fileInput.files[0]);
    msg.textContent = "Training model...";
    msg.style.color = "black";

    try {
      const r = await fetch("https://dc-fan-backend.onrender.com/train", {
        method: "POST",
        body: fd,
      });
      const j = await r.json();
      msg.textContent = j.ok
        ? `✅ Model trained successfully! Accuracy: ${j.accuracy}`
        : "❌ Error: " + (j.error || j.message);
      msg.style.color = j.ok ? "green" : "red";
    } catch (err) {
      msg.textContent = "Error connecting to backend";
      msg.style.color = "red";
    }
  });



  // --- Upload Dataset ---
  document.getElementById("uploadBtn").addEventListener("click", async () => {
    const fileInput = document.getElementById("datasetUpload");
    const msg = document.getElementById("uploadMessage");

    if (!fileInput.files[0]) {
      msg.textContent = "Choose CSV first";
      msg.style.color = "red";
      return;
    }

    const fd = new FormData();
    fd.append("file", fileInput.files[0]);

    msg.textContent = "Uploading...";
    msg.style.color = "black";

    try {
      const r = await fetch("https://dc-fan-backend.onrender.com/upload", {
        method: "POST",
        body: fd,
      });
      const j = await r.json();
      msg.textContent = j.ok
        ? "✅ File uploaded successfully"
        : "❌ Error: " + (j.error || j.message);
      msg.style.color = j.ok ? "green" : "red";
    } catch (err) {
      msg.textContent = err.message;
      msg.style.color = "red";
    }
  });

  // --- Train Model ---
  document.getElementById("trainBtn").addEventListener("click", async () => {
    const msg = document.getElementById("trainMessage");
    msg.textContent = "Training...";
    msg.style.color = "black";

    try {
      const r = await fetch("https://dc-fan-backend.onrender.com/train", {
        method: "POST",
      });
      const j = await r.json();
      msg.textContent = j.ok
        ? `✅ Model trained successfully (Accuracy = ${j.accuracy})`
        : "❌ Error: " + (j.error || j.message);
      msg.style.color = j.ok ? "green" : "red";
    } catch (err) {
      msg.textContent = err.message;
      msg.style.color = "red";
    }
  });

const res = await fetch("https://dc-fan-backend.onrender.com/predict", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    Vibration: vibrationValue,
    Current: currentValue,
    Speed: speedValue
  })
});



// ------------- Chart -------------
let sensorChart;
function initChart() {
  const ctx = document.getElementById("sensorChart").getContext("2d");
  sensorChart = new Chart(ctx, {
    type: "line",
    data: {
      labels: [],
      datasets: [
        { 
          label: "Vibration", 
          data: [], 
          borderColor: "#4f46e5", 
          backgroundColor: "#4f46e5",
          fill: false, 
          tension: 0.4,
          pointRadius: 5,
          pointHoverRadius: 7
        },
        { 
          label: "Current", 
          data: [], 
          borderColor: "#22c55e", 
          backgroundColor: "#22c55e",
          fill: false, 
          tension: 0.4,
          pointRadius: 5,
          pointHoverRadius: 7
        },
        { 
          label: "Temperature", 
          data: [], 
          borderColor: "#ef4444", 
          backgroundColor: "#ef4444",
          fill: false, 
          tension: 0.4,
          pointRadius: 5,
          pointHoverRadius: 7
        }
      ]
    },
    options: {
      responsive: true,
      animation: false,
      scales: { 
        y: { beginAtZero: true } 
      },
      plugins: {
        legend: {
          labels: {
            color: "#111827",
            font: { size: 13, weight: 'bold' },
            usePointStyle: true,
            pointStyle: 'circle',
            padding: 20 
          },
          onHover: (event) => {
            event.native.target.style.cursor = 'pointer'; 
          }
        }
      },
      interaction: {
        intersect: false 
      }
    }
  });
}



async function refreshLiveData() {
  const dashboard = document.getElementById("dashboard");
  const statusDiv = document.getElementById("backend-status");

  try {
    const res = await fetch("http://localhost:4000/api/fans");
    const data = await res.json();

    if (data.ok) {
      const alerts = [];
      data.fans.forEach(f => {
        if (f.status.includes("⚠️") || f.status.includes("❌")) {
          alerts.push(`${f.name}: ${f.status}`);
        }
      });

      loadFans();
      loadAlerts(alerts);

      const vib = Math.random() * 10 + 10;
      const curr = Math.random() * 3 + 1;
      const temp = Math.random() * 10 + 30;
      updateChart(vib, curr, temp);

      if (statusDiv) statusDiv.textContent = "✅ Connected to Backend";
    } else {
      if (statusDiv) statusDiv.textContent = "⏳ Waiting for live data…";
    }
  } catch (err) {
    if (statusDiv) statusDiv.textContent = "⏳ Waiting for live data…";
    console.warn("Live update error:", err);
  }
}

function updateChart(v,c,t){
  const now = new Date().toLocaleTimeString();
  sensorChart.data.labels.push(now);
  sensorChart.data.datasets[0].data.push(v);
  sensorChart.data.datasets[1].data.push(c);
  sensorChart.data.datasets[2].data.push(t);
  if(sensorChart.data.labels.length > 30){
    sensorChart.data.labels.shift();
    sensorChart.data.datasets.forEach(ds=>ds.data.shift());
  }
  sensorChart.update();
}


// Fan UI elements
const fans = [
  { id: 1, element: document.getElementById('fan1') },
  { id: 2, element: document.getElementById('fan2') },
  // add more fans if needed
];

// SerialPort setup
const SerialPort = require('serialport');
const Readline = require('@serialport/parser-readline');
const port = new SerialPort('COM3', { baudRate: 9600 });
const parser = port.pipe(new Readline({ delimiter: '\n' }));

// Parse incoming data from Arduino
parser.on('data', (line) => {
  try {
    // Expected format: "id,vibration,current,speed"
    const [id, vibration, current, speed] = line.trim().split(',').map(Number);
    const fan = fans.find(f => f.id === id);
    if (!fan) return;

    // Determine fan state
    let state = 'fan-running';
    if (vibration > 0.35) state = 'fan-critical';
    else if (vibration > 0.25) state = 'fan-warning';

    // Update UI
    const card = fan.element;
    card.className = `fan-card ${state}`;
    card.querySelector('.fan-status').textContent = 
      state === 'fan-running' ? 'Running • Normal' :
      state === 'fan-warning' ? 'Warning • High Vib' :
      'Critical • Overheat';

    // Update stats
    card.querySelector('.muted').textContent = 
      `Vib: ${vibration.toFixed(2)}g | Curr: ${current.toFixed(2)}A | Speed: ${speed} RPM`;

    // Adjust fan rotation speed dynamically
    const svg = card.querySelector('.fan-svg');
    const rotationSpeed = Math.max(0.2, 2 - speed / 500); // example mapping
    svg.style.animationDuration = `${rotationSpeed}s`;

    // Update progress bar color and width (optional: map speed to width)
    const progress = card.querySelector('.progress-bar-inner');
    progress.style.width = `${Math.min(speed / 2, 100)}%`;
    progress.className = `progress-bar-inner ${state.replace('fan-', '')}`;

  } catch (err) {
    console.error("Error parsing fan data:", err);
  }
});



// ------------- Upload / Train model -------------
async function uploadModelFile(){
  const fileInput = document.getElementById("modelDatasetUpload");
  const msg = document.getElementById("modelMessage");
  if(!fileInput.files[0]){ msg.textContent = "Choose CSV"; msg.style.color="red"; return; }
  const fd = new FormData(); fd.append("file", fileInput.files[0]);
  msg.textContent = "Uploading & training..."; msg.style.color="black";
  try {
    const r = await fetch("http://localhost:4000/api/upload/GLOBAL", { method:"POST", body: fd });
    const j = await r.json();
    msg.textContent = j.ok ? "✅ Global model trained" : ("❌ "+(j.error||j.message));
    msg.style.color = j.ok ? "green" : "red";
    if(j.ok) fetchFans();
  } catch(err){ msg.textContent = err.message; msg.style.color="red" }
}

// ------------- Live polling -------------
async function refreshLiveData(){
  try {
    const res = await fetch("http://localhost:4000/api/fans");
    const data = await res.json();
    if(data.ok && data.fans){
      renderDashboard(data.fans);
      renderAlerts(data.fans);

      // add simulated sensor points to chart (until ESP connected)
      const vib = Math.random()*6 + 2;
      const curr = Math.random()*2 + 0.5;
      updateChart(vib, curr);
    }
  } catch(err){
    console.error("refresh error", err);
  } 
} 



// ----------------------------
// Arrays to store previous values for Highest Values table
let allVibrationsArray = [];
let allCurrentsArray = [];

// 🔮 Handle Predict Button
const predictBtn = document.getElementById("predictBtn");
const predictMsg = document.getElementById("predictMsg");

predictBtn.addEventListener("click", async () => {
  // Get input values from user
  const vib = parseFloat(document.getElementById("vibrationInput").value);
  const curr = parseFloat(document.getElementById("currentInput").value);
  let spd = parseFloat(document.getElementById("speedInput").value);

  // Validate Vibration and Current (these are required)
  if (isNaN(vib) || isNaN(curr)) {
    predictMsg.textContent = "⚠️ Please enter valid numeric values for Vibration and Current.";
    predictMsg.style.color = "red";
    return;
  }

  // If Speed is missing or zero, set default value
  if (isNaN(spd) || spd === 0) spd = 1200; // Default Speed

  // Prepare input object with exact field names expected by the model
  const inputData = {
    Vibration: vib,
    Current: curr,
    Speed: spd
  };

  try {
    // Call the prediction function (replace with your actual model call)
    const result = await predictFanFault(inputData);

    // Display the prediction result
    predictMsg.textContent = `🔮 Predicted Fault: ${result}`;
    predictMsg.style.color = "green";

    // Update chart if exists
    if (typeof updateChart === "function") updateChart(vib, curr);

    // Update Highest Values arrays
    allVibrationsArray.push(vib);
    allCurrentsArray.push(curr);

    // Update Highest Values display
    document.getElementById("maxVib").textContent = Math.max(...allVibrationsArray);
    document.getElementById("maxCurr").textContent = Math.max(...allCurrentsArray);
  } catch (err) {
    // Handle any model errors
    predictMsg.textContent = "❌ Error: Could not get prediction.";
    predictMsg.style.color = "red";
    console.error("Prediction error:", err);
  }
});

