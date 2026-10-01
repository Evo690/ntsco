/* --- pKa LOGIC --- */
let pkaAllCompounds = [];
let pkaAppReady = false;
let pkaLearnQueue = [];
let pkaLearnIdx = 0;
let pkaPracticeSessionCount = 0;
let pkaPracticeCorrectCount = 0;
let pkaCurrentQuestion = null;
let pkaSortingList = [];
let pkaLastPracticeName = null;
async function pkaInitApp() {
  if (pkaAppReady) {
    pkaUpdateDashboard();
    return;
  }
  try {
    const response = await fetch('pKa.json');
    pkaAllCompounds = await response.json();
    pkaAppReady = true;
    pkaUpdateDashboard();
  } catch (e) {
    console.error("Failed to initialize pKa data", e);
    chemShowFlash("Error loading pKa database.", true);
  }
}
function pkaSave() {
  chemCombinedData.compounds = chemMyData;
  chemCombinedData.reagents = reagentMyData;
  chemCombinedData.pka = pkaMyData;
  localStorage.setItem(getUserStorageKey(CHEM_DATA_KEY), JSON.stringify(chemCombinedData));
  localStorage.setItem(getUserStorageKey('chem_progress_updated_at'), new Date().toISOString());
  pkaUpdateDashboard();
}
function pkaUpdateDashboard() {
  var _chemMyData$dailyStat3;
  const listEl = document.getElementById('pka-stat-list');
  const totalEl = document.getElementById('pka-stat-total');
  const masteredEl = document.getElementById('pka-stat-mastered');
  const todayAttemptsEl = document.getElementById('pka-stat-today-attempts');
  const sevenDayAttemptsEl = document.getElementById('pka-stat-7day-attempts');
  const today = chemTodayKey();
  chemEnsureDailyStats();
  const todayAttempts = ((_chemMyData$dailyStat3 = chemMyData.dailyStats[today]) === null || _chemMyData$dailyStat3 === void 0 ? void 0 : _chemMyData$dailyStat3.attempted) || 0;
  let sevenDayAttempts = 0;
  const recentStart = chemRecentStartKey(7);
  if (chemMyData.dailyStats && typeof chemMyData.dailyStats === 'object') {
    for (const [date, stats] of Object.entries(chemMyData.dailyStats)) {
      if (date >= recentStart && stats) {
        sevenDayAttempts += stats.attempted || 0;
      }
    }
  }

  // Calculate mastered
  let masteredCount = 0;
  Object.values(pkaMyData.stats).forEach(s => {
    if (s.streak >= 3) masteredCount++;
  });
  if (listEl) listEl.innerHTML = `Compounds: <strong>${pkaMyData.myList.length}</strong>`;
  if (totalEl) totalEl.innerHTML = `Total: <strong>${pkaAllCompounds.length}</strong>`;
  if (masteredEl) masteredEl.innerHTML = `Mastered: <strong>${masteredCount}</strong>`;
  if (todayAttemptsEl) todayAttemptsEl.innerHTML = `Today: <strong>${todayAttempts}</strong>`;
  if (sevenDayAttemptsEl) sevenDayAttemptsEl.innerHTML = `7-Day: <strong>${sevenDayAttempts}</strong>`;
  pkaRenderTable();
}
function pkaRenderTable() {
  const tbody = document.getElementById('pka-table-body');
  if (!tbody) return;
  if (!pkaMyData.myList.length) {
    tbody.innerHTML = `<tr><td colspan="3" style="padding: 20px; text-align: center; color: var(--text3);">No compounds in your active list. Click "+ Add 5 Compounds" to start!</td></tr>`;
    return;
  }

  // Sort the active compounds by pKa values
  const activeCompounds = pkaMyData.myList.map(name => {
    return pkaAllCompounds.find(c => c.name === name);
  }).filter(Boolean).sort((a, b) => a.pka - b.pka);
  tbody.innerHTML = activeCompounds.map(c => {
    return `
      <tr style="border-bottom: 1px solid var(--border);">
        <td style="padding: 10px 14px; font-weight: 500; color: var(--text);">${escapeHtml(c.name)}</td>
        <td style="padding: 10px 14px; font-weight: 700; color: var(--accent);">${c.pka}</td>
        <td style="padding: 10px 14px; text-align: center;">
          <button class="chem-btn chem-btn-ghost" style="min-height: 24px; padding: 2px 8px; font-size: 11px; color: var(--red); border-color: transparent;" onclick="pkaRemoveCompound('${escapeHtml(c.name)}')">Remove</button>
        </td>
      </tr>
    `;
  }).join('');
}
function pkaRemoveCompound(name) {
  pkaMyData.myList = pkaMyData.myList.filter(n => n !== name);
  pkaSave();
  chemSyncAll(false);
}
function pkaLearnNew() {
  if (!pkaAppReady) return pkaInitApp().then(pkaLearnNew);
  const remaining = pkaAllCompounds.filter(c => !pkaMyData.myList.includes(c.name));
  if (!remaining.length) {
    chemShowFlash("All available compounds are already in your list.", false);
    return;
  }
  const remainingImportant = remaining.filter(c => c.important === true).sort(() => 0.5 - Math.random());
  const remainingUnimportant = remaining.filter(c => c.important !== true).sort(() => 0.5 - Math.random());
  const sortedRemaining = remainingImportant.concat(remainingUnimportant);
  const selected = sortedRemaining.slice(0, Math.min(5, sortedRemaining.length));
  selected.forEach(c => {
    pkaMyData.myList.push(c.name);
    pkaMyData.stats[c.name] = {
      wrong: 0,
      correct: 0,
      streak: 0,
      lastSeen: 0
    };
  });
  pkaSave();
  chemSyncAll(false);
  chemShowFlash(`Added: ${selected.map(s => s.name).join(', ')}`, false);
}
function pkaInitLearn() {
  if (!pkaMyData.myList.length) {
    chemShowFlash("Add compounds first.", false);
    return;
  }
  pkaLearnQueue = [...pkaMyData.myList].sort(() => 0.5 - Math.random());
  pkaLearnIdx = 0;
  pkaShowView('learn');
  pkaUpdateLearnCard();
}
function pkaShowView(id) {
  document.querySelectorAll('#pka-practice-content .chem-view').forEach(v => v.style.display = 'none');
  const view = document.getElementById('pka-view-' + id);
  if (view) view.style.display = 'block';
}
function pkaGoHome() {
  pkaShowView('home');
  chemSyncAll(false);
  pkaUpdateDashboard();
}
function pkaChangeLearn(dir) {
  if (!pkaLearnQueue.length) return;
  pkaLearnIdx += dir;
  if (pkaLearnIdx >= pkaLearnQueue.length) pkaLearnIdx = 0;
  if (pkaLearnIdx < 0) pkaLearnIdx = pkaLearnQueue.length - 1;
  pkaUpdateLearnCard();
}
function pkaUpdateLearnCard() {
  const name = pkaLearnQueue[pkaLearnIdx];
  const comp = pkaAllCompounds.find(c => c.name === name);
  if (!comp) return;
  const stat = pkaMyData.stats[name] || {
    correct: 0,
    wrong: 0,
    streak: 0
  };
  document.getElementById('pka-learn-progress').style.width = `${(pkaLearnIdx + 1) / pkaLearnQueue.length * 100}%`;
  document.getElementById('pka-learn-name').textContent = comp.name;
  document.getElementById('pka-learn-value').textContent = comp.pka;
  document.getElementById('pka-learn-index-text').textContent = `${pkaLearnIdx + 1} / ${pkaLearnQueue.length}`;
  document.getElementById('pka-learn-correct').textContent = stat.correct || 0;
  document.getElementById('pka-learn-wrong').textContent = stat.wrong || 0;
  document.getElementById('pka-learn-streak').textContent = stat.streak || 0;
}
function pkaInitPractice() {
  if (pkaMyData.myList.length < 2) {
    chemShowFlash("Please add at least 2 compounds to your list first!", false);
    return;
  }
  pkaShowView('practice');
  pkaPracticeSessionCount = 0;
  pkaPracticeCorrectCount = 0;
  pkaNextQuestion();
}
function pkaNextQuestion() {
  pkaPracticeSessionCount++;
  const progressPercent = Math.min(100, pkaPracticeSessionCount / 10 * 100);
  document.getElementById('pka-practice-progress').style.width = `${progressPercent}%`;
  const feedbackEl = document.getElementById('pka-practice-feedback');
  feedbackEl.style.display = 'none';
  document.getElementById('pka-next-question-btn').style.display = 'none';
  const targetName = UnifiedQuestionEngine.selectTarget(pkaMyData.myList, pkaMyData.stats, pkaLastPracticeName);
  if (!targetName) return;
  pkaLastPracticeName = targetName;
  const format = UnifiedQuestionEngine.decideFormat('pka', targetName, pkaMyData.stats);
  document.getElementById('pka-question-container').innerHTML = '';
  document.getElementById('pka-answer-container').innerHTML = '';
  if (format === 'type1') {
    pkaGenerateType1Question(targetName);
  } else if (format === 'type2') {
    pkaGenerateType2Question(targetName);
  } else {
    pkaGenerateType3Question(targetName);
  }
}
function pkaGenerateType1Question(targetName) {
  const compA = pkaAllCompounds.find(c => c.name === targetName);
  if (!compA) return;
  const sortedAll = [...pkaAllCompounds].sort((x, y) => x.pka - y.pka);
  const idxA = sortedAll.findIndex(c => c.name === targetName);
  const candidates = [];
  for (let offset = -4; offset <= 4; offset++) {
    if (offset === 0) continue;
    const targetIdx = idxA + offset;
    if (targetIdx >= 0 && targetIdx < sortedAll.length) {
      const candidate = sortedAll[targetIdx];
      if (candidate.pka !== compA.pka) {
        candidates.push(candidate);
      }
    }
  }
  let compB;
  if (candidates.length > 0) {
    compB = candidates[Math.floor(Math.random() * candidates.length)];
  } else {
    const otherCompounds = pkaAllCompounds.filter(c => c.name !== targetName && c.pka !== compA.pka);
    compB = otherCompounds[Math.floor(Math.random() * otherCompounds.length)];
  }
  pkaCurrentQuestion = {
    type: 1,
    target: compA,
    other: compB,
    correctName: compA.pka < compB.pka ? compA.name : compB.name,
    incorrectName: compA.pka < compB.pka ? compB.name : compA.name,
    pkaA: compA.pka,
    pkaB: compB.pka
  };
  document.getElementById('pka-question-container').innerHTML = `
    <div style="text-align: center; margin-bottom: 8px; font-weight: 700; font-size: 13px; color: var(--text3); text-transform: uppercase; letter-spacing: 0.5px;">Question Type: Relative Acidity</div>
    <h3 style="font-size: 18px; font-weight: 700; color: var(--text); text-align: center; line-height: 1.4; margin: 10px 0;">
      Which of the following compounds is <strong>more acidic</strong>?
    </h3>
  `;
  const options = [compA, compB].sort(() => 0.5 - Math.random());
  document.getElementById('pka-answer-container').innerHTML = `
    <div class="chem-options-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; width: 100%;">
      ${options.map(opt => `
        <button class="chem-btn chem-btn-secondary" style="padding: 16px; font-size: 14px; font-weight: 600; min-height: 70px; display: flex; align-items: center; justify-content: center; text-align: center;" onclick="pkaSubmitType1Answer('${escapeHtml(opt.name)}')">
          ${escapeHtml(opt.name)}
        </button>
      `).join('')}
    </div>
  `;
}
function pkaSubmitType1Answer(selectedName) {
  const q = pkaCurrentQuestion;
  if (!q) return;
  const isCorrect = selectedName === q.correctName;
  const msg = `Incorrect. <strong>${escapeHtml(q.correctName)}</strong> (pKa = ${q.correctName === q.target.name ? q.pkaA : q.pkaB}) is more acidic than <strong>${escapeHtml(q.incorrectName)}</strong> (pKa = ${q.incorrectName === q.target.name ? q.pkaA : q.pkaB}). (Remember: lower pKa means higher acidity!)`;
  pkaHandleAnswerResult(isCorrect, q.target.name, msg);
}
function pkaGenerateType2Question(targetName) {
  const compA = pkaAllCompounds.find(c => c.name === targetName);
  if (!compA) return;
  pkaCurrentQuestion = {
    type: 2,
    target: compA,
    correctPka: compA.pka
  };
  document.getElementById('pka-question-container').innerHTML = `
    <div style="text-align: center; margin-bottom: 8px; font-weight: 700; font-size: 13px; color: var(--text3); text-transform: uppercase; letter-spacing: 0.5px;">Question Type: Value Estimation</div>
    <h3 style="font-size: 18px; font-weight: 700; color: var(--text); text-align: center; line-height: 1.4; margin: 10px 0;">
      What is the pKa value of:<br/>
      <span style="color: var(--accent); font-size: 22px; display: inline-block; margin-top: 8px;">${escapeHtml(compA.name)}</span>
    </h3>
  `;
  document.getElementById('pka-answer-container').innerHTML = `
    <div style="display: flex; flex-direction: column; align-items: center; gap: 12px; width: 100%;">
      <input type="number" id="pka-typed-input" step="any" placeholder="Enter pKa value (e.g. 4.7)"
        style="width: 100%; max-width: 300px; text-align: center; padding: 12px; border: 2px solid var(--border); border-radius: 8px; background: var(--bg3); color: var(--text); font-family: 'DM Sans', sans-serif; font-size: 16px; font-weight: 700; outline: none; transition: border-color 0.2s;" />
      <button class="chem-btn chem-btn-primary" style="width: 100%; max-width: 300px; margin: 0;" onclick="pkaSubmitType2Answer()">
        Submit Answer
      </button>
    </div>
  `;
  setTimeout(() => {
    var _document$getElementB7;
    (_document$getElementB7 = document.getElementById('pka-typed-input')) === null || _document$getElementB7 === void 0 || _document$getElementB7.focus();
  }, 100);
}
function pkaSubmitType2Answer() {
  const q = pkaCurrentQuestion;
  if (!q) return;
  const inputEl = document.getElementById('pka-typed-input');
  if (!inputEl || inputEl.value.trim() === '') {
    chemShowFlash("Please enter a value.", false);
    return;
  }
  const typedVal = parseFloat(inputEl.value);
  const correctVal = q.correctPka;
  const isCorrect = Math.abs(typedVal - correctVal) <= 2.0;
  const msg = `Incorrect. The correct pKa of <strong>${escapeHtml(q.target.name)}</strong> is <strong>${correctVal}</strong>. You typed: ${typedVal}.`;
  pkaHandleAnswerResult(isCorrect, q.target.name, msg);
}
function pkaGenerateType3Question(targetName) {
  const activeList = pkaMyData.myList.filter(n => n !== targetName);
  let chosen = [targetName];
  if (activeList.length < 4) {
    const remaining = pkaAllCompounds.filter(c => !chosen.includes(c.name) && !activeList.includes(c.name));
    const pool = activeList.concat(remaining.map(c => c.name));
    const filled = pool.sort(() => 0.5 - Math.random()).slice(0, 4);
    chosen = chosen.concat(filled);
  } else {
    const filled = activeList.sort(() => 0.5 - Math.random()).slice(0, 4);
    chosen = chosen.concat(filled);
  }
  const compoundsObj = chosen.map(name => {
    return pkaAllCompounds.find(c => c.name === name);
  }).filter(Boolean);
  let shuffled = [...compoundsObj].sort(() => 0.5 - Math.random());
  let isSorted = true;
  for (let i = 0; i < shuffled.length - 1; i++) {
    if (shuffled[i].pka > shuffled[i + 1].pka) {
      isSorted = false;
      break;
    }
  }
  if (isSorted) {
    shuffled.reverse();
  }
  pkaSortingList = shuffled;
  pkaCurrentQuestion = {
    type: 3,
    compounds: compoundsObj
  };
  document.getElementById('pka-question-container').innerHTML = `
    <div style="text-align: center; margin-bottom: 8px; font-weight: 700; font-size: 13px; color: var(--text3); text-transform: uppercase; letter-spacing: 0.5px;">Question Type: Acidity Ordering</div>
    <h3 style="font-size: 16px; font-weight: 700; color: var(--text); text-align: center; line-height: 1.4; margin: 10px 0;">
      Arrange the compounds in order of <strong>decreasing acidity</strong>:<br/>
      <span style="font-size: 12px; font-weight: 500; color: var(--text3);">(Most acidic / lowest pKa at the top, least acidic at the bottom)</span>
    </h3>
  `;
  pkaRenderSortingList();
}
function pkaRenderSortingList() {
  const container = document.getElementById('pka-answer-container');
  if (!container) return;
  container.innerHTML = `
    <div id="pka-sortable-list" style="display: flex; flex-direction: column; gap: 8px; width: 100%;">
      ${pkaSortingList.map((comp, idx) => `
        <div class="pka-sortable-item" draggable="true" data-index="${idx}"
          style="display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; background: var(--bg3); border: 1px solid var(--border); border-radius: 8px; cursor: grab; user-select: none; transition: all 0.2s;"
          ondragstart="pkaDragStart(event)" ondragover="pkaDragOver(event)" ondrop="pkaDrop(event)" ondragend="pkaDragEnd(event)">
          <div style="display: flex; align-items: center; gap: 10px;">
            <span style="color: var(--text3); font-weight: bold; cursor: grab; font-size: 16px;">☰</span>
            <span style="font-size: 13px; font-weight: 600; color: var(--text);">${escapeHtml(comp.name)}</span>
          </div>
          <div style="display: flex; gap: 4px;">
            <button class="chem-btn chem-btn-ghost" style="min-height: 24px; width: 24px; padding: 0; font-size: 9px; margin: 0; display: flex; align-items: center; justify-content: center;" onclick="pkaMoveItem(${idx}, -1)">▲</button>
            <button class="chem-btn chem-btn-ghost" style="min-height: 24px; width: 24px; padding: 0; font-size: 9px; margin: 0; display: flex; align-items: center; justify-content: center;" onclick="pkaMoveItem(${idx}, 1)">▼</button>
          </div>
        </div>
      `).join('')}
    </div>
    <button class="chem-btn chem-btn-primary" style="width: 100%; margin-top: 8px;" onclick="pkaSubmitType3Answer()">
      Submit Ordering
    </button>
  `;
}

