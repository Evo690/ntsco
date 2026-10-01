/* --- COOKIES & AUTH UTILS --- */
function setCookie(name, value, days) {
  let expires = "";
  if (days) {
    const date = new Date();
    date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000);
    expires = "; expires=" + date.toUTCString();
  }
  document.cookie = name + "=" + encodeURIComponent(value || "") + expires + "; path=/";
}
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
function eraseCookie(name) {
  document.cookie = name + '=; Max-Age=-99999999; path=/';
}
async function attemptLogin(user, pass) {
  var _data$studentDetail;
  const encryptedPassword = encryptLoginPassword(pass);
  const res = await loginProxyFetch(API_ENDPOINTS.login, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify({
      userName: user,
      password: encryptedPassword,
      deviceType: "Web",
      browser: "firefox",
      appVersion: "",
      deviceToken: ""
    })
  });
  const json = await res.json();
  const {
    payload,
    data,
    token
  } = normalizeLoginResponse(json);
  if (!res.ok || !token || payload.statusCode && payload.statusCode !== 200) {
    throw new Error(payload.message || (data === null || data === void 0 ? void 0 : data.message) || 'Login failed. Please check your credentials.');
  }
  API_CONFIG.token = token;
  sessionStorage.setItem('fy_token', token);
  localStorage.setItem('fy_token', token);
  if (data.academicYear) {
    API_CONFIG.academicYear = data.academicYear;
    sessionStorage.setItem('fy_academic_year', data.academicYear);
    localStorage.setItem('fy_academic_year', data.academicYear);
  }
  const cId = (_data$studentDetail = data.studentDetail) === null || _data$studentDetail === void 0 ? void 0 : _data$studentDetail.curentClassId;
  if (cId) {
    API_CONFIG.classId = cId;
    sessionStorage.setItem('fy_class_id', cId);
    localStorage.setItem('fy_class_id', cId);
  } else {
    API_CONFIG.classId = null;
    sessionStorage.removeItem('fy_class_id');
    localStorage.removeItem('fy_class_id');
  }
  if (data.studentDetail) {
    sessionStorage.setItem('fy_user_name', data.studentDetail.name || 'Student');
    localStorage.setItem('fy_user_name', data.studentDetail.name || 'Student');
    if (data.studentDetail.profileImage) {
      sessionStorage.setItem('fy_user_img', data.studentDetail.profileImage);
      localStorage.setItem('fy_user_img', data.studentDetail.profileImage);
    }
  }
  sessionStorage.setItem('fy_logged_in_user', user);
  localStorage.setItem('fy_logged_in_user', user);

  // Save credentials for Auto-Relogin (Valid for 30 days)
  setCookie('fy_u', user, 30);
  setCookie('fy_p', pass, 30);
}

/* --- LOGIN HANDLING & APP START --- */
document.getElementById('login-form').addEventListener('submit', async function (e) {
  e.preventDefault();
  const user = document.getElementById('login-user').value.trim();
  const pass = document.getElementById('login-pass').value.trim();
  const errEl = document.getElementById('login-error');
  const btn = document.getElementById('login-submit');
  errEl.textContent = '';
  btn.textContent = 'Logging in...';
  btn.disabled = true;
  try {
    await attemptLogin(user, pass);
    document.getElementById('login-screen').style.display = 'none';
    loadPortalData();
  } catch (err) {
    errEl.textContent = err.message;
  } finally {
    btn.textContent = 'Sign in';
    btn.disabled = false;
  }
});
window.logout = function () {
  sessionStorage.clear();
  localStorage.removeItem('fy_token');
  localStorage.removeItem('fy_class_id');
  localStorage.removeItem('fy_academic_year');
  localStorage.removeItem('fy_user_name');
  localStorage.removeItem('fy_user_img');
  localStorage.removeItem('fy_logged_in_user');
  eraseCookie('fy_u');
  eraseCookie('fy_p');
  location.reload();
};
