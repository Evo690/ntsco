const CHEM_SUPABASE_URL = "https://rhsrrljgejgyqnndcdia.supabase.co";
const CHEM_SUPABASE_KEY = "sb_publishable_vGRx87SiIMaJXeGnrMVN9g_bLPu899U";
const CLOUDFLARE_PROXY = 'https://frosty-frog-31f9.evodev.workers.dev/';

const API_CONFIG = {
  token: sessionStorage.getItem('fy_token') || localStorage.getItem('fy_token') || '',
  academicYear: Number(sessionStorage.getItem('fy_academic_year') || localStorage.getItem('fy_academic_year') || new Date().getFullYear())
};

let supabaseClient = null;
let allClasses = [];
let allBatches = [];
let selectedBatchName = null;
let currentSubjectFilter = 'all';

// --- Cookie & User Helpers ---
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
    Accept: 'application/json, text/plain, */*',
    Origin: 'https://ntsc.narayanatalent.com',
    Referer: 'https://ntsc.narayanatalent.com/dashboard?path=Previous%20Classes'
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

// Date & Time Formatters
function formatDateLabel(dateStr) {
  if (!dateStr) return 'No date';
  const dt = new Date(dateStr);
  if (Number.isNaN(dt.getTime())) return String(dateStr);
  return dt.toLocaleDateString('en-IN', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
}

function formatClassTiming(startDateTimeStr, durationMinutes) {
  if (!startDateTimeStr) return 'Timing not specified';
  const dt = new Date(startDateTimeStr);
  if (Number.isNaN(dt.getTime())) return startDateTimeStr;

  const startFormatted = dt.toLocaleTimeString('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });

  const duration = Number(durationMinutes) || 0;
  if (duration > 0) {
    const endDt = new Date(dt.getTime() + duration * 60000);
    const endFormatted = endDt.toLocaleTimeString('en-IN', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
    return `${startFormatted} - ${endFormatted} (${duration}m)`;
  }
  return `${startFormatted}`;
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

// Subject Tag Helper
function getSubjectTagClass(subject) {
  const s = String(subject || '').toLowerCase();
  if (s.includes('chem')) return 'sub-chem';
  if (s.includes('phy')) return 'sub-phy';
  if (s.includes('math')) return 'sub-math';
  if (s.includes('bio') || s.includes('bot') || s.includes('zoo')) return 'sub-bio';
  return 'sub-other';
}

function getSubjectBadgeHtml(subject) {
  const sub = subject || 'General';
  const tagClass = getSubjectTagClass(sub);
  return `<span class="subject-pill ${tagClass}">${escapeHtml(sub)}</span>`;
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
  if (yearSelector && yearSelector.options.length <= 1) {
    const currentYear = new Date().getFullYear();
    for (let y = currentYear + 1; y >= currentYear - 3; y--) {
      yearSelector.add(new Option(`Year ${y} - ${y + 1}`, y, false, false));
    }
  }
}

// Load classes from Supabase
async function loadClassesFromSupabase() {
  const loadingEl = document.getElementById('batch-loading');
  if (!supabaseClient) {
    if (loadingEl) loadingEl.textContent = 'Supabase client not initialized.';
    return;
  }
  try {
    const { data, error } = await supabaseClient
      .from('recorded_classes')
      .select('*')
      .order('start_date_time', { ascending: false });

    if (error) {
      console.warn('Supabase load error:', error.message);
      if (loadingEl) loadingEl.textContent = 'No recorded classes cached.';
      return;
    }

    if (data && data.length > 0) {
      allClasses = data.map(item => ({
        id: item.id,
        name: item.batch_name || item.name || 'Unknown Batch',
        batchCode: item.batch_code || item.batchCode || item.batch_name,
        subject: item.subject,
        courseName: item.course_name || item.courseName || '',
        startDateTime: item.start_date_time || item.startDateTime || '',
        duration: item.duration || 0,
        liveClassType: item.live_class_type || item.liveClassType || 'Regular Class',
        teacher: item.teacher || null,
        academicYear: item.academic_year || item.academicYear || 2026,
        created_at: item.created_at,
        updated_at: item.updated_at
      }));

      processBatchesFromClasses();
      if (loadingEl) loadingEl.style.display = 'none';
      filterBatches();

      if (selectedBatchName) {
        selectBatch(selectedBatchName);
      }
    } else {
      if (loadingEl) loadingEl.textContent = 'No recorded classes found.';
    }
  } catch (err) {
    console.error('Error loading classes:', err);
    if (loadingEl) loadingEl.textContent = 'Error: ' + (err.message || err);
  }
}

// Process unique batches from classes array
function processBatchesFromClasses() {
  const batchMap = new Map();

  allClasses.forEach(c => {
    const batchName = String(c.name || c.batchCode || 'Unknown Batch').trim();
    if (!batchMap.has(batchName)) {
      batchMap.set(batchName, {
        name: batchName,
        code: c.batchCode || batchName,
        academicYear: c.academicYear || API_CONFIG.academicYear,
        classes: [],
        subjects: new Set(),
        latestDateTime: c.startDateTime || ''
      });
    }
    const b = batchMap.get(batchName);
    b.classes.push(c);
    if (c.subject) b.subjects.add(c.subject);
    if (c.startDateTime && (!b.latestDateTime || new Date(c.startDateTime) > new Date(b.latestDateTime))) {
      b.latestDateTime = c.startDateTime;
    }
  });

  allBatches = Array.from(batchMap.values()).sort((a, b) => a.name.localeCompare(b.name));
}

// Render batch list in sidebar
function renderBatchesList(batches) {
  const listEl = document.getElementById('batch-list');
  if (!listEl) return;

  if (batches.length === 0) {
    listEl.innerHTML = '<div style="text-align: center; color: var(--text3); font-size: 13px; padding: 20px 0;">No batches found</div>';
    return;
  }

  listEl.innerHTML = batches.map(b => {
    const isSelected = selectedBatchName === b.name;
    const count = b.classes.length;
    const yearLabel = b.academicYear ? `Year ${b.academicYear}` : '';
    return `
      <button class="batch-item-btn ${isSelected ? 'active' : ''}" id="batch-btn-${escapeHtml(b.name)}" onclick="selectBatch('${escapeHtml(b.name)}')">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <div style="font-weight:600; color:var(--text); font-size:13px;">${escapeHtml(b.name)}</div>
          <span style="font-size:11px; font-weight:700; color:var(--accent);">${count}</span>
        </div>
        <div style="font-size:11px; color:var(--text3); margin-top:4px; display:flex; justify-content:space-between;">
          <span>${b.subjects.size} ${b.subjects.size === 1 ? 'subject' : 'subjects'}</span>
          <span>${yearLabel}</span>
        </div>
      </button>
    `;
  }).join('');
}

// Filter batches in sidebar
function filterBatches() {
  const searchInput = document.getElementById('batch-search');
  const yearSelector = document.getElementById('year-selector');
  const q = searchInput ? searchInput.value.toLowerCase().trim() : '';
  const selectedYear = yearSelector ? yearSelector.value : 'all';

  const filtered = allBatches.filter(b => {
    const matchesYear = selectedYear === 'all' || String(b.academicYear) === String(selectedYear);
    const matchesQuery = !q || b.name.toLowerCase().includes(q) || b.code.toLowerCase().includes(q);
    return matchesYear && matchesQuery;
  });

  renderBatchesList(filtered);
}

// Select a batch and display its classes
function selectBatch(batchName) {
  selectedBatchName = batchName;
  const batch = allBatches.find(b => b.name === batchName);

  // Active state in sidebar
  document.querySelectorAll('.batch-item-btn').forEach(el => el.classList.remove('active'));
  const btn = document.getElementById(`batch-btn-${batchName}`);
  if (btn) btn.classList.add('active');

  // Close mobile sidebar
  if (window.innerWidth <= 768) {
    closeSidebar();
  }

  // Update batch header
  const titleEl = document.getElementById('selected-batch-name');
  const metaEl = document.getElementById('classes-meta-info');
  const filtersRow = document.getElementById('batch-filters-row');
  const searchWrap = document.getElementById('batch-search-wrap');

  if (titleEl) titleEl.textContent = `Batch: ${batchName}`;
  if (metaEl) {
    metaEl.textContent = batch 
      ? `${batch.classes.length} classes recorded · Academic Year ${batch.academicYear || 2026}`
      : '';
  }

  if (filtersRow) filtersRow.style.display = 'flex';
  if (searchWrap) searchWrap.style.display = 'block';

  // Hide placeholder, show grid
  const placeholder = document.getElementById('classes-placeholder');
  const grid = document.getElementById('classes-grid');
  if (placeholder) placeholder.style.display = 'none';
  if (grid) grid.style.display = 'grid';

  filterClassesInBatch();
}

// Filter & search classes within the selected batch
function filterClassesInBatch() {
  if (!selectedBatchName) return;
  const batch = allBatches.find(b => b.name === selectedBatchName);
  if (!batch) return;

  const searchInput = document.getElementById('class-filter-search');
  const q = searchInput ? searchInput.value.toLowerCase().trim() : '';

  const filtered = batch.classes.filter(c => {
    const matchesSubject = currentSubjectFilter === 'all' || 
      String(c.subject || '').toLowerCase() === currentSubjectFilter.toLowerCase();

    const idStr = String(c.id || '');
    const courseStr = String(c.courseName || '').toLowerCase();
    const dateStr = formatDateLabel(c.startDateTime).toLowerCase();
    const subjectStr = String(c.subject || '').toLowerCase();

    const matchesQuery = !q || idStr.includes(q) || courseStr.includes(q) || dateStr.includes(q) || subjectStr.includes(q);

    return matchesSubject && matchesQuery;
  });

  renderClassesGrid(filtered);
}

// Subject filter chip click
function filterBySubject(subject, btnEl) {
  currentSubjectFilter = subject;
  document.querySelectorAll('#batch-filters-row .filter-chip').forEach(el => el.classList.remove('active'));
  if (btnEl) btnEl.classList.add('active');
  filterClassesInBatch();
}

// Render class cards
function renderClassesGrid(classes) {
  const grid = document.getElementById('classes-grid');
  if (!grid) return;

  if (classes.length === 0) {
    grid.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; color: var(--text3); font-size: 13px; padding: 40px 10px;">
        No classes found matching the filter.
      </div>
    `;
    return;
  }

  grid.innerHTML = classes.map(c => {
    const dateFormatted = formatDateLabel(c.startDateTime);
    const timingFormatted = formatClassTiming(c.startDateTime, c.duration);
    const badgeHtml = getSubjectBadgeHtml(c.subject);

    return `
      <div class="class-card">
        <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
          ${badgeHtml}
          <div style="display: flex; align-items: center; gap: 6px;">
            <button class="theme-mode-btn" onclick="watchRecording(${c.id})" title="Watch lecture recording" style="margin: 0; padding: 2px 8px; font-size: 11px; height: 24px; display: inline-flex; align-items: center; gap: 4px; background: rgba(239, 68, 68, 0.12); color: #ef4444; border-color: rgba(239, 68, 68, 0.3);">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="5 3 19 12 5 21 5 3"></polygon>
              </svg>
              Watch
            </button>
            <span class="id-badge" onclick="copyClassId(${c.id})" title="Click to copy Class ID">
              ID: ${c.id}
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
            </span>
          </div>
        </div>

        <div style="font-weight: 600; color: var(--text); font-size: 13.5px; line-height: 1.4;">
          ${escapeHtml(c.courseName || c.name || 'Recorded Class')}
        </div>

        <div style="display: flex; flex-direction: column; gap: 6px; font-size: 12px; color: var(--text2); margin-top: 2px; border-top: 1px solid var(--border); padding-top: 8px;">
          <div style="display: flex; align-items: center; gap: 6px;">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color: var(--text3); flex-shrink: 0;">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="16" y1="2" x2="16" y2="6"></line>
              <line x1="8" y1="2" x2="8" y2="6"></line>
              <line x1="3" y1="10" x2="21" y2="10"></line>
            </svg>
            <span style="font-weight: 500;">${dateFormatted}</span>
          </div>

          <div style="display: flex; align-items: center; gap: 6px;">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color: var(--text3); flex-shrink: 0;">
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
            <span>${timingFormatted}</span>
          </div>

          <div style="display: flex; align-items: center; justify-content: space-between; margin-top: 4px; font-size: 11px; color: var(--text3);">
            <span>Type: ${escapeHtml(c.liveClassType || 'Regular')}</span>
            <span>Batch: <strong style="color: var(--text);">${escapeHtml(c.name || c.batchCode)}</strong></span>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// Copy Class ID
function copyClassId(id) {
  if (!id) return;
  navigator.clipboard.writeText(String(id)).then(() => {
    showToast(`Class ID ${id} copied!`);
  }).catch(() => {
    const textArea = document.createElement('textarea');
    textArea.value = String(id);
    document.body.appendChild(textArea);
    textArea.select();
    try {
      document.execCommand('copy');
      showToast(`Class ID ${id} copied!`);
    } catch (_) {}
    document.body.removeChild(textArea);
  });
}

// Watch Recording in player
function watchRecording(id) {
  if (!id) return;
  window.open(`watch-recording.html?id=${encodeURIComponent(id)}`, '_blank');
}

// ==========================================
// PORTAL API FETCH & SUPABASE SYNC LOGIC
// Note: Uses pageSize: 10 with totalRecord pagination
// ==========================================
async function fetchAndSyncClasses() {
  if (!API_CONFIG.token) return;

  try {
    const academicYear = API_CONFIG.academicYear || 2026;
    const PAGE_SIZE = 10;
    let fetchedClasses = [];
    let totalRecords = 0;
    let totalPages = 1;

    // 1. First Page
    const firstPayload = {
      startDate: '',
      endDate: '',
      searchKey: '',
      pageNumber: 1,
      pageSize: PAGE_SIZE,
      isGetVideoUrl: false,
      academicYear: academicYear
    };

    const firstRes = await loginProxyFetch('https://ntsc.narayanatalent.com/classes-service/api/LiveClass/RecordedClasses', {
      method: 'POST',
      headers: authHeaders(API_CONFIG.token),
      body: JSON.stringify(firstPayload)
    });

    if (!firstRes.ok) return;

    const firstJson = await firstRes.json();
    const firstRecords = firstJson?.data?.data || [];
    totalRecords = Number(firstJson?.data?.totalRecord) || firstRecords.length;

    if (Array.isArray(firstRecords) && firstRecords.length > 0) {
      fetchedClasses.push(...firstRecords);
    }

    totalPages = totalRecords > 0 ? Math.ceil(totalRecords / PAGE_SIZE) : 1;
    totalPages = Math.min(totalPages, 50);

    // 2. Remaining Pages
    for (let page = 2; page <= totalPages; page++) {
      try {
        const pagePayload = {
          startDate: '',
          endDate: '',
          searchKey: '',
          pageNumber: page,
          pageSize: PAGE_SIZE,
          isGetVideoUrl: false,
          academicYear: academicYear
        };

        const pageRes = await loginProxyFetch('https://ntsc.narayanatalent.com/classes-service/api/LiveClass/RecordedClasses', {
          method: 'POST',
          headers: authHeaders(API_CONFIG.token),
          body: JSON.stringify(pagePayload)
        });

        if (pageRes.ok) {
          const pageJson = await pageRes.json();
          const pageRecords = pageJson?.data?.data;
          if (Array.isArray(pageRecords) && pageRecords.length > 0) {
            fetchedClasses.push(...pageRecords);
          } else {
            break;
          }
        }
      } catch (_) {}
    }

    if (fetchedClasses.length === 0) return;

    // Deduplicate
    const uniqueMap = new Map();
    fetchedClasses.forEach(c => {
      const id = Number(c.id);
      if (id && !Number.isNaN(id) && !uniqueMap.has(id)) {
        uniqueMap.set(id, c);
      }
    });
    const uniqueClasses = Array.from(uniqueMap.values());

    // Format for Supabase
    const dbPayload = uniqueClasses.map(c => ({
      id: Number(c.id),
      batch_name: String(c.name || c.batchCode || 'Unknown Batch').trim(),
      batch_code: String(c.batchCode || c.name || '').trim(),
      subject: String(c.subject || 'General').trim(),
      course_name: String(c.courseName || '').trim(),
      start_date_time: c.startDateTime ? String(c.startDateTime) : null,
      duration: Number(c.duration) || 0,
      live_class_type: String(c.liveClassType || 'Regular Class').trim(),
      teacher: c.teacher ? String(c.teacher) : null,
      academic_year: Number(academicYear),
      updated_at: new Date().toISOString()
    })).filter(c => c.id && !Number.isNaN(c.id));

    // Upsert into Supabase
    if (supabaseClient && dbPayload.length > 0) {
      const CHUNK_SIZE = 50;
      for (let i = 0; i < dbPayload.length; i += CHUNK_SIZE) {
        const chunk = dbPayload.slice(i, i + CHUNK_SIZE);
        await supabaseClient.from('recorded_classes').upsert(chunk, {
          onConflict: 'id'
        });
      }
    }

    // Reload UI
    await loadClassesFromSupabase();

    // Fallback in-memory
    if (allClasses.length === 0 && uniqueClasses.length > 0) {
      allClasses = uniqueClasses.map(c => ({
        id: c.id,
        name: c.name || c.batchCode || 'Batch',
        batchCode: c.batchCode || c.name,
        subject: c.subject,
        courseName: c.courseName,
        startDateTime: c.startDateTime,
        duration: c.duration,
        liveClassType: c.liveClassType,
        teacher: c.teacher,
        academicYear: academicYear
      }));
      processBatchesFromClasses();
      const loadingEl = document.getElementById('batch-loading');
      if (loadingEl) loadingEl.style.display = 'none';
      filterBatches();
      if (selectedBatchName) {
        selectBatch(selectedBatchName);
      }
    }
  } catch (err) {
    console.warn('Sync notice:', err);
  }
}

// Sidebar toggle handlers for mobile
window.toggleSidebar = function () {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('overlay');
  if (!sidebar) return;
  sidebar.classList.toggle('open');
  if (overlay) overlay.style.display = sidebar.classList.contains('open') ? 'block' : 'none';
};

window.closeSidebar = function () {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('overlay');
  if (!sidebar) return;
  sidebar.classList.remove('open');
  if (overlay) overlay.style.display = 'none';
};

// Global Exports
window.filterBatches = filterBatches;
window.selectBatch = selectBatch;
window.filterClassesInBatch = filterClassesInBatch;
window.filterBySubject = filterBySubject;
window.copyClassId = copyClassId;

// Initialization on DOMContentLoaded
window.addEventListener('DOMContentLoaded', async () => {
  applyUserTheme();
  initSupabase();
  initYearSelector();

  await loadClassesFromSupabase();

  if (API_CONFIG.token) {
    fetchAndSyncClasses();
  }
});
