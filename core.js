const pages = {
  dashboard: 'Dashboard', courses: 'My Courses', messages: 'Messages',
  timetable: 'Time Table', examhall: 'Examination Hall', era: 'ERA Forced Results', examcal: 'Exam Calendar',
  neural: 'Neural Network',
  notices: 'Notice Board', study: 'Study Content', practice: 'Practice', settings: 'Settings', 'result-detail': 'Result Detail', leaderboard: 'Leaderboard',
  solutions: 'Solutions'
};

const API_CONFIG = {
  token: sessionStorage.getItem('fy_token') || localStorage.getItem('fy_token') || '',
  classId: Number(sessionStorage.getItem('fy_class_id') || localStorage.getItem('fy_class_id')) || null,
  academicYear: Number(sessionStorage.getItem('fy_academic_year') || localStorage.getItem('fy_academic_year') || new Date().getFullYear())
};

// Mirror persistent values into sessionStorage if tab session was just opened
try {
  if (!sessionStorage.getItem('fy_token') && API_CONFIG.token) {
    sessionStorage.setItem('fy_token', API_CONFIG.token);
  }
  if (!sessionStorage.getItem('fy_academic_year') && API_CONFIG.academicYear) {
    sessionStorage.setItem('fy_academic_year', String(API_CONFIG.academicYear));
  }
  if (!sessionStorage.getItem('fy_class_id') && API_CONFIG.classId) {
    sessionStorage.setItem('fy_class_id', String(API_CONFIG.classId));
  }
  const savedUser = localStorage.getItem('fy_logged_in_user');
  if (!sessionStorage.getItem('fy_logged_in_user') && savedUser) {
    sessionStorage.setItem('fy_logged_in_user', savedUser);
  }
  const savedName = localStorage.getItem('fy_user_name');
  if (!sessionStorage.getItem('fy_user_name') && savedName) {
    sessionStorage.setItem('fy_user_name', savedName);
  }
  const savedImg = localStorage.getItem('fy_user_img');
  if (!sessionStorage.getItem('fy_user_img') && savedImg) {
    sessionStorage.setItem('fy_user_img', savedImg);
  }
} catch (_) {}


const API_ENDPOINTS = {
  login: 'https://ntsc.narayanatalent.com/login-service/api/login',
  studentBatch: year => `https://ntsc.narayanatalent.com/student-service/api/EnrolledCourse/GetStudentBatch?academicYear=${year}`,
  timetable: id => `https://ntsc.narayanatalent.com/classes-service/api/LiveClass/GetStudentClasses/${id}`,
  tests: 'https://ntsc.narayanatalent.com/exam-service/api/ExaminationHall/GetTests',
  attendance: 'https://ntsc.narayanatalent.com/classes-service/api/Attendance/GetStudentAttendance',
  appearedResult: 'https://ntsc.narayanatalent.com/exam-service/api/ExaminationHall/GetAppearedResult',
  resultAnalysis: id => `https://ntsc.narayanatalent.com/exam-service/api/ExaminationHall/GetResultAnalysis/${id}`,
  leaderboardScore: 'https://ntsc.narayanatalent.com/exam-service/api/ExaminationHall/GetLeaderboardScore',
  calendar: 'https://ntsc.narayanatalent.com/exam-service/api/ExamCalendar/GetStudentCalendar',
  courses: 'https://ntsc.narayanatalent.com/course-service/api/MyLibrary/GetMyCourses',
  courseDetail: id => `https://ntsc.narayanatalent.com/course-service/api/Course/CourseDetail/${id}`,
  messageGroups: 'https://ntsc.narayanatalent.com/general-service/api/MessageGroup/GetStudentGroup',
  messages: 'https://ntsc.narayanatalent.com/general-service/api/Message/GetStudentMessage',
  notices: 'https://ntsc.narayanatalent.com/general-service/api/NoticeBoard/GetStudentNotice',
  noticeFile: id => `https://ntsc.narayanatalent.com/general-service/api/NoticeBoard/GetFileUrl/${id}`,
  studyContent: 'https://ntsc.narayanatalent.com/classes-service/api/StudyContent/GetStudentContent',
  studyFile: id => `https://ntsc.narayanatalent.com/classes-service/api/StudyContent/GetFileUrl/${id}`,
  recordingUrl: id => `https://ntsc.narayanatalent.com/classes-service/api/LiveClass/GetRecordingUrl/${id}`
};

