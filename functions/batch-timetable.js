const CHEM_SUPABASE_URL = "https://rhsrrljgejgyqnndcdia.supabase.co";
const CHEM_SUPABASE_KEY = "sb_publishable_vGRx87SiIMaJXeGnrMVN9g_bLPu899U";
const CLOUDFLARE_PROXY = 'https://frosty-frog-31f9.evodev.workers.dev/';
const API_CONFIG = {
  token: sessionStorage.getItem('fy_token') || localStorage.getItem('fy_token') || '',
  academicYear: Number(sessionStorage.getItem('fy_academic_year') || localStorage.getItem('fy_academic_year') || new Date().getFullYear())
};
let supabaseClient = null;
let allBatches = [];

// Cookie Helpers
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

// Helpers for API requests
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
  return String(v !== null && v !== void 0 ? v : '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}
function normalizeDateKey(value) {
  if (!value) return '';
  const raw = String(value).trim();
  const iso = raw.match(/\d{4}-\d{2}-\d{2}/);
  if (iso) return iso[0];
  const dt = new Date(raw);
  if (Number.isNaN(dt.getTime())) return raw;
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

// Year dropdown populator
function initYearSelector() {
  const yearSelector = document.getElementById('year-selector');
  if (yearSelector && yearSelector.options.length === 0) {
    const currentYear = new Date().getFullYear();
    for (let y = currentYear - 1; y <= currentYear + 1; y++) {
      yearSelector.add(new Option(`${y} - ${y + 1}`, y, false, y === API_CONFIG.academicYear));
    }
  }
}
function formatDateLabel(dateStr) {
  const dt = new Date(dateStr);
  if (Number.isNaN(dt.getTime())) return String(dateStr || 'Unknown date');
  return dt.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
}
function formatTimeLabel(raw) {
  const parts = String(raw || '').split(':');
  const h = Number(parts[0]),
    m = Number(parts[1] || 0);
  if (Number.isNaN(h) || Number.isNaN(m)) return String(raw || '');
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.toLocaleTimeString('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
}
function timeToMinutes(raw) {
  const parts = String(raw || '').split(':');
  const h = Number(parts[0]),
    m = Number(parts[1] || 0);
  return Number.isNaN(h) || Number.isNaN(m) ? Number.MAX_SAFE_INTEGER : h * 60 + m;
}
function getSubjectClass(subject) {
  const s = String(subject || '').toLowerCase();
  if (s.includes('phy')) return 'tt-phy';
  if (s.includes('chem')) return 'tt-chem';
  if (s.includes('math')) return 'tt-math';
  return 'tt-phy';
}

// Supabase Init
function initSupabase() {
  if (window.supabase) {
    supabaseClient = window.supabase.createClient(CHEM_SUPABASE_URL, CHEM_SUPABASE_KEY);
  }
}

// Fetch Timetable from Portal API
async function fetchTimetable(token, batchId) {
  const url = `https://ntsc.narayanatalent.com/classes-service/api/LiveClass/GetStudentClasses/${batchId}`;
  const res = await loginProxyFetch(url, {
    headers: authHeaders(token)
  });
  if (!res.ok) throw new Error('Timetable API failed');
  const json = await res.json();
  return Array.isArray(json === null || json === void 0 ? void 0 : json.data) ? json.data : [];
}

// Load batches from Supabase
async function loadBatches() {
  const loadingEl = document.getElementById('batch-loading');
  const listEl = document.getElementById('batch-list');
  if (!supabaseClient) {
    loadingEl.textContent = 'Supabase client not loaded.';
    return;
  }
  try {
    const {
      data,
      error
    } = await supabaseClient.from('batches').select('id, name, year').order('name', {
      ascending: true
    });
    if (error) {
      loadingEl.textContent = 'Error loading batches: ' + error.message;
      return;
    }
    allBatches = data || [];
    loadingEl.style.display = 'none';
    filterBatches();
  } catch (err) {
    loadingEl.textContent = 'Error: ' + (err.message || err);
  }
}
function renderBatchesList(batches) {
  const listEl = document.getElementById('batch-list');
  if (!listEl) return;
  if (batches.length === 0) {
    listEl.innerHTML = '<div style="text-align: center; color: var(--text3); font-size: 13px; padding: 20px 0;">No batches found</div>';
    return;
  }
  listEl.innerHTML = batches.map(b => {
    const yearLabel = b.year ? `Year: ${b.year}` : 'No Year';
    return `
      <button class="batch-item-btn" id="batch-btn-${b.id}" onclick="selectBatch('${b.id}', '${escapeHtml(b.name)}')">
        <div style="font-weight:600; color:var(--text);">${escapeHtml(b.name)}</div>
        <div style="font-size:11px; color:var(--text3); margin-top:4px; display:flex; justify-content:space-between;">
          <span>ID: ${b.id}</span>
          <span>${yearLabel}</span>
        </div>
      </button>
    `;
  }).join('');
}
function filterBatches() {
  const searchInput = document.getElementById('batch-search');
  const yearSelector = document.getElementById('year-selector');
  const q = searchInput ? searchInput.value.toLowerCase().trim() : '';
  const selectedYear = yearSelector ? Number(yearSelector.value) : API_CONFIG.academicYear;
  const filtered = allBatches.filter(b => {
    // If year is defined in database, check matches selectedYear
    const matchesYear = b.year ? Number(b.year) === selectedYear : true;
    const matchesQuery = !q || String(b.name).toLowerCase().includes(q) || String(b.id).includes(q);
    return matchesYear && matchesQuery;
  });
  renderBatchesList(filtered);
}

// Select a batch and load its timetable
async function selectBatch(batchId, batchName) {
  // Close mobile sidebar if open
  if (window.innerWidth <= 768) {
    closeSidebar();
  }

  // Highlight active batch in sidebar
  document.querySelectorAll('.batch-item-btn').forEach(el => el.classList.remove('active'));
  const btn = document.getElementById(`batch-btn-${batchId}`);
  if (btn) btn.classList.add('active');

  // Update header labels
  document.getElementById('selected-batch-name').textContent = batchName;
  const grid = document.getElementById('timetable-grid');
  const placeholder = document.getElementById('timetable-placeholder');
  placeholder.style.display = 'block';
  placeholder.textContent = 'Loading timetable...';
  grid.style.display = 'none';
  grid.innerHTML = '';
  document.getElementById('timetable-range').textContent = `Batch ID: ${batchId}`;
  if (!API_CONFIG.token) {
    placeholder.innerHTML = `
      <div style="text-align:center;">
        <h3 style="font-size:16px; font-weight:600; color:var(--text);">Session Expired</h3>
        <p style="font-size:13px; color:var(--text3); margin-top:8px;">Please log in to the main portal first to fetch timetables.</p>
      </div>
    `;
    return;
  }
  try {
    const rawData = await fetchTimetable(API_CONFIG.token, batchId);

    // Process and sort classes
    const clean = rawData.filter(c => !String((c === null || c === void 0 ? void 0 : c.classType) || '').includes('Doubt')).map(c => ({
      ...c,
      classDateKey: normalizeDateKey(c.classDate)
    })).filter(c => c.classDateKey);
    if (clean.length === 0) {
      placeholder.style.display = 'block';
      placeholder.textContent = 'No classes scheduled for this batch.';
      return;
    }
    const dates = [...new Set(clean.map(c => c.classDateKey))].sort();
    document.getElementById('timetable-range').textContent = `${formatDateLabel(dates[0])} - ${formatDateLabel(dates[dates.length - 1])} · Batch ID: ${batchId}`;
    placeholder.style.display = 'none';
    grid.style.display = 'grid';
    grid.style.gridTemplateColumns = 'repeat(auto-fit, minmax(220px, 1fr))';
    grid.style.gap = '12px';
    grid.style.background = 'transparent';
    grid.style.minWidth = 'unset';
    grid.innerHTML = dates.map(dateKey => {
      const dayItems = clean.filter(c => c.classDateKey === dateKey).sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
      const dayLabel = new Date(`${dateKey}T00:00:00`).toLocaleDateString('en-IN', {
        weekday: 'short',
        day: '2-digit',
        month: 'short'
      });
      const rows = dayItems.length ? dayItems.map(c => `
            <div style="padding:8px 10px;background:var(--bg3);border:1px solid var(--border);border-radius:8px;margin-top:8px">
              <div style="font-size:11px;color:var(--text3);margin-bottom:4px">${escapeHtml(formatTimeLabel(c.startTime))}</div>
              <div class="tt-class ${getSubjectClass(c.subjects)}">${escapeHtml(c.subjects || 'Class')}</div>
              <div style="font-size:11px;color:var(--text3);margin-top:5px">${escapeHtml(c.classType || 'Live Class')}</div>
            </div>
          `).join('') : '<div style="font-size:11px;color:var(--text3);margin-top:8px">No classes scheduled</div>';
      return `
        <div style="background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:10px">
          <div style="font-size:12px;font-weight:600;color:var(--text2)">${escapeHtml(dayLabel)}</div>
          ${rows}
        </div>
      `;
    }).join('');
  } catch (err) {
    placeholder.style.display = 'block';
    placeholder.innerHTML = `<span style="color:var(--red);">${escapeHtml(err.message)}</span>`;
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
window.filterBatches = filterBatches;
window.selectBatch = selectBatch;

// Init Page
window.addEventListener('DOMContentLoaded', () => {
  applyUserTheme();
  initSupabase();
  initYearSelector();
  loadBatches();
});
