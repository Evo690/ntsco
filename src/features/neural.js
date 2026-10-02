let rankModel = null;
let rankMeta = null;
let rankLoadingPromise = null;
const neuralScriptLoads = new Map();
function loadScript(url) {
  if (neuralScriptLoads.has(url)) return neuralScriptLoads.get(url);
  const promise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = url;
    script.onload = resolve;
    script.onerror = () => { script.remove(); neuralScriptLoads.delete(url); reject(new Error('Model dependency unavailable. Check your connection and retry.')); };
    document.head.appendChild(script);
  });
  neuralScriptLoads.set(url,promise);
  return promise;
}
function showLabNotice(message, target = 'rank') {
  const status = document.getElementById(`${target}-feedback`);
  if (status) status.textContent = message;
}
async function retryRankModel(button) {
  if (button) button.disabled = true;
  try { await initRankPredictor(); }
  catch (_) { /* The runtime status already displays the failure. */ }
  finally { if (button) button.disabled = false; }
}
async function initRankPredictor() {
  if (rankModel && rankMeta) return { model: rankModel, meta: rankMeta };
  if (rankLoadingPromise) return rankLoadingPromise;

  rankLoadingPromise = (async () => {
    const dot = document.getElementById("rank-dot");
    const stat = document.getElementById("rank-status");
    const btn = document.getElementById("rank-predict-btn");
    try {
      if (dot) dot.className = "rank-dot loading";
      if (stat) stat.textContent = "Loading TensorFlow.js...";
      if (typeof tf === 'undefined') {
        await loadScript("https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.17.0/dist/tf.min.js");
      }
      if (stat) stat.textContent = "Loading model...";
      const [model, meta] = await Promise.all([
        tf.loadLayersModel("models/ranknet/model.json"),
        fetch("models/ranknet/meta.json").then(r => r.json())
      ]);
      rankModel = model;
      rankMeta = meta;
      if (window.pseudoLeaderboardEngine) {
        window.pseudoLeaderboardEngine.setModel(model, meta);
      }
      if (dot) dot.className = "rank-dot ready";
      if (stat) stat.textContent = "Model ready ✓";
      if (btn) btn.disabled = false;
      return { model, meta };
    } catch (e) {
      if (dot) dot.className = "rank-dot error";
      if (stat) stat.textContent = "Failed to load: " + e.message;
      console.error("RankPredictor load error:", e);
      throw e;
    } finally {
      rankLoadingPromise = null;
    }
  })();

  return rankLoadingPromise;
}
function estimateTopper(avg, maxMarks) {
  if (!rankMeta || !rankMeta.stat_constants) return maxMarks;
  const {
    slope_tgn,
    intercept_tgn
  } = rankMeta.stat_constants;
  const difficulty = avg / maxMarks;
  const topperGapNorm = slope_tgn * difficulty + intercept_tgn;
  const topper = avg + topperGapNorm * maxMarks;
  return Math.min(maxMarks, Math.max(avg + 1, topper));
}

function dynamicK(difficulty) {
  if (!rankMeta || !rankMeta.stat_constants) return 1.0;
  const {
    slope_k,
    intercept_k
  } = rankMeta.stat_constants;
  return slope_k * difficulty + intercept_k;
}

function normalizeRankInput(score, avg, maxMarks) {
  const difficulty = avg / maxMarks;
  const topper = estimateTopper(avg, maxMarks);
  const k = Math.max(0.1, dynamicK(difficulty));
  const gap = Math.max(1.0, topper - avg);
  const sigma = Math.max(0.1, gap / k);
  const z = (score - avg) / sigma;
  let x_norm = gap > 0 ? (score - avg) / gap : 0.0;
  const rawX = x_norm;
  x_norm = Math.max(0.01, Math.min(x_norm, 1.0));
  const maxMarks_ref = (rankMeta && rankMeta.maxMarks_ref) || 300.0;
  const maxMarks_norm = maxMarks / maxMarks_ref;
  return {
    z,
    x_norm,
    rawX,
    difficulty,
    maxMarks_norm,
    topper,
    k,
    sigma
  };
}

