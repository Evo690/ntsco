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
