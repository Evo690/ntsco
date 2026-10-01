const CHEM_SUPABASE_URL = "https://rhsrrljgejgyqnndcdia.supabase.co";
const CHEM_SUPABASE_KEY = "sb_publishable_vGRx87SiIMaJXeGnrMVN9g_bLPu899U";
const CLOUDFLARE_PROXY = 'https://frosty-frog-31f9.evodev.workers.dev/';

const API_CONFIG = {
  token: sessionStorage.getItem('fy_token') || '',
  academicYear: Number(sessionStorage.getItem('fy_academic_year') || new Date().getFullYear())
};

let supabaseClient = null;
let allTests = [];
let selectedTest = null;

// Cookie and User Helpers
function getCookie(name) {
  const nameEQ = name + "=";
  const ca = document.cookie.split(';');
  for (let i = 0; i < ca.length; i++) {
    let c = ca[i];
    while (c.charAt(0) === ' ') c = c.substring(1, c.length);
    if (c.indexOf(nameEQ) === 0) {
      const value = c.substring(nameEQ.length, c.length);
      try {
        return decodeURIComponent(value);
      } catch (_) {
        return value;
      }
    }
  }
  return null;
}

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

// Apply User Theme Mode & Presets
function applyUserTheme() {
  const userId = getCurrentUserId();
  const cleanId = userId ? userId.replace(/[^a-zA-Z0-9_]/g, '_') : '';
  const modeKey = cleanId ? `fy_theme_mode_${cleanId}` : 'fy_theme_mode';
  const presetKey = cleanId ? `fy_theme_preset_${cleanId}` : 'fy_theme_preset';
  const mode = localStorage.getItem(modeKey);
  const preset = localStorage.getItem(presetKey);
  if (mode === 'light') {
    document.body.classList.add('light-mode');
  } else {
    document.body.classList.remove('light-mode');
  }
  document.body.classList.remove('theme-ocean', 'theme-purple', 'theme-emerald');
  if (preset && preset !== 'default') {
    document.body.classList.add(`theme-${preset}`);
  }
}

// API request helpers
function authHeaders(token) {
  return {
    Authorization: 'Bearer ' + token,
    'Content-Type': 'application/json',
    Accept: 'application/json',
    Origin: 'https://ntsc.narayanatalent.com',
    Referer: 'https://ntsc.narayanatalent.com/'
  };
}

async function loginProxyFetch(url, options = {}) {
  return fetch(CLOUDFLARE_PROXY + '?url=' + encodeURIComponent(url), {
    ...options,
    headers: {
      ...(options.headers || {}),
      'x-key': 'ntsc-123'
    }
  });
}

function escapeHtml(v) {
  return String(v !== null && v !== void 0 ? v : '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function formatDateLabel(dateStr) {
  if (!dateStr) return 'No date';
  const dt = new Date(dateStr);
  if (Number.isNaN(dt.getTime())) return String(dateStr);
  return dt.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
}

// Toast helper
function showToast(message) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => {
    toast.classList.remove('show');
  }, 2200);
}

// Supabase Init
function initSupabase() {
  if (window.supabase) {
    supabaseClient = window.supabase.createClient(CHEM_SUPABASE_URL, CHEM_SUPABASE_KEY);
  }
}

// Year dropdown populator
function initYearSelector() {
  const yearSelector = document.getElementById('year-selector');
  if (yearSelector && yearSelector.options.length === 0) {
    yearSelector.add(new Option('All Academic Years', 'all', true, true));
    const currentYear = new Date().getFullYear();
    for (let y = currentYear + 1; y >= currentYear - 3; y--) {
      yearSelector.add(new Option(`Year ${y} - ${y + 1}`, y, false, false));
    }
  }
}

function getModeBadgeHtml(mode) {
  const modeStr = String(mode || 'Online').trim();
  const isOff = modeStr.toLowerCase().includes('off') || modeStr.toLowerCase().includes('omr');
  return `<span class="mode-pill ${isOff ? 'offline' : 'online'}">${escapeHtml(modeStr.toUpperCase())}</span>`;
}

