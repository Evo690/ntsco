let rankModel = null;
let rankMeta = null;
let rankLoadingPromise = null;
function loadScript(url) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${url}"]`)) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = url;
    script.onload = resolve;
    script.onerror = error => { script.remove(); reject(error); };
    document.head.appendChild(script);
  });
}
async function initRankPredictor() {
  if (rankModel && rankMeta) return { model: rankModel, meta: rankMeta };
  if (rankLoadingPromise) return rankLoadingPromise;

  rankLoadingPromise = (async () => {
    const dot = document.getElementById("rank-dot");
    const stat = document.getElementById("rank-status");
    const btn = document.getElementById("rank-predict-btn");
    try {
      const retry = document.getElementById("model-retry");
      if (retry) retry.hidden = true;
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
      if (stat) stat.textContent = "Model unavailable. Check your connection and retry.";
      const retry = document.getElementById("model-retry");
      if (retry) retry.hidden = false;
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
  const originalText = btn ? btn.textContent : "Predict my rank";

  try {
    if (!rankModel || !rankMeta) {
      if (btn) btn.textContent = "Loading Model...";
      await initRankPredictor();
    }
    if (!rankModel) {
      alert("Neural network model could not be loaded. Please check your internet connection.");
      return;
    }

    const score = parseFloat(document.getElementById("inp-score")?.value);
    const maxM = parseFloat(document.getElementById("inp-max")?.value);
    const avg = parseFloat(document.getElementById("inp-avg")?.value);
    const N_in = parseFloat(document.getElementById("inp-N")?.value);

    if (isNaN(score) || isNaN(maxM) || isNaN(avg)) {
      alert("Please fill in score, max marks and overall average.");
      return;
    }
    if (avg >= maxM) {
      alert("Average cannot exceed maximum marks.");
      return;
    }
    if (score < 0) {
      alert("Score cannot be negative.");
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
    alert("Prediction error: " + err.message);
  } finally {
    if (btn) btn.textContent = originalText;
  }
}
window.predictRank = predictRank;
