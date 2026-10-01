const CHEM_SUPABASE_URL = "https://rhsrrljgejgyqnndcdia.supabase.co";
const CHEM_SUPABASE_KEY = "sb_publishable_vGRx87SiIMaJXeGnrMVN9g_bLPu899U";
const CLOUDFLARE_PROXY = 'https://frosty-frog-31f9.evodev.workers.dev/';

const API_CONFIG = {
  token: sessionStorage.getItem('fy_token') || localStorage.getItem('fy_token') || '',
  academicYear: Number(sessionStorage.getItem('fy_academic_year') || localStorage.getItem('fy_academic_year') || new Date().getFullYear())
};

let supabaseClient = null;
let currentLeaderboardRows = [];
let activeTestId = null;

// User Identity & Cookie Helpers
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
  return String(v !== null && v !== void 0 ? v : '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function formatDateLabel(dateStr) {
  if (!dateStr) return '';
  const dt = new Date(dateStr);
  if (Number.isNaN(dt.getTime())) return String(dateStr);
  return dt.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
}

function showToast(message) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => {
    toast.classList.remove('show');
  }, 2200);
}

// Supabase Initialization
function initSupabase() {
  if (window.supabase) {
    supabaseClient = window.supabase.createClient(CHEM_SUPABASE_URL, CHEM_SUPABASE_KEY);
  }
}

// Recent Test IDs LocalStorage Management
function getRecentIds() {
  try {
    const raw = localStorage.getItem('fy_lb_recent_ids');
    return raw ? JSON.parse(raw) : [];
  } catch (_) {
    return [];
  }
}

function saveRecentId(id) {
  try {
    const num = Number(id);
    if (!num) return;
    let list = getRecentIds().filter(x => x !== num);
    list.unshift(num);
    list = list.slice(0, 8); // Keep up to 8 recent IDs
    localStorage.setItem('fy_lb_recent_ids', JSON.stringify(list));
    renderRecentChips();
  } catch (_) {}
}

function renderRecentChips() {
  const wrap = document.getElementById('recent-chips-wrap');
  const listEl = document.getElementById('recent-chips-list');
  if (!wrap || !listEl) return;

  const ids = getRecentIds();
  if (!ids.length) {
    wrap.style.display = 'none';
    return;
  }

  wrap.style.display = 'flex';
  listEl.innerHTML = ids.map(id => {
    const isActive = activeTestId && Number(activeTestId) === Number(id);
    return `
      <div class="test-chip ${isActive ? 'active' : ''}" onclick="lookupTestId(${id})">
        #${id}
      </div>
    `;
  }).join('');
}

// Handle Lookup Form Submit
async function handleLookupSubmit(event) {
  if (event) event.preventDefault();
  const input = document.getElementById('test-id-input');
  const rawId = input ? input.value.trim() : '';
  if (!rawId) return;

  const testId = Number(rawId);
  if (Number.isNaN(testId) || testId <= 0) {
    showToast('Please enter a valid numeric Test ID.');
    return;
  }

  await lookupTestId(testId);
}