function getTestModeLabel(t) {
  if (t.isOffline === false || t.isOffline === 'false' || t.isOffline === 0) return 'Online';
  if (t.isOffline === true || t.isOffline === 'true' || t.isOffline === 1) return 'Offline';
  const mode = t.mode || t.testMode || t.examMode || t.examType || t.testType || '';
  if (mode) return String(mode).trim();
  return 'Offline';
}

// Load tests from Supabase
async function loadTestsFromSupabase() {
  const loadingEl = document.getElementById('test-loading');
  const listEl = document.getElementById('test-list');
  if (!supabaseClient) {
    if (loadingEl) loadingEl.textContent = 'Supabase client not initialized.';
    return;
  }
  if (loadingEl) {
    loadingEl.style.display = 'block';
    loadingEl.textContent = 'Loading tests from database...';
  }
  try {
    const { data, error } = await supabaseClient
      .from('test_ids')
      .select('*')
      .order('id', { ascending: false });

    if (error) {
      if (loadingEl) loadingEl.textContent = 'Error loading tests: ' + error.message;
      return;
    }
    allTests = data || [];
    if (loadingEl) loadingEl.style.display = 'none';
    
    // Update stats
    const totalEl = document.getElementById('stat-total-tests');
    if (totalEl) totalEl.textContent = allTests.length;

    filterTests();

    // Auto-select first test if none selected
    if (!selectedTest && allTests.length > 0) {
      selectTest(allTests[0].id);
    }
  } catch (err) {
    if (loadingEl) loadingEl.textContent = 'Error: ' + (err.message || err);
  }
}

// Render test cards list
function renderTestsList(tests) {
  const listEl = document.getElementById('test-list');
  const matchingEl = document.getElementById('stat-matching-tests');
  if (matchingEl) matchingEl.textContent = tests.length;
  if (!listEl) return;

  if (tests.length === 0) {
    listEl.innerHTML = '<div style="text-align: center; color: var(--text3); font-size: 13px; padding: 24px 10px;">No tests found</div>';
    return;
  }

  listEl.innerHTML = tests.map(t => {
    const isSelected = selectedTest && String(selectedTest.id) === String(t.id);
    const dateStr = formatDateLabel(t.exam_date || t.examDate);
    const yearStr = t.academic_year || t.academicYear ? ` · ${t.academic_year || t.academicYear}` : '';
    const mode = t.mode || getTestModeLabel(t);
    return `
      <div class="test-item-card ${isSelected ? 'active' : ''}" id="test-card-${t.id}" onclick="selectTest('${t.id}')">
        <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 8px;">
          <div class="test-item-name">${escapeHtml(t.name || 'Unnamed Test')}</div>
          ${getModeBadgeHtml(mode)}
        </div>
        <div style="display: flex; align-items: center; justify-content: space-between; margin-top: 6px;">
          <span class="test-item-id-label">ID: ${t.id}</span>
          <span style="font-size: 10.5px; color: var(--text3);">${dateStr}${yearStr}</span>
        </div>
      </div>
    `;
  }).join('');
}


// Filter and search
function filterTests() {
  const searchInput = document.getElementById('test-search');
  const yearSelector = document.getElementById('year-selector');
  const q = searchInput ? searchInput.value.toLowerCase().trim() : '';
  const selectedYear = yearSelector ? yearSelector.value : 'all';

  const yearStatEl = document.getElementById('stat-selected-year');
  if (yearStatEl) {
    yearStatEl.textContent = selectedYear === 'all' ? 'All Years' : selectedYear;
  }

  const filtered = allTests.filter(t => {
    const testYear = String(t.academic_year || t.academicYear || '');
    const matchesYear = selectedYear === 'all' || testYear === String(selectedYear);
    const idStr = String(t.id || '');
    const nameStr = String(t.name || '').toLowerCase();
    const matchesQuery = !q || nameStr.includes(q) || idStr.includes(q);
    return matchesYear && matchesQuery;
  });

  renderTestsList(filtered);
}

