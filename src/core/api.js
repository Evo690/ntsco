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

