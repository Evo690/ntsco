(function () {
  // 1. Authentication & API config loading
  const token = sessionStorage.getItem('fy_token') || localStorage.getItem('fy_token') || '';
  const academicYear = Number(sessionStorage.getItem('fy_academic_year') || localStorage.getItem('fy_academic_year') || new Date().getFullYear());
  if (!token) {
    document.getElementById('auth-warning-alert').style.display = 'block';
    document.getElementById('btn-start').disabled = true;
  }

  // Apply portal theme
  applyUserTheme();

  // 2. Initialize academic year selection
  const selectedYears = new Set([academicYear]);
  initYearPills();
  function applyUserTheme() {
    // Find username/user ID from session storage or cookies
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
    const rawName = sessionStorage.getItem('fy_user_name');
    let userId = '';
    if (rawName && rawName.trim() && rawName.trim() !== 'Student') {
      userId = rawName.trim();
    } else {
      const user = sessionStorage.getItem('fy_logged_in_user') || getCookie('fy_u');
      if (user) {
        const cleanUser = user.trim();
        const isPhone = /^\+?[0-9\s\-]{8,15}$/.test(cleanUser);
        if (!isPhone) userId = cleanUser;
      }
    }
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
  function initYearPills() {
    const pillsContainer = document.getElementById('year-pills');
    const currentYear = new Date().getFullYear();
    // Generate a range of years from 2020 to currentYear + 1
    const years = [];
    for (let y = 2020; y <= currentYear + 1; y++) {
      years.push(y);
    }
    pillsContainer.innerHTML = '';
    years.forEach(year => {
      const pill = document.createElement('div');
      pill.className = `year-pill ${selectedYears.has(year) ? 'active' : ''}`;
      pill.textContent = year;
      pill.onclick = () => {
        if (selectedYears.has(year)) {
          if (selectedYears.size > 1) {
            selectedYears.delete(year);
            pill.classList.remove('active');
          }
        } else {
          selectedYears.add(year);
          pill.classList.add('active');
        }
      };
      pillsContainer.appendChild(pill);
    });
  }

  // Connect toggle interactions
  initToggleListeners();
  function initToggleListeners() {
    const optLeaderboard = document.getElementById('opt-leaderboard');
    const optOnlyLeaderboard = document.getElementById('opt-only-leaderboard');
    const optSubjectwise = document.getElementById('opt-subjectwise');
    const optRanks = document.getElementById('opt-ranks');
    const optDiscardZero = document.getElementById('opt-discard-zero');

    const itemLeaderboard = document.getElementById('item-leaderboard');
    const itemSubjectwise = document.getElementById('item-subjectwise');
    const itemRanks = document.getElementById('item-ranks');
    const itemDiscardZero = document.getElementById('item-discard-zero');

    const savedState = {
      subjectwise: true,
      ranks: true,
      discardZero: false
    };

    if (optOnlyLeaderboard) {
      optOnlyLeaderboard.addEventListener('change', function () {
        if (this.checked) {
          // Remember previous user selections
          if (optSubjectwise) savedState.subjectwise = optSubjectwise.checked;
          if (optRanks) savedState.ranks = optRanks.checked;
          if (optDiscardZero) savedState.discardZero = optDiscardZero.checked;

          // Force leaderboard on & lock it
          if (optLeaderboard) {
            optLeaderboard.checked = true;
            optLeaderboard.disabled = true;
          }
          if (itemLeaderboard) itemLeaderboard.classList.add('disabled');

          // Uncheck and disable personal data toggles
          if (optSubjectwise) {
            optSubjectwise.checked = false;
            optSubjectwise.disabled = true;
          }
          if (itemSubjectwise) itemSubjectwise.classList.add('disabled');

          if (optRanks) {
            optRanks.checked = false;
            optRanks.disabled = true;
          }
          if (itemRanks) itemRanks.classList.add('disabled');

          if (optDiscardZero) {
            optDiscardZero.checked = false;
            optDiscardZero.disabled = true;
          }
          if (itemDiscardZero) itemDiscardZero.classList.add('disabled');

          logToConsole('Leaderboard-only mode enabled: Personal data (scores, ranks, analysis) excluded', 'info');
        } else {
          // Restore controls and previous user selections
          if (optLeaderboard) {
            optLeaderboard.disabled = false;
          }
          if (itemLeaderboard) itemLeaderboard.classList.remove('disabled');

          if (optSubjectwise) {
            optSubjectwise.checked = savedState.subjectwise;
            optSubjectwise.disabled = false;
          }
          if (itemSubjectwise) itemSubjectwise.classList.remove('disabled');

          if (optRanks) {
            optRanks.checked = savedState.ranks;
            optRanks.disabled = false;
          }
          if (itemRanks) itemRanks.classList.remove('disabled');

          if (optDiscardZero) {
            optDiscardZero.checked = savedState.discardZero;
            optDiscardZero.disabled = false;
          }
          if (itemDiscardZero) itemDiscardZero.classList.remove('disabled');

          logToConsole('Leaderboard-only mode disabled: standard options restored', 'info');
        }
      });
    }

    if (optLeaderboard && optOnlyLeaderboard) {
      optLeaderboard.addEventListener('change', function () {
        if (!this.checked && optOnlyLeaderboard.checked) {
          optOnlyLeaderboard.checked = false;
          optOnlyLeaderboard.dispatchEvent(new Event('change'));
        }
      });
    }
  }

  // 3. Selection of formats
  let currentFormat = 'json-summary';
  window.selectFormat = function (element) {
    document.querySelectorAll('.format-card').forEach(card => {
      card.classList.remove('active');
    });
    element.classList.add('active');
    currentFormat = element.getAttribute('data-format');
    logToConsole(`Output format changed to: ${currentFormat.toUpperCase()}`);
  };

  // 4. Live Log Console
  function logToConsole(message, type = 'info') {
    const consoleEl = document.getElementById('terminal-console');
    const line = document.createElement('div');
    line.className = `console-line ${type}`;
    const timestamp = new Date().toLocaleTimeString();
    line.textContent = `[${timestamp}] ${message}`;
    consoleEl.appendChild(line);
    consoleEl.scrollTop = consoleEl.scrollHeight;
  }
  function updateProgress(percent, statusText) {
    document.getElementById('progress-bar-fill').style.width = `${percent}%`;
    document.getElementById('progress-percent').textContent = `${percent}%`;
    document.getElementById('progress-status').textContent = statusText;
  }

  // 5. Cancellation
  window.scrapeCancelled = false;
  window.cancelScraping = function () {
    window.scrapeCancelled = true;
    logToConsole('Cancellation requested...', 'warn');
    document.getElementById('btn-cancel').disabled = true;
  };

  // Helper to escape CSV values
  function escapeCSV(val) {
    if (val === null || val === undefined) return '';
    let str = String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      str = '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
  }

  // 6. CSV Exporter Utility (Standard - with personal student scorecard)
  function convertToCSV(tests, includeSubjects, includeRanks, includeLeaderboard) {
    if (!tests || !tests.length) return '';

    // Dynamic detection of all unique subject names
    const subjectNames = new Set();
    if (includeSubjects) {
      tests.forEach(test => {
        var _test$summary;
        const subjects = ((_test$summary = test.summary) === null || _test$summary === void 0 ? void 0 : _test$summary.subjectWise) || [];
        subjects.forEach(s => {
          if (s.subjectName || s.name) {
            subjectNames.add(s.subjectName || s.name);
          }
        });
      });
    }
    const sortedSubjects = Array.from(subjectNames).sort();

    // 1. Build Headers
    const headers = ['Academic Year', 'Test ID', 'Test Name', 'Exam Date', 'Published', 'Total Marks Obtained', 'Max Total Marks', 'Percentage Obtained (%)'];
    if (includeRanks) {
      headers.push('Overall Rank', 'Batch Rank');
    }
    if (includeLeaderboard) {
      headers.push('Leaderboard Entries Count', 'Leaderboard Topper Score');
    }
    if (includeSubjects) {
      sortedSubjects.forEach(sub => {
        const subLabel = sub.charAt(0).toUpperCase() + sub.slice(1);
        headers.push(`${subLabel} Score`, `${subLabel} Max Marks`, `${subLabel} Rank`, `${subLabel} Percentile`, `${subLabel} Average`, `${subLabel} Topper`);
      });
    }
    const csvRows = [headers.join(',')];

    // 2. Build rows
    tests.forEach(test => {
      const summary = test.summary || {};
      const row = [escapeCSV(test.academicYear || summary.academicYear), escapeCSV(summary.testId), escapeCSV(test.testName || summary.testName), escapeCSV(summary.examDate), escapeCSV(summary.isPublish), escapeCSV(summary.totalMarks), escapeCSV(summary.totalSubjectMarks), escapeCSV(summary.percentage)];
      if (includeRanks) {
        row.push(escapeCSV(summary.rank), escapeCSV(summary.batchRank));
      }
      if (includeLeaderboard) {
        const lbList = summary.leaderboard || [];
        const topper = lbList.length > 0 ? ((lbList[0].totalMarks != null ? lbList[0].totalMarks : lbList[0].marks) ?? '') : '';
        row.push(escapeCSV(lbList.length), escapeCSV(topper));
      }
      if (includeSubjects) {
        const subList = summary.subjectWise || [];
        sortedSubjects.forEach(sub => {
          const match = subList.find(s => String(s.subjectName || s.name || '').toLowerCase() === String(sub).toLowerCase());
          if (match) {
            var _ref, _ref2, _match$totalMarks, _ref3, _match$totalSubjectMa, _match$rank, _match$percentile, _ref4, _ref5, _match$totalAvgMarks, _ref6, _ref7, _match$highestMarks;
            row.push(escapeCSV((_ref = (_ref2 = (_match$totalMarks = match.totalMarks) !== null && _match$totalMarks !== void 0 ? _match$totalMarks : match.marks) !== null && _ref2 !== void 0 ? _ref2 : match.score) !== null && _ref !== void 0 ? _ref : null), escapeCSV((_ref3 = (_match$totalSubjectMa = match.totalSubjectMarks) !== null && _match$totalSubjectMa !== void 0 ? _match$totalSubjectMa : match.maxMarks) !== null && _ref3 !== void 0 ? _ref3 : null), escapeCSV((_match$rank = match.rank) !== null && _match$rank !== void 0 ? _match$rank : null), escapeCSV((_match$percentile = match.percentile) !== null && _match$percentile !== void 0 ? _match$percentile : null), escapeCSV((_ref4 = (_ref5 = (_match$totalAvgMarks = match.totalAvgMarks) !== null && _match$totalAvgMarks !== void 0 ? _match$totalAvgMarks : match.totalAvg) !== null && _ref5 !== void 0 ? _ref5 : match.avg) !== null && _ref4 !== void 0 ? _ref4 : null), escapeCSV((_ref6 = (_ref7 = (_match$highestMarks = match.highestMarks) !== null && _match$highestMarks !== void 0 ? _match$highestMarks : match.totalHighest) !== null && _ref7 !== void 0 ? _ref7 : match.topper) !== null && _ref6 !== void 0 ? _ref6 : null));
          } else {
            // Empty placeholders
            row.push('', '', '', '', '', '');
          }
        });
      }
      csvRows.push(row.join(','));
    });
    return csvRows.join('\n');
  }

  // 6b. Dedicated Leaderboard CSV Exporter (Zero Personal Data)
  function convertLeaderboardToCSV(tests) {
    if (!tests || !tests.length) return '';

    // Collect all unique subject names across all leaderboard records
    const subjectNames = new Set();
    tests.forEach(test => {
      const lb = (test.summary && test.summary.leaderboard) || [];
      lb.forEach(row => {
        if (Array.isArray(row.subjectPerformance)) {
          row.subjectPerformance.forEach(s => {
            const name = (s.subjectName || '').trim();
            if (name) subjectNames.add(name);
          });
        }
      });
    });
    const sortedSubjects = Array.from(subjectNames).sort();

    // Headers
    const headers = [
      'Academic Year',
      'Test ID',
      'Test Paper ID',
      'Test Name',
      'Exam Date',
      'Rank',
      'Student Name',
      'Student ID',
      'Total Marks'
    ];
    sortedSubjects.forEach(sub => {
      headers.push(`${sub} Marks`);
    });
    headers.push('Subject Breakdown');

    const csvRows = [headers.join(',')];

    tests.forEach(test => {
      const summary = test.summary || {};
      const lb = summary.leaderboard || [];
      const testYear = test.academicYear || summary.academicYear;
      const testId = summary.testId;
      const testPaperId = summary.testPaperId;
      const testName = test.testName || summary.testName;
      const examDate = summary.examDate;

      lb.forEach(entry => {
        const rank = entry.ranks != null ? entry.ranks : (entry.rank != null ? entry.rank : '');
        const studentName = entry.studentName || entry.userName || entry.name || '';
        const studentId = entry.examId != null ? entry.examId : (entry.rollNo != null ? entry.rollNo : (entry.studentId != null ? entry.studentId : ''));
        const totalMarks = entry.totalMarks != null ? entry.totalMarks : (entry.marks != null ? entry.marks : (entry.score != null ? entry.score : ''));

        const subjectPerf = Array.isArray(entry.subjectPerformance) ? entry.subjectPerformance : [];
        const subMap = {};
        const breakdownParts = [];

        subjectPerf.forEach(s => {
          const name = (s.subjectName || '').trim();
          const marks = s.totalMarks != null ? s.totalMarks : (s.marks != null ? s.marks : (s.score != null ? s.score : ''));
          if (name) {
            subMap[name.toLowerCase()] = marks;
            breakdownParts.push(`${name}: ${marks}`);
          }
        });

        const row = [
          escapeCSV(testYear),
          escapeCSV(testId),
          escapeCSV(testPaperId),
          escapeCSV(testName),
          escapeCSV(examDate),
          escapeCSV(rank),
          escapeCSV(studentName),
          escapeCSV(studentId),
          escapeCSV(totalMarks)
        ];

        sortedSubjects.forEach(sub => {
          const val = subMap[sub.toLowerCase()];
          row.push(escapeCSV(val !== undefined ? val : ''));
        });

        row.push(escapeCSV(breakdownParts.join(' | ')));
        csvRows.push(row.join(','));
      });
    });

    return csvRows.join('\n');
  }

  // Trigger file download (disabled)
  function downloadBlob(content, fileName, mimeType) {
    logToConsole(`Data export download blocked: ${fileName} (export function is disabled)`, 'error');
  }

  // 7. Core Scraping Controller (Data export function disabled)
  window.startScraping = async function () {
    logToConsole('Data export function is disabled.', 'error');
    updateProgress(0, 'Export Disabled');
  };
})();
