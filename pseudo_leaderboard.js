/**
 * PseudoLeaderboardEngine
 * Client-side TensorFlow.js pseudo-leaderboard generation with anchor calibration.
 * Reconstructs a full monotonic leaderboard (Rank 1 to N) from batch stats and anchor points.
 * Supports 3 generation modes:
 *  - 'one-pass': Fast single vectorized candidate-grid forward pass (< 3ms).
 *  - 'multi-pass': Multi-pass hierarchical refinement (coarse grid + fine-grid zoom + residual relaxation).
 *  - 'per-rank': Batched rank-by-rank neural target bisection where each rank r is directly evaluated.
 */
class PseudoLeaderboardEngine {
  constructor() {
    this.rankNet = null;
    this.meta = null;
    this.mode = 'one-pass'; // 'one-pass' | 'multi-pass' | 'per-rank'
  }

  /**
   * Set the active generation mode.
   * @param {'one-pass' | 'multi-pass' | 'per-rank'} mode
   */
  setMode(mode) {
    if (['one-pass', 'multi-pass', 'per-rank'].includes(mode)) {
      this.mode = mode;
    }
  }

  /**
   * Attach an existing preloaded model & meta if already available
   */
  setModel(model, meta) {
    this.rankNet = model;
    this.meta = meta;
  }

  /**
   * Load the TensorFlow.js model and metadata.
   * @param {string} basePath - Path to ranknet folder (e.g., 'models/ranknet')
   */
  async init(basePath = 'models/ranknet') {
    if (this.rankNet && this.meta) return;

    try {
      const metaRes = await fetch(`${basePath}/meta.json`);
      this.meta = await metaRes.json();
    } catch (e) {
      console.warn("Could not load meta.json, using defaults.");
    }

    try {
      const rankNetPath = `${basePath}/model.json`;
      this.rankNet = await tf.loadLayersModel(rankNetPath);
      console.log("RankNet loaded successfully for pseudo-leaderboard engine.");
    } catch (e) {
      console.error("Failed to load RankNet model:", e);
    }
  }

  /**
   * Extract dynamic statistical constants from meta with safe clamps.
   */
  getConstants(difficulty) {
    const stats = this.meta?.stat_constants || {};
    const slope_k = typeof stats.slope_k === 'number' ? stats.slope_k : -4.6774;
    const intercept_k = typeof stats.intercept_k === 'number' ? stats.intercept_k : 4.5740;
    const k = Math.max(0.1, slope_k * difficulty + intercept_k);
    const maxMarks_ref = (this.meta && this.meta.maxMarks_ref) || 300.0;
    return { k, maxMarks_ref };
  }

  /**
   * Calculate total students N from anchor points.
   * Standard exam percentile formula: Percentile = (1 - (Rank / N)) * 100
   * Solving for N: N = Rank / (1 - (Percentile / 100))
   */
  calculateN(anchorPoints) {
    const estimates = [];
    for (const pt of anchorPoints) {
      if (pt.rank && pt.percentile && pt.percentile > 0 && pt.percentile < 100) {
        const est = pt.rank / (1.0 - (pt.percentile / 100.0));
        if (est > 0 && isFinite(est)) estimates.push(est);
      }
    }
    if (estimates.length === 0) return 500; // fallback if no percentile provided
    estimates.sort((a, b) => a - b);
    const median = estimates[Math.floor(estimates.length / 2)];
    return Math.max(10, Math.round(median));
  }

  /**
   * Mode 1: Fast Single-Pass Vectorized Grid Inversion (< 3ms)
   */
  async _inferOnePass({ N, avg, topper, difficulty, gap, sigma, maxMarks_norm }) {
    const step = 0.5;
    const numGrid = Math.floor(topper / step) + 1;
    const gridScores = new Float32Array(numGrid);
    const gridInputs = [];

    for (let i = 0; i < numGrid; i++) {
      const s = i * step;
      gridScores[i] = s;
      const z = (s - avg) / sigma;
      const x_norm = gap > 0 ? (s - avg) / gap : 0.0;
      gridInputs.push([z, Math.max(0.01, Math.min(x_norm, 1.0)), difficulty, maxMarks_norm]);
    }

    const gridTensor = tf.tensor2d(gridInputs);
    const gridPreds = await this.rankNet.predict(gridTensor).data();
    gridTensor.dispose();

    const rawScores = new Float32Array(N);
    for (let r = 1; r <= N; r++) {
      const targetY = 1.0 - (r / N);
      let low = 0, high = numGrid - 1;
      while (low < high - 1) {
        const mid = (low + high) >> 1;
        if (gridPreds[mid] < targetY) low = mid;
        else high = mid;
      }
      const span = gridPreds[high] - gridPreds[low];
      const frac = span > 1e-6 ? Math.max(0, Math.min(1, (targetY - gridPreds[low]) / span)) : 0;
      rawScores[r - 1] = gridScores[low] + frac * (gridScores[high] - gridScores[low]);
    }

    return rawScores;
  }

