window.setThemeMode = function setThemeMode(mode) {
  portalAppearance.setMode(mode);
  renderThemeSettings();
};
window.toggleThemeMode = function toggleThemeMode() {
  const isLight = document.body.classList.contains('light-mode');
  setThemeMode(isLight ? 'dark' : 'light');
};
function applyThemePreset(presetId, persist = true) {
  APP_STATE.themePreset = portalAppearance.setPreset(presetId, persist);
}
window.selectThemePreset = function selectThemePreset(presetId) {
  applyThemePreset(presetId, true);
  renderThemeSettings();
};
window.resetAppearance = function resetAppearance() {
  setThemeMode('light');
  applyThemePreset('default', true);
  renderThemeSettings();
};
window.clearLocalCache = function clearLocalCache() {
  localStorage.removeItem(getUserStorageKey(PORTAL_CACHE_KEY));

  APP_STATE.loadedSections = {
    dashboard: false,
    courses: false,
    messages: false,
    notices: false,
    study: false
  };
  setSyncPill('cached', 'Local cache cleared');
};
window.hardRefreshAndClearCache = async function hardRefreshAndClearCache() {
  localStorage.removeItem(getUserStorageKey(PORTAL_CACHE_KEY));
  Object.keys(localStorage).filter(key => key.startsWith('fy_timetable_cache_') || key.includes('_fy_timetable_cache_')).forEach(key => localStorage.removeItem(key));
  if ('caches' in window) {
    try {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map(name => caches.delete(name)));
    } catch (_) {}
  }
  setSyncPill('live', 'Refreshing...');
  window.location.reload();
};
window.refreshCurrentSection = async function refreshCurrentSection() {
  var _document$querySelect2;
  const activePage = ((_document$querySelect2 = document.querySelector('.page.active')) === null || _document$querySelect2 === void 0 || (_document$querySelect2 = _document$querySelect2.id) === null || _document$querySelect2 === void 0 ? void 0 : _document$querySelect2.replace('page-', '')) || 'dashboard';
  const targets = activePage === 'settings' ? ['dashboard', 'courses', 'messages', 'notices', 'study'] : [activePage];
  await Promise.all(targets.map(page => ensureDataForPage(page, true)));
  if (API_CONFIG.token && ['settings', 'timetable'].includes(activePage)) await changeTtBatch(API_CONFIG.classId);
  scanAndUploadOnlineTests();
};
function renderThemeSettings() {
  const root = document.getElementById('theme-preset-grid');
  if (!root) return;
  const darkBtn = document.getElementById('theme-mode-dark');
  const lightBtn = document.getElementById('theme-mode-light');
  const isLight = document.body.classList.contains('light-mode');
  if (darkBtn) darkBtn.classList.toggle('active', !isLight);
  if (lightBtn) lightBtn.classList.toggle('active', isLight);
  const active = APP_STATE.themePreset || 'default';
  root.innerHTML = THEME_PRESETS.map(p => `
      <button class="theme-preset-btn ${active === p.id ? 'active' : ''}" onclick="selectThemePreset('${p.id}')">
        <div class="theme-preset-name">${escapeHtml(!isLight && p.id === "default" ? "Sea glass" : p.label)}</div>
        <div class="theme-preset-preview">
          ${(isLight ? p.colors : ({ default: ["#8bd5be", "#243c38", "#1a2326"], ocean: ["#8dbbda", "#243642", "#1a2326"], purple: ["#d3a4de", "#463349", "#1a2326"], emerald: ["#8ac5a6", "#243b30", "#1a2326"] }[p.id] || p.colors)).map(c => `<span class="theme-dot" style="background:${c}"></span>`).join('')}
        </div>
      </button>
    `).join('');
}

function updateBrowserThemeColor() {
  let meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) { meta = document.createElement('meta'); meta.name = 'theme-color'; document.head.append(meta); }
  meta.content = getComputedStyle(document.body).getPropertyValue('--bg').trim();
}
new MutationObserver(updateBrowserThemeColor).observe(document.body, {attributes:true, attributeFilter:['class']});
updateBrowserThemeColor();
