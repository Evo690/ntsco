/* --- DROPDOWN CHANGE HANDLERS & LOADERS --- */
window.changeTtYear = async function (newYear) {
  API_CONFIG.academicYear = Number(newYear);
  sessionStorage.setItem('fy_academic_year', newYear);
  await loadTtBatches();
};
window.changeTtBatch = async function (newBatchId) {
  API_CONFIG.classId = Number(newBatchId);
  sessionStorage.setItem('fy_class_id', newBatchId);
  const grid = document.getElementById('timetable-grid');
  const todayList = document.getElementById('today-classes-list');
  if (grid) grid.innerHTML = '<div class="empty">Loading timetable...</div>';
  if (todayList) todayList.innerHTML = '<div class="empty">Loading today\'s classes...</div>';
  const cachedTimetable = readTimetableCache();
  if (cachedTimetable !== null && cachedTimetable !== void 0 && cachedTimetable.length) {
    APP_STATE.timetable = cachedTimetable;
    renderTimetable(cachedTimetable);
    renderTodayClasses(cachedTimetable);
    setSyncPill('cached', 'Using cached timetable');
  }
  try {
    const currentId = Number(API_CONFIG.classId);
    const isEnrolled = Array.isArray(APP_STATE.batches) && APP_STATE.batches.some(b => Number(b.id) === currentId);
    const batchIdsToFetch = new Set();
    if (isEnrolled) {
      APP_STATE.batches.forEach(b => {
        if (b.id) batchIdsToFetch.add(Number(b.id));
      });
    } else if (currentId) {
      batchIdsToFetch.add(currentId);
    }
    const ids = [...batchIdsToFetch];
    let timetable = [];
    if (ids.length > 0) {
      const timetablePromises = ids.map(id => fetchTimetable(API_CONFIG.token, id).catch(() => []));
      const results = await Promise.all(timetablePromises);
      const seenKeys = new Set();
      for (const list of results) {
        if (!Array.isArray(list)) continue;
        for (const c of list) {
          if (!c) continue;
          const key = `${normalizeDateKey(c.classDate)}_${c.startTime}_${c.subjects}_${c.classType}`;
          if (!seenKeys.has(key)) {
            seenKeys.add(key);
            timetable.push(c);
          }
        }
      }
    } else {
      timetable = await fetchTimetable(API_CONFIG.token);
    }
    APP_STATE.timetable = timetable;
    writeTimetableCache(timetable);
    writePortalCache();
    renderTimetable(timetable);
    renderTodayClasses(timetable);
    setSyncPill('live', `Live · ${formatRelativeTime(APP_STATE.lastSyncAt || Date.now())}`);
  } catch (e) {
    if (!(cachedTimetable !== null && cachedTimetable !== void 0 && cachedTimetable.length) && grid) grid.innerHTML = '<div class="empty">Failed to load timetable</div>';
    if (!(cachedTimetable !== null && cachedTimetable !== void 0 && cachedTimetable.length)) setSyncPill('offline', 'Offline');
  }
};
window.loadTimetableByBatchId = async function loadTimetableByBatchId(event) {
  if (event !== null && event !== void 0 && event.preventDefault) event.preventDefault();
  const input = document.getElementById('manual-batch-id');
  const rawBatchId = String((input === null || input === void 0 ? void 0 : input.value) || '').trim();
  if (!rawBatchId) {
    if (input) input.focus();
    return;
  }
  const batchSelector = document.getElementById('tt-batch-selector');
  if (batchSelector && ![...batchSelector.options].some(option => String(option.value) === rawBatchId)) {
    batchSelector.add(new Option(`Manual batch(${rawBatchId})`, rawBatchId, false, true));
    batchSelector.style.display = 'block';
  }
  if (batchSelector) batchSelector.value = rawBatchId;
  await changeTtBatch(rawBatchId);
};
async function loadTtBatches() {
  const batchSelector = document.getElementById('tt-batch-selector');
  if (!batchSelector) return;
  batchSelector.innerHTML = '<option>Loading batches...</option>';
  batchSelector.style.display = 'block';
  const batches = await fetchStudentBatches(API_CONFIG.token, API_CONFIG.academicYear);
  if (Array.isArray(batches)) {
    APP_STATE.batches = batches;
    if (batches.length > 0) {
      uploadBatchesToSupabase(batches, API_CONFIG.academicYear);
    }
  }
  if (batches.length > 0) {
    if (!API_CONFIG.classId || !batches.find(b => String(b.id) === String(API_CONFIG.classId))) {
      API_CONFIG.classId = batches[0].id;
      sessionStorage.setItem('fy_class_id', API_CONFIG.classId);
    }
    batchSelector.innerHTML = batches.map(b => `<option value="${b.id}" ${String(b.id) === String(API_CONFIG.classId) ? 'selected' : ''}>${escapeHtml(b.title)}(${b.id})</option>`).join('');
    await changeTtBatch(API_CONFIG.classId);
  } else {
    batchSelector.innerHTML = '<option value="">No batches found</option>';
    document.getElementById('timetable-grid').innerHTML = '<div class="empty">No batches available for this year</div>';
    document.getElementById('today-classes-list').innerHTML = '<div class="empty">No batches available</div>';
  }
  return batches;
}
function initTtDropdowns() {
  const yearSelector = document.getElementById('tt-year-selector');
  if (yearSelector && yearSelector.options.length === 0) {
    const currentYear = new Date().getFullYear();
    for (let y = currentYear - 1; y <= currentYear + 1; y++) {
      yearSelector.add(new Option(`${y} - ${y + 1}`, y, false, y === API_CONFIG.academicYear));
    }
  }
}
window.changeExamYear = async function (newYear) {
  API_CONFIG.academicYear = Number(newYear);
  sessionStorage.setItem('fy_academic_year', newYear);
  const eraYearSelector = document.getElementById('era-year-selector');
  if (eraYearSelector) eraYearSelector.value = newYear;
  await loadExamTestsPage(true);
};
function initExamDropdowns() {
  const yearSelector = document.getElementById('exam-year-selector');
  if (yearSelector && yearSelector.options.length === 0) {
    const currentYear = new Date().getFullYear();
    for (let y = currentYear - 1; y <= currentYear + 1; y++) {
      yearSelector.add(new Option(`${y} - ${y + 1}`, y, false, y === API_CONFIG.academicYear));
    }
  }
}
window.changeEraYear = async function (newYear) {
  API_CONFIG.academicYear = Number(newYear);
  sessionStorage.setItem('fy_academic_year', newYear);
  const examYearSelector = document.getElementById('exam-year-selector');
  if (examYearSelector) examYearSelector.value = newYear;
  await loadEraTestsPage(true);
};
function initEraDropdowns() {
  const yearSelector = document.getElementById('era-year-selector');
  if (yearSelector && yearSelector.options.length === 0) {
    const currentYear = new Date().getFullYear();
    for (let y = currentYear - 1; y <= currentYear + 1; y++) {
      yearSelector.add(new Option(`${y} - ${y + 1}`, y, false, y === API_CONFIG.academicYear));
    }
  }
}
async function enrichExamTests(tests) {
  return tests;
}
async function enrichEraTests(tests) {
  return tests;
}
async function loadExamTestsPage(reset = false) {
  const root = document.getElementById('examhall-list');
  const btn = document.getElementById('examhall-load-more');
  if (reset) {
    APP_STATE.examPage = 1;
    APP_STATE.tests = [];
    APP_STATE.examTotal = 0;
    if (root) root.innerHTML = '<div class="empty">Loading exam hall tests...</div>';
  }
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Loading...';
  }
  try {
    const page = reset ? 1 : APP_STATE.examPage + 1;
    const {
      tests,
      total
    } = await fetchTestsPage(API_CONFIG.token, page, APP_STATE.testPageSize);
    const enriched = await enrichExamTests(tests);
    APP_STATE.examPage = page;
    APP_STATE.examTotal = total || (reset ? enriched.length : APP_STATE.examTotal);
    APP_STATE.tests = reset ? enriched : [...APP_STATE.tests, ...enriched];
    if (reset && tests.length > 0) {
      scanAndUploadOnlineTests(tests);
    }
    renderExamHall(APP_STATE.tests);
    writePortalCache();
  } catch (e) {
    if (root) root.innerHTML = '<div class="empty">Failed to load tests</div>';
    updateExamLoadMoreButton();
  } finally {
    if (btn) btn.disabled = false;
  }
}
async function loadEraTestsPage(reset = false) {
  const root = document.getElementById('era-list');
  const btn = document.getElementById('era-load-more');
  if (reset) {
    APP_STATE.eraPage = 1;
    APP_STATE.eraTests = [];
    APP_STATE.eraTotal = 0;
    if (root) root.innerHTML = '<div class="empty">Loading tests...</div>';
  }
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Loading...';
  }
  try {
    const page = reset ? 1 : APP_STATE.eraPage + 1;
    const {
      tests,
      total
    } = await fetchTestsPage(API_CONFIG.token, page, APP_STATE.testPageSize);
    const enriched = await enrichEraTests(tests);
    APP_STATE.eraPage = page;
    APP_STATE.eraTotal = total || (reset ? enriched.length : APP_STATE.eraTotal);
    APP_STATE.eraTests = reset ? enriched : [...APP_STATE.eraTests, ...enriched];
    renderEraTests(APP_STATE.eraTests);
    writePortalCache();
  } catch (e) {
    if (root) root.innerHTML = '<div class="empty">Failed to load ERA tests</div>';
    updateEraLoadMoreButton();
  } finally {
    if (btn) btn.disabled = false;
  }
}
window.loadMoreExamTests = function loadMoreExamTests() {
  loadExamTestsPage(false);
};
window.loadMoreEraTests = function loadMoreEraTests() {
  loadEraTestsPage(false);
};
window.loadMoreStudyContent = async function () {
  const btn = document.getElementById('study-load-more');
  if (btn) {
    btn.textContent = 'Loading...';
    btn.disabled = true;
  }
  try {
    APP_STATE.studyPage += 1;
    const result = await fetchStudyContent(API_CONFIG.token, APP_STATE.studyPage);
    APP_STATE.studyContent = [...APP_STATE.studyContent, ...result.data];
    APP_STATE.studyTotal = result.total || APP_STATE.studyTotal || APP_STATE.studyContent.length;
    renderStudyContent(APP_STATE.studyContent, APP_STATE.studyTotal);
    writePortalCache();
  } catch (_) {
    setSyncPill('offline', 'Offline');
  }
  if (btn) {
    btn.textContent = 'Load More';
    btn.disabled = false;
  }
};
