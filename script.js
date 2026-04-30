document.addEventListener('DOMContentLoaded', () => {
    const hoursInput = document.getElementById('hoursInput');
    const goalInput = document.getElementById('goalInput');
    const ahtTargetInput = document.getElementById('ahtTargetInput');
    const startButton = document.getElementById('startButton');
    const resetButton = document.getElementById('resetButton');
    const logButton = document.getElementById('logButton');
    const decreaseButton = document.getElementById('decreaseButton');
    const shiftState = document.getElementById('shiftState');
    const itemsThisHour = document.getElementById('itemsThisHour');
    const currentAht = document.getElementById('currentAht');
    const shiftTotal = document.getElementById('shiftTotal');
    const shiftAht = document.getElementById('shiftAht');
    const hourClock = document.getElementById('hourClock');
    const hourTargetLabel = document.getElementById('hourTargetLabel');
    const ahtStatus = document.getElementById('ahtStatus');
    const shiftProgress = document.getElementById('shiftProgress');
    const paceLabel = document.getElementById('paceLabel');
    const goalBadge = document.getElementById('goalBadge');
    const hourProgressFill = document.getElementById('hourProgressFill');
    const statusText = document.getElementById('statusText');
    const hoursPanel = document.getElementById('hoursPanel');
    const hoursGrid = document.getElementById('hoursGrid');
    const hoursSummary = document.getElementById('hoursSummary');

    const state = {
        started: false,
        shiftStartTs: 0,
        handledTotal: 0,
        goal: 120,
        ahtTargetSeconds: 9,
        numHours: 0,
        isSingleMode: false,
        currentHourIndex: 0,
        lastLogTs: 0,
        hours: [],
        entries: []
    };

    function recalculateHandledTotal() {
        state.handledTotal = state.hours.reduce((sum, hour) => sum + hour.count, 0);
    }

    function parsePositiveInteger(value, fallback) {
        const parsed = Number.parseInt(value, 10);
        if (!Number.isFinite(parsed) || parsed < 0) {
            return fallback;
        }
        return parsed;
    }

    function formatClock(totalSeconds) {
        const safeSeconds = Math.max(0, Math.floor(totalSeconds));
        const minutes = Math.floor(safeSeconds / 60);
        const seconds = safeSeconds % 60;
        return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }

    function formatAht(seconds) {
        if (!Number.isFinite(seconds) || seconds <= 0) {
            return '0s';
        }

        if (seconds < 60) {
            return `${Math.round(seconds)}s`;
        }

        const rounded = Math.round(seconds);
        const minutes = Math.floor(rounded / 60);
        const remainder = rounded % 60;
        return `${minutes}m ${String(remainder).padStart(2, '0')}s`;
    }

    function getElapsedSeconds() {
        if (!state.started) {
            return 0;
        }

        return Math.max(0, Math.floor((Date.now() - state.shiftStartTs) / 1000));
    }

    function getCurrentHourIndex(elapsedSeconds = getElapsedSeconds()) {
        if (state.isSingleMode || state.numHours <= 0) {
            return 0;
        }

        const hourIndex = Math.floor(elapsedSeconds / 3600);
        return Math.min(Math.max(hourIndex, 0), state.numHours - 1);
    }

    function getCurrentHourElapsedSeconds(elapsedSeconds = getElapsedSeconds()) {
        if (state.isSingleMode) {
            return elapsedSeconds;
        }

        return elapsedSeconds % 3600;
    }

    function setupMode() {
        const hoursValue = parsePositiveInteger(hoursInput.value, 0);
        const goalValue = parsePositiveInteger(goalInput.value, 120) || 120;
        const ahtValue = parsePositiveInteger(ahtTargetInput.value, 9) || 9;

        state.goal = goalValue;
        state.ahtTargetSeconds = ahtValue;
        state.numHours = hoursValue;
        state.isSingleMode = hoursValue === 0;

        if (state.isSingleMode) {
            state.hours = [];
            hoursPanel.hidden = true;
            hoursSummary.textContent = 'Single counter mode';
        } else {
            state.hours = Array.from({ length: hoursValue }, (_, index) => {
                const existing = state.hours[index];
                return {
                    target: existing?.target ?? goalValue,
                    count: existing?.count ?? 0
                };
            });
            hoursPanel.hidden = false;
            renderHours();
        }
    }

    function renderHours() {
        if (state.isSingleMode) {
            hoursGrid.innerHTML = '';
            return;
        }

        hoursGrid.innerHTML = '';

        state.hours.forEach((hour, index) => {
            const card = document.createElement('article');
            card.className = 'hour-card';
            card.dataset.hourIndex = String(index);

            card.innerHTML = `
                <div class="hour-card__head">
                    <span>Hour ${index + 1}</span>
                    <span class="hour-badge" data-role="badge">Pending</span>
                </div>
                <div class="hour-card__metrics">
                    <div>
                        <span>Handled</span>
                        <input data-role="countInput" type="number" min="0" step="1" value="${hour.count}" />
                    </div>
                    <label class="hour-field">
                        <span>Target</span>
                        <strong data-role="target">${hour.target}</strong>
                    </label>
                </div>
                <div class="hour-track" aria-hidden="true">
                    <div class="hour-track__fill" data-role="fill"></div>
                </div>
                <p class="hour-meta" data-role="meta">0 of ${hour.target} items logged.</p>
            `;

            hoursGrid.appendChild(card);
        });

        hoursSummary.textContent = `${state.hours.length} hours configured`;
    }

    function syncHourCards() {
        if (state.isSingleMode) {
            return;
        }

        const activeHourIndex = state.started ? getCurrentHourIndex() : 0;
        const cards = hoursGrid.querySelectorAll('.hour-card');

        cards.forEach((card, index) => {
            const hour = state.hours[index];
            if (!hour) {
                return;
            }

            const progress = Math.min(100, Math.round((hour.count / Math.max(1, hour.target)) * 100));
            const countInput = card.querySelector('[data-role="countInput"]');
            const fillEl = card.querySelector('[data-role="fill"]');
            const metaEl = card.querySelector('[data-role="meta"]');
            const badgeEl = card.querySelector('[data-role="badge"]');

            if (countInput && document.activeElement !== countInput) {
                countInput.value = String(hour.count);
            }

            if (fillEl) {
                fillEl.style.width = `${progress}%`;
            }

            if (metaEl) {
                metaEl.textContent = `${hour.count} of ${hour.target} items logged.`;
            }

            if (badgeEl) {
                if (!state.started) {
                    badgeEl.textContent = 'Pending';
                    card.classList.remove('active', 'complete', 'missed');
                } else if (index < activeHourIndex) {
                    badgeEl.textContent = progress >= 100 ? 'Complete' : 'Reviewed';
                    card.classList.toggle('complete', progress >= 100);
                    card.classList.toggle('missed', progress < 100);
                    card.classList.remove('active');
                } else if (index === activeHourIndex) {
                    badgeEl.textContent = 'Active';
                    card.classList.add('active');
                    card.classList.remove('complete', 'missed');
                } else {
                    badgeEl.textContent = 'Upcoming';
                    card.classList.remove('active', 'complete', 'missed');
                }
            }
        });
    }

    function updateUi() {
        const elapsedSeconds = getElapsedSeconds();
        const currentHourIndex = getCurrentHourIndex(elapsedSeconds);
        const currentHourElapsedSeconds = getCurrentHourElapsedSeconds(elapsedSeconds);
        const currentHour = state.hours[currentHourIndex];
        const currentHourCount = state.isSingleMode
            ? state.handledTotal
            : (currentHour?.count ?? 0);
        const currentHourTarget = state.isSingleMode
            ? state.goal
            : (currentHour?.target ?? state.goal);
        const ahtSeconds = state.started && state.lastLogTs ? (Date.now() - state.lastLogTs) / 1000 : 0;
        const shiftAhtSeconds = state.started && state.handledTotal > 0
            ? getElapsedSeconds() / state.handledTotal
            : 0;
        const progressPercent = Math.min(100, Math.round((state.handledTotal / Math.max(1, state.goal)) * 100));
        const remaining = Math.max(0, state.goal - state.handledTotal);

        itemsThisHour.textContent = String(currentHourCount);
        currentAht.textContent = formatAht(ahtSeconds);
        shiftTotal.textContent = String(state.handledTotal);
        hourTargetLabel.textContent = `Target: ${currentHourTarget}`;
        ahtStatus.textContent = `Target ${state.ahtTargetSeconds}s | Resets after each count`;
        shiftProgress.textContent = state.isSingleMode ? 'Across all items' : `Across ${state.numHours} hours`;
        if (shiftAht) {
            shiftAht.textContent = `${state.isSingleMode ? 'Shift' : '8h'} AHT ${formatAht(shiftAhtSeconds)}`;
        }
        paceLabel.textContent = state.started
            ? (remaining > 0 ? `${remaining} left to reach ${state.goal}` : 'Goal reached')
            : 'Set up and start the shift';

        if (!state.started) {
            hourClock.textContent = '--:--';
        } else if (state.isSingleMode) {
            hourClock.textContent = formatClock(elapsedSeconds);
        } else {
            const remainingInHour = Math.max(0, 3600 - currentHourElapsedSeconds);
            hourClock.textContent = formatClock(remainingInHour);
        }

        goalBadge.textContent = `${state.handledTotal} / ${state.goal}`;
        hourProgressFill.style.width = `${progressPercent}%`;

        if (!state.started) {
            shiftState.textContent = 'Ready';
            statusText.textContent = 'Set the mode and start the shift to begin tracking.';
        } else if (remaining === 0) {
            shiftState.textContent = 'Goal reached';
            statusText.textContent = 'Target reached. Keep logging to capture the rest of the shift.';
        } else if (state.isSingleMode) {
            shiftState.textContent = `Running · ${state.handledTotal}`;
            statusText.textContent = `${remaining} left to reach ${state.goal}.`;
        } else {
            shiftState.textContent = `Hour ${currentHourIndex + 1} of ${state.numHours}`;
            statusText.textContent = `Active hour ${currentHourIndex + 1} is tracking toward its target.`;
        }

        if (!state.isSingleMode) {
            syncHourCards();
        }
    }

    function startShift() {
        setupMode();
        state.started = true;
        state.shiftStartTs = Date.now();
        state.lastLogTs = 0;
        state.handledTotal = 0;
        state.entries = [];
        state.currentHourIndex = 0;

        if (!state.isSingleMode) {
            state.hours = state.hours.map(hour => ({
                target: hour.target,
                count: 0
            }));
            renderHours();
        }

        startButton.textContent = 'Restart shift';
        updateUi();
    }

    function resetShift() {
        state.started = false;
        state.shiftStartTs = 0;
        state.lastLogTs = 0;
        state.handledTotal = 0;
        state.entries = [];
        state.currentHourIndex = 0;

        if (!state.isSingleMode) {
            state.hours = state.hours.map(hour => ({
                target: hour.target,
                count: 0
            }));
            renderHours();
        }

        startButton.textContent = 'Start shift';
        updateUi();
    }

    function logItem() {
        if (!state.started) {
            startShift();
        }

        const elapsedSeconds = getElapsedSeconds();
        const hourIndex = getCurrentHourIndex(elapsedSeconds);
        const now = Date.now();

        state.handledTotal += 1;
        state.entries.push(now);
        state.currentHourIndex = hourIndex;
        state.lastLogTs = now;

        if (!state.isSingleMode) {
            const hour = state.hours[hourIndex];
            if (hour) {
                hour.count += 1;
            }
        }

        recalculateHandledTotal();

        updateUi();
    }

    function decreaseItem() {
        if (!state.started || state.handledTotal <= 0) {
            return;
        }

        if (state.isSingleMode) {
            state.handledTotal = Math.max(0, state.handledTotal - 1);
        } else {
            for (let index = Math.min(state.currentHourIndex, state.hours.length - 1); index >= 0; index -= 1) {
                const hour = state.hours[index];
                if (hour && hour.count > 0) {
                    hour.count -= 1;
                    state.currentHourIndex = index;
                    break;
                }
            }

            recalculateHandledTotal();
        }

        state.lastLogTs = Date.now();
        updateUi();
    }

    function handleKeydown(event) {
        if (event.key !== 'Enter') {
            return;
        }

        const activeTag = document.activeElement?.tagName;
        if (activeTag === 'INPUT' || activeTag === 'TEXTAREA') {
            return;
        }

        event.preventDefault();
        logItem();
    }

    hoursInput.addEventListener('input', () => {
        setupMode();
        updateUi();
    });

    goalInput.addEventListener('input', () => {
        setupMode();
        updateUi();
    });

    ahtTargetInput.addEventListener('input', () => {
        setupMode();
        updateUi();
    });

    hoursGrid.addEventListener('input', event => {
        const countInput = event.target.closest('[data-role="countInput"]');
        if (!countInput) {
            return;
        }

        const card = countInput.closest('.hour-card');
        if (!card) {
            return;
        }

        const hourIndex = Number(card.dataset.hourIndex);
        const nextCount = Math.max(0, parsePositiveInteger(countInput.value, 0));
        if (state.hours[hourIndex]) {
            state.hours[hourIndex].count = nextCount;
        }

        recalculateHandledTotal();
        updateUi();
    });

    startButton.addEventListener('click', startShift);
    resetButton.addEventListener('click', resetShift);
    logButton.addEventListener('click', logItem);
    decreaseButton?.addEventListener('click', decreaseItem);

    setupMode();
    updateUi();
    document.addEventListener('keydown', handleKeydown);
    setInterval(updateUi, 1000);
});