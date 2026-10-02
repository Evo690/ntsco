/* --- PRACTICE MODE SELECTION --- */
function showModeSelection() {
  const selView = document.getElementById('chem-view-select-mode');
  const chemContent = document.getElementById('chem-practice-content');
  const reagentContent = document.getElementById('reagent-practice-content');
  const pkaContent = document.getElementById('pka-practice-content');
  if (selView) selView.style.display = 'block';
  if (chemContent) chemContent.style.display = 'none';
  if (reagentContent) reagentContent.style.display = 'none';
  if (pkaContent) pkaContent.style.display = 'none';
}
function selectPracticeMode(mode) {
  const selView = document.getElementById('chem-view-select-mode');
  const chemContent = document.getElementById('chem-practice-content');
  const reagentContent = document.getElementById('reagent-practice-content');
  const pkaContent = document.getElementById('pka-practice-content');
  if (selView) selView.style.display = 'none';
  if (mode === 'common-names') {
    if (chemContent) chemContent.style.display = 'block';
    if (reagentContent) reagentContent.style.display = 'none';
    if (pkaContent) pkaContent.style.display = 'none';
    chemInitApp();
  } else if (mode === 'reagents') {
    if (chemContent) chemContent.style.display = 'none';
    if (reagentContent) reagentContent.style.display = 'block';
    if (pkaContent) pkaContent.style.display = 'none';
    reagentInitApp();
  } else if (mode === 'pka') {
    if (chemContent) chemContent.style.display = 'none';
    if (reagentContent) reagentContent.style.display = 'none';
    if (pkaContent) pkaContent.style.display = 'block';
    pkaInitApp();
  }
}

/* --- REAGENTS LOGIC --- */
let reagentAllReactions = [];
let reagentAllReagents = [];
let reagentAllReactants = [];
let reagentAllProducts = [];
let reagentMyData = chemCombinedData.reagents;

// Learn State
let reagentLearnQueue = [];
let reagentLearnIdx = 0;

