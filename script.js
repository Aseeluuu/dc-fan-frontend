// =============== GLOBAL STATE ===============
let sensorChart = null;
let allVibrationsArray = [];
let allCurrentsArray = [];
let modelData = []; // Holds parsed dataset from CSV (Model Settings section)




// Backend URL (Render)
const BACKEND_URL = "https://dc-fan-backend.onrender.com";


// =============== STARTUP ===============
document.addEventListener("DOMContentLoaded", () => {
  setupNavigation();
  setupTheme();
  setupLiveControls();
  setupGlobalModelSection();
  setupPredictSection();
  setupUSBSection();

  initChart();
  fetchFans();
  setInterval(refreshLiveData, 5000);
});

// =============== NAVIGATION ===============
function setupNavigation() {
  const pages = document.querySelectorAll(".page");
  const navItems = document.querySelectorAll(".nav-item");

  if (!pages.length || !navItems.length) return;

  navItems.forEach((it) => {
    it.addEventListener("click", () => {
      navItems.forEach((i) => i.classList.remove("active"));
      it.classList.add("active");

      pages.forEach((p) => p.classList.remove("active"));
      const targetId = it.dataset.page;
      const targetPage = document.getElementById(targetId);
      if (targetPage) targetPage.classList.add("active");
    });
  });
}

// =============== THEME ===============
function applyStoredTheme() {
  const t = localStorage.getItem("ui-theme") || "light";
  document.body.classList.remove("light", "dark");
  document.body.classList.add(t);
}

function toggleTheme() {
  const isDark = document.body.classList.contains("dark");
  const next = isDark ? "light" : "dark";
  localStorage.setItem("ui-theme", next);
  applyStoredTheme();
}

function setupTheme() {
  const themeToggle = document.getElementById("themeToggle");
  if (themeToggle) {
    themeToggle.addEventListener("click", toggleTheme);
  }
  applyStoredTheme();
}

// =============== LIVE CONTROL BUTTON (TOP RIGHT) ===============
function setupLiveControls() {
  const liveBtn = document.getElementById("liveControlBtn");
  if (!liveBtn) return;

  let liveModeEnabled = false;

  liveBtn.addEventListener("click", () => {
    liveModeEnabled = !liveModeEnabled;

    if (liveModeEnabled) {
      liveBtn.classList.add("active");
      liveBtn.textContent = "🟢 Live Mode (ON ⚡)";
      startLiveStreaming();
    } else {
      liveBtn.classList.remove("active");
      liveBtn.textContent = "🔴 Live Mode";
      stopLiveStreaming();
    }
  });
}

// Dummy hooks for real streaming integration (ESP32 / backend)
function startLiveStreaming() {
  console.log("✅ Live mode started");
}

function stopLiveStreaming() {
  console.log("⛔ Live mode stopped");
}