async function predictRank() {
  const btn = document.getElementById("rank-predict-btn");
  const originalText = btn ? btn.textContent : "Run prediction";
  showLabNotice('');

  try {
    if (!rankModel || !rankMeta) {
      if (btn) btn.textContent = "Loading Model...";
      await initRankPredictor();
    }
    if (!rankModel) {
      showLabNotice("Neural network model could not be loaded. Please check your internet connection.");
      return;
    }

    const score = parseFloat(document.getElementById("inp-score")?.value);
    const maxM = parseFloat(document.getElementById("inp-max")?.value);
    const avg = parseFloat(document.getElementById("inp-avg")?.value);
    const N_in = parseFloat(document.getElementById("inp-N")?.value);

    if (isNaN(score) || isNaN(maxM) || isNaN(avg)) {
      showLabNotice("Please fill in score, max marks and overall average.");
      return;
    }
    if (avg >= maxM) {
      showLabNotice("Average cannot exceed maximum marks.");
      return;
    }
    if (score < 0) {
      showLabNotice("Score cannot be negative.");
      return;
    }

    const {
      z,
      x_norm,
      rawX,
      difficulty,
      maxMarks_norm,
      topper,
      k,
      sigma
    } = normalizeRankInput(score, avg, maxM);

    const z_sq = Math.tanh(z / 3.0);
    let pct = null;

    // Run TF.js inference
    try {
      const input = tf.tensor2d([[z, x_norm, difficulty, maxMarks_norm]]);
      const output = rankModel.predict(input);
      const data = await output.data();
      input.dispose();
      output.dispose();
      if (data && !isNaN(data[0])) {
        pct = Math.max(0.01, Math.min(99.99, data[0] * 100.0));
      }
    } catch (e) {
      console.warn("TensorFlow prediction failed, using sigmoid fallback:", e);
    }

    // High-accuracy statistical sigmoid fallback if TF output failed
    if (pct === null || isNaN(pct)) {
      const fallbackY = 1.0 / (1.0 + Math.exp(-z * 1.6));
      pct = Math.max(0.01, Math.min(99.99, fallbackY * 100.0));
    }

    const hasN = !isNaN(N_in) && N_in > 0;
    const gap = score - avg;

    // ── Update stats ──────────────────────────────────────────────────────────
    const rPct = document.getElementById("r-pct");
    const rProg = document.getElementById("r-prog");
    const rRank = document.getElementById("r-rank");
    const rRankSub = document.getElementById("r-rank-sub");
    const rTopper = document.getElementById("r-topper");
    const rDiff = document.getElementById("r-diff");
    const rGap = document.getElementById("r-gap");

    if (rPct) rPct.textContent = pct.toFixed(2) + "%";
    if (rProg) rProg.style.width = Math.min(pct, 100).toFixed(1) + "%";
    if (hasN) {
      const rank = Math.max(1, Math.round(N_in * (1.0 - pct / 100.0)));
      if (rRank) rRank.textContent = "~" + rank;
      if (rRankSub) rRankSub.textContent = "out of " + Math.round(N_in);
    } else {
      if (rRank) rRank.textContent = "—";
      if (rRankSub) rRankSub.textContent = "(Enter Total Students for rank)";
    }
    if (rTopper) rTopper.textContent = Math.round(topper);
    if (rDiff) rDiff.textContent = (difficulty * 100).toFixed(1) + "%";
    if (rGap) rGap.textContent = (gap >= 0 ? "+" : "") + gap.toFixed(0);

    // ── Update pipeline ───────────────────────────────────────────────────────
    const hasStats = !!(rankMeta && rankMeta.stat_constants);
    const tgn = hasStats ? rankMeta.stat_constants.slope_tgn * difficulty + rankMeta.stat_constants.intercept_tgn : null;
    const pDiff = document.getElementById("p-diff");
    const pTgn = document.getElementById("p-tgn");
    const pTopper = document.getElementById("p-topper");
    const pK = document.getElementById("p-k");
    const pSigma = document.getElementById("p-sigma");
    const pZ = document.getElementById("p-z");
    const pXnorm = document.getElementById("p-xnorm");
    const pPct = document.getElementById("p-pct");

    if (pDiff) pDiff.textContent = difficulty.toFixed(4);
    if (pTgn) pTgn.textContent = tgn !== null ? tgn.toFixed(4) : "—";
    if (pTopper) pTopper.textContent = Math.round(topper) + " / " + maxM;
    if (pK) pK.textContent = k.toFixed(4);
    if (pSigma) pSigma.textContent = sigma.toFixed(4);
    if (pZ) pZ.textContent = z.toFixed(4) + " → squashed: " + z_sq.toFixed(4);
    if (pXnorm) pXnorm.textContent = rawX.toFixed(4) + " → " + x_norm.toFixed(4);
    if (pPct) pPct.textContent = pct.toFixed(3) + "%";

    // ── Alerts ────────────────────────────────────────────────────────────────
    const alLow = document.getElementById("al-low");
    const alOver = document.getElementById("al-over");
    const alExtrap = document.getElementById("al-extrap");
    const alGood = document.getElementById("al-good");

    if (alLow) alLow.style.display = rawX <= 0.05 ? "block" : "none";
    if (alOver) alOver.style.display = rawX > 1.0 ? "block" : "none";
    if (alExtrap) alExtrap.style.display = difficulty < 0.248 || difficulty > 0.594 ? "block" : "none";
    if (alGood) alGood.style.display = rawX > 0.25 && rawX <= 1.0 && difficulty >= 0.248 && difficulty <= 0.594 ? "block" : "none";

    const rankResult = document.getElementById("rank-result");
    if (rankResult) {
      rankResult.style.display = "block";
      rankResult.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    }
  } catch (err) {
    console.error("predictRank failed:", err);
    showLabNotice("Prediction error: " + err.message);
  } finally {
    if (btn) btn.textContent = originalText;
  }
}
window.predictRank = predictRank;