// Practice State
let reagentPracticeSessionCount = 0;
let reagentPracticeCorrectCount = 0;
let reagentLastPracticeKey = null;
let reagentAppReady = false;
function reagentReadSavedData() {
  return reagentMyData;
}
async function reagentInitApp() {
  if (reagentAppReady) {
    var _document$getElementB6;
    reagentUpdateDashboard();
    chemLoadLeaderboard((_document$getElementB6 = document.getElementById('reagent-board-week')) !== null && _document$getElementB6 !== void 0 && _document$getElementB6.classList.contains('active') ? 'week' : 'today');
    return;
  }
  try {
    const response = await fetch('re.json');
    reagentAllReactions = await response.json();
  } catch (e) {
    console.error("Failed to initialize chemical reactions data", e);
    chemShowToast("Error loading chemistry database.");
    return;
  }

  // Extract unique sets from database
  reagentAllReagents = [...new Set(reagentAllReactions.map(r => r.Reagent))];
  reagentAllReactants = [...new Set(reagentAllReactions.map(r => r.Reactant))];
  reagentAllProducts = [...new Set(reagentAllReactions.map(r => r.Product))];

  // If user has no reagents added, add one to get them started
  if (reagentMyData.myList.length === 0 && reagentAllReagents.length > 0) {
    const defaultReagent = "NaBH4"; // A nice common one to start
    const startReagent = reagentAllReagents.includes(defaultReagent) ? defaultReagent : reagentAllReagents[0];
    reagentMyData.myList.push(startReagent);

    // Initialize stats
    const startReactions = reagentAllReactions.filter(r => r.Reagent === startReagent);
    startReactions.forEach(r => {
      const key = `${r.Reactant} | ${r.Reagent} | ${r.Product}`;
      reagentMyData.stats[key] = {
        wrong: 0,
        correct: 0,
        streak: 0,
        lastSeen: 0
      };
    });
    reagentSave();
  }

  // Sync database changes with local storage stats (in case JSON changed)
  reagentAllReactions.forEach(r => {
    const key = `${r.Reactant} | ${r.Reagent} | ${r.Product}`;
    if (reagentMyData.myList.includes(r.Reagent) && !reagentMyData.stats[key]) {
      reagentMyData.stats[key] = {
        wrong: 0,
        correct: 0,
        streak: 0,
        lastSeen: 0
      };
    }
  });
  reagentAppReady = true;
  reagentUpdateDashboard();
  chemLoadLeaderboard('today');
}
function reagentUpdateDashboard() {
  var _chemMyData$dailyStat2;
  const totalReagents = reagentAllReagents.length;
  const inList = reagentMyData.myList.length;
  const activeReactions = reagentAllReactions.filter(r => reagentMyData.myList.includes(r.Reagent));
  const totalActiveReactions = activeReactions.length;
  const mastered = activeReactions.filter(r => {
    const key = `${r.Reactant} | ${r.Reagent} | ${r.Product}`;
    const s = reagentMyData.stats[key];
    return s && s.streak >= 5;
  }).length;

  // Daily and 7-day attempts from shared chemMyData.dailyStats
  const today = chemTodayKey();
  const todayAttempts = ((_chemMyData$dailyStat2 = chemMyData.dailyStats[today]) === null || _chemMyData$dailyStat2 === void 0 ? void 0 : _chemMyData$dailyStat2.attempted) || 0;
  let sevenDayAttempts = 0;
  const recentStart = chemRecentStartKey(7);
  if (chemMyData.dailyStats && typeof chemMyData.dailyStats === 'object') {
    for (const [date, stats] of Object.entries(chemMyData.dailyStats)) {
      if (date >= recentStart && stats) {
        sevenDayAttempts += stats.attempted || 0;
      }
    }
  }
  const list = document.getElementById('reagent-stat-list');
  const totalEl = document.getElementById('reagent-stat-total');
  const masteredEl = document.getElementById('reagent-stat-mastered');
  const todayEl = document.getElementById('reagent-stat-today-attempts');
  const sevenDayEl = document.getElementById('reagent-stat-7day-attempts');
  if (list) list.innerHTML = `Reagents: <strong>${inList} / ${totalReagents}</strong>`;
  if (totalEl) totalEl.innerHTML = `Reactions: <strong>${totalActiveReactions}</strong>`;
  if (masteredEl) masteredEl.innerHTML = `Mastered: <strong>${mastered}</strong>`;
  if (todayEl) todayEl.innerHTML = `Today: <strong>${todayAttempts}</strong>`;
  if (sevenDayEl) sevenDayEl.innerHTML = `7-Day: <strong>${sevenDayAttempts}</strong>`;
}
function reagentSave() {
  chemCombinedData.compounds = chemMyData;
  chemCombinedData.reagents = reagentMyData;
  chemCombinedData.pka = pkaMyData;
  localStorage.setItem(getUserStorageKey(CHEM_DATA_KEY), JSON.stringify(chemCombinedData));
  localStorage.setItem(getUserStorageKey('reagent_v1_data'), JSON.stringify(reagentMyData));
  localStorage.setItem(getUserStorageKey('chem_progress_updated_at'), new Date().toISOString());
  reagentUpdateDashboard();
}
function reagentUpdateLearnEquation(reagent, reactant, product) {
  const eqDiv = document.getElementById('reagent-learn-eq-container');
  if (!eqDiv) return;
  eqDiv.innerHTML = `
      <div class="eq-row">
        <div class="eq-block eq-reagent">${escapeHtml(reagent)}</div>
        <div class="eq-operator">+</div>
        <div class="eq-block eq-reactant">${escapeHtml(reactant)}</div>
        <div class="eq-arrow">➔</div>
        <div class="eq-block eq-product">${escapeHtml(product)}</div>
      </div>
    `;
}
function reagentUpdatePracticeEquation(reagent, reactant, product, hideReactant) {
  const eqDiv = document.getElementById('reagent-practice-eq-container');
  if (!eqDiv) return;
  eqDiv.innerHTML = `
      <div class="eq-row">
        <div class="eq-block eq-reagent">${escapeHtml(reagent)}</div>
        <div class="eq-operator">+</div>
        <div class="eq-block ${hideReactant ? 'eq-hidden' : 'eq-reactant'}">${hideReactant ? '?' : escapeHtml(reactant)}</div>
        <div class="eq-arrow">➔</div>
        <div class="eq-block ${!hideReactant ? 'eq-hidden' : 'eq-product'}">${!hideReactant ? '?' : escapeHtml(product)}</div>
      </div>
    `;
}
function reagentBuildLearnQueue() {
  const activeReactions = reagentAllReactions.filter(r => reagentMyData.myList.includes(r.Reagent));
  const reactionKeys = activeReactions.map(r => `${r.Reactant} | ${r.Reagent} | ${r.Product}`);

  // Compute priority weight for each reaction
  const weighted = reactionKeys.map(key => {
    const s = reagentMyData.stats[key] || {
      wrong: 0,
      correct: 0,
      streak: 0,
      lastSeen: 0
    };
    const hrsSince = (Date.now() - (s.lastSeen || 0)) / 3600000;
    const errorRatio = (s.wrong + 1) / (s.correct + 2);
    const staleness = Math.min(hrsSince / 24, 3);
    const streakPenalty = Math.max(0, 1 - s.streak * 0.1);
    const weight = errorRatio * 4 + staleness * 2 + streakPenalty + Math.random() * 1.5;
    return {
      key,
      weight
    };
  });
  weighted.sort((a, b) => b.weight - a.weight);
  return weighted.map(w => w.key);
}
function reagentInitLearn() {
  if (reagentMyData.myList.length === 0) {
    chemShowToast("Add reagents first!");
    return;
  }
  reagentLearnQueue = reagentBuildLearnQueue();
  if (reagentLearnQueue.length === 0) {
    chemShowToast("No reactions found for active reagents.");
    return;
  }
  reagentLearnIdx = 0;
  reagentShowView('learn');
  reagentUpdateLearnCard();
}
function reagentChangeLearn(dir) {
  if (reagentLearnQueue.length === 0) return;
  reagentLearnIdx += dir;
  if (reagentLearnIdx >= reagentLearnQueue.length) reagentLearnIdx = 0;
  if (reagentLearnIdx < 0) reagentLearnIdx = reagentLearnQueue.length - 1;
  reagentUpdateLearnCard();
}
function reagentUpdateLearnCard() {
  const key = reagentLearnQueue[reagentLearnIdx];
  const [reactant, reagent, product] = key.split(' | ');
  const stat = reagentMyData.stats[key] || {
    correct: 0,
    wrong: 0,
    streak: 0
  };
  document.getElementById('reagent-learn-name').innerText = reagent;
  document.getElementById('reagent-learn-index-text').innerText = `${reagentLearnIdx + 1} / ${reagentLearnQueue.length}`;
  document.getElementById('reagent-learn-correct').innerText = stat.correct;
  document.getElementById('reagent-learn-wrong').innerText = stat.wrong;
  document.getElementById('reagent-learn-streak').innerText = stat.streak;
  const pct = ((reagentLearnIdx + 1) / reagentLearnQueue.length * 100).toFixed(1);
  document.getElementById('reagent-learn-progress').style.width = pct + '%';
  reagentUpdateLearnEquation(reagent, reactant, product);
}
function reagentInitPractice() {
  const activeReactions = reagentAllReactions.filter(r => reagentMyData.myList.includes(r.Reagent));
  if (activeReactions.length === 0) {
    chemShowToast("Add at least 1 reagent to practice.");
    return;
  }
  reagentPracticeSessionCount = 0;
  reagentPracticeCorrectCount = 0;
  reagentLastPracticeKey = null;
  reagentShowView('practice');
  reagentNextQuestion();
}
function reagentNextQuestion() {
  const activeReactions = reagentAllReactions.filter(r => reagentMyData.myList.includes(r.Reagent));
  const activeKeys = activeReactions.map(r => `${r.Reactant} | ${r.Reagent} | ${r.Product}`);
  const targetKey = UnifiedQuestionEngine.selectTarget(activeKeys, reagentMyData.stats, reagentLastPracticeKey);
  if (!targetKey) return;
  reagentLastPracticeKey = targetKey;
  const [reactant, reagent, product] = targetKey.split(' | ');
  const format = UnifiedQuestionEngine.decideFormat('reagents', targetKey, reagentMyData.stats);
  const hideReactant = format === 'reactant';

  // Render equation with visual placeholder
  reagentUpdatePracticeEquation(reagent, reactant, product, hideReactant);
  const correctAnswer = hideReactant ? reactant : product;
  let distractors = [];
  if (hideReactant) {
    // Hiding Reactant: distractors are other reactants.
    const validReactants = reagentAllReactants.filter(r => r !== reactant && !reagentAllReactions.some(x => x.Reagent === reagent && x.Reactant === r && x.Product === product));
    distractors = validReactants.sort(() => 0.5 - Math.random()).slice(0, 3);
  } else {
    // Hiding Product: distractors are other products.
    const validProducts = reagentAllProducts.filter(p => p !== product && !reagentAllReactions.some(x => x.Reagent === reagent && x.Reactant === reactant && x.Product === p));
    distractors = validProducts.sort(() => 0.5 - Math.random()).slice(0, 3);
  }

  // Safety fallback padding if we don't have enough filtered distractors
  if (distractors.length < 3) {
    const fallbackPool = hideReactant ? reagentAllReactants : reagentAllProducts;
    const remaining = fallbackPool.filter(x => x !== correctAnswer && !distractors.includes(x));
    while (distractors.length < 3 && remaining.length > 0) {
      distractors.push(remaining.pop());
    }
  }
  const options = [correctAnswer, ...distractors].sort(() => 0.5 - Math.random());
  const letters = ['A', 'B', 'C', 'D'];
  const optionsDiv = document.getElementById('reagent-practice-options');
  if (!optionsDiv) return;
  optionsDiv.innerHTML = '';
  document.getElementById('reagent-practice-hint').innerText = hideReactant ? 'Identify the missing reactant ↓' : 'Identify the missing product ↓';
  options.forEach((opt, i) => {
    const btn = document.createElement('button');
    btn.className = 'chem-opt-btn';
    btn.innerHTML = `<span class="chem-opt-letter">${letters[i]}</span><span>${escapeHtml(opt)}</span>`;
    btn.onclick = () => reagentHandleAnswer(opt, targetKey, correctAnswer, hideReactant);
    optionsDiv.appendChild(btn);
  });

  // Update session progress bar (resets every 10)
  const cycle = reagentPracticeSessionCount % 10;
  document.getElementById('reagent-practice-progress').style.width = cycle * 10 + '%';
}
function reagentHandleAnswer(chosen, targetKey, correct, hideReactant) {
  const btns = document.querySelectorAll('#reagent-practice-options .chem-opt-btn');
  btns.forEach(b => b.disabled = true);
  reagentPracticeSessionCount++;
  const isCorrect = chosen === correct;
  if (!reagentMyData.stats[targetKey]) {
    reagentMyData.stats[targetKey] = {
      wrong: 0,
      correct: 0,
      streak: 0,
      lastSeen: 0
    };
  }
  if (isCorrect) {
    reagentPracticeCorrectCount++;
    reagentMyData.stats[targetKey].correct++;
    reagentMyData.stats[targetKey].streak++;
    chemShowFlash('Correct', false);
  } else {
    reagentMyData.stats[targetKey].wrong++;
    reagentMyData.stats[targetKey].streak = 0;
    chemShowFlash('Wrong', true);
  }
  reagentMyData.stats[targetKey].lastSeen = Date.now();
  reagentSave();

  // ─── INTEGRATE INTO SHARED DAILY STATS ───
  chemEnsureDailyStats();
  const today = chemTodayKey();
  if (!chemMyData.dailyStats[today]) {
    chemMyData.dailyStats[today] = {
      correct: 0,
      wrong: 0,
      attempted: 0,
      timeSpent: 0
    };
  }
  chemMyData.dailyStats[today].attempted = (chemMyData.dailyStats[today].attempted || 0) + 1;
  if (isCorrect) {
    chemMyData.dailyStats[today].correct = (chemMyData.dailyStats[today].correct || 0) + 1;
  } else {
    chemMyData.dailyStats[today].wrong = (chemMyData.dailyStats[today].wrong || 0) + 1;
  }
  chemSave(); // Save and update header counters
  chemSyncAll(false); // Async cloud sync

  // Highlight correct and wrong options
  btns.forEach(b => {
    const text = b.innerText.replace(/^[A-D]/, '').trim();
    if (text === correct) b.classList.add(isCorrect ? 'correct' : 'reveal');
    if (text === chosen && !isCorrect) b.classList.add('wrong');
  });

  // Update hint text
  document.getElementById('reagent-practice-hint').innerText = isCorrect ? `That's right` : `It was: ${correct}`;

  // Reveal the correct text in the hidden equation box
  const hiddenBlock = document.querySelector('#reagent-practice-eq-container .eq-hidden');
  if (hiddenBlock) {
    hiddenBlock.innerText = correct;
    hiddenBlock.classList.remove('eq-hidden');
    hiddenBlock.style.borderColor = isCorrect ? '#22c55e' : '#ef4444';
    hiddenBlock.style.color = isCorrect ? '#22c55e' : '#ef4444';
    hiddenBlock.style.animation = 'none';
  }
  setTimeout(reagentNextQuestion, isCorrect ? 1200 : 1800);
}
function reagentLearnNew() {
  if (!reagentAppReady) return reagentInitApp().then(reagentLearnNew);
  const remaining = reagentAllReagents.filter(r => !reagentMyData.myList.includes(r));
  if (remaining.length === 0) {
    chemShowToast("All available reagents added!");
    return;
  }
  const selected = remaining[Math.floor(Math.random() * remaining.length)];
  reagentMyData.myList.push(selected);

  // Initialize stats
  const newReactions = reagentAllReactions.filter(r => r.Reagent === selected);
  newReactions.forEach(r => {
    const key = `${r.Reactant} | ${r.Reagent} | ${r.Product}`;
    if (!reagentMyData.stats[key]) {
      reagentMyData.stats[key] = {
        wrong: 0,
        correct: 0,
        streak: 0,
        lastSeen: 0
      };
    }
  });
  reagentSave();
  chemShowToast(`Added: ${selected} (${newReactions.length} reactions)`);
}
function reagentExportData() {
  const blob = new Blob([JSON.stringify(chemCombinedData, null, 2)], {
    type: "application/json"
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = "chemmaster_progress.json";
  a.click();
  URL.revokeObjectURL(url);
}
function reagentImportData(event) {
  var _event$target$files2;
  const file = (_event$target$files2 = event.target.files) === null || _event$target$files2 === void 0 ? void 0 : _event$target$files2[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    try {
      const imported = JSON.parse(ev.target.result);
      if (imported && imported.compounds && imported.reagents) {
        chemCombinedData = imported;
        chemMyData = chemCombinedData.compounds;
        reagentMyData = chemCombinedData.reagents;
        pkaMyData = chemCombinedData.pka || {
          myList: [],
          stats: {}
        };
        chemEnsureDailyStats();
        reagentSave();
        chemSave();
        chemSyncAll(false);
        chemShowToast("Progress imported.");
      } else if (imported && imported.myList && imported.stats) {
        reagentMyData.myList = imported.myList || [];
        reagentMyData.stats = imported.stats || {};
        reagentSave();
        chemSave();
        chemSyncAll(false);
        chemShowToast("Progress imported.");
      } else {
        chemShowToast("Invalid file format.");
      }
    } catch {
      chemShowToast("Invalid file format.");
    }
  };
  reader.readAsText(file);
}
function reagentShowStats(type) {
  const isWeak = type === 'weak';
  const activeReactions = reagentAllReactions.filter(r => reagentMyData.myList.includes(r.Reagent));
  if (activeReactions.length === 0) {
    chemShowToast("Add reagents first!");
    return;
  }
  const reactionStats = activeReactions.map(r => {
    const key = `${r.Reactant} | ${r.Reagent} | ${r.Product}`;
    const s = reagentMyData.stats[key] || {
      wrong: 0,
      correct: 0,
      streak: 0
    };
    const score = s.correct - s.wrong * 1.5 + s.streak * 0.5;
    return {
      r,
      key,
      stats: s,
      score
    };
  });

  // Sort by performance score
  if (isWeak) {
    reactionStats.sort((a, b) => a.score - b.score);
    document.getElementById('reagent-stats-title').innerText = 'Weakest Reactions';
  } else {
    reactionStats.sort((a, b) => b.score - a.score);
    document.getElementById('reagent-stats-title').innerText = 'Strongest Reactions';
  }
  const top = reactionStats.slice(0, 5);
  const listDiv = document.getElementById('reagent-stats-list');
  listDiv.innerHTML = top.length ? top.map((item, i) => {
    return `<div class="chem-stat-row">
        <div class="chem-stat-name">
          ${i + 1}. <span style="color:var(--accent); font-weight:600;">${escapeHtml(item.r.Reagent)}</span> + ${escapeHtml(item.r.Reactant)} ➔ <span style="color:#22c55e;">${escapeHtml(item.r.Product)}</span>
        </div>
        <div class="chem-stat-val">✓${item.stats.correct} ✗${item.stats.wrong} 🔥${item.stats.streak}</div>
      </div>`;
  }).join('') : '<div class="chem-stat-row"><span class="chem-stat-name">No data yet</span></div>';
  document.getElementById('reagent-stats-sheet').classList.add('open');
}
function reagentCloseStats(event) {
  if (event.target.id === 'reagent-stats-sheet') {
    document.getElementById('reagent-stats-sheet').classList.remove('open');
  }
}
function reagentShowView(id) {
  document.querySelectorAll('#reagent-practice-content .chem-view').forEach(v => v.classList.remove('active'));
  const view = document.getElementById('reagent-view-' + id);
  if (view) view.classList.add('active');
}
function reagentGoHome() {
  reagentShowView('home');
  chemSyncAll(false);
}