const CLOUDFLARE_PROXY = 'https://frosty-frog-31f9.evodev.workers.dev/';
const LOGIN_WORKER_KEY = 'ntsc-123';
const LOGIN_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
  MIIBCgKCAQEA1PKx1sQNhJVUgha5WOGdiRC0i0Td71UEK9enVf71Tw+79R7mdkEWtE4Ybrsr8yiYi0ETB14RjruFwiLk82wcfbcg4gxHDLxaJoEjjNh1YtMsphOaSte+vNpFrVmpqG6/dvxUAgCdK1kQAM530SC+Dui/tjPr8hUoTPgRkQwVZW/ODf7+1+AT9dJjuJSINmC7Llf5ggAQMmxf24wt2S1L9IGBFTJjIdMGFcfNc2eZQMCmbnZsmNdyv/UubCucusesWIhXnqUXfGbwaxFg0cbiqfyiISuE8yywmkPMYEI96pWRuqCBrgympGMC0CNUK2OoJWG/BeFRJ+hccY5Lp6/+6QIDAQAB
  -----END PUBLIC KEY-----`;

const APP_STATE = {
  tests: [],
  eraTests: [],
  resultCache: {},
  calendarEntries: [],
  timetable: [],
  courses: [],
  messageGroups: [],
  notices: [],
  studyContent: [],
  studyTotal: 0,
  studyPage: 1,
  examPage: 1,
  examTotal: 0,
  eraPage: 1,
  eraTotal: 0,
  testPageSize: 10,
  currentResult: null,
  lastResultSource: 'examhall',
  globalSearch: '',
  activeSubTabs: {},
  lastSyncAt: 0,
  isRefreshing: false,
  themePreset: 'default',
  dashboardForcedStats: null,
  loadedSections: {
    dashboard: false,
    courses: false,
    messages: false,
    notices: false,
    study: false
  }
};

let currentGroupId = null;

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

function escapeHtml(v) {
  return String(v ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}

function formatMessageText(text) {
  let escaped = escapeHtml(text);
  return escaped.replace(/([a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(?:\/[a-zA-Z0-9.,_@%&?=+~/-]*)?)/g, (match) => {
    let clean = match;
    if (clean.endsWith('.')) clean = clean.slice(0, -1);
    if (!clean.includes('.') || clean.length < 5) return match;
    if (!/\.(com|in|net|org|co|edu|gov|io|me)(\/|$)/i.test(clean)) return match;
    let href = clean;
    if (!/^https?:\/\//i.test(href)) href = 'https://' + href;
    return `<a href="${href}" target="_blank" style="color:var(--accent);text-decoration:underline">${clean}</a>`;
  });
}

function decodeHtmlEntities(v) {
  return String(v ?? '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}

function syllabusToLines(html) {
  const text = decodeHtmlEntities(String(html ?? '')
    .replace(/\u200B/g, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]*>/g, ' ')
  );
  return text.split('\n').map(line => line.replace(/\s+/g, ' ').trim()).filter(Boolean);
}

function formatVenueText(venue) {
  const raw = decodeHtmlEntities(String(venue ?? '')).replace(/\u200B/g, ' ').trim();
  if (!raw) return 'N/A';
  return raw.replace(/\s{2,}/g, '\n').split('\n').map(s => s.trim()).filter(Boolean).join('\n');
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

function formatDateLabel(dateStr) {
  const dt = new Date(dateStr);
  if (Number.isNaN(dt.getTime())) return String(dateStr || 'Unknown date');
  return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatDateTimeLabel(dateStr) {
  const dt = parseExamDateTime(dateStr);
  if (Number.isNaN(dt.getTime())) return String(dateStr || 'Unknown time');
  return dt.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });
}

function parseExamDateTime(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return new Date(NaN);
  const direct = new Date(raw);
  if (!Number.isNaN(direct.getTime())) return direct;
  const m = raw.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})\s+(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!m) return new Date(NaN);
  const monMap = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
  let hour = Number(m[4]);
  if (m[6].toUpperCase() === 'PM' && hour !== 12) hour += 12;
  if (m[6].toUpperCase() === 'AM' && hour === 12) hour = 0;
  return new Date(Number(m[3]), monMap[m[2].toLowerCase()], Number(m[1]), hour, Number(m[5]), 0, 0);
}

function formatTimeLabel(raw) {
  const parts = String(raw || '').split(':');
  const h = Number(parts[0]), m = Number(parts[1] || 0);
  if (Number.isNaN(h) || Number.isNaN(m)) return String(raw || '');
  const d = new Date(); d.setHours(h, m, 0, 0);
  return d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true });
}

function timeToMinutes(raw) {
  const parts = String(raw || '').split(':');
  const h = Number(parts[0]), m = Number(parts[1] || 0);
  return (Number.isNaN(h) || Number.isNaN(m)) ? Number.MAX_SAFE_INTEGER : h * 60 + m;
}

function getIstDateKey() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

function getIstHourMinute() {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(new Date());
  return Number(parts.find(p => p.type === 'hour')?.value || 0) * 60 + Number(parts.find(p => p.type === 'minute')?.value || 0);
}

function getSubjectClass(subject) {
  const s = String(subject || '').toLowerCase();
  if (s.includes('phy')) return 'tt-phy';
  if (s.includes('chem')) return 'tt-chem';
  if (s.includes('math')) return 'tt-math';
  return 'tt-phy';
}

/* ── All API Calls ── */
async function fetchTimetable(token, batchId = API_CONFIG.classId) {
  const res = await loginProxyFetch(API_ENDPOINTS.timetable(batchId), { headers: authHeaders(token) });
  if (!res.ok) {
    const err = new Error(`Timetable API failed (HTTP ${res.status})`);
    err.status = res.status;
    if (res.status === 401 || res.status === 403) err.isAuthError = true;
    throw err;
  }
  const json = await res.json();
  return Array.isArray(json?.data) ? json.data : [];
}

async function fetchTestsPage(token, pageNumber = 1, pageSize = APP_STATE.testPageSize) {
  const res = await loginProxyFetch(API_ENDPOINTS.tests, {
    method: 'POST', headers: authHeaders(token),
    body: JSON.stringify({ searchKey: '', pageNumber, pageSize, id: 0, academicYear: String(API_CONFIG.academicYear) })
  });
  if (!res.ok) {
    const err = new Error(`Exam hall API failed (HTTP ${res.status})`);
    err.status = res.status;
    if (res.status === 401 || res.status === 403) err.isAuthError = true;
    throw err;
  }
  const json = await res.json();
  return {
    tests: Array.isArray(json?.data?.result) ? json.data.result : [],
    total: Number(json?.data?.totalRecord ?? 0)
  };
}

async function fetchTests(token) {
  const result = await fetchTestsPage(token, 1, 20);
  return result.tests;
}

async function fetchAppearedResult(token, testId) {
  const res = await loginProxyFetch(API_ENDPOINTS.appearedResult, {
    method: 'POST', headers: authHeaders(token), body: JSON.stringify({ id: testId, pageNumber: 1, pageSize: 10 })
  });
  if (!res.ok) return null;
  const json = await res.json();
  return json?.data?.result?.[0] || null;
}

async function fetchResultAnalysis(token, examId) {
  const res = await loginProxyFetch(API_ENDPOINTS.resultAnalysis(examId), { headers: authHeaders(token) });
  if (!res.ok) return null;
  const json = await res.json();
  return json?.data || null;
}

async function fetchLeaderboardScore(token, testPaperId) {
  if (!testPaperId) return null;
  const res = await loginProxyFetch(API_ENDPOINTS.leaderboardScore, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ id: Number(testPaperId) || testPaperId })
  });
  if (!res.ok) return null;
  const json = await res.json();
  return json?.data || null;
}

async function fetchCalendar(token) {
  const res = await loginProxyFetch(API_ENDPOINTS.calendar, {
    method: 'POST', headers: authHeaders(token),
    body: JSON.stringify({ pageNumber: 1, pageSize: 20, academicYear: API_CONFIG.academicYear })
  });
  if (!res.ok) {
    const err = new Error(`Exam calendar API failed (HTTP ${res.status})`);
    err.status = res.status;
    if (res.status === 401 || res.status === 403) err.isAuthError = true;
    throw err;
  }
  const json = await res.json();
  return Array.isArray(json?.data?.data) ? json.data.data : [];
}

function firstArrayValue(...values) {
  return values.find(Array.isArray) || [];
}

async function fetchCourses(token) {
  const res = await loginProxyFetch(API_ENDPOINTS.courses, {
    method: 'POST', headers: authHeaders(token),
    body: JSON.stringify({ searchKey: '', pageNumber: 1, pageSize: 100, academicYear: API_CONFIG.academicYear })
  });
  if (!res.ok) {
    const err = new Error(`Courses API failed (HTTP ${res.status})`);
    err.status = res.status;
    if (res.status === 401 || res.status === 403) err.isAuthError = true;
    throw err;
  }
  const json = await res.json();
  return firstArrayValue(json?.data?.courses, json?.data?.data, json?.data?.result, json?.data, json?.courses, json?.result);
}

async function fetchCourseDetail(token, courseId) {
  const id = Number(courseId);
  if (!id) return null;
  const res = await loginProxyFetch(API_ENDPOINTS.courseDetail(id), {
    method: 'GET',
    headers: authHeaders(token)
  });
  if (!res.ok) return null;
  const json = await res.json();
  return json?.data && typeof json.data === 'object' ? json.data : null;
}

async function fetchMessageGroups(token) {
  try {
    const res = await loginProxyFetch(API_ENDPOINTS.messageGroups, {
      method: 'POST', headers: authHeaders(token),
      body: JSON.stringify({ startDate: "", endDate: "", searchKey: "", pageNumber: 1, pageSize: 250, academicYear: API_CONFIG.academicYear })
    });
    if (!res.ok) return [];
    const json = await res.json();
    return firstArrayValue(json?.data?.data, json?.data?.result, json?.data, json?.result);
  } catch (err) { return []; }
}

async function fetchMessages(token, groupId) {
  try {
    const res = await loginProxyFetch(API_ENDPOINTS.messages, {
      method: 'POST', headers: authHeaders(token),
      body: JSON.stringify({ searchKey: "", pageNumber: 1, pageSize: 200, targetId: groupId, academicYear: API_CONFIG.academicYear })
    });
    if (!res.ok) return [];
    const json = await res.json();
    return firstArrayValue(json?.data?.data, json?.data?.result, json?.data, json?.result);
  } catch (err) { return []; }
}

async function fetchAttendance(token, month, year) {
  try {
    const res = await loginProxyFetch(API_ENDPOINTS.attendance, {
      method: 'POST', headers: authHeaders(token),
      body: JSON.stringify({ batchId: API_CONFIG.classId, year: year, month: month })
    });
    if (!res.ok) return [];
    const json = await res.json();
    return Array.isArray(json?.data) ? json.data : [];
  } catch (err) { return []; }
}

async function fetchNotices(token) {
  try {
    const res = await loginProxyFetch(API_ENDPOINTS.notices, {
      method: 'POST', headers: authHeaders(token),
      body: JSON.stringify({ startDate: "", endDate: "", searchKey: "", pageNumber: 1, pageSize: 20, academicYear: API_CONFIG.academicYear })
    });
    if (!res.ok) return [];
    const json = await res.json();
    return Array.isArray(json?.data?.data) ? json.data.data : [];
  } catch (err) { return []; }
}

async function fetchStudyContent(token, page = 1) {
  try {
    const res = await loginProxyFetch(API_ENDPOINTS.studyContent, {
      method: 'POST', headers: authHeaders(token),
      body: JSON.stringify({ startDate: "", endDate: "", searchKey: "", pageNumber: page, pageSize: 10, academicYear: API_CONFIG.academicYear, subjectId: 0 })
    });
    if (!res.ok) return { data: [], total: 0 };
    const json = await res.json();
    return {
      data: Array.isArray(json?.data?.data) ? json.data.data : [],
      total: json?.data?.totalRecord || 0
    };
  } catch (err) { return { data: [], total: 0 }; }
}

async function fetchStudentBatches(token, academicYear) {
  try {
    const res = await loginProxyFetch(API_ENDPOINTS.studentBatch(academicYear), { headers: authHeaders(token) });
    if (!res.ok) return [];
    const json = await res.json();
    return Array.isArray(json?.data) ? json.data : [];
  } catch (err) { return []; }
}