// Drag & Drop handlers
let pkaDraggedIndex = null;
function pkaDragStart(e) {
  pkaDraggedIndex = parseInt(e.currentTarget.getAttribute('data-index'));
  e.currentTarget.style.opacity = '0.5';
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', pkaDraggedIndex);
}
function pkaDragOver(e) {
  e.preventDefault();
}
function pkaDrop(e) {
  e.preventDefault();
  const targetIndex = parseInt(e.currentTarget.getAttribute('data-index'));
  if (pkaDraggedIndex !== null && pkaDraggedIndex !== targetIndex) {
    const item = pkaSortingList.splice(pkaDraggedIndex, 1)[0];
    pkaSortingList.splice(targetIndex, 0, item);
    pkaRenderSortingList();
  }
}
function pkaDragEnd(e) {
  e.currentTarget.style.opacity = '1';
  pkaDraggedIndex = null;
}
function pkaMoveItem(index, direction) {
  const newIndex = index + direction;
  if (newIndex >= 0 && newIndex < pkaSortingList.length) {
    const temp = pkaSortingList[index];
    pkaSortingList[index] = pkaSortingList[newIndex];
    pkaSortingList[newIndex] = temp;
    pkaRenderSortingList();
  }
}
function pkaSubmitType3Answer() {
  const q = pkaCurrentQuestion;
  if (!q) return;
  let isCorrect = true;
  for (let i = 0; i < pkaSortingList.length - 1; i++) {
    if (pkaSortingList[i].pka > pkaSortingList[i + 1].pka) {
      isCorrect = false;
      break;
    }
  }
  const correctSorted = [...pkaSortingList].sort((a, b) => a.pka - b.pka);
  const explanation = `
    <strong>Correct Ordering (most acidic to least acidic):</strong><br/>
    <ol style="margin: 8px 0 0 20px; padding: 0; text-align: left; font-size: 13px; line-height: 1.5;">
      ${correctSorted.map(c => `<li><strong>${escapeHtml(c.name)}</strong> (pKa = ${c.pka})</li>`).join('')}
    </ol>
  `;
  const activeCompoundNames = q.compounds.filter(c => pkaMyData.myList.includes(c.name)).map(c => c.name);
  pkaHandleAnswerResultMulti(isCorrect, activeCompoundNames, isCorrect ? "Correct!" : "Incorrect order. " + explanation);
}
function pkaHandleAnswerResult(isCorrect, targetCompoundName, messageText) {
  if (pkaMyData.stats[targetCompoundName]) {
    const s = pkaMyData.stats[targetCompoundName];
    if (isCorrect) {
      s.correct = (s.correct || 0) + 1;
      s.streak = (s.streak || 0) + 1;
      pkaPracticeCorrectCount++;
    } else {
      s.wrong = (s.wrong || 0) + 1;
      s.streak = 0;
    }
    s.lastSeen = Date.now();
  }
  const today = chemTodayKey();
  chemEnsureDailyStats();
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
  pkaSave();
  chemSyncAll(false);
  const feedbackEl = document.getElementById('pka-practice-feedback');
  feedbackEl.style.display = 'block';
  feedbackEl.style.background = isCorrect ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)';
  feedbackEl.style.color = isCorrect ? 'var(--green)' : 'var(--red)';
  feedbackEl.style.border = `1px solid ${isCorrect ? 'var(--green)' : 'var(--red)'}`;
  feedbackEl.innerHTML = isCorrect ? 'Correct!' : messageText;
  document.getElementById('pka-next-question-btn').style.display = 'block';
  chemShowFlash(isCorrect ? 'Correct' : 'Incorrect', !isCorrect);
}
function pkaHandleAnswerResultMulti(isCorrect, compoundNames, messageText) {
  compoundNames.forEach(name => {
    if (pkaMyData.stats[name]) {
      const s = pkaMyData.stats[name];
      if (isCorrect) {
        s.correct = (s.correct || 0) + 1;
        s.streak = (s.streak || 0) + 1;
      } else {
        s.wrong = (s.wrong || 0) + 1;
        s.streak = 0;
      }
      s.lastSeen = Date.now();
    }
  });
  if (isCorrect) {
    pkaPracticeCorrectCount++;
  }
  const today = chemTodayKey();
  chemEnsureDailyStats();
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
  pkaSave();
  chemSyncAll(false);
  const feedbackEl = document.getElementById('pka-practice-feedback');
  feedbackEl.style.display = 'block';
  feedbackEl.style.background = isCorrect ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)';
  feedbackEl.style.color = isCorrect ? 'var(--green)' : 'var(--red)';
  feedbackEl.style.border = `1px solid ${isCorrect ? 'var(--green)' : 'var(--red)'}`;
  feedbackEl.innerHTML = messageText;
  document.getElementById('pka-next-question-btn').style.display = 'block';
  chemShowFlash(isCorrect ? 'Correct' : 'Incorrect', !isCorrect);
}
function pkaShowStats(type) {
  const isWeak = type === 'weak';
  if (pkaMyData.myList.length === 0) {
    chemShowFlash("Add compounds first!", false);
    return;
  }
  const compStats = pkaMyData.myList.map(name => {
    const s = pkaMyData.stats[name] || {
      wrong: 0,
      correct: 0,
      streak: 0
    };
    const score = s.correct - s.wrong * 1.5 + s.streak * 0.5;
    const comp = pkaAllCompounds.find(c => c.name === name);
    return {
      name,
      stats: s,
      score,
      pka: comp ? comp.pka : 0
    };
  });
  if (isWeak) {
    compStats.sort((a, b) => a.score - b.score);
    document.getElementById('pka-stats-title').innerText = 'Weakest pKa Compounds';
  } else {
    compStats.sort((a, b) => b.score - a.score);
    document.getElementById('pka-stats-title').innerText = 'Strongest pKa Compounds';
  }
  const top = compStats.slice(0, 5);
  const listDiv = document.getElementById('pka-stats-list');
  listDiv.innerHTML = top.length ? top.map((item, i) => {
    return `<div class="chem-stat-row">
        <div class="chem-stat-name">
          ${i + 1}. <span style="color:var(--accent); font-weight:600;">${escapeHtml(item.name)}</span> (pKa: ${item.pka})
        </div>
        <div class="chem-stat-val">✓${item.stats.correct} ✗${item.stats.wrong} 🔥${item.stats.streak}</div>
      </div>`;
  }).join('') : '<div class="chem-stat-row"><span class="chem-stat-name">No data yet</span></div>';
  document.getElementById('pka-stats-sheet').classList.add('open');
}
function pkaCloseStats(event) {
  if (event.target.id === 'pka-stats-sheet') {
    document.getElementById('pka-stats-sheet').classList.remove('open');
  }
}
function toggleListEditor() {
  const root = document.getElementById('list-editor-root');
  const chevron = document.getElementById('list-editor-chevron');
  if (!root) return;
  const isHidden = root.style.display === 'none' || root.style.display === '';
  if (isHidden) {
    root.style.display = 'block';
    if (chevron) chevron.textContent = '▲';
    if (!listEditorLoaded) {
      renderListEditor();
      listEditorLoaded = true;
    }
  } else {
    root.style.display = 'none';
    if (chevron) chevron.textContent = '▼';
  }
}
window.toggleListEditor = toggleListEditor;
window.chemInitApp = chemInitApp;
window.pkaInitApp = pkaInitApp;
window.pkaLearnNew = pkaLearnNew;
window.pkaInitLearn = pkaInitLearn;
window.pkaChangeLearn = pkaChangeLearn;
window.pkaInitPractice = pkaInitPractice;
window.pkaGoHome = pkaGoHome;
window.pkaShowStats = pkaShowStats;
window.pkaCloseStats = pkaCloseStats;
window.pkaRemoveCompound = pkaRemoveCompound;
window.pkaSubmitType2Answer = pkaSubmitType2Answer;
window.pkaSubmitType3Answer = pkaSubmitType3Answer;
window.pkaNextQuestion = pkaNextQuestion;
window.pkaDragStart = pkaDragStart;
window.pkaDragOver = pkaDragOver;
window.pkaDrop = pkaDrop;
window.pkaDragEnd = pkaDragEnd;
window.pkaMoveItem = pkaMoveItem;
window.chemLearnNew = chemLearnNew;
window.chemInitLearn = chemInitLearn;
window.chemChangeLearn = chemChangeLearn;
window.chemInitPractice = chemInitPractice;
window.chemGoHome = chemGoHome;
window.chemUploadStats = chemSyncAll;
window.chemLoadLeaderboard = chemLoadLeaderboard;
window.chemUploadProgress = chemSyncAll;
window.chemDownloadProgress = chemDownloadProgress;
window.chemSyncAll = chemSyncAll;
window.chemExportData = chemExportData;
window.chemImportData = chemImportData;
window.chemShowStats = chemShowStats;
window.chemCloseStats = chemCloseStats;
window.showModeSelection = showModeSelection;
window.selectPracticeMode = selectPracticeMode;
window.reagentInitApp = reagentInitApp;
window.reagentLearnNew = reagentLearnNew;
window.reagentInitLearn = reagentInitLearn;
window.reagentChangeLearn = reagentChangeLearn;
window.reagentInitPractice = reagentInitPractice;
window.reagentGoHome = reagentGoHome;
window.reagentExportData = reagentExportData;
window.reagentImportData = reagentImportData;
window.reagentShowStats = reagentShowStats;
window.reagentCloseStats = reagentCloseStats;
setInterval(() => {
  if (document.visibilityState === 'visible') {
    chemSyncAll(false);
  }
}, 2 * 60 * 1000);
window.addEventListener('beforeunload', () => {
  chemSyncAll(false);
});
window.addEventListener('pagehide', () => {
  chemSyncAll(false);
});
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') chemSyncAll(false);
});