// =============== FAN SVG HELPER ===============
function fanSVG() {
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

// =============== DASHBOARD / FANS ===============
async function fetchFans() {
  const grid = document.getElementById("fans-grid");
  if (grid) {
    grid.innerHTML = `<div class="card settings-card">Loading fans...</div>`;
  }

  try {
    const res = await fetch(`${BACKEND_URL}/api/fans`);
    const data = await res.json();

    if (data.ok && Array.isArray(data.fans)) {
      renderDashboard(data.fans);
      renderAlerts(data.fans);
      const connBadge = document.getElementById("connBadge");
      if (connBadge) connBadge.textContent = "Backend: online";
      const fbBadge = document.getElementById("fbBadge");
      if (fbBadge) fbBadge.textContent = "Firebase: configured";
    } else {
      if (grid) {
        grid.innerHTML = `<div class="card settings-card">Failed to load fans</div>`;
      }
      const connBadge = document.getElementById("connBadge");
      if (connBadge) connBadge.textContent = "Backend: offline";
    }
  } catch (err) {
    if (grid) {
      grid.innerHTML = `<div class="card settings-card">Error: ${err.message}</div>`;
    }
    const connBadge = document.getElementById("connBadge");
    if (connBadge) connBadge.textContent = "Backend: error";
  }
}

function renderDashboard(fans) {
  const fansGrid = document.getElementById("fans-grid");
  if (!fansGrid) return;

  fansGrid.innerHTML = "";

  fans.forEach((f) => {
    let stateClass = "fan-running";
    const st = (f.status || "").toLowerCase();

    if (st.includes("warning") || st.includes("needs")) stateClass = "fan-warning";
    if (st.includes("critical") || st.includes("fault")) stateClass = "fan-critical";
    if (st.includes("normal") || st.includes("healthy") || st.includes("✅"))
      stateClass = "fan-running";

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
        <div class="progress-bar">
          <div class="progress-bar-inner" style="width:${(f.health || 0) * 100}%"></div>
        </div>
      </div>
    `;
    fansGrid.appendChild(col);

    const detailsBtn = col.querySelector(".details-btn");
    if (detailsBtn) {
      detailsBtn.addEventListener("click", () => {
        document.querySelectorAll(".nav-item").forEach((i) => i.classList.remove("active"));
        const fanDetailsNav = document.querySelector('.nav-item[data-page="fan-details"]');
        if (fanDetailsNav) fanDetailsNav.classList.add("active");

        document.querySelectorAll(".page").forEach((p) => p.classList.remove("active"));
        const fanDetailsPage = document.getElementById("fan-details");
        if (fanDetailsPage) fanDetailsPage.classList.add("active");

        renderFanDetails(f);
      });
    }
  });
}

// =============== ALERTS ===============
function renderAlerts(fans) {
  const alerts = [];
  fans.forEach((f) => {
    const st = f.status || "";
    if (st.includes("⚠️") || st.includes("❌") || /warning|needs|fault|critical/i.test(st)) {
      alerts.push(`${f.name}: ${f.status}`);
    }
  });

  const list = document.getElementById("alerts-list");
  const listPage = document.getElementById("alertsListPage");

  const html = alerts.length
    ? alerts.map((a) => `<li>${a}</li>`).join("")
    : "<li>No alerts</li>";

  if (list) list.innerHTML = html;
  if (listPage) listPage.innerHTML = html;
}

// =============== FAN DETAILS PAGE (PER-FAN DATASET) ===============
function renderFanDetails(fan) {
  const container = document.getElementById("fanDetailCards");
  if (!container) return;

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

        <table id="dataPreviewFan" class="data-table"
               style="margin-top:10px; width:100%; border-collapse:collapse; border:1px solid #ccc;"></table>

        <button id="trainBtn" class="btn secondary" style="margin-top:8px;">Train Model</button>
        <p id="trainMessage" class="upload-message"></p>

        <div id="topValuesContainer" style="margin-top:15px;"></div>
      </div>
    </div>
  `;

  const uploadBtn = document.getElementById("uploadBtn");
  const trainBtn = document.getElementById("trainBtn");

  if (uploadBtn) uploadBtn.addEventListener("click", handleFanDetailsUpload);
  if (trainBtn) trainBtn.addEventListener("click", handleFanDetailsTrain);
}

function handleFanDetailsUpload() {
  const fileInput = document.getElementById("datasetUpload");
  const msg = document.getElementById("uploadMessage");
  const table = document.getElementById("dataPreviewFan");

  if (!fileInput || !msg || !table) return;

  if (!fileInput.files[0]) {
    msg.textContent = "Choose CSV first";
    msg.style.color = "red";
    return;
  }

  const file = fileInput.files[0];
  const reader = new FileReader();

  reader.onload = function (e) {
    const text = e.target.result;
    const rows = text.trim().split("\n").slice(0, 10);
    table.innerHTML = rows
      .map(
        (r) =>
          `<tr><td>${r
            .split(",")
            .map((cell) => cell.trim())
            .join("</td><td>")}</td></tr>`
      )
      .join("");
  };

  reader.readAsText(file);

  msg.textContent = "✅ Dataset loaded successfully";
  msg.style.color = "green";
}

async function handleFanDetailsTrain() {
  const fileInput = document.getElementById("datasetUpload");
  const msg = document.getElementById("trainMessage");
  const topValuesDiv = document.getElementById("topValuesContainer");

  if (!fileInput || !msg || !topValuesDiv) return;

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
      const data = lines.map((line) => {
        const [v, c, f] = line.split(",").map(Number);
        return { vibration: v, current: c, fault: f };
      });

      const topVibration = [...data]
        .sort((a, b) => b.vibration - a.vibration)
        .slice(0, 5);
      const topCurrent = [...data]
        .sort((a, b) => b.current - a.current)
        .slice(0, 5);

      topValuesDiv.innerHTML = `
        <h4>📊 Top 5 Vibration Values</h4>
        <table class="data-table" style="width:100%; border:1px solid #ccc;">
          <tr><th>Vibration</th><th>Current</th><th>Fault</th></tr>
          ${topVibration
            .map(
              (d) =>
                `<tr><td>${d.vibration}</td><td>${d.current}</td><td>${d.fault}</td></tr>`
            )
            .join("")}
        </table>

        <h4 style="margin-top:10px;">⚡ Top 5 Current Values</h4>
        <table class="data-table" style="width:100%; border:1px solid #ccc;">
          <tr><th>Vibration</th><th>Current</th><th>Fault</th></tr>
          ${topCurrent
            .map(
              (d) =>
                `<tr><td>${d.vibration}</td><td>${d.current}</td><td>${d.fault}</td></tr>`
            )
            .join("")}
        </table>
      `;
    };

    reader.readAsText(fileInput.files[0]);
  } catch (err) {
    msg.textContent = "Error connecting to backend";
    msg.style.color = "red";
  }
}

// =============== GLOBAL MODEL SECTION (MODEL SETTINGS PAGE) ===============
function setupGlobalModelSection() {
  const datasetInput = document.getElementById("modelDatasetUpload");
  const trainBtn = document.getElementById("trainModelBtn");
  const modelMsg = document.getElementById("modelMessage");
  const dataPreviewTable = document.getElementById("dataPreview");
  const highestRecordContainer = document.getElementById("highestRecordContainer");

  if (!datasetInput || !modelMsg || !dataPreviewTable) return;

  datasetInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();

    reader.onload = function (evt) {
      const text = evt.target.result;
      const lines = text.trim().split("\n");

      const chunkSize = 300; // rows per chunk
      let index = 1; // skip header row
      modelData = [];

      function processChunk() {
        const end = Math.min(index + chunkSize, lines.length);

        for (let i = index; i < end; i++) {
          const row = lines[i].split(",");
          if (row.length >= 3) {
            const obj = {
              Vibration: parseFloat(row[0]),
              Current: parseFloat(row[1]),
              Fault: row[2],
            };
            modelData.push(obj);

            if (typeof window.saveDataToFirebase === "function") {
              window.saveDataToFirebase(obj, "readings");
            }
          }
        }

        index = end;

        if (index < lines.length) {
          setTimeout(processChunk, 5);
        } else {
          modelMsg.textContent = `✅ Dataset loaded: ${modelData.length} records`;
          modelMsg.style.color = "green";

          const previewRows = lines.slice(0, 11); // header + 10 rows
          dataPreviewTable.innerHTML = `
            <thead style="background:#0a3d62;color:white;">
              <tr>${previewRows[0]
                .split(",")
                .map(
                  (h) =>
                    `<th style='padding:8px;text-align:left;border-bottom:2px solid #eee;'>${h}</th>`
                )
                .join("")}</tr>
            </thead>
            <tbody>
              ${previewRows
                .slice(1)
                .map(
                  (r) => `
                <tr style="background:#fff;transition:0.2s;">
                  ${r
                    .split(",")
                    .map(
                      (v) =>
                        `<td style='padding:8px;border-bottom:1px solid #eee;'>${v}</td>`
                    )
                    .join("")}
                </tr>`
                )
                .join("")}
            </tbody>
          `;

          highestRecordContainer.innerHTML = "";
        }
      }

      processChunk();
    };

    reader.readAsText(file);
  });

  if (trainBtn) {
    trainBtn.addEventListener("click", async () => {
      if (!datasetInput.files.length) {
        modelMsg.textContent = "⚠️ Please upload a CSV file first!";
        modelMsg.style.color = "red";
        return;
      }

      const fd = new FormData();
      fd.append("file", datasetInput.files[0]);

      modelMsg.textContent = "Training model...";
      modelMsg.style.color = "black";

      try {
        const r = await fetch("https://dc-fan-backend.onrender.com/train", {
          method: "POST",
          body: fd,
        });
        const j = await r.json();
        if (j.ok) {
          modelMsg.textContent = "✅ Model trained successfully!";
          modelMsg.style.color = "green";
        } else {
          modelMsg.textContent = "❌ Error: " + (j.error || j.message);
          modelMsg.style.color = "red";
        }
      } catch (err) {
        modelMsg.textContent = "❌ Connection error: " + err.message;
        modelMsg.style.color = "red";
      }
    });
  }
}

