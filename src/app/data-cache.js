const PORTAL_CACHE_KEY = 'fy_portal_cache_v2';
const PORTAL_CACHE_TTL_MS = 15 * 60 * 1000;
const PORTAL_REFRESH_INTERVAL_MS = 2 * 60 * 1000;
function debounce(fn, delay) {
  let timeout;
  return function (...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn.apply(this, args), delay);
  };
}
function formatRelativeTime(ts) {
  const deltaSec = Math.max(0, Math.floor((Date.now() - Number(ts || 0)) / 1000));
  if (deltaSec < 10) return 'just now';
  if (deltaSec < 60) return `${deltaSec}s ago`;
  if (deltaSec < 3600) return `${Math.floor(deltaSec / 60)}m ago`;
  return `${Math.floor(deltaSec / 3600)}h ago`;
}
function setSyncPill(mode, text) {
  const pill = document.getElementById('sync-pill');
  if (!pill) return;
  pill.classList.remove('cached', 'offline');
  if (mode === 'cached') pill.classList.add('cached');
  if (mode === 'offline') pill.classList.add('offline');
  pill.textContent = text || (mode === 'live' ? 'Live' : mode === 'cached' ? 'Cached' : 'Offline');
}
function readPortalCache() {
  try {
    const raw = localStorage.getItem(getUserStorageKey(PORTAL_CACHE_KEY));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!(parsed !== null && parsed !== void 0 && parsed.snapshotAt) || !(parsed !== null && parsed !== void 0 && parsed.data)) return null;
    return parsed;
  } catch (_) {
    return null;
  }
}
function writePortalCache() {
  try {
    const payload = {
      snapshotAt: Date.now(),
      data: {
        tests: APP_STATE.tests || [],
        eraTests: APP_STATE.eraTests || [],
        calendarEntries: APP_STATE.calendarEntries || [],
        timetable: APP_STATE.timetable || [],
        courses: APP_STATE.courses || [],
        messageGroups: APP_STATE.messageGroups || [],
        notices: APP_STATE.notices || [],
        studyContent: APP_STATE.studyContent || [],
        studyTotal: APP_STATE.studyTotal || 0,
        examTotal: APP_STATE.examTotal || 0,
        eraTotal: APP_STATE.eraTotal || 0
      }
    };
    localStorage.setItem(getUserStorageKey(PORTAL_CACHE_KEY), JSON.stringify(payload));
    APP_STATE.lastSyncAt = payload.snapshotAt;
  } catch (_) {}
}
function hydratePortalCache() {
  const cached = readPortalCache();
  if (!cached) return false;
  APP_STATE.tests = Array.isArray(cached.data.tests) ? cached.data.tests : [];
  APP_STATE.eraTests = Array.isArray(cached.data.eraTests) ? cached.data.eraTests : [];
  APP_STATE.calendarEntries = Array.isArray(cached.data.calendarEntries) ? cached.data.calendarEntries : [];
  if (!APP_STATE.calendarEntries.length && typeof readFullExamSchedules === 'function') {
    const localSchedules = readFullExamSchedules();
    if (localSchedules.length) APP_STATE.calendarEntries = localSchedules;
  }
  APP_STATE.timetable = Array.isArray(cached.data.timetable) ? cached.data.timetable : [];
  APP_STATE.courses = Array.isArray(cached.data.courses) ? cached.data.courses : [];
  APP_STATE.messageGroups = Array.isArray(cached.data.messageGroups) ? cached.data.messageGroups : [];
  APP_STATE.notices = Array.isArray(cached.data.notices) ? cached.data.notices : [];
  APP_STATE.studyContent = Array.isArray(cached.data.studyContent) ? cached.data.studyContent : [];
  APP_STATE.studyTotal = Number(cached.data.studyTotal || APP_STATE.studyContent.length || 0);
  APP_STATE.examTotal = Number(cached.data.examTotal || APP_STATE.tests.length || 0);
  APP_STATE.eraTotal = Number(cached.data.eraTotal || APP_STATE.eraTests.length || 0);
  APP_STATE.lastSyncAt = Number(cached.snapshotAt || Date.now());
  APP_STATE.loadedSections.dashboard = APP_STATE.tests.length > 0 || APP_STATE.calendarEntries.length > 0;
  APP_STATE.loadedSections.courses = APP_STATE.courses.length > 0;
  APP_STATE.loadedSections.messages = APP_STATE.messageGroups.length > 0;
  APP_STATE.loadedSections.notices = APP_STATE.notices.length > 0;
  APP_STATE.loadedSections.study = APP_STATE.studyContent.length > 0;
  renderExamHall(APP_STATE.tests);
  renderEraTests(APP_STATE.eraTests);
  renderExamCalendar(APP_STATE.calendarEntries);
  renderTimetable(APP_STATE.timetable);
  renderTodayClasses(APP_STATE.timetable);
  renderCourses(APP_STATE.courses);
  renderMessageGroups(APP_STATE.messageGroups);
  renderNotices(APP_STATE.notices);
  renderStudyContent(APP_STATE.studyContent, APP_STATE.studyTotal);
  updateDashboardWidgets();
  const isStale = Date.now() - APP_STATE.lastSyncAt > PORTAL_CACHE_TTL_MS;
  setSyncPill('cached', isStale ? `Cached · stale` : `Cached · ${formatRelativeTime(APP_STATE.lastSyncAt)}`);
  return true;
}
function getTimetableCacheKey() {
  return getUserStorageKey(`fy_timetable_cache_${API_CONFIG.academicYear}_${API_CONFIG.classId || 'none'}`);
}
function readTimetableCache() {
  try {
    const raw = localStorage.getItem(getTimetableCacheKey());
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed === null || parsed === void 0 ? void 0 : parsed.items) ? parsed.items : null;
  } catch (_) {
    return null;
  }
}
function writeTimetableCache(items) {
  try {
    localStorage.setItem(getTimetableCacheKey(), JSON.stringify({
      savedAt: Date.now(),
      items: Array.isArray(items) ? items : []
    }));
  } catch (_) {}
}
function renderGlobalSkeletons() {
  const targets = [['dashboard-upcoming-list', 5], ['today-classes-list', 3], ['courses-grid', 6], ['msg-group-list', 5], ['examhall-list', 4], ['era-list', 4], ['notice-list', 4], ['study-list', 4]];
  targets.forEach(([id, count]) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.innerHTML = `<div class="skeleton-stack">${Array.from({
      length: count
    }).map(() => '<div class="skeleton"></div>').join('')}</div>`;
  });
}
function getFilteredCommands(query) {
  const q = String(query || '').trim().toLowerCase();
  let cmds = COMMANDS;
  if (hasPracticeAccessCache === false) {
    cmds = cmds.filter(c => c.id !== 'go-practice');
  }
  if (!q) return cmds;
  return cmds.filter(c => `${c.label} ${c.meta}`.toLowerCase().includes(q));
}
function renderCommandPaletteList(query = '') {
  const list = document.getElementById('command-list');
  if (!list) return;
  const results = getFilteredCommands(query);
  if (!results.length) {
    list.innerHTML = '<div class="empty" style="padding:18px 0">No matching commands</div>';
    return;
  }
  list.innerHTML = results.map((c, idx) => `<button class="command-item ${idx === 0 ? 'active' : ''}" data-command-id="${c.id}"><span>${escapeHtml(c.label)}</span><span class="command-meta">${escapeHtml(c.meta)}</span></button>`).join('');
  list.querySelectorAll('.command-item').forEach(btn => {
    btn.addEventListener('click', () => {
      const command = COMMANDS.find(c => c.id === btn.dataset.commandId);
      if (!command) return;
      closeCommandPalette();
      command.run();
    });
  });
}
window.openCommandPalette = function openCommandPalette() {
  const backdrop = document.getElementById('command-palette-backdrop');
  const input = document.getElementById('command-input');
  if (!backdrop || !input) return;
  backdrop.style.display = 'flex';
  input.value = '';
  renderCommandPaletteList('');
  setTimeout(() => input.focus(), 0);
};
window.closeCommandPalette = function closeCommandPalette(event) {
  if (event && event.target && event.target.id !== 'command-palette-backdrop') return;
  const backdrop = document.getElementById('command-palette-backdrop');
  if (backdrop) backdrop.style.display = 'none';
};
function refreshActivePageData() {
  var _document$querySelect;
  const activePage = ((_document$querySelect = document.querySelector('.page.active')) === null || _document$querySelect === void 0 || (_document$querySelect = _document$querySelect.id) === null || _document$querySelect === void 0 ? void 0 : _document$querySelect.replace('page-', '')) || 'dashboard';
  if (activePage === 'dashboard') {
    updateDashboardWidgets();
    renderTodayClasses(APP_STATE.timetable || []);
  }
  if (activePage === 'courses') renderCourses(APP_STATE.courses || []);
  if (activePage === 'messages') renderMessageGroups(APP_STATE.messageGroups || []);
  if (activePage === 'timetable') {
    renderTimetable(APP_STATE.timetable || []);
    renderTodayClasses(APP_STATE.timetable || []);
  }
  if (activePage === 'examhall') renderExamHall(APP_STATE.tests || []);
  if (activePage === 'era') renderEraTests(APP_STATE.eraTests || []);
  if (activePage === 'examcal') renderExamCalendar(APP_STATE.calendarEntries || []);
  if (activePage === 'notices') renderNotices(APP_STATE.notices || []);
  if (activePage === 'study') renderStudyContent(APP_STATE.studyContent || [], APP_STATE.studyTotal || 0);
  scanAndUploadOnlineTests();
  if (activePage === 'practice') {
    checkPracticeAccess().then(hasAccess => {
      if (hasAccess) {
        chemInitApp();
        showModeSelection();
      } else {
        nav('dashboard');
      }
    });
  }
  if (activePage === 'settings') {
    renderThemeSettings();
  }
}
async function ensureDashboardData(force = false) {
  const hasDashboardData = (APP_STATE.tests || []).length > 0 || (APP_STATE.calendarEntries || []).length > 0;
  if (APP_STATE.loadedSections.dashboard && hasDashboardData && !force) {
    updateDashboardWidgets();
    refreshDashboardForcedStats();
  }
  if (!API_CONFIG.token) return;
  const testsPage = await fetchTestsPage(API_CONFIG.token, 1, APP_STATE.testPageSize);
  const tests = testsPage.tests || [];
  scanAndUploadOnlineTests(tests);
  const [calendar, enriched, eraEnriched] = await Promise.all([fetchCalendar(API_CONFIG.token), enrichExamTests(tests), enrichEraTests(tests)]);
  APP_STATE.examPage = 1;
  APP_STATE.eraPage = 1;
  APP_STATE.examTotal = testsPage.total || enriched.length;
  APP_STATE.eraTotal = testsPage.total || eraEnriched.length;
  APP_STATE.tests = enriched;
  APP_STATE.eraTests = eraEnriched;
  APP_STATE.calendarEntries = calendar;
  scanAndUploadExamCalendar(calendar);
  APP_STATE.loadedSections.dashboard = true;
  renderExamHall(APP_STATE.tests);
  renderEraTests(APP_STATE.eraTests);
  renderExamCalendar(APP_STATE.calendarEntries);
  updateDashboardWidgets();
  await refreshDashboardForcedStats();
  writePortalCache();
}
async function ensureCoursesData(force = false) {
  if (APP_STATE.loadedSections.courses && !force) renderCourses(APP_STATE.courses || []);
  APP_STATE.courses = await fetchCourses(API_CONFIG.token);
  APP_STATE.loadedSections.courses = true;
  renderCourses(APP_STATE.courses);
  writePortalCache();
}
async function ensureMessagesData(force = false) {
  if (APP_STATE.loadedSections.messages && !force) renderMessageGroups(APP_STATE.messageGroups || []);
  APP_STATE.messageGroups = await fetchMessageGroups(API_CONFIG.token);
  APP_STATE.loadedSections.messages = true;
  renderMessageGroups(APP_STATE.messageGroups);
  writePortalCache();
}
async function ensureNoticesData(force = false) {
  if (APP_STATE.loadedSections.notices && !force) renderNotices(APP_STATE.notices || []);
  APP_STATE.notices = await fetchNotices(API_CONFIG.token);
  APP_STATE.loadedSections.notices = true;
  renderNotices(APP_STATE.notices);
  writePortalCache();
}
async function ensureStudyData(force = false) {
  if (APP_STATE.loadedSections.study && !force) renderStudyContent(APP_STATE.studyContent || [], APP_STATE.studyTotal || 0);
  APP_STATE.studyPage = 1;
  const studyRes = await fetchStudyContent(API_CONFIG.token, APP_STATE.studyPage);
  APP_STATE.studyContent = studyRes.data;
  APP_STATE.studyTotal = studyRes.total || studyRes.data.length;
  APP_STATE.loadedSections.study = true;
  renderStudyContent(APP_STATE.studyContent, APP_STATE.studyTotal);
  writePortalCache();
}
async function ensureDataForPage(pageId, force = false) {
  if (!API_CONFIG.token) return;
  try {
    if (['dashboard', 'examcal', 'examhall', 'era'].includes(pageId)) await ensureDashboardData(force);
    if (pageId === 'courses') await ensureCoursesData(force);
    if (pageId === 'messages') await ensureMessagesData(force);
    if (pageId === 'notices') await ensureNoticesData(force);
    if (pageId === 'study') await ensureStudyData(force);
  } catch (err) {
    setSyncPill('offline', 'Offline');
  }
}
function renderSubnav(pageId) {
  const container = document.getElementById('subnav');
  if (!container) return;
  if (pageId === 'neural') {
    const selected = APP_STATE.activeSubTabs.neural || 'predictor';
    document.getElementById('page-neural').dataset.subview = selected;
    document.querySelectorAll('.model-tab').forEach(button => {
      const active = button.dataset.view === selected;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    container.innerHTML = ''; container.style.display = 'none'; return;
  }
  const config = SUBNAV_CONFIG[pageId] || [];
  if (!config.length) {
    container.innerHTML = '';
    container.style.display = 'none';
    return;
  }
  container.style.display = 'flex';
  const current = APP_STATE.activeSubTabs[pageId] || config[0].id;
  APP_STATE.activeSubTabs[pageId] = current;
  container.innerHTML = config.map(tab => `<button class="subnav-chip ${current === tab.id ? 'active' : ''}" onclick="setSubTab('${pageId}','${tab.id}')">${escapeHtml(tab.label)}</button>`).join('');
  if (pageId === 'dashboard') {
    const dashboard = document.getElementById('page-dashboard');
    if (dashboard) dashboard.setAttribute('data-subview', current);
  }
  if (pageId === 'neural') {
    const neural = document.getElementById('page-neural');
    if (neural) neural.setAttribute('data-subview', current);
  }
}
window.setSubTab = function setSubTab(pageId, tabId) {
  APP_STATE.activeSubTabs[pageId] = tabId;
  renderSubnav(pageId);
  refreshActivePageData();
};