/* ══════════════════════════════════════════════════════════════
   PSEUDO-LEADERBOARD CONTROLLER & UI
   ══════════════════════════════════════════════════════════════ */
const PL_STATE = {
  anchorIdSeq: 0,
  anchors: [],
  fullLeaderboard: [],
  filteredLeaderboard: [],
  currentFilter: 'all',
  currentPage: 1,
  pageSize: 50,
  searchRank: null,
  generationMode: 'one-pass', // 'one-pass' | 'multi-pass' | 'per-rank'
  multiPasses: 5,
  batchStats: {
    avg: 122.5,
    topper: 275,
    maxMarks: 300
  }
};

function getPLGenerationMode() {
  const saved = localStorage.getItem(getUserStorageKey('pl_generation_mode'));
  if (['one-pass', 'multi-pass', 'per-rank'].includes(saved)) {
    return saved;
  }
  return 'one-pass';
}

function setPLGenerationMode(mode) {
  if (!['one-pass', 'multi-pass', 'per-rank'].includes(mode)) return;
  PL_STATE.generationMode = mode;
  localStorage.setItem(getUserStorageKey('pl_generation_mode'), mode);
  if (window.pseudoLeaderboardEngine) {
    window.pseudoLeaderboardEngine.setMode(mode);
  }
  updatePLModeUI(mode);
}

function getPLPassesCount() {
  const saved = parseInt(localStorage.getItem(getUserStorageKey('pl_multi_passes')), 10);
  if (!isNaN(saved) && saved >= 2 && saved <= 20) {
    return saved;
  }
  return 5;
}

function setPLPassesCount(val) {
  const num = Math.max(2, Math.min(20, parseInt(val, 10) || 5));
  PL_STATE.multiPasses = num;
  localStorage.setItem(getUserStorageKey('pl_multi_passes'), num);
  updatePLPassesUI(num);
}

function updatePLPassesUI(count) {
  const num = count || PL_STATE.multiPasses || getPLPassesCount();
  PL_STATE.multiPasses = num;

  const cardSlider = document.getElementById('pl-card-passes-slider');
  const cardBadge = document.getElementById('pl-card-passes-badge');
  if (cardSlider) cardSlider.value = num;
  if (cardBadge) cardBadge.textContent = `${num}x passes`;
}

function updatePLModeUI(mode) {
  const activeMode = mode || PL_STATE.generationMode || getPLGenerationMode();
  PL_STATE.generationMode = activeMode;

  // Update card chips
  document.querySelectorAll('#pl-card-mode-chips .pl-card-mode-chip').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.mode === activeMode);
    btn.setAttribute('aria-pressed', String(btn.dataset.mode === activeMode));
  });

  // Show/hide passes slider based on activeMode === 'multi-pass'
  const cardPassesWrap = document.getElementById('pl-card-passes-slider-wrap');
  if (cardPassesWrap) {
    cardPassesWrap.style.display = activeMode === 'multi-pass' ? 'block' : 'none';
  }
}

function initPseudoLeaderboardUI() {
  const avgInp = document.getElementById('pl-avg');
  const topperInp = document.getElementById('pl-topper');
  const maxInp = document.getElementById('pl-max');
  if (!avgInp || !topperInp || !maxInp) return;

  if (!avgInp.value) avgInp.value = PL_STATE.batchStats.avg;
  if (!topperInp.value) topperInp.value = PL_STATE.batchStats.topper;
  if (!maxInp.value) maxInp.value = PL_STATE.batchStats.maxMarks;

  PL_STATE.generationMode = getPLGenerationMode();
  PL_STATE.multiPasses = getPLPassesCount();
  if (window.pseudoLeaderboardEngine) {
    window.pseudoLeaderboardEngine.setMode(PL_STATE.generationMode);
  }
  updatePLModeUI(PL_STATE.generationMode);
  updatePLPassesUI(PL_STATE.multiPasses);

  const anchorListEl = document.getElementById('pl-anchor-list');
  if (anchorListEl && (!PL_STATE.anchors || PL_STATE.anchors.length === 0)) {
    resetAnchorsToDefault();
  }
  updateAnchorNCalculation();
}

function resetAnchorsToDefault() {
  PL_STATE.anchors = [
    { id: ++PL_STATE.anchorIdSeq, rank: 63, marks: 208, percentile: 89.51 }
  ];
  renderAnchorRows();
  updateAnchorNCalculation();
}

function addAnchorPointRow(rank = '', marks = '', percentile = '') {
  PL_STATE.anchors.push({
    id: ++PL_STATE.anchorIdSeq,
    rank: rank !== '' ? Number(rank) : '',
    marks: marks !== '' ? Number(marks) : '',
    percentile: percentile !== '' ? Number(percentile) : ''
  });
  renderAnchorRows();
  updateAnchorNCalculation();
}

function removeAnchorPointRow(id) {
  PL_STATE.anchors = PL_STATE.anchors.filter(a => a.id !== id);
  renderAnchorRows();
  updateAnchorNCalculation();
}

function clearAllAnchors() {
  PL_STATE.anchors = [];
  renderAnchorRows();
  updateAnchorNCalculation();
}