// Select a test to view details
function selectTest(testId) {
  const test = allTests.find(t => String(t.id) === String(testId));
  if (!test) return;
  selectedTest = test;

  // Highlight in sidebar
  document.querySelectorAll('.test-item-card').forEach(el => el.classList.remove('active'));
  const card = document.getElementById(`test-card-${testId}`);
  if (card) card.classList.add('active');

  // Close mobile sidebar
  if (window.innerWidth <= 768) {
    closeSidebar();
  }

  // Update UI Elements
  document.getElementById('selected-test-name').textContent = test.name || 'Unnamed Test';
  document.getElementById('selected-test-meta').textContent = `Test ID #${test.id} · Added ${formatDateLabel(test.created_at || test.updated_at)}`;
  document.getElementById('selected-test-actions').style.display = 'flex';
  document.getElementById('test-details-view').style.display = 'block';
  document.getElementById('test-placeholder').style.display = 'none';

  // Details
  const idEl = document.getElementById('detail-test-id');
  if (idEl) {
    idEl.innerHTML = `<span>${test.id}</span> <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`;
  }
  document.getElementById('detail-test-year').textContent = test.academic_year || test.academicYear || 'N/A';
  document.getElementById('detail-test-date').textContent = formatDateLabel(test.exam_date || test.examDate);
  document.getElementById('detail-test-mode').innerHTML = getModeBadgeHtml(test.mode || 'Online');

  // Reset download progress on test selection
  const progressBox = document.getElementById('test-download-progress');
  if (progressBox) {
    progressBox.style.display = 'none';
  }

  // Check hard rule: Is today's date less than the test's date?
  const isLocked = isTestDateInFuture(test);
  const dateLabel = formatDateLabel(test.exam_date || test.examDate || test.testDate || test.startDate || test.dateTime);

  const lockedBanner = document.getElementById('test-download-locked-banner');
  const lockedMsg = document.getElementById('test-download-locked-msg');
  if (lockedBanner && lockedMsg) {
    if (isLocked) {
      lockedMsg.textContent = `Test paper and solutions are locked until the scheduled test date (${dateLabel}). Downloads cannot be opened before this date.`;
      lockedBanner.style.display = 'flex';
    } else {
      lockedBanner.style.display = 'none';
    }
  }

  const testHeaderBtn = document.getElementById('btn-download-test-header');
  const solHeaderBtn = document.getElementById('btn-download-solution-header');
  const testBodyBtn = document.getElementById('btn-download-test-body');
  const solBodyBtn = document.getElementById('btn-download-solution-body');

  if (isLocked) {
    if (testHeaderBtn) {
      testHeaderBtn.disabled = true;
      testHeaderBtn.title = `Locked: Test is scheduled for ${dateLabel}`;
    }
    if (solHeaderBtn) {
      solHeaderBtn.disabled = true;
      solHeaderBtn.title = `Locked: Test is scheduled for ${dateLabel}`;
    }
    if (testBodyBtn) {
      testBodyBtn.disabled = true;
      testBodyBtn.title = `Locked: Test is scheduled for ${dateLabel}`;
      testBodyBtn.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
          <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
        </svg>
        <span>Locked until ${dateLabel}</span>
      `;
    }
    if (solBodyBtn) {
      solBodyBtn.disabled = true;
      solBodyBtn.title = `Locked: Test is scheduled for ${dateLabel}`;
      solBodyBtn.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
          <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
        </svg>
        <span>Locked until ${dateLabel}</span>
      `;
    }
  } else {
    if (testHeaderBtn) {
      testHeaderBtn.disabled = false;
      testHeaderBtn.title = 'Download Question Paper PDF';
    }
    if (solHeaderBtn) {
      solHeaderBtn.disabled = false;
      solHeaderBtn.title = 'Download Solutions PDF';
    }
    if (testBodyBtn) {
      testBodyBtn.disabled = false;
      testBodyBtn.title = 'Download Question Paper PDF';
      testBodyBtn.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
          <polyline points="7 10 12 15 17 10"></polyline>
          <line x1="12" y1="15" x2="12" y2="3"></line>
        </svg>
        <span>Download Test (PDF)</span>
      `;
    }
    if (solBodyBtn) {
      solBodyBtn.disabled = false;
      solBodyBtn.title = 'Download Solutions PDF';
      solBodyBtn.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M9 11l3 3L22 4"></path>
          <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
        </svg>
        <span>Download Solution (PDF)</span>
      `;
    }
  }
}

