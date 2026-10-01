// ==========================================
// WATCH RECORDING FUNCTION & PLAYER MODAL
// ==========================================
let currentPlayingVideoId = null;
let currentPlayingVideoUrl = null;

function getRecordingHistory() {
  try {
    const raw = localStorage.getItem('fy_recent_recordings');
    return raw ? JSON.parse(raw) : [];
  } catch (_) {
    return [];
  }
}

function saveRecordingToHistory(id) {
  if (!id) return;
  try {
    const cleanId = String(id).trim();
    let history = getRecordingHistory();
    history = [cleanId, ...history.filter(item => String(item) !== cleanId)].slice(0, 8);
    localStorage.setItem('fy_recent_recordings', JSON.stringify(history));
    renderSettingsRecentRecordings();
  } catch (_) {}
}

function renderSettingsRecentRecordings() {
  const row = document.getElementById('settings-recent-recordings-row');
  const list = document.getElementById('settings-recent-recordings-list');
  if (!row || !list) return;

  const history = getRecordingHistory();
  if (!history || history.length === 0) {
    row.style.display = 'none';
    return;
  }

  row.style.display = 'flex';
  list.innerHTML = history.map(id => `
    <button class="recent-id-chip" type="button" onclick="startWatchRecording('${escapeHtml(id)}')">
      #${escapeHtml(id)}
    </button>
  `).join('');
}

function submitSettingsWatchRecording() {
  const input = document.getElementById('settings-recording-id-input');
  const statusEl = document.getElementById('settings-recording-status');
  const id = input ? input.value.trim() : '';

  if (!id) {
    if (statusEl) {
      statusEl.style.display = 'block';
      statusEl.style.background = 'rgba(239, 68, 68, 0.15)';
      statusEl.style.color = 'var(--red)';
      statusEl.style.border = '1px solid rgba(239, 68, 68, 0.3)';
      statusEl.textContent = 'Please enter a valid Video / Class ID.';
      setTimeout(() => { statusEl.style.display = 'none'; }, 3000);
    }
    return;
  }

  if (statusEl) statusEl.style.display = 'none';
  startWatchRecording(id);
}

function openWatchRecordingModal(initialId) {
  const modal = document.getElementById('recording-player-modal');
  if (!modal) return;

  modal.style.display = 'flex';
  modal.style.opacity = '0';
  requestAnimationFrame(() => {
    modal.style.opacity = '1';
  });

  const targetId = initialId || (document.getElementById('settings-recording-id-input')?.value || '').trim();
  if (targetId) {
    startWatchRecording(targetId);
  } else {
    const video = document.getElementById('portal-recording-video');
    const spinner = document.getElementById('player-loading-spinner');
    const errState = document.getElementById('player-error-state');
    const idBadge = document.getElementById('player-modal-id-badge');
    const subTitle = document.getElementById('player-modal-subtitle');
    const jumpInput = document.getElementById('player-quick-jump-input');

    if (video) { video.pause(); video.removeAttribute('src'); video.load(); }
    if (spinner) spinner.style.display = 'none';
    if (errState) errState.style.display = 'none';
    if (idBadge) idBadge.textContent = 'Enter ID';
    if (subTitle) subTitle.textContent = 'Enter a Video / Class ID below to start playback';
    if (jumpInput) {
      jumpInput.focus();
    }
  }
}

