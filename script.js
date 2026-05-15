(function() {
  let config = {};
  let totalCount = 0;
  let hourCount = 0;
  let shiftStartMs = 0;
  let shiftEndMs = 0;
  let actualStartMs = 0;
  let lastIncrementMs = 0;
  let currentHourKey = '';
  let hourlyData = {};
  let ahtInterval = null;
  let shiftInterval = null;
  let breakCheckInterval = null;
  let gaugeInterval = null;
  let clockInterval = null;
  let currentBreak = null;
  let breakDismissed = false;

  const configScreen = document.getElementById('config-screen');
  const dashboard = document.getElementById('dashboard');
  const endStats = document.getElementById('end-stats');
  const clockEl = document.getElementById('live-clock');
  const counterEl = document.getElementById('counter');
  const currentHourLabel = document.getElementById('current-hour-label');
  const incrementBtn = document.getElementById('increment-btn');
  const ahtTimerEl = document.getElementById('aht-timer');
  const ahtTargetLabel = document.getElementById('aht-target-label');
  const shiftTimerEl = document.getElementById('shift-timer');
  const gaugeCountEl = document.getElementById('gauge-count');
  const gaugeDoneEl = document.getElementById('gauge-done');
  const gaugeTargetEl = document.getElementById('gauge-target');
  const gaugeMaxLabel = document.getElementById('gauge-max-label');
  const gaugeArc = document.getElementById('gauge-arc');
  const gaugeNeedle = document.getElementById('gauge-needle');
  const progressFill = document.getElementById('progress-fill');
  const progressCount = document.getElementById('progress-count');
  const progressPct = document.getElementById('progress-pct');
  const statElapsed = document.getElementById('stat-elapsed');
  const statRemaining = document.getElementById('stat-remaining');
  const statEta = document.getElementById('stat-eta');
  const breakOverlay = document.getElementById('break-overlay');
  const breakIcon = document.getElementById('break-icon');
  const breakTitle = document.getElementById('break-title');
  const breakSubtitle = document.getElementById('break-subtitle');
  const breakTimerEl = document.getElementById('break-timer');
  const dismissBreakBtn = document.getElementById('dismiss-break');
  const resetBtn = document.getElementById('reset-btn');
  const endShiftBtn = document.getElementById('end-shift-btn');
  const backToSetupBtn = document.getElementById('back-to-setup');
  const hourlyStatsEl = document.getElementById('hourly-stats');
  const calcTotalEl = document.getElementById('calc-total');

  const shiftStartInput = document.getElementById('shift-start');
  const shiftEndInput = document.getElementById('shift-end');
  const targetHourInput = document.getElementById('target-hour');

  function timeToMinutes(t) {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  }

  function minsToTime(mins) {
    const h = Math.floor(mins / 60) % 24;
    const m = mins % 60;
    return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
  }

  function timeToday(t) {
    const [h, m] = t.split(':').map(Number);
    const d = new Date();
    d.setHours(h, m, 0, 0);
    return d.getTime();
  }

  function formatDuration(ms) {
    const s = Math.floor(ms / 1000);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (h > 0) return h + ':' + String(m).padStart(2, '0') + ':' + String(sec).padStart(2, '0');
    return String(m).padStart(2, '0') + ':' + String(sec).padStart(2, '0');
  }

  function formatShort(ms) {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return m + ':' + String(sec).padStart(2, '0');
  }

  function formatSeconds(sec) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return m + ':' + String(s).padStart(2, '0');
  }

  function getHourKey() {
    const d = new Date();
    return d.getHours();
  }

  function getHourRange() {
    const h = getHourKey();
    const next = (h + 1) % 24;
    return String(h).padStart(2, '0') + ':00 - ' + String(next).padStart(2, '0') + ':00';
  }

  function now() { return Date.now(); }

  function breakEnd(start, dur) {
    const m = timeToMinutes(start) + dur;
    return minsToTime(m);
  }

  function calcShiftHours() {
    const startMin = timeToMinutes(shiftStartInput.value);
    let endMin = timeToMinutes(shiftEndInput.value);
    if (endMin <= startMin) endMin += 1440;

    const b1 = timeToMinutes(breakEnd(document.getElementById('break1-start').value, 15));
    const b1s = timeToMinutes(document.getElementById('break1-start').value);
    const l = timeToMinutes(breakEnd(document.getElementById('lunch-start').value, 30));
    const ls = timeToMinutes(document.getElementById('lunch-start').value);
    const b2 = timeToMinutes(breakEnd(document.getElementById('break2-start').value, 15));
    const b2s = timeToMinutes(document.getElementById('break2-start').value);

    let breakMinutes = 0;
    if (b1 > b1s) breakMinutes += b1 - b1s;
    if (l > ls) breakMinutes += l - ls;
    if (b2 > b2s) breakMinutes += b2 - b2s;

    return (endMin - startMin - breakMinutes) / 60;
  }

  function calcTotalTarget() {
    const hours = calcShiftHours();
    const perHour = parseInt(targetHourInput.value) || 1;
    return Math.round(hours * perHour);
  }

  function calcAHT() {
    const perHour = parseInt(targetHourInput.value) || 1;
    return Math.round(3600 / perHour);
  }

  function updateConfigPreview() {
    calcTotalEl.textContent = calcTotalTarget();
    ahtTargetLabel.textContent = 'target: ' + calcAHT() + 's';
  }

  function autoSetBreakEnd(inputId, dur) {
    const inp = document.getElementById(inputId);
    const prev = inp.value;
    inp.addEventListener('change', function() {
      if (this.value !== prev) updateConfigPreview();
    });
  }

  shiftStartInput.addEventListener('change', updateConfigPreview);
  shiftEndInput.addEventListener('change', updateConfigPreview);
  targetHourInput.addEventListener('input', updateConfigPreview);

  document.getElementById('break1-start').addEventListener('change', updateConfigPreview);
  document.getElementById('lunch-start').addEventListener('change', updateConfigPreview);
  document.getElementById('break2-start').addEventListener('change', updateConfigPreview);

  function setDefaultTimes() {
    const d = new Date();
    const h = d.getHours();
    shiftStartInput.value = String(h).padStart(2, '0') + ':00';
    shiftEndInput.value = String((h + 9) % 24).padStart(2, '0') + ':00';
    document.getElementById('break1-start').value = String((h + 2) % 24).padStart(2, '0') + ':00';
    document.getElementById('lunch-start').value = String((h + 4) % 24).padStart(2, '0') + ':30';
    document.getElementById('break2-start').value = String((h + 7) % 24).padStart(2, '0') + ':00';
    updateConfigPreview();
  }

  setDefaultTimes();

  function getBreakEnds() {
    return {
      break1End: breakEnd(document.getElementById('break1-start').value, 15),
      lunchEnd: breakEnd(document.getElementById('lunch-start').value, 30),
      break2End: breakEnd(document.getElementById('break2-start').value, 15)
    };
  }

  // Start Shift
  document.getElementById('start-shift-btn').addEventListener('click', function() {
    const ends = getBreakEnds();
    const targetTotal = calcTotalTarget();
    config = {
      shiftStart: shiftStartInput.value,
      shiftEnd: shiftEndInput.value,
      break1Start: document.getElementById('break1-start').value,
      break1End: ends.break1End,
      lunchStart: document.getElementById('lunch-start').value,
      lunchEnd: ends.lunchEnd,
      break2Start: document.getElementById('break2-start').value,
      break2End: ends.break2End,
      targetTotal: targetTotal,
      targetHour: parseInt(targetHourInput.value) || 25,
      ahtTarget: calcAHT(),
      stepSize: parseInt(document.getElementById('step-size').value) || 1
    };

    shiftStartMs = timeToday(config.shiftStart);
    shiftEndMs = timeToday(config.shiftEnd);
    if (shiftEndMs <= shiftStartMs) shiftEndMs += 86400000;

    actualStartMs = now();

    gaugeTargetEl.textContent = config.targetHour;
    gaugeMaxLabel.textContent = config.targetHour;

    totalCount = 0;
    hourCount = 0;
    currentHourKey = getHourKey();
    hourlyData = {};
    lastIncrementMs = now();
    hourlyData[currentHourKey] = { count: 0, start: now() };

    configScreen.style.display = 'none';
    endStats.style.display = 'none';
    dashboard.style.display = 'block';

    updateDisplay();
    startTimers();
    startBreakChecker();
    startGaugeUpdater();
    startClock();
  });

  function updateDisplay() {
    counterEl.textContent = hourCount;
    currentHourLabel.textContent = 'Hour: ' + getHourRange();

    counterEl.classList.remove('count-pop');
    void counterEl.offsetWidth;
    counterEl.classList.add('count-pop');

    const pct = Math.min((totalCount / config.targetTotal) * 100, 100);
    progressFill.style.width = pct + '%';
    progressCount.textContent = totalCount + ' / ' + config.targetTotal;
    progressPct.textContent = Math.round(pct) + '%';
    statRemaining.textContent = Math.max(config.targetTotal - totalCount, 0);

    updateGauge();
  }

  function increment() {
    hourCount += config.stepSize;
    totalCount += config.stepSize;
    lastIncrementMs = now();

    if (!hourlyData[getHourKey()]) {
      hourlyData[getHourKey()] = { count: 0, start: now() };
    }
    hourlyData[getHourKey()].count += config.stepSize;

    updateDisplay();
  }

  incrementBtn.addEventListener('click', increment);

  document.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && dashboard.style.display === 'block') {
      e.preventDefault();
      if (breakOverlay.classList.contains('active')) return;
      increment();
    }
  });

  // Check hour rollover
  function checkHourRollover() {
    const hk = getHourKey();
    if (hk !== currentHourKey) {
      currentHourKey = hk;
      hourCount = 0;
      hourlyData[hk] = { count: 0, start: now() };
      lastIncrementMs = now();
      updateDisplay();
    }
  }

  // AHT Timer
  function startTimers() {
    if (ahtInterval) clearInterval(ahtInterval);
    ahtInterval = setInterval(function() {
      const elapsed = now() - lastIncrementMs;
      const elapsedSec = Math.floor(elapsed / 1000);
      ahtTimerEl.textContent = formatDuration(elapsed);
      if (config.ahtTarget && elapsedSec > config.ahtTarget) {
        ahtTimerEl.classList.add('over-target');
      } else {
        ahtTimerEl.classList.remove('over-target');
      }
      checkHourRollover();
    }, 200);

    if (shiftInterval) clearInterval(shiftInterval);
    shiftInterval = setInterval(updateShiftTimer, 1000);
    updateShiftTimer();
  }

  function updateShiftTimer() {
    const current = now();
    const remaining = shiftEndMs - current;

    if (remaining <= 0) {
      shiftTimerEl.textContent = '00:00:00';
      endShift();
      return;
    }

    shiftTimerEl.textContent = formatDuration(remaining);

    const elapsed = current - actualStartMs;
    if (elapsed > 0) {
      statElapsed.textContent = formatShort(elapsed);

      const elapsedHours = elapsed / 3600000;
      const rate = totalCount / elapsedHours;
      if (rate > 0 && totalCount < config.targetTotal) {
        const rem = config.targetTotal - totalCount;
        const etaMs = current + (rem / rate) * 3600000;
        const etaDate = new Date(etaMs);
        statEta.textContent = String(etaDate.getHours()).padStart(2, '0') + ':' + String(etaDate.getMinutes()).padStart(2, '0');
      } else if (totalCount >= config.targetTotal) {
        statEta.textContent = 'Done!';
      }
    }
  }

  // Gauge
  function startGaugeUpdater() {
    if (gaugeInterval) clearInterval(gaugeInterval);
    gaugeInterval = setInterval(updateGauge, 5000);
    updateGauge();
  }

  function updateGauge() {
    gaugeCountEl.textContent = hourCount;
    gaugeDoneEl.textContent = hourCount;

    const ratio = Math.min(hourCount / config.targetHour, 1);
    const arcLen = 251.2;
    gaugeArc.setAttribute('stroke-dasharray', (ratio * arcLen) + ' ' + arcLen);

    const angle = -90 + (ratio * 180);
    gaugeNeedle.setAttribute('transform', 'rotate(' + angle + ', 100, 110)');
  }

  // Live Clock
  function startClock() {
    if (clockInterval) clearInterval(clockInterval);
    updateClock();
    clockInterval = setInterval(updateClock, 1000);
  }

  function updateClock() {
    const d = new Date();
    clockEl.textContent = String(d.getHours()).padStart(2, '0') + ':' +
      String(d.getMinutes()).padStart(2, '0') + ':' +
      String(d.getSeconds()).padStart(2, '0');
  }

  // Break checker
  function startBreakChecker() {
    if (breakCheckInterval) clearInterval(breakCheckInterval);
    breakCheckInterval = setInterval(checkBreaks, 5000);
    checkBreaks();
  }

  function checkBreaks() {
    if (breakDismissed) return;
    const currentMinutes = getCurrentMinutes();
    const breaks = [
      { start: config.break1Start, end: config.break1End, title: 'Break Time!', subtitle: 'Take a quick breather.', icon: '&#9749;' },
      { start: config.lunchStart, end: config.lunchEnd, title: 'Lunch Time!', subtitle: 'Enjoy your meal!', icon: '&#127860;' },
      { start: config.break2Start, end: config.break2End, title: 'Break Time!', subtitle: 'Almost done! Take a rest.', icon: '&#127796;' }
    ];

    for (const brk of breaks) {
      const s = timeToMinutes(brk.start);
      const e = timeToMinutes(brk.end);
      if (currentMinutes >= s && currentMinutes < e) {
        if (currentBreak !== brk.start) {
          currentBreak = brk.start;
          showBreakOverlay(brk);
        }
        return;
      }
    }

    currentBreak = null;
    breakOverlay.classList.remove('active');
    breakDismissed = false;
  }

  function getCurrentMinutes() {
    const d = new Date();
    return d.getHours() * 60 + d.getMinutes();
  }

  function showBreakOverlay(brk) {
    breakIcon.innerHTML = brk.icon;
    breakTitle.textContent = brk.title;
    breakSubtitle.textContent = brk.subtitle;
    breakOverlay.classList.add('active');
    breakDismissed = false;

    const endMin = timeToMinutes(brk.end);
    if (window.breakTimerInterval) clearInterval(window.breakTimerInterval);
    window.breakTimerInterval = setInterval(function() {
      const rem = (endMin - getCurrentMinutes()) * 60000;
      breakTimerEl.textContent = formatDuration(Math.max(rem, 0));
      if (rem <= 0) clearInterval(window.breakTimerInterval);
    }, 1000);
  }

  dismissBreakBtn.addEventListener('click', function() {
    breakDismissed = true;
    breakOverlay.classList.remove('active');
    if (window.breakTimerInterval) clearInterval(window.breakTimerInterval);
  });

  // End Shift
  function endShift() {
    if (ahtInterval) clearInterval(ahtInterval);
    if (shiftInterval) clearInterval(shiftInterval);
    if (breakCheckInterval) clearInterval(breakCheckInterval);
    if (gaugeInterval) clearInterval(gaugeInterval);
    if (clockInterval) clearInterval(clockInterval);
    if (window.breakTimerInterval) clearInterval(window.breakTimerInterval);
    breakOverlay.classList.remove('active');
    dashboard.style.display = 'none';
    showEndStats();
  }

  function showEndStats() {
    const totalHours = (shiftEndMs - shiftStartMs) / 3600000;
    const avg = totalHours > 0 ? totalCount / totalHours : 0;

    document.getElementById('summary-total').textContent = totalCount;
    document.getElementById('summary-target').textContent = config.targetTotal;
    document.getElementById('summary-avg').textContent = Math.round(avg);

    hourlyStatsEl.innerHTML = '';

    const sortedHours = Object.keys(hourlyData).sort(function(a, b) { return a - b; });
    for (const h of sortedHours) {
      const data = hourlyData[h];
      const hStart = String(h).padStart(2, '0') + ':00';
      const hEnd = String((parseInt(h) + 1) % 24).padStart(2, '0') + ':00';
      const rate = data.count;
      const cls = rate >= config.targetHour ? '' : ' below';

      const row = document.createElement('div');
      row.className = 'hourly-row';
      row.innerHTML =
        '<span class="hour-label">' + hStart + '-' + hEnd + '</span>' +
        '<span class="hour-count">' + data.count + ' items</span>' +
        '<span class="hour-rate' + cls + '">' + rate + '/hr ' + (rate >= config.targetHour ? '\u2713' : '\u2717') + '</span>';
      hourlyStatsEl.appendChild(row);
    }

    endStats.style.display = 'block';
  }

  endShiftBtn.addEventListener('click', function() {
    if (confirm('End shift and view stats?')) endShift();
  });

  backToSetupBtn.addEventListener('click', function() {
    endStats.style.display = 'none';
    configScreen.style.display = 'block';
    totalCount = 0;
    hourCount = 0;
    hourlyData = {};
    breakDismissed = false;
    currentBreak = null;
  });

  resetBtn.addEventListener('click', function() {
    if (confirm('Reset counter to 0?')) {
      hourCount = 0;
      totalCount = 0;
      currentHourKey = getHourKey();
      hourlyData = {};
      hourlyData[currentHourKey] = { count: 0, start: now() };
      lastIncrementMs = now();
      updateDisplay();
    }
  });
})();
