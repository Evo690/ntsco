let hasPracticeAccessCache = null;
function updatePracticeAccessUI(hasAccess) {
  const practiceNavItem = document.querySelector('.nav-item[onclick*="practice"]');
  if (practiceNavItem) {
    practiceNavItem.style.display = hasAccess ? '' : 'none';
  }
  const syncBtn = document.getElementById('settings-sync-btn');
  if (syncBtn) {
    syncBtn.style.display = hasAccess ? '' : 'none';
  }
  const practiceCard = document.getElementById('practice-settings-card');
  if (practiceCard) {
    practiceCard.style.display = hasAccess ? '' : 'none';
  }
  const listEditorCard = document.getElementById('list-editor-card');
  if (listEditorCard) {
    listEditorCard.style.display = hasAccess ? '' : 'none';
  }
}
async function checkPracticeAccess() {
  if (hasPracticeAccessCache !== null) {
    return hasPracticeAccessCache;
  }
  const currentClassId = sessionStorage.getItem('fy_class_id') || API_CONFIG.classId;
  if (String(currentClassId) === '813') {
    hasPracticeAccessCache = true;
    return true;
  }
  if (API_CONFIG.token) {
    try {
      const batches = await fetchStudentBatches(API_CONFIG.token, API_CONFIG.academicYear);
      if (Array.isArray(batches)) {
        APP_STATE.batches = batches;
        uploadBatchesToSupabase(batches, API_CONFIG.academicYear);
        if (batches.some(b => String(b.id) === '813')) {
          hasPracticeAccessCache = true;
          return true;
        }
      }
    } catch (e) {
      console.error("Error checking batches API:", e);
    }
  }
  hasPracticeAccessCache = false;
  return false;
}
async function nav(id, el) {
  if (id === 'recordings') { location.href = 'functions/classes.html'; return; }
  // Classes is the student's timetable; recordings are a Settings-only utility.
  if (id === 'classes') id = 'timetable';
  if (id === 'practice') {
    const hasAccess = await checkPracticeAccess();
    if (!hasAccess) {
      if (typeof chemShowToast === 'function') {
        chemShowToast("Chemistry Practice is disabled.");
      } else {
        alert("Chemistry Practice is disabled.");
      }
      return;
    }
    const shell = document.querySelector('.chem-practice-shell');
    const restricted = document.getElementById('chem-practice-restricted');
    if (shell) shell.style.display = 'block';
    if (restricted) restricted.style.display = 'none';
    setSyncPill(navigator.onLine ? 'live' : 'offline', navigator.onLine ? 'Syncing progress...' : 'Offline');
    await chemEnsureSupabase();
    await chemDownloadProgress(false);
    await chemSyncAll(false);
    setSyncPill(navigator.onLine ? 'live' : 'offline', navigator.onLine ? 'Live' : 'Offline');
    showModeSelection();
  }
  const activePageEl = document.querySelector('.page.active');
  const prevPageId = activePageEl ? activePageEl.id.replace('page-', '') : '';
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const msgPage = document.getElementById('page-messages');
  if (msgPage) msgPage.classList.remove('thread-open');
  const page = document.getElementById('page-' + id);
  if (page) page.classList.add('active');
  const targetNav = document.querySelector(`.nav-item[onclick*="'${id === 'timetable' ? 'classes' : id}'"]`) || el;
  if (targetNav) targetNav.classList.add('active');
  const primaryRoute = ['result-detail', 'solutions', 'leaderboard'].includes(id) ? 'era' : id === 'timetable' ? 'classes' : id;
  document.querySelectorAll('.dock-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.page === primaryRoute);
    btn.setAttribute('aria-current', btn.dataset.page === primaryRoute ? 'page' : 'false');
  });
  document.querySelectorAll('.section-nav [data-route]').forEach(button => { button.classList.toggle('active', button.dataset.route === primaryRoute); button.setAttribute('aria-current', button.dataset.route === primaryRoute ? 'page' : 'false'); });
  document.getElementById('page-title').textContent = pages[id] || id;
  renderSubnav(id);
  refreshActivePageData();
  ensureDataForPage(id, false);

  if (id === 'settings') {
    chemLoadVisitorStat();
    updatePLModeUI();
  }
  document.querySelector('.content').scrollTop = 0;
  closeSidebar();
  if (prevPageId === 'practice' && id !== 'practice') {
    const hasAccess = await checkPracticeAccess();
    if (hasAccess) {
      chemSyncAll(false);
    }
  }
  if (id === 'neural') {
    initRankPredictor().catch(() => {});
    initPseudoLeaderboardUI();
    checkShareCooldown();
  }
}
function checkShareCooldown() {
  const button = document.getElementById('neural-anon-btn');
  const status = document.getElementById('neural-status');
  if (!button) return false;
  const cooldownKey = getUserStorageKey('neural_share_cooldown');
  const lastShareTimeStr = localStorage.getItem(cooldownKey);
  if (lastShareTimeStr) {
    const lastShareTime = Number(lastShareTimeStr);
    const diffMs = Date.now() - lastShareTime;
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    if (diffMs < sevenDaysMs) {
      const remainingDays = Math.ceil((sevenDaysMs - diffMs) / (24 * 60 * 60 * 1000));
      button.disabled = true;
      if (status) {
        status.textContent = `You shared performance data recently. Cooldown active. Please wait ${remainingDays} more day(s).`;
      }
      return true;
    }
  }
  button.disabled = false;
  return false;
}
window.sendAnonDataToWorker = async function sendAnonDataToWorker() {
  const button = document.getElementById('neural-anon-btn');
  const status = document.getElementById('neural-status');
  if (!API_CONFIG.token) {
    if (status) status.textContent = 'Login first, then share performance data.';
    return;
  }
  if (checkShareCooldown()) {
    return;
  }
  if (typeof scrapeAllTestResults !== 'function' || typeof cleanScrapedTestsData !== 'function') {
    if (status) status.textContent = 'Scraper or cleaner is not loaded.';
    return;
  }
  const setStatus = message => {
    if (status) status.textContent = message;
  };
  try {
    if (button) {
      button.disabled = true;
      button.textContent = 'Scraping...';
    }
    setStatus('Scraping tests without leaderboard data...');
    const scraped = await scrapeAllTestResults({
      includeLeaderboard: false,
      includeUnpublished: false,
      download: false
    });
    setStatus('Cleaning scraped test data...');
    const cleanedJson = cleanScrapedTestsData(scraped);
    if (button) button.textContent = 'Sending...';
    setStatus(`Sending ${cleanedJson.length} cleaned test records...`);
    const response = await fetch('https://reciver.evodev.workers.dev/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(cleanedJson)
    });
    if (!response.ok) {
      throw new Error(`Worker returned HTTP ${response.status}`);
    }
    const cooldownKey = getUserStorageKey('neural_share_cooldown');
    localStorage.setItem(cooldownKey, String(Date.now()));
    setStatus(`Done. Sent ${cleanedJson.length} cleaned test records.`);
  } catch (err) {
    console.error(err);
    setStatus((err === null || err === void 0 ? void 0 : err.message) || 'Failed to share performance data.');
  } finally {
    if (button) {
      button.textContent = 'Share Performance Analytics';
      checkShareCooldown();
    }
  }
};
window.openEraFromDashboard = function openEraFromDashboard() {
  nav('examcal', document.querySelector('.nav-item[onclick*=examcal]'));
};
function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('overlay').style.display = document.getElementById('sidebar').classList.contains('open') ? 'block' : 'none';
}
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('overlay').style.display = 'none';
}
window.closeMessageThread = function closeMessageThread() {
  const msgPage = document.getElementById('page-messages');
  if (!msgPage) return;
  msgPage.classList.remove('thread-open');
  const title = document.getElementById('msg-thread-title');
  const list = document.getElementById('msg-thread-list');
  if (title) title.textContent = 'Select a conversation';
  if (list) list.innerHTML = '<div class="empty" style="margin:auto">No conversation selected</div>';
};
