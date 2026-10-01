/* --- USER STORAGE ISOLATION HELPERS --- */
function getCurrentUserId() {
  const rawName = sessionStorage.getItem('fy_user_name');
  if (rawName && rawName.trim() && rawName.trim() !== 'Student') return rawName.trim();
  const user = sessionStorage.getItem('fy_logged_in_user') || getCookie('fy_u');
  if (user) {
    const cleanUser = user.trim();
    const isPhone = /^\+?[0-9\s\-]{8,15}$/.test(cleanUser);
    if (!isPhone) return cleanUser;
  }
  return '';
}
function getUserStorageKey(baseKey) {
  const userId = getCurrentUserId();
  if (userId) {
    const cleanId = userId.replace(/[^a-zA-Z0-9_]/g, '_');
    return `${baseKey}_${cleanId}`;
  }
  return baseKey;
}
function chemReloadUserPracticeData() {
  chemCombinedData = chemLoadCombinedData();
  chemMyData = chemCombinedData.compounds;
  reagentMyData = chemCombinedData.reagents;
  pkaMyData = chemCombinedData.pka || {
    myList: [],
    stats: {}
  };
  listEditorLoaded = false;
  const root = document.getElementById('list-editor-root');
  if (root) root.style.display = 'none';
  const chevron = document.getElementById('list-editor-chevron');
  if (chevron) chevron.textContent = '▼';
}
function cleanupOtherUsersCaches() {
  const userId = getCurrentUserId();
  if (!userId) return;
  const cleanId = userId.replace(/[^a-zA-Z0-9_]/g, '_');
  const userSuffix = `_${cleanId}`;
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const key = localStorage.key(i);
    if (!key) continue;

    // Delete portal caches of other users
    if (key.startsWith('fy_portal_cache_v2_') && !key.endsWith(userSuffix)) {
      localStorage.removeItem(key);
    }
    // Delete timetable caches of other users
    else if (key.includes('fy_timetable_cache_') && !key.endsWith(userSuffix)) {
      localStorage.removeItem(key);
    }
  }
}
function cleanupLegacyKeys() {
  const legacyKeys = ['chem_v5_data', 'reagent_v1_data', 'chem_progress_updated_at', 'chem_v4_data', 'chem_v3_data', 'chem_v2_data', 'chem_v1_data', 'reagent_data', 'chem_data'];
  legacyKeys.forEach(key => {
    localStorage.removeItem(key);
  });
}
