const defaultHours = 8;
const defaultHourTarget = 35;
const hourMs = 60 * 60 * 1000;

const ahtTargetInput = document.getElementById("ahtTargetInput");
const startButton = document.getElementById("startButton");
const resetHourButton = document.getElementById("resetHourButton");
const addHourButton = document.getElementById("addHourButton");
const resetShiftButton = document.getElementById("resetShiftButton");
const logButton = document.getElementById("logButton");
const shiftState = document.getElementById("shiftState");
const itemsThisHour = document.getElementById("itemsThisHour");
const currentAht = document.getElementById("currentAht");
const shiftTotal = document.getElementById("shiftTotal");
const hourClock = document.getElementById("hourClock");
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
  shiftComplete: false,
  shiftStartTs: 0,
  currentHourStartTs: 0,
  currentHourIndex: 0,
  handledShiftTotal: 0,
  ahtTargetSeconds: 75,
  hours: createInitialHours(defaultHours),
};

function createHour(target = defaultHourTarget) {
  return {
    target,
    count: 0,
    closed: false,
    metTarget: false,
  };
}

function createInitialHours(hourCount) {
  return Array.from({ length: hourCount }, () => createHour());
}

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

function totalTarget() {
  return state.hours.reduce((sum, hour) => sum + hour.target, 0);
}

function currentHour() {
  return state.hours[state.currentHourIndex] ?? null;
}

function currentHourLabel() {
  return `Hour ${Math.min(state.currentHourIndex + 1, state.hours.length)} of ${state.hours.length}`;
}

function buildHourCard(hour, index) {
  const card = document.createElement("article");
  card.className = "hour-card";
  card.dataset.hourIndex = String(index);

  card.innerHTML = `
    <div class="hour-card__head">
      <span>Hour ${index + 1}</span>
      <span class="hour-badge" data-role="hour-badge">Waiting</span>
    </div>
    <label class="field hour-field">
      <span>Target</span>
      <input data-role="hour-target" type="number" min="1" step="1" value="${hour.target}" />
    </label>
    <div class="hour-card__metrics">
      <div>
        <span>Count</span>
        <strong data-role="hour-count">0</strong>
      </div>
      <div>
        <span>Progress</span>
        <strong data-role="hour-progress">0%</strong>
      </div>
    </div>
    <div class="hour-track" aria-hidden="true">
      <div class="hour-track__fill" data-role="hour-fill"></div>
    </div>
    <p class="hour-meta" data-role="hour-meta">Waiting for the shift to reach this hour.</p>
  `;

  return card;
}

function renderHours() {
  hoursGrid.innerHTML = "";
  state.hours.forEach((hour, index) => {
    hoursGrid.appendChild(buildHourCard(hour, index));
  });
}

function syncHourCards() {
  const cards = hoursGrid.querySelectorAll(".hour-card");

  cards.forEach((card, index) => {
    const hour = state.hours[index];
    const countEl = card.querySelector('[data-role="hour-count"]');
    const progressEl = card.querySelector('[data-role="hour-progress"]');
    const fillEl = card.querySelector('[data-role="hour-fill"]');
    const badgeEl = card.querySelector('[data-role="hour-badge"]');
    const metaEl = card.querySelector('[data-role="hour-meta"]');
    const targetInput = card.querySelector('[data-role="hour-target"]');
    const isCurrent = state.started && !state.shiftComplete && index === state.currentHourIndex;
    const isPast = index < state.currentHourIndex;
    const progress = Math.min(1, hour.count / Math.max(1, hour.target));
    const percent = Math.round(progress * 100);

    if (targetInput !== document.activeElement) {
      targetInput.value = String(hour.target);
    }

    countEl.textContent = String(hour.count);
    progressEl.textContent = `${percent}%`;
    fillEl.style.width = `${percent}%`;

    card.classList.toggle("active", isCurrent);
    card.classList.toggle("complete", hour.closed && hour.metTarget);
    card.classList.toggle("missed", hour.closed && !hour.metTarget);
    card.classList.toggle("current", isCurrent && !hour.closed);

    if (!state.started) {
      badgeEl.textContent = "Waiting";
      metaEl.textContent = "Set your targets and start the shift.";
    } else if (isCurrent) {
      badgeEl.textContent = hour.metTarget ? "Target met" : "Live";
      metaEl.textContent = hour.metTarget
        ? "This hour is already ahead of target."
        : `${Math.max(0, hour.target - hour.count)} left for this hour.`;
    } else if (isPast) {
      badgeEl.textContent = hour.metTarget ? "Complete" : "Missed";
      metaEl.textContent = hour.metTarget ? "Closed above target." : "Closed under target.";
    } else {
      badgeEl.textContent = "Upcoming";
      metaEl.textContent = "Waiting for the shift to reach this hour.";
    }
  });
}

