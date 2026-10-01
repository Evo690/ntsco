const CLOUDFLARE_PROXY = 'https://frosty-frog-31f9.evodev.workers.dev/';
const LOGIN_WORKER_KEY = 'ntsc-123';

const API_CONFIG = {
  token: sessionStorage.getItem('fy_token') || localStorage.getItem('fy_token') || '',
  academicYear: Number(sessionStorage.getItem('fy_academic_year') || new Date().getFullYear())
};

let currentVideoId = null;
let currentStreamUrl = null;

// --- User Theme & Cookies ---
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

function applyUserTheme() {
  const userId = getCurrentUserId();
  const cleanId = userId ? userId.replace(/[^a-zA-Z0-9_]/g, '_') : '';
  const modeKey = cleanId ? `fy_theme_mode_${cleanId}` : 'fy_theme_mode';
  const presetKey = cleanId ? `fy_theme_preset_${cleanId}` : 'fy_theme_preset';
  const mode = localStorage.getItem(modeKey);
  const preset = localStorage.getItem(presetKey);
  if (mode !== 'dark') {
    document.body.classList.add('light-mode');
  } else {
    document.body.classList.remove('light-mode');
  }
  document.body.classList.remove('theme-ocean', 'theme-purple', 'theme-emerald');
  if (preset && preset !== 'default') {
    document.body.classList.add(`theme-${preset}`);
  }
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

function escapeHtml(v) {
  return String(v ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

// --- History Management in Sidebar ---
function getRecentHistory() {
  try {
    const raw = localStorage.getItem('fy_recent_recordings');
    return raw ? JSON.parse(raw) : [];
  } catch (_) {
    return [];
  }
}

function saveToHistory(id) {
  if (!id) return;
  try {
    const cleanId = String(id).trim();
    let history = getRecentHistory();
    history = [cleanId, ...history.filter(item => String(item) !== cleanId)].slice(0, 15);
    localStorage.setItem('fy_recent_recordings', JSON.stringify(history));
    renderRecentHistory();
  } catch (_) {}
}

function renderRecentHistory() {
  const list = document.getElementById('recent-list');
  if (!list) return;

  const history = getRecentHistory();
  if (!history || history.length === 0) {
    list.innerHTML = '<div style="text-align: center; color: var(--text3); font-size: 13px; padding: 20px 0;">No recordings played yet</div>';
    return;
  }

  list.innerHTML = history.map(id => {
    const isActive = String(id) === String(currentVideoId);
    return `
      <button class="batch-item-btn ${isActive ? 'active' : ''}" onclick="loadVideo('${escapeHtml(id)}')">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div style="font-weight: 600; color: var(--text); font-size: 13px;">#${escapeHtml(id)}</div>
          <span style="font-size: 11px; font-weight: 700; color: var(--accent);">Play ↗</span>
        </div>
        <div style="font-size: 11px; color: var(--text3); margin-top: 3px;">Class Recording</div>
      </button>
    `;
  }).join('');
}

// --- Load Video Handler ---
function loadVideoFromSidebar() {
  const input = document.getElementById('video-search-input');
  if (!input) return;
  const val = input.value.trim();
  if (!val) {
    showToast('Please enter a Video ID');
    return;
  }
  loadVideo(val);
}

async function loadVideo(videoId) {
  const cleanId = String(videoId || '').trim();
  if (!cleanId) return;

  currentVideoId = cleanId;

  // Sidebar item highlight
  renderRecentHistory();

  // Close sidebar on mobile
  if (window.innerWidth <= 768) {
    window.closeSidebar();
  }

  const searchInput = document.getElementById('video-search-input');
  const mainInput = document.getElementById('main-search-input');
  if (searchInput) searchInput.value = cleanId;
  if (mainInput) mainInput.value = cleanId;

  const titleEl = document.getElementById('selected-video-title');
  const metaEl = document.getElementById('video-meta-info');
  const actionsRow = document.getElementById('video-actions-row');
  const placeholder = document.getElementById('video-placeholder');
  const loading = document.getElementById('video-loading');
  const container = document.getElementById('video-container');
  const video = document.getElementById('recording-video');
  const btnNewTab = document.getElementById('btn-new-tab');
  const btnDownload = document.getElementById('btn-download');

  if (titleEl) titleEl.textContent = `Recording: #${cleanId}`;
  if (metaEl) metaEl.textContent = 'Connecting to Narayana stream...';

  if (placeholder) placeholder.style.display = 'none';
  if (container) container.style.display = 'none';
  if (loading) {
    loading.style.display = 'block';
    loading.textContent = `Fetching recording URL for #${cleanId}...`;
  }
  if (actionsRow) actionsRow.style.display = 'none';

  if (video) {
    video.pause();
    video.removeAttribute('src');
    video.load();
  }

  const token = API_CONFIG.token || sessionStorage.getItem('fy_token') || localStorage.getItem('fy_token') || '';
  if (!token) {
    if (loading) loading.style.display = 'none';
    if (placeholder) {
      placeholder.style.display = 'block';
      placeholder.textContent = 'Session token not found. Please log in to the portal first.';
    }
    if (metaEl) metaEl.textContent = 'Authentication required';
    showToast('Please log in to the portal first');
    return;
  }

  try {
    const endpoint = `https://ntsc.narayanatalent.com/classes-service/api/LiveClass/GetRecordingUrl/${encodeURIComponent(cleanId)}`;
    const res = await fetch(CLOUDFLARE_PROXY + '?url=' + encodeURIComponent(endpoint), {
      method: 'GET',
      headers: {
        'x-key': LOGIN_WORKER_KEY,
        Authorization: 'bearer ' + token,
        Accept: 'application/json, text/plain, */*',
        Referer: 'https://ntsc.narayanatalent.com/dashboard?path=Previous%20Classes'
      }
    });

    if (!res.ok) {
      throw new Error(`Server returned HTTP ${res.status}`);
    }

    const json = await res.json();
    let videoUrl = json?.data;
    if (typeof videoUrl === 'object' && videoUrl !== null) {
      videoUrl = videoUrl.url || videoUrl.recordingUrl || videoUrl.data;
    }

    if (!videoUrl || typeof videoUrl !== 'string' || !videoUrl.startsWith('http')) {
      throw new Error(json?.message || 'No recording stream URL was found for this ID.');
    }

    currentStreamUrl = videoUrl;
    saveToHistory(cleanId);

    if (metaEl) metaEl.textContent = 'Streaming via AWS CloudFront';
    if (actionsRow) actionsRow.style.display = 'flex';
    if (btnNewTab) btnNewTab.href = videoUrl;
    if (btnDownload) {
      btnDownload.href = videoUrl;
      btnDownload.setAttribute('download', `Recording_${cleanId}.mp4`);
      btnDownload.onclick = () => {
        showToast('Starting video download...');
      };
    }

    if (loading) loading.style.display = 'none';
    if (container) container.style.display = 'flex';

    if (video) {
      video.src = videoUrl;
      video.load();
      const playPromise = video.play();
      if (playPromise !== undefined) {
        playPromise.catch(e => {
          console.warn('Autoplay prevented:', e);
        });
      }
    }

    showToast(`Streaming #${cleanId}`);
  } catch (err) {
    console.error('Error fetching recording:', err);
    if (loading) loading.style.display = 'none';
    if (placeholder) {
      placeholder.style.display = 'block';
      placeholder.textContent = err.message || 'Unable to load recording. Please verify the Video ID.';
    }
    if (metaEl) metaEl.textContent = 'Stream unavailable';
    showToast('Failed to load recording');
  }
}

function setSpeed(rate, btnEl) {
  const video = document.getElementById('recording-video');
  if (video) {
    video.playbackRate = Number(rate) || 1;
  }
  document.querySelectorAll('#video-actions-row .filter-chip').forEach(el => el.classList.remove('active'));
  if (btnEl) btnEl.classList.add('active');
}

function copyVideoLink() {
  if (!currentStreamUrl) return;
  navigator.clipboard.writeText(currentStreamUrl).then(() => {
    showToast('Stream link copied!');
  }).catch(() => {
    prompt('Video URL:', currentStreamUrl);
  });
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
window.loadVideoFromSidebar = loadVideoFromSidebar;
window.loadVideo = loadVideo;
window.setSpeed = setSpeed;
window.copyVideoLink = copyVideoLink;

// Keyboard shortcuts
document.addEventListener('keydown', e => {
  const isTyping = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName);
  if (isTyping) return;

  const video = document.getElementById('recording-video');
  if (!video || !video.src) return;

  if (e.code === 'Space') {
    e.preventDefault();
    if (video.paused) video.play().catch(() => {});
    else video.pause();
  } else if (e.key === 'ArrowLeft') {
    e.preventDefault();
    video.currentTime = Math.max(0, video.currentTime - 5);
  } else if (e.key === 'ArrowRight') {
    e.preventDefault();
    video.currentTime = Math.min(video.duration || 0, video.currentTime + 5);
  }
});

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  applyUserTheme();
  renderRecentHistory();

  // Check URL params (?id=123498)
  const params = new URLSearchParams(window.location.search);
  const idFromUrl = params.get('id') || params.get('videoId') || params.get('classId');
  if (idFromUrl) {
    loadVideo(idFromUrl);
  }
});
