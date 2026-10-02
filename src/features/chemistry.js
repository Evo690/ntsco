/* --- CHEMISTRY PRACTICE --- */
const CHEM_SUPABASE_URL = "https://rhsrrljgejgyqnndcdia.supabase.co";
const CHEM_SUPABASE_KEY = "sb_publishable_vGRx87SiIMaJXeGnrMVN9g_bLPu899U";
const CHEM_DATA_KEY = 'chem_v5_data';
let chemSupabase = null;
let chemDrawer = null;
let chemAllCompounds = [];
let chemLearnQueue = [];
let chemLearnIdx = 0;
let chemWizardQueue = [];
let chemWizardIdx = 0;
let chemPracticeSessionCount = 0;
let chemPracticeCorrectCount = 0;
let chemLastPracticeName = null;
let chemAppReady = false;
let chemSyncQueue = Promise.resolve();
let chemCombinedData = chemLoadCombinedData();
let chemMyData = chemCombinedData.compounds;
let pkaMyData = chemCombinedData.pka || {
  myList: [],
  stats: {}
};
function chemLoadCombinedData() {
  try {
    const key = getUserStorageKey(CHEM_DATA_KEY);
    let stored = localStorage.getItem(key);

    // Migration: copy old data if user-specific key is not found
    if (!stored && key !== CHEM_DATA_KEY) {
      const legacyStored = localStorage.getItem(CHEM_DATA_KEY);
      if (legacyStored) {
        localStorage.setItem(key, legacyStored);
        stored = legacyStored;
        localStorage.removeItem(CHEM_DATA_KEY);
      }
    }
    if (!stored) {
      return chemMigrateOrGetDefault();
    }
    const data = JSON.parse(stored);
    if (data && data.compounds && data.reagents) {
      if (!data.pka) data.pka = {
        myList: [],
        stats: {}
      };
      return data;
    }
    const migrated = chemMigrateOldData(data);
    if (!migrated.pka) migrated.pka = {
      myList: [],
      stats: {}
    };
    return migrated;
  } catch (_) {
    return chemMigrateOrGetDefault();
  }
}
function chemMigrateOrGetDefault() {
  const defaultChem = {
    myList: [],
    stats: {},
    dailyStats: {}
  };
  const defaultReagents = {
    myList: [],
    stats: {}
  };
  const defaultPka = {
    myList: [],
    stats: {}
  };
  let oldChem = defaultChem;
  let oldReagent = defaultReagents;
  let oldPka = defaultPka;
  try {
    const key = getUserStorageKey(CHEM_DATA_KEY);
    const storedChem = localStorage.getItem(key);
    if (storedChem) {
      const parsed = JSON.parse(storedChem);
      oldChem = parsed || defaultChem;
      oldPka = (parsed === null || parsed === void 0 ? void 0 : parsed.pka) || defaultPka;
    }
  } catch (_) {}
  try {
    const key = getUserStorageKey('reagent_v1_data');
    if (!localStorage.getItem(key)) {
      const legacyReagent = localStorage.getItem('reagent_v1_data');
      if (legacyReagent) {
        localStorage.setItem(key, legacyReagent);
        localStorage.removeItem('reagent_v1_data');
      }
    }
    const storedReagent = localStorage.getItem(key);
    if (storedReagent) oldReagent = JSON.parse(storedReagent) || defaultReagents;
  } catch (_) {}
  return {
    compounds: {
      myList: oldChem && Array.isArray(oldChem.myList) ? oldChem.myList : [],
      stats: oldChem && oldChem.stats ? oldChem.stats : {},
      dailyStats: oldChem && oldChem.dailyStats ? oldChem.dailyStats : {}
    },
    reagents: {
      myList: oldReagent && Array.isArray(oldReagent.myList) ? oldReagent.myList : [],
      stats: oldReagent && oldReagent.stats ? oldReagent.stats : {}
    },
    pka: {
      myList: oldPka && Array.isArray(oldPka.myList) ? oldPka.myList : [],
      stats: oldPka && oldPka.stats ? oldPka.stats : {}
    }
  };
}
function chemMigrateOldData(oldChemData) {
  const defaultReagents = {
    myList: [],
    stats: {}
  };
  const defaultPka = {
    myList: [],
    stats: {}
  };
  let oldReagentData = defaultReagents;
  let oldPkaData = defaultPka;
  try {
    const key = getUserStorageKey('reagent_v1_data');
    if (!localStorage.getItem(key)) {
      const legacyReagent = localStorage.getItem('reagent_v1_data');
      if (legacyReagent) {
        localStorage.setItem(key, legacyReagent);
        localStorage.removeItem('reagent_v1_data');
      }
    }
    const storedReagent = localStorage.getItem(key);
    if (storedReagent) {
      oldReagentData = JSON.parse(storedReagent) || defaultReagents;
    }
  } catch (_) {}
  if (oldChemData && oldChemData.pka) {
    oldPkaData = oldChemData.pka;
  }
  return {
    compounds: {
      myList: oldChemData && Array.isArray(oldChemData.myList) ? oldChemData.myList : [],
      stats: oldChemData && oldChemData.stats ? oldChemData.stats : {},
      dailyStats: oldChemData && oldChemData.dailyStats ? oldChemData.dailyStats : {}
    },
    reagents: {
      myList: oldReagentData && Array.isArray(oldReagentData.myList) ? oldReagentData.myList : [],
      stats: oldReagentData && oldReagentData.stats ? oldReagentData.stats : {}
    },
    pka: {
      myList: oldPkaData && Array.isArray(oldPkaData.myList) ? oldPkaData.myList : [],
      stats: oldPkaData && oldPkaData.stats ? oldPkaData.stats : {}
    }
  };
}
function chemReadSavedData() {
  return chemMyData;
}
function chemTodayKey() {
  return getIstDateKey();
}
function chemDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
function chemRecentStartKey(days = 7) {
  const d = new Date();
  d.setDate(d.getDate() - Math.max(0, days - 1));
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(d);
}
function chemEnsureDailyStats() {
  if (!chemMyData.dailyStats) chemMyData.dailyStats = {};
  if (!chemMyData.stats) chemMyData.stats = {};
  if (!Array.isArray(chemMyData.myList)) chemMyData.myList = [];
}
function chemNormalizeProgressData(source = {}) {
  let compList = [];
  let reagList = [];
  let compStats = {};
  let reagStats = {};

  // Handle myList (which can be array or combined object)
  if (source.myList) {
    if (Array.isArray(source.myList)) {
      compList = source.myList;
    } else if (typeof source.myList === 'object') {
      compList = Array.isArray(source.myList.compounds) ? source.myList.compounds : [];
      reagList = Array.isArray(source.myList.reagents) ? source.myList.reagents : [];
    }
  }

  // Handle stats (which can be old compound-only stats or combined object)
  if (source.stats && typeof source.stats === 'object') {
    if (source.stats.compounds || source.stats.reagents) {
      compStats = source.stats.compounds && typeof source.stats.compounds === 'object' ? source.stats.compounds : {};
      reagStats = source.stats.reagents && typeof source.stats.reagents === 'object' ? source.stats.reagents : {};
    } else {
      // Old format: all stats are compound stats
      compStats = source.stats;
    }
  }
  const dailyStats = source.dailyStats && typeof source.dailyStats === 'object' ? source.dailyStats : {};
  return {
    compounds: {
      myList: compList,
      stats: compStats,
      dailyStats: dailyStats
    },
    reagents: {
      myList: reagList,
      stats: reagStats
    }
  };
}
function chemProgressAttemptedTotal(source = {}) {
  var _source$compounds;
  const dailyStats = ((_source$compounds = source.compounds) === null || _source$compounds === void 0 ? void 0 : _source$compounds.dailyStats) || source.dailyStats || {};
  return Object.values(dailyStats).reduce((total, stats) => {
    return total + Number((stats === null || stats === void 0 ? void 0 : stats.attempted) || 0);
  }, 0);
}
function chemCurrentUserName() {
  const rawName = sessionStorage.getItem('fy_user_name');
  if (rawName && rawName.trim() && rawName.trim() !== 'Student') {
    return rawName.trim();
  }
  return 'Student';
}
function chemBuildDailyPayload(statDate, stats) {
  const ntscName = chemCurrentUserName();
  const displayName = (sessionStorage.getItem('fy_user_name') || 'Student').trim() || 'Student';
  return {
    user_id: ntscName,
    username: displayName,
    stat_date: statDate,
    correct: (stats === null || stats === void 0 ? void 0 : stats.correct) || 0,
    wrong: (stats === null || stats === void 0 ? void 0 : stats.wrong) || 0,
    attempted: (stats === null || stats === void 0 ? void 0 : stats.attempted) || 0,
    time_spent: (stats === null || stats === void 0 ? void 0 : stats.timeSpent) || (stats === null || stats === void 0 ? void 0 : stats.time_spent) || 0
  };
}
function chemBuildProgressPayload() {
  const ntscName = chemCurrentUserName();
  const displayName = (sessionStorage.getItem('fy_user_name') || 'Student').trim() || 'Student';
  return {
    user_id: ntscName,
    username: displayName,
    my_list: {
      compounds: chemMyData.myList || [],
      reagents: reagentMyData.myList || []
    },
    compound_stats: {
      compounds: chemMyData.stats || {},
      reagents: reagentMyData.stats || {}
    },
    daily_stats: chemMyData.dailyStats || {},
    updated_at: new Date().toISOString()
  };
}
async function chemEnsureSupabase() {
  const hasAccess = await checkPracticeAccess();
  if (!hasAccess) return null;
  if (!chemSupabase && window.supabase) {
    chemSupabase = window.supabase.createClient(CHEM_SUPABASE_URL, CHEM_SUPABASE_KEY);
  }
  return chemSupabase;
}
let publicSupabaseClient = null;
function getPublicSupabaseClient() {
  if (!publicSupabaseClient && window.supabase) {
    publicSupabaseClient = window.supabase.createClient(CHEM_SUPABASE_URL, CHEM_SUPABASE_KEY);
  }
  return publicSupabaseClient;
}
async function uploadBatchesToSupabase(batches, academicYear) {
  if (!Array.isArray(batches) || batches.length === 0) return;
  const client = getPublicSupabaseClient();
  if (!client) return;
  const payload = batches.map(b => ({
    id: Number(b.id),
    name: String(b.title || '').trim(),
    year: academicYear ? Number(academicYear) : null,
    updated_at: new Date().toISOString()
  }));
  try {
    const {
      error
    } = await client.from('batches').upsert(payload, {
      onConflict: 'id'
    });
    if (error) {
      console.error("Error uploading batches to Supabase:", error);
    }
  } catch (e) {
    console.error("Exception uploading batches to Supabase:", e);
  }
}
function getTestModeLabel(t) {
  if (t.isOffline === false || t.isOffline === 'false' || t.isOffline === 0) return 'Online';
  if (t.isOffline === true || t.isOffline === 'true' || t.isOffline === 1) return 'Offline';
  const mode = t.mode || t.testMode || t.examMode || t.examType || t.testType || '';
  if (mode) return String(mode).trim();
  return 'Offline';
}