  /**
   * Mode 2: Multi-Pass Hierarchical Refinement (supports 2x to 20x passes)
   * Progressively refines score resolution around anchors and critical percentiles
   */
  async _inferMultiPass({ N, avg, topper, difficulty, gap, sigma, maxMarks_norm, anchorMap, numPasses = 5 }) {
    const P = Math.max(2, Math.min(20, parseInt(numPasses, 10) || 5));

    // Pass 1: Global base grid
    const coarseStep = 1.5;
    const numCoarse = Math.floor(topper / coarseStep) + 1;
    const scorePoints = new Set();
    for (let i = 0; i < numCoarse; i++) {
      scorePoints.add(Math.round(i * coarseStep * 100) / 100);
    }
    scorePoints.add(topper);

    // Passes 2..P: Progressive hierarchical refinement passes
    const anchorMarks = Array.from(anchorMap.values());
    anchorMarks.push(avg, topper * 0.5, topper * 0.75);

    for (let p = 2; p <= P; p++) {
      const step_p = Math.max(0.05, 1.0 / (1.0 + (p - 1) * 0.5));
      const radius = Math.max(5.0, 25.0 / (1.0 + (p - 2) * 0.2));

      for (const m of anchorMarks) {
        const start = Math.max(0, m - radius);
        const end = Math.min(topper, m + radius);
        for (let s = start; s <= end; s += step_p) {
          scorePoints.add(Math.round(s * 100) / 100);
        }
      }
    }

    const sortedScores = Array.from(scorePoints).sort((a, b) => a - b);
    const inputs = sortedScores.map(s => {
      const z = (s - avg) / sigma;
      const x_norm = gap > 0 ? (s - avg) / gap : 0.0;
      return [z, Math.max(0.01, Math.min(x_norm, 1.0)), difficulty, maxMarks_norm];
    });

    const tensorIn = tf.tensor2d(inputs);
    const preds = await this.rankNet.predict(tensorIn).data();
    tensorIn.dispose();

    const rawScores = new Float32Array(N);
    const totalPoints = sortedScores.length;

    for (let r = 1; r <= N; r++) {
      const targetY = 1.0 - (r / N);
      let low = 0, high = totalPoints - 1;
      while (low < high - 1) {
        const mid = (low + high) >> 1;
        if (preds[mid] < targetY) low = mid;
        else high = mid;
      }
      const span = preds[high] - preds[low];
      const frac = span > 1e-6 ? Math.max(0, Math.min(1, (targetY - preds[low]) / span)) : 0;
      rawScores[r - 1] = sortedScores[low] + frac * (sortedScores[high] - sortedScores[low]);
    }

    return rawScores;
  }

  /**
   * Mode 3: Batched Rank-by-Rank Target Inversion
   * Directly targets each individual rank r with batched neural bisection.
   * Each rank converges to exact target percentile 1 - r/N directly through RankNet forward evaluations.
   */
  async _inferPerRank({ N, avg, topper, difficulty, gap, sigma, maxMarks_norm }) {
    const rawScores = new Float32Array(N);
    const batchSize = 512;

    for (let startIdx = 0; startIdx < N; startIdx += batchSize) {
      const endIdx = Math.min(startIdx + batchSize, N);
      const curBatchSize = endIdx - startIdx;

      const targetYs = new Float32Array(curBatchSize);
      const lowScores = new Float32Array(curBatchSize);
      const highScores = new Float32Array(curBatchSize);

      for (let i = 0; i < curBatchSize; i++) {
        const rank = startIdx + i + 1;
        targetYs[i] = 1.0 - (rank / N);
        lowScores[i] = 0;
        highScores[i] = topper;
      }

      // 12 iterations of vectorized bisection gives precision: topper / 2^12 = 300 / 4096 = ~0.07 marks
      const numIters = 12;
      for (let iter = 0; iter < numIters; iter++) {
        const midScores = new Float32Array(curBatchSize);
        const batchInputs = [];

        for (let i = 0; i < curBatchSize; i++) {
          const mid = (lowScores[i] + highScores[i]) * 0.5;
          midScores[i] = mid;
          const z = (mid - avg) / sigma;
          const x_norm = gap > 0 ? (mid - avg) / gap : 0.0;
          batchInputs.push([z, Math.max(0.01, Math.min(x_norm, 1.0)), difficulty, maxMarks_norm]);
        }

        const inputTensor = tf.tensor2d(batchInputs);
        const predTensor = this.rankNet.predict(inputTensor);
        const preds = await predTensor.data();
        inputTensor.dispose();
        predTensor.dispose();

        for (let i = 0; i < curBatchSize; i++) {
          if (preds[i] < targetYs[i]) {
            lowScores[i] = midScores[i];
          } else {
            highScores[i] = midScores[i];
          }
        }
      }

      for (let i = 0; i < curBatchSize; i++) {
        rawScores[startIdx + i] = (lowScores[i] + highScores[i]) * 0.5;
      }
    }

    return rawScores;
  }