// Copy selected test ID to clipboard
function copySelectedTestId() {
  if (!selectedTest || !selectedTest.id) {
    showToast('No test selected to copy');
    return;
  }
  navigator.clipboard.writeText(String(selectedTest.id)).then(() => {
    showToast(`Test ID ${selectedTest.id} copied!`);
  }).catch(() => {
    // Fallback
    const textArea = document.createElement('textarea');
    textArea.value = String(selectedTest.id);
    document.body.appendChild(textArea);
    textArea.select();
    try {
      document.execCommand('copy');
      showToast(`Test ID ${selectedTest.id} copied!`);
    } catch (_) {}
    document.body.removeChild(textArea);
  });
}

// Actions
function openTestInAttemptTest() {
  if (!selectedTest || !selectedTest.id) return;
  const testId = selectedTest.id;
  if (sessionStorage.getItem('fy_reattempt_unlocked') !== 'true') {
    const pass = prompt('Attempt Test (Reattempt Mode) is currently locked.\nEnter passcode to unlock:');
    if (pass !== 'ntscx') {
      if (pass !== null) alert('Incorrect passcode. Access denied.');
      return;
    }
    sessionStorage.setItem('fy_reattempt_unlocked', 'true');
  }
  window.open(`attempt-test.html?id=${encodeURIComponent(testId)}`, '_blank');
}

function openTestInPortal() {
  if (!selectedTest || !selectedTest.id) return;
  const testId = selectedTest.id;
  if (window.opener && !window.opener.closed) {
    try {
      if (typeof window.opener.openResultSubpage === 'function') {
        window.opener.openResultSubpage(testId, { forced: false });
        window.opener.focus();
        showToast('Opened test result in main window.');
        return;
      }
    } catch (_) {}
  }
  window.open(`../index.html#examhall?id=${testId}`, '_blank');
}

function openTestInForcedResult() {
  if (!selectedTest || !selectedTest.id) return;
  const testId = selectedTest.id;
  if (window.opener && !window.opener.closed) {
    try {
      if (typeof window.opener.openResultSubpage === 'function') {
        window.opener.openResultSubpage(testId, { forced: true });
        window.opener.focus();
        showToast('Forced result opened in main window.');
        return;
      }
    } catch (_) {}
  }
  window.open(`../index.html#era?id=${testId}`, '_blank');
}

// ==========================================
// TEST PAPER & SOLUTIONS PDF DOWNLOAD HANDLERS
// ==========================================

// Helper: Check if today's date is strictly less than the test's scheduled date
function isTestDateInFuture(test) {
  if (!test) return false;
  const dateStr = test.exam_date || test.examDate || test.testDate || test.startDate || test.dateTime;
  if (!dateStr) return false;
  const testDate = new Date(dateStr);
  if (Number.isNaN(testDate.getTime())) return false;

  const now = new Date();
  // Clean date-only comparison: start of today vs start of test date
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const testDateStart = new Date(testDate.getFullYear(), testDate.getMonth(), testDate.getDate()).getTime();

  return todayStart < testDateStart;
}

function getActiveToken() {
  let token = API_CONFIG.token;
  if (!token) {
    token = sessionStorage.getItem('fy_token') || localStorage.getItem('fy_token') || '';
  }
  if (!token && window.opener && !window.opener.closed) {
    try {
      token = window.opener.API_CONFIG?.token || window.opener.sessionStorage?.getItem('fy_token') || '';
    } catch (_) {}
  }
  return token;
}