function isOnlineTest(test) {
  if (!test) return false;
  return test.isOffline === false || test.isOffline === 'false' || test.isOffline === 0;
}

async function uploadTestsToSupabase(tests, academicYear) {
  if (!Array.isArray(tests) || tests.length === 0) return;
  const client = getPublicSupabaseClient();
  if (!client) return;
  const payload = tests.map(t => {
    const testId = Number(t.id || t.testPaperId || t.testId || t.examId);
    const testName = String(t.testName || t.name || t.examName || t.title || 'Exam').trim();
    const examDate = t.examDate || t.testDate || t.startDate || t.dateTime || null;
    const mode = getTestModeLabel(t);
    return {
      id: testId,
      name: testName,
      mode: mode,
      academic_year: academicYear ? Number(academicYear) : (t.academicYear ? Number(t.academicYear) : null),
      exam_date: examDate ? String(examDate) : null,
      updated_at: new Date().toISOString()
    };
  }).filter(t => t.id && !Number.isNaN(t.id) && t.name);

  if (!payload.length) return;

  try {
    const { error } = await client.from('test_ids').upsert(payload, {
      onConflict: 'id'
    });
    if (error) {
      console.error("Error uploading test IDs to Supabase:", error);
    }
  } catch (e) {
    console.error("Exception uploading test IDs to Supabase:", e);
  }
}
const uploadOnlineTestsToSupabase = uploadTestsToSupabase;

async function scanAndUploadOnlineTests(tests = null) {
  // Disabled auto-sync: only exams that appear in the Exam Calendar are synced to Supabase
  return;
}

// Manual console command to scan latest 10 tests and show upload details
window.scanTestIds = async function scanTestIds() {
  console.group('%c🔍 [Test IDs Scanner] Scanning latest 10 tests...', 'color: #6366f1; font-weight: bold; font-size: 13px;');
  try {
    if (!API_CONFIG.token) {
      console.error('❌ Error: No session token found. Please log into the portal first.');
      console.groupEnd();
      return { success: false, error: 'No token' };
    }

    let candidateTests = [];
    if (Array.isArray(APP_STATE.tests) && APP_STATE.tests.length) {
      candidateTests = [...APP_STATE.tests];
      console.log('📦 Loaded tests from active APP_STATE.tests (' + candidateTests.length + ' tests)');
    } else if (Array.isArray(APP_STATE.eraTests) && APP_STATE.eraTests.length) {
      candidateTests = [...APP_STATE.eraTests];
      console.log('📦 Loaded tests from active APP_STATE.eraTests (' + candidateTests.length + ' tests)');
    } else {
      console.log('🌐 Fetching latest tests directly from ExaminationHall API...');
      const page = await fetchTestsPage(API_CONFIG.token, 1, 10);
      candidateTests = page.tests || [];
    }

    if (!candidateTests.length) {
      console.warn('⚠️ No tests found for the current academic year (' + API_CONFIG.academicYear + ').');
      console.groupEnd();
      return { success: true, count: 0, tests: [] };
    }

    const latest10 = candidateTests.slice(0, 10);
    console.log(`📋 Found ${latest10.length} latest tests:`);

    const evaluated = latest10.map((t, idx) => {
      const testId = Number(t.id || t.testPaperId || t.testId || t.examId);
      const testName = String(t.testName || t.name || t.examName || t.title || 'Exam').trim();
      const mode = getTestModeLabel(t);
      return {
        Index: idx + 1,
        ID: testId,
        Name: testName,
        isOffline: t.isOffline,
        Mode: mode,
        'Exam Type': t.examType || t.testType || 'N/A',
        Date: formatDateLabel(t.examDate || t.testDate || t.startDate || t.dateTime)
      };
    });

    console.table(evaluated);

    console.log('🚀 Uploading ' + latest10.length + ' tests to Supabase table `test_ids`...');
    const client = getPublicSupabaseClient();
    if (!client) {
      console.error('❌ Supabase client not initialized.');
      console.groupEnd();
      return { success: false, error: 'Supabase client missing' };
    }

    const payload = latest10.map(t => {
      const testId = Number(t.id || t.testPaperId || t.testId || t.examId);
      const testName = String(t.testName || t.name || t.examName || t.title || 'Exam').trim();
      const examDate = t.examDate || t.testDate || t.startDate || t.dateTime || null;
      const mode = getTestModeLabel(t);
      return {
        id: testId,
        name: testName,
        mode: mode,
        academic_year: API_CONFIG.academicYear ? Number(API_CONFIG.academicYear) : (t.academicYear ? Number(t.academicYear) : null),
        exam_date: examDate ? String(examDate) : null,
        updated_at: new Date().toISOString()
      };
    }).filter(t => t.id && !Number.isNaN(t.id) && t.name);

    const { data, error } = await client.from('test_ids').upsert(payload, { onConflict: 'id' }).select();

    if (error) {
      console.error('❌ Supabase Upload Error:', error);
      console.groupEnd();
      return { success: false, error, payload };
    }

    console.log('%c✅ Successfully uploaded ' + payload.length + ' test(s) to Supabase!', 'color: #22c55e; font-weight: bold;');
    console.table(payload);
    console.groupEnd();

    return {
      success: true,
      scannedCount: evaluated.length,
      uploadedCount: payload.length,
      scanned: evaluated,
      uploaded: payload
    };
  } catch (err) {
    console.error('❌ Exception during scanTestIds:', err);
    console.groupEnd();
    return { success: false, error: err.message || err };
  }
};
window.scanOnlineTests = window.scanTestIds;
window.scanAndUploadTests = scanAndUploadOnlineTests;
window.uploadTestsToSupabase = uploadTestsToSupabase;
window.isOnlineTest = isOnlineTest;
window.uploadOnlineTestsToSupabase = uploadOnlineTestsToSupabase;
window.scanAndUploadOnlineTests = scanAndUploadOnlineTests;

// Internal Schedule ID generation & conflict resolution for Exam Calendar (which has NO testId)
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
  // Extract date from syllabus HTML/text if present (e.g. "05 April 2026", "26-July-26", "05-04-2026")
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

  // Signature uniquely identifying this exam schedule event across all batches & students
  const signature = `${yearKey}|${nameKey}|${dateKey}`;

  // 32-bit FNV-1a hash
  let hash = 2166136261;
  for (let i = 0; i < signature.length; i++) {
    hash ^= signature.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  // Positive 9-digit internal ID: 100000000 to 999999999
  const internalId = 100000000 + (Math.abs(hash >>> 0) % 899999999);
  return internalId;
}

const getScheduleId = getInternalScheduleId;
const getStableScheduleId = getInternalScheduleId;


// Utility helpers to merge courses, syllabus and venue across multiple students/batches without duplicates
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

// Local storage for exam schedules in Exam Hall
function getScheduleStorageKey() {
  return getUserStorageKey('fy_exam_schedule_cache');
}

