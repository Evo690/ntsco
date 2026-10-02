async function nav(id, el) {
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
  if (!document.getElementById('page-' + id)) return;
  const activePageEl = document.querySelector('.page.active');
  const prevPageId = activePageEl ? activePageEl.id.replace('page-', '') : '';
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const msgPage = document.getElementById('page-messages');
  if (msgPage) msgPage.classList.remove('thread-open');
  const page = document.getElementById('page-' + id);
  if (page) page.classList.add('active');
  const primaryPage = ['result-detail', 'leaderboard', 'solutions'].includes(id) ? 'era' : id;
  const navTarget = el || document.querySelector(`.nav-item[data-route="${primaryPage}"]`);
  if (navTarget) navTarget.classList.add('active');
  document.querySelectorAll('.dock-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.page === (id === 'tools' ? 'settings' : primaryPage));
  });
  document.getElementById('page-title').textContent = pages[id] || id;
  renderSubnav(id);
  refreshActivePageData();
  ensureDataForPage(id, false);
  if (id === 'settings') {
    chemLoadVisitorStat();
    updatePLModeUI();
  }
  document.querySelector('.content').scrollTop = 0;
  document.dispatchEvent(new CustomEvent('portal:navigate', { detail: { id } }));
  if (window.innerWidth <= 768) closeSidebar();
  if (prevPageId === 'practice' && id !== 'practice') {
    const hasAccess = await checkPracticeAccess();
    if (hasAccess) {
      chemSyncAll(false);
    }
  }
  if (id === 'neural') {
    // The predictor displays its own load error; keep the workspace usable offline.
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
window.setThemeMode = function setThemeMode(mode) {
  const body = document.body;
  const useLight = mode === 'light';
  body.classList.toggle('light-mode', useLight);
  localStorage.setItem(getUserStorageKey('fy_theme_mode'), useLight ? 'light' : 'dark');
  renderThemeSettings();
};
window.toggleThemeMode = function toggleThemeMode() {
  const isLight = document.body.classList.contains('light-mode');
  setThemeMode(isLight ? 'dark' : 'light');
};
function applyThemePreset(presetId, persist = true) {
  const body = document.body;
  body.classList.remove('theme-ocean', 'theme-purple', 'theme-emerald');
  if (presetId && presetId !== 'default') body.classList.add(`theme-${presetId}`);
  APP_STATE.themePreset = presetId || 'default';
  if (persist) localStorage.setItem(getUserStorageKey('fy_theme_preset'), APP_STATE.themePreset);
}
window.selectThemePreset = function selectThemePreset(presetId) {
  applyThemePreset(presetId, true);
  renderThemeSettings();
};
window.resetAppearance = function resetAppearance() {
  setThemeMode('dark');
  applyThemePreset('default', true);
  renderThemeSettings();
};
function settingsOperationStatus(message, state = '') {
  const status = document.getElementById('settings-operation-status');
  if (status) { status.textContent = message; status.dataset.state = state; }
}
window.clearLocalCache = function clearLocalCache() {
  localStorage.removeItem(getUserStorageKey(PORTAL_CACHE_KEY));
  const suffix = getUserStorageKey('');
  Object.keys(localStorage).filter(key => key.startsWith('fy_timetable_cache_') &&
    (suffix ? key.endsWith(suffix) : /^fy_timetable_cache_\d{4}_[^_]+$/.test(key))
  ).forEach(key => localStorage.removeItem(key));
  APP_STATE.resultCache = {};
  APP_STATE.loadedSections = { dashboard: false, courses: false, messages: false, notices: false, study: false };
  setSyncPill('cached', 'Local cache cleared');
  settingsOperationStatus('Portal cache cleared. Preferences and practice progress kept.', 'success');
};
window.hardRefreshAndClearCache = async function hardRefreshAndClearCache() {
  clearLocalCache();
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
  const activePage = document.querySelector('.page.active')?.id.replace('page-', '') || 'dashboard';
  // Settings has no API section of its own: refresh the exam data it describes.
  if (activePage !== 'settings') {
    await ensureDataForPage(activePage, true);
    return;
  }
  const button = document.getElementById('settings-refresh-btn');
  if (!API_CONFIG.token) { settingsOperationStatus('Sign in to refresh exam data.', 'error'); return; }
  if (button) button.disabled = true;
  settingsOperationStatus('Refreshing papers, results and calendar…');
  try {
    await ensureDashboardData(true);
    settingsOperationStatus('Exam data refreshed.', 'success');
  } catch (error) {
    settingsOperationStatus(error?.message || 'Exam data could not be refreshed. Try again.', 'error');
  } finally {
    if (button) button.disabled = false;
  }
};
function renderThemeSettings() {
  const root = document.getElementById('theme-preset-grid');
  if (!root) return;
  const darkBtn = document.getElementById('theme-mode-dark');
  const lightBtn = document.getElementById('theme-mode-light');
  const isLight = document.body.classList.contains('light-mode');
  if (darkBtn) { darkBtn.classList.toggle('active', !isLight); darkBtn.setAttribute('aria-pressed', String(!isLight)); }
  if (lightBtn) { lightBtn.classList.toggle('active', isLight); lightBtn.setAttribute('aria-pressed', String(isLight)); }
  const active = APP_STATE.themePreset || 'default';
  root.innerHTML = THEME_PRESETS.map(p => `
      <button class="theme-preset-btn ${active === p.id ? 'active' : ''}" aria-pressed="${active === p.id}" onclick="selectThemePreset('${p.id}')">
        <div class="theme-preset-name">${escapeHtml(p.label)}</div>
        <div class="theme-preset-preview">
          ${p.colors.map(c => `<span class="theme-dot" style="background:${c}"></span>`).join('')}
        </div>
      </button>
    `).join('');
}
let chemListEditorTab = 'compounds';
let chemListEditorSearch = '';
let listEditorLoaded = false;
async function renderListEditor() {
  const hasAccess = await checkPracticeAccess();
  if (!hasAccess) {
    const root = document.getElementById('list-editor-root');
    if (root) root.innerHTML = '<div class="empty">Practice access is required to edit these lists.</div>';
    return false;
  }
  await Promise.all([chemInitApp(), reagentInitApp(), pkaInitApp()]);
  const root = document.getElementById('list-editor-root');
  if (!root) return;
  root.innerHTML = `
      <style>
        #list-editor-items::-webkit-scrollbar {
          width: 6px;
        }
        #list-editor-items::-webkit-scrollbar-track {
          background: transparent;
        }
        #list-editor-items::-webkit-scrollbar-thumb {
          background: var(--border);
          border-radius: 3px;
        }
        #list-editor-items::-webkit-scrollbar-thumb:hover {
          background: var(--text3);
        }
      </style>
      <div class="list-editor-header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; gap: 10px; flex-wrap: wrap;">
        <div class="chem-board-tabs" style="margin:0;">
          <button class="chem-tab-btn ${chemListEditorTab === 'compounds' ? 'active' : ''}" id="list-editor-tab-compounds" onclick="setListEditorTab('compounds')">
            Compounds (${chemMyData.myList.length}/${chemAllCompounds.length})
          </button>
          <button class="chem-tab-btn ${chemListEditorTab === 'reagents' ? 'active' : ''}" id="list-editor-tab-reagents" onclick="setListEditorTab('reagents')">
            Reagents (${reagentMyData.myList.length}/${reagentAllReagents.length})
          </button>
          <button class="chem-tab-btn ${chemListEditorTab === 'pka' ? 'active' : ''}" id="list-editor-tab-pka" onclick="setListEditorTab('pka')">
            pKa (${pkaMyData.myList.length}/${pkaAllCompounds.length})
          </button>
        </div>
        <div style="display:flex; gap:8px; align-items:center;">
          <button class="chem-btn chem-btn-ghost" style="min-height:30px; font-size:12px; padding:4px 10px;" onclick="listEditorSelectAll(true)">Select All</button>
          <button class="chem-btn chem-btn-ghost" style="min-height:30px; font-size:12px; padding:4px 10px;" onclick="listEditorSelectAll(false)">Deselect All</button>
        </div>
      </div>
      <div style="margin-bottom:12px;">
        <input type="text" id="list-editor-search" placeholder="Search ${chemListEditorTab === 'compounds' ? 'compounds...' : chemListEditorTab === 'reagents' ? 'reagents...' : 'pKa compounds...'}" 
          style="width: 100%; padding: 10px 14px; border: 1px solid var(--border); border-radius: 8px; background: var(--bg3); color: var(--text); font-family: 'DM Sans', sans-serif; font-size: 13px; outline: none; transition: border-color 0.2s;" 
          value="${escapeHtml(chemListEditorSearch)}" oninput="handleListEditorSearch(this.value)" />
      </div>
      <div id="list-editor-items" style="max-height: 250px; overflow-y: auto; display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 8px; padding: 8px; border: 1px solid var(--border); border-radius: 8px; background: var(--bg2);">
      </div>
    `;
  renderListEditorItems();
  return true;
}
function renderListEditorItems() {
  const container = document.getElementById('list-editor-items');
  if (!container) return;
  const searchLower = chemListEditorSearch.toLowerCase().trim();
  if (chemListEditorTab === 'compounds') {
    const filtered = chemAllCompounds.filter(c => c.name.toLowerCase().includes(searchLower) || c.smiles && c.smiles.toLowerCase().includes(searchLower));
    if (!filtered.length) {
      container.innerHTML = `<div style="grid-column: 1 / -1; padding: 20px; text-align: center; color: var(--text3); font-size: 13px;">No compounds found.</div>`;
      return;
    }
    container.innerHTML = filtered.map(c => {
      const isChecked = chemMyData.myList.includes(c.name);
      return `
          <label style="display: flex; align-items: center; gap: 8px; padding: 8px 10px; background: var(--bg3); border: 1px solid var(--border); border-radius: 6px; cursor: pointer; transition: all 0.2s; user-select: none;">
            <input type="checkbox" style="cursor: pointer; accent-color: var(--accent);" ${isChecked ? 'checked' : ''} onchange="toggleListEditorCompound('${escapeHtml(c.name)}', this.checked)" />
            <div style="font-size: 13px; font-weight: 500; color: var(--text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escapeHtml(c.name)}">${escapeHtml(c.name)}</div>
          </label>
        `;
    }).join('');
  } else if (chemListEditorTab === 'reagents') {
    const filtered = reagentAllReagents.filter(r => r.toLowerCase().includes(searchLower));
    if (!filtered.length) {
      container.innerHTML = `<div style="grid-column: 1 / -1; padding: 20px; text-align: center; color: var(--text3); font-size: 13px;">No reagents found.</div>`;
      return;
    }
    container.innerHTML = filtered.map(r => {
      const isChecked = reagentMyData.myList.includes(r);
      return `
          <label style="display: flex; align-items: center; gap: 8px; padding: 8px 10px; background: var(--bg3); border: 1px solid var(--border); border-radius: 6px; cursor: pointer; transition: all 0.2s; user-select: none;">
            <input type="checkbox" style="cursor: pointer; accent-color: var(--accent);" ${isChecked ? 'checked' : ''} onchange="toggleListEditorReagent('${escapeHtml(r)}', this.checked)" />
            <div style="font-size: 13px; font-weight: 500; color: var(--text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escapeHtml(r)}">${escapeHtml(r)}</div>
          </label>
        `;
    }).join('');
  } else if (chemListEditorTab === 'pka') {
    const filtered = pkaAllCompounds.filter(c => c.name.toLowerCase().includes(searchLower));
    if (!filtered.length) {
      container.innerHTML = `<div style="grid-column: 1 / -1; padding: 20px; text-align: center; color: var(--text3); font-size: 13px;">No pKa compounds found.</div>`;
      return;
    }
    container.innerHTML = filtered.map(c => {
      const isChecked = pkaMyData.myList.includes(c.name);
      return `
          <label style="display: flex; align-items: center; gap: 8px; padding: 8px 10px; background: var(--bg3); border: 1px solid var(--border); border-radius: 6px; cursor: pointer; transition: all 0.2s; user-select: none;">
            <input type="checkbox" style="cursor: pointer; accent-color: var(--accent);" ${isChecked ? 'checked' : ''} onchange="toggleListEditorPka('${escapeHtml(c.name)}', this.checked)" />
            <div style="font-size: 13px; font-weight: 500; color: var(--text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escapeHtml(c.name)}">${escapeHtml(c.name)}</div>
          </label>
        `;
    }).join('');
  }
}
window.setListEditorTab = function (tab) {
  chemListEditorTab = tab;
  renderListEditor();
};
window.handleListEditorSearch = function (val) {
  chemListEditorSearch = val;
  renderListEditorItems();
};
window.toggleListEditorCompound = function (name, isChecked) {
  if (isChecked) {
    if (!chemMyData.myList.includes(name)) {
      chemMyData.myList.push(name);
      if (!chemMyData.stats[name]) {
        chemMyData.stats[name] = {
          wrong: 0,
          correct: 0,
          streak: 0,
          lastSeen: 0
        };
      }
    }
  } else {
    chemMyData.myList = chemMyData.myList.filter(n => n !== name);
  }
  chemSave();
  chemSyncAll(false);
  const tabBtn = document.getElementById('list-editor-tab-compounds');
  if (tabBtn) {
    tabBtn.textContent = `Compounds (${chemMyData.myList.length}/${chemAllCompounds.length})`;
  }
};
window.toggleListEditorReagent = function (name, isChecked) {
  if (isChecked) {
    if (!reagentMyData.myList.includes(name)) {
      reagentMyData.myList.push(name);
      const newReactions = reagentAllReactions.filter(r => r.Reagent === name);
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
    }
  } else {
    reagentMyData.myList = reagentMyData.myList.filter(r => r !== name);
  }
  reagentSave();
  chemSave();
  chemSyncAll(false);
  const tabBtn = document.getElementById('list-editor-tab-reagents');
  if (tabBtn) {
    tabBtn.textContent = `Reagents (${reagentMyData.myList.length}/${reagentAllReagents.length})`;
  }
};
window.toggleListEditorPka = function (name, isChecked) {
  if (isChecked) {
    if (!pkaMyData.myList.includes(name)) {
      pkaMyData.myList.push(name);
      if (!pkaMyData.stats[name]) {
        pkaMyData.stats[name] = {
          wrong: 0,
          correct: 0,
          streak: 0,
          lastSeen: 0
        };
      }
    }
  } else {
    pkaMyData.myList = pkaMyData.myList.filter(n => n !== name);
  }
  pkaSave();
  chemSyncAll(false);
  const tabBtn = document.getElementById('list-editor-tab-pka');
  if (tabBtn) {
    tabBtn.textContent = `pKa (${pkaMyData.myList.length}/${pkaAllCompounds.length})`;
  }
};
window.listEditorSelectAll = function (selectAll) {
  const searchLower = chemListEditorSearch.toLowerCase().trim();
  if (chemListEditorTab === 'compounds') {
    const filtered = chemAllCompounds.filter(c => c.name.toLowerCase().includes(searchLower) || c.smiles && c.smiles.toLowerCase().includes(searchLower));
    filtered.forEach(c => {
      if (selectAll) {
        if (!chemMyData.myList.includes(c.name)) {
          chemMyData.myList.push(c.name);
          if (!chemMyData.stats[c.name]) {
            chemMyData.stats[c.name] = {
              wrong: 0,
              correct: 0,
              streak: 0,
              lastSeen: 0
            };
          }
        }
      } else {
        chemMyData.myList = chemMyData.myList.filter(n => n !== c.name);
      }
    });
    chemSave();
    chemSyncAll(false);
  } else if (chemListEditorTab === 'reagents') {
    const filtered = reagentAllReagents.filter(r => r.toLowerCase().includes(searchLower));
    filtered.forEach(r => {
      if (selectAll) {
        if (!reagentMyData.myList.includes(r)) {
          reagentMyData.myList.push(r);
          const newReactions = reagentAllReactions.filter(x => x.Reagent === r);
          newReactions.forEach(x => {
            const key = `${x.Reactant} | ${x.Reagent} | ${x.Product}`;
            if (!reagentMyData.stats[key]) {
              reagentMyData.stats[key] = {
                wrong: 0,
                correct: 0,
                streak: 0,
                lastSeen: 0
              };
            }
          });
        }
      } else {
        reagentMyData.myList = reagentMyData.myList.filter(x => x !== r);
      }
    });
    reagentSave();
    chemSave();
    chemSyncAll(false);
  } else if (chemListEditorTab === 'pka') {
    const filtered = pkaAllCompounds.filter(c => c.name.toLowerCase().includes(searchLower));
    filtered.forEach(c => {
      if (selectAll) {
        if (!pkaMyData.myList.includes(c.name)) {
          pkaMyData.myList.push(c.name);
          if (!pkaMyData.stats[c.name]) {
            pkaMyData.stats[c.name] = {
              wrong: 0,
              correct: 0,
              streak: 0,
              lastSeen: 0
            };
          }
        }
      } else {
        pkaMyData.myList = pkaMyData.myList.filter(n => n !== c.name);
      }
    });
    pkaSave();
    chemSyncAll(false);
  }
  renderListEditor();
};
window.chemToggleTextMode = function (el) {
  localStorage.setItem(getUserStorageKey('chem_setting_text_mode'), el.checked ? 'true' : 'false');
};
window.chemToggleWizardMode = function (el) {
  localStorage.setItem(getUserStorageKey('chem_setting_wizard_mode'), el.checked ? 'true' : 'false');
  chemUpdatePracticeButton();
};
window.chemChangeRenderer = function (val) {
  localStorage.setItem(getUserStorageKey('chem_setting_renderer'), val);
  if (val === 'rdkit') {
    loadRDKitDynamic().then(() => {
      chemShowToast("RDKit JS loaded successfully!");
      chemRefreshCurrentDrawing();
    }).catch(() => {
      chemShowToast("Failed to load RDKit JS. Using Smiles Drawer.");
      const rendererSelect = document.getElementById('chem-setting-renderer');
      if (rendererSelect) rendererSelect.value = 'smiles';
      localStorage.setItem(getUserStorageKey('chem_setting_renderer'), 'smiles');
    });
  } else {
    chemRefreshCurrentDrawing();
  }
};
function chemUpdatePracticeButton() {
  const btn = document.getElementById('chem-btn-practice');
  if (!btn) return;
  const wizardMode = localStorage.getItem(getUserStorageKey('chem_setting_wizard_mode')) === 'true';
  if (wizardMode) {
    btn.textContent = 'Run';
    btn.classList.add('chem-btn-primary');
    btn.classList.remove('chem-btn-secondary');
  } else {
    btn.textContent = 'Practice Mode';
    btn.classList.add('chem-btn-secondary');
    btn.classList.remove('chem-btn-primary');
  }
}
function initTopbarEnhancements() {
  if (window.__fyEnhancementsInited) return;
  window.__fyEnhancementsInited = true;
  const textModeSetting = localStorage.getItem(getUserStorageKey('chem_setting_text_mode')) !== 'false';
  const checkbox = document.getElementById('chem-setting-text-mode');
  if (checkbox) checkbox.checked = textModeSetting;
  const wizardModeSetting = localStorage.getItem(getUserStorageKey('chem_setting_wizard_mode')) === 'true';
  const wizardCheckbox = document.getElementById('chem-setting-wizard-mode');
  if (wizardCheckbox) wizardCheckbox.checked = wizardModeSetting;
  chemUpdatePracticeButton();
  const rendererSetting = localStorage.getItem(getUserStorageKey('chem_setting_renderer')) || 'smiles';
  const rendererSelect = document.getElementById('chem-setting-renderer');
  if (rendererSelect) rendererSelect.value = rendererSetting;
  if (rendererSetting === 'rdkit') {
    loadRDKitDynamic();
  }
  const savedTheme = localStorage.getItem(getUserStorageKey('fy_theme_mode'));
  document.body.classList.toggle('light-mode', savedTheme === 'light');
  const savedPreset = localStorage.getItem(getUserStorageKey('fy_theme_preset')) || 'default';
  applyThemePreset(savedPreset, false);
  setSyncPill(navigator.onLine ? 'live' : 'offline', navigator.onLine ? 'Live' : 'Offline');
  const searchInput = document.getElementById('global-search');
  if (searchInput) {
    searchInput.value = APP_STATE.globalSearch || '';
    searchInput.addEventListener('input', debounce(function onSearchInput() {
      APP_STATE.globalSearch = this.value.trim();
      refreshActivePageData();
    }, 150));
  }
  const commandInput = document.getElementById('command-input');
  if (commandInput) {
    commandInput.addEventListener('input', function onCommandInput() {
      renderCommandPaletteList(this.value);
    });
    commandInput.addEventListener('keydown', function onCommandKeydown(e) {
      const items = Array.from(document.querySelectorAll('.command-item'));
      if (!items.length) return;
      const activeIndex = items.findIndex(i => i.classList.contains('active'));
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const direction = e.key === 'ArrowDown' ? 1 : -1;
        const nextIndex = activeIndex < 0 ? 0 : (activeIndex + direction + items.length) % items.length;
        items.forEach(i => i.classList.remove('active'));
        items[nextIndex].classList.add('active');
        items[nextIndex].scrollIntoView({
          block: 'nearest'
        });
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        const active = items.find(i => i.classList.contains('active')) || items[0];
        active === null || active === void 0 || active.click();
      }
      if (e.key === 'Escape') {
        closeCommandPalette();
      }
    });
  }
  document.addEventListener('keydown', e => {
    const isCmdPalette = (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k';
    if (isCmdPalette) {
      e.preventDefault();
      openCommandPalette();
      return;
    }
    if (e.key === 'Escape') closeCommandPalette();
  });
  window.addEventListener('online', () => {
    setSyncPill('live', 'Back online · syncing');
    chemSyncAll(false);
    refreshPortalDataInBackground();
    setTimeout(() => window.location.reload(), 1200);
  });
  window.addEventListener('offline', () => {
    setSyncPill('offline', 'Offline');
  });
}