function setMessage(text, type = "neutral") {
  statusText.textContent = text;
  statusText.classList.toggle("success", type === "success");
  statusText.classList.toggle("warning", type === "warning");
}

function clearShiftProgress() {
  state.shiftComplete = false;
  state.shiftStartTs = 0;
  state.currentHourStartTs = 0;
  state.currentHourIndex = 0;
  state.handledShiftTotal = 0;

  state.hours.forEach((hour) => {
    hour.count = 0;
    hour.closed = false;
    hour.metTarget = false;
  });
}

function startShift() {
  state.ahtTargetSeconds = parsePositiveInteger(ahtTargetInput.value, state.ahtTargetSeconds);
  ahtTargetInput.value = String(state.ahtTargetSeconds);

  clearShiftProgress();

  const now = Date.now();
  state.started = true;
  state.shiftStartTs = now;
  state.currentHourStartTs = now;

  logButton.disabled = false;
  resetHourButton.disabled = false;
  addHourButton.disabled = false;
  resetShiftButton.disabled = false;
  startButton.textContent = "Restart shift";

  setMessage("Shift started. Log each moderation action with Enter.");
  updateUi();
}

function resetCurrentHour() {
  if (!state.started) {
    startShift();
    return;
  }

  const hour = currentHour();
  if (!hour) {
    return;
  }

  state.handledShiftTotal = Math.max(0, state.handledShiftTotal - hour.count);
  hour.count = 0;
  hour.closed = false;
  hour.metTarget = false;
  state.currentHourStartTs = Date.now();
  setMessage(`Hour ${state.currentHourIndex + 1} reset. Build the pace again.`);
  updateUi();
}

function resetShift() {
  clearShiftProgress();
  state.started = false;
  startButton.textContent = "Start shift";
  logButton.disabled = true;
  resetHourButton.disabled = true;
  setMessage("Shift reset. Edit the hours and start again when you are ready.");
  updateUi();
}

function addHour() {
  const lastTarget = state.hours[state.hours.length - 1]?.target ?? defaultHourTarget;
  state.hours.push(createHour(lastTarget));

  if (state.shiftComplete) {
    state.shiftComplete = false;
    state.currentHourIndex = state.hours.length - 1;
    state.currentHourStartTs = Date.now();
  }

  renderHours();
  syncHourCards();
  updateUi();
  setMessage(`Added Hour ${state.hours.length}.`);
}

function advanceHour(now) {
  while (state.started && !state.shiftComplete && now - state.currentHourStartTs >= hourMs) {
    const hour = currentHour();
    if (hour) {
      hour.closed = true;
      hour.metTarget = hour.count >= hour.target;
    }

    if (state.currentHourIndex >= state.hours.length - 1) {
      state.shiftComplete = true;
      logButton.disabled = true;
      setMessage("Shift complete. Add more hours or reset the shift to start a new run.", "success");
      break;
    }

    state.currentHourIndex += 1;
    state.currentHourStartTs += hourMs;
    setMessage(`Hour ${state.currentHourIndex + 1} is live. Back to zero for the next lane.`);
  }
}

function logItem() {
  if (!state.started) {
    startShift();
    return;
  }

  if (state.shiftComplete) {
    setMessage("Shift is complete. Restart it to log more items.", "warning");
    return;
  }

  const hour = currentHour();
  if (!hour) {
    return;
  }

  hour.count += 1;
  state.handledShiftTotal += 1;
  hour.metTarget = hour.count >= hour.target;

  if (hour.count >= hour.target) {
    const overBy = hour.count - hour.target;
    setMessage(
      overBy > 0
        ? `Hour ${state.currentHourIndex + 1} is ahead by ${overBy}.`
        : `Target hit for hour ${state.currentHourIndex + 1}. Keep the momentum.`,
      "success"
    );
  } else {
    const remaining = Math.max(0, hour.target - hour.count);
    setMessage(`${remaining} more to hit Hour ${state.currentHourIndex + 1}.`);
  }

  updateUi();
}

