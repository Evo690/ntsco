/* Renderers */
function activeSubTab(pageId, fallback = 'all') {
  var _APP_STATE$activeSubT;
  return ((_APP_STATE$activeSubT = APP_STATE.activeSubTabs) === null || _APP_STATE$activeSubT === void 0 ? void 0 : _APP_STATE$activeSubT[pageId]) || fallback;
}
function searchMatch(...values) {
  const q = String(APP_STATE.globalSearch || '').trim().toLowerCase();
  if (!q) return true;
  return values.some(v => String(v || '').toLowerCase().includes(q));
}
function renderVirtualList(root, items, rowHeight, renderItem) {
  if (!root) return;
  if (items.length <= 20) {
    root.classList.remove('virtual-list');
    root.innerHTML = items.map(renderItem).join('');
    root.onscroll = null;
    return;
  }
  root.classList.add('virtual-list');
  const viewportHeight = Math.max(root.clientHeight || 360, 280);
  const overscan = 6;
  const totalHeight = items.length * rowHeight;
  root.innerHTML = `<div class="virtual-spacer" style="height:${totalHeight}px"></div><div class="virtual-content"></div>`;
  const content = root.querySelector('.virtual-content');
  if (!content) return;
  const renderWindow = () => {
    const scrollTop = root.scrollTop || 0;
    const start = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
    const visibleCount = Math.ceil(viewportHeight / rowHeight) + overscan * 2;
    const end = Math.min(items.length, start + visibleCount);
    const offsetY = start * rowHeight;
    content.style.transform = `translateY(${offsetY}px)`;
    content.innerHTML = items.slice(start, end).map(renderItem).join('');
  };
  root.onscroll = renderWindow;
  renderWindow();
}
function renderTodayClasses(items) {
  const root = document.getElementById('today-classes-list');
  if (!root) return;
  const dayStamp = document.getElementById('today-schedule-day');
  if (dayStamp) {
    const date = new Date(`${getIstDateKey()}T12:00:00`);
    dayStamp.innerHTML = `<strong>${date.toLocaleDateString('en-IN',{weekday:'short'}).toUpperCase()}</strong><time datetime="${getIstDateKey()}">${date.toLocaleDateString('en-IN',{day:'2-digit',month:'short'})}</time>`;
  }
  const today = getIstDateKey();
  const nowMin = getIstHourMinute();
  const todayItems = items.filter(c => normalizeDateKey(c === null || c === void 0 ? void 0 : c.classDate) === today && !String((c === null || c === void 0 ? void 0 : c.classType) || '').includes('Doubt')).filter(c => searchMatch(c.subjects, c.classType, c.startTime, formatTimeLabel(c.startTime))).sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
  if (!todayItems.length) {
    root.innerHTML = '<div class="empty">No classes today</div>';
    return;
  }
  root.innerHTML = `<div class="session-timeline">${todayItems.map((c,i)=>buildSessionSlot(c,i,true)).join('')}</div>`;
}
function renderTimetable(items) {
  const grid = document.getElementById('timetable-grid');
  const range = document.getElementById('timetable-range');
  if (!grid) return;
  const clean = items.filter(c => !String((c === null || c === void 0 ? void 0 : c.classType) || '').includes('Doubt')).filter(c => searchMatch(c.subjects, c.classType, c.classDate, c.startTime)).map(c => ({
    ...c,
    classDateKey: normalizeDateKey(c.classDate)
  })).filter(c => c.classDateKey);
  if (!clean.length) {
    grid.classList.remove('tt-grid');
    grid.innerHTML = '<div class="empty">No timetable classes found</div>';
    if (range) range.textContent = 'No week data';
    return;
  }
  const dates = [...new Set(clean.map(c => c.classDateKey))].sort().slice(0, 7);
  if (range) range.textContent = `${formatDateLabel(dates[0])} - ${formatDateLabel(dates[dates.length - 1])}`;
  grid.classList.remove('tt-grid');
  grid.removeAttribute('style');
  grid.classList.add('schedule-board');
  grid.innerHTML = dates.map(dateKey => {
    const dayItems = clean.filter(c => c.classDateKey === dateKey).sort((a,b)=>timeToMinutes(a.startTime)-timeToMinutes(b.startTime));
    const today = dateKey === getIstDateKey();
    return `<section class="agenda-column ${today ? 'is-today' : ''}">${buildScheduleDayHeader(dateKey, dayItems.length)}<div class="session-timeline">${dayItems.map((c,i)=>buildSessionSlot(c,i)).join('')}</div></section>`;
  }).join('');
}
function renderMessageGroups(groups) {
  const list = document.getElementById('msg-group-list');
  const countEl = document.getElementById('msg-unread-count');
  if (!list) return;
  const tab = activeSubTab('messages', 'all');
  const filtered = groups.filter(g => {
    if (tab === 'unread' && !(g.unreadCount > 0)) return false;
    return searchMatch(g.title, g.lastMessageTime, g.lastMessageText);
  });
  if (!filtered.length) {
    list.innerHTML = '<div class="empty">No messages found</div>';
    if (countEl) countEl.textContent = '0 unread';
    return;
  }
  const totalUnread = filtered.reduce((acc, g) => acc + (g.unreadCount || 0), 0);
  if (countEl) countEl.textContent = `${totalUnread} unread`;
  list.innerHTML = filtered.map(g => {
    const isUnread = g.unreadCount > 0;
    const fallback = escapeHtml((g.title || 'M')[0].toUpperCase());
    const iconHtml = g.iconUrl ? `<img src="${escapeHtml(g.iconUrl)}" class="msg-group-icon" onerror="this.outerHTML='<div class=\\'msg-group-icon-fallback\\'>${fallback}</div>'"/>` : `<div class="msg-group-icon-fallback">${fallback}</div>`;
    return `
        <div class="msg-group-item ${isUnread ? 'unread' : ''} ${currentGroupId === g.groupId ? 'active' : ''}" onclick="selectMessageGroup('${g.groupId}', '${escapeHtml(g.title)}')">
          ${iconHtml}
          <div style="flex:1; min-width:0;">
            <div style="display:flex; justify-content:space-between; align-items:baseline; margin-bottom:2px;">
              <div style="font-size:13px; font-weight:600; color:var(--text); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(g.title || 'Group')}</div>
              <div style="font-size:11px; color:var(--text3); flex-shrink:0; margin-left:8px;">${escapeHtml(g.lastMessageTime || '')}</div>
            </div>
            <div style="font-size:12px; color:var(--text2); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
              ${isUnread ? `<span style="color:var(--accent);font-weight:600">${g.unreadCount} new messages</span>` : 'Click to view thread'}
            </div>
          </div>
        </div>
      `;
  }).join('');
}
function hasTestSyllabus(syllabus) {
  if (!syllabus || typeof syllabus !== 'string') return false;
  const lines = syllabusToLines(syllabus);
  const meaningful = lines.filter(l => l.trim().toUpperCase() !== 'SYLLABUS');
  return meaningful.length > 0;
}