function getActiveAcademicYear() {
  if (selectedTest && (selectedTest.academic_year || selectedTest.academicYear)) {
    return Number(selectedTest.academic_year || selectedTest.academicYear);
  }
  const yearSel = document.getElementById('year-selector');
  if (yearSel && yearSel.value !== 'all') {
    return Number(yearSel.value);
  }
  return Number(API_CONFIG.academicYear) || new Date().getFullYear();
}

function setDownloadButtonsState(isDownloading, activeKind = '') {
  const testBtns = [
    document.getElementById('btn-download-test-header'),
    document.getElementById('btn-download-test-body')
  ].filter(Boolean);

  const solBtns = [
    document.getElementById('btn-download-solution-header'),
    document.getElementById('btn-download-solution-body')
  ].filter(Boolean);

  const allBtns = [...testBtns, ...solBtns];

  if (isDownloading) {
    allBtns.forEach(btn => btn.disabled = true);
    if (activeKind === 'questions') {
      testBtns.forEach(btn => {
        btn.dataset.prevHtml = btn.innerHTML;
        btn.innerHTML = `
          <svg class="spin-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10" stroke-opacity="0.25"></circle>
            <path d="M12 2a10 10 0 0 1 10 10" stroke-linecap="round"></path>
          </svg>
          <span>Downloading...</span>
        `;
      });
    } else if (activeKind === 'solutions') {
      solBtns.forEach(btn => {
        btn.dataset.prevHtml = btn.innerHTML;
        btn.innerHTML = `
          <svg class="spin-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10" stroke-opacity="0.25"></circle>
            <path d="M12 2a10 10 0 0 1 10 10" stroke-linecap="round"></path>
          </svg>
          <span>Downloading...</span>
        `;
      });
    }
  } else {
    allBtns.forEach(btn => {
      btn.disabled = false;
      if (btn.dataset.prevHtml) {
        btn.innerHTML = btn.dataset.prevHtml;
        delete btn.dataset.prevHtml;
      }
    });
  }
}