// =============== PREDICT SECTION ===============
function setupPredictSection() {
  const vibrationInput = document.getElementById("vibrationInput");
  const currentInput = document.getElementById("currentInput");
  const speedInput = document.getElementById("speedInput");
  const predictBtn = document.getElementById("predictBtn");
  const predictMsg = document.getElementById("predictMsg");

  if (!vibrationInput || !currentInput || !speedInput || !predictBtn || !predictMsg) return;

  predictBtn.addEventListener("click", async () => {
    const vib = parseFloat(vibrationInput.value);
    const curr = parseFloat(currentInput.value);
    let spd = parseFloat(speedInput.value);

    if (isNaN(vib) || isNaN(curr)) {
      predictMsg.textContent =
        "⚠️ Please enter valid numeric values for Vibration and Current.";
      predictMsg.style.color = "red";
      return;
    }

    if (isNaN(spd) || spd === 0) {
      spd = 1200; // default speed
    }

    const payload = {
      Vibration: vib,
      Current: curr,
      Speed: spd,
    };

    try {
      const res = await fetch("https://dc-fan-backend.onrender.com/predict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await res.json();

      if (result.ok) {
        predictMsg.textContent = `🔮 Predicted Fault: ${result.prediction}`;
        predictMsg.style.color = "green";
      } else {
        predictMsg.textContent = "❌ Error: " + (result.error || "Prediction failed");
        predictMsg.style.color = "red";
      }

      if (typeof updateChart === "function") {
        updateChart(vib, curr);
      }

      allVibrationsArray.push(vib);
      allCurrentsArray.push(curr);

      const maxVibEl = document.getElementById("maxVib");
      const maxCurrEl = document.getElementById("maxCurr");
      if (maxVibEl) maxVibEl.textContent = Math.max(...allVibrationsArray).toFixed(3);
      if (maxCurrEl) maxCurrEl.textContent = Math.max(...allCurrentsArray).toFixed(3);
    } catch (err) {
      predictMsg.textContent = "❌ Error: Could not connect to backend.";
      predictMsg.style.color = "red";
      console.error("Prediction error:", err);
    }
  });
}

// =============== USB / OFFLINE CSV LIVE UPDATE ===============
function setupUSBSection() {
  // Buttons use onclick in HTML: uploadUSBData() and stopUSBMode()
}

// Read CSV file and simulate real-time stream
async function uploadUSBData() {
  const fileInput = document.getElementById("usbFileInput");
  const status = document.getElementById("usbStatus");

  if (!fileInput || !status) return;

  if (!fileInput.files[0]) {
    status.textContent = "Please select a CSV file";
    status.style.color = "red";
    return;
  }

  status.textContent = "Reading USB data...";
  status.style.color = "black";

  const file = fileInput.files[0];
  const reader = new FileReader();

  reader.onload = function (e) {
    const lines = e.target.result.split("\n").map((l) => l.trim());

    let index = 1; // skip header
    status.textContent = "Streaming USB data...";

    const interval = setInterval(() => {
      if (index >= lines.length) {
        clearInterval(interval);
        status.textContent = "✅ USB Data Stream Finished";
        status.style.color = "green";
        return;
      }

      const row = lines[index].split(",");
      const v = parseFloat(row[0]);
      const c = parseFloat(row[1]);
      const t = parseFloat(row[2]);
      index++;

      updateChart(v, c, t);
    }, 800);
  };

  reader.readAsText(file);
}

function stopUSBMode() {
  const status = document.getElementById("usbStatus");
  if (status) {
    status.textContent = "⛔ USB streaming stopped by user";
    status.style.color = "orange";
  }
}

// =============== CHART ===============
function initChart() {
  const canvas = document.getElementById("sensorChart");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
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
          pointHoverRadius: 7,
        },
        {
          label: "Current",
          data: [],
          borderColor: "#22c55e",
          backgroundColor: "#22c55e",
          fill: false,
          tension: 0.4,
          pointRadius: 5,
          pointHoverRadius: 7,
        },
        {
          label: "Temperature",
          data: [],
          borderColor: "#ef4444",
          backgroundColor: "#ef4444",
          fill: false,
          tension: 0.4,
          pointRadius: 5,
          pointHoverRadius: 7,
        },
      ],
    },
    options: {
      responsive: true,
      animation: false,
      scales: {
        y: { beginAtZero: true },
      },
      plugins: {
        legend: {
          labels: {
            color: "#111827",
            font: { size: 13, weight: "bold" },
            usePointStyle: true,
            pointStyle: "circle",
            padding: 20,
          },
          onHover: (event) => {
            event.native.target.style.cursor = "pointer";
          },
        },
      },
      interaction: {
        intersect: false,
      },
    },
  });
}