// Load Leaderboard for Test ID
async function lookupTestId(testId) {
  const cleanId = Number(testId);
  if (!cleanId) return;
  activeTestId = cleanId;

  // Update input & recent chips
  const input = document.getElementById('test-id-input');
  if (input) input.value = cleanId;
  saveRecentId(cleanId);

  const lbSection = document.getElementById('leaderboard-section');
  const loadingEl = document.getElementById('lb-loading');
  const placeholderEl = document.getElementById('lb-initial-placeholder');
  const titleEl = document.getElementById('lb-test-title');
  const metaEl = document.getElementById('lb-test-meta');
  const rowsListEl = document.getElementById('leaderboard-rows-list');

  placeholderEl.style.display = 'none';
  lbSection.style.display = 'none';
  loadingEl.style.display = 'block';
  loadingEl.textContent = `Loading leaderboard for Test ID #${cleanId}...`;

  try {
    // 1. Fetch from Supabase master_leaderboard
    let { data: records, error } = await supabaseClient
      .from('master_leaderboard')
      .select('*')
      .eq('test_id', cleanId)
      .order('rank', { ascending: true, nullsFirst: false });

    // 2. If no records exist in Supabase and token is available, query portal API live
    if ((!records || records.length === 0) && API_CONFIG.token) {
      loadingEl.textContent = `Fetching Test ID #${cleanId} from portal live...`;
      try {
        const lbRes = await loginProxyFetch(
          'https://ntsc.narayanatalent.com/exam-service/api/ExaminationHall/GetLeaderboardScore',
          {
            method: 'POST',
            headers: authHeaders(API_CONFIG.token),
            body: JSON.stringify({ id: cleanId })
          }
        );

        if (lbRes.ok) {
          const lbJson = await lbRes.json();
          const items = Array.isArray(lbJson?.data?.leaderboardScore) ? lbJson.data.leaderboardScore : [];
          if (items.length > 0) {
            const payload = items.map(item => {
              const u = String(item.username || item.userName || item.studentName || item.name || '').trim();
              if (!u) return null;
              return {
                test_id: cleanId,
                test_name: `Test #${cleanId}`,
                username: u,
                student_name: String(item.studentName || item.name || u).trim(),
                score: item.totalMarks != null ? Number(item.totalMarks) : (item.score != null ? Number(item.score) : null),
                max_marks: item.totalSubjectMarks != null ? Number(item.totalSubjectMarks) : (item.maxMarks != null ? Number(item.maxMarks) : null),
                percentage: item.percentage != null ? Number(item.percentage) : null,
                percentile: item.percentile != null ? Number(item.percentile) : null,
                rank: item.rank != null ? Number(item.rank) : null,
                exam_date: item.examDate || null,
                subject_data: item.subjectWise || null,
                updated_at: new Date().toISOString()
              };
            }).filter(Boolean);

            if (payload.length > 0) {
              await supabaseClient.from('master_leaderboard').upsert(payload, { onConflict: 'test_id,username' });
              const { data: refetched } = await supabaseClient
                .from('master_leaderboard')
                .select('*')
                .eq('test_id', cleanId)
                .order('rank', { ascending: true, nullsFirst: false });
              records = refetched || [];
            }
          }
        }
      } catch (_) {}
    }

    currentLeaderboardRows = records || [];
    loadingEl.style.display = 'none';

    if (currentLeaderboardRows.length === 0) {
      placeholderEl.style.display = 'block';
      placeholderEl.innerHTML = `
        <div style="text-align:center;">
          <h3 style="font-size:16px; font-weight:600; color:var(--text);">No Leaderboard Data Yet</h3>
          <p style="font-size:13px; color:var(--text3); margin-top:8px;">
            No scores found in database for Test ID #${cleanId}. When users open the result of this test, their rank and scores will automatically appear here.
          </p>
        </div>
      `;
      return;
    }

    // Sort by rank ascending, with fallback to score descending
    currentLeaderboardRows.sort((a, b) => {
      if (a.rank != null && b.rank != null) return Number(a.rank) - Number(b.rank);
      if (a.rank != null) return -1;
      if (b.rank != null) return 1;
      return (Number(b.score) || 0) - (Number(a.score) || 0);
    });

    titleEl.textContent = `Leaderboard · Test ID #${cleanId}`;
    lbSection.style.display = 'block';
    renderLeaderboardRows(currentLeaderboardRows);
  } catch (err) {
    loadingEl.style.display = 'none';
    placeholderEl.style.display = 'block';
    placeholderEl.innerHTML = `<span style="color:var(--red);">Error loading leaderboard: ${escapeHtml(err.message || err)}</span>`;
  }
}