function renderAnchorRows() {
  const container = document.getElementById('pl-anchor-list');
  const countBadge = document.getElementById('pl-anchor-count-badge');
  if (!container) return;

  const topperVal = Number.parseFloat(document.getElementById('pl-topper')?.value);
  const count = PL_STATE.anchors.length;
  if (countBadge) countBadge.textContent = `${count + 1} anchors`;
  container.innerHTML = `<div class="lab-anchor-benchmark"><span>PINNED / #1</span><strong>${Number.isFinite(topperVal) ? Math.round(topperVal) : '—'} marks</strong><span>100%</span></div><div class="lab-anchor-columns"><span>Rank</span><span>Marks</span><span>Percentile</span><span></span></div>` + PL_STATE.anchors.map(anchor => {
    const estimate = anchor.rank && anchor.percentile > 0 && anchor.percentile < 100 ? Math.round(anchor.rank/(1-anchor.percentile/100)) : null;
    return `<div class="lab-anchor-record"><div class="lab-anchor-row">${[['rank','Rank'],['marks','Marks'],['percentile','Percentile']].map(([key,label])=>`<input type="number" aria-label="${label} for anchor ${anchor.id}" placeholder="${label}" step="any" value="${escapeHtml(anchor[key] ?? '')}" oninput="handleAnchorChange(${anchor.id}, '${key}', this.value)">`).join('')}<button class="console-button" title="Remove anchor" aria-label="Remove anchor ${anchor.id}" onclick="removeAnchorPointRow(${anchor.id})">×</button></div>${estimate ? `<small>Implied candidate count / ${estimate}</small>` : ''}</div>`;
  }).join('');
}

function handleAnchorChange(id, field, value) {
  const anchor = PL_STATE.anchors.find(a => a.id === id);
  if (anchor) {
    anchor[field] = value !== '' ? Number(value) : '';
  }
  updateAnchorNCalculation();
}

function updateAnchorNCalculation() {
  const badge = document.getElementById('pl-calculated-n-badge');
  const overrideInput = document.getElementById('pl-n-override-val');

  let n = 0;
  if (overrideInput && overrideInput.value) {
    n = Math.round(Number(overrideInput.value));
    if (badge) badge.textContent = `Manual N: ${n}`;
    return n;
  }

  const validAnchors = PL_STATE.anchors.filter(a => a.rank && a.percentile && a.percentile > 0 && a.percentile < 100);
  if (validAnchors.length > 0) {
    const estimates = validAnchors.map(a => a.rank / (1.0 - a.percentile / 100.0)).filter(e => e > 0 && isFinite(e));
    if (estimates.length > 0) {
      estimates.sort((a, b) => a - b);
      n = Math.max(10, Math.round(estimates[Math.floor(estimates.length / 2)]));
    }
  }

  if (badge) {
    badge.textContent = n > 0 ? `Est. cohort: ~${n} students` : 'Auto-computed from percentile';
  }
  return n;
}

function loadSampleLeaderboardData() {
  const avgInp = document.getElementById('pl-avg');
  const topperInp = document.getElementById('pl-topper');
  const maxInp = document.getElementById('pl-max');
  if (avgInp) avgInp.value = 122.5;
  if (topperInp) topperInp.value = 275;
  if (maxInp) maxInp.value = 300;

  PL_STATE.anchors = [
    { id: ++PL_STATE.anchorIdSeq, rank: 63, marks: 208, percentile: 89.51 }
  ];
  renderAnchorRows();
  updateAnchorNCalculation();
}

function syncPredictorToLeaderboard() {
  const pScore = parseFloat(document.getElementById('inp-score')?.value);
  const pMax = parseFloat(document.getElementById('inp-max')?.value);
  const pAvg = parseFloat(document.getElementById('inp-avg')?.value);
  const pN = parseFloat(document.getElementById('inp-N')?.value);

  if (!isNaN(pAvg)) document.getElementById('pl-avg').value = pAvg;
  if (!isNaN(pMax)) document.getElementById('pl-max').value = pMax;

  const topperEl = document.getElementById('r-topper');
  if (topperEl && topperEl.textContent && !isNaN(parseFloat(topperEl.textContent))) {
    document.getElementById('pl-topper').value = Math.round(parseFloat(topperEl.textContent));
  }

  const pctEl = document.getElementById('r-pct');
  const rankEl = document.getElementById('r-rank');
  let pct = pctEl ? parseFloat(pctEl.textContent) : NaN;
  let rank = rankEl ? parseInt(rankEl.textContent.replace(/\D/g, '')) : NaN;

  if (!isNaN(pScore)) {
    PL_STATE.anchors = [
      {
        id: ++PL_STATE.anchorIdSeq,
        rank: !isNaN(rank) && rank > 0 ? rank : 50,
        marks: Math.round(pScore),
        percentile: !isNaN(pct) && pct > 0 ? Number(pct.toFixed(2)) : 90.0
      }
    ];
  }

  if (!isNaN(pN) && pN > 0) {
    const overrideInput = document.getElementById('pl-n-override-val');
    if (overrideInput) overrideInput.value = Math.round(pN);
  }

  renderAnchorRows();
  updateAnchorNCalculation();
}