function parseSyllabusSubjects(syllabus) {
  const lines = syllabusToLines(syllabus);
  const filtered = lines.filter(l => l.trim().toUpperCase() !== 'SYLLABUS');
  if (!filtered.length) return [];

  const subjectRegex = /^(MATHS|MATHEMATICS|PHYSICS|CHEMISTRY|BIOLOGY|BOTANY|ZOOLOGY)\s*:/i;
  const hasSubjectMarkers = filtered.some(l => subjectRegex.test(l.trim()));

  if (!hasSubjectMarkers) {
    return [{
      subject: 'Syllabus Topics',
      color: 'var(--accent)',
      icon: '📚',
      lines: filtered
    }];
  }

  const subjects = [];
  let current = null;
  let batchHeader = '';

  for (const rawLine of filtered) {
    const line = rawLine.trim();
    if (!line) continue;

    if (/SYLLABUS/i.test(line) && !subjectRegex.test(line)) {
      batchHeader = line.replace(/[:\s]*SYLLABUS[:\s]*/i, '').trim();
      continue;
    }

    const match = line.match(subjectRegex);
    if (match) {
      const subjName = match[1].toUpperCase();
      let color = 'var(--accent)';
      let icon = '⚡';
      let title = 'Physics';
      if (subjName.startsWith('MATH')) {
        color = 'var(--green)';
        icon = '📐';
        title = 'Mathematics';
      } else if (subjName.startsWith('CHEM')) {
        color = 'var(--purple)';
        icon = '🧪';
        title = 'Chemistry';
      } else if (subjName.startsWith('BIO') || subjName.startsWith('BOT') || subjName.startsWith('ZOO')) {
        color = 'var(--amber)';
        icon = '🧬';
        title = subjName.charAt(0) + subjName.slice(1).toLowerCase();
      } else if (subjName.startsWith('PHY')) {
        color = 'var(--accent)';
        icon = '⚡';
        title = 'Physics';
      }

      const fullTitle = batchHeader ? `${title} (${batchHeader})` : title;
      current = {
        subject: fullTitle,
        color,
        icon,
        lines: []
      };
      subjects.push(current);
      const rest = line.replace(subjectRegex, '').trim();
      if (rest) current.lines.push(rest);
    } else {
      if (current) {
        current.lines.push(line);
      } else {
        current = {
          subject: batchHeader ? `General (${batchHeader})` : 'General Topics',
          color: 'var(--accent)',
          icon: '📚',
          lines: [line]
        };
        subjects.push(current);
      }
    }
  }

  return subjects;
}

