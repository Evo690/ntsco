/**
 * Master Exam Schedule - Portal Functions
 * ONLINE ONLY master exam schedule repository connecting directly to Supabase `test_schedules`.
 * Designed for Power-Users & Debugging (distinct from standard daily student exam calendar).
 */

const CHEM_SUPABASE_URL = "https://rhsrrljgejgyqnndcdia.supabase.co";
const CHEM_SUPABASE_KEY = "sb_publishable_vGRx87SiIMaJXeGnrMVN9g_bLPu899U";
const CLOUDFLARE_PROXY = 'https://frosty-frog-31f9.evodev.workers.dev/';

function getAuthToken() {
  return (
    sessionStorage.getItem('fy_token') ||
    localStorage.getItem('fy_token') ||
    (window.opener && window.opener.sessionStorage ? window.opener.sessionStorage.getItem('fy_token') : '') ||
    (window.opener && window.opener.localStorage ? window.opener.localStorage.getItem('fy_token') : '') ||
    ''
  );
}

function getAcademicYear() {
  const y = (
    sessionStorage.getItem('fy_academic_year') ||
    localStorage.getItem('fy_academic_year') ||
    (window.opener && window.opener.sessionStorage ? window.opener.sessionStorage.getItem('fy_academic_year') : '') ||
    (window.opener && window.opener.localStorage ? window.opener.localStorage.getItem('fy_academic_year') : '')
  );
  return Number(y) || new Date().getFullYear();
}

const API_CONFIG = {
  get token() { return getAuthToken(); },
  get academicYear() { return getAcademicYear(); }
};

let supabaseClient = null;
let allSchedules = [];
let selectedSchedule = null;
let activeModeFilter = 'all'; // 'all', 'online', or 'offline'

// ==========================================
// Theme and User Helpers
// ==========================================
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

function showToast(message) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => {
    toast.classList.remove('show');
  }, 2200);
}

// ==========================================
// Network & Date Helpers
// ==========================================
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

function parseExamDateTime(val) {
  if (!val) return new Date(NaN);
  if (val instanceof Date) return val;
  const str = String(val).trim();
  const direct = new Date(str);
  if (!Number.isNaN(direct.getTime())) return direct;
  // Support DD-MM-YYYY or DD/MM/YYYY with optional HH:MM(:SS)
  const match = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})(?:[T\s]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (match) {
    const [, d, m, y, hr, min, sec] = match;
    return new Date(Number(y), Number(m) - 1, Number(d), Number(hr || 0), Number(min || 0), Number(sec || 0));
  }
  return new Date(NaN);
}

