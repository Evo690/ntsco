/* --- EXAMS & RESULTS --- */
async function openResultSubpage(testId, options = {}) {
  const cleanId = String(testId || '').trim();
  if (!cleanId || !API_CONFIG.token) return;
  APP_STATE.lastResultSource = options.source || (options.forced ? 'era' : 'examhall');
  const body = document.getElementById('result-detail-body');
  nav('result-detail');
  if (body) body.innerHTML = `<div class="empty">${options.forced ? 'Checking your result directly…' : 'Loading result...'}</div>`;
  try {
    var _analysis, _analysis2;
    const allTests = [...(APP_STATE.tests || []), ...(APP_STATE.eraTests || [])];
    const selected = allTests.find(t => String(t.id || '') === cleanId || String(t.testPaperId || '') === cleanId) || null;
    const appearedReqId = (selected === null || selected === void 0 ? void 0 : selected.id) || cleanId;
    const appeared = await fetchAppearedResult(API_CONFIG.token, appearedReqId);
    if (selected && appeared) {
      selected.appeared = appeared;
    }
    const examId = appeared === null || appeared === void 0 ? void 0 : appeared.examId;
    if (!examId) {
      if (body) body.innerHTML = `<div class="empty">No examId returned for this test. The request completed, but result analysis cannot be fetched.</div><details open style="margin-top:10px"><summary style="font-size:12px;color:var(--accent);cursor:pointer">Appeared result raw data</summary><pre style="margin-top:8px;background:#05070b;border:1px solid var(--border);border-radius:8px;padding:10px;white-space:pre-wrap;overflow:auto;font-size:11px;color:var(--text2)">${escapeHtml(JSON.stringify(appeared, null, 2))}</pre></details>`;
      return;
    }
    const key = `${options.forced ? 'era:' : ''}${examId}`;
    let analysis = APP_STATE.resultCache[key];
    if (!analysis) {
      analysis = await fetchResultAnalysis(API_CONFIG.token, examId);
      if (analysis) APP_STATE.resultCache[key] = analysis;
    }
    if (!((_analysis = analysis) !== null && _analysis !== void 0 && _analysis.result)) {
      if (body) body.innerHTML = '<div class="empty">Result analysis did not return parsed result data.</div>';
      return;
    }
    const leaderboardId = (selected === null || selected === void 0 ? void 0 : selected.id) || cleanId || (selected === null || selected === void 0 ? void 0 : selected.testPaperId) || ((_analysis2 = analysis) === null || _analysis2 === void 0 ? void 0 : _analysis2.testPaperId);
    const leaderboard = await fetchLeaderboardScore(API_CONFIG.token, leaderboardId);

    APP_STATE.currentResult = {
      analysis,
      selected,
      appeared,
      leaderboard,
      forced: Boolean(options.forced)
    };
    if (body) body.innerHTML = buildResultAnalysisHtml(analysis, selected, {
      forced: Boolean(options.forced),
      appeared,
      includeRaw: Boolean(options.forced),
      leaderboard,
      showLeaderboardButton: true
    });
  } catch (err) {
    if (body) body.innerHTML = `<div class="empty">${escapeHtml((err === null || err === void 0 ? void 0 : err.message) || 'Failed to load result')}</div>`;
  }
}
window.openExamResult = function openExamResult(testId) {
  openResultSubpage(testId, {
    forced: false,
    source: 'examhall'
  });
};
window.openEraForcedResult = function openEraForcedResult(testId) {
  openResultSubpage(testId, {
    forced: true,
    source: 'era'
  });
};
window.openForcedResultByTestId = function openForcedResultByTestId(event) {
  if (event !== null && event !== void 0 && event.preventDefault) event.preventDefault();
  const input = document.getElementById('manual-force-test-id');
  const testId = String((input === null || input === void 0 ? void 0 : input.value) || '').trim();
  if (!testId) {
    if (input) input.focus();
    return;
  }
  openResultSubpage(testId, {
    forced: true,
    source: 'era'
  });
};
window.scanTestIds = async function scanTestIds(startId, endId, options = {}) {
  var _options$delayMs;
  const start = Number(startId);
  const end = Number(endId);
  if (!API_CONFIG.token) {
    console.warn('[scanTestIds] Login first, then run scanTestIds(startId, endId).');
    return [];
  }
  if (!Number.isInteger(start) || !Number.isInteger(end)) {
    console.warn('[scanTestIds] Usage: scanTestIds(1000, 1050)');
    return [];
  }
  const from = Math.min(start, end);
  const to = Math.max(start, end);
  const delayMs = Number((_options$delayMs = options.delayMs) !== null && _options$delayMs !== void 0 ? _options$delayMs : 120);
  const found = [];
  console.log(`[scanTestIds] Scanning test IDs ${from} to ${to}...`);
  for (let id = from; id <= to; id += 1) {
    try {
      const appeared = await fetchAppearedResult(API_CONFIG.token, id);
      const examId = appeared === null || appeared === void 0 ? void 0 : appeared.examId;
      if (examId) {
        var _analysis3;
        const cacheKey = `scan:${examId}`;
        let analysis = APP_STATE.resultCache[cacheKey];
        if (!analysis) {
          analysis = await fetchResultAnalysis(API_CONFIG.token, examId);
          if (analysis) APP_STATE.resultCache[cacheKey] = analysis;
        }
        const name = ((_analysis3 = analysis) === null || _analysis3 === void 0 ? void 0 : _analysis3.testName) || (appeared === null || appeared === void 0 ? void 0 : appeared.testName) || (appeared === null || appeared === void 0 ? void 0 : appeared.name) || `Exam ${examId}`;
        const row = {
          testId: id,
          examId,
          name
        };
        found.push(row);
        console.log(`[scanTestIds] ${id}: ${name}`);
      }
    } catch (err) {
      if (options.verbose) console.warn(`[scanTestIds] ${id}: ${(err === null || err === void 0 ? void 0 : err.message) || 'failed'}`);
    }
    if (delayMs > 0 && id < to) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  console.table(found);
  console.log(`[scanTestIds] Done. Found ${found.length} result${found.length === 1 ? '' : 's'}.`);
  return found;
};
window.downloadResultPdf = async function downloadResultPdf(testId, isForced, buttonEl) {
  const cleanId = String(testId || '').trim();
  if (!cleanId || !API_CONFIG.token) {
    alert('Authentication token or test ID not found. Please log in.');
    return;
  }
  let originalHtml = '';
  if (buttonEl) {
    originalHtml = buttonEl.innerHTML;
    buttonEl.disabled = true;
    buttonEl.innerHTML = '<span style="display:inline-block;width:12px;height:12px;border:2px solid rgba(255,255,255,0.2);border-radius:50%;border-top-color:#fff;animation:spin 0.8s linear infinite;vertical-align:middle;margin-right:6px"></span>Loading...';
  }

  // Open print window synchronously to avoid popup blocker
  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Loading Academic Report...</title>
          <style>
            body {
              background: #05070b;
              color: #ffffff;
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
              display: flex;
              justify-content: center;
              align-items: center;
              height: 100vh;
              margin: 0;
            }
            .loader {
              text-align: center;
            }
            .spinner {
              border: 3px solid rgba(255,255,255,0.1);
              width: 36px;
              height: 36px;
              border-radius: 50%;
              border-left-color: #10b981;
              animation: spin 1s linear infinite;
              margin: 0 auto 16px auto;
            }
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
            .text {
              font-size: 14px;
              font-weight: 500;
              color: #9ca3af;
              letter-spacing: 0.05em;
            }
          </style>
        </head>
        <body>
          <div class="loader">
            <div class="spinner"></div>
            <div class="text">PREPARING REPORT PDF...</div>
          </div>
        </body>
        </html>
      `);
    printWindow.document.close();
  }
  try {
    var _appeared, _analysis4;
    const allTests = [...(APP_STATE.tests || []), ...(APP_STATE.eraTests || [])];
    const selected = allTests.find(t => String(t.id || '') === cleanId || String(t.testPaperId || '') === cleanId) || null;
    const appearedReqId = (selected === null || selected === void 0 ? void 0 : selected.id) || cleanId;
    let appeared = (selected === null || selected === void 0 ? void 0 : selected.appeared) || null;
    if (!appeared) {
      appeared = await fetchAppearedResult(API_CONFIG.token, appearedReqId);
    }
    const examId = (_appeared = appeared) === null || _appeared === void 0 ? void 0 : _appeared.examId;
    if (!examId) {
      throw new Error('No exam ID found for this test.');
    }
    const key = `${isForced ? 'era:' : ''}${examId}`;
    let analysis = APP_STATE.resultCache[key];
    if (!analysis) {
      analysis = await fetchResultAnalysis(API_CONFIG.token, examId);
      if (analysis) APP_STATE.resultCache[key] = analysis;
    }
    if (!analysis || !analysis.result) {
      throw new Error('Result analysis data is not available.');
    }
    const leaderboardId = (selected === null || selected === void 0 ? void 0 : selected.id) || cleanId || (selected === null || selected === void 0 ? void 0 : selected.testPaperId) || ((_analysis4 = analysis) === null || _analysis4 === void 0 ? void 0 : _analysis4.testPaperId);
    let leaderboard = null;
    if (leaderboardId) {
      leaderboard = await fetchLeaderboardScore(API_CONFIG.token, leaderboardId);
    }
    const studentName = sessionStorage.getItem('fy_user_name') || 'Student';
    const testName = analysis.testName || (selected === null || selected === void 0 ? void 0 : selected.testName) || (selected === null || selected === void 0 ? void 0 : selected.name) || 'Exam';
    const attemptDate = formatDateLabel(analysis.attemptDate || (selected === null || selected === void 0 ? void 0 : selected.examDate) || (selected === null || selected === void 0 ? void 0 : selected.testDate) || '');
    const testPaperIdStr = analysis.testPaperId || cleanId;
    const totalStudents = analysis.totalStudent || '-';
    const r = analysis.result;
    const fmt = v => v === null || v === undefined || v === '' ? '-' : v;
    const topTotal = Array.isArray(r.topScoreTotal) && r.topScoreTotal.length ? r.topScoreTotal.join(', ') : '-';
    const performanceMap = new Map((analysis.subjectPerformance || []).map(p => [String(p.subjectName || '').toLowerCase(), p.performance]));
    const topBySubject = {};
    if (Array.isArray(r.topScoreSubjectData)) {
      r.topScoreSubjectData.forEach(item => {
        var _item$subjectId2;
        const key = String((_item$subjectId2 = item.subjectId) !== null && _item$subjectId2 !== void 0 ? _item$subjectId2 : '');
        if (!topBySubject[key]) topBySubject[key] = [];
        topBySubject[key].push(item.totalMarks);
      });
    }

    // Calculate subjects breakdown html
    let tableRowsHtml = '';
    if (Array.isArray(r.subjectData) && r.subjectData.length) {
      tableRowsHtml = r.subjectData.map(s => {
        var _s$totalCorrect2, _ref6, _s$totalInCorrect2, _s$totalAttempted2, _topBySubject$String2, _s$subjectId3;
        const correct = Number((_s$totalCorrect2 = s.totalCorrect) !== null && _s$totalCorrect2 !== void 0 ? _s$totalCorrect2 : 0);
        const incorrect = Number((_ref6 = (_s$totalInCorrect2 = s.totalInCorrect) !== null && _s$totalInCorrect2 !== void 0 ? _s$totalInCorrect2 : s.totalIncorrect) !== null && _ref6 !== void 0 ? _ref6 : 0);
        const attempted = Number((_s$totalAttempted2 = s.totalAttempted) !== null && _s$totalAttempted2 !== void 0 ? _s$totalAttempted2 : correct + incorrect);
        const subjectTopScores = ((_topBySubject$String2 = topBySubject[String((_s$subjectId3 = s.subjectId) !== null && _s$subjectId3 !== void 0 ? _s$subjectId3 : '')]) === null || _topBySubject$String2 === void 0 ? void 0 : _topBySubject$String2.join(', ')) || '-';
        const performance = performanceMap.get(String(s.subjectName || '').toLowerCase()) || '-';
        return `
            <tr>
              <td style="font-weight: 700; color: #0f172a;">${escapeHtml(s.subjectName || 'Subject')}</td>
              <td class="mono font-semibold" style="color: #059669;">${escapeHtml(fmt(s.totalMarks))}/${escapeHtml(fmt(s.totalSubjectMarks))}</td>
              <td class="mono">${escapeHtml(fmt(s.totalAvgMarks))}</td>
              <td class="mono">${escapeHtml(fmt(s.highestMarks))}</td>
              <td class="mono">${escapeHtml(fmt(s.rank))}</td>
              <td class="mono">${escapeHtml(fmt(s.percentile))}</td>
              <td>
                <div class="score-breakdown-row font-medium">
                  <span class="c">${correct}c</span>
                  <span style="color: #cbd5e1;">/</span>
                  <span class="w">${incorrect}w</span>
                </div>
              </td>
            </tr>
          `;
      }).join('');
    } else {
      tableRowsHtml = `<tr><td colspan="7" style="text-align: center; color: #64748b;">No subject breakdown available</td></tr>`;
    }

    // Check performance compared to average
    const isAboveAvg = Number(r.totalMarks) >= Number(r.totalAvg);
    const diffFromAvg = (Number(r.totalMarks) - Number(r.totalAvg)).toFixed(2);
    const performanceInsight = isAboveAvg ? `<div class="insight-badge badge-success">✓ You scored ${diffFromAvg} marks above the class average. Prediction confidence is high.</div>` : `<div class="insight-badge badge-warning">⚠ Score is at or below class average. Treat prediction with caution.</div>`;

    // Leaderboard Top 5 if available
    let leaderboardHtml = '';
    if (leaderboard && Array.isArray(leaderboard.leaderboardScore) && leaderboard.leaderboardScore.length) {
      const top5 = leaderboard.leaderboardScore.slice(0, 5);
      const top5Rows = top5.map((entry, index) => {
        return `
            <div class="leaderboard-entry">
              <div class="lead-rank">${index + 1}</div>
              <div class="lead-name">${escapeHtml(entry.studentName || 'Student')}</div>
              <div class="lead-score mono">${escapeHtml(entry.totalMarks)}</div>
            </div>
          `;
      }).join('');
      leaderboardHtml = `
          <div style="margin-top: 30px;">
            <h2 class="section-title">Class Top Performers</h2>
            <div class="leaderboard-card">
              ${top5Rows}
            </div>
          </div>
        `;
    }
    const reportHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Performance Report - ${escapeHtml(testName)}</title>
          <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet">
          <style>
            :root {
              --primary: #0f172a;
              --accent: #10b981; /* emerald green */
              --accent-light: #ecfdf5;
              --border: #e2e8f0;
              --bg-light: #f8fafc;
              --text-main: #334155;
              --text-dark: #0f172a;
              --text-muted: #64748b;
            }

            * {
              box-sizing: border-box;
              margin: 0;
              padding: 0;
            }

            body {
              font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
              color: var(--text-main);
              background: #ffffff;
              line-height: 1.5;
              padding: 30px;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }

            @page {
              size: A4;
              margin: 15mm;
            }

            .report {
              max-width: 800px;
              margin: 0 auto;
            }

            /* Header Section */
            .header {
              display: flex;
              justify-content: space-between;
              align-items: center;
              border-bottom: 2px solid var(--accent);
              padding-bottom: 16px;
              margin-bottom: 24px;
            }

            .logo-section {
              display: flex;
              align-items: center;
              gap: 12px;
            }

            .logo-icon {
              width: 38px;
              height: 38px;
              background: var(--accent);
              border-radius: 8px;
              display: flex;
              align-items: center;
              justify-content: center;
              color: white;
              font-weight: 700;
              font-size: 20px;
              font-family: 'Space Mono', monospace;
            }

            .logo-text h1 {
              font-size: 18px;
              font-weight: 700;
              color: var(--text-dark);
              letter-spacing: -0.02em;
            }

            .logo-text p {
              font-size: 10px;
              color: var(--text-muted);
              text-transform: uppercase;
              letter-spacing: 0.05em;
            }

            .badge {
              background: var(--accent-light);
              color: #065f46;
              font-size: 11px;
              font-weight: 700;
              padding: 6px 12px;
              border-radius: 20px;
              text-transform: uppercase;
              letter-spacing: 0.03em;
            }

            /* Profile Card & Info Grid */
            .info-grid {
              display: grid;
              grid-template-columns: 1.8fr 1fr;
              gap: 16px;
              margin-bottom: 24px;
            }

            .student-card {
              background: var(--primary);
              color: white;
              padding: 20px;
              border-radius: 12px;
              display: flex;
              flex-direction: column;
              justify-content: center;
            }

            .student-card h2 {
              font-size: 20px;
              font-weight: 700;
              margin-bottom: 4px;
              color: white;
            }

            .student-card p {
              font-size: 12px;
              color: #94a3b8;
            }

            .exam-card {
              background: var(--bg-light);
              border: 1px solid var(--border);
              padding: 20px;
              border-radius: 12px;
              display: grid;
              grid-template-columns: repeat(2, 1fr);
              gap: 12px;
            }

            .info-item {
              display: flex;
              flex-direction: column;
            }

            .info-label {
              font-size: 10px;
              font-weight: 700;
              color: var(--text-muted);
              text-transform: uppercase;
              letter-spacing: 0.02em;
              margin-bottom: 2px;
            }

            .info-val {
              font-size: 13px;
              font-weight: 700;
              color: var(--text-dark);
            }

            /* Metrics Summary Cards */
            .metrics-row {
              display: grid;
              grid-template-columns: repeat(4, 1fr);
              gap: 12px;
              margin-bottom: 24px;
            }

            .metric-card {
              background: var(--bg-light);
              border: 1px solid var(--border);
              border-radius: 12px;
              padding: 16px;
              text-align: center;
            }

            .metric-card.accent-card {
              border-color: var(--accent);
              background: var(--accent-light);
            }

            .metric-label {
              font-size: 10px;
              font-weight: 700;
              color: var(--text-muted);
              text-transform: uppercase;
              margin-bottom: 6px;
            }

            .metric-val {
              font-family: 'Space Mono', monospace;
              font-size: 24px;
              font-weight: 700;
              color: var(--text-dark);
              line-height: 1;
            }

            .accent-card .metric-val {
              color: #047857;
            }

            .metric-sub {
              font-size: 10px;
              color: var(--text-muted);
              margin-top: 6px;
            }

            /* Subject Breakdown Section */
            .section-title {
              font-size: 14px;
              font-weight: 700;
              color: var(--text-dark);
              text-transform: uppercase;
              letter-spacing: 0.05em;
              margin-bottom: 12px;
              border-left: 3px solid var(--accent);
              padding-left: 8px;
            }

            .table-container {
              border: 1px solid var(--border);
              border-radius: 12px;
              overflow: hidden;
              margin-bottom: 24px;
            }

            table {
              width: 100%;
              border-collapse: collapse;
              font-size: 12px;
            }

            th {
              background: var(--bg-light);
              font-weight: 700;
              color: var(--text-dark);
              text-align: left;
              padding: 10px 14px;
              border-bottom: 1px solid var(--border);
              font-size: 10px;
              text-transform: uppercase;
            }

            td {
              padding: 10px 14px;
              border-bottom: 1px solid var(--border);
              color: var(--text-dark);
              vertical-align: middle;
            }

            tr:last-child td {
              border-bottom: none;
            }

            .mono {
              font-family: 'Space Mono', monospace;
              font-size: 13px;
            }

            .font-semibold {
              font-weight: 700;
            }

            .score-breakdown-row {
              display: flex;
              gap: 4px;
              align-items: center;
            }

            .score-breakdown-row span {
              font-size: 11px;
            }

            .score-breakdown-row .c { color: #059669; }
            .score-breakdown-row .w { color: #dc2626; }
            .score-breakdown-row .u { color: var(--text-muted); }

            /* Insights / Leaderboard */
            .insight-badge {
              font-size: 12px;
              font-weight: 500;
              padding: 10px 14px;
              border-radius: 8px;
              margin-bottom: 20px;
            }

            .insight-badge.badge-success {
              background: var(--accent-light);
              color: #065f46;
              border: 1px solid rgba(16,185,129,0.2);
            }

            .insight-badge.badge-warning {
              background: #fffbeb;
              color: #92400e;
              border: 1px solid rgba(245,158,11,0.2);
            }

            .leaderboard-card {
              border: 1px solid var(--border);
              border-radius: 12px;
              background: var(--bg-light);
              padding: 8px 16px;
            }

            .leaderboard-entry {
              display: flex;
              justify-content: space-between;
              align-items: center;
              padding: 8px 0;
              border-bottom: 1px dashed var(--border);
            }

            .leaderboard-entry:last-child {
              border-bottom: none;
            }

            .lead-rank {
              width: 22px;
              height: 22px;
              border-radius: 50%;
              background: #e2e8f0;
              color: var(--text-dark);
              font-size: 11px;
              font-weight: 700;
              display: flex;
              align-items: center;
              justify-content: center;
              font-family: 'Space Mono', monospace;
            }

            .lead-name {
              flex: 1;
              margin-left: 12px;
              font-size: 12px;
              font-weight: 500;
              color: var(--text-dark);
            }

            .lead-score {
              font-weight: 700;
              color: var(--accent);
            }

            /* Footer */
            .footer {
              border-top: 1px solid var(--border);
              padding-top: 12px;
              margin-top: 36px;
              display: flex;
              justify-content: space-between;
              align-items: center;
              font-size: 10px;
              color: var(--text-muted);
            }

            .footer-right {
              font-weight: 500;
            }

            @media print {
              body {
                padding: 0;
                background: transparent;
              }
              .no-print {
                display: none !important;
              }
            }
          </style>
        </head>
        <body>
          <div class="report">
            <!-- Header -->
            <header class="header">
              <div class="logo-section">
                <div class="logo-icon">N</div>
                <div class="logo-text">
                  <h1>Narayana Talent</h1>
                  <p>Academic Analytics Portal</p>
                </div>
              </div>
              <div class="badge">Performance Report</div>
            </header>

            <!-- Profile & Exam Meta Grid -->
            <section class="info-grid">
              <div class="student-card">
                <p class="info-label" style="color: #94a3b8;">STUDENT NAME</p>
                <h2>${escapeHtml(studentName)}</h2>
                <p>Narayana talent registered student profile analytics report.</p>
              </div>
              <div class="exam-card">
                <div class="info-item">
                  <span class="info-label">Exam Date</span>
                  <span class="info-val">${escapeHtml(attemptDate)}</span>
                </div>
                <div class="info-item">
                  <span class="info-label">Paper ID</span>
                  <span class="info-val">${escapeHtml(testPaperIdStr)}</span>
                </div>
                <div class="info-item">
                  <span class="info-label">Academic Year</span>
                  <span class="info-val">${API_CONFIG.academicYear} - ${API_CONFIG.academicYear + 1}</span>
                </div>
                <div class="info-item">
                  <span class="info-label">Total Candidates</span>
                  <span class="info-val">${escapeHtml(totalStudents)}</span>
                </div>
              </div>
            </section>

            <!-- Performance Insight -->
            ${performanceInsight}

            <!-- Overall Performance Metrics Row -->
            <section class="metrics-row">
              <div class="metric-card accent-card">
                <div class="metric-label">Your Score</div>
                <div class="metric-val">${escapeHtml(fmt(r.totalMarks))}</div>
                <div class="metric-sub">Out of ${escapeHtml(fmt(r.totalSubjectMarks))}</div>
              </div>
              <div class="metric-card">
                <div class="metric-label">Rank</div>
                <div class="metric-val">${escapeHtml(fmt(analysis.rank))}</div>
                <div class="metric-sub">City Rank: ${escapeHtml(fmt(analysis.cityRank))}</div>
              </div>
              <div class="metric-card">
                <div class="metric-label">Batch Rank</div>
                <div class="metric-val">${escapeHtml(fmt(analysis.batchRank))}</div>
                <div class="metric-sub">Group Rank</div>
              </div>
              <div class="metric-card">
                <div class="metric-label">Percentile</div>
                <div class="metric-val">${escapeHtml(fmt(analysis.percentile))}%</div>
                <div class="metric-sub">Competency Index</div>
              </div>
            </section>

            <!-- Subject-wise performance table -->
            <section style="margin-top: 30px;">
              <h2 class="section-title">Subject Breakdown</h2>
              <div class="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Subject</th>
                      <th>Your Marks</th>
                      <th>Class Avg</th>
                      <th>Highest</th>
                      <th>Rank</th>
                      <th>Percentile</th>
                      <th>Correct / Wrong</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${tableRowsHtml}
                  </tbody>
                </table>
              </div>
            </section>

            <!-- Extra stats (Toppers) -->
            <section style="margin-top: 24px; display: grid; grid-template-columns: 1fr; gap: 16px;">
              <div class="exam-card" style="grid-template-columns: 1fr; gap: 6px;">
                <div class="info-item">
                  <span class="info-label">Top Class Scores</span>
                  <span class="info-val" style="font-family: 'Space Mono', monospace; font-size: 14px; color: #059669;">${escapeHtml(topTotal)}</span>
                </div>
              </div>
            </section>

            <!-- Leaderboard top 5 if loaded -->
            ${leaderboardHtml}

            <!-- Footer -->
            <footer class="footer">
              <div>Generated on ${new Date().toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })}</div>
              <div class="footer-right">Powered by Narayana Talent Portal</div>
            </footer>
          </div>
          <script>
            window.onload = function() {
              setTimeout(function() {
                window.print();
              }, 400);
            };
          </script>
        </body>
        </html>
      `;
    if (printWindow) {
      printWindow.document.open();
      printWindow.document.write(reportHtml);
      printWindow.document.close();
    }
  } catch (err) {
    console.error(err);
    if (printWindow) {
      printWindow.document.body.innerHTML = `
          <div style="color:#ef4444;text-align:center;padding:40px;font-family:sans-serif;">
            <h3 style="margin-bottom:8px">Failed to Generate Report</h3>
            <p style="color:#6b7280;font-size:14px">${escapeHtml((err === null || err === void 0 ? void 0 : err.message) || 'Unknown error occurred.')}</p>
          </div>
        `;
    }
  } finally {
    if (buttonEl) {
      buttonEl.disabled = false;
      buttonEl.innerHTML = originalHtml;
    }
  }
};
window.downloadSolutionsPdf = async function downloadSolutionsPdf(buttonEl) {
  var _current$analysis;
  const current = APP_STATE.currentResult;
  if (!current || !((_current$analysis = current.analysis) !== null && _current$analysis !== void 0 && (_current$analysis = _current$analysis.result) !== null && _current$analysis !== void 0 && _current$analysis.questionData)) {
    alert('No solutions data available to download.');
    return;
  }
  let originalHtml = '';
  if (buttonEl) {
    originalHtml = buttonEl.innerHTML;
    buttonEl.disabled = true;
    buttonEl.innerHTML = '<span style="display:inline-block;width:12px;height:12px;border:2px solid rgba(255,255,255,0.2);border-radius:50%;border-top-color:#fff;animation:spin 0.8s linear infinite;vertical-align:middle;margin-right:6px"></span>Preparing PDF...';
  }
  const questionData = current.analysis.result.questionData;
  const cardsHtml = questionData.filter(q => Boolean(q.solutionImage)).map(q => {
    return `
          <div class="sol-pdf-card">
            <div class="sol-pdf-title">Question ${q.questionNo}</div>
            <div class="sol-img-box"><img src="${escapeHtml(q.solutionImage)}" alt="Q${q.questionNo} Solution" /></div>
          </div>
        `;
  }).join('');
  if (!cardsHtml) {
    alert('No solution images found in this exam.');
    if (buttonEl) {
      buttonEl.disabled = false;
      buttonEl.innerHTML = originalHtml;
    }
    return;
  }
  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Loading Solutions...</title>
          <style>
            body {
              background: #05070b;
              color: #ffffff;
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
              display: flex;
              justify-content: center;
              align-items: center;
              height: 100vh;
              margin: 0;
            }
            .loader {
              text-align: center;
            }
            .spinner {
              border: 3px solid rgba(255,255,255,0.1);
              width: 36px;
              height: 36px;
              border-radius: 50%;
              border-left-color: #10b981;
              animation: spin 1s linear infinite;
              margin: 0 auto 16px auto;
            }
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
            .text {
              font-size: 14px;
              font-weight: 500;
              color: #9ca3af;
              letter-spacing: 0.05em;
            }
          </style>
        </head>
        <body>
          <div class="loader">
            <div class="spinner"></div>
            <div class="text">PREPARING SOLUTIONS...</div>
          </div>
        </body>
        </html>
      `);
    printWindow.document.close();
  }
  try {
    const documentHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Solutions Report</title>
          <style>
            :root {
              --border: #e2e8f0;
              --bg-light: #f8fafc;
              --text-dark: #0f172a;
            }

            * {
              box-sizing: border-box;
              margin: 0;
              padding: 0;
            }

            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
              color: var(--text-dark);
              background: #ffffff;
              line-height: 1.5;
              padding: 20px;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }

            @page {
              size: A4;
              margin: 10mm;
            }

            .report {
              max-width: 800px;
              margin: 0 auto;
            }

            .sol-pdf-card {
              background: #ffffff;
              border: 1px solid var(--border);
              border-radius: 8px;
              padding: 16px;
              margin-bottom: 20px;
              page-break-inside: avoid;
            }

            .sol-pdf-title {
              font-weight: 700;
              font-size: 16px;
              color: var(--text-dark);
              margin-bottom: 12px;
              border-bottom: 1px solid var(--border);
              padding-bottom: 8px;
            }

            .sol-img-box {
              background: var(--bg-light);
              border: 1px solid var(--border);
              border-radius: 6px;
              padding: 8px;
              text-align: center;
            }

            .sol-img-box img {
              max-width: 100%;
              max-height: 800px;
              object-fit: contain;
              border-radius: 4px;
            }

            @media print {
              body {
                padding: 0;
                background: transparent;
              }
              .sol-pdf-card {
                box-shadow: none !important;
              }
            }
          </style>
        </head>
        <body>
          <div class="report">
            ${cardsHtml}
          </div>

          <script>
            window.onload = function() {
              const images = Array.from(document.querySelectorAll('img'));
              let loadedCount = 0;
              const totalImages = images.length;

              if (totalImages === 0) {
                window.print();
                return;
              }

              images.forEach(img => {
                if (img.complete) {
                  onImageLoad();
                } else {
                  img.addEventListener('load', onImageLoad);
                  img.addEventListener('error', onImageLoad);
                }
              });

              function onImageLoad() {
                loadedCount++;
                if (loadedCount === totalImages) {
                  setTimeout(function() {
                    window.print();
                  }, 500);
                }
              }

              setTimeout(function() {
                if (loadedCount < totalImages) {
                  window.print();
                }
              }, 10000);
            };
          </script>
        </body>
        </html>
    `;
    if (printWindow) {
      printWindow.document.open();
      printWindow.document.write(documentHtml);
      printWindow.document.close();
    }
  } catch (err) {
    console.error(err);
    if (printWindow) {
      printWindow.document.body.innerHTML = `
          <div style="color:#ef4444;text-align:center;padding:40px;font-family:sans-serif;">
            <h3 style="margin-bottom:8px">Failed to Generate Solutions PDF</h3>
            <p style="color:#6b7280;font-size:14px">${escapeHtml((err === null || err === void 0 ? void 0 : err.message) || 'Unknown error occurred.')}</p>
          </div>
        `;
    }
  } finally {
    if (buttonEl) {
      buttonEl.disabled = false;
      buttonEl.innerHTML = originalHtml;
    }
  }
};
window.openCurrentLeaderboard = function openCurrentLeaderboard() {
  var _current$analysis2, _current$selected;
  const body = document.getElementById('leaderboard-body');
  const current = APP_STATE.currentResult;
  nav('leaderboard');
  if (!body) return;
  if (!current) {
    body.innerHTML = '<div class="empty">Open a result first.</div>';
    return;
  }
  body.innerHTML = `<div class="result-title">${escapeHtml(((_current$analysis2 = current.analysis) === null || _current$analysis2 === void 0 ? void 0 : _current$analysis2.testName) || ((_current$selected = current.selected) === null || _current$selected === void 0 ? void 0 : _current$selected.testName) || 'Leaderboard')}</div><div class="result-sub">Top 50 students by marks with subject-wise scores.</div>${buildLeaderboardHtml(current.analysis, current.leaderboard)}`;
};
window.openCurrentSolutions = function openCurrentSolutions() {
  var _current$analysis3, _current$analysis4, _current$selected2;
  const body = document.getElementById('solutions-body');
  const current = APP_STATE.currentResult;
  nav('solutions');
  if (!body) return;
  if (!current || !((_current$analysis3 = current.analysis) !== null && _current$analysis3 !== void 0 && (_current$analysis3 = _current$analysis3.result) !== null && _current$analysis3 !== void 0 && _current$analysis3.questionData)) {
    body.innerHTML = '<div class="empty">No solutions data available for this test.</div>';
    return;
  }
  const questionData = current.analysis.result.questionData;
  const uniqueSubjects = [...new Set(questionData.map(q => q.subjectName).filter(Boolean))];

  // Build answer key panel grouped by subject
  const grouped = {};
  questionData.forEach(q => {
    const sub = q.subjectName || 'Other';
    if (!grouped[sub]) grouped[sub] = [];
    grouped[sub].push(q);
  });
  let answerKeyPanelHtml = '<div class="ak-panel" id="ak-panel" style="display:none">';
  Object.keys(grouped).forEach(sub => {
    const qs = [...grouped[sub]].sort((a, b) => a.questionNo - b.questionNo);
    answerKeyPanelHtml += `<div class="ak-subject-block"><div class="ak-subject-label">${escapeHtml(sub)}</div><div class="ak-grid">`;
    qs.forEach(q => {
      const cls = q.isRightAns ? 'ak-correct' : q.isUnAttempted ? 'ak-skipped' : 'ak-wrong';
      answerKeyPanelHtml += `<div class="ak-cell ${cls}"><span class="ak-qno">Q${q.questionNo}</span><span class="ak-ans">${escapeHtml(q.rightAns || '-')}</span></div>`;
    });
    answerKeyPanelHtml += '</div></div>';
  });
  answerKeyPanelHtml += '</div>';
  let tabsHtml = `
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:4px">
        <div class="sol-tabs" style="margin:0">
          <button class="sol-tab-btn active" onclick="filterSolutionsSubject('all', this)">All (${questionData.length})</button>
    `;
  uniqueSubjects.forEach(sub => {
    const count = questionData.filter(q => q.subjectName === sub).length;
    tabsHtml += `<button class="sol-tab-btn" onclick="filterSolutionsSubject('${escapeHtml(sub.toLowerCase())}', this)">${escapeHtml(sub)} (${count})</button>`;
  });
  tabsHtml += `</div>
      <div style="display:flex;gap:8px;align-items:center">
        <button class="start-btn" onclick="downloadSolutionsPdf(this)" style="margin:0">Download Solutions PDF</button>
        <button class="start-btn gray" id="ak-toggle-btn" onclick="toggleAnswerKey()" style="margin:0">Answer Key ▾</button>
      </div>
  </div>`;
  const cardsHtml = questionData.map((q, idx) => {
    const statusClass = q.isRightAns ? 'correct-card' : q.isUnAttempted ? 'skipped-card' : 'incorrect-card';
    const statusText = q.isRightAns ? 'Correct' : q.isUnAttempted ? 'Skipped' : 'Incorrect';
    const statusBadgeClass = q.isRightAns ? 'correct' : q.isUnAttempted ? 'skipped' : 'incorrect';
    const marksVal = q.marks != null ? `${q.marks >= 0 ? '+' : ''}${q.marks}` : '';
    const marksBadge = marksVal ? `<span class="sol-badge ${statusBadgeClass}">${escapeHtml(statusText)} (${marksVal})</span>` : `<span class="sol-badge ${statusBadgeClass}">${escapeHtml(statusText)}</span>`;
    const difficultyClass = String(q.level || '').toLowerCase();
    const diffBadge = q.level ? `<span class="sol-badge ${difficultyClass}">${escapeHtml(q.level)}</span>` : '';
    let timeBadge = '';
    if (q.timeTaken != null && q.qaTime != null) {
      const overTime = q.timeTaken > q.qaTime;
      const timeClass = overTime ? 'over' : 'under';
      timeBadge = `<span class="sol-badge time ${timeClass}">Time: ${q.timeTaken}s / Rec: ${q.qaTime}s</span>`;
    } else if (q.timeTaken != null) {
      timeBadge = `<span class="sol-badge time">Time: ${q.timeTaken}s</span>`;
    }
    const ansClass = q.isRightAns ? 'correct' : 'incorrect';
    const studentAnsText = q.studentAns ? q.studentAns : '-';
    const rightAnsText = q.rightAns ? q.rightAns : '-';
    const hasImg = Boolean(q.solutionImage);
    const actionButton = hasImg ? `<button class="sol-toggle-btn" onclick="toggleSolutionAccordion('${idx}', this)">View Solution ▾</button>` : `<span style="font-size:12px;color:var(--text3)">No solution image available</span>`;
    const imageSection = hasImg ? `
          <div class="sol-img-container" id="sol-img-container-${idx}">
            <div class="sol-img-wrapper">
              <div class="sol-spinner"></div>
              <div class="sol-error">Failed to load solution image.</div>
              <img class="sol-img" data-src="${escapeHtml(q.solutionImage)}" src="" alt="Question ${q.questionNo} Solution" />
              <div class="sol-action-row">
                <a class="sol-action-btn" href="${escapeHtml(q.solutionImage)}" target="_blank" rel="noopener noreferrer">Open in New Tab ↗</a>
              </div>
            </div>
          </div>
        ` : '';
    return `
        <div class="sol-card ${statusClass}" data-subject="${escapeHtml(String(q.subjectName || '').toLowerCase())}">
          <div class="sol-card-header">
            <div class="sol-card-title"><span class="question-number">${escapeHtml(q.questionNo)}</span><div>${escapeHtml(q.subjectName || 'Subject')}<small>Question ${escapeHtml(q.questionNo)}</small></div></div>
            <div class="sol-card-badges">
              ${diffBadge}
              ${timeBadge}
              ${marksBadge}
            </div>
          </div>
          <div class="sol-card-body">
            <div class="sol-answers">
              <div class="sol-ans-item">
                <span class="sol-ans-label">Your Response:</span>
                <span class="sol-ans-val ${ansClass}">${escapeHtml(studentAnsText)}</span>
              </div>
              <div class="sol-ans-item">
                <span class="sol-ans-label">Correct Response:</span>
                <span class="sol-ans-val correct">${escapeHtml(rightAnsText)}</span>
              </div>
            </div>
            ${actionButton}
            ${imageSection}
          </div>
        </div>
      `;
  }).join('');
  body.innerHTML = `
      <div class="result-title">${escapeHtml(((_current$analysis4 = current.analysis) === null || _current$analysis4 === void 0 ? void 0 : _current$analysis4.testName) || ((_current$selected2 = current.selected) === null || _current$selected2 === void 0 ? void 0 : _current$selected2.testName) || 'Solutions')}</div>
      <div class="solution-overview"><span><b>${questionData.length}</b> questions to review</span><span><b>${uniqueSubjects.length}</b> subjects</span><span>Responses, timing & explanations</span></div>
      ${tabsHtml}
      ${answerKeyPanelHtml}
      <div class="sol-cards-list" style="margin-top:16px;">
        ${cardsHtml}
      </div>
    `;
};
window.filterSolutionsSubject = function filterSolutionsSubject(subject, btnEl) {
  const tabsContainer = btnEl.parentElement;
  if (tabsContainer) {
    tabsContainer.querySelectorAll('.sol-tab-btn').forEach(btn => btn.classList.remove('active'));
  }
  btnEl.classList.add('active');
  const cards = document.querySelectorAll('.sol-card');
  cards.forEach(card => {
    const cardSubject = card.dataset.subject;
    if (subject === 'all' || cardSubject === subject) {
      card.style.display = 'block';
    } else {
      card.style.display = 'none';
    }
  });
};
window.toggleAnswerKey = function toggleAnswerKey() {
  const panel = document.getElementById('ak-panel');
  const btn = document.getElementById('ak-toggle-btn');
  if (!panel) return;
  const isOpen = panel.style.display !== 'none';
  panel.style.display = isOpen ? 'none' : 'block';
  if (btn) btn.innerHTML = isOpen ? 'Answer Key ▾' : 'Answer Key ▴';
};
window.toggleSolutionAccordion = function toggleSolutionAccordion(qId, btnEl) {
  const container = document.getElementById(`sol-img-container-${qId}`);
  if (!container) return;
  const isExpanded = container.classList.contains('expanded');
  if (isExpanded) {
    container.classList.remove('expanded');
    container.style.maxHeight = '0px';
    btnEl.innerHTML = 'View Solution ▾';
  } else {
    container.classList.add('expanded');
    btnEl.innerHTML = 'Hide Solution ▴';
    const img = container.querySelector('.sol-img');
    const spinner = container.querySelector('.sol-spinner');
    const errEl = container.querySelector('.sol-error');
    if (img && !img.src) {
      spinner.style.display = 'block';
      img.src = img.dataset.src;
      img.onload = function () {
        spinner.style.display = 'none';
        img.style.display = 'block';
        container.style.maxHeight = img.scrollHeight + 100 + 'px';
      };
      img.onerror = function () {
        spinner.style.display = 'none';
        if (errEl) errEl.style.display = 'block';
      };
    } else {
      container.style.maxHeight = (img ? img.scrollHeight + 100 : 1000) + 'px';
    }
  }
};
window.backToResultsList = function backToResultsList() {
  nav(APP_STATE.lastResultSource === 'era' ? 'era' : 'examhall');
};
function ensureCalendarDetailModal() {
  const dialog = createStudyDialog({id:'calendar-detail-modal-backdrop',titleId:'calendar-detail-name',title:'Exam details',eyebrow:'YOUR EXAM BRIEF',bodyId:'calendar-detail-body',actions:`<span id="calendar-detail-badge" class="calendar-status"></span><button id="calendar-detail-print-btn" class="theme-mode-btn">Download PDF / Print</button>`,content:`<div class="exam-brief-layout"><aside class="exam-brief-sidebar"><div id="calendar-detail-dateplate" class="calendar-date-plate" aria-hidden="true"></div><dl class="exam-brief-facts"><div><dt>Date & time</dt><dd id="calendar-detail-date"></dd></div><div><dt>Venue</dt><dd id="calendar-detail-venue"></dd></div><div><dt>Exam mode</dt><dd id="calendar-detail-mode"></dd></div></dl></aside><section class="exam-brief-syllabus"><header><span class="eyebrow">PREPARATION</span><h3>What’s on the paper</h3><p id="calendar-detail-syllabus-count"></p></header><div id="calendar-detail-syllabus-list"></div></section></div>`});
  dialog.classList.add('calendar-brief-dialog');
}
window.closeCalendarDetailModal = function closeCalendarDetailModal() {
  closeStudyDialog(document.getElementById('calendar-detail-modal-backdrop'));
};
window.printCalendarDetail = function printCalendarDetail(index) {
  const t = APP_STATE.calendarEntries[Number(index)];
  if (!t) return;
  const venue = t.venue ? t.venue : 'N/A';
  const syllabusLines = Array.isArray(t.syllabusLines) && t.syllabusLines.length ? t.syllabusLines : ['N/A'];
  const modeText = t.mode ? t.mode : 'N/A';
  const dateTimeText = formatDateTimeLabel(t.dateTime);
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Popup blocked! Please allow popups to download/print the PDF.');
    return;
  }
  const syllabusHtml = syllabusLines.map(line => `<li style="margin-bottom: 8px;">${escapeHtml(line)}</li>`).join('');
  const docHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Exam Calendar - ${escapeHtml(t.name)}</title>
      <style>
        body {
          background: #ffffff;
          color: #000000;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
          margin: 0;
          padding: 40px;
          line-height: 1.5;
        }
        .container {
          max-width: 800px;
          margin: 0 auto;
          border: 2px solid #000000;
          padding: 30px;
          background: #ffffff;
        }
        .header {
          border-bottom: 3px solid #000000;
          padding-bottom: 20px;
          margin-bottom: 30px;
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
        }
        .header h1 {
          margin: 0;
          font-size: 26px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .header p {
          margin: 5px 0 0 0;
          font-size: 13px;
          color: #555555;
          font-weight: 500;
        }
        .badge {
          border: 2px solid #000000;
          padding: 4px 10px;
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          background: #ffffff;
          display: inline-block;
        }
        .meta-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 30px;
        }
        .meta-table td {
          padding: 12px;
          border: 1px solid #000000;
          font-size: 14px;
        }
        .meta-table td.label {
          background: #f2f2f2;
          font-weight: 700;
          width: 25%;
          text-transform: uppercase;
          font-size: 12px;
          letter-spacing: 0.5px;
        }
        .meta-table td.value {
          font-weight: 600;
        }
        .section-title {
          font-size: 16px;
          font-weight: 700;
          text-transform: uppercase;
          border-bottom: 2px solid #000000;
          padding-bottom: 8px;
          margin-top: 0;
          margin-bottom: 16px;
          letter-spacing: 0.5px;
        }
        .syllabus-box {
          border: 1px solid #000000;
          padding: 20px;
          background: #ffffff;
        }
        .syllabus-list {
          margin: 0;
          padding-left: 20px;
          font-size: 14px;
        }
        .footer {
          border-top: 1px solid #dddddd;
          padding-top: 15px;
          margin-top: 40px;
          text-align: center;
          font-size: 11px;
          color: #666666;
        }
        @media print {
          body {
            padding: 0;
          }
          .container {
            border: none;
            padding: 0;
          }
        }
        body { color:#302a39; font-family:Arial,sans-serif; }
        .container {border:1px solid #e7e1dd;border-radius:20px;padding:32px;}
        .header {border-bottom:1px solid #e7e1dd;align-items:center;}
        .header h1 {font-size:30px;font-weight:600;text-transform:none;letter-spacing:-.6px;}
        .badge {border:0;border-radius:8px;background:#ebe3f6;color:#664599;text-transform:none;padding:8px 12px;}
        .meta-table td {border-color:#e7e1dd;padding:15px;}
        .meta-table td.label {background:#f6f3ef;text-transform:none;letter-spacing:0;font-weight:500;}
        .section-title {border:0;text-transform:none;letter-spacing:0;font-size:19px;}
        .syllabus-box {border-color:#e7e1dd;border-radius:14px;}
        @media print { .container {border:0;border-radius:0;padding:0;} }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div>
            <h1>Exam Details</h1>
            <p>ntsc. / Your exam schedule</p>
          </div>
          <div>
            <span class="badge">Schedule copy</span>
          </div>
        </div>

        <table class="meta-table">
          <tr>
            <td class="label">Exam Name</td>
            <td class="value" style="font-size:16px">${escapeHtml(t.name)}</td>
          </tr>
          <tr>
            <td class="label">Date & Time</td>
            <td class="value">${escapeHtml(dateTimeText)}</td>
          </tr>
          <tr>
            <td class="label">Venue</td>
            <td class="value" style="white-space:pre-wrap">${escapeHtml(venue)}</td>
          </tr>
          <tr>
            <td class="label">Mode</td>
            <td class="value">${escapeHtml(modeText)}</td>
          </tr>
        </table>

        <div class="syllabus-box">
          <h2 class="section-title">Syllabus</h2>
          <ul class="syllabus-list">
            ${syllabusHtml}
          </ul>
        </div>

        <div class="footer">
          Generated on ${new Date().toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  })} · ntsc.
        </div>
      </div>
      <script>
        window.onload = function() {
          setTimeout(function() {
            window.print();
          }, 300);
        };
      </script>
    </body>
    </html>
  `;
  printWindow.document.open();
  printWindow.document.write(docHtml);
  printWindow.document.close();
};
window.openCalendarTest = function openCalendarTest(index) {
  const t = APP_STATE.calendarEntries[Number(index)];
  if (!t) {
    alert('Invalid calendar index');
    return;
  }
  ensureCalendarDetailModal();
  const backdrop = document.getElementById('calendar-detail-modal-backdrop');
  if (!backdrop) return;
  const status = getCalendarExamStatus(t.dateTime);
  const badge = document.getElementById('calendar-detail-badge');
  badge.textContent = status.label;
  badge.className = `calendar-status ${status.key}`;
  document.getElementById('calendar-detail-name').textContent = t.name;
  document.getElementById('calendar-detail-dateplate').innerHTML = buildCalendarDatePlate(t.dateTime);
  document.getElementById('calendar-detail-date').textContent = formatDateTimeLabel(t.dateTime);
  document.getElementById('calendar-detail-venue').textContent = t.venue || 'Venue not announced';
  document.getElementById('calendar-detail-mode').textContent = t.mode || 'Mode not specified';
  const lines = Array.isArray(t.syllabusLines) ? t.syllabusLines : syllabusToLines(t.syllabus || '');
  const subjects = parseSyllabusSubjects(lines.join('\n'));
  document.getElementById('calendar-detail-syllabus-count').textContent = subjects.length ? `${subjects.reduce((sum,subject)=>sum+subject.lines.length,0)} listed topics · as supplied in the schedule` : 'Check back when the schedule is updated.';
  document.getElementById('calendar-detail-syllabus-list').innerHTML = subjects.length ? subjects.map((subject,index)=>`<section class="brief-subject"><h4><span>${String(index+1).padStart(2,'0')}</span>${escapeHtml(subject.subject)}</h4><ul>${subject.lines.map(line=>`<li>${escapeHtml(line)}</li>`).join('')}</ul></section>`).join('') : '<div class="brief-empty">No syllabus has been published for this exam yet.</div>';

  // Hook up print button click handler
  const printBtn = document.getElementById('calendar-detail-print-btn');
  if (printBtn) {
    printBtn.onclick = function () {
      printCalendarDetail(index);
    };
  }

  openStudyDialog(backdrop);
};
function ensureCourseDetailModal() {
  createStudyDialog({id:'course-detail-modal-backdrop',titleId:'course-detail-modal-title',title:'Course details',eyebrow:'YOUR COURSES',bodyId:'course-detail-modal-body'});
}
function closeCourseDetailModal() { closeStudyDialog(document.getElementById('course-detail-modal-backdrop')); }
function buildCourseDetailBodyHtml(d) {
  if (!d) return '<div class="empty">No details returned.</div>';
  const facts = [['Medium',d.courseMedium],['Start date',d.startDate],['Expiry date',d.expiryDate],['Batch',d.batchName ? `${d.batchName}${d.batchId || d.classId ? ` (${d.batchId || d.classId})` : ''}` : ''],['Registration',d.registrationNo]];
  const image = d.detailImage || d.image;
  const fees = d.courseFees;
  const price = fees?.displayPrice ?? fees?.price;
  return `${image ? `<img class="course-detail-image" src="${escapeHtml(image)}" alt="Course cover">` : ''}<dl class="detail-facts">${facts.filter(([,value]) => value != null && value !== '').map(([label,value])=>`<div><dt>${label}</dt><dd>${escapeHtml(value)}</dd></div>`).join('')}${price != null ? `<div><dt>Course fee</dt><dd>${escapeHtml(price)} ${fees.displayPrice != null && fees.price != null && Number(fees.displayPrice)!==Number(fees.price) ? `<s>${escapeHtml(fees.price)}</s>` : ''}</dd></div>` : ''}</dl>${d.isLive ? '<p class="detail-live">Live course</p>' : ''}${Array.isArray(d.campus) && d.campus.length ? `<section class="detail-section"><h3>Campuses</h3><ul>${d.campus.map(c=>`<li>${escapeHtml(c.campusName || '')}</li>`).join('')}</ul></section>` : ''}${d.videoUrl ? `<a class="theme-mode-btn" href="${escapeHtml(d.videoUrl)}" target="_blank" rel="noopener noreferrer">Watch course video ↗</a>` : ''}${d.scholarshipDescription ? `<section class="detail-section course-detail-prose"><h3>Scholarships</h3>${d.scholarshipDescription}</section>` : ''}${d.description ? `<section class="detail-section course-detail-prose"><h3>About this course</h3>${d.description}</section>` : ''}`;
}
window.openCourseDetail = async function openCourseDetail(courseId) {
  const id = Number(courseId);
  if (!id || !API_CONFIG.token) return;
  ensureCourseDetailModal();
  const backdrop = document.getElementById('course-detail-modal-backdrop');
  const body = document.getElementById('course-detail-modal-body');
  const titleEl = document.getElementById('course-detail-modal-title');
  if (!backdrop || !body) return;
  body.innerHTML = '<div class="empty">Loading course…</div>';
  if (titleEl) titleEl.textContent = 'Course details';
  openStudyDialog(backdrop);
  body.dataset.courseId = String(id);
  try {
    const d = await fetchCourseDetail(API_CONFIG.token, id);
    if (body.dataset.courseId !== String(id) || !backdrop.open) return;
    if (!d) {
      body.innerHTML = '<div class="empty">Could not load this course. It may be unavailable or your session may have expired.</div>';
      return;
    }
    if (titleEl) titleEl.textContent = d.title || 'Course details';
    body.innerHTML = buildCourseDetailBodyHtml(d);
  } catch (err) {
    body.innerHTML = `<div class="empty">${escapeHtml((err === null || err === void 0 ? void 0 : err.message) || 'Failed to load course')}</div>`;
  }
};