function ensureSyllabusModal() {
  if (document.getElementById('exam-syllabus-modal-backdrop')) return;
  const wrapper = document.createElement('div');
  wrapper.id = 'exam-syllabus-modal-backdrop';
  wrapper.className = 'detail-backdrop';
  wrapper.style.display = 'none';
  wrapper.innerHTML = buildInspectorFrame({
    kicker: 'PAPER / SYLLABUS', title: 'Exam syllabus', titleId: 'exam-syllabus-title', metaId: 'exam-syllabus-meta',
    close: 'closeTestSyllabusModal()', bodyId: 'exam-syllabus-body',
    actions: '<span class="inspector-action-note">Subject-by-subject topic index</span><button id="exam-syllabus-copy-btn" class="console-button" onclick="copyTestSyllabusText()"><span id="exam-syllabus-copy-text">Copy</span> syllabus</button>'
  });
  wrapper.addEventListener('click', e => {
    if (e.target === wrapper) closeTestSyllabusModal();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeTestSyllabusModal();
  });
  document.body.appendChild(wrapper);
}

window.closeTestSyllabusModal = function closeTestSyllabusModal() {
  const el = document.getElementById('exam-syllabus-modal-backdrop');
  if (el) el.style.display = 'none';
};

window.openTestSyllabusModal = function openTestSyllabusModal(testId, event) {
  if (event && event.stopPropagation) event.stopPropagation();
  const cleanId = String(testId || '').trim();
  const allTests = [...(APP_STATE.tests || []), ...(APP_STATE.eraTests || [])];
  const test = allTests.find(t => String(t.id || '') === cleanId || String(t.testPaperId || '') === cleanId);
  if (!test || !test.syllabus) {
    alert('Syllabus not available for this exam.');
    return;
  }

  ensureSyllabusModal();
  const titleEl = document.getElementById('exam-syllabus-title');
  const metaEl = document.getElementById('exam-syllabus-meta');
  const bodyEl = document.getElementById('exam-syllabus-body');
  const backdrop = document.getElementById('exam-syllabus-modal-backdrop');

  if (titleEl) titleEl.textContent = test.testName || test.name || 'Exam Syllabus';

  const metaParts = [];
  if (test.examDate || test.testDate || test.startDate) {
    metaParts.push(formatDateLabel(test.examDate || test.testDate || test.startDate));
  }
  if (test.duration) metaParts.push(`${test.duration} mins`);
  if (test.isOffline != null) metaParts.push(test.isOffline ? 'Offline Exam' : 'Online Exam');
  if (test.id || test.testPaperId) metaParts.push(`Paper ID: ${test.testPaperId || test.id}`);

  if (metaEl) metaEl.textContent = metaParts.join(' · ');

  window._activeSyllabusTest = test;

  const subjects = parseSyllabusSubjects(test.syllabus);
  if (bodyEl) bodyEl.innerHTML = buildTopicLedger(subjects);

  const copyText = document.getElementById('exam-syllabus-copy-text');
  if (copyText) copyText.textContent = 'Copy';

  if (backdrop) backdrop.style.display = 'flex';
};