function formatFullDateTime(val) {
  const dt = parseExamDateTime(val);
  if (Number.isNaN(dt.getTime())) return String(val || 'Date not specified');
  return dt.toLocaleString('en-IN', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
}

function formatDateTimeLabel(val) {
  return formatFullDateTime(val);
}

function formatDateOnly(val) {
  const dt = parseExamDateTime(val);
  if (Number.isNaN(dt.getTime())) return String(val || 'No date');
  return dt.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
}

function getExamRelativeStatus(val) {
  const dt = parseExamDateTime(val);
  if (Number.isNaN(dt.getTime())) return { label: 'Scheduled', isDone: false };
  const now = new Date();
  if (dt.toDateString() === now.toDateString()) {
    return { label: 'Today (Live)', isDone: false, isLive: true };
  }
  if (dt > now) {
    const diffHours = Math.round((dt - now) / (1000 * 60 * 60));
    if (diffHours <= 24) return { label: 'Tomorrow', isDone: false };
    const diffDays = Math.ceil(diffHours / 24);
    return { label: `In ${diffDays}d`, isDone: false };
  }
  return { label: 'Done', isDone: true };
}

function getScheduleModeLabel(s) {
  if (s.isOffline === false || s.isOffline === 'false' || s.isOffline === 0) return 'Online';
  if (s.isOffline === true || s.isOffline === 'true' || s.isOffline === 1) return 'Offline';
  const mode = s.mode || s.testMode || s.examMode || s.examType || s.testType || '';
  if (mode) return String(mode).trim();
  return 'Offline';
}

function isOnlineSchedule(s) {
  if (!s) return false;
  if (s.isOffline === false || s.isOffline === 'false' || s.isOffline === 0) return true;
  const mode = String(s.mode || s.testMode || s.examMode || '').toLowerCase();
  return mode.includes('online') || mode.includes('cbt');
}

function isUpcomingExam(dateTimeStr) {
  const dt = parseExamDateTime(dateTimeStr);
  if (Number.isNaN(dt.getTime())) return true;
  return dt >= new Date();
}

// ==========================================
// Deduplication & In-Place Update Logic
// ==========================================

function normalizeExamName(raw) {
  if (!raw) return '';
  return String(raw)
    .toLowerCase()
    .replace(/<[^>]*>/g, ' ')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

function extractScheduleDateKey(t) {
  if (!t) return '';
  const d = t.examDate || t.dateTime || t.testDate || t.startDate || t.date || '';
  if (d) {
    const dt = parseExamDateTime(d);
    if (!Number.isNaN(dt.getTime())) {
      const yr = dt.getFullYear();
      const mo = String(dt.getMonth() + 1).padStart(2, '0');
      const da = String(dt.getDate()).padStart(2, '0');
      return `${yr}-${mo}-${da}`;
    }
  }
  const text = String(t.syllabus || '') + ' ' + String(t.name || t.testName || t.examName || '');
  const matchD = text.match(/(\d{1,2})[\s\-_/]+(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[\s\-_/]+(\d{2,4})/i);
  if (matchD) {
    const [, day, monStr, rawYr] = matchD;
    const months = { jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06', jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12' };
    const mo = months[monStr.slice(0, 3).toLowerCase()] || '01';
    const yr = rawYr.length === 2 ? `20${rawYr}` : rawYr;
    return `${yr}-${mo}-${String(day).padStart(2, '0')}`;
  }
  const matchNum = text.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/);
  if (matchNum) {
    const [, day, mon, rawYr] = matchNum;
    const yr = rawYr.length === 2 ? `20${rawYr}` : rawYr;
    return `${yr}-${String(mon).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }
  return '';
}

function getInternalScheduleId(t) {
  if (!t) return 0;
  if (typeof t.id === 'number' && t.id >= 100000000 && t._isInternal) {
    return t.id;
  }

  const nameKey = normalizeExamName(t.name || t.testName || t.examName || '');
  const dateKey = extractScheduleDateKey(t);
  const yearKey = String(t.academicYear || API_CONFIG.academicYear || '').trim();

  // Signature uniquely identifying this exam event across all student accounts & batches
  const signature = `${yearKey}|${nameKey}|${dateKey}`;

  // 32-bit FNV-1a hash
  let hash = 2166136261;
  for (let i = 0; i < signature.length; i++) {
    hash ^= signature.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const internalId = 100000000 + (Math.abs(hash >>> 0) % 899999999);
  return internalId;
}

const getScheduleId = getInternalScheduleId;
const getStableScheduleId = getInternalScheduleId;

function syllabusToCleanLines(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw.map(x => String(x || '').trim()).filter(Boolean);
  }
  const str = String(raw);
  const withoutTags = str
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");

  return withoutTags
    .split(/\r?\n/)
    .map(l => l.replace(/\s+/g, ' ').trim())
    .filter(l => l && !/^SYLLABUS$/i.test(l));
}

function parseSyllabusSubjects(syllabusText, syllabusLines = []) {
  const lines = (Array.isArray(syllabusLines) && syllabusLines.length) ? syllabusLines : syllabusToCleanLines(syllabusText);
  const subjects = {
    Maths: [],
    Physics: [],
    Chemistry: [],
    Biology: [],
    General: []
  };

  let currentSubject = 'General';

  lines.forEach(line => {
    const upper = line.toUpperCase();
    if (upper.startsWith('MATH') || upper.includes('MATHEMATICS:')) {
      currentSubject = 'Maths';
      const clean = line.replace(/^MATH[A-Z]*\s*:\s*/i, '').trim();
      if (clean) subjects.Maths.push(clean);
    } else if (upper.startsWith('PHYSIC') || upper.includes('PHYSICS:')) {
      currentSubject = 'Physics';
      const clean = line.replace(/^PHYSICS?\s*:\s*/i, '').trim();
      if (clean) subjects.Physics.push(clean);
    } else if (upper.startsWith('CHEM') || upper.includes('CHEMISTRY:')) {
      currentSubject = 'Chemistry';
      const clean = line.replace(/^CHEMISTRY?\s*:\s*/i, '').trim();
      if (clean) subjects.Chemistry.push(clean);
    } else if (upper.startsWith('BIO') || upper.includes('BIOLOGY:') || upper.includes('BOTANY:') || upper.includes('ZOOLOGY:')) {
      currentSubject = 'Biology';
      const clean = line.replace(/^(BIOLOGY|BOTANY|ZOOLOGY)\s*:\s*/i, '').trim();
      if (clean) subjects.Biology.push(clean);
    } else {
      subjects[currentSubject].push(line);
    }
  });

  return subjects;
}

function mergeCoursesString(oldCourses, newCourses) {
  if (!oldCourses && !newCourses) return '';
  if (!oldCourses) return String(newCourses).trim();
  if (!newCourses) return String(oldCourses).trim();

  const tokens = [];
  const seen = new Set();

  const addToken = str => {
    if (!str) return;
    String(str)
      .split(/[,;|•·\n]+/)
      .map(s => s.trim())
      .filter(Boolean)
      .forEach(t => {
        const lower = t.toLowerCase();
        if (!seen.has(lower)) {
          seen.add(lower);
          tokens.push(t);
        }
      });
  };

  addToken(oldCourses);
  addToken(newCourses);
  return tokens.join(', ');
}

function pickRicherSyllabus(oldSyllabus, newSyllabus) {
  const o = String(oldSyllabus || '').trim();
  const n = String(newSyllabus || '').trim();
  if (!o) return n;
  if (!n) return o;
  return n.length >= o.length ? n : o;
}

function pickBetterVenue(oldVenue, newVenue) {
  const o = String(oldVenue || '').trim();
  const n = String(newVenue || '').trim();
  if (!o) return n || 'Campus Examination Hall';
  if (!n) return o;
  const isGeneric = s => /^(campus examination hall|examination hall|campus|exam hall)$/i.test(s);
  if (isGeneric(n) && !isGeneric(o)) return o;
  return n;
}

function mergeSchedulesInPlace(currentList, incomingList) {
  const mapById = new Map();
  const mapByName = new Map();

  (currentList || []).forEach(item => {
    if (!item) return;
    const id = Number(item.id);
    if (id > 0) mapById.set(id, item);
    const cleanName = String(item.name || item.testName || '').trim().toLowerCase();
    if (cleanName) mapByName.set(cleanName, item);
  });

  (incomingList || []).forEach(incoming => {
    if (!incoming) return;
    const name = String(incoming.name || incoming.testName || incoming.examName || 'Exam').trim();
    if (!name) return;
    const cleanName = name.toLowerCase();

    const scheduleId = getScheduleId(incoming);
    const dateTime = incoming.dateTime || incoming.examDate || incoming.testDateTime || incoming.exam_date || incoming.date || null;
    const venue = incoming.venue ? String(incoming.venue).trim() : '';
    const courses = incoming.courses ? String(incoming.courses).trim() : (incoming.batchName || incoming.courseName || '');
    const mode = getScheduleModeLabel(incoming);
    const academicYear = incoming.academic_year || incoming.academicYear || API_CONFIG.academicYear;
    const duration = incoming.duration || incoming.durationMinutes ? `${incoming.duration || incoming.durationMinutes} mins` : '3 Hours (180 mins)';
    const lines = incoming.syllabusLines && incoming.syllabusLines.length ? incoming.syllabusLines : syllabusToCleanLines(incoming.syllabus);

    const existing = mapById.get(scheduleId) || mapByName.get(cleanName);

    if (existing) {
      existing.id = scheduleId;
      existing.name = name || existing.name;
      if (dateTime) existing.dateTime = dateTime;
      existing.venue = pickBetterVenue(existing.venue, venue);
      existing.courses = mergeCoursesString(existing.courses, courses);
      if (mode) existing.mode = mode;
      if (academicYear) existing.academicYear = Number(academicYear);
      if (duration) existing.duration = duration;
      const mergedSyllabus = pickRicherSyllabus(existing.syllabus, incoming.syllabus);
      existing.syllabus = mergedSyllabus;
      existing.syllabusLines = lines && lines.length ? lines : syllabusToCleanLines(mergedSyllabus);
      existing.updated_at = new Date().toISOString();
      mapById.set(scheduleId, existing);
      mapByName.set(cleanName, existing);
    } else {
      const newRecord = {
        id: scheduleId,
        name: name,
        dateTime: dateTime,
        venue: venue || 'Campus Examination Hall',
        courses: courses || 'Target Batch 2026-27',
        mode: mode,
        academicYear: Number(academicYear),
        duration: duration,
        syllabus: incoming.syllabus || lines.join('\n'),
        syllabusLines: lines,
        created_at: incoming.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      mapById.set(scheduleId, newRecord);
      mapByName.set(cleanName, newRecord);
    }
  });

  const merged = Array.from(mapById.values());
  return merged.sort((a, b) => {
    const da = parseExamDateTime(a.dateTime).getTime() || 0;
    const db = parseExamDateTime(b.dateTime).getTime() || 0;
    return db - da;
  });
}

// ==========================================
// Direct Online Supabase Syncing
// ==========================================
function initSupabase() {
  if (window.supabase) {
    supabaseClient = window.supabase.createClient(CHEM_SUPABASE_URL, CHEM_SUPABASE_KEY);
  }
}

async function loadMasterSchedulesFromSupabase() {
  if (!supabaseClient) return [];
  try {
    const { data, error } = await supabaseClient
      .from('test_schedules')
      .select('*')
      .order('exam_date', { ascending: false, nullsFirst: false });

    if (!error && Array.isArray(data) && data.length) {
      return data
        .filter(d => d && d.name && !(d.name.toLowerCase() === 'exam' && !d.syllabus && !d.exam_date))
        .map(d => ({
          id: Number(d.id),
          name: d.name || 'Exam',
          mode: d.mode || 'Offline',
          isOffline: d.mode ? d.mode.toLowerCase().includes('off') : true,
          venue: d.venue || 'Campus Examination Hall',
          courses: d.courses || 'Target Batches & Enrolled Students',
          duration: d.duration || '3 Hours (180 mins)',
          syllabus: d.syllabus || '',
          syllabusLines: syllabusToCleanLines(d.syllabus),
          academicYear: Number(d.academic_year) || API_CONFIG.academicYear,
          dateTime: d.exam_date || null,
          created_at: d.created_at,
          updated_at: d.updated_at,
          raw: d
        }));
    }
  } catch (e) {
    console.warn('Supabase test_schedules online load notice:', e);
  }
  return [];
}

async function syncSchedulesToSupabase(schedules) {
  if (!supabaseClient || !Array.isArray(schedules) || !schedules.length) return false;

  const rawPayload = schedules.map(s => {
    const sId = getInternalScheduleId(s);
    const sName = String(s.name || s.testName || s.examName || 'Exam').trim();
    const dateKey = extractScheduleDateKey(s);
    const examDate = s.dateTime || s.examDate || s.exam_date || s.testDate || s.startDate || (dateKey ? `${dateKey}T09:00:00` : null);
    const mode = s.mode || getScheduleModeLabel(s);
    const year = s.academicYear || s.academic_year || API_CONFIG.academicYear;
    const venue = s.venue ? String(s.venue).trim() : null;
    const courses = s.courses ? String(s.courses).trim() : (s.batchName || s.courseName || null);
    const duration = s.duration ? String(s.duration) : (s.durationMinutes ? `${s.durationMinutes} mins` : null);
    const syllabus = s.syllabus || (Array.isArray(s.syllabusLines) ? s.syllabusLines.join('\n') : null);

    // Skip empty dummy "Exam" rows
    if (sName.toLowerCase() === 'exam' && !syllabus && !examDate) return null;

    return {
      id: sId,
      name: sName,
      exam_date: examDate ? String(examDate) : null,
      venue: venue,
      courses: courses,
      mode: mode,
      duration: duration,
      syllabus: syllabus,
      academic_year: year ? Number(year) : null,
      updated_at: new Date().toISOString()
    };
  }).filter(t => t && t.id && !Number.isNaN(t.id) && t.name);

  if (!rawPayload.length) return false;

  try {
    // 1. Fetch existing rows from Supabase to merge courses & rich syllabus across multiple students/batches
    const ids = rawPayload.map(p => p.id);
    const existingMap = new Map();
    try {
      const { data: existingRows } = await supabaseClient
        .from('test_schedules')
        .select('*')
        .in('id', ids);
      if (Array.isArray(existingRows)) {
        existingRows.forEach(r => existingMap.set(Number(r.id), r));
      }
    } catch (_) {}

    // 2. Merge existing data with incoming data so batches accumulate without duplicate rows
    const finalPayload = rawPayload.map(item => {
      const prev = existingMap.get(item.id);
      if (!prev) return item;
      return {
        ...item,
        name: item.name || prev.name,
        exam_date: item.exam_date || prev.exam_date,
        courses: mergeCoursesString(prev.courses, item.courses),
        syllabus: pickRicherSyllabus(prev.syllabus, item.syllabus),
        venue: pickBetterVenue(prev.venue, item.venue),
        duration: item.duration || prev.duration,
        mode: item.mode || prev.mode,
        academic_year: item.academic_year || prev.academic_year,
        updated_at: new Date().toISOString()
      };
    });

    const { error } = await supabaseClient
      .from('test_schedules')
      .upsert(finalPayload, { onConflict: 'id' });

    if (error) {
      console.warn('Supabase test_schedules table notice:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('Supabase sync exception:', err);
    return false;
  }
}

// ==========================================
// UI Rendering & Controls (Power-User Focused)
// ==========================================

function initYearSelector() {
  const yearSelector = document.getElementById('year-selector');
  if (yearSelector && yearSelector.options.length === 0) {
    yearSelector.add(new Option('All Academic Years', 'all', true, true));
    const currentYear = new Date().getFullYear();
    for (let y = currentYear + 1; y >= currentYear - 3; y--) {
      yearSelector.add(new Option(`Year ${y} - ${y + 1}`, y, false, false));
    }
  }
}

function setModeFilter(mode) {
  activeModeFilter = mode;
  const chipAll = document.getElementById('chip-mode-all');
  const chipOnline = document.getElementById('chip-mode-online');
  const chipOffline = document.getElementById('chip-mode-offline');
  if (chipAll) chipAll.classList.toggle('active', mode === 'all');
  if (chipOnline) chipOnline.classList.toggle('active', mode === 'online');
  if (chipOffline) chipOffline.classList.toggle('active', mode === 'offline');
  filterSchedules();
}

function filterSchedules() {
  const searchInput = document.getElementById('schedule-search');
  const yearSelector = document.getElementById('year-selector');
  const q = searchInput ? searchInput.value.toLowerCase().trim() : '';
  const selectedYear = yearSelector ? yearSelector.value : 'all';

  const filtered = allSchedules.filter(s => {
    // Mode filter: 'all', 'online', or 'offline'
    if (activeModeFilter === 'online' && !isOnlineSchedule(s)) return false;
    if (activeModeFilter === 'offline' && isOnlineSchedule(s)) return false;

    // Academic Year filter
    const sYear = String(s.academicYear || s.academic_year || '');
    if (selectedYear !== 'all' && sYear && sYear !== String(selectedYear)) return false;

    // Power user search: matches Name, ID, PaperID, Venue, Courses, Mode, Syllabus
    if (q) {
      const matchName = String(s.name || '').toLowerCase().includes(q);
      const matchId = String(s.id || '').includes(q);
      const matchPaperId = s.testPaperId && String(s.testPaperId).includes(q);
      const matchVenue = String(s.venue || '').toLowerCase().includes(q);
      const matchCourses = String(s.courses || '').toLowerCase().includes(q);
      const matchMode = String(s.mode || '').toLowerCase().includes(q);
      const matchSyllabus = Array.isArray(s.syllabusLines) && s.syllabusLines.some(l => l.toLowerCase().includes(q));
      if (!matchName && !matchId && !matchPaperId && !matchVenue && !matchCourses && !matchMode && !matchSyllabus) return false;
    }

    return true;
  });

  renderSchedulesList(filtered);
}

function renderSchedulesList(schedules) {
  const listEl = document.getElementById('schedule-list');
  const loadingEl = document.getElementById('schedule-loading');
  const matchingEl = document.getElementById('stat-matching-schedules');
  const totalEl = document.getElementById('stat-total-schedules');
  const upcomingEl = document.getElementById('stat-upcoming-schedules');

  if (loadingEl) loadingEl.style.display = 'none';
  if (matchingEl) matchingEl.textContent = schedules.length;
  if (totalEl) totalEl.textContent = allSchedules.length;
  if (upcomingEl) {
    const upCount = allSchedules.filter(s => isUpcomingExam(s.dateTime)).length;
    upcomingEl.textContent = upCount;
  }

  if (!listEl) return;

  if (schedules.length === 0) {
    listEl.innerHTML = '<div style="text-align: center; color: var(--text3); font-size: 13px; padding: 24px 10px;">No exam schedules found</div>';
    return;
  }

  listEl.innerHTML = schedules.map(s => {
    const isSelected = selectedSchedule && String(selectedSchedule.id) === String(s.id);
    const mode = getScheduleModeLabel(s);
    const isOff = mode.toLowerCase().includes('off');
    const dateFormatted = formatDateOnly(s.dateTime);

    return `
      <div class="sched-item-btn ${isSelected ? 'active' : ''}" id="sched-card-${s.id}" onclick="selectSchedule('${s.id}')">
        <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 8px;">
          <div class="sched-item-name">${escapeHtml(s.name)}</div>
          <span class="mode-pill ${isOff ? 'offline' : 'online'}">${escapeHtml(mode.toUpperCase())}</span>
        </div>
        <div class="sched-item-sub">
          <span>📅 ${escapeHtml(dateFormatted)}</span>
          <span style="font-family:'Space Mono',monospace;">#${s.id}</span>
        </div>
      </div>
    `;
  }).join('');
}

function selectSchedule(schedId) {
  const schedule = allSchedules.find(s => String(s.id) === String(schedId));
  if (!schedule) return;

  selectedSchedule = schedule;

  document.querySelectorAll('.sched-item-btn').forEach(c => c.classList.remove('active'));
  const activeEl = document.getElementById(`sched-card-${schedId}`);
  if (activeEl) activeEl.classList.add('active');

  closeSidebar();

  const placeholder = document.getElementById('schedule-placeholder');
  const detailsView = document.getElementById('schedule-details-view');
  if (placeholder) placeholder.style.display = 'none';
  if (detailsView) detailsView.style.display = 'flex';

  const titleEl = document.getElementById('selected-schedule-title');
  const modeEl = document.getElementById('selected-schedule-mode');
  const statusEl = document.getElementById('selected-schedule-status');
  const dateMetaEl = document.getElementById('selected-schedule-date');
  const idMetaEl = document.getElementById('selected-schedule-id');

  const mode = getScheduleModeLabel(schedule);
  const isOff = mode.toLowerCase().includes('off');
  const relStatus = getExamRelativeStatus(schedule.dateTime);

  if (titleEl) titleEl.textContent = schedule.name;
  if (modeEl) {
    modeEl.className = `mode-pill ${isOff ? 'offline' : 'online'}`;
    modeEl.textContent = mode.toUpperCase();
  }
  if (statusEl) {
    statusEl.className = `mode-pill ${relStatus.isLive ? 'online' : relStatus.isDone ? 'offline' : 'online'}`;
    statusEl.textContent = relStatus.label;
  }
  if (dateMetaEl) {
    dateMetaEl.textContent = formatDateOnly(schedule.dateTime);
  }
  if (idMetaEl) {
    idMetaEl.textContent = `ID: ${schedule.id}`;
  }

  const dateEl = document.getElementById('detail-date');
  const venueEl = document.getElementById('detail-venue');
  const coursesEl = document.getElementById('detail-courses');
  const durationEl = document.getElementById('detail-duration');

  if (dateEl) dateEl.textContent = formatFullDateTime(schedule.dateTime);
  if (venueEl) venueEl.textContent = schedule.venue || 'Campus Examination Hall';
  if (coursesEl) coursesEl.textContent = schedule.courses || 'Target Batches & Enrolled Students';
  if (durationEl) durationEl.textContent = `${schedule.duration || '3 Hours (180 mins)'} · ${mode}`;

  renderSyllabus(schedule);
}

function renderSyllabus(schedule) {
  const container = document.getElementById('syllabus-container');
  if (!container) return;

  const subjects = parseSyllabusSubjects(schedule.syllabus, schedule.syllabusLines);

  const subjectMeta = [
    { key: 'Maths', name: 'Mathematics', icon: '📐' },
    { key: 'Physics', name: 'Physics', icon: '⚡' },
    { key: 'Chemistry', name: 'Chemistry', icon: '🧪' },
    { key: 'Biology', name: 'Biology', icon: '🌿' },
    { key: 'General', name: 'General Topics', icon: '📝' }
  ];

  let hasContent = false;
  let html = '';

  subjectMeta.forEach(sm => {
    const list = subjects[sm.key] || [];
    if (list.length > 0) {
      hasContent = true;
      html += `
        <div style="background: var(--bg2); border: 1px solid var(--border); border-radius: 8px; padding: 12px 14px;">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 13px;">${sm.icon}</span>
              <span style="font-size: 13px; font-weight: 700; color: var(--text);">${sm.name}</span>
            </div>
            <span style="font-size: 11px; color: var(--text3);">${list.length} topic${list.length > 1 ? 's' : ''}</span>
          </div>
          <ul style="margin: 0; padding-left: 18px; font-size: 12px; color: var(--text2); line-height: 1.6;">
            ${list.map(line => `<li style="margin-bottom: 3px;">${escapeHtml(line)}</li>`).join('')}
          </ul>
        </div>
      `;
    }
  });

  if (!hasContent) {
    html = `
      <div style="background: var(--bg2); border: 1px solid var(--border); border-radius: 8px; padding: 18px; text-align: center; color: var(--text3); font-size: 13px;">
        Standard full course curriculum applies for this examination.
      </div>
    `;
  }

  container.innerHTML = html;
}

// ==========================================
// Actions & Export Helpers
// ==========================================

function copyScheduleText() {
  if (!selectedSchedule) return;
  const s = selectedSchedule;
  const lines = [
    `EXAM SCHEDULE: ${s.name}`,
    `Schedule ID: ${s.id}`,
    `Date & Time: ${formatFullDateTime(s.dateTime)}`,
    `Mode: ${getScheduleModeLabel(s)}`,
    `Venue: ${s.venue || 'Campus Examination Hall'}`,
    `Courses: ${s.courses || 'Target Batches'}`,
    `Duration: ${s.duration || '3 Hours'}`,
    `Academic Year: ${s.academicYear || API_CONFIG.academicYear}`,
    `----------------------------------------`,
    `SYLLABUS:`,
    ...(Array.isArray(s.syllabusLines) && s.syllabusLines.length ? s.syllabusLines : [s.syllabus || 'Full curriculum'])
  ];

  navigator.clipboard.writeText(lines.join('\n')).then(() => {
    showToast('Schedule copied to clipboard');
    const btn = document.getElementById('btn-copy-schedule');
    if (btn) {
      btn.textContent = 'Copied!';
      setTimeout(() => { btn.textContent = 'Copy Schedule'; }, 2000);
    }
  }).catch(() => {
    showToast('Failed to copy');
  });
}

function copySyllabusText() {
  if (!selectedSchedule) return;
  const s = selectedSchedule;
  const lines = Array.isArray(s.syllabusLines) && s.syllabusLines.length ? s.syllabusLines : [s.syllabus || 'Full Syllabus'];
  navigator.clipboard.writeText(lines.join('\n')).then(() => {
    showToast('Syllabus copied to clipboard');
    const btn = document.getElementById('btn-copy-syllabus');
    if (btn) {
      btn.textContent = 'Copied!';
      setTimeout(() => { btn.textContent = 'Copy Syllabus'; }, 2000);
    }
  }).catch(() => {
    showToast('Failed to copy');
  });
}


function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('overlay');
  if (sidebar) sidebar.classList.toggle('open');
  if (overlay) overlay.classList.toggle('open');
}

function closeSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('overlay');
  if (sidebar) sidebar.classList.remove('open');
  if (overlay) overlay.classList.remove('open');
}

// ==========================================
// Master Online Scanner Execution
// ==========================================

async function fetchCalendarFromApi(token) {
  if (!token) return [];
  try {
    const res = await loginProxyFetch('https://ntsc.narayanatalent.com/exam-service/api/ExamCalendar/GetStudentCalendar', {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({ pageNumber: 1, pageSize: 100, academicYear: API_CONFIG.academicYear })
    });
    if (!res.ok) return [];
    const json = await res.json();
    return Array.isArray(json?.data?.data) ? json.data.data : [];
  } catch (e) {
    console.warn('Calendar API warning:', e);
    return [];
  }
}

async function runCalendarScanner() {
  const pill = document.getElementById('sync-pill');
  if (pill) pill.textContent = 'Syncing...';

  try {
    let calendarEntries = [];
    if (API_CONFIG.token) {
      calendarEntries = await fetchCalendarFromApi(API_CONFIG.token);
    }

    if (window.opener && window.opener.APP_STATE && !calendarEntries.length) {
      if (Array.isArray(window.opener.APP_STATE.calendarEntries)) {
        calendarEntries = window.opener.APP_STATE.calendarEntries;
      }
    }

    // 1. Upload online to Supabase test_schedules
    if (calendarEntries.length) {
      await syncSchedulesToSupabase(calendarEntries);
    }

    // 2. Fetch master online records directly from Supabase
    const masterDbEntries = await loadMasterSchedulesFromSupabase();
    if (masterDbEntries.length) {
      allSchedules = masterDbEntries;
    } else if (calendarEntries.length) {
      allSchedules = mergeSchedulesInPlace(allSchedules, calendarEntries);
    }

    filterSchedules();
    if (pill) pill.textContent = `Online DB (${allSchedules.length})`;
    if (!selectedSchedule && allSchedules.length > 0) {
      selectSchedule(allSchedules[0].id);
    }
  } catch (err) {
    console.warn('Master online scanner warning:', err);
    if (pill) pill.textContent = allSchedules.length ? `Online DB (${allSchedules.length})` : 'Online Only';
  }
}

// ==========================================
// App Initialization (ONLINE ONLY)
// ==========================================

async function initTestScheduleApp() {
  applyUserTheme();
  initSupabase();
  initYearSelector();

  const pill = document.getElementById('sync-pill');
  const loadingEl = document.getElementById('schedule-loading');
  const listEl = document.getElementById('schedule-list');

  if (loadingEl) loadingEl.style.display = 'block';
  if (pill) pill.textContent = 'Connecting...';

  // 1. Immediate launch capture: Check opener for live calendar data and sync
  if (window.opener && window.opener.APP_STATE && Array.isArray(window.opener.APP_STATE.calendarEntries) && window.opener.APP_STATE.calendarEntries.length) {
    syncSchedulesToSupabase(window.opener.APP_STATE.calendarEntries);
  }

  // 2. ONLINE ONLY: Load directly from Supabase master database
  if (supabaseClient) {
    try {
      const masterDbEntries = await loadMasterSchedulesFromSupabase();
      if (masterDbEntries && masterDbEntries.length) {
        allSchedules = masterDbEntries;
        if (loadingEl) loadingEl.style.display = 'none';
        if (pill) pill.textContent = `Online DB (${allSchedules.length})`;
        filterSchedules();
        if (allSchedules.length > 0) {
          selectSchedule(allSchedules[0].id);
        }
      } else {
        // Table currently empty
        if (loadingEl) loadingEl.style.display = 'none';
        if (pill) pill.textContent = 'Online Only (0)';
        filterSchedules();
      }
    } catch (err) {
      console.warn('Online DB load error:', err);
      if (loadingEl) loadingEl.style.display = 'none';
      if (pill) pill.textContent = 'Offline';
      if (listEl) {
        listEl.innerHTML = '<div style="text-align: center; color: var(--text3); font-size: 13px; padding: 24px 10px; line-height: 1.5;">🌐 <strong>Online Only</strong><br>Internet connection required to load master exam schedules.</div>';
      }
    }
  } else {
    if (loadingEl) loadingEl.style.display = 'none';
    if (pill) pill.textContent = 'Offline';
  }

  // 3. Live online scanner: If active token, fetch from API & contribute to online DB
  if (API_CONFIG.token) {
    setTimeout(runCalendarScanner, 200);
  }
}

async function clearTestSchedulesTable() {
  if (!supabaseClient) {
    console.error('Supabase client not initialized');
    return false;
  }
  try {
    const { data: rows, error: selectErr } = await supabaseClient.from('test_schedules').select('id');
    if (selectErr) {
      console.error('Error reading test_schedules:', selectErr.message);
      return false;
    }
    if (!rows || !rows.length) {
      showToast('test_schedules is already empty');
      return true;
    }
    const ids = rows.map(r => r.id);
    const { error: delErr } = await supabaseClient.from('test_schedules').delete().in('id', ids);
    if (delErr) {
      showToast('Clear error: ' + delErr.message);
      return false;
    }
    showToast(`Cleared ${ids.length} rows from test_schedules`);
    allSchedules = [];
    filterSchedules();
    return true;
  } catch (e) {
    showToast('Exception: ' + (e.message || e));
    return false;
  }
}

window.selectSchedule = selectSchedule;
window.setModeFilter = setModeFilter;
window.filterSchedules = filterSchedules;
window.copyScheduleText = copyScheduleText;
window.copySyllabusText = copySyllabusText;
window.toggleSidebar = toggleSidebar;
window.closeSidebar = closeSidebar;
window.clearTestSchedulesTable = clearTestSchedulesTable;
window.getInternalScheduleId = getInternalScheduleId;

window.addEventListener('DOMContentLoaded', initTestScheduleApp);