function readFullExamSchedules() {
  try {
    const raw = localStorage.getItem(getScheduleStorageKey()) || localStorage.getItem('fy_exam_schedule_cache');
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
}

function saveFullExamSchedules(entries) {
  if (!Array.isArray(entries) || !entries.length) return readFullExamSchedules();
  try {
    const existing = readFullExamSchedules();
    const map = new Map();
    existing.forEach(item => {
      if (!item) return;
      const id = getScheduleId(item);
      map.set(id, item);
    });
    entries.forEach(entry => {
      if (!entry) return;
      const id = getScheduleId(entry);
      const prev = map.get(id) || {};
      const mergedCourses = mergeCoursesString(prev.courses, entry.courses || entry.batchName);
      const richerSyllabus = pickRicherSyllabus(prev.syllabus, entry.syllabus);
      const betterVenue = pickBetterVenue(prev.venue, entry.venue);

      map.set(id, {
        ...prev,
        ...entry,
        id: id,
        name: entry.name || entry.testName || entry.examName || prev.name || prev.testName || 'Exam',
        testName: entry.testName || entry.name || entry.examName || prev.testName || 'Exam',
        examDate: entry.examDate || entry.dateTime || entry.testDate || entry.startDate || prev.examDate || null,
        mode: getTestModeLabel(entry) || prev.mode || 'Offline',
        venue: betterVenue,
        courses: mergedCourses,
        duration: entry.duration || (entry.durationMinutes ? `${entry.durationMinutes} mins` : prev.duration || ''),
        syllabus: richerSyllabus,
        updatedAt: new Date().toISOString()
      });
    });
    const merged = Array.from(map.values());
    localStorage.setItem(getScheduleStorageKey(), JSON.stringify(merged));
    return merged;
  } catch (e) {
    console.warn("Notice saving exam schedules locally for Exam Hall:", e);
    return entries;
  }
}
window.readFullExamSchedules = readFullExamSchedules;
window.saveFullExamSchedules = saveFullExamSchedules;

async function uploadExamCalendarToSupabase(calendarItems, academicYear) {
  if (!Array.isArray(calendarItems) || calendarItems.length === 0) return { success: true, count: 0 };
  const client = getPublicSupabaseClient();
  if (!client) return { success: false, error: 'Supabase client missing' };

  const rawPayload = calendarItems.map(t => {
    const sId = getInternalScheduleId(t);
    const testName = String(t.testName || t.name || t.examName || t.title || 'Exam').trim();
    const dateKey = extractScheduleDateKey(t);
    const examDate = t.examDate || t.dateTime || t.testDate || t.startDate || (dateKey ? `${dateKey}T09:00:00` : null);
    const mode = getTestModeLabel(t);
    const year = academicYear ? Number(academicYear) : (t.academicYear ? Number(t.academicYear) : null);
    const venue = t.venue ? String(t.venue).trim() : null;
    const courses = t.courses ? String(t.courses).trim() : (t.batchName || t.courseName || null);
    const duration = t.duration || (t.durationMinutes ? `${t.durationMinutes} mins` : null);
    const syllabus = t.syllabus || (Array.isArray(t.syllabusLines) ? t.syllabusLines.join('\n') : null);

    // Skip empty dummy "Exam" rows without syllabus or date
    if (testName.toLowerCase() === 'exam' && !syllabus && !examDate) return null;

    return {
      id: sId,
      name: testName,
      exam_date: examDate ? String(examDate) : null,
      venue: venue,
      courses: courses,
      mode: mode,
      duration: duration,
      syllabus: syllabus,
      academic_year: year,
      updated_at: new Date().toISOString()
    };
  }).filter(t => t && t.id && !Number.isNaN(t.id) && t.name);

  if (!rawPayload.length) return { success: true, count: 0 };

  try {
    // Merge with existing Supabase records so courses and rich syllabus from different students/batches accumulate
    const ids = rawPayload.map(p => p.id);
    const existingMap = new Map();
    try {
      const { data: existingRows } = await client
        .from('test_schedules')
        .select('*')
        .in('id', ids);
      if (Array.isArray(existingRows)) {
        existingRows.forEach(r => existingMap.set(Number(r.id), r));
      }
    } catch (_) {}

    const finalPayload = rawPayload.map(item => {
      const prev = existingMap.get(item.id);
      if (!prev) return item;
      return {
        ...item,
        name: item.name && item.name.toLowerCase() !== 'exam' ? item.name : prev.name,
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

    const { data, error } = await client.from('test_schedules').upsert(finalPayload, {
      onConflict: 'id'
    }).select();

    if (error) {
      console.warn("Notice syncing to Supabase table test_schedules:", error.message);
      return { success: false, error: error.message };
    }
    return { success: true, count: finalPayload.length, data: finalPayload };
  } catch (e) {
    console.warn("Exception syncing to Supabase table test_schedules:", e);
    return { success: false, error: e.message || e };
  }
}

async function scanAndUploadExamCalendar(calendarEntries = null) {
  try {
    let entries = [];
    if (Array.isArray(calendarEntries) && calendarEntries.length) {
      entries = calendarEntries;
    } else if (Array.isArray(APP_STATE.calendarEntries) && APP_STATE.calendarEntries.length) {
      entries = APP_STATE.calendarEntries;
    } else if (API_CONFIG.token) {
      entries = await fetchCalendar(API_CONFIG.token);
    }

    if (!entries || !entries.length) return;

    // 1. Save full schedules to local storage for Exam Hall
    saveFullExamSchedules(entries);

    // 2. Direct online sync to Supabase dedicated table test_schedules
    await uploadExamCalendarToSupabase(entries, API_CONFIG.academicYear);
  } catch (e) {
    console.error("Exception scanning and uploading exam calendar:", e);
  }
}

window.scanExamCalendar = async function scanExamCalendar() {
  console.group('%c📅 [Exam Calendar Scanner] Scanning schedules & syncing to Supabase test_schedules...', 'color: #f59e0b; font-weight: bold; font-size: 13px;');
  try {
    let entries = [];
    if (Array.isArray(APP_STATE.calendarEntries) && APP_STATE.calendarEntries.length) {
      entries = [...APP_STATE.calendarEntries];
      console.log('📦 Loaded calendar from APP_STATE.calendarEntries (' + entries.length + ' entries)');
    } else if (API_CONFIG.token) {
      console.log('🌐 Fetching latest calendar from GetStudentCalendar API...');
      entries = await fetchCalendar(API_CONFIG.token);
    }

    if (!entries.length) {
      console.warn('⚠️ No calendar entries found for the current academic year (' + API_CONFIG.academicYear + ').');
      console.groupEnd();
      return { success: true, count: 0, entries: [] };
    }

    // Save full schedules locally without duplicates
    const merged = saveFullExamSchedules(entries);
    console.log('💾 Merged full schedules locally (' + merged.length + ' deduplicated schedules in storage)');

    const evaluated = entries.map((t, idx) => {
      const sId = getInternalScheduleId(t);
      const testName = String(t.testName || t.name || t.examName || 'Exam').trim();
      const mode = getTestModeLabel(t);
      const examDate = t.examDate || t.dateTime || t.testDate || t.startDate || null;
      return {
        Index: idx + 1,
        Internal_ID: sId,
        Name: testName,
        Mode: mode,
        Venue: t.venue || 'Campus Exam Hall',
        Date: formatDateTimeLabel(examDate)
      };
    });

    console.table(evaluated);

    // Sync online with full conflict resolution
    const uploadRes = await uploadExamCalendarToSupabase(entries, API_CONFIG.academicYear);

    if (!uploadRes.success) {
      console.warn('⚠️ Supabase test_schedules sync notice:', uploadRes.error);
      console.groupEnd();
      return { success: false, error: uploadRes.error };
    }

    console.log('%c✅ Successfully synced ' + (uploadRes.count || 0) + ' schedule(s) to Supabase table `test_schedules` with conflict handling!', 'color: #22c55e; font-weight: bold;');
    console.groupEnd();

    return {
      success: true,
      scannedCount: evaluated.length,
      syncedCount: uploadRes.count || 0,
      scanned: evaluated,
      synced: uploadRes.data || []
    };
  } catch (err) {
    console.error('❌ Exception during scanExamCalendar:', err);
    console.groupEnd();
    return { success: false, error: err.message || err };
  }
};

async function clearTestSchedulesTable() {
  const client = getPublicSupabaseClient();
  if (!client) {
    console.error("Supabase client not initialized.");
    return false;
  }
  try {
    const { data: rows, error: selectError } = await client.from('test_schedules').select('id');
    if (selectError) {
      console.error("Error fetching rows to clear:", selectError.message);
      return false;
    }
    if (!rows || !rows.length) {
      console.log("Table `test_schedules` is already empty.");
      return true;
    }
    const ids = rows.map(r => r.id);
    const { error: delError } = await client.from('test_schedules').delete().in('id', ids);
    if (delError) {
      console.error("Failed to clear `test_schedules`:", delError.message);
      return false;
    }
    console.log(`✅ Successfully cleared ${ids.length} rows from \`test_schedules\` table.`);
    return true;
  } catch (err) {
    console.error("Exception clearing `test_schedules`:", err);
    return false;
  }
}

window.scanAndUploadExamCalendar = scanAndUploadExamCalendar;
window.uploadExamCalendarToSupabase = uploadExamCalendarToSupabase;
window.getScheduleId = getScheduleId;
window.getStableScheduleId = getScheduleId;
window.getInternalScheduleId = getInternalScheduleId;
window.clearTestSchedulesTable = clearTestSchedulesTable;

async function chemTrackUserActivity() {
  const username = getCurrentUserId();
  if (!username) return;
  const client = getPublicSupabaseClient();
  if (!client) return;
  const currentMonthYear = new Date().toLocaleString('en-US', {
    month: 'long',
    year: 'numeric'
  });
  try {
    const {
      data,
      error
    } = await client.from('user_activity').select('month_1, month_2, month_3').eq('username', username).maybeSingle();
    if (error) {
      console.error("Error fetching user activity:", error);
      return;
    }
    let m1 = null;
    let m2 = null;
    let m3 = null;
    if (data) {
      m1 = data.month_1;
      m2 = data.month_2;
      m3 = data.month_3;
    }

    // If already tracked in one of the fields, only update timestamp
    if (m1 === currentMonthYear || m2 === currentMonthYear || m3 === currentMonthYear) {
      await client.from('user_activity').upsert({
        username: username,
        month_1: m1,
        month_2: m2,
        month_3: m3,
        updated_at: new Date().toISOString()
      });
      return;
    }

    // If not found, assign to empty slots or overwrite the oldest
    if (!m1) {
      m1 = currentMonthYear;
    } else if (!m2) {
      m2 = currentMonthYear;
    } else if (!m3) {
      m3 = currentMonthYear;
    } else {
      const parseMonthYear = str => {
        if (!str) return new Date(0);
        const d = new Date(str);
        return isNaN(d.getTime()) ? new Date(0) : d;
      };
      const d1 = parseMonthYear(m1);
      const d2 = parseMonthYear(m2);
      const d3 = parseMonthYear(m3);
      const oldest = Math.min(d1.getTime(), d2.getTime(), d3.getTime());
      if (oldest === d1.getTime()) {
        m1 = currentMonthYear;
      } else if (oldest === d2.getTime()) {
        m2 = currentMonthYear;
      } else {
        m3 = currentMonthYear;
      }
    }
    await client.from('user_activity').upsert({
      username: username,
      month_1: m1,
      month_2: m2,
      month_3: m3,
      updated_at: new Date().toISOString()
    });
  } catch (err) {
    console.error("Error tracking user activity:", err);
  }
}
async function chemLoadVisitorStat() {
  const labelEl = document.getElementById('settings-visitor-stat-label');
  const valEl = document.getElementById('settings-visitor-stat-value');
  if (!labelEl || !valEl) return;
  const currentMonthYear = new Date().toLocaleString('en-US', {
    month: 'long',
    year: 'numeric'
  });
  const monthNameOnly = new Date().toLocaleString('en-US', {
    month: 'long'
  });
  labelEl.textContent = `Total Unique Visitors in ${monthNameOnly}`;
  try {
    const client = getPublicSupabaseClient();
    if (!client) {
      valEl.textContent = 'Unavailable';
      return;
    }
    const {
      count,
      error
    } = await client.from('user_activity').select('*', {
      count: 'exact',
      head: true
    }).or(`month_1.eq."${currentMonthYear}",month_2.eq."${currentMonthYear}",month_3.eq."${currentMonthYear}"`);
    if (error) {
      console.error("Error fetching visitor count:", error);
      valEl.textContent = 'Error';
    } else {
      valEl.textContent = count !== null ? count : '0';
    }
  } catch (err) {
    console.error("Error loading visitor count:", err);
    valEl.textContent = 'Error';
  }
}
function chemFallbackCompounds() {
  return [{
    name: "Ethanol",
    smiles: "CCO",
    tags: ["reagent"]
  }, {
    name: "Caffeine",
    smiles: "CN1C=NC2=C1C(=O)N(C(=O)N2C)C",
    tags: ["organic"]
  }, {
    name: "Aspirin",
    smiles: "CC(=O)Oc1ccccc1C(=O)O",
    tags: ["acid", "aromatic"]
  }, {
    name: "Glucose",
    smiles: "OC[C@H]1OC(O)[C@H](O)[C@@H](O)[C@@H]1O",
    tags: ["organic"]
  }, {
    name: "Benzene",
    smiles: "c1ccccc1",
    tags: ["aromatic"]
  }, {
    name: "Acetic Acid",
    smiles: "CC(=O)O",
    tags: ["acid"]
  }, {
    name: "Acetone",
    smiles: "CC(C)=O",
    tags: ["reagent"]
  }, {
    name: "Methanol",
    smiles: "CO",
    tags: ["reagent"]
  }, {
    name: "Toluene",
    smiles: "Cc1ccccc1",
    tags: ["aromatic"]
  }, {
    name: "Phenol",
    smiles: "Oc1ccccc1",
    tags: ["acid", "aromatic"]
  }];
}
async function chemInitApp() {
  if (chemAppReady) {
    chemUpdateDashboard();
    chemLoadLeaderboard('today');
    return;
  }
  chemEnsureDailyStats();
  await chemEnsureSupabase();
  try {
    const options = {
      width: 520,
      height: 300,
      bondThickness: 1.8,
      fontSizeLarge: 14,
      themes: {
        dark: {
          C: '#e8eaf6',
          O: '#ef4444',
          N: '#5f8dff',
          S: '#f59e0b',
          H: '#94a3b8',
          P: '#22c55e',
          F: '#22c55e',
          Cl: '#22c55e',
          Br: '#f59e0b',
          I: '#8b5cf6',
          BACKGROUND: '#121b31'
        }
      }
    };
    if (typeof SmiDrawer !== 'undefined') chemDrawer = new SmiDrawer(options);else if (typeof SmilesDrawer !== 'undefined') chemDrawer = new SmilesDrawer.SmiDrawer(options);
  } catch (err) {
    console.warn('Chem drawer init failed', err);
  }
  try {
    const response = await fetch('compounds_smiles.json');
    if (!response.ok) throw new Error('No compound JSON');
    const loaded = await response.json();
    chemAllCompounds = Array.isArray(loaded) && loaded.length ? loaded : chemFallbackCompounds();
  } catch (_) {
    chemAllCompounds = chemFallbackCompounds();
  }
  chemAppReady = true;
  chemUpdateDashboard();
  chemLoadLeaderboard('today');
  chemDownloadProgress(false).then(loaded => {
    if (loaded) {
      chemUpdateDashboard();
    }
  });
}
function chemUpdateDashboard() {
  var _chemMyData$dailyStat;
  const total = chemAllCompounds.length;
  const inList = chemMyData.myList.length;
  const mastered = chemMyData.myList.filter(name => {
    const s = chemMyData.stats[name];
    return s && s.correct >= 5 && s.wrong === 0;
  }).length;

  // Calculate today's and 7-day attempts
  const today = chemTodayKey();
  const todayAttempts = ((_chemMyData$dailyStat = chemMyData.dailyStats[today]) === null || _chemMyData$dailyStat === void 0 ? void 0 : _chemMyData$dailyStat.attempted) || 0;
  let sevenDayAttempts = 0;
  const recentStart = chemRecentStartKey(7);
  if (chemMyData.dailyStats && typeof chemMyData.dailyStats === 'object') {
    for (const [date, stats] of Object.entries(chemMyData.dailyStats)) {
      if (date >= recentStart && stats) {
        sevenDayAttempts += stats.attempted || 0;
      }
    }
  }
  const list = document.getElementById('chem-stat-list');
  const totalEl = document.getElementById('chem-stat-total');
  const masteredEl = document.getElementById('chem-stat-mastered');
  const todayAttemptsEl = document.getElementById('chem-stat-today-attempts');
  const sevenDayAttemptsEl = document.getElementById('chem-stat-7day-attempts');
  if (list) list.innerHTML = `List: <strong>${inList}</strong>`;
  if (totalEl) totalEl.innerHTML = `Total: <strong>${total}</strong>`;
  if (masteredEl) masteredEl.innerHTML = `Mastered: <strong>${mastered}</strong>`;
  if (todayAttemptsEl) todayAttemptsEl.innerHTML = `Today: <strong>${todayAttempts}</strong>`;
  if (sevenDayAttemptsEl) sevenDayAttemptsEl.innerHTML = `7-Day: <strong>${sevenDayAttempts}</strong>`;
}
function chemSave() {
  chemEnsureDailyStats();
  chemCombinedData.compounds = chemMyData;
  chemCombinedData.reagents = reagentMyData;
  chemCombinedData.pka = pkaMyData;
  localStorage.setItem(getUserStorageKey(CHEM_DATA_KEY), JSON.stringify(chemCombinedData));
  localStorage.setItem(getUserStorageKey('chem_progress_updated_at'), new Date().toISOString());
  localStorage.setItem(getUserStorageKey('reagent_v1_data'), JSON.stringify(reagentMyData));
  chemUpdateDashboard();
}
function chemDrawStructure(smiles, canvasId) {
  if (!smiles) return;
  const renderer = localStorage.getItem(getUserStorageKey('chem_setting_renderer')) || 'smiles';
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  if (renderer === 'rdkit') {
    canvas.classList.add('rdkit-canvas');
    if (window.RDKitModule) {
      try {
        const ctx = canvas.getContext('2d');
        if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
        const mol = window.RDKitModule.get_mol(smiles);
        if (mol) {
          const drawOpts = {
            backgroundColour: [1, 1, 1, 1],
            legendColour: [0, 0, 0, 1],
            symbolColour: [0, 0, 0, 1]
          };
          mol.draw_to_canvas_with_highlights(canvas, JSON.stringify(drawOpts));
          mol.delete();
        }
      } catch (err) {
        console.warn('RDKit draw failed', err);
        drawWithSmilesDrawer(smiles, canvasId);
      }
    } else {
      loadRDKitDynamic().then(() => {
        chemDrawStructure(smiles, canvasId);
      }).catch(() => {
        drawWithSmilesDrawer(smiles, canvasId);
      });
    }
  } else {
    canvas.classList.remove('rdkit-canvas');
    drawWithSmilesDrawer(smiles, canvasId);
  }
}
function drawWithSmilesDrawer(smiles, canvasId) {
  if (!chemDrawer) return;
  try {
    try {
      chemDrawer.draw(smiles, '#' + canvasId, 'dark');
    } catch (_) {
      chemDrawer.draw(smiles, '#' + canvasId, 'light');
    }
  } catch (err) {
    console.warn('Smiles drawer draw failed', err);
  }
}
let rdkitLoadingPromise = null;
function loadRDKitDynamic() {
  if (window.RDKitModule) return Promise.resolve(window.RDKitModule);
  if (rdkitLoadingPromise) return rdkitLoadingPromise;
  rdkitLoadingPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = "https://unpkg.com/@rdkit/rdkit/dist/RDKit_minimal.js";
    script.onload = () => {
      if (typeof initRDKitModule !== 'undefined') {
        initRDKitModule().then(instance => {
          window.RDKitModule = instance;
          console.log("RDKit loaded, version:", instance.version());
          resolve(instance);
        }).catch(err => {
          console.error("RDKit init failed:", err);
          reject(err);
        });
      } else {
        reject(new Error("initRDKitModule not defined after script load"));
      }
    };
    script.onerror = err => {
      console.error("RDKit script load failed:", err);
      reject(err);
    };
    document.head.appendChild(script);
  });
  return rdkitLoadingPromise;
}
function chemRefreshCurrentDrawing() {
  const activeView = document.querySelector('.chem-view.active');
  if (!activeView) return;
  if (activeView.id === 'chem-view-learn') {
    chemUpdateLearnCard();
  } else if (activeView.id === 'chem-view-practice') {
    const wizardMode = localStorage.getItem(getUserStorageKey('chem_setting_wizard_mode')) === 'true';
    if (wizardMode) {
      if (chemWizardQueue.length > 0 && chemWizardIdx < chemWizardQueue.length) {
        const targetName = chemWizardQueue[chemWizardIdx];
        const canvasWrap = document.querySelector('#chem-view-practice .chem-canvas-wrap');
        if (canvasWrap && canvasWrap.style.display !== 'none') {
          const targetObj = chemAllCompounds.find(c => c.name === targetName);
          if (targetObj) chemDrawStructure(targetObj.smiles, 'chem-practice-canvas');
        }
      }
    } else {
      if (chemLastPracticeName) {
        const targetObj = chemAllCompounds.find(c => c.name === chemLastPracticeName);
        if (targetObj) {
          const canvasWrap = document.querySelector('#chem-view-practice .chem-canvas-wrap');
          if (canvasWrap && canvasWrap.style.display !== 'none') {
            chemDrawStructure(targetObj.smiles, 'chem-practice-canvas');
          } else {
            const btns = document.querySelectorAll('.chem-opt-btn-structure');
            btns.forEach((btn, i) => {
              const optVal = btn.dataset.option;
              const optObj = chemAllCompounds.find(c => c.name === optVal);
              if (optObj) {
                chemDrawStructure(optObj.smiles, `chem-opt-canvas-${i}`);
              }
            });
          }
        }
      }
    }
  }
}
function chemBuildLearnQueue() {
  const names = [...chemMyData.myList];
  const weighted = names.map(name => {
    const s = chemMyData.stats[name] || {
      correct: 0,
      wrong: 0,
      streak: 0,
      lastSeen: 0
    };
    const hrsSince = (Date.now() - (s.lastSeen || 0)) / 3600000;
    const errorRatio = (s.wrong + 1) / (s.correct + 2);
    const staleness = Math.min(hrsSince / 24, 3);
    const streakPenalty = Math.max(0, 1 - s.streak * 0.1);
    const weight = errorRatio * 4 + staleness * 2 + streakPenalty + Math.random() * 1.5;
    return {
      name,
      weight
    };
  });
  weighted.sort((a, b) => b.weight - a.weight);
  return weighted.map(w => w.name);
}
function chemShowView(id) {
  document.querySelectorAll('.chem-view').forEach(v => v.classList.remove('active'));
  const view = document.getElementById('chem-view-' + id);
  if (view) view.classList.add('active');
}
function chemGoHome() {
  chemShowView('home');
  chemSyncAll(false);
}
function chemLearnNew() {
  if (!chemAppReady) return chemInitApp().then(chemLearnNew);
  const remaining = chemAllCompounds.filter(c => !chemMyData.myList.includes(c.name));
  if (!remaining.length) {
    chemShowToast("All available compounds are already in your list.");
    return;
  }
  const selected = remaining.sort(() => 0.5 - Math.random()).slice(0, Math.min(5, remaining.length));
  selected.forEach(c => {
    chemMyData.myList.push(c.name);
    chemMyData.stats[c.name] = {
      wrong: 0,
      correct: 0,
      streak: 0,
      lastSeen: 0
    };
  });
  chemSave();
  chemSyncAll(false);
  chemShowToast(`Added: ${selected.map(s => s.name).join(', ')}`);
}
async function chemInitLearn() {
  if (!chemMyData.myList.length) {
    chemShowToast("Add compounds first.");
    return;
  }
  chemLearnQueue = chemBuildLearnQueue();
  chemLearnIdx = 0;
  chemShowView('learn');
  chemUpdateLearnCard();
}
function chemChangeLearn(dir) {
  if (!chemLearnQueue.length) return;
  chemLearnIdx += dir;
  if (chemLearnIdx >= chemLearnQueue.length) chemLearnIdx = 0;
  if (chemLearnIdx < 0) chemLearnIdx = chemLearnQueue.length - 1;
  chemUpdateLearnCard();
}
function chemUpdateLearnCard() {
  const name = chemLearnQueue[chemLearnIdx];
  const comp = chemAllCompounds.find(c => c.name === name);
  const stat = chemMyData.stats[name] || {
    correct: 0,
    wrong: 0,
    streak: 0
  };
  document.getElementById('chem-learn-name').textContent = name || '-';
  document.getElementById('chem-learn-index-text').textContent = `${chemLearnIdx + 1} / ${chemLearnQueue.length}`;
  document.getElementById('chem-learn-correct').textContent = stat.correct || 0;
  document.getElementById('chem-learn-wrong').textContent = stat.wrong || 0;
  document.getElementById('chem-learn-streak').textContent = stat.streak || 0;
  document.getElementById('chem-learn-progress').style.width = `${((chemLearnIdx + 1) / chemLearnQueue.length * 100).toFixed(1)}%`;
  if (comp) chemDrawStructure(comp.smiles, 'chem-learn-canvas');
}
const UnifiedQuestionEngine = {
  // ── Recency buffer to prevent repetitive loops ──
  _recentKeys: [],
  _RECENCY_SIZE: 3,
  // ── SM-2 inspired review intervals (milliseconds) ──
  // streak → interval; intervals grow exponentially, compressed by error rate
  _INTERVALS_MS: [0,
  // streak 0: always eligible (new / struggling)
  30 * 60000,
  // streak 1: 30 minutes
  2 * 3600000,
  // streak 2: 2 hours
  8 * 3600000,
  // streak 3: 8 hours
  24 * 3600000,
  // streak 4: 1 day
  72 * 3600000,
  // streak 5: 3 days
  168 * 3600000,
  // streak 6: 7 days
  336 * 3600000 // streak 7+: 14 days
  ],
  getReviewInterval(stats) {
    const s = stats || {
      wrong: 0,
      correct: 0,
      streak: 0
    };
    const streak = Math.min(s.streak || 0, this._INTERVALS_MS.length - 1);
    const baseInterval = this._INTERVALS_MS[streak];

    // Compress interval by error rate — high errors = review sooner
    const total = (s.wrong || 0) + (s.correct || 0);
    const errorRate = total > 0 ? (s.wrong || 0) / total : 0;
    const compression = 1 - errorRate * 0.6; // 40% errors → interval halved

    return Math.max(baseInterval * compression, 0);
  },
  calculateWeight(stats) {
    const s = stats || {
      wrong: 0,
      correct: 0,
      streak: 0,
      lastSeen: 0
    };
    const now = Date.now();
    const timeSince = now - (s.lastSeen || 0);
    const reviewInterval = this.getReviewInterval(s);

    // ── Overdue ratio: how far past the review window are we? ──
    // Items never seen (lastSeen=0) get maximum overdue urgency
    let overdueRatio;
    if (!s.lastSeen) {
      overdueRatio = 10; // Never seen → very high urgency
    } else if (reviewInterval <= 0) {
      overdueRatio = Math.min(timeSince / 3600000, 10); // streak 0: scale by hours
    } else {
      overdueRatio = Math.max(0, (timeSince - reviewInterval) / reviewInterval);
    }

    // ── Error rate (ratio, not raw count) ──
    const total = (s.wrong || 0) + (s.correct || 0);
    const errorRate = total > 0 ? (s.wrong || 0) / total : 0.5; // Unknown items get 50%

    // ── New item boost: items with streak 0 need immediate attention ──
    const newItemBoost = (s.streak || 0) === 0 ? 5 : 0;

    // ── Final urgency score ──
    // Much less randomness than before (2 vs 8) — the engine should be smart, not lucky
    const urgency = overdueRatio * 10 + errorRate * 8 + newItemBoost + Math.random() * 2;
    return Math.max(urgency, 0.1);
  },
  selectTarget(keys, statsMap, lastKey) {
    // Filter out recent items (anti-repeat window of last 3)
    let pool = keys.filter(k => !this._recentKeys.includes(k));
    if (pool.length === 0) pool = keys.filter(k => k !== lastKey);
    if (pool.length === 0) pool = [...keys];
    if (!pool.length) return null;
    const scored = pool.map(key => {
      const stats = statsMap[key];
      const weight = this.calculateWeight(stats);
      return {
        key,
        weight
      };
    });

    // Weighted random selection (biased heavily toward highest urgency)
    const totalWeight = scored.reduce((sum, s) => sum + s.weight, 0);
    let rand = Math.random() * totalWeight;
    for (const item of scored.sort((a, b) => b.weight - a.weight)) {
      rand -= item.weight;
      if (rand <= 0) {
        // Update recency buffer
        this._recentKeys.push(item.key);
        if (this._recentKeys.length > this._RECENCY_SIZE) {
          this._recentKeys.shift();
        }
        return item.key;
      }
    }
    const fallback = pool[Math.floor(Math.random() * pool.length)];
    this._recentKeys.push(fallback);
    if (this._recentKeys.length > this._RECENCY_SIZE) this._recentKeys.shift();
    return fallback;
  },
  // ── Mastery tier helper ──
  _getMasteryTier(stats) {
    const s = stats || {
      wrong: 0,
      correct: 0,
      streak: 0
    };
    const total = (s.wrong || 0) + (s.correct || 0);
    const errorRate = total > 0 ? (s.wrong || 0) / total : 1;
    if ((s.streak || 0) >= 5 && errorRate < 0.15) return 'mastered';
    if ((s.streak || 0) >= 3 && errorRate < 0.30) return 'reviewing';
    if ((s.correct || 0) >= 3 && (s.streak || 0) >= 2) return 'learning';
    return 'new';
  },
  decideFormat(mode, targetKey, statsMap) {
    const s = statsMap[targetKey] || {
      wrong: 0,
      correct: 0,
      streak: 0
    };
    const tier = this._getMasteryTier(s);
    const roll = Math.random();
    if (mode === 'common-names') {
      const textModeOn = localStorage.getItem(getUserStorageKey('chem_setting_text_mode')) !== 'false';
      const wizardModeOn = localStorage.getItem(getUserStorageKey('chem_setting_wizard_mode')) === 'true';
      if (wizardModeOn) return 'wizard';
      switch (tier) {
        case 'new':
          // New/struggling items: always normal MCQ (easiest)
          return 'normal';
        case 'learning':
          // Learning items: mix of normal (40%) and reverse (60%)
          return roll < 0.40 ? 'normal' : 'reverse';
        case 'reviewing':
          // Reviewing items: mix of reverse (50%) and text (50%)
          if (textModeOn) return roll < 0.50 ? 'reverse' : 'text';
          return roll < 0.40 ? 'normal' : 'reverse';
        case 'mastered':
          // Mastered items: primarily text (70%), some reverse (30%)
          if (textModeOn) return roll < 0.70 ? 'text' : 'reverse';
          return roll < 0.30 ? 'normal' : 'reverse';
        default:
          return 'normal';
      }
    }
    if (mode === 'reagents') {
      switch (tier) {
        case 'new':
          // New items: always product (easier direction)
          return 'product';
        case 'learning':
          // Learning: mostly product (60%), some reactant (40%)
          return roll < 0.60 ? 'product' : 'reactant';
        case 'reviewing':
          // Reviewing: mostly reactant (60%), some product (40%)
          return roll < 0.60 ? 'reactant' : 'product';
        case 'mastered':
          // Mastered: primarily reactant (80%)
          return roll < 0.80 ? 'reactant' : 'product';
        default:
          return 'product';
      }
    }
    if (mode === 'pka') {
      const textModeOn = localStorage.getItem(getUserStorageKey('chem_setting_text_mode')) !== 'false';
      switch (tier) {
        case 'new':
          // New items: always type1 (comparison — easiest)
          return 'type1';
        case 'learning':
          // Learning: mostly type1 (60%), some type3 (40%)
          return roll < 0.60 ? 'type1' : 'type3';
        case 'reviewing':
          // Reviewing: mix of type1 (30%) and type3 (70%)
          return roll < 0.30 ? 'type1' : 'type3';
        case 'mastered':
          // Mastered: type2 (50%), type3 (30%), type1 (20%)
          if (textModeOn) {
            if (roll < 0.50) return 'type2';
            if (roll < 0.80) return 'type3';
            return 'type1';
          }
          return roll < 0.30 ? 'type1' : 'type3';
        default:
          return 'type1';
      }
    }
    return null;
  }
};
function chemSampleWeighted(names) {
  var _scored$;
  const scored = names.map(name => {
    const s = chemMyData.stats[name] || {
      correct: 0,
      wrong: 0,
      streak: 0,
      lastSeen: 0
    };
    const hrsSince = (Date.now() - (s.lastSeen || 0)) / 3600000;
    const weight = s.wrong * 4 + Math.min(hrsSince * 0.6, 12) - s.streak * 2 + Math.random() * 8;
    return {
      name,
      weight
    };
  });
  const totalWeight = scored.reduce((sum, s) => sum + Math.max(s.weight, 0.5), 0);
  let rand = Math.random() * totalWeight;
  for (const item of scored.sort((a, b) => b.weight - a.weight)) {
    rand -= Math.max(item.weight, 0.5);
    if (rand <= 0) return item.name;
  }
  return (_scored$ = scored[0]) === null || _scored$ === void 0 ? void 0 : _scored$.name;
}
async function chemInitPractice() {
  const wizardMode = localStorage.getItem(getUserStorageKey('chem_setting_wizard_mode')) === 'true';
  if (wizardMode) {
    if (!chemMyData.myList || chemMyData.myList.length === 0) {
      chemShowToast("Add compounds first.");
      return;
    }
    chemPracticeSessionCount = 0;
    chemPracticeCorrectCount = 0;
    chemWizardQueue = [...chemMyData.myList].sort(() => 0.5 - Math.random());
    chemWizardIdx = 0;
    chemShowView('practice');
    chemWizardNextQuestion();
    return;
  }
  if (chemMyData.myList.length < 4) {
    chemShowToast("Need at least 4 compounds in your list.");
    return;
  }
  chemPracticeSessionCount = 0;
  chemPracticeCorrectCount = 0;
  chemLastPracticeName = null;
  chemShowView('practice');
  chemNextQuestion();
}

// ── Generous Spell Check Helper ──────────────────────────────────────────
function levenshteinDistance(s1, s2) {
  s1 = s1.toLowerCase().trim();
  s2 = s2.toLowerCase().trim();
  if (s1 === s2) return 0;
  if (s1.length === 0) return s2.length;
  if (s2.length === 0) return s1.length;
  const track = Array(s2.length + 1).fill(null).map(() => Array(s1.length + 1).fill(null));
  for (let i = 0; i <= s1.length; i += 1) track[0][i] = i;
  for (let j = 0; j <= s2.length; j += 1) track[j][0] = j;
  for (let j = 1; j <= s2.length; j += 1) {
    for (let i = 1; i <= s1.length; i += 1) {
      const indicator = s1[i - 1] === s2[j - 1] ? 0 : 1;
      track[j][i] = Math.min(track[j][i - 1] + 1,
      // deletion
      track[j - 1][i] + 1,
      // insertion
      track[j - 1][i - 1] + indicator // substitution
      );
    }
  }
  return track[s2.length][s1.length];
}
function isSpellCheckedCorrect(userVal, correctVal) {
  // Strip hyphens, spaces, commas, brackets, and other non-alphanumeric chars
  const cleanUser = userVal.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
  const cleanCorrect = correctVal.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
  if (cleanUser === cleanCorrect) return true;

  // Ensure user typed at least half the characters of the correct answer
  const minLen = Math.ceil(cleanCorrect.length / 2);
  if (cleanUser.length < minLen) return false;
  const dist = levenshteinDistance(cleanUser, cleanCorrect);
  const len = cleanCorrect.length;

  // Extremely generous spell checking edit distance thresholds:
  if (len <= 4) return dist <= 2;
  if (len <= 8) return dist <= 3;
  if (len <= 12) return dist <= 4;
  return dist <= 5;
}

// ── Tag-Weighted & Name-Similarity Distractor Sampler ──────────────────────
function chemGetWeightedDistractors(targetObj, count) {
  const pool = chemAllCompounds.filter(c => c.name !== targetObj.name);
  const selected = [];
  let candidates = pool.map(c => {
    const targetTags = targetObj.tags || [];
    const candidateTags = c.tags || [];
    const sharedCount = candidateTags.filter(t => targetTags.includes(t)).length;
    let weight = 1.0 + sharedCount * 6.0;

    // Name similarity weight boost (e.g. Ethanol and Methanol, abcde and abbde)
    const name1 = targetObj.name.toLowerCase().trim();
    const name2 = c.name.toLowerCase().trim();
    const dist = levenshteinDistance(name1, name2);
    const maxLen = Math.max(name1.length, name2.length);
    const similarity = maxLen > 0 ? (maxLen - dist) / maxLen : 0;

    // Apply similarity boost for candidates with similar spelling (similarity >= 0.4)
    if (similarity >= 0.4) {
      weight += Math.pow(similarity, 2) * 15.0;
    }
    return {
      item: c,
      weight
    };
  });
  for (let step = 0; step < count; step++) {
    if (candidates.length === 0) break;
    const totalWeight = candidates.reduce((sum, c) => sum + c.weight, 0);
    let r = Math.random() * totalWeight;
    let chosenIndex = 0;
    for (let i = 0; i < candidates.length; i++) {
      r -= candidates[i].weight;
      if (r <= 0) {
        chosenIndex = i;
        break;
      }
    }
    selected.push(candidates[chosenIndex].item);
    candidates.splice(chosenIndex, 1);
  }
  return selected;
}
function chemNextQuestion() {
  const targetName = UnifiedQuestionEngine.selectTarget(chemMyData.myList, chemMyData.stats, chemLastPracticeName);
  if (!targetName) return;
  chemLastPracticeName = targetName;
  const targetObj = chemAllCompounds.find(c => c.name === targetName);
  if (!targetObj) return;
  const mode = UnifiedQuestionEngine.decideFormat('common-names', targetName, chemMyData.stats);
  const optionsDiv = document.getElementById('chem-practice-options');
  optionsDiv.innerHTML = '';

  // Default class list and display resets
  optionsDiv.className = 'chem-options-grid';
  const canvasWrap = document.querySelector('#chem-view-practice .chem-canvas-wrap');
  if (canvasWrap) canvasWrap.style.display = 'flex';
  if (mode === 'text') {
    // 1. Text input mode
    chemDrawStructure(targetObj.smiles, 'chem-practice-canvas');
    document.getElementById('chem-practice-hint').textContent = 'Type the name of this compound';
    optionsDiv.innerHTML = `
        <div style="width: 100%; display: flex; flex-direction: column; gap: 12px; margin-top: 10px; grid-column: span 2;">
          <input type="text" id="chem-practice-text-input" placeholder="Type compound name..." style="width: 100%; padding: 12px 16px; border: 1px solid var(--border); border-radius: 10px; background: var(--bg3); color: var(--text); font-family: 'DM Sans', sans-serif; font-size: 14px; outline: none; transition: border-color 0.2s;" autocomplete="off" />
          <button class="chem-btn chem-btn-primary" id="chem-practice-text-submit" style="width: 100%; height: 42px; font-size: 14px; font-weight: 700; border-radius: 10px; cursor: pointer;">Submit</button>
        </div>
      `;
    const txtInput = document.getElementById('chem-practice-text-input');
    const submitBtn = document.getElementById('chem-practice-text-submit');
    txtInput.onfocus = () => {
      txtInput.style.borderColor = 'var(--accent)';
    };
    txtInput.onblur = () => {
      txtInput.style.borderColor = 'var(--border)';
    };
    const handleSubmit = () => {
      const val = txtInput.value;
      chemHandleTextAnswer(val, targetName);
    };
    submitBtn.onclick = handleSubmit;
    txtInput.onkeydown = e => {
      if (e.key === 'Enter') handleSubmit();
    };
    setTimeout(() => txtInput.focus(), 100);
  } else if (mode === 'reverse') {
    // 2. Reverse MCQ: Name to structure
    // Hide main structure canvas
    if (canvasWrap) canvasWrap.style.display = 'none';
    document.getElementById('chem-practice-hint').innerHTML = `Identify structure for: <strong style="color:var(--accent); font-weight:700;">${escapeHtml(targetName)}</strong>`;
    const distractorArr = chemGetWeightedDistractors(targetObj, 1);
    const distractorObj = distractorArr[0] || chemAllCompounds.find(c => c.name !== targetName);
    const options = [targetObj, distractorObj].sort(() => 0.5 - Math.random());
    const letters = ['A', 'B'];
    optionsDiv.classList.add('chem-reverse-layout');
    options.forEach((opt, i) => {
      const btn = document.createElement('button');
      btn.className = 'chem-opt-btn-structure';
      btn.dataset.option = opt.name;
      btn.innerHTML = `
          <span class="chem-opt-letter" style="position: absolute; top: 10px; left: 10px;">${letters[i]}</span>
          <canvas id="chem-opt-canvas-${i}" style="width: 100%; height: 120px;"></canvas>
        `;
      btn.onclick = () => chemHandleAnswer(opt.name, targetName);
      optionsDiv.appendChild(btn);

      // Draw inside options canvases
      setTimeout(() => {
        chemDrawStructure(opt.smiles, `chem-opt-canvas-${i}`);
      }, 0);
    });
  } else {
    // 3. Normal MCQ: Structure to name
    chemDrawStructure(targetObj.smiles, 'chem-practice-canvas');
    document.getElementById('chem-practice-hint').textContent = 'Identify the compound';
    const distractorObjs = chemGetWeightedDistractors(targetObj, 3);
    const distractors = distractorObjs.map(c => c.name);
    const options = [targetName, ...distractors].sort(() => 0.5 - Math.random());
    const letters = ['A', 'B', 'C', 'D'];
    options.forEach((opt, i) => {
      const btn = document.createElement('button');
      btn.className = 'chem-opt-btn';
      btn.dataset.option = opt;
      btn.innerHTML = `<span class="chem-opt-letter">${letters[i]}</span><span>${escapeHtml(opt)}</span>`;
      btn.onclick = () => chemHandleAnswer(opt, targetName);
      optionsDiv.appendChild(btn);
    });
  }
}
function chemHandleAnswer(chosen, correct) {
  const btns = document.querySelectorAll('.chem-opt-btn, .chem-opt-btn-structure');
  btns.forEach(b => b.disabled = true);
  chemEnsureDailyStats();
  const today = chemTodayKey();
  if (!chemMyData.dailyStats[today]) {
    chemMyData.dailyStats[today] = {
      correct: 0,
      wrong: 0,
      attempted: 0,
      timeSpent: 0
    };
  }
  if (!chemMyData.stats[correct]) {
    chemMyData.stats[correct] = {
      wrong: 0,
      correct: 0,
      streak: 0,
      lastSeen: 0
    };
  }
  chemPracticeSessionCount++;
  const isCorrect = chosen === correct;
  chemMyData.dailyStats[today].attempted = (chemMyData.dailyStats[today].attempted || 0) + 1;
  if (isCorrect) {
    chemMyData.dailyStats[today].correct = (chemMyData.dailyStats[today].correct || 0) + 1;
    chemPracticeCorrectCount++;
    chemMyData.stats[correct].correct = (chemMyData.stats[correct].correct || 0) + 1;
    chemMyData.stats[correct].streak = (chemMyData.stats[correct].streak || 0) + 1;
    chemShowFlash('Correct', false);
  } else {
    chemMyData.dailyStats[today].wrong = (chemMyData.dailyStats[today].wrong || 0) + 1;
    chemMyData.stats[correct].wrong = (chemMyData.stats[correct].wrong || 0) + 1;
    chemMyData.stats[correct].streak = 0;
    chemShowFlash('Wrong', true);
  }
  chemMyData.stats[correct].lastSeen = Date.now();
  chemSave();
  chemSyncAll(false);
  btns.forEach(b => {
    const optVal = b.dataset.option || b.innerText.replace(/^[A-D]/, '').trim();
    if (optVal === correct) b.classList.add(isCorrect ? 'correct' : 'reveal');
    if (optVal === chosen && !isCorrect) b.classList.add('wrong');
  });
  document.getElementById('chem-practice-hint').textContent = isCorrect ? "That's right" : `It was: ${correct}`;
  setTimeout(chemNextQuestion, isCorrect ? 1200 : 1800);
}
function chemHandleTextAnswer(chosen, correct) {
  const txtInput = document.getElementById('chem-practice-text-input');
  const submitBtn = document.getElementById('chem-practice-text-submit');
  if (txtInput) txtInput.disabled = true;
  if (submitBtn) submitBtn.disabled = true;
  chemEnsureDailyStats();
  const today = chemTodayKey();
  if (!chemMyData.dailyStats[today]) {
    chemMyData.dailyStats[today] = {
      correct: 0,
      wrong: 0,
      attempted: 0,
      timeSpent: 0
    };
  }
  if (!chemMyData.stats[correct]) {
    chemMyData.stats[correct] = {
      wrong: 0,
      correct: 0,
      streak: 0,
      lastSeen: 0
    };
  }
  chemPracticeSessionCount++;
  const isCorrect = isSpellCheckedCorrect(chosen, correct);
  chemMyData.dailyStats[today].attempted = (chemMyData.dailyStats[today].attempted || 0) + 1;
  if (isCorrect) {
    chemMyData.dailyStats[today].correct = (chemMyData.dailyStats[today].correct || 0) + 1;
    chemPracticeCorrectCount++;
    chemMyData.stats[correct].correct = (chemMyData.stats[correct].correct || 0) + 1;
    chemMyData.stats[correct].streak = (chemMyData.stats[correct].streak || 0) + 1;
    const exactMatch = chosen.toLowerCase().trim().replace(/[^a-z0-9]/g, '') === correct.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
    if (exactMatch) {
      chemShowFlash('Correct', false);
    } else {
      chemShowFlash(`Correct (Spelled: ${correct})`, false);
    }
  } else {
    chemMyData.dailyStats[today].wrong = (chemMyData.dailyStats[today].wrong || 0) + 1;
    chemMyData.stats[correct].wrong = (chemMyData.stats[correct].wrong || 0) + 1;
    chemMyData.stats[correct].streak = 0;
    chemShowFlash('Wrong', true);
  }
  chemMyData.stats[correct].lastSeen = Date.now();
  chemSave();
  chemSyncAll(false);
  if (txtInput) {
    txtInput.style.borderColor = isCorrect ? '#22c55e' : '#ef4444';
    txtInput.style.background = isCorrect ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)';
    txtInput.style.color = isCorrect ? '#22c55e' : '#ef4444';
  }
  document.getElementById('chem-practice-hint').textContent = isCorrect ? "That's right" : `It was: ${correct}`;
  setTimeout(chemNextQuestion, isCorrect ? 1200 : 1800);
}
function chemWizardNextQuestion() {
  if (chemWizardIdx >= chemWizardQueue.length) {
    chemWizardShowCompleted();
    return;
  }
  const targetName = chemWizardQueue[chemWizardIdx];
  const canvasWrap = document.querySelector('#chem-view-practice .chem-canvas-wrap');
  if (canvasWrap) canvasWrap.style.display = 'none';
  document.getElementById('chem-practice-hint').innerHTML = `Draw structure for: <strong style="color:var(--accent); font-size:16px; font-weight:700;">${escapeHtml(targetName)}</strong>`;
  const optionsDiv = document.getElementById('chem-practice-options');
  optionsDiv.className = 'chem-options-grid';
  optionsDiv.innerHTML = `
      <div style="width: 100%; display: flex; flex-direction: column; gap: 12px; margin-top: 10px; grid-column: span 2;">
        <button class="chem-btn chem-btn-primary" id="chem-wizard-done-btn" style="width: 100%; height: 50px; font-size: 16px; font-weight: 700; border-radius: 10px; cursor: pointer;">Done</button>
      </div>
    `;
  document.getElementById('chem-wizard-done-btn').onclick = () => {
    chemWizardRevealStructure(targetName);
  };
}
function chemWizardRevealStructure(targetName) {
  const canvasWrap = document.querySelector('#chem-view-practice .chem-canvas-wrap');
  if (canvasWrap) canvasWrap.style.display = 'flex';
  const targetObj = chemAllCompounds.find(c => c.name === targetName);
  if (targetObj) {
    chemDrawStructure(targetObj.smiles, 'chem-practice-canvas');
  }
  document.getElementById('chem-practice-hint').innerHTML = `Structure for: <strong style="color:var(--accent); font-size:16px; font-weight:700;">${escapeHtml(targetName)}</strong>`;
  const optionsDiv = document.getElementById('chem-practice-options');
  optionsDiv.innerHTML = `
      <div style="width: 100%; display: flex; flex-direction: column; align-items: center; gap: 14px; margin-top: 10px; grid-column: span 2;">
        <div style="font-size: 14px; font-weight: 500; color: var(--text2);">My structure was...</div>
        <div style="display: flex; width: 100%; gap: 12px;">
          <button class="chem-btn" id="chem-wizard-correct-btn" style="flex: 1; height: 50px; font-size: 15px; font-weight: 700; border-radius: 10px; cursor: pointer; background: rgba(34,197,94,0.15); border: 2px solid #22c55e; color: #22c55e;">Correct</button>
          <button class="chem-btn" id="chem-wizard-wrong-btn" style="flex: 1; height: 50px; font-size: 15px; font-weight: 700; border-radius: 10px; cursor: pointer; background: rgba(239,68,68,0.15); border: 2px solid #ef4444; color: #ef4444;">Wrong</button>
        </div>
      </div>
    `;
  document.getElementById('chem-wizard-correct-btn').onclick = () => {
    chemWizardSubmitAnswer(targetName, true);
  };
  document.getElementById('chem-wizard-wrong-btn').onclick = () => {
    chemWizardSubmitAnswer(targetName, false);
  };
}
function chemWizardSubmitAnswer(targetName, isCorrect) {
  const correctBtn = document.getElementById('chem-wizard-correct-btn');
  const wrongBtn = document.getElementById('chem-wizard-wrong-btn');
  if (correctBtn) correctBtn.disabled = true;
  if (wrongBtn) wrongBtn.disabled = true;
  chemEnsureDailyStats();
  const today = chemTodayKey();
  if (!chemMyData.dailyStats[today]) {
    chemMyData.dailyStats[today] = {
      correct: 0,
      wrong: 0,
      attempted: 0,
      timeSpent: 0
    };
  }
  if (!chemMyData.stats[targetName]) {
    chemMyData.stats[targetName] = {
      wrong: 0,
      correct: 0,
      streak: 0,
      lastSeen: 0
    };
  }
  chemPracticeSessionCount++;
  chemMyData.dailyStats[today].attempted = (chemMyData.dailyStats[today].attempted || 0) + 1;
  if (isCorrect) {
    chemMyData.dailyStats[today].correct = (chemMyData.dailyStats[today].correct || 0) + 1;
    chemPracticeCorrectCount++;
    chemMyData.stats[targetName].correct = (chemMyData.stats[targetName].correct || 0) + 1;
    chemMyData.stats[targetName].streak = (chemMyData.stats[targetName].streak || 0) + 1;
    chemShowFlash('Correct', false);
  } else {
    chemMyData.dailyStats[today].wrong = (chemMyData.dailyStats[today].wrong || 0) + 1;
    chemMyData.stats[targetName].wrong = (chemMyData.stats[targetName].wrong || 0) + 1;
    chemMyData.stats[targetName].streak = 0;
    chemShowFlash('Wrong', true);
  }
  chemMyData.stats[targetName].lastSeen = Date.now();
  chemSave();
  chemSyncAll(false);
  chemWizardIdx++;
  setTimeout(chemWizardNextQuestion, 1000);
}
function chemWizardShowCompleted() {
  const canvasWrap = document.querySelector('#chem-view-practice .chem-canvas-wrap');
  if (canvasWrap) canvasWrap.style.display = 'none';
  document.getElementById('chem-practice-hint').innerHTML = `<span style="font-size: 20px; font-weight: 700; color: var(--accent);">Run Complete!</span>`;
  const optionsDiv = document.getElementById('chem-practice-options');
  const percent = chemPracticeSessionCount > 0 ? Math.round(chemPracticeCorrectCount / chemPracticeSessionCount * 100) : 0;
  optionsDiv.innerHTML = `
      <div style="width: 100%; display: flex; flex-direction: column; align-items: center; gap: 16px; padding: 20px 10px; grid-column: span 2; text-align: center;">
        <div style="font-size: 48px; font-weight: 800; color: var(--accent); margin-bottom: 8px;">${percent}%</div>
        <div style="font-size: 15px; font-weight: 500; color: var(--text2);">You got <strong>${chemPracticeCorrectCount}</strong> out of <strong>${chemPracticeSessionCount}</strong> compounds correct!</div>
        <div style="font-size: 12px; color: var(--text3); max-width: 300px;">Every compound in your list was tested exactly once without repetition.</div>
        <button class="chem-btn chem-btn-primary" onclick="chemGoHome()" style="width: 100%; max-width: 240px; height: 42px; font-size: 14px; font-weight: 700; border-radius: 8px; margin-top: 10px; cursor: pointer;">Back to Menu</button>
      </div>
    `;
}
async function chemSyncAll(showFeedback = false) {
  if (hasPracticeAccessCache === false) return false;
  if (!chemAppReady) return false;
  chemSyncQueue = chemSyncQueue.catch(() => {}).then(async () => {
    const client = await chemEnsureSupabase();
    if (!client) {
      if (showFeedback) chemShowToast("Leaderboard offline.");
      return false;
    }
    const userId = chemCurrentUserName();
    let failed = false;

    // 1. Sync Progress (chem_user_progress)
    try {
      const {
        data: existingRows,
        error: lookupError
      } = await client.from('chem_user_progress').select('*').eq('user_id', userId);
      if (lookupError) {
        console.error("Progress sync error:", lookupError);
        failed = true;
      } else {
        let shouldUpload = true;
        let duplicatesCleaned = false;
        let existing = null;
        if (existingRows && existingRows.length > 0) {
          // Sort by updated_at descending to find the latest row
          existingRows.sort((a, b) => new Date(b.updated_at || 0) - new Date(a.updated_at || 0));
          existing = existingRows[0];
          if (existingRows.length > 1) {
            console.warn(`Cleaning up ${existingRows.length - 1} duplicate progress entries for user ${userId}`);
            const {
              error: deleteError
            } = await client.from('chem_user_progress').delete().eq('user_id', userId);
            if (deleteError) {
              console.error("Failed to delete duplicates:", deleteError);
            } else {
              duplicatesCleaned = true;
            }
          }
        }
        if (existing) {
          const localProgress = chemCombinedData;
          const cloudProgress = chemNormalizeProgressData({
            myList: existing.my_list,
            stats: existing.compound_stats,
            dailyStats: existing.daily_stats
          });
          let isCloudNewer = false;
          let isLocalNewer = false;
          const localUpdatedAtStr = localStorage.getItem(getUserStorageKey('chem_progress_updated_at'));
          const cloudUpdatedAtStr = existing.updated_at;
          if (localUpdatedAtStr && cloudUpdatedAtStr) {
            const localTime = new Date(localUpdatedAtStr).getTime();
            const cloudTime = new Date(cloudUpdatedAtStr).getTime();
            if (cloudTime > localTime) {
              isCloudNewer = true;
            } else if (localTime > cloudTime) {
              isLocalNewer = true;
            }
          } else {
            // Migration fallback
            const localAttempted = chemProgressAttemptedTotal(localProgress);
            const cloudAttempted = chemProgressAttemptedTotal(cloudProgress);
            if (cloudAttempted > localAttempted) {
              isCloudNewer = true;
            } else if (localAttempted > cloudAttempted) {
              isLocalNewer = true;
            }
          }
          if (isCloudNewer) {
            chemCombinedData = cloudProgress;
            chemMyData = chemCombinedData.compounds;
            reagentMyData = chemCombinedData.reagents;
            pkaMyData = chemCombinedData.pka || {
              myList: [],
              stats: {}
            };
            chemEnsureDailyStats();
            localStorage.setItem(getUserStorageKey(CHEM_DATA_KEY), JSON.stringify(chemCombinedData));
            localStorage.setItem(getUserStorageKey('reagent_v1_data'), JSON.stringify(reagentMyData));
            if (existing.updated_at) localStorage.setItem(getUserStorageKey('chem_progress_updated_at'), existing.updated_at);
            shouldUpload = duplicatesCleaned;
          } else if (!isLocalNewer && !duplicatesCleaned) {
            shouldUpload = false;
          }
        }
        if (shouldUpload) {
          const payload = chemBuildProgressPayload();
          const {
            error: uploadError
          } = await client.from('chem_user_progress').upsert(payload, {
            onConflict: 'user_id'
          });
          if (uploadError) {
            console.error("Progress upload error:", uploadError);
            failed = true;
          } else if (payload.updated_at) {
            localStorage.setItem(getUserStorageKey('chem_progress_updated_at'), payload.updated_at);
          }
        }
      }
    } catch (err) {
      console.error("Progress sync exception:", err);
      failed = true;
    }

    // 2. Sync Leaderboard Stats (leaderboard_stats)
    try {
      const recentStart = chemRecentStartKey(7);
      const dailyEntries = Object.entries(chemMyData.dailyStats || {}).filter(([date, stats]) => date >= recentStart && stats && Number(stats.attempted || 0) > 0).sort(([a], [b]) => a.localeCompare(b));
      for (const [statDate, stats] of dailyEntries) {
        const payload = chemBuildDailyPayload(statDate, stats);

        // Deduplicate leaderboard entries
        const {
          data: existingDailyRows,
          error: lookupDailyError
        } = await client.from('leaderboard_stats').select('*').eq('user_id', userId).eq('stat_date', statDate);
        if (!lookupDailyError && existingDailyRows && existingDailyRows.length > 1) {
          console.warn(`Cleaning up ${existingDailyRows.length - 1} duplicate leaderboard entries for user ${userId} on date ${statDate}`);
          await client.from('leaderboard_stats').delete().eq('user_id', userId).eq('stat_date', statDate);
        }
        const {
          error: upsertError
        } = await client.from('leaderboard_stats').upsert(payload, {
          onConflict: 'user_id,stat_date'
        });
        if (upsertError) {
          console.error("Leaderboard upsert error:", upsertError);
          failed = true;
        }
      }
    } catch (err) {
      console.error("Leaderboard sync exception:", err);
      failed = true;
    }

    // 3. UI Updates
    if (showFeedback) {
      if (failed) chemShowToast("Some cloud stats failed.");else chemShowToast("Stats uploaded.");
    }
    if (!failed) {
      var _document$getElementB;
      chemLoadLeaderboard((_document$getElementB = document.getElementById('chem-board-week')) !== null && _document$getElementB !== void 0 && _document$getElementB.classList.contains('active') ? 'week' : 'today');
    }
    return !failed;
  });
  return chemSyncQueue;
}
async function chemDownloadProgress(force = false) {
  if (hasPracticeAccessCache === false) return false;
  const client = await chemEnsureSupabase();
  if (!client || !navigator.onLine) return false;
  const userId = chemCurrentUserName();
  const {
    data: existingRows,
    error
  } = await client.from('chem_user_progress').select('*').eq('user_id', userId);
  if (error) {
    console.error(error);
    return false;
  }
  if (!existingRows || existingRows.length === 0) return false;
  existingRows.sort((a, b) => new Date(b.updated_at || 0) - new Date(a.updated_at || 0));
  const data = existingRows[0];
  if (existingRows.length > 1) {
    console.warn(`Cleaning up ${existingRows.length - 1} duplicate progress entries during download for user ${userId}`);
    const {
      error: deleteError
    } = await client.from('chem_user_progress').delete().eq('user_id', userId);
    if (!deleteError) {
      const payload = {
        user_id: userId,
        username: data.username || (sessionStorage.getItem('fy_user_name') || 'Student').trim() || 'Student',
        my_list: data.my_list,
        compound_stats: data.compound_stats,
        daily_stats: data.daily_stats,
        updated_at: data.updated_at || new Date().toISOString()
      };
      await client.from('chem_user_progress').upsert(payload, {
        onConflict: 'user_id'
      });
    }
  }
  const localProgress = chemCombinedData;
  const cloudProgress = chemNormalizeProgressData({
    myList: data.my_list,
    stats: data.compound_stats,
    dailyStats: data.daily_stats
  });
  let isCloudNewer = false;
  const localUpdatedAtStr = localStorage.getItem(getUserStorageKey('chem_progress_updated_at'));
  const cloudUpdatedAtStr = data.updated_at;
  if (localUpdatedAtStr && cloudUpdatedAtStr) {
    isCloudNewer = new Date(cloudUpdatedAtStr).getTime() > new Date(localUpdatedAtStr).getTime();
  } else {
    const localAttempted = chemProgressAttemptedTotal(localProgress);
    const cloudAttempted = chemProgressAttemptedTotal(cloudProgress);
    isCloudNewer = cloudAttempted > localAttempted;
  }
  if (isCloudNewer || force) {
    chemCombinedData = cloudProgress;
    chemMyData = chemCombinedData.compounds;
    reagentMyData = chemCombinedData.reagents;
    pkaMyData = chemCombinedData.pka || {
      myList: [],
      stats: {}
    };
    chemEnsureDailyStats();
    localStorage.setItem(getUserStorageKey(CHEM_DATA_KEY), JSON.stringify(chemCombinedData));
    localStorage.setItem(getUserStorageKey('reagent_v1_data'), JSON.stringify(reagentMyData));
    if (data.updated_at) localStorage.setItem(getUserStorageKey('chem_progress_updated_at'), data.updated_at);else localStorage.setItem(getUserStorageKey('chem_progress_updated_at'), new Date().toISOString());
    return true;
  }
  return false;
}
window.syncCloudProgress = async function syncCloudProgress() {
  if (hasPracticeAccessCache === false) {
    if (navigator.onLine) chemShowToast('Practice mode disabled.');
    settingsOperationStatus('Practice mode is disabled for this account.', 'error');
    return;
  }
  if (!navigator.onLine) {
    chemShowToast('You are offline.');
    settingsOperationStatus('Offline. Connect to the internet before syncing.', 'error');
    return;
  }
  const button = document.getElementById('settings-sync-btn');
  if (button) button.disabled = true;
  setSyncPill('live', 'Syncing cloud...');
  settingsOperationStatus('Syncing practice progress…');
  try {
    chemEnsureDailyStats();
    const synced = await chemSyncAll(true);
    if (!synced) throw new Error('Cloud sync failed');
    chemUpdateDashboard();
    reagentUpdateDashboard();
    setSyncPill('live', 'Cloud synced');
    settingsOperationStatus('Practice progress synced.', 'success');
  } catch (err) {
    console.error(err);
    setSyncPill('offline', 'Cloud sync failed');
    settingsOperationStatus('Cloud sync failed. Your local progress is still available.', 'error');
  } finally {
    if (button) button.disabled = false;
  }
};

async function chemLoadLeaderboard(period = 'today') {
  var _document$getElementB2, _document$getElementB3, _document$getElementB4, _document$getElementB5;
  const client = await chemEnsureSupabase();
  const list = document.getElementById('chem-board-today') ? document.getElementById('chem-leaderboard-list') : null;
  const reagentList = document.getElementById('reagent-leaderboard-list');
  if (!list && !reagentList) return;
  (_document$getElementB2 = document.getElementById('chem-board-today')) === null || _document$getElementB2 === void 0 || _document$getElementB2.classList.toggle('active', period === 'today');
  (_document$getElementB3 = document.getElementById('chem-board-week')) === null || _document$getElementB3 === void 0 || _document$getElementB3.classList.toggle('active', period === 'week');
  (_document$getElementB4 = document.getElementById('reagent-board-today')) === null || _document$getElementB4 === void 0 || _document$getElementB4.classList.toggle('active', period === 'today');
  (_document$getElementB5 = document.getElementById('reagent-board-week')) === null || _document$getElementB5 === void 0 || _document$getElementB5.classList.toggle('active', period === 'week');
  if (list) list.innerHTML = '<div class="empty">Loading leaderboard...</div>';
  if (reagentList) reagentList.innerHTML = '<div class="empty">Loading leaderboard...</div>';
  if (!client) {
    const offlineMsg = '<div class="empty">Leaderboard unavailable (offline or connection blocked).</div>';
    if (list) list.innerHTML = offlineMsg;
    if (reagentList) reagentList.innerHTML = offlineMsg;
    return;
  }
  const startDate = period === 'week' ? chemRecentStartKey(7) : chemTodayKey();
  let query = client.from('leaderboard_stats').select('user_id,username,stat_date,correct,wrong,attempted,time_spent,updated_at');
  if (period === 'today') {
    query = query.eq('stat_date', startDate);
  } else {
    query = query.gte('stat_date', startDate);
  }
  const {
    data,
    error
  } = await query;
  if (error) {
    console.error(error);
    const errMsg = '<div class="empty">Could not load leaderboard.</div>';
    if (list) list.innerHTML = errMsg;
    if (reagentList) reagentList.innerHTML = errMsg;
    return;
  }
  const rows = Object.values((data || []).reduce((acc, row) => {
    const key = row.user_id || row.username || 'unknown';
    if (!acc[key]) {
      acc[key] = {
        user_id: key,
        username: row.username || key,
        correct: 0,
        wrong: 0,
        attempted: 0,
        time_spent: 0
      };
    }
    acc[key].correct += Number(row.correct || 0);
    acc[key].wrong += Number(row.wrong || 0);
    acc[key].attempted += Number(row.attempted || 0);
    acc[key].time_spent += Number(row.time_spent || 0);
    return acc;
  }, {})).sort((a, b) => b.correct - a.correct || b.attempted - a.attempted).slice(0, 30);
  if (!rows.length) {
    const emptyMsg = `<div class="empty">No practice scores ${period === 'week' ? 'this week' : 'today'} yet.</div>`;
    if (list) list.innerHTML = emptyMsg;
    if (reagentList) reagentList.innerHTML = emptyMsg;
    return;
  }
  const html = rows.map((row, i) => `
      <div class="chem-board-row">
        <div class="chem-board-rank">#${i + 1}</div>
        <div class="chem-board-name">${escapeHtml(row.username || row.user_id || 'Student')}</div>
        <div class="chem-board-score">${Number(row.correct || 0)} C / ${Number(row.attempted || 0)} A</div>
      </div>
    `).join('');
  if (list) list.innerHTML = html;
  if (reagentList) reagentList.innerHTML = html;
}
function chemShowFlash(msg, isWrong) {
  const el = document.getElementById('chem-feedback-flash');
  if (!el) return;
  el.textContent = msg;
  el.className = 'chem-feedback-flash' + (isWrong ? ' wrong' : '');
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 900);
}
function chemShowToast(msg) {
  chemShowFlash(msg, false);
}
function chemExportData() {
  const blob = new Blob([JSON.stringify(chemCombinedData, null, 2)], {
    type: "application/json"
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = "chemmaster_progress.json";
  a.click();
  URL.revokeObjectURL(url);
}
function chemImportData(event) {
  var _event$target$files;
  const file = (_event$target$files = event.target.files) === null || _event$target$files === void 0 ? void 0 : _event$target$files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    try {
      const imported = JSON.parse(ev.target.result);
      if (imported && imported.compounds && imported.reagents) {
        chemCombinedData = imported;
      } else {
        chemCombinedData = chemMigrateOldData(imported);
      }
      chemMyData = chemCombinedData.compounds;
      reagentMyData = chemCombinedData.reagents;
      pkaMyData = chemCombinedData.pka || {
        myList: [],
        stats: {}
      };
      chemEnsureDailyStats();
      chemSave();
      chemSyncAll(false);
      chemShowToast("Progress imported.");
    } catch (_) {
      chemShowToast("Invalid import file.");
    }
  };
  reader.readAsText(file);
}
function chemShowStats(type) {
  const isWeak = type === 'weak';
  const sorted = [...chemMyData.myList].sort((a, b) => {
    const sA = chemMyData.stats[a] || {
      correct: 0,
      wrong: 0
    };
    const sB = chemMyData.stats[b] || {
      correct: 0,
      wrong: 0
    };
    if (isWeak) return sB.wrong - sB.correct - (sA.wrong - sA.correct);
    return sB.correct - sA.correct;
  });
  const top = sorted.slice(0, 5);
  const sheet = document.getElementById('chem-stats-sheet');
  const list = document.getElementById('chem-stats-list');
  document.getElementById('chem-stats-title').textContent = isWeak ? 'Weakest Compounds' : 'Strongest Compounds';
  list.innerHTML = top.length ? top.map((name, i) => {
    const s = chemMyData.stats[name] || {
      correct: 0,
      wrong: 0,
      streak: 0
    };
    return `<div class="chem-stat-row"><span class="chem-stat-name">${i + 1}. ${escapeHtml(name)}</span><span class="chem-stat-val">C ${s.correct || 0} / W ${s.wrong || 0} / S ${s.streak || 0}</span></div>`;
  }).join('') : '<div class="chem-stat-row"><span class="chem-stat-name">No data yet</span></div>';
  sheet.classList.add('open');
}
function chemCloseStats(event) {
  if (event.target.id === 'chem-stats-sheet') {
    document.getElementById('chem-stats-sheet').classList.remove('open');
  }
}