async function handleDownload(testId, testName, kind) {
  const rawId = Number(testId);
  if (!rawId || Number.isNaN(rawId) || rawId <= 0) {
    showToast('Valid Test ID is required.');
    return;
  }

  // Hard rule: Check if today's date is less than the test's date
  const targetTest = allTests.find(t => String(t.id) === String(rawId)) || selectedTest;
  if (targetTest && isTestDateInFuture(targetTest)) {
    const dtLabel = formatDateLabel(targetTest.exam_date || targetTest.examDate || targetTest.testDate || targetTest.startDate || targetTest.dateTime);
    showToast(`Cannot download: Today's date is before the test date (${dtLabel}).`);
    const progBox = document.getElementById('test-download-progress');
    const progStatus = document.getElementById('download-progress-status');
    const progBar = document.getElementById('download-progress-bar');
    const progPercent = document.getElementById('download-progress-percent');
    if (progBox) progBox.style.display = 'block';
    if (progStatus) progStatus.textContent = `Download blocked: Test is scheduled for future date (${dtLabel}).`;
    if (progPercent) progPercent.textContent = 'Locked';
    if (progBar) {
      progBar.style.background = '#ef4444';
      progBar.style.width = '100%';
    }
    return;
  }

  const token = getActiveToken();
  if (!token) {
    showToast('Please log in to the portal first to download tests.');
    const progStatus = document.getElementById('download-progress-status');
    const progBox = document.getElementById('test-download-progress');
    if (progBox) progBox.style.display = 'block';
    if (progStatus) progStatus.textContent = 'Auth token missing. Please log into the main portal.';
    return;
  }

  if (!window.TestDownloader) {
    showToast('Downloader engine not loaded. Please refresh the page.');
    return;
  }

  const progBox = document.getElementById('test-download-progress');
  const progStatus = document.getElementById('download-progress-status');
  const progPercent = document.getElementById('download-progress-percent');
  const progBar = document.getElementById('download-progress-bar');

  if (progBox) progBox.style.display = 'block';
  if (progBar) {
    progBar.style.background = 'linear-gradient(90deg, #f43f5e, #0ea5e9)';
    progBar.style.width = '10%';
  }
  if (progPercent) progPercent.textContent = '10%';
  if (progStatus) progStatus.textContent = `Initializing ${kind === 'questions' ? 'question paper' : 'solutions'} fetch for Test #${rawId}...`;

  setDownloadButtonsState(true, kind);

  const onProgress = (p) => {
    if (!progStatus || !progPercent || !progBar) return;
    if (p.phase === 'fetching') {
      progStatus.textContent = p.message || 'Connecting to NTSC servers...';
      progPercent.textContent = '20%';
      progBar.style.width = '20%';
    } else if (p.phase === 'questions') {
      const pct = 20 + Math.round((p.current / (p.total || 1)) * 70);
      progPercent.textContent = `${pct}%`;
      progBar.style.width = `${pct}%`;
      progStatus.textContent = `Processing question ${p.current} / ${p.total} (${p.subject || 'Exam'})...`;
    } else if (p.phase === 'solutions') {
      const pct = 20 + Math.round((p.current / (p.total || 1)) * 70);
      progPercent.textContent = `${pct}%`;
      progBar.style.width = `${pct}%`;
      progStatus.textContent = `Processing solution ${p.current} / ${p.total} (${p.subject || 'Exam'})...`;
    } else if (p.phase === 'saving') {
      progPercent.textContent = '95%';
      progBar.style.width = '95%';
      progStatus.textContent = `Compiling & optimizing PDF (${p.current} pages)...`;
    }
  };

  try {
    const year = getActiveAcademicYear();
    let result;
    if (kind === 'questions') {
      result = await window.TestDownloader.downloadTestPaperPdf(rawId, testName, token, onProgress);
      showToast(`Downloaded "${result.testName}" as PDF!`);
    } else {
      result = await window.TestDownloader.downloadSolutionsPdf(rawId, testName, token, year, onProgress);
      const summary = result.totalImages ? ` (${result.totalImages} images embedded)` : '';
      showToast(`Downloaded solutions for "${result.testName}"${summary}!`);
    }

    if (progPercent) progPercent.textContent = '100%';
    if (progBar) {
      progBar.style.background = '#10b981';
      progBar.style.width = '100%';
    }
    if (progStatus) {
      progStatus.textContent = `Completed! Saved as "${result.filename}" (${result.totalPages} pages).`;
    }

    setTimeout(() => {
      if (progBox) progBox.style.display = 'none';
    }, 6000);
  } catch (err) {
    console.error('Download error:', err);
    const msg = err.message || 'Download failed.';
    showToast(msg);
    if (progStatus) progStatus.textContent = `Error: ${msg}`;
    if (progBar) {
      progBar.style.background = '#ef4444';
      progBar.style.width = '100%';
    }
    if (progPercent) progPercent.textContent = 'Failed';
  } finally {
    setDownloadButtonsState(false);
  }
}

function downloadCurrentTestPaper() {
  if (!selectedTest || !selectedTest.id) {
    showToast('Please select a test from the list first.');
    return;
  }
  handleDownload(selectedTest.id, selectedTest.name, 'questions');
}

function downloadCurrentTestSolution() {
  if (!selectedTest || !selectedTest.id) {
    showToast('Please select a test from the list first.');
    return;
  }
  handleDownload(selectedTest.id, selectedTest.name, 'solutions');
}