window.copyTestSyllabusText = function copyTestSyllabusText() {
  const test = window._activeSyllabusTest;
  if (!test || !test.syllabus) return;
  const lines = syllabusToLines(test.syllabus).filter(l => l.trim().toUpperCase() !== 'SYLLABUS');
  const text = `${test.testName || 'Exam Syllabus'}\n${lines.join('\n')}`;
  const copyText = document.getElementById('exam-syllabus-copy-text');
  if (!navigator.clipboard?.writeText) {
    if (copyText) copyText.textContent = 'Copy unavailable';
    return;
  }
  navigator.clipboard.writeText(text).then(() => {
    if (copyText) {
      copyText.textContent = 'Copied!';
      setTimeout(() => { copyText.textContent = 'Copy'; }, 2000);
    }
  }).catch(() => {
    if (copyText) copyText.textContent = 'Copy failed';
  });
};

function renderExamHall(tests) {
  if (Array.isArray(tests) && tests.length) {
    scanAndUploadOnlineTests(tests);
  }
  const root = document.getElementById('examhall-list');
  const count = document.getElementById('examhall-count');
  if (!root) return;
  const tab = activeSubTab('examhall', 'all');
  const filtered = tests.filter(t => {
    const published = Boolean(t.isPublish);
    const status = paperState(t).key;
    if (tab === 'published' && !published) return false;
    if (tab === 'pending' && published) return false;
    if (tab === 'live' && status !== 'live') return false;
    return searchMatch(t.testName, t.examType, t.testType, t.id, t.testPaperId);
  });
  if (!filtered.length) {
    root.innerHTML = '<div class="empty">No exam hall tests found</div>';
    if (count) count.textContent = '0 active tests';
    return;
  }
  const active = filtered.filter(t => ['live','scheduled'].includes(paperState(t).key)).length;
  if (count) count.textContent = `${active} active test${active === 1 ? '' : 's'}`;
  root.innerHTML = buildPaperIndex(filtered);
  updateExamLoadMoreButton();
}
function renderEraTests(tests) {
  if (Array.isArray(tests) && tests.length) {
    scanAndUploadOnlineTests(tests);
  }
  const root = document.getElementById('era-list');
  const count = document.getElementById('era-count');
  if (!root) return;
  const tab = activeSubTab('era', 'all');
  const filtered = tests.filter(t => {
    const published = Boolean(t.isPublish);
    if (tab === 'published' && !published) return false;
    if (tab === 'pending' && published) return false;
    return searchMatch(t.testName, t.name, t.id, t.testPaperId, t.examType, t.testType);
  });
  if (!filtered.length) {
    root.innerHTML = '<div class="empty">No tests found</div>';
    if (count) count.textContent = '0 tests';
    return;
  }
  if (count) count.textContent = `${filtered.length} test${filtered.length === 1 ? '' : 's'}`;
  root.innerHTML = buildPaperIndex(filtered, true);
  updateEraLoadMoreButton();
}
function updateExamLoadMoreButton() {
  const btn = document.getElementById('examhall-load-more');
  if (!btn) return;
  const total = APP_STATE.examTotal || APP_STATE.tests.length;
  const hasMore = APP_STATE.tests.length < total;
  btn.style.display = hasMore ? 'block' : 'none';
  btn.textContent = hasMore ? `Show More (${APP_STATE.tests.length}/${total})` : 'All tests loaded';
}
function updateEraLoadMoreButton() {
  const btn = document.getElementById('era-load-more');
  if (!btn) return;
  const total = APP_STATE.eraTotal || APP_STATE.eraTests.length;
  const hasMore = APP_STATE.eraTests.length < total;
  btn.style.display = hasMore ? 'block' : 'none';
  btn.textContent = hasMore ? `Show More (${APP_STATE.eraTests.length}/${total})` : 'All tests loaded';
}
function renderExamCalendar(entries) {
  const root = document.getElementById('examcal-list');
  const title = document.getElementById('examcal-title');
  if (!root) return;
  if (!entries.length) {
    root.innerHTML = '<div class="empty">No exams found</div>';
    if (title) title.textContent = 'Exam Calendar';
    return;
  }
  const normalized = entries.map(item => {
    const lines = syllabusToLines(item.syllabus || '');
    return {
      id: item.id,
      name: item.name || item.testName || item.examName || 'Exam',
      dateTime: item.dateTime || item.testDateTime || item.examDate || item.date,
      mode: item.mode || item.testMode || item.examMode || '',
      venue: formatVenueText(item.venue || ''),
      syllabusLines: Array.isArray(item.syllabusLines) && item.syllabusLines.length ? item.syllabusLines : lines,
      syllabusPreview: item.syllabusPreview || lines.slice(0, 2).join(' | ')
    };
  }).filter(item => item.dateTime).filter(item => searchMatch(item.name, item.dateTime, item.mode, item.venue, item.syllabusPreview));
  const sorted = normalized.sort((a, b) => parseExamDateTime(b.dateTime) - parseExamDateTime(a.dateTime));
  APP_STATE.calendarEntries = sorted;
  const first = sorted.find(t => !Number.isNaN(parseExamDateTime(t.dateTime).getTime()));
  if (title && first) title.textContent = `Exam Calendar - ${parseExamDateTime(first.dateTime).toLocaleDateString('en-IN', {
    month: 'long',
    year: 'numeric'
  })}`;
  root.innerHTML = buildCalendarIndex(sorted);
}
function renderCourses(courses) {
  const grid = document.getElementById('courses-grid');
  const count = document.getElementById('courses-count');
  if (!grid) return;
  const tab = activeSubTab('courses', 'all');
  const filtered = courses.filter(c => {
    if (tab === 'live' && !c.isLive) return false;
    if (tab === 'exam' && !c.isExamType) return false;
    if (tab === 'classroom' && (c.isLive || c.isExamType)) return false;
    return searchMatch(c.courseName, c.goal, c.startDate, c.expireyDate);
  });
  if (count) count.textContent = `${filtered.length} course${filtered.length === 1 ? '' : 's'}`;
  if (!filtered.length) {
    grid.innerHTML = '<div class="empty">No courses found</div>';
    return;
  }
  grid.innerHTML = filtered.map((c, index) => {
    const cid = Number(c.courseId ?? c.id ?? c.courseID ?? 0);
    const type = c.isLive ? 'Live now' : c.isExamType ? 'Exam course' : 'Classroom';
    const image = c.image || c.courseImage || '';
    return `<article class="enrollment-card">
      <div class="enrollment-cover"><span>${String(index + 1).padStart(2, '0')}</span>${image ? `<img src="${escapeHtml(image)}" alt="" loading="lazy" onerror="this.remove()">` : ''}</div>
      <div class="enrollment-record">
        <div class="record-kicker"><span>${escapeHtml(c.goal || 'Course')}</span><span>${escapeHtml(type)}</span></div>
        <h2>${escapeHtml(c.courseName || 'Untitled course')}</h2>
        <dl class="record-dates"><div><dt>Starts</dt><dd>${escapeHtml(formatDateLabel(c.startDate))}</dd></div><div><dt>Expires</dt><dd>${escapeHtml(formatDateLabel(c.expireyDate))}</dd></div></dl>
      </div>
      <button class="record-open" onclick="openCourseDetail(${cid})" ${cid ? '' : 'disabled'}>${c.isLive ? 'Join course' : 'Open course'} <span aria-hidden="true">↗</span></button>
    </article>`;
  }).join('');
}