function updateHourMetrics(now) {
  const hour = currentHour();
  const activeHourElapsed = state.started ? now - state.currentHourStartTs : 0;
  const shiftElapsed = state.started ? now - state.shiftStartTs : 0;
  const currentAhtSeconds = hour && hour.count > 0 ? activeHourElapsed / 1000 / hour.count : 0;
  const shiftAhtSeconds = state.handledShiftTotal > 0 ? shiftElapsed / 1000 / state.handledShiftTotal : 0;
  const remainingInHour = Math.max(0, hourMs - activeHourElapsed);
  const currentTarget = hour?.target ?? defaultHourTarget;
  const currentCount = hour?.count ?? 0;

  itemsThisHour.textContent = String(currentCount);
  currentAht.textContent = formatSeconds(currentAhtSeconds);
  shiftTotal.textContent = String(state.handledShiftTotal);
  hourClock.textContent = formatDuration(remainingInHour);
  hourTargetLabel.textContent = `Target: ${currentTarget}`;
  ahtStatus.textContent = `Goal: ${state.ahtTargetSeconds}s | Shift AHT: ${formatSeconds(shiftAhtSeconds)}`;
  shiftProgress.textContent = state.started
    ? `${currentHourLabel()} | ${formatDuration(shiftElapsed)} elapsed`
    : `Hour 1 of ${state.hours.length}`;
  paceLabel.textContent = state.started
    ? currentAhtSeconds > 0
      ? `Pace: ${formatSeconds(currentAhtSeconds)} per item`
      : "Press Enter to log the first item"
    : "Press Start shift to begin tracking";
  shiftState.textContent = state.started
    ? state.shiftComplete
      ? "Shift complete"
      : `Hour ${state.currentHourIndex + 1} live`
    : "Shift not started";

  const progressPercent = Math.round(Math.min(1, currentCount / Math.max(1, currentTarget)) * 100);
  hourProgressFill.style.width = `${progressPercent}%`;
  goalBadge.textContent = `${state.handledShiftTotal} / ${totalTarget()} completed`;
}

function updateUi() {
  const now = Date.now();

  if (state.started && !state.shiftComplete) {
    advanceHour(now);
  }

  syncHourCards();
  updateHourMetrics(now);
  hoursSummary.textContent = `${state.hours.length} hours configured`;

  if (!state.started) {
    startButton.textContent = "Start shift";
    resetHourButton.disabled = true;
    logButton.disabled = true;
    addHourButton.disabled = false;
    resetShiftButton.disabled = false;
    setMessage("Set your targets, then start the shift.");
  } else {
    startButton.textContent = "Restart shift";
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

hoursGrid.addEventListener("input", (event) => {
  const targetInput = event.target;
  if (!targetInput.matches('[data-role="hour-target"]')) {
    return;
  }

  const hourIndex = Number(targetInput.closest(".hour-card")?.dataset.hourIndex);
  const hour = state.hours[hourIndex];
  if (!hour) {
    return;
  }

  hour.target = parsePositiveInteger(targetInput.value, hour.target);
  targetInput.value = String(hour.target);
  syncHourCards();
  updateUi();
});

renderHours();
updateUi();

startButton.addEventListener("click", startShift);
resetHourButton.addEventListener("click", resetCurrentHour);
resetShiftButton.addEventListener("click", resetShift);
addHourButton.addEventListener("click", addHour);
logButton.addEventListener("click", logItem);
ahtTargetInput.addEventListener("input", () => {
  state.ahtTargetSeconds = parsePositiveInteger(ahtTargetInput.value, state.ahtTargetSeconds);
  ahtTargetInput.value = String(state.ahtTargetSeconds);
  updateUi();
});
document.addEventListener("keydown", handleKeydown);
setInterval(updateUi, 1000);