// Background & On-Demand Portal Scanner (Tracks all tests)
async function triggerPortalScan(silent = false) {
  const scanBtn = document.getElementById('btn-scan-portal');
  if (scanBtn) {
    scanBtn.disabled = true;
    scanBtn.textContent = 'Scanning...';
  }

  try {
    let candidateTests = [];

    // 1. First check window.opener APP_STATE
    if (window.opener && !window.opener.closed && window.opener.APP_STATE) {
      try {
        const openerState = window.opener.APP_STATE;
        if (Array.isArray(openerState.tests) && openerState.tests.length) {
          candidateTests.push(...openerState.tests);
        }
        if (Array.isArray(openerState.eraTests) && openerState.eraTests.length) {
          candidateTests.push(...openerState.eraTests);
        }
      } catch (_) {}
    }

    // 2. Fetch directly from ExaminationHall API
    if (!candidateTests.length && API_CONFIG.token) {
      try {
        const res = await loginProxyFetch('https://ntsc.narayanatalent.com/exam-service/api/ExaminationHall/GetTests', {
          method: 'POST',
          headers: authHeaders(API_CONFIG.token),
          body: JSON.stringify({
            searchKey: '',
            pageNumber: 1,
            pageSize: 10,
            id: 0,
            academicYear: String(API_CONFIG.academicYear || new Date().getFullYear())
          })
        });

        if (res.ok) {
          const json = await res.json();
          if (Array.isArray(json?.data?.result)) {
            candidateTests.push(...json.data.result);
          }
        }
      } catch (_) {}
    }

    if (!candidateTests.length && !silent) {
      showToast('No tests found to scan.');
      return;
    }

    const latest10 = candidateTests.slice(0, 10);

    if (latest10.length === 0) {
      if (!silent) showToast('No tests found.');
    } else {
      const payload = latest10.map(t => {
        const testId = Number(t.id || t.testPaperId || t.testId || t.examId);
        const testName = String(t.testName || t.name || t.examName || t.title || 'Exam').trim();
        const examDate = t.examDate || t.testDate || t.startDate || t.dateTime || null;
        const mode = getTestModeLabel(t);
        return {
          id: testId,
          name: testName,
          mode: mode,
          academic_year: API_CONFIG.academicYear ? Number(API_CONFIG.academicYear) : (t.academicYear ? Number(t.academicYear) : null),
          exam_date: examDate ? String(examDate) : null,
          updated_at: new Date().toISOString()
        };
      }).filter(t => t.id && !Number.isNaN(t.id) && t.name);

      if (payload.length > 0) {
        const { error } = await supabaseClient.from('test_ids').upsert(payload, {
          onConflict: 'id'
        });

        if (error) {
          if (!silent) showToast('Error syncing to Supabase: ' + error.message);
        } else {
          if (!silent) showToast(`Synced ${payload.length} test(s) to Supabase!`);
          await loadTestsFromSupabase();
        }
      }
    }
  } catch (err) {
    if (!silent) showToast('Scan failed: ' + (err.message || err));
  } finally {
    if (scanBtn) {
      scanBtn.disabled = false;
      scanBtn.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M23 4v6h-6"></path>
          <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
        </svg>
        Scan Portal
      `;
    }
  }
}

// Sidebar toggle handlers for mobile
window.toggleSidebar = function () {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('overlay');
  if (!sidebar) return;
  sidebar.classList.toggle('open');
  if (overlay) {
    overlay.style.display = sidebar.classList.contains('open') ? 'block' : 'none';
  }
};

window.closeSidebar = function () {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('overlay');
  if (!sidebar) return;
  sidebar.classList.remove('open');
  if (overlay) {
    overlay.style.display = 'none';
  }
};

// Global exports
window.scanTestIds = () => triggerPortalScan(false);
window.scanOnlineTests = window.scanTestIds;
window.filterTests = filterTests;
window.selectTest = selectTest;
window.copySelectedTestId = copySelectedTestId;
window.openTestInAttemptTest = openTestInAttemptTest;
window.openTestInPortal = openTestInPortal;
window.openTestInForcedResult = openTestInForcedResult;
window.triggerPortalScan = () => triggerPortalScan(false);

// Download exports
window.downloadCurrentTestPaper = downloadCurrentTestPaper;
window.downloadCurrentTestSolution = downloadCurrentTestSolution;
window.handleDownload = handleDownload;

// Page Initialization (Loads database and runs automatic scan in background)
window.addEventListener('DOMContentLoaded', async () => {
  applyUserTheme();
  initSupabase();
  initYearSelector();
  await loadTestsFromSupabase();

  // Automatic scan on page load if user is logged into the portal
  if (API_CONFIG.token) {
    triggerPortalScan(true);
  }
});