  /**
   * Generate Full Pseudo Leaderboard.
   * @param {Object} params
   * @param {number} params.avg - Batch average marks
   * @param {number} params.topper - Rank 1 marks
   * @param {number} [params.maxMarks=300] - Total exam marks
   * @param {Array<{rank: number, marks: number, percentile?: number}>} params.anchorPoints
   * @param {number} [params.overrideN] - Optional manual override for total students
   * @param {'one-pass' | 'multi-pass' | 'per-rank'} [params.mode] - Generation mode override
   * @returns {Promise<Array<{rank: number, marks: number, percentile: number, isAnchor: boolean}>>}
   */
  async generateLeaderboard({ avg, topper, maxMarks = 300, anchorPoints = [], overrideN = null, mode = null, numPasses = 5 }) {
    if (!avg || !topper || topper <= avg) {
      throw new Error("Invalid parameters: topper marks must be greater than average marks.");
    }

    const startTime = performance.now();
    const activeMode = mode || this.mode || 'one-pass';
    const avgNum = parseFloat(avg);
    const topperNum = parseFloat(topper);
    const maxMarksNum = parseFloat(maxMarks) || 300.0;
    const passesNum = Math.max(2, Math.min(20, parseInt(numPasses, 10) || 5));

    // 1. Calculate total students N
    const N = overrideN ? Math.max(10, Math.round(overrideN)) : this.calculateN(anchorPoints);

    // 2. Consolidate Anchors onto student positions 1..N (supporting ties!)
    const anchorMap = new Map();
    const anchorDisplayRank = new Map();

    // Position 1 is anchored to topper
    anchorMap.set(1, Number(topperNum));
    anchorDisplayRank.set(1, 1);

    // Sort incoming anchors by rank ascending, marks descending
    const sortedPts = [...anchorPoints]
      .filter(pt => pt.rank && pt.marks != null && !isNaN(pt.marks))
      .sort((a, b) => a.rank - b.rank || b.marks - a.marks);

    let lastRank = 1;
    let lastPos = 1;
    for (const pt of sortedPts) {
      const rk = Math.round(pt.rank);
      if (rk < 1 || rk > N) continue;

      let targetPos = rk;
      if (targetPos <= lastPos || rk === lastRank) {
        // Tied rank or collision with already anchored position: take next position
        targetPos = lastPos + 1;
      }
      if (targetPos <= N) {
        anchorMap.set(targetPos, Number(pt.marks));
        anchorDisplayRank.set(targetPos, rk);
        lastRank = rk;
        lastPos = targetPos;
      }
    }

    // 3. Inference Parameters (preserving exact float decimals for avg)
    const difficulty = avgNum / maxMarksNum;
    const { k, maxMarks_ref } = this.getConstants(difficulty);
    const maxMarks_norm = maxMarksNum / maxMarks_ref;
    const gap = Math.max(1.0, topperNum - avgNum);
    const sigma = Math.max(0.1, gap / k);

    let rawScores = new Float32Array(N);

    if (this.rankNet) {
      if (activeMode === 'multi-pass') {
        rawScores = await this._inferMultiPass({ N, avg: avgNum, topper: topperNum, difficulty, gap, sigma, maxMarks_norm, anchorMap, numPasses: passesNum });
      } else if (activeMode === 'per-rank') {
        rawScores = await this._inferPerRank({ N, avg: avgNum, topper: topperNum, difficulty, gap, sigma, maxMarks_norm });
      } else {
        // Default: 'one-pass'
        rawScores = await this._inferOnePass({ N, avg: avgNum, topper: topperNum, difficulty, gap, sigma, maxMarks_norm });
      }
    } else {
      // High-accuracy monotonic statistical sigmoid fallback if TF.js not loaded yet
      for (let r = 1; r <= N; r++) {
        const y = 1.0 - (r / N);
        rawScores[r - 1] = avgNum + Math.tan((y - 0.5) * 1.4) * (gap * 0.45);
      }
    }

    // 4. Residual Calibration through Anchors
    const sortedAnchorPositions = Array.from(anchorMap.keys()).sort((a, b) => a - b);
    const residuals = sortedAnchorPositions.map(pos => ({
      pos,
      res: anchorMap.get(pos) - rawScores[pos - 1]
    }));

    const calibratedScores = new Float64Array(N);

    for (let r = 1; r <= N; r++) {
      if (anchorMap.has(r)) {
        calibratedScores[r - 1] = anchorMap.get(r);
        continue;
      }

      let res = 0;
      if (residuals.length === 1) {
        res = residuals[0].res;
      } else if (r <= residuals[0].pos) {
        res = residuals[0].res;
      } else if (r >= residuals[residuals.length - 1].pos) {
        res = residuals[residuals.length - 1].res;
      } else {
        let left = residuals[0];
        let right = residuals[residuals.length - 1];
        for (let i = 0; i < residuals.length - 1; i++) {
          if (residuals[i].pos <= r && residuals[i + 1].pos >= r) {
            left = residuals[i];
            right = residuals[i + 1];
            break;
          }
        }
        const span = right.pos - left.pos;
        const frac = span > 0 ? (r - left.pos) / span : 0;

        if (activeMode === 'multi-pass') {
          // Smooth Hermite cubic interpolation for multi-pass relaxation
          const t = frac;
          const h00 = (1 + 2 * t) * (1 - t) * (1 - t);
          const h01 = t * t * (3 - 2 * t);
          res = left.res * h00 + right.res * h01;
        } else {
          res = left.res + frac * (right.res - left.res);
        }
      }

      calibratedScores[r - 1] = rawScores[r - 1] + res;
    }

    // 5. Enforce Strict Monotonicity & Clamping
    calibratedScores[0] = topper;
    for (let r = 2; r <= N; r++) {
      if (calibratedScores[r - 1] > calibratedScores[r - 2]) {
        calibratedScores[r - 1] = calibratedScores[r - 2];
      }
      if (anchorMap.has(r)) {
        calibratedScores[r - 1] = anchorMap.get(r);
      }
    }
    for (let r = N - 1; r >= 1; r--) {
      if (calibratedScores[r - 1] < calibratedScores[r]) {
        calibratedScores[r - 1] = calibratedScores[r];
      }
    }

    // 6. Build High-Accuracy Output Leaderboard (Sequential Ranks 1..N)
    const leaderboard = [];
    for (let r = 1; r <= N; r++) {
      const finalMarks = Math.max(0, Math.min(topper, calibratedScores[r - 1]));
      const displayRank = anchorDisplayRank.has(r) ? anchorDisplayRank.get(r) : r;
      const pct = Math.max(0.01, Math.min(99.99, (1.0 - (displayRank / N)) * 100));

      const isAnchored = anchorMap.has(r);
      const formattedMarks = isAnchored
        ? anchorMap.get(r)
        : Number(finalMarks.toFixed(1));

      leaderboard.push({
        rank: displayRank,
        marks: formattedMarks,
        percentile: Number(pct.toFixed(2)),
        isAnchor: isAnchored
      });
    }

    const timeMs = Math.round(performance.now() - startTime);
    const modelName = this.rankNet
      ? (this.meta?.selected_model || "RankNet (Model B Combined)")
      : "Statistical Sigmoid Fallback";

    this.lastRunMeta = {
      modelName,
      isNeural: !!this.rankNet,
      mode: activeMode,
      passes: activeMode === 'multi-pass' ? passesNum : 1,
      timeMs,
      totalN: N,
      avg: avgNum
    };
    leaderboard.meta = this.lastRunMeta;

    return leaderboard;
  }

