(function () {
  const DEFAULT_PAGE_SIZE = 100;
  function assertPortalReady() {
    if (typeof API_CONFIG === 'undefined' || typeof API_ENDPOINTS === 'undefined') {
      throw new Error('Portal API globals are not loaded. Load this after core.js.');
    }
    if (typeof loginProxyFetch !== 'function' || typeof authHeaders !== 'function') {
      throw new Error('Portal fetch helpers are not loaded. Load this after core.js.');
    }
    if (!API_CONFIG.token) {
      throw new Error('Login first, then run the scraper from the browser console.');
    }
  }
  function unique(values) {
    return [...new Set(values.map(Number).filter(Number.isFinite))].sort((a, b) => a - b);
  }
  function getDefaultYears() {
    const fromSelectors = [...document.querySelectorAll('#exam-year-selector option, #era-year-selector option, #tt-year-selector option')].map(option => option.value);
    const currentYear = new Date().getFullYear();
    const broadRange = Array.from({
      length: currentYear - 2020 + 2
    }, (_, i) => 2020 + i);
    return unique([...fromSelectors, ...broadRange]);
  }
  function getYearsFromOptions(options) {
    var _options$years;
    if ((_options$years = options.years) !== null && _options$years !== void 0 && _options$years.length) return unique(options.years);
    const startYear = Number(options.startYear);
    const endYear = Number(options.endYear);
    if (Number.isFinite(startYear) && Number.isFinite(endYear) && endYear >= startYear) {
      return unique(Array.from({
        length: endYear - startYear + 1
      }, (_, i) => startYear + i));
    }
    return getDefaultYears();
  }
  async function readJsonResponse(res) {
    let json = null;
    try {
      json = await res.json();
    } catch (_) {
      json = null;
    }
    return json;
  }
  async function fetchTestsPageForYear(year, pageNumber, pageSize) {
    var _json$data, _json$data$totalRecor, _json$data2;
    const res = await loginProxyFetch(API_ENDPOINTS.tests, {
      method: 'POST',
      headers: authHeaders(API_CONFIG.token),
      body: JSON.stringify({
        searchKey: '',
        pageNumber,
        pageSize,
        id: 0,
        academicYear: String(year)
      })
    });
    if (!res.ok) {
      throw new Error(`GetTests failed for ${year}, page ${pageNumber}: HTTP ${res.status}`);
    }
    const json = await readJsonResponse(res);
    return {
      raw: json,
      tests: Array.isArray(json === null || json === void 0 || (_json$data = json.data) === null || _json$data === void 0 ? void 0 : _json$data.result) ? json.data.result : [],
      total: Number((_json$data$totalRecor = json === null || json === void 0 || (_json$data2 = json.data) === null || _json$data2 === void 0 ? void 0 : _json$data2.totalRecord) !== null && _json$data$totalRecor !== void 0 ? _json$data$totalRecor : 0)
    };
  }
  async function fetchAllTestsForYear(year, pageSize) {
    const first = await fetchTestsPageForYear(year, 1, pageSize);
    const tests = [...first.tests];
    const total = first.total || tests.length;
    const pageCount = Math.max(1, Math.ceil(total / pageSize));
    for (let page = 2; page <= pageCount; page += 1) {
      const next = await fetchTestsPageForYear(year, page, pageSize);
      tests.push(...next.tests);
      console.log(`[test-scraper] ${year}: loaded page ${page}/${pageCount}`);
    }
    return {
      year,
      total,
      tests
    };
  }
  async function fetchAppeared(testId) {
    var _json$data3;
    if (!testId) return null;
    if (typeof fetchAppearedResult === 'function') {
      return fetchAppearedResult(API_CONFIG.token, testId);
    }
    const res = await loginProxyFetch(API_ENDPOINTS.appearedResult, {
      method: 'POST',
      headers: authHeaders(API_CONFIG.token),
      body: JSON.stringify({
        id: testId,
        pageNumber: 1,
        pageSize: 10
      })
    });
    if (!res.ok) return null;
    const json = await readJsonResponse(res);
    return (json === null || json === void 0 || (_json$data3 = json.data) === null || _json$data3 === void 0 || (_json$data3 = _json$data3.result) === null || _json$data3 === void 0 ? void 0 : _json$data3[0]) || null;
  }
  async function fetchAnalysis(examId) {
    if (!examId) return null;
    if (typeof fetchResultAnalysis === 'function') {
      return fetchResultAnalysis(API_CONFIG.token, examId);
    }
    const res = await loginProxyFetch(API_ENDPOINTS.resultAnalysis(examId), {
      headers: authHeaders(API_CONFIG.token)
    });
    if (!res.ok) return null;
    const json = await readJsonResponse(res);
    return (json === null || json === void 0 ? void 0 : json.data) || null;
  }
  async function fetchLeaderboard(testPaperId) {
    if (!testPaperId) return null;
    if (typeof fetchLeaderboardScore === 'function') {
      return fetchLeaderboardScore(API_CONFIG.token, testPaperId);
    }
    const res = await loginProxyFetch(API_ENDPOINTS.leaderboardScore, {
      method: 'POST',
      headers: authHeaders(API_CONFIG.token),
      body: JSON.stringify({
        id: Number(testPaperId) || testPaperId
      })
    });
    if (!res.ok) return null;
    const json = await readJsonResponse(res);
    return (json === null || json === void 0 ? void 0 : json.data) || null;
  }
  function summarizeResult(test, appeared, analysis, leaderboard, onlyLeaderboard = false) {
    var _test$id, _ref, _test$testPaperId, _appeared$examId, _test$academicYear, _ref2, _result$totalMarks, _ref3, _result$totalSubjectM, _ref4, _analysis$rank, _ref5, _analysis$batchRank, _ref6, _result$percentage;
    const result = (analysis === null || analysis === void 0 ? void 0 : analysis.result) || {};
    const base = {
      testName: (analysis === null || analysis === void 0 ? void 0 : analysis.testName) || (test === null || test === void 0 ? void 0 : test.testName) || (test === null || test === void 0 ? void 0 : test.name) || '',
      testId: (_test$id = test === null || test === void 0 ? void 0 : test.id) !== null && _test$id !== void 0 ? _test$id : null,
      testPaperId: (_ref = (_test$testPaperId = test === null || test === void 0 ? void 0 : test.testPaperId) !== null && _test$testPaperId !== void 0 ? _test$testPaperId : analysis === null || analysis === void 0 ? void 0 : analysis.testPaperId) !== null && _ref !== void 0 ? _ref : null,
      academicYear: (_test$academicYear = test === null || test === void 0 ? void 0 : test.academicYear) !== null && _test$academicYear !== void 0 ? _test$academicYear : null,
      examDate: (test === null || test === void 0 ? void 0 : test.examDate) || (test === null || test === void 0 ? void 0 : test.testDate) || (test === null || test === void 0 ? void 0 : test.startDate) || null,
      isPublish: Boolean(test === null || test === void 0 ? void 0 : test.isPublish),
      syllabus: (test === null || test === void 0 ? void 0 : test.syllabus) || null,
      leaderboard: Array.isArray(leaderboard === null || leaderboard === void 0 ? void 0 : leaderboard.leaderboardScore) ? leaderboard.leaderboardScore : []
    };

    if (onlyLeaderboard) {
      return base;
    }

    return {
      ...base,
      examId: (_appeared$examId = appeared === null || appeared === void 0 ? void 0 : appeared.examId) !== null && _appeared$examId !== void 0 ? _appeared$examId : null,
      totalMarks: (_ref2 = (_result$totalMarks = result === null || result === void 0 ? void 0 : result.totalMarks) !== null && _result$totalMarks !== void 0 ? _result$totalMarks : appeared === null || appeared === void 0 ? void 0 : appeared.totalMarks) !== null && _ref2 !== void 0 ? _ref2 : null,
      totalSubjectMarks: (_ref3 = (_result$totalSubjectM = result === null || result === void 0 ? void 0 : result.totalSubjectMarks) !== null && _result$totalSubjectM !== void 0 ? _result$totalSubjectM : appeared === null || appeared === void 0 ? void 0 : appeared.totalSubjectMarks) !== null && _ref3 !== void 0 ? _ref3 : null,
      rank: (_ref4 = (_analysis$rank = analysis === null || analysis === void 0 ? void 0 : analysis.rank) !== null && _analysis$rank !== void 0 ? _analysis$rank : appeared === null || appeared === void 0 ? void 0 : appeared.rank) !== null && _ref4 !== void 0 ? _ref4 : null,
      batchRank: (_ref5 = (_analysis$batchRank = analysis === null || analysis === void 0 ? void 0 : analysis.batchRank) !== null && _analysis$batchRank !== void 0 ? _analysis$batchRank : appeared === null || appeared === void 0 ? void 0 : appeared.batchRank) !== null && _ref5 !== void 0 ? _ref5 : null,
      percentage: (_ref6 = (_result$percentage = result === null || result === void 0 ? void 0 : result.percentage) !== null && _result$percentage !== void 0 ? _result$percentage : appeared === null || appeared === void 0 ? void 0 : appeared.percentage) !== null && _ref6 !== void 0 ? _ref6 : null,
      subjectWise: Array.isArray(result === null || result === void 0 ? void 0 : result.subjectData) ? result.subjectData : Array.isArray(result === null || result === void 0 ? void 0 : result.subjectWiseResult) ? result.subjectWiseResult : Array.isArray(analysis === null || analysis === void 0 ? void 0 : analysis.subjectWiseResult) ? analysis.subjectWiseResult : []
    };
  }
  function isValidCleanerTest(name) {
    if (!name) return false;
    const upper = String(name).toUpperCase();
    return upper.includes('INTERNAL TEST') || upper.includes('NATIONAL TEST');
  }
  function findSubjectResult(subjects, subjectName) {
    const needle = String(subjectName || '').toLowerCase();
    return subjects.find(subject => String((subject === null || subject === void 0 ? void 0 : subject.subjectName) || (subject === null || subject === void 0 ? void 0 : subject.name) || '').toLowerCase() === needle) || null;
  }
  function normalizeSubject(subject) {
    var _ref7, _ref8, _subject$totalMarks, _subject$percentile, _ref9, _ref0, _subject$totalAvgMark, _ref1, _ref10, _subject$highestMarks;
    if (!subject) return null;
    return {
      score: (_ref7 = (_ref8 = (_subject$totalMarks = subject.totalMarks) !== null && _subject$totalMarks !== void 0 ? _subject$totalMarks : subject.marks) !== null && _ref8 !== void 0 ? _ref8 : subject.score) !== null && _ref7 !== void 0 ? _ref7 : null,
      percentile: (_subject$percentile = subject.percentile) !== null && _subject$percentile !== void 0 ? _subject$percentile : null,
      avg: (_ref9 = (_ref0 = (_subject$totalAvgMark = subject.totalAvgMarks) !== null && _subject$totalAvgMark !== void 0 ? _subject$totalAvgMark : subject.totalAvg) !== null && _ref0 !== void 0 ? _ref0 : subject.avg) !== null && _ref9 !== void 0 ? _ref9 : null,
      topper: (_ref1 = (_ref10 = (_subject$highestMarks = subject.highestMarks) !== null && _subject$highestMarks !== void 0 ? _subject$highestMarks : subject.totalHighest) !== null && _ref10 !== void 0 ? _ref10 : subject.topper) !== null && _ref1 !== void 0 ? _ref1 : null
    };
  }
  function cleanScrapedTestsData(rawData) {
    const cleaned = [];
    for (const test of (rawData === null || rawData === void 0 ? void 0 : rawData.tests) || []) {
      try {
        var _test$raw, _test$summary, _ref11, _analysis$rank2, _test$summary2, _test$summary3, _ref12, _result$totalMarks2, _test$summary4, _ref13, _result$totalSubjectM2, _test$summary5, _result$totalAvg, _result$totalHighest, _ref14, _analysis$percentile;
        if (!isValidCleanerTest(test.testName)) continue;
        const analysis = (_test$raw = test.raw) === null || _test$raw === void 0 ? void 0 : _test$raw.analysis;
        const result = analysis === null || analysis === void 0 ? void 0 : analysis.result;
        if (!result) continue;
        const subjects = Array.isArray(result.subjectData) ? result.subjectData : Array.isArray(result.subjectWiseResult) ? result.subjectWiseResult : Array.isArray((_test$summary = test.summary) === null || _test$summary === void 0 ? void 0 : _test$summary.subjectWise) ? test.summary.subjectWise : [];
        const physics = findSubjectResult(subjects, 'physics');
        const chemistry = findSubjectResult(subjects, 'chemistry');
        const maths = findSubjectResult(subjects, 'maths');
        const rankValue = (_ref11 = (_analysis$rank2 = analysis === null || analysis === void 0 ? void 0 : analysis.rank) !== null && _analysis$rank2 !== void 0 ? _analysis$rank2 : (_test$summary2 = test.summary) === null || _test$summary2 === void 0 ? void 0 : _test$summary2.rank) !== null && _ref11 !== void 0 ? _ref11 : null;
        cleaned.push({
          testName: test.testName,
          examDate: ((_test$summary3 = test.summary) === null || _test$summary3 === void 0 ? void 0 : _test$summary3.examDate) || null,
          score: (_ref12 = (_result$totalMarks2 = result.totalMarks) !== null && _result$totalMarks2 !== void 0 ? _result$totalMarks2 : (_test$summary4 = test.summary) === null || _test$summary4 === void 0 ? void 0 : _test$summary4.totalMarks) !== null && _ref12 !== void 0 ? _ref12 : null,
          maxMarks: (_ref13 = (_result$totalSubjectM2 = result.totalSubjectMarks) !== null && _result$totalSubjectM2 !== void 0 ? _result$totalSubjectM2 : (_test$summary5 = test.summary) === null || _test$summary5 === void 0 ? void 0 : _test$summary5.totalSubjectMarks) !== null && _ref13 !== void 0 ? _ref13 : null,
          avg: (_result$totalAvg = result.totalAvg) !== null && _result$totalAvg !== void 0 ? _result$totalAvg : null,
          topper: (_result$totalHighest = result.totalHighest) !== null && _result$totalHighest !== void 0 ? _result$totalHighest : null,
          rank: rankValue == null ? null : Number(rankValue),
          percentile: (_ref14 = (_analysis$percentile = analysis === null || analysis === void 0 ? void 0 : analysis.percentile) !== null && _analysis$percentile !== void 0 ? _analysis$percentile : result.percentile) !== null && _ref14 !== void 0 ? _ref14 : null,
          physics: normalizeSubject(physics),
          chemistry: normalizeSubject(chemistry),
          maths: normalizeSubject(maths)
        });
      } catch (err) {
        console.error('Failed cleaning:', test === null || test === void 0 ? void 0 : test.testName, err);
      }
    }
    return cleaned;
  }
  function downloadJson(data, fileName) {
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json'
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }
  async function mapWithConcurrency(items, limit, worker) {
    const output = new Array(items.length);
    let index = 0;
    async function run() {
      while (index < items.length) {
        const current = index;
        index += 1;
        output[current] = await worker(items[current], current);
      }
    }
    await Promise.all(Array.from({
      length: Math.min(limit, items.length)
    }, run));
    return output;
  }
  async function scrapeAllTestResults(options = {}) {
    assertPortalReady();
    const years = getYearsFromOptions(options);
    const pageSize = Number(options.pageSize || DEFAULT_PAGE_SIZE);
    const concurrency = Math.max(1, Number(options.concurrency || 3));
    const onlyLeaderboard = Boolean(options.onlyLeaderboard);
    const includeLeaderboard = onlyLeaderboard ? true : (options.includeLeaderboard !== false);
    const includeUnpublished = onlyLeaderboard ? false : (options.includeUnpublished !== false);
    const includeAppeared = onlyLeaderboard ? false : (options.includeAppeared !== false);
    const includeAnalysis = onlyLeaderboard ? false : (options.includeAnalysis !== false);
    const download = options.download !== false;
    const startedAt = new Date().toISOString();
    const startMsg = `[test-scraper] Starting${onlyLeaderboard ? ' (LEADERBOARD ONLY - NO PERSONAL DATA)' : ''}. Years: ${years.join(', ')}`;
    console.log(startMsg);
    if (typeof options.onProgress === 'function') {
      options.onProgress(startMsg, 0);
    }
    const yearsData = [];
    for (const year of years) {
      const yearMsg = `[test-scraper] Fetching tests list for year ${year}...`;
      console.log(yearMsg);
      if (typeof options.onProgress === 'function') {
        options.onProgress(yearMsg, 0);
      }
      const yearData = await fetchAllTestsForYear(year, pageSize);
      const foundMsg = `[test-scraper] ${year}: found ${yearData.tests.length}/${yearData.total || yearData.tests.length} tests`;
      console.log(foundMsg);
      if (typeof options.onProgress === 'function') {
        options.onProgress(foundMsg, 0);
      }
      yearsData.push(yearData);
    }
    const seen = new Set();
    const tests = yearsData.flatMap(yearData => yearData.tests.map(test => ({
      year: yearData.year,
      test
    }))).filter(({
      year,
      test
    }) => {
      var _test$id2, _test$testPaperId2, _test$testName;
      const id = `${year}:${(_test$id2 = test === null || test === void 0 ? void 0 : test.id) !== null && _test$id2 !== void 0 ? _test$id2 : ''}:${(_test$testPaperId2 = test === null || test === void 0 ? void 0 : test.testPaperId) !== null && _test$testPaperId2 !== void 0 ? _test$testPaperId2 : ''}:${(_test$testName = test === null || test === void 0 ? void 0 : test.testName) !== null && _test$testName !== void 0 ? _test$testName : ''}`;
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });
    const rows = await mapWithConcurrency(tests, concurrency, async ({
      year,
      test
    }, i) => {
      const testId = (test === null || test === void 0 ? void 0 : test.id) || (test === null || test === void 0 ? void 0 : test.testPaperId);
      const testName = (test === null || test === void 0 ? void 0 : test.testName) || (test === null || test === void 0 ? void 0 : test.name) || `Test ${testId || i + 1}`;
      const published = Boolean(test === null || test === void 0 ? void 0 : test.isPublish);
      const logMsg = `[test-scraper] ${i + 1}/${tests.length}: ${year} - ${testName}`;
      console.log(logMsg);
      if (typeof options.onProgress === 'function') {
        options.onProgress(logMsg, Math.round(i / tests.length * 100));
      }
      if (!published) {
        const resultRow = includeUnpublished ? {
          testName,
          academicYear: year,
          skippedReason: 'Not published. Result APIs were not called to avoid forced-result scraping.',
          summary: summarizeResult({
            ...test,
            academicYear: year
          }, null, null, null, onlyLeaderboard),
          raw: {
            test,
            appeared: null,
            analysis: null,
            leaderboard: null
          }
        } : null;
        if (typeof options.onTestScraped === 'function') {
          options.onTestScraped(resultRow, i + 1, tests.length);
        }
        return resultRow;
      }
      const appeared = includeAppeared || includeAnalysis ? await fetchAppeared(testId) : null;
      const examId = appeared === null || appeared === void 0 ? void 0 : appeared.examId;
      const analysis = includeAnalysis && examId ? await fetchAnalysis(examId) : null;
      const leaderboardId = (test === null || test === void 0 ? void 0 : test.id) || (test === null || test === void 0 ? void 0 : test.testPaperId) || (analysis === null || analysis === void 0 ? void 0 : analysis.testPaperId);
      const leaderboard = includeLeaderboard ? await fetchLeaderboard(leaderboardId) : null;
      const skippedReason = published && (includeAppeared || includeAnalysis) && !examId ? 'Published test, but appeared result did not return examId.' : null;
      const resultRow = {
        testName: (analysis === null || analysis === void 0 ? void 0 : analysis.testName) || testName,
        academicYear: year,
        skippedReason,
        summary: summarizeResult({
          ...test,
          academicYear: year
        }, appeared, analysis, leaderboard, onlyLeaderboard),
        raw: {
          test,
          ...(onlyLeaderboard ? {} : { appeared, analysis }),
          leaderboard
        }
      };
      if (typeof options.onTestScraped === 'function') {
        options.onTestScraped(resultRow, i + 1, tests.length);
      }
      return resultRow;
    });
    const finalRows = rows.filter(Boolean).filter(row => {
      if (!onlyLeaderboard) return true;
      const lb = row.summary && row.summary.leaderboard;
      return Array.isArray(lb) && lb.length > 0;
    });
    const totalLeaderboardEntries = finalRows.reduce((acc, row) => {
      const lb = (row.summary && row.summary.leaderboard) || [];
      return acc + lb.length;
    }, 0);
    const data = {
      generatedAt: new Date().toISOString(),
      startedAt,
      source: 'ExaminationHall APIs only; unpublished tests are not forced.',
      mode: onlyLeaderboard ? 'leaderboard_only' : 'standard',
      years,
      totals: {
        tests: finalRows.length,
        published: finalRows.filter(row => {
          var _row$summary;
          return row === null || row === void 0 || (_row$summary = row.summary) === null || _row$summary === void 0 ? void 0 : _row$summary.isPublish;
        }).length,
        unpublished: finalRows.filter(row => {
          var _row$summary2;
          return row && !((_row$summary2 = row.summary) !== null && _row$summary2 !== void 0 && _row$summary2.isPublish);
        }).length,
        ...(onlyLeaderboard ? { leaderboardEntries: totalLeaderboardEntries } : {})
      },
      tests: finalRows
    };
    if (download) {
      const filePrefix = onlyLeaderboard ? 'ntsc-leaderboard' : 'ntsc-tests';
      downloadJson(data, `${filePrefix}-${years[0]}-${years[years.length - 1]}.json`);
    }
    const doneMsg = '[test-scraper] Done.';
    console.log(doneMsg, data);
    if (typeof options.onProgress === 'function') {
      options.onProgress(doneMsg, 100);
    }
    return data;
  }
  window.scrapeAllTestResults = scrapeAllTestResults;
  window.cleanScrapedTestsData = cleanScrapedTestsData;
  window.downloadScrapedTestsJson = downloadJson;
})();
