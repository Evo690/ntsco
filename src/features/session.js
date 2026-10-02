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
        submitBtn.textContent = 'Authenticate';
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
      submitBtn.textContent = 'Authenticate';
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
      submitBtn.textContent = 'Authenticate';
      submitBtn.disabled = false;
    }
  }
}

// Start app on load
checkTokenAndLoad();
function toggleSettingsFunctions() {
  // Compatibility name retained; there is only one function directory now.
  nav('tools', document.querySelector('.nav-item[data-route="tools"]'));
  renderSettingsRecentRecordings();
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
  if (!/^\d+$/.test(testId) || Number(testId) <= 0) {
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

