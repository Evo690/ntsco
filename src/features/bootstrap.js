/* --- BOOTSTRAP / DATA LOADING --- */

async function refreshDashboardForcedStats() {
  const tests = (APP_STATE.eraTests || []).filter(t => {
    var _t$appeared;
    return (t === null || t === void 0 || (_t$appeared = t.appeared) === null || _t$appeared === void 0 ? void 0 : _t$appeared.examId) || (t === null || t === void 0 ? void 0 : t.id) || (t === null || t === void 0 ? void 0 : t.testPaperId);
  }).sort((a, b) => new Date(b.examDate || b.testDate || b.startDate || 0) - new Date(a.examDate || a.testDate || a.startDate || 0));
  let summary = null;
  for (const test of tests.slice(0, 8)) {
    var _appeared2, _analysis5, _ref7, _ref8, _ref9, _analysis$batchRank, _appeared3, _appeared4, _ref0, _analysis$result$tota, _appeared5, _ref1, _analysis$result$tota2, _appeared6, _analysis$batchRank2;
    const testId = test.id || test.testPaperId;
    let appeared = test.appeared || null;
    if (!appeared && testId) {
      appeared = await fetchAppearedResult(API_CONFIG.token, testId);
      if (appeared) {
        test.appeared = appeared;
      }
    }
    const examId = (_appeared2 = appeared) === null || _appeared2 === void 0 ? void 0 : _appeared2.examId;
    if (!examId) continue;
    const cacheKey = `dash:${examId}`;
    let analysis = APP_STATE.resultCache[cacheKey];
    if (!analysis) {
      analysis = await fetchResultAnalysis(API_CONFIG.token, examId);
      if (analysis) APP_STATE.resultCache[cacheKey] = analysis;
    }
    if (!((_analysis5 = analysis) !== null && _analysis5 !== void 0 && _analysis5.result)) continue;
    const rankVal = (_ref7 = (_ref8 = (_ref9 = (_analysis$batchRank = analysis.batchRank) !== null && _analysis$batchRank !== void 0 ? _analysis$batchRank : analysis.rank) !== null && _ref9 !== void 0 ? _ref9 : (_appeared3 = appeared) === null || _appeared3 === void 0 ? void 0 : _appeared3.batchRank) !== null && _ref8 !== void 0 ? _ref8 : (_appeared4 = appeared) === null || _appeared4 === void 0 ? void 0 : _appeared4.rank) !== null && _ref7 !== void 0 ? _ref7 : null;
    summary = {
      testName: analysis.testName || test.testName || 'Latest Test',
      marks: (_ref0 = (_analysis$result$tota = analysis.result.totalMarks) !== null && _analysis$result$tota !== void 0 ? _analysis$result$tota : (_appeared5 = appeared) === null || _appeared5 === void 0 ? void 0 : _appeared5.totalMarks) !== null && _ref0 !== void 0 ? _ref0 : null,
      totalMarks: (_ref1 = (_analysis$result$tota2 = analysis.result.totalSubjectMarks) !== null && _analysis$result$tota2 !== void 0 ? _analysis$result$tota2 : (_appeared6 = appeared) === null || _appeared6 === void 0 ? void 0 : _appeared6.totalSubjectMarks) !== null && _ref1 !== void 0 ? _ref1 : null,
      rank: rankVal,
      batchRank: (_analysis$batchRank2 = analysis.batchRank) !== null && _analysis$batchRank2 !== void 0 ? _analysis$batchRank2 : rankVal
    };

    break;
  }
  APP_STATE.dashboardForcedStats = summary;
  updateDashboardWidgets();
}
async function refreshPortalDataInBackground() {
  if (document.visibilityState === 'hidden') return;
  if (!API_CONFIG.token) return;
  if (APP_STATE.isRefreshing) return;
  APP_STATE.isRefreshing = true;
  try {
    var _document$querySelect3;
    const activePage = ((_document$querySelect3 = document.querySelector('.page.active')) === null || _document$querySelect3 === void 0 || (_document$querySelect3 = _document$querySelect3.id) === null || _document$querySelect3 === void 0 ? void 0 : _document$querySelect3.replace('page-', '')) || 'dashboard';
    await ensureDataForPage(activePage, true);
    if (activePage === 'timetable' || activePage === 'dashboard') {
      loadTtBatches();
      loadCurrentAttendance();
    }
    scanAndUploadOnlineTests();
    setSyncPill('live', `Live · ${formatRelativeTime(APP_STATE.lastSyncAt || Date.now())}`);
  } catch (_) {
    const hadCache = Boolean(readPortalCache());
    setSyncPill(hadCache ? 'cached' : 'offline', hadCache ? 'Offline · showing cache' : 'Offline');
  } finally {
    APP_STATE.isRefreshing = false;
  }
}
function startBackgroundRefreshLoop() {
  if (window.__fyRefreshLoopStarted) return;
  window.__fyRefreshLoopStarted = true;
  window.setInterval(refreshPortalDataInBackground, PORTAL_REFRESH_INTERVAL_MS);
}
async function loadPortalData() {
  if (!API_CONFIG.token) return;

  // Resolve practice access first
  const hasAccess = await checkPracticeAccess();
  updatePracticeAccessUI(hasAccess);
  chemReloadUserPracticeData();
  cleanupLegacyKeys();
  cleanupOtherUsersCaches();
  initTopbarEnhancements();
  renderSubnav('dashboard');
  renderGlobalSkeletons();
  setUserProfileDetails();
  chemTrackUserActivity(); // Track Unique Monthly Active Users (MAU)
  chemLoadVisitorStat(); // Load unique monthly visitor stats
  scanAndUploadOnlineTests(); // Automatically scan latest 10 tests for online exams and sync to Supabase
  const hasCache = hydratePortalCache();
  if (hasCache) {
    refreshActivePageData();
    refreshDashboardForcedStats();
  }
  try {
    // Initialize dashboard-critical data first; other tabs load on-demand.
    initTtDropdowns();
    loadTtBatches();
    initExamDropdowns();
    initEraDropdowns();
    loadCurrentAttendance();
    await ensureDashboardData(false);
    setSyncPill('live', `Live · ${formatRelativeTime(APP_STATE.lastSyncAt || Date.now())}`);
  } catch (err) {
    if (typeof isAuthError === 'function' && isAuthError(err)) {
      throw err; // Always bubble auth failure to trigger auto-relogin!
    }
    const hasCache = Boolean(readPortalCache());
    if (!hasCache) {
      renderApiError((err === null || err === void 0 ? void 0 : err.message) || 'Failed to load API data');
      setSyncPill('offline', 'Offline');
      throw err; // Throw error to trigger auto-relogin if token expired
    }
    setSyncPill('cached', 'Offline · showing cache');
  } finally {
    startBackgroundRefreshLoop();
  }
}