function syncLeaderboardToPredictor() {
  const plAvg = parseFloat(document.getElementById('pl-avg')?.value);
  const plMax = parseFloat(document.getElementById('pl-max')?.value);
  const plN = parseFloat(document.getElementById('pl-n-override-val')?.value);
  const topper = parseFloat(document.getElementById('pl-topper')?.value);

  const inpAvg = document.getElementById('inp-avg');
  const inpMax = document.getElementById('inp-max');
  const inpN = document.getElementById('inp-N');
  const inpScore = document.getElementById('inp-score');

  if (!isNaN(plAvg) && inpAvg) inpAvg.value = plAvg;
  if (!isNaN(plMax) && inpMax) inpMax.value = plMax;
  if (!isNaN(plN) && plN > 0 && inpN) inpN.value = Math.round(plN);
  if (!isNaN(topper) && inpScore && (!inpScore.value || inpScore.value === '')) {
    inpScore.value = Math.round(topper * 0.82);
  }
}

function loadExamPreset(preset) {
  const avgInp = document.getElementById('pl-avg');
  const topperInp = document.getElementById('pl-topper');
  const maxInp = document.getElementById('pl-max');
  const nInp = document.getElementById('pl-n-override-val');

  if (preset === 'jee-main') {
    if (avgInp) avgInp.value = 122.5;
    if (topperInp) topperInp.value = 275;
    if (maxInp) maxInp.value = 300;
    if (nInp) nInp.value = 850;
    PL_STATE.anchors = [
      { id: ++PL_STATE.anchorIdSeq, rank: 63, marks: 208, percentile: 89.51 },
      { id: ++PL_STATE.anchorIdSeq, rank: 140, marks: 172, percentile: 79.20 }
    ];
  } else if (preset === 'jee-adv') {
    if (avgInp) avgInp.value = 68.0;
    if (topperInp) topperInp.value = 152;
    if (maxInp) maxInp.value = 180;
    if (nInp) nInp.value = 600;
    PL_STATE.anchors = [
      { id: ++PL_STATE.anchorIdSeq, rank: 35, marks: 124, percentile: 94.17 },
      { id: ++PL_STATE.anchorIdSeq, rank: 110, marks: 95, percentile: 81.67 }
    ];
  }
  renderAnchorRows();
  updateAnchorNCalculation();
}

async function generateLeaderboardFromUI() {
  showLabNotice('', 'pl');
  const avg = parseFloat(document.getElementById('pl-avg')?.value);
  const topper = parseFloat(document.getElementById('pl-topper')?.value);
  const maxMarks = parseFloat(document.getElementById('pl-max')?.value) || 300;

  if (isNaN(avg) || isNaN(topper)) {
    showLabNotice("Please fill in batch average marks and topper marks.", 'pl');
    return;
  }
  if (topper <= avg) {
    showLabNotice("Topper marks must be strictly greater than average marks.", 'pl');
    return;
  }
  if (topper > maxMarks) {
    showLabNotice("Topper marks cannot exceed total maximum marks.", 'pl');
    return;
  }

  const validAnchors = PL_STATE.anchors.filter(a => a.rank > 0 && a.marks != null && !isNaN(a.marks));
  if (validAnchors.length === 0) {
    showLabNotice("Please provide at least 1 valid student anchor point.", 'pl');
    return;
  }

  const overrideVal = parseFloat(document.getElementById('pl-n-override-val')?.value);

  const btn = document.getElementById('pl-generate-btn');
  const originalBtnHtml = btn ? btn.innerHTML : '';
  if (btn) {
    btn.disabled = true;
    btn.textContent = "Generating...";
  }

  try {
    if (!window.pseudoLeaderboardEngine) {
      window.pseudoLeaderboardEngine = new PseudoLeaderboardEngine();
    }
    if (rankModel && rankMeta) {
      window.pseudoLeaderboardEngine.setModel(rankModel, rankMeta);
    } else {
      await initRankPredictor();
      if (rankModel && rankMeta) {
        window.pseudoLeaderboardEngine.setModel(rankModel, rankMeta);
      }
    }

    const leaderboard = await window.pseudoLeaderboardEngine.generateLeaderboard({
      avg,
      topper,
      maxMarks,
      anchorPoints: validAnchors,
      overrideN: overrideVal && !isNaN(overrideVal) ? overrideVal : null,
      mode: PL_STATE.generationMode || getPLGenerationMode(),
      numPasses: PL_STATE.multiPasses || getPLPassesCount()
    });

    PL_STATE.fullLeaderboard = leaderboard;
    PL_STATE.currentPage = 1;
    PL_STATE.currentFilter = 'all';
    PL_STATE.searchRank = null;
    const searchInput = document.getElementById('pl-search-rank');
    if (searchInput) searchInput.value = '';

    const totalN = leaderboard.length;
    const anchorCount = leaderboard.filter(r => r.isAnchor).length;

    const metricN = document.getElementById('pl-metric-n');
    const metricTopper = document.getElementById('pl-metric-topper');
    const metricDiff = document.getElementById('pl-metric-diff');
    const metricAnchors = document.getElementById('pl-metric-anchors');

    if (metricN) metricN.textContent = totalN;
    if (metricTopper) metricTopper.textContent = Math.round(topper);
    if (metricDiff) metricDiff.textContent = Number(avg.toFixed(2));
    if (metricAnchors) metricAnchors.textContent = anchorCount;

    // Update Model & Latency Indicator Banner
    const runMeta = leaderboard.meta || window.pseudoLeaderboardEngine?.lastRunMeta || {};
    const modelUsedEl = document.getElementById('pl-model-used');
    const modelDotEl = document.getElementById('pl-model-dot');
    const modeBadgeEl = document.getElementById('pl-mode-used-badge');
    const timeTakenEl = document.getElementById('pl-time-taken');

    if (modelUsedEl) modelUsedEl.textContent = runMeta.modelName || 'RankNet (Model B)';
    if (modelDotEl) {
      modelDotEl.style.background = runMeta.isNeural !== false ? '#22c55e' : '#f59e0b';
      modelDotEl.title = runMeta.isNeural !== false ? 'RankNet Model Active' : 'Statistical Fallback Active';
    }
    if (modeBadgeEl) {
      const passesText = runMeta.passes ? ` (${runMeta.passes}x)` : '';
      const modeLabel = runMeta.mode === 'per-rank' ? 'Per Rank' : (runMeta.mode === 'multi-pass' ? `More Passes${passesText}` : '1-Pass');
      modeBadgeEl.textContent = modeLabel;
    }
    if (timeTakenEl) {
      timeTakenEl.textContent = `${runMeta.timeMs != null ? runMeta.timeMs : '—'} ms`;
    }

    const resSec = document.getElementById('pl-results-section');
    if (resSec) resSec.style.display = 'block';

    applyLeaderboardFilters();

    if (resSec) {
      resSec.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  } catch (err) {
    console.error("Leaderboard generation failed:", err);
    showLabNotice("Error generating pseudo-leaderboard: " + err.message, 'pl');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = originalBtnHtml;
    }
  }
}