function updateChart(v, c, t) {
  if (!sensorChart) return;

  const now = new Date().toLocaleTimeString();
  sensorChart.data.labels.push(now);
  sensorChart.data.datasets[0].data.push(v);
  sensorChart.data.datasets[1].data.push(c);

  if (typeof t === "number") {
    sensorChart.data.datasets[2].data.push(t);
  } else {
    sensorChart.data.datasets[2].data.push(null);
  }

  if (sensorChart.data.labels.length > 30) {
    sensorChart.data.labels.shift();
    sensorChart.data.datasets.forEach((ds) => ds.data.shift());
  }

  sensorChart.update();
}

// =============== LIVE POLLING ===============
async function refreshLiveData() {
  const statusDiv = document.getElementById("backend-status");

  try {
    const res = await fetch(`${BACKEND_URL}/api/fans`);
    const data = await res.json();

    if (data.ok && Array.isArray(data.fans)) {
      renderDashboard(data.fans);
      renderAlerts(data.fans);

      const vib = Math.random() * 6 + 2;
      const curr = Math.random() * 2 + 0.5;
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

// =============== FIREBASE INIT (OPTIONAL) ===============
(function initFirebase() {
  const saveToFirebase = true; // set to false if you want to disable saving

  const badge = document.getElementById("fbBadge");
  if (!saveToFirebase) {
    if (badge) badge.textContent = "Firebase: disabled";
    return;
  }

  const firebaseConfig = {
    apiKey: "AIzaSyDudD9EvuN2DR-fBrxz9SubzHctwjmHFBQ",
    authDomain: "dc-fan-monitor.firebaseapp.com",
    databaseURL: "https://dc-fan-monitor-default-rtdb.firebaseio.com",
    projectId: "dc-fan-monitor",
    storageBucket: "dc-fan-monitor.firebasestorage.app",
    messagingSenderId: "398046641555",
    appId: "1:398046641555:web:9d79a62b9616fb4eb53c66",
    measurementId: "G-419NQ59BDJ"
  };

  try {
    firebase.initializeApp(firebaseConfig);
    const db = firebase.database();
    if (badge) badge.textContent = "Firebase: ✅ Connected";

    // Global helper to save data to Firebase
    window.saveDataToFirebase = function (data, source = "sensor") {
      try {
        const path = source + "/" + Date.now();
        db.ref(path).set({
          timestamp: new Date().toISOString(),
          data: data
        });
        console.log("✅ Data saved to Firebase (" + source + "):", data);
        if (badge) badge.textContent = "Firebase: ✅ Data saved";
      } catch (err) {
        console.error("❌ Error saving data to Firebase:", err);
        if (badge) badge.textContent = "Firebase: ⚠️ Save error";
      }
    };
  } catch (err) {
    console.error("Firebase init error:", err);
    if (badge) badge.textContent = "Firebase: ❌ Error";
  }
})();