// Render Leaderboard Rows
function renderLeaderboardRows(rows) {
  const rowsListEl = document.getElementById('leaderboard-rows-list');
  if (!rowsListEl) return;

  if (rows.length === 0) {
    rowsListEl.innerHTML = '<div style="text-align: center; color: var(--text3); font-size: 13px; padding: 30px 0;">No matching candidates found</div>';
    return;
  }

  const myUsername = getCurrentUserId().toLowerCase();

  rowsListEl.innerHTML = rows.map((r, idx) => {
    const rankNum = r.rank != null ? Number(r.rank) : idx + 1;
    const isMe = String(r.username || '').toLowerCase() === myUsername;

    let medalClass = 'rank-other';
    let medalContent = `#${rankNum}`;
    if (rankNum === 1) {
      medalClass = 'rank-1';
      medalContent = '🥇 1';
    } else if (rankNum === 2) {
      medalClass = 'rank-2';
      medalContent = '🥈 2';
    } else if (rankNum === 3) {
      medalClass = 'rank-3';
      medalContent = '🥉 3';
    }

    const scoreStr = r.score != null ? (r.max_marks ? `${r.score} <span style="font-size:12px;font-weight:400;color:var(--text3);">/ ${r.max_marks}</span>` : `${r.score}`) : 'N/A';
    const percentStr = r.percentage != null ? `${Number(r.percentage).toFixed(1)}%` : '';
    const percentileStr = r.percentile != null ? `<span class="percentile-badge">${Number(r.percentile).toFixed(2)} %ile</span>` : '';

    let subjectTagsHtml = '';
    if (r.subject_data && Array.isArray(r.subject_data)) {
      subjectTagsHtml = `<div style="display:flex; gap:6px; flex-wrap:wrap; margin-top:4px;">` +
        r.subject_data.map(sub => {
          const sName = sub.subjectName || sub.name || '';
          const sScore = sub.totalMarks != null ? sub.totalMarks : (sub.marks != null ? sub.marks : sub.score);
          if (!sName || sScore == null) return '';
          return `<span class="sub-tag">${escapeHtml(sName.slice(0, 4))}: <b>${sScore}</b></span>`;
        }).join('') +
        `</div>`;
    }

    return `
      <div class="lb-row ${isMe ? 'my-row' : ''}">
        <div class="lb-left">
          <div class="rank-medal ${medalClass}">${medalContent}</div>
          <div class="lb-info">
            <div class="lb-name">
              ${escapeHtml(r.student_name || r.username || 'Student')}
              ${isMe ? '<span style="font-size:11px; background:var(--accent); color:#fff; padding:2px 6px; border-radius:4px; margin-left:6px;">YOU</span>' : ''}
            </div>
            <div class="lb-user">Username: ${escapeHtml(r.username || '-')} ${r.exam_date ? '· ' + escapeHtml(formatDateLabel(r.exam_date)) : ''}</div>
            ${subjectTagsHtml}
          </div>
        </div>

        <div class="lb-right">
          <div>
            <div class="score-badge">${scoreStr}</div>
            ${percentStr ? `<div style="font-size:11px; color:var(--text3); margin-top:2px;">${percentStr}</div>` : ''}
          </div>
          <div>
            ${percentileStr}
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// Filter Candidates
function filterCandidateList() {
  const q = (document.getElementById('candidate-filter')?.value || '').toLowerCase().trim();
  const filtered = currentLeaderboardRows.filter(r => {
    if (!q) return true;
    const name = String(r.student_name || '').toLowerCase();
    const user = String(r.username || '').toLowerCase();
    const rank = String(r.rank || '');
    return name.includes(q) || user.includes(q) || rank === q;
  });
  renderLeaderboardRows(filtered);
}

// Global exports
window.handleLookupSubmit = handleLookupSubmit;
window.lookupTestId = lookupTestId;
window.filterCandidateList = filterCandidateList;

// Initialization
window.addEventListener('DOMContentLoaded', () => {
  applyUserTheme();
  initSupabase();
  renderRecentChips();

  // Check URL parameters for direct test ID lookup (e.g. ?id=104235)
  const urlParams = new URLSearchParams(window.location.search);
  const idParam = urlParams.get('id');
  if (idParam) {
    lookupTestId(idParam);
  }
});