async function startWatchRecording(videoId) {
  const cleanId = String(videoId || '').trim();
  if (!cleanId) return;

  currentPlayingVideoId = cleanId;
  const modal = document.getElementById('recording-player-modal');
  const video = document.getElementById('portal-recording-video');
  const spinner = document.getElementById('player-loading-spinner');
  const spinnerText = document.getElementById('player-loading-text');
  const errState = document.getElementById('player-error-state');
  const errMsg = document.getElementById('player-error-message');
  const idBadge = document.getElementById('player-modal-id-badge');
  const subTitle = document.getElementById('player-modal-subtitle');
  const copyBtn = document.getElementById('player-modal-copy-btn');
  const newTabBtn = document.getElementById('player-modal-open-tab');
  const downloadBtn = document.getElementById('player-modal-download-btn');
  const settingsInput = document.getElementById('settings-recording-id-input');

  if (settingsInput) settingsInput.value = cleanId;
  if (idBadge) idBadge.textContent = `#${cleanId}`;
  if (subTitle) subTitle.textContent = 'Connecting to Narayana LiveClass stream...';

  if (copyBtn) copyBtn.style.display = 'none';
  if (newTabBtn) newTabBtn.style.display = 'none';
  if (downloadBtn) downloadBtn.style.display = 'none';

  // Open modal if not open
  if (modal && (modal.style.display === 'none' || !modal.style.display)) {
    modal.style.display = 'flex';
    modal.style.opacity = '0';
    requestAnimationFrame(() => { modal.style.opacity = '1'; });
  }

  // Show loading, hide error
  if (spinner) {
    spinner.style.display = 'flex';
    if (spinnerText) spinnerText.textContent = `Fetching recording URL for #${cleanId}...`;
  }
  if (errState) errState.style.display = 'none';
  if (video) {
    video.pause();
    video.removeAttribute('src');
    video.load();
  }

  const token = API_CONFIG.token || sessionStorage.getItem('fy_token') || '';
  if (!token) {
    if (spinner) spinner.style.display = 'none';
    if (errState) {
      errState.style.display = 'flex';
      if (errMsg) errMsg.textContent = 'Authentication token not found. Please log in to the portal first.';
    }
    return;
  }

  try {
    const endpoint = (typeof API_ENDPOINTS !== 'undefined' && API_ENDPOINTS.recordingUrl)
      ? API_ENDPOINTS.recordingUrl(cleanId)
      : `https://ntsc.narayanatalent.com/classes-service/api/LiveClass/GetRecordingUrl/${encodeURIComponent(cleanId)}`;

    const res = await loginProxyFetch(endpoint, {
      method: 'GET',
      headers: authHeaders(token)
    });

    if (!res.ok) {
      throw new Error(`Server returned HTTP ${res.status}: ${res.statusText}`);
    }

    const json = await res.json();
    let videoUrl = json?.data;
    if (typeof videoUrl === 'object' && videoUrl !== null) {
      videoUrl = videoUrl.url || videoUrl.recordingUrl || videoUrl.data;
    }

    if (!videoUrl || typeof videoUrl !== 'string' || !videoUrl.startsWith('http')) {
      throw new Error(json?.message || 'No recording stream URL was found for this Video ID.');
    }

    currentPlayingVideoUrl = videoUrl;
    saveRecordingToHistory(cleanId);

    if (downloadBtn) {
      downloadBtn.href = videoUrl;
      downloadBtn.setAttribute('download', `Recording_${cleanId}.mp4`);
      downloadBtn.style.display = 'inline-flex';
    }
    if (newTabBtn) {
      newTabBtn.href = videoUrl;
      newTabBtn.style.display = 'inline-flex';
    }
    if (copyBtn) {
      copyBtn.style.display = 'inline-flex';
    }

    if (subTitle) {
      subTitle.textContent = 'Streaming via AWS CloudFront CDN';
    }

    if (video) {
      video.src = videoUrl;
      video.load();
      const playPromise = video.play();
      if (playPromise !== undefined) {
        playPromise.catch(e => {
          console.warn('Auto-play was prevented by browser policy:', e);
        });
      }
    }

    if (spinner) spinner.style.display = 'none';
  } catch (err) {
    console.error('Error fetching recording:', err);
    if (spinner) spinner.style.display = 'none';
    if (errState) {
      errState.style.display = 'flex';
      if (errMsg) {
        errMsg.textContent = err.message || 'Failed to load video recording. Please verify the Video ID and try again.';
      }
    }
    if (subTitle) {
      subTitle.textContent = 'Stream unavailable';
    }
  }
}