function renderNotices(notices) {
  const list = document.getElementById('notice-list');
  const countEl = document.getElementById('notice-count');
  if (!list) return;
  const tab = activeSubTab('notices', 'all');
  const now = Date.now();
  const sevenDays = 7 * 24 * 60 * 60 * 1000;
  const filtered = notices.filter(n => {
    const createdMs = new Date(n.createdDate || '').getTime();
    if (tab === 'test' && !n.testDate) return false;
    if (tab === 'recent' && (!(createdMs > 0) || now - createdMs > sevenDays)) return false;
    return searchMatch(n.title, n.createdDate, n.testDate);
  });
  if (!filtered.length) {
    list.innerHTML = '<div class="empty">No notices found</div>';
    if (countEl) countEl.textContent = '0 notices';
    return;
  }
  if (countEl) countEl.textContent = `${filtered.length} notice${filtered.length === 1 ? '' : 's'}`;
  const noticeRenderer = n => {
    const testDateHtml = n.testDate ? ` · Test Date: ${escapeHtml(n.testDate)}` : '';
    return `<div class="notice-item" style="display:flex; justify-content:space-between; align-items:center;"><div style="flex:1; min-width:0; padding-right:12px;"><div class="notice-title" style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(n.title || 'Untitled Notice')}</div><div class="notice-time">Created: ${escapeHtml(n.createdDate || 'Unknown')}${testDateHtml}</div></div><button class="start-btn gray" style="margin:0; flex-shrink:0" onclick="openNoticeFile('${n.id}')">View</button></div>`;
  };
  renderVirtualList(list, filtered, 72, noticeRenderer);
}
function renderStudyContent(materials, totalCount = 0) {
  const root = document.getElementById('study-list');
  const count = document.getElementById('study-count');
  const btn = document.getElementById('study-load-more');
  if (!root) return;
  const tab = activeSubTab('study', 'all');
  const filtered = materials.filter(m => {
    const subj = String(m.subjectName || '').toLowerCase();
    if (tab === 'physics' && !subj.includes('phy')) return false;
    if (tab === 'chemistry' && !subj.includes('chem')) return false;
    if (tab === 'math' && !subj.includes('math')) return false;
    return searchMatch(m.title, m.subjectName, m.createdDate);
  });
  if (!filtered.length) {
    root.innerHTML = '<div class="empty">No study content found</div>';
    if (count) count.textContent = '0 items';
    if (btn) btn.style.display = 'none';
    return;
  }
  if (count) count.textContent = `${filtered.length} shown${totalCount ? ` / ${totalCount}` : ''}`;
  const studyRenderer = m => {
    let subjectColor = 'var(--accent)';
    const subj = String(m.subjectName || '').toLowerCase();
    if (subj.includes('chem')) subjectColor = 'var(--purple)';
    if (subj.includes('math')) subjectColor = 'var(--green)';
    return `
        <div class="exam-hall-item" style="padding:10px 14px">
          <div class="exam-hall-icon" style="background:var(--bg4); width:36px; height:36px; color:var(--text2)">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
          </div>
          <div class="exam-hall-info">
            <div class="exam-hall-name" style="font-size:13px">${escapeHtml(m.title || 'Document')}</div>
            <div class="exam-hall-meta">
              ${escapeHtml(m.createdDate || 'Unknown date')} · 
              <span style="color:${subjectColor}; font-weight:600">${escapeHtml(m.subjectName || 'General')}</span>
            </div>
          </div>
          <div class="exam-hall-right">
            <button class="start-btn gray" style="margin-top:0" onclick="openStudyFile('${m.id}')">View</button>
          </div>
        </div>
      `;
  };
  renderVirtualList(root, filtered, 82, studyRenderer);
  if (btn) {
    btn.style.display = materials.length < (totalCount || 0) ? 'block' : 'none';
  }
}
function ensureAttendanceModal() {
  if (document.getElementById('att-modal-backdrop')) return;
  const wrapper = document.createElement('div');
  wrapper.id = 'att-modal-backdrop';
  wrapper.className = 'detail-backdrop';
  wrapper.style.display = 'none';
  wrapper.innerHTML = buildInspectorFrame({kicker: 'ACCOUNT / ATTENDANCE', title: 'Attendance report', close: "document.getElementById('att-modal-backdrop').style.display='none'", bodyId: 'att-modal-body', actions: '<label>Month <select id="att-month"></select></label><label>Year <select id="att-year"></select></label><button onclick="renderAttendanceModal()" class="console-button accent">View</button>'});
  document.body.appendChild(wrapper);
}
function ensureResultModal() {
  if (document.getElementById('result-modal-backdrop')) return;
  const wrapper = document.createElement('div');
  wrapper.id = 'result-modal-backdrop';
  wrapper.className = 'detail-backdrop';
  wrapper.style.display = 'none';
  wrapper.innerHTML = buildInspectorFrame({kicker: 'PAPER / REPORT',title:'Result analysis',close:'closeResultModal()',bodyId:'result-modal-body'});
  wrapper.addEventListener('click', e => {
    if (e.target === wrapper) closeResultModal();
  });
  document.body.appendChild(wrapper);
}
function closeResultModal() {
  const el = document.getElementById('result-modal-backdrop');
  if (el) el.style.display = 'none';
}
function showResultModal(contentHtml) {
  ensureResultModal();
  const backdrop = document.getElementById('result-modal-backdrop');
  const body = document.getElementById('result-modal-body');
  if (!backdrop || !body) return;
  body.innerHTML = contentHtml;
  backdrop.style.display = 'flex';
}
function buildResultAnalysisHtml(analysis, selected, options = {}) {
  return buildReportConsole(analysis, selected, options);
}