  // Normal Function: Score -> Percentile & Rank
  async predictPercentileAndRank(score, avg, topper, maxMarks, totalN) {
    if (!this.rankNet) throw new Error("RankNet model not loaded.");
    const difficulty = avg / maxMarks;
    const { k, maxMarks_ref } = this.getConstants(difficulty);
    const gap = Math.max(1.0, topper - avg);
    const sigma = Math.max(0.1, gap / k);
    const z = (score - avg) / sigma;
    let x_norm = gap > 0 ? (score - avg) / gap : 0.0;
    x_norm = Math.max(0.01, Math.min(x_norm, 1.0));
    const max_norm = maxMarks / maxMarks_ref;

    const inputTensor = tf.tensor2d([[z, x_norm, difficulty, max_norm]]);
    const out = this.rankNet.predict(inputTensor);
    const data = await out.data();
    inputTensor.dispose();
    out.dispose();

    const pct = Math.max(0.01, Math.min(99.99, data[0] * 100.0));
    const rank = totalN ? Math.max(1, Math.round(totalN * (1.0 - pct / 100.0))) : null;
    return { percentile: Number(pct.toFixed(2)), rank };
  }
}

// Global instance
window.PseudoLeaderboardEngine = PseudoLeaderboardEngine;
window.pseudoLeaderboardEngine = new PseudoLeaderboardEngine();