function setLeaderboardFilter(filter) {
  PL_STATE.currentFilter = filter;
  PL_STATE.currentPage = 1;

  document.querySelectorAll('.pl-f-chip').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.filter === filter);
  });

  applyLeaderboardFilters();
}

function handleRankSearch(query) {
  const rank = parseInt(query);
  if (!isNaN(rank) && rank > 0) {
    PL_STATE.searchRank = rank;
  } else {
    PL_STATE.searchRank = null;
  }
  PL_STATE.currentPage = 1;
  applyLeaderboardFilters();
}

function applyLeaderboardFilters() {
  document.querySelectorAll('.pl-f-chip').forEach(button => {
    const selected = button.dataset.filter === PL_STATE.currentFilter;
    button.classList.toggle('active', selected);
    button.setAttribute('aria-pressed', String(selected));
  });
  let list = PL_STATE.fullLeaderboard;

  if (PL_STATE.searchRank) {
    list = list.filter(r => r.rank === PL_STATE.searchRank);
  } else {
    if (PL_STATE.currentFilter === 'anchors') {
      list = list.filter(r => r.isAnchor);
    } else if (PL_STATE.currentFilter === 'top20') {
      list = list.slice(0, 20);
    } else if (PL_STATE.currentFilter === 'top50') {
      list = list.slice(0, 50);
    }
  }

  PL_STATE.filteredLeaderboard = list;
  renderLeaderboardTable();
}

function renderLeaderboardTable() {
  const tbody = document.getElementById('pl-table-tbody');
  const info = document.getElementById('pl-page-info');
  const prevBtn = document.getElementById('pl-prev-page-btn');
  const nextBtn = document.getElementById('pl-next-page-btn');
  const currSpan = document.getElementById('pl-page-curr');
  if (!tbody) return;

  const total = PL_STATE.filteredLeaderboard.length;

  if (total === 0) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; padding: 20px; color: var(--text3);">No records found.</td></tr>`;
    if (info) info.textContent = `Showing 0 of 0`;
    if (prevBtn) prevBtn.disabled = true;
    if (nextBtn) nextBtn.disabled = true;
    if (currSpan) currSpan.textContent = `Page 1`;
    return;
  }

  const pageSize = 50;
  const totalPages = Math.ceil(total / pageSize);
  PL_STATE.currentPage = Math.max(1, Math.min(PL_STATE.currentPage, totalPages));

  const start = (PL_STATE.currentPage - 1) * pageSize;
  const end = Math.min(start + pageSize, total);
  const pageItems = PL_STATE.filteredLeaderboard.slice(start, end);

  const runMeta = PL_STATE.fullLeaderboard?.meta || window.pseudoLeaderboardEngine?.lastRunMeta || {};
  const predLabel = runMeta.isNeural !== false
    ? (runMeta.mode === 'per-rank' ? 'RankNet (Per-Rank)' : (runMeta.mode === 'multi-pass' ? 'RankNet (Multi)' : 'RankNet (1-Pass)'))
    : 'Fallback';

  tbody.innerHTML = pageItems.map(row => {
    let badge = `<span class="pl-badge pl-badge-pred">${predLabel}</span>`;
    if (row.rank === 1) {
      badge = `<span class="pl-badge pl-badge-topper">Topper</span>`;
    } else if (row.isAnchor) {
      badge = `<span class="pl-badge pl-badge-anchor">Anchor</span>`;
    }

    const rankContent = `#${row.rank}`;

    return `
      <tr>
        <td class="leaderboard-rank">${rankContent}</td>
        <td class="leaderboard-score">${row.marks}</td>
        <td style="font-family:'Space Mono',monospace;font-size:11.5px;color:var(--text2);">${row.percentile.toFixed(2)}%</td>
        <td>${badge}</td>
      </tr>
    `;
  }).join('');

  if (info) info.textContent = `Showing ${start + 1}-${end} of ${total}`;
  if (prevBtn) prevBtn.disabled = PL_STATE.currentPage <= 1;
  if (nextBtn) nextBtn.disabled = PL_STATE.currentPage >= totalPages;
  if (currSpan) currSpan.textContent = `Page ${PL_STATE.currentPage} / ${totalPages}`;
}