function buildLeaderboardHtml(analysis, leaderboard) {
  return buildRankLedger(analysis, leaderboard);
}

function renderApiError(message) {
  const els = ['timetable-grid', 'examhall-list', 'era-list', 'today-classes-list', 'examcal-list', 'courses-grid', 'msg-group-list', 'notice-list', 'study-list'];
  els.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = `<div class="empty">${escapeHtml(message)}</div>`;
  });
}
function updateDashboardWidgets() {
  const nameEl = document.getElementById('dash-test-name');
  const scoreEl = document.getElementById('dash-test-score');
  const subEl = document.getElementById('dash-test-sub');
  const batchRankEl = document.getElementById('dash-batch-rank');
  const batchRankSubEl = document.getElementById('dash-rank-sub');
  if (nameEl && scoreEl && subEl) {
    const forced = APP_STATE.dashboardForcedStats || null;
    if (!forced) {
      scoreEl.textContent = 'N/A';
      subEl.innerHTML = 'No forced-result data yet';
      if (batchRankEl) batchRankEl.textContent = '--';
      if (batchRankSubEl) batchRankSubEl.textContent = 'No ERA rank available';
    } else {
      var _ref5, _forced$batchRank, _forced$marks, _forced$totalMarks;
      const rankVal = (_ref5 = (_forced$batchRank = forced.batchRank) !== null && _forced$batchRank !== void 0 ? _forced$batchRank : forced.rank) !== null && _ref5 !== void 0 ? _ref5 : null;
      nameEl.textContent = forced.testName || 'Latest Test';
      scoreEl.textContent = (_forced$marks = forced.marks) !== null && _forced$marks !== void 0 ? _forced$marks : 'N/A';
      let subHtml = `out of ${(_forced$totalMarks = forced.totalMarks) !== null && _forced$totalMarks !== void 0 ? _forced$totalMarks : '-'}`;
      if (rankVal != null) subHtml += ` · Rank #${rankVal}`;
      subEl.innerHTML = subHtml;
      if (batchRankEl) batchRankEl.textContent = rankVal != null ? `#${rankVal}` : '--';
      if (batchRankSubEl) batchRankSubEl.textContent = forced.testName ? `ERA: ${forced.testName}` : 'ERA forced result stats';
    }
  }

  // Next Exam stat card
  const nextExamValEl = document.getElementById('dash-next-exam-val');
  const nextExamSubEl = document.getElementById('dash-next-exam-sub');
  const upListEl = document.getElementById('dashboard-upcoming-list');
  const now = new Date();
  const upcomingList = (APP_STATE.calendarEntries || []).filter(t => {
    const dt = parseExamDateTime(t.dateTime);
    return !Number.isNaN(dt.getTime()) && dt > new Date(now.getTime() - 86400000);
  }).sort((a, b) => parseExamDateTime(a.dateTime) - parseExamDateTime(b.dateTime));

  // Populate Next Exam card
  if (nextExamValEl && nextExamSubEl) {
    const next = upcomingList[0];
    if (next) {
      const dt = parseExamDateTime(next.dateTime);
      const msUntil = dt - now;
      const daysUntil = Math.ceil(msUntil / 86400000);
      if (daysUntil <= 0) {
        nextExamValEl.textContent = 'Today';
        nextExamValEl.style.color = 'var(--red)';
      } else if (daysUntil === 1) {
        nextExamValEl.textContent = 'Tomorrow';
        nextExamValEl.style.color = 'var(--amber)';
      } else {
        nextExamValEl.textContent = `${daysUntil}d`;
        nextExamValEl.style.color = '';
      }
      // Truncate name to ~22 chars
      const shortName = next.name && next.name.length > 22 ? next.name.slice(0, 22) + '…' : next.name || 'Exam';
      nextExamSubEl.textContent = shortName;
    } else {
      nextExamValEl.textContent = 'None';
      nextExamSubEl.textContent = 'No upcoming exams';
    }
  }

  // Test Schedule list (full-width, up to 7 entries)
  if (upListEl) {
    const list = upcomingList.filter(item => searchMatch(item.name, item.dateTime, item.venue));
    if (!list.length) {
      upListEl.innerHTML = '<div class="empty" style="padding:10px 0">No upcoming exams scheduled</div>';
    } else {
      upListEl.innerHTML = list.slice(0, 7).map(item => {
        const dt = parseExamDateTime(item.dateTime);
        const isToday = dt.toDateString() === now.toDateString();
        const msUntil = dt - now;
        const daysUntil = Math.ceil(msUntil / 86400000);
        let badgeClass = 'badge-upcoming';
        let badgeText = `${daysUntil}d`;
        if (isToday || daysUntil <= 0) {
          badgeClass = 'badge-live';
          badgeText = 'Today';
        } else if (daysUntil === 1) {
          badgeClass = 'badge-live';
          badgeText = 'Tomorrow';
        } else if (daysUntil <= 3) {
          badgeClass = 'badge-upcoming';
        }
        const venue = item.venue ? `` : '';
        return `
          <div class="exam-item" style="cursor:pointer;padding:11px 0" onclick="openEraFromDashboard('${escapeHtml(item.name)}')">
            <div class="exam-dot" style="background:${isToday || daysUntil <= 0 ? 'var(--red)' : daysUntil <= 3 ? 'var(--amber)' : 'var(--accent)'}"></div>
            <div class="exam-info">
              <div class="exam-name">${escapeHtml(item.name)}</div>
              <div class="exam-date">${escapeHtml(formatDateTimeLabel(item.dateTime))}</div>
              ${venue}
            </div>
            <span class="exam-badge ${badgeClass}" style="min-width:54px;text-align:center">${badgeText}</span>
          </div>`;
      }).join('');
    }
  }
}
function setUserProfileDetails() {
  const name = sessionStorage.getItem('fy_user_name') || 'Student';
  const imgUrl = sessionStorage.getItem('fy_user_img');
  const topAvatar = document.getElementById('top-avatar');
  const sideAvatar = document.getElementById('sidebar-avatar');
  const sideName = document.getElementById('sidebar-name');
  const initials = name.slice(0, 2).toUpperCase();
  if (sideName) sideName.textContent = name;
  const welcomeName = document.getElementById('welcome-name');
  if (welcomeName) welcomeName.textContent = name.split(' ')[0];
  const updateAvatar = el => {
    if (!el) return;
    if (imgUrl) {
      el.innerHTML = `<img src="${escapeHtml(imgUrl)}" alt="Avatar" onerror="this.outerHTML='${initials}'"/>`;
    } else {
      el.textContent = initials;
    }
  };
  updateAvatar(topAvatar);
  updateAvatar(sideAvatar);
}