function retryCurrentRecording() {
  if (currentPlayingVideoId) {
    startWatchRecording(currentPlayingVideoId);
  }
}

function closeRecordingPlayerModal() {
  const modal = document.getElementById('recording-player-modal');
  const video = document.getElementById('portal-recording-video');
  if (video) {
    video.pause();
    video.removeAttribute('src');
    video.load();
  }
  if (modal) {
    modal.style.opacity = '0';
    setTimeout(() => {
      modal.style.display = 'none';
    }, 220);
  }
}

function copyCurrentRecordingUrl() {
  if (!currentPlayingVideoUrl) return;
  const copyBtn = document.getElementById('player-modal-copy-btn');
  navigator.clipboard.writeText(currentPlayingVideoUrl).then(() => {
    if (copyBtn) {
      const orig = copyBtn.innerHTML;
      copyBtn.textContent = 'Copied!';
      setTimeout(() => { copyBtn.innerHTML = orig; }, 2000);
    }
  }).catch(() => {
    prompt('Direct Video URL:', currentPlayingVideoUrl);
  });
}

function setRecordingPlaybackSpeed(speed, btnEl) {
  const video = document.getElementById('portal-recording-video');
  if (video) {
    video.playbackRate = Number(speed) || 1;
  }
  document.querySelectorAll('.player-speed-btn').forEach(btn => btn.classList.remove('active'));
  if (btnEl) btnEl.classList.add('active');
}

function jumpToRecordingFromPlayer() {
  const input = document.getElementById('player-quick-jump-input');
  if (!input) return;
  const id = input.value.trim();
  if (id) {
    input.value = '';
    startWatchRecording(id);
  }
}

function toggleRecordingPiP() {
  const video = document.getElementById('portal-recording-video');
  if (!video) return;
  if (document.pictureInPictureElement) {
    document.exitPictureInPicture().catch(() => {});
  } else if (document.pictureInPictureEnabled && video.requestPictureInPicture) {
    video.requestPictureInPicture().catch(() => {});
  }
}

function toggleRecordingFullscreen() {
  const video = document.getElementById('portal-recording-video');
  if (!video) return;
  if (document.fullscreenElement) {
    document.exitFullscreen().catch(() => {});
  } else if (video.requestFullscreen) {
    video.requestFullscreen().catch(() => {});
  } else if (video.webkitRequestFullscreen) {
    video.webkitRequestFullscreen();
  }
}

// Global modal keyboard controls
document.addEventListener('keydown', e => {
  const modal = document.getElementById('recording-player-modal');
  if (!modal || modal.style.display === 'none') return;

  const isTyping = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName);

  if (e.key === 'Escape') {
    closeRecordingPlayerModal();
    return;
  }

  if (isTyping) return;

  const video = document.getElementById('portal-recording-video');
  if (!video) return;

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
  } else if (e.key === 'f' || e.key === 'F') {
    e.preventDefault();
    toggleRecordingFullscreen();
  }
});

window.openWatchRecordingModal = openWatchRecordingModal;
window.closeRecordingPlayerModal = closeRecordingPlayerModal;
window.startWatchRecording = startWatchRecording;
window.submitSettingsWatchRecording = submitSettingsWatchRecording;
window.retryCurrentRecording = retryCurrentRecording;
window.copyCurrentRecordingUrl = copyCurrentRecordingUrl;
window.setRecordingPlaybackSpeed = setRecordingPlaybackSpeed;
window.jumpToRecordingFromPlayer = jumpToRecordingFromPlayer;
window.toggleRecordingPiP = toggleRecordingPiP;
window.toggleRecordingFullscreen = toggleRecordingFullscreen;
window.renderSettingsRecentRecordings = renderSettingsRecentRecordings;
