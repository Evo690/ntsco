function parseJwt(jwtToken) {
  try {
    if (!jwtToken || typeof jwtToken !== 'string') return null;
    const parts = jwtToken.split('.');
    if (parts.length !== 3) return null;
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch (_) {
    return null;
  }
}

function isTokenExpired(jwtToken) {
  if (!jwtToken || typeof jwtToken !== 'string') return true;
  const payload = parseJwt(jwtToken);
  if (!payload) return true;
  if (typeof payload.exp === 'number') {
    // Expired or expiring within 60 seconds (1 minute safety buffer)
    return Date.now() >= (payload.exp - 60) * 1000;
  }
  return false;
}

function isAuthError(err) {
  if (!err) return false;
  if (err.isAuthError) return true;
  if (err.status === 401 || err.status === 403) return true;
  const msg = String(err.message || '').toLowerCase();
  return msg.includes('401') || msg.includes('403') || msg.includes('unauthorized') || msg.includes('token expired') || msg.includes('invalid token');
}

async function verifyServerToken(token) {
  if (!token || typeof token !== 'string') return false;
  try {
    const year = API_CONFIG.academicYear || new Date().getFullYear();
    const res = await loginProxyFetch(API_ENDPOINTS.studentBatch(year), {
      method: 'GET',
      headers: authHeaders(token)
    });
    if (res.status === 401 || res.status === 403) {
      return false;
    }
    if (!res.ok) {
      try {
        const json = await res.json();
        if (json?.statusCode === 401 || json?.statusCode === 403 || /unauthorized|invalid token|token expired/i.test(json?.message || '')) {
          return false;
        }
      } catch (_) {}
      return false;
    }
    const json = await res.json();
    if (json && (json.statusCode === 401 || json.statusCode === 403)) {
      return false;
    }
    if (Array.isArray(json?.data) && json.data.length > 0) {
      APP_STATE.batches = json.data;
    }
    return true;
  } catch (_) {
    return false;
  }
}

function authHeaders(token) {
  return {
    Authorization: 'Bearer ' + token,
    'Content-Type': 'application/json',
    Accept: 'application/json',
    Origin: 'https://ntsc.narayanatalent.com',
    Referer: 'https://ntsc.narayanatalent.com/'
  };
}

function encryptLoginPassword(password) {
  const encryptor = new JSEncrypt();
  encryptor.setPublicKey(LOGIN_PUBLIC_KEY);
  const encrypted = encryptor.encrypt(password);
  if (!encrypted) throw new Error('Password encryption failed. Please try again.');
  return encrypted;
}

async function loginProxyFetch(url, options = {}) {
  return fetch(CLOUDFLARE_PROXY + '?url=' + encodeURIComponent(url), {
    ...options,
    headers: {
      ...(options.headers || {}),
      'x-key': LOGIN_WORKER_KEY
    }
  });
}

function normalizeLoginResponse(json) {
  let payload = json;
  if (typeof payload?.body === 'string') {
    try { payload = JSON.parse(payload.body); } catch (_) { }
  } else if (payload?.body && typeof payload.body === 'object') {
    payload = payload.body;
  }
  const data = payload?.data?.data || payload?.data || payload;
  const token = data?.token || payload?.token;
  return { payload, data, token };
}