function changeLeaderboardPage(delta) {
  PL_STATE.currentPage += delta;
  renderLeaderboardTable();
}

function exportLeaderboardToCSV() {
  if (!PL_STATE.fullLeaderboard || PL_STATE.fullLeaderboard.length === 0) {
    showLabNotice("Generate a leaderboard before exporting.", "pl");
    return;
  }
  let csv = "Rank,Marks,Percentile,Status\n";
  PL_STATE.fullLeaderboard.forEach(r => {
    csv += `${r.rank},${r.marks},${r.percentile},${r.isAnchor ? 'Anchor' : 'Predicted'}\n`;
  });
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `pseudo_leaderboard_N${PL_STATE.fullLeaderboard.length}.csv`;
  link.click();
}

// Window exports
window.initPseudoLeaderboardUI = initPseudoLeaderboardUI;
window.resetAnchorsToDefault = resetAnchorsToDefault;
window.addAnchorPointRow = addAnchorPointRow;
window.removeAnchorPointRow = removeAnchorPointRow;
window.clearAllAnchors = clearAllAnchors;
window.handleAnchorChange = handleAnchorChange;
window.updateAnchorNCalculation = updateAnchorNCalculation;
window.loadSampleLeaderboardData = loadSampleLeaderboardData;
window.loadExamPreset = loadExamPreset;
window.syncPredictorToLeaderboard = syncPredictorToLeaderboard;
window.syncLeaderboardToPredictor = syncLeaderboardToPredictor;
window.generateLeaderboardFromUI = generateLeaderboardFromUI;
window.setLeaderboardFilter = setLeaderboardFilter;
window.handleRankSearch = handleRankSearch;
window.changeLeaderboardPage = changeLeaderboardPage;
window.exportLeaderboardToCSV = exportLeaderboardToCSV;
window.setPLGenerationMode = setPLGenerationMode;
window.getPLGenerationMode = getPLGenerationMode;
window.updatePLModeUI = updatePLModeUI;
window.setPLPassesCount = setPLPassesCount;
window.getPLPassesCount = getPLPassesCount;
window.updatePLPassesUI = updatePLPassesUI;

