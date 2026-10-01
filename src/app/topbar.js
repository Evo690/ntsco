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
  const savedTheme = portalAppearance.read('fy_theme_mode');
  portalAppearance.setMode(savedTheme === 'dark' ? 'dark' : 'light', false);
  const savedPreset = portalAppearance.read('fy_theme_preset') || 'default';
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
