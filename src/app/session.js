// Auto Login Boot Check with Server Token Verification
async function checkTokenAndLoad() {
  const u = getCookie('fy_u');
  const p = getCookie('fy_p');

  if (!API_CONFIG.token) {
    API_CONFIG.token = sessionStorage.getItem('fy_token') || localStorage.getItem('fy_token') || '';
  }

  const submitBtn = document.getElementById('login-submit');
  const loginScreen = document.getElementById('login-screen');

  let serverVerified = false;

  // 1. If we have an auth token in storage, verify it directly with the server
  if (API_CONFIG.token) {
    if (submitBtn) {
      submitBtn.textContent = 'Verifying session...';
      submitBtn.disabled = true;
    }
    serverVerified = await verifyServerToken(API_CONFIG.token);
  }

  // 2. If the server rejected the token (or no token existed), and credentials are saved, re-login
  if (!serverVerified && u && p) {
    try {
      if (loginScreen) loginScreen.style.display = 'flex';
      if (submitBtn) {
        submitBtn.textContent = 'Re-authenticating...';
        submitBtn.disabled = true;
      }
      await attemptLogin(u, p);
      serverVerified = true;
    } catch (e) {
      eraseCookie('fy_u');
      eraseCookie('fy_p');
      if (submitBtn) {
        submitBtn.textContent = 'Sign in';
        submitBtn.disabled = false;
      }
      if (loginScreen) loginScreen.style.display = 'flex';
      return; // Stop and force manual login
    }
  }

  // 3. If verified by server, load portal data immediately
  if (serverVerified && API_CONFIG.token) {
    if (!sessionStorage.getItem('fy_logged_in_user')) {
      const savedUser = localStorage.getItem('fy_logged_in_user') || getCookie('fy_u');
      if (savedUser) sessionStorage.setItem('fy_logged_in_user', savedUser);
    }
    if (loginScreen) loginScreen.style.display = 'none';
    if (submitBtn) {
      submitBtn.textContent = 'Sign in';
      submitBtn.disabled = false;
    }
    try {
      await loadPortalData();
    } catch (e) {
      const isAuth = typeof isAuthError === 'function' ? isAuthError(e) : false;
      if (isAuth && u && p) {
        console.warn('Auth token rejected during load. Re-authenticating with server...');
        API_CONFIG.token = '';
        sessionStorage.removeItem('fy_token');
        localStorage.removeItem('fy_token');
        checkTokenAndLoad(); // Retry login once
      } else if (!readPortalCache()) {
        if (loginScreen) loginScreen.style.display = 'flex';
      }
    }
  } else {
    // Stored token was invalid and no credentials to re-login -> Show login screen
    if (loginScreen) loginScreen.style.display = 'flex';
    if (submitBtn) {
      submitBtn.textContent = 'Sign in';
      submitBtn.disabled = false;
    }
  }
}

// Start app on load
checkTokenAndLoad();
window.showPrivacyPolicy = function showPrivacyPolicy(event) {
  if (event) event.preventDefault();
  const dialog = createStudyDialog({id:'privacy-modal-backdrop',titleId:'privacy-dialog-title',title:'Privacy & your data',eyebrow:'ABOUT THIS SPACE',bodyId:'privacy-dialog-body',content:`<div class="privacy-prose">
        <div>
          <strong>We do not collect any data by default.</strong>
          <p>Your usage of the portal is completely local and private, except for the optional features listed below:</p>
        </div>

        <div>
          <strong>1. Chemistry Practice Tool</strong>
          <p>If you use the Chemistry Practice feature, your progress (saved compound lists, compound practice history, and daily stats) is synced to a Supabase database to back up your progress and show your statistics on the chemistry leaderboard, associated only with your username.</p>
        </div>

        <div>
          <strong>2. Anonymized Performance Sharing</strong>
          <p>If you choose to share your performance, this portal scrapes and posts only anonymized exam metrics (scores, test names, percentiles, average marks, and ranks). We do not collect any exam data until you say.</p>
        </div>

        <div>
          <strong>3. Active User Statistics</strong>
          <p>We log your display name/username and a rolling 3-month list of visited months (e.g., "June 2026") in a Supabase table on every login to estimate unique monthly active users (MAU).</p>
        </div>

        <div>
          <strong>We NEVER collect your password, phone number, or any other private credentials.</strong> All authentication happens locally and securely in memory with Narayana servers.
        </div>

        <div>
          <strong>Disclaimer / Affiliation</strong>
          <p>This website is <strong>not associated, affiliated, or officially connected</strong> with NTSC Narayana, Narayana Talent, or any of their subsidiaries or affiliates.</p>
        </div>
      </div>`});
  openStudyDialog(dialog);
};

function toggleSettingsFunctions(btn) {
  const panel = document.getElementById('settings-functions-card');
  const button = btn || document.getElementById('settings-functions-btn');
  panel.hidden = !panel.hidden;
  button.setAttribute('aria-expanded', String(!panel.hidden));
  button.textContent = panel.hidden ? 'Advanced functions' : 'Hide functions';
  if (!panel.hidden) renderSettingsRecentRecordings();
}
window.toggleSettingsFunctions = toggleSettingsFunctions;

function openAttemptTestFeature(testId) {
  if (sessionStorage.getItem('fy_reattempt_unlocked') !== 'true') {
    const pass = prompt('Attempt Test (Reattempt Mode) is currently locked.\nEnter passcode to unlock:');
    if (pass !== 'ntscx') {
      if (pass !== null) alert('Incorrect passcode. Access denied.');
      return;
    }
    sessionStorage.setItem('fy_reattempt_unlocked', 'true');
  }
  const url = testId ? `functions/attempt-test.html?id=${encodeURIComponent(testId)}` : 'functions/attempt-test.html';
  window.open(url, '_blank');
}
window.openAttemptTestFeature = openAttemptTestFeature;

function submitSettingsAttemptTest() {
  const input = document.getElementById('settings-attempt-test-id-input');
  const statusEl = document.getElementById('settings-attempt-test-status');
  if (!input) return;

  const testId = input.value.trim();
  if (!testId || isNaN(testId)) {
    if (statusEl) {
      statusEl.textContent = 'Please enter a valid numeric Test ID.';
      statusEl.style.display = 'block';
      statusEl.style.background = 'rgba(239, 68, 68, 0.15)';
      statusEl.style.color = '#ef4444';
      statusEl.style.border = '1px solid rgba(239, 68, 68, 0.3)';
    }
    return;
  }

  if (statusEl) statusEl.style.display = 'none';
  openAttemptTestFeature(testId);
}
window.submitSettingsAttemptTest = submitSettingsAttemptTest;


function openAdvancedSettings() {
  nav('settings');
  const panel = document.getElementById('settings-functions-card');
  if (panel.hidden) toggleSettingsFunctions();
  panel.scrollIntoView({ block: 'start' });
}

// A single, explicit destination map for the Settings launcher.
const SETTINGS_FUNCTION_ROUTES = Object.freeze({
  'classes': 'functions/classes.html',
  'batch-timetable': 'functions/batch-timetable.html',
  'test-ids': 'functions/test-ids.html',
  'test-schedule': 'functions/test-schedule.html',
  'download-tests': 'functions/download-tests.html',
  'watch-recording': 'functions/watch-recording.html'
});
function openSettingsFunction(id) {
  if (id === 'attempt-test') return openAttemptTestFeature();
  const destination = SETTINGS_FUNCTION_ROUTES[id];
  if (destination) window.open(destination, '_blank');
}