window.generatePseudoLeaderboardFromResult = async function generatePseudoLeaderboardFromResult() {
  const current = APP_STATE.currentResult;
  if (!current || !current.analysis) {
    alert("No active exam result found. Please open an exam result first.");
    return;
  }

  const analysis = current.analysis || {};
  const r = analysis.result || {};

  // 1. Student's own score, rank, percentile
  const studentMarks = parseFloat(r.totalMarks);
  const studentRank = parseInt(analysis.rank);
  const studentPct = parseFloat(analysis.percentile);
  const maxMarks = parseFloat(r.totalSubjectMarks) || 300;

  // 2. Topper's score
  let topper = parseFloat(r.totalHighest);

  // Check top rows from leaderboard
  let topRows = Array.isArray(current.leaderboard?.leaderboardScore)
    ? current.leaderboard.leaderboardScore
    : [];

  // If leaderboard isn't in currentResult yet, try fetching it
  if (topRows.length === 0 && API_CONFIG.token) {
    try {
      const selected = current.selected || {};
      const leaderboardId = selected.id || selected.testPaperId || analysis.testPaperId;
      if (leaderboardId) {
        const lb = await fetchLeaderboardScore(API_CONFIG.token, leaderboardId);
        if (lb && Array.isArray(lb.leaderboardScore)) {
          current.leaderboard = lb;
          topRows = lb.leaderboardScore;
        }
      }
    } catch (e) {
      console.warn("Could not fetch leaderboard for anchors:", e);
    }
  }

  if (topRows.length > 0) {
    const firstRow = topRows[0];
    const topScore = parseFloat(firstRow.totalMarks);
    if (!isNaN(topScore)) {
      topper = isNaN(topper) ? topScore : Math.max(topper, topScore);
    }
  }

  if (isNaN(topper) || topper <= 0) {
    const promptTopperMsg = `Topper marks (Rank 1 score) not found in test data.\nMax Marks: ${maxMarks}\nPlease enter the Topper Marks:`;
    const inputTopper = prompt(promptTopperMsg, "");
    if (!inputTopper || isNaN(parseFloat(inputTopper.trim())) || parseFloat(inputTopper.trim()) <= 0) {
      alert("❌ Generation Aborted: Valid Topper marks are required.");
      return;
    }
    topper = parseFloat(inputTopper.trim());
  }

  // 3. STRICT REQUIREMENT: Average marks MUST be provided!
  let avg = parseFloat(r.totalAvg || r.totalAvgMarks || analysis.avgMarks);
  if (isNaN(avg) || avg <= 0 || avg >= topper) {
    const promptMsg = `⚠️ STRICT REQUIREMENT:\nBatch Average Marks are required by RankNet to calculate paper difficulty and shape the CDF curve.\n\nTopper score: ${topper} / ${maxMarks}\nPlease enter the Batch Average Marks:`;
    const inputAvg = prompt(promptMsg, !isNaN(avg) && avg > 0 ? avg : "");
    if (!inputAvg || inputAvg.trim() === "") {
      alert("❌ Generation Aborted: Average marks are strictly required.");
      return;
    }
    avg = parseFloat(inputAvg.trim());
    if (isNaN(avg) || avg <= 0) {
      alert("❌ Invalid Average Marks: Must be a positive number.");
      return;
    }
    if (avg >= topper) {
      alert(`❌ Invalid Average Marks: Must be strictly less than topper marks (${topper}).`);
      return;
    }
  }

  // 4. Estimate total students N by percentile
  let estimatedN = null;
  if (!isNaN(studentRank) && studentRank > 0 && !isNaN(studentPct) && studentPct > 0 && studentPct < 100) {
    estimatedN = Math.round(studentRank / (1.0 - (studentPct / 100.0)));
  } else if (!isNaN(parseFloat(analysis.totalStudent)) && parseFloat(analysis.totalStudent) > 0) {
    estimatedN = Math.round(parseFloat(analysis.totalStudent));
  }

  // 5. Gather all anchor points (preserving ties!)
  const anchors = [];
  let nextAnchorId = 1;

  // Add student's own scorecard as anchor
  if (!isNaN(studentRank) && studentRank > 1 && !isNaN(studentMarks)) {
    anchors.push({
      id: nextAnchorId++,
      rank: studentRank,
      marks: Math.round(studentMarks),
      percentile: !isNaN(studentPct) ? Number(studentPct.toFixed(2)) : ''
    });
  }

  // Add all top students from leaderboard (supporting ties!)
  topRows.forEach(row => {
    const rk = parseInt(row.ranks);
    const mk = parseFloat(row.totalMarks);
    if (!isNaN(rk) && rk > 1 && !isNaN(mk)) {
      let pct = '';
      if (estimatedN && estimatedN > rk) {
        pct = Number(((1.0 - (rk / estimatedN)) * 100).toFixed(2));
      }
      anchors.push({
        id: nextAnchorId++,
        rank: rk,
        marks: Math.round(mk),
        percentile: pct
      });
    }
  });

  // If only Rank 1 exists (e.g. user is Rank 1 and no leaderboard), add a fallback anchor if student is not rank 1
  if (anchors.length === 0 && !isNaN(studentMarks) && !isNaN(studentRank) && studentRank > 1) {
    anchors.push({
      id: nextAnchorId++,
      rank: studentRank,
      marks: Math.round(studentMarks),
      percentile: !isNaN(studentPct) ? Number(studentPct.toFixed(2)) : ''
    });
  }

  // Sort anchors by rank ascending, marks descending
  anchors.sort((a, b) => a.rank - b.rank || b.marks - a.marks);

  // 6. Populate inputs on Neural Network page
  PL_STATE.batchStats = { avg, topper, maxMarks };
  PL_STATE.anchors = anchors;

  // 7. Navigate to Neural Network page and switch to leaderboard subtab
  await nav('neural');
  window.setSubTab('neural', 'leaderboard');

  // Update DOM inputs
  const avgInp = document.getElementById('pl-avg');
  const topperInp = document.getElementById('pl-topper');
  const maxInp = document.getElementById('pl-max');
  if (avgInp) avgInp.value = avg;
  if (topperInp) topperInp.value = topper;
  if (maxInp) maxInp.value = maxMarks;

  const overrideVal = document.getElementById('pl-n-override-val');
  if (estimatedN && estimatedN > 0 && overrideVal) {
    overrideVal.value = estimatedN;
  }

  renderAnchorRows();
  updateAnchorNCalculation();

  // 8. Auto-generate the pseudo leaderboard!
  await generateLeaderboardFromUI();
};

