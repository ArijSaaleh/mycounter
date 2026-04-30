const ahtTargetInput = document.getElementById("ahtTargetInput");
const goalInput = document.getElementById("goalInput");
const hoursInput = document.getElementById("hoursInput");
const hoursPanel = document.getElementById("hoursPanel");
const startButton = document.getElementById("startButton");
const resetButton = document.getElementById("resetButton");
const logButton = document.getElementById("logButton");
const shiftState = document.getElementById("shiftState");
const itemsThisHour = document.getElementById("itemsThisHour");
const currentAht = document.getElementById("currentAht");
const shiftTotal = document.getElementById("shiftTotal");
const hourTargetLabel = document.getElementById("hourTargetLabel");
const ahtStatus = document.getElementById("ahtStatus");
const shiftProgress = document.getElementById("shiftProgress");
const paceLabel = document.getElementById("paceLabel");
const goalBadge = document.getElementById("goalBadge");
const hourProgressFill = document.getElementById("hourProgressFill");
const statusText = document.getElementById("statusText");
const hoursGrid = document.getElementById("hoursGrid");
const hoursSummary = document.getElementById("hoursSummary");

const state = {
  started: false,
  shiftStartTs: 0,
  currentHourIndex: 0,
  handledTotal: 0,
  ahtTargetSeconds: 75,
  goal: 35,
  numHours: 0,
  hours: [],
  isSingleMode: true,
};

// Utilities
function parsePositiveInteger(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }
  return parsed;
}

function formatDuration(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${String(minutes).padStart(2, "0")}m`;
  }

  return `${String(minutes).padStart(2, "0")}m ${String(seconds).padStart(2, "0")}s`;
}

function formatSeconds(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return "0s";
  }

  if (seconds < 1) {
    return "<1s";
  }

  if (seconds < 10) {
    return `${seconds.toFixed(1)}s`;
  }

  if (seconds < 60) {
    return `${Math.round(seconds)}s`;
  }

  const rounded = Math.round(seconds);
  const minutes = Math.floor(rounded / 60);
  const remainingSeconds = rounded % 60;
  return `${minutes}m ${String(remainingSeconds).padStart(2, "0")}s`;
}

function setMessage(text, type = "neutral") {
  statusText.textContent = text;
  statusText.classList.toggle("success", type === "success");
  statusText.classList.toggle("warning", type === "warning");
}

// Setup and initialization
function setupMode() {
  const hrs = Number.parseInt(hoursInput.value, 10) || 0;
  state.numHours = hrs;
  state.isSingleMode = hrs === 0;
  state.goal = Number.parseInt(goalInput.value, 10) || 35;
  state.ahtTargetSeconds = Number.parseInt(ahtTargetInput.value, 10) || 75;

  if (state.isSingleMode) {
    state.hours = [];
    hoursPanel.style.display = "none";
  } else {
    state.hours = Array.from({ length: hrs }, () => ({ target: state.goal, count: 0 }));
    hoursPanel.style.display = "block";
    renderHours();
  }
}

// Rendering
function renderHours() {
  hoursGrid.innerHTML = "";
  state.hours.forEach((hour, index) => {
    const card = document.createElement("article");
    card.className = "hour-card";
    card.dataset.hourIndex = String(index);
    card.innerHTML = `
      <div class="hour-card__head">
        <span>Hour ${index + 1}</span>
      </div>
      <div class="hour-card__metrics">
        <div>
          <span>Count</span>
          <strong>${hour.count}</strong>
        </div>
        <div>
          <span>Target</span>
          <strong>${hour.target}</strong>
        </div>
      </div>
      <div class="hour-track" aria-hidden="true">
        <div class="hour-track__fill" style="width: ${Math.round(Math.min(1, hour.count / Math.max(1, hour.target)) * 100)}%"></div>
      </div>
    `;
    hoursGrid.appendChild(card);
  });
  hoursSummary.textContent = `${state.hours.length} hours`;
}

function syncHourCards() {
  const cards = hoursGrid.querySelectorAll(".hour-card");
  cards.forEach((card, index) => {
    const hour = state.hours[index];
    if (hour) {
      const progress = Math.round(Math.min(1, hour.count / Math.max(1, hour.target)) * 100);
      const fill = card.querySelector(".hour-track__fill");
      if (fill) fill.style.width = `${progress}%`;
      const metricsDiv = card.querySelector(".hour-card__metrics");
      if (metricsDiv) {
        const strongEls = metricsDiv.querySelectorAll("strong");
        if (strongEls[0]) strongEls[0].textContent = String(hour.count);
      }
    }
  });
}

// Shift management
function startShift() {
  if (!state.started) {
    setupMode();
    state.started = true;
    state.shiftStartTs = Date.now();
    state.currentHourIndex = 0;
    logButton.disabled = false;
    resetButton.disabled = false;
    startButton.textContent = "Restart shift";
    setMessage("Shift started. Press Enter to log items.");
  } else {
    state.started = false;
    state.handledTotal = 0;
    if (!state.isSingleMode) {
      state.hours.forEach(h => { h.count = 0; });
      renderHours();
    }
    startButton.textContent = "Start shift";
    setMessage("Shift reset.");
  }
  updateUi();
}

function logItem() {
  if (!state.started) {
    startShift();
    return;
  }

  state.handledTotal += 1;
  
  if (!state.isSingleMode) {
    const hour = state.hours[state.currentHourIndex];
    if (hour) {
      hour.count += 1;
    }
  }

  const remaining = Math.max(0, state.goal - state.handledTotal);
  setMessage(remaining > 0 ? `${remaining} left to reach ${state.goal}.` : `Target hit! 🎉`, "success");
  updateUi();
}

// UI updates
function updateUi() {
  const now = Date.now();
  const shiftElapsed = state.started ? now - state.shiftStartTs : 0;
  const ahtSeconds = state.handledTotal > 0 ? shiftElapsed / 1000 / state.handledTotal : 0;
  const remaining = Math.max(0, state.goal - state.handledTotal);

  itemsThisHour.textContent = String(state.handledTotal);
  currentAht.textContent = formatSeconds(ahtSeconds);
  shiftTotal.textContent = String(state.handledTotal);
  hourTargetLabel.textContent = `Goal: ${state.goal}`;
  ahtStatus.textContent = `Target AHT: ${state.ahtTargetSeconds}s | Current: ${formatSeconds(ahtSeconds)}`;
  shiftProgress.textContent = state.started ? formatDuration(shiftElapsed) + " elapsed" : "Not started";
  paceLabel.textContent = state.started ? `${remaining} left to hit ${state.goal}` : "Set up and start to begin";

  shiftState.textContent = state.started
    ? state.handledTotal >= state.goal ? "Goal reached! 🎉" : `${state.handledTotal} / ${state.goal}`
    : "Ready";

  const progressPercent = Math.round(Math.min(1, state.handledTotal / Math.max(1, state.goal)) * 100);
  hourProgressFill.style.width = `${progressPercent}%`;
  goalBadge.textContent = `${state.handledTotal} / ${state.goal}`;

  if (!state.isSingleMode) {
    syncHourCards();
  }
}

function handleKeydown(event) {
  if (event.key !== "Enter") {
    return;
  }

  const activeTag = document.activeElement?.tagName;
  if (activeTag === "INPUT" || activeTag === "TEXTAREA") {
    return;
  }

  event.preventDefault();
  logItem();
}

// Event listeners
startButton.addEventListener("click", startShift);
resetButton.addEventListener("click", () => {
  state.started = false;
  state.handledTotal = 0;
  if (!state.isSingleMode) {
    state.hours.forEach(h => { h.count = 0; });
    renderHours();
  }
  updateUi();
});
logButton.addEventListener("click", logItem);

hoursInput.addEventListener("input", setupMode);
goalInput.addEventListener("input", setupMode);
ahtTargetInput.addEventListener("input", () => {
  state.ahtTargetSeconds = parsePositiveInteger(ahtTargetInput.value, state.ahtTargetSeconds);
  ahtTargetInput.value = String(state.ahtTargetSeconds);
  updateUi();
});

hoursGrid.addEventListener("click", (event) => {
  const card = event.target.closest(".hour-card");
  if (!card) return;
  const hourIndex = Number(card.dataset.hourIndex);
  state.currentHourIndex = hourIndex;
  syncHourCards();
});

// Theme
const themeToggle = document.getElementById("themeToggle");

function applyTheme(theme) {
  document.documentElement.classList.remove("light", "dark");
  document.documentElement.classList.add(theme);
  localStorage.setItem("theme", theme);
}

function initTheme() {
  const saved = localStorage.getItem("theme");
  if (saved === "light") {
    localStorage.setItem("theme", "dark");
  }
  applyTheme("dark");
}

themeToggle?.addEventListener("click", () => {
  applyTheme("dark");
});

initTheme();

// Initial setup
renderHours();
updateUi();

// Periodic updates
document.addEventListener("keydown", handleKeydown);
setInterval(updateUi, 1000);
