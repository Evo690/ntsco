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
  const today = getIstDateKey();
  const nowMin = getIstHourMinute();
  const todayItems = items.filter(c => normalizeDateKey(c === null || c === void 0 ? void 0 : c.classDate) === today && !String((c === null || c === void 0 ? void 0 : c.classType) || '').includes('Doubt')).filter(c => searchMatch(c.subjects, c.classType, c.startTime, formatTimeLabel(c.startTime))).sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
  if (!todayItems.length) {
    root.innerHTML = '<div class="empty">No classes today</div>';
    return;
  }
  root.innerHTML = todayItems.map(c => {
    const done = timeToMinutes(c.startTime) < nowMin;
    return `<div class="class-item"><div class="class-time">${escapeHtml(formatTimeLabel(c.startTime))}</div><div class="class-info"><div class="class-name">${escapeHtml(c.subjects || 'Class')}</div><div class="class-teacher">${escapeHtml(c.classType || 'Live Class')}</div></div><span class="class-status">${done ? 'Earlier today' : 'Upcoming'}</span></div>`;
  }).join('');
}
let timetableDayResizeObserver;
function selectTimetableDay(date) {
  APP_STATE.timetableDay = date;
  renderTimetable(APP_STATE.timetable || []);
  document.querySelector('.schedule-day.active')?.focus({ preventScroll: true });
}
function renderTimetable(items) {
  timetableDayResizeObserver?.disconnect();
  const root = document.getElementById('timetable-grid');
  const range = document.getElementById('timetable-range');
  if (!root) return;
  const clean = items.filter(c => !String(c?.classType || '').includes('Doubt')).filter(c => searchMatch(c.subjects,c.classType,c.classDate,c.startTime)).map(c => ({...c,day:normalizeDateKey(c.classDate)})).filter(c=>c.day);
  root.classList.remove('tt-grid'); root.removeAttribute('style');
  if (!clean.length) { root.innerHTML='<div class="empty">No classes match this batch or search.</div>'; if(range) range.textContent='No scheduled classes'; return; }
  const dates=[...new Set(clean.map(c=>c.day))].sort();
  const selected=dates.includes(APP_STATE.timetableDay) ? APP_STATE.timetableDay : dates.includes(getIstDateKey()) ? getIstDateKey() : dates[0];
  APP_STATE.timetableDay=selected;
  if(range) range.textContent=`${formatDateLabel(dates[0])} — ${formatDateLabel(dates.at(-1))}`;
  const dayClasses=clean.filter(c=>c.day===selected).sort((a,b)=>timeToMinutes(a.startTime)-timeToMinutes(b.startTime));
  const date=new Date(selected+'T00:00:00');
  root.innerHTML=`<nav class="schedule-days" aria-label="Choose a day">${dates.map(day=>{const d=new Date(day+'T00:00:00');return `<button class="schedule-day ${day===selected?'active':''}" aria-pressed="${day===selected}" onclick="selectTimetableDay('${day}')"><span class="schedule-weekday">${d.toLocaleDateString('en',{weekday:'short'})}</span><strong class="schedule-date">${d.getDate()} ${d.toLocaleDateString('en',{month:'short'})}</strong><small>${clean.filter(c=>c.day===day).length} classes</small></button>`;}).join('')}</nav>
    <div class="schedule-layout"><section class="day-agenda"><header><div><span class="eyebrow">${selected===getIstDateKey()?'TODAY':'DAY PLAN'}</span><h2>${date.toLocaleDateString('en',{weekday:'long',day:'numeric',month:'long'})}</h2></div><span>${dayClasses.length} classes</span></header>
    <ol class="agenda-events">${dayClasses.map(c=>`<li><time>${escapeHtml(formatTimeLabel(c.startTime))}</time><div class="agenda-event"><h3>${escapeHtml(c.subjects||'Class')}</h3><p>${escapeHtml(c.classType||'Scheduled class')}</p></div></li>`).join('')}</ol></section>
    <aside class="schedule-overview"><span class="schedule-mark" aria-hidden="true">◷</span><h2>At a glance</h2><dl><div><dt>Classes in this schedule</dt><dd>${clean.length}</dd></div><div><dt>Teaching days</dt><dd>${dates.length}</dd></div><div><dt>Subjects</dt><dd>${new Set(clean.map(c=>c.subjects).filter(Boolean)).size}</dd></div></dl><button class="card-action" onclick="openAttendanceModal()">View attendance ↗</button></aside></div>`;
  const strip = root.querySelector('.schedule-days');
  const revealSelectedDay = () => {
    if (!strip.clientWidth) return;
    const active = strip.querySelector('.active');
    const bounds = active.getBoundingClientRect();
    strip.scrollLeft += bounds.left - strip.getBoundingClientRect().left - (strip.clientWidth - bounds.width) / 2;
  };
  timetableDayResizeObserver = new ResizeObserver(revealSelectedDay);
  timetableDayResizeObserver.observe(strip);
  revealSelectedDay();
}
function buildPaperDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '<div class="paper-date"><strong>—</strong><span>No date</span></div>';
  return `<div class="paper-date"><span>${date.toLocaleDateString('en',{month:'short'})}</span><strong>${date.getDate()}</strong><small>${date.getFullYear()}</small></div>`;
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
        <div role="button" tabindex="0" class="msg-group-item ${isUnread ? 'unread' : ''} ${currentGroupId === g.groupId ? 'active' : ''}" onclick="selectMessageGroup('${g.groupId}', '${escapeHtml(g.title)}')">
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
  createStudyDialog({id:'exam-syllabus-modal-backdrop', titleId:'exam-syllabus-title', title:'Exam syllabus', eyebrow:'EXAM HALL / SYLLABUS', bodyId:'exam-syllabus-body', actions:`<p id="exam-syllabus-meta"></p><button type="button" id="exam-syllabus-copy-btn" class="theme-mode-btn" onclick="copyTestSyllabusText()"><span id="exam-syllabus-copy-text">Copy syllabus</span></button>`});
}
window.closeTestSyllabusModal = function closeTestSyllabusModal() {
  closeStudyDialog(document.getElementById('exam-syllabus-modal-backdrop'));
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
  if (!subjects.length) {
    if (bodyEl) bodyEl.innerHTML = '<div class="empty">No syllabus details found.</div>';
  } else {
    if (bodyEl) {
      bodyEl.innerHTML = `<div class="syllabus-overview"><strong>${subjects.length}</strong><span>subject${subjects.length === 1 ? '' : 's'} in this paper</span></div><div class="syllabus-sections">${subjects.map((subject,index) => `<section class="syllabus-section"><header><span class="syllabus-number">${String(index + 1).padStart(2,'0')}</span><h3>${escapeHtml(subject.subject)}</h3><small>${subject.lines.length} topic${subject.lines.length === 1 ? '' : 's'}</small></header><ul>${subject.lines.map(line => `<li>${escapeHtml(line)}</li>`).join('')}</ul></section>`).join('')}</div>`;
    }
  }

  const copyText = document.getElementById('exam-syllabus-copy-text');
  if (copyText) copyText.textContent = 'Copy syllabus';

  openStudyDialog(backdrop);
};

window.copyTestSyllabusText = async function copyTestSyllabusText() {
  const test = window._activeSyllabusTest;
  if (!test || !test.syllabus) return;
  const lines = syllabusToLines(test.syllabus).filter(line => line.trim().toUpperCase() !== 'SYLLABUS');
  const label = document.getElementById('exam-syllabus-copy-text');
  try {
    await navigator.clipboard.writeText(`${test.testName || 'Exam Syllabus'}\n${lines.join('\n')}`);
    label.textContent = 'Copied';
  } catch (_) { label.textContent = 'Copy unavailable — select text instead'; }
};

function renderExamHall(tests) {
  if (Array.isArray(tests) && tests.length) {
    scanAndUploadOnlineTests(tests);
  }
  const root = document.getElementById('examhall-list');
  const count = document.getElementById('examhall-count');
  if (!root) return;
  const overview = document.getElementById('exam-overview');
  if (overview) overview.innerHTML = `<div><span>Papers loaded</span><strong>${tests.length}</strong></div><div><span>Published results</span><strong>${tests.filter(t=>t.isPublish).length}</strong></div><div><span>Awaiting publication</span><strong>${tests.filter(t=>!t.isPublish).length}</strong></div>`;
  updateExamLoadMoreButton();
  const tab = activeSubTab('examhall', 'all');
  const filtered = tests.filter(t => {
    const published = Boolean(t.isPublish);
    const dt = new Date(t.examDate);
    const now = new Date();
    const status = Number.isNaN(dt.getTime()) ? published ? 'done' : 'upcoming' : published ? 'done' : dt.toDateString() === now.toDateString() ? 'live' : dt > now ? 'upcoming' : 'live';
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
  const getExamStatus = test => {
    const dt = new Date(test.examDate);
    if (Number.isNaN(dt.getTime())) return test.isPublish ? 'done' : 'upcoming';
    if (test.isPublish) return 'done';
    const now = new Date();
    if (dt.toDateString() === now.toDateString()) return 'live';
    return dt > now ? 'upcoming' : 'live';
  };
  const active = filtered.filter(t => getExamStatus(t) !== 'done').length;
  if (count) count.textContent = `${active} active test${active === 1 ? '' : 's'}`;
  root.innerHTML = filtered.map(test => {
    const status = getExamStatus(test);
    const isDone = status === 'done';
    const appeared = test.appeared || {};
    const testId = String(test.id || test.testPaperId || '');
    const published = Boolean(test.isPublish);
    const date = formatDateLabel(test.examDate || test.testDate || test.startDate);
    const hasMarks = appeared.totalMarks != null && appeared.totalSubjectMarks != null;
    const rank = appeared.rank != null ? `Rank #${appeared.rank}` : '';
    const badgeText = published ? 'Published' : status === 'live' ? 'Live' : 'Scheduled';
    const badgeClass = published ? 'badge-done' : status === 'live' ? 'badge-live' : 'badge-upcoming';
    const statusColor = published ? 'var(--green)' : status === 'live' ? 'var(--red)' : 'var(--amber)';

    const metaParts = [escapeHtml(date)];
    if (test.duration) metaParts.push(`${test.duration} min`);
    if (test.isOffline != null) metaParts.push(test.isOffline ? 'Offline' : 'Online');
    if (testId) metaParts.push(`ID: ${escapeHtml(testId)}`);

    const hasSyllabus = hasTestSyllabus(test.syllabus);
    const resultButton = isDone && testId ? `<button class="start-btn gray" style="margin-top:0" onclick="openExamResult('${escapeHtml(testId)}')">View Result</button>` : '';
    const syllabusButton = hasSyllabus ? `<button class="theme-mode-btn exam-syllabus-btn" onclick="openTestSyllabusModal('${escapeHtml(testId)}', event)" title="View Syllabus">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-1px"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
      <span>View syllabus</span>
    </button>` : '';

    const actionsHtml = (resultButton || syllabusButton) ? `<div class="exam-hall-actions">${resultButton}${syllabusButton}</div>` : '';

    const scoreHtml = hasMarks ? `
      <div class="exam-hall-right">
        <div class="exam-hall-score" style="color:var(--text)">${escapeHtml(appeared.totalMarks)}/${escapeHtml(appeared.totalSubjectMarks)}</div>
        ${rank ? `<div class="exam-hall-rank">${escapeHtml(rank)}</div>` : ''}
      </div>` : '';

    return `<article class="paper-card"><header>${buildPaperDate(test.examDate || test.testDate || test.startDate)}<div><span class="paper-status">${published?'Results published':status==='upcoming'?'Scheduled':'Awaiting result'}</span><h2>${escapeHtml(test.testName||'Exam')}</h2></div></header><div class="paper-meta">${metaParts.join(' · ')}</div>${scoreHtml}<footer>${actionsHtml || '<span class="result-sub">No published result yet.</span>'}${!published && testId ? `<button class="card-action" onclick="openEraForcedResult('${escapeHtml(testId)}')">Check result directly ↗</button>`:''}</footer></article>`;
  }).join('');
  updateExamLoadMoreButton();
}
function renderEraTests(tests) {
  if (Array.isArray(tests) && tests.length) {
    scanAndUploadOnlineTests(tests);
  }
  const root = document.getElementById('era-list');
  const count = document.getElementById('era-count');
  if (!root) return;
  updateEraLoadMoreButton();
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
  root.innerHTML = filtered.map(test => {
    const testId = String(test.id || test.testPaperId || '');
    const published = Boolean(test.isPublish);
    const date = formatDateLabel(test.examDate || test.testDate || test.startDate);
    const badgeText = published ? 'Published' : 'Not Published';
    const badgeClass = published ? 'badge-done' : 'badge-upcoming';
    const statusColor = published ? 'var(--green)' : 'var(--amber)';

    const metaParts = [escapeHtml(date)];
    if (test.duration) metaParts.push(`${test.duration} min`);
    if (test.isOffline != null) metaParts.push(test.isOffline ? 'Offline' : 'Online');
    if (testId) metaParts.push(`ID: ${escapeHtml(testId)}`);

    const hasSyllabus = hasTestSyllabus(test.syllabus);
    const forceButton = testId ? `<button class="start-btn gray" style="margin-top:0" onclick="openEraForcedResult('${escapeHtml(testId)}')">View analysis →</button>` : '';
    const syllabusButton = hasSyllabus ? `<button class="theme-mode-btn exam-syllabus-btn" onclick="openTestSyllabusModal('${escapeHtml(testId)}', event)" title="View Syllabus">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-1px"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
      <span>View syllabus</span>
    </button>` : '';

    const actionsHtml = (forceButton || syllabusButton) ? `<div class="exam-hall-actions">${forceButton}${syllabusButton}</div>` : '';

    const appeared = test.appeared || {};
    const marks = appeared.totalMarks != null && appeared.totalSubjectMarks != null ? `<div class="result-ledger-score"><strong>${escapeHtml(appeared.totalMarks)}</strong><span>/ ${escapeHtml(appeared.totalSubjectMarks)}</span></div>` : '';
    return `<article class="result-ledger-row">${buildPaperDate(test.examDate || test.testDate || test.startDate)}<div class="result-ledger-main"><h2>${escapeHtml(test.testName || test.name || 'Exam')}</h2><p>${metaParts.join(' · ')}</p><small>${published?'Published':'Unpublished · direct lookup available'}</small></div>${marks}<div class="result-ledger-actions">${forceButton}${syllabusButton}</div></article>`;
  }).join('');
  updateEraLoadMoreButton();
}
function updateExamLoadMoreButton() {
  const btn = document.getElementById('examhall-load-more');
  if (!btn) return;
  const total = APP_STATE.examTotal || APP_STATE.tests.length;
  const hasMore = APP_STATE.tests.length < total;
  btn.hidden = !hasMore;
  btn.style.display = hasMore ? 'block' : 'none';
  btn.textContent = hasMore ? `Show More (${APP_STATE.tests.length}/${total})` : 'All tests loaded';
}
function updateEraLoadMoreButton() {
  const btn = document.getElementById('era-load-more');
  if (!btn) return;
  const total = APP_STATE.eraTotal || APP_STATE.eraTests.length;
  const hasMore = APP_STATE.eraTests.length < total;
  btn.hidden = !hasMore;
  btn.style.display = hasMore ? 'block' : 'none';
  btn.textContent = hasMore ? `Show More (${APP_STATE.eraTests.length}/${total})` : 'All tests loaded';
}
function getCalendarExamStatus(value) {
  const date = parseExamDateTime(value);
  if (Number.isNaN(date.getTime())) return {key:'undated', label:'Date pending'};
  const day = new Intl.DateTimeFormat('en-CA', {timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'});
  if (day.format(date) === day.format(new Date())) return {key:'today', label:'Today'};
  return date < new Date() ? {key:'past', label:'Completed'} : {key:'upcoming', label:'Upcoming'};
}
function buildCalendarDatePlate(value) {
  const date = parseExamDateTime(value);
  if (Number.isNaN(date.getTime())) return '<span>Date</span><strong>—</strong><small>To be confirmed</small>';
  const options = {timeZone:'Asia/Kolkata'};
  return `<span>${date.toLocaleDateString('en-IN',{...options,weekday:'short'})}</span><strong>${date.toLocaleDateString('en-IN',{...options,day:'2-digit'})}</strong><small>${date.toLocaleDateString('en-IN',{...options,month:'short',year:'numeric'})}</small>`;
}
function renderExamCalendar(entries) {
  const root = document.getElementById('examcal-list');
  const title = document.getElementById('examcal-title');
  if (!root) return;
  // Keep the complete collection: searching must not erase later detail destinations.
  const normalized = entries.map(item => {
    const lines = Array.isArray(item.syllabusLines) && item.syllabusLines.length ? item.syllabusLines : syllabusToLines(item.syllabus || '');
    return {...item,
      name:item.name || item.testName || item.examName || 'Exam',
      dateTime:item.dateTime || item.testDateTime || item.examDate || item.date,
      mode:item.mode || item.testMode || item.examMode || '',
      venue:formatVenueText(item.venue || ''), syllabusLines:lines,
      syllabusPreview:item.syllabusPreview || lines.slice(0,2).join(' · ')
    };
  }).sort((a,b)=>(parseExamDateTime(b.dateTime).getTime() || 0)-(parseExamDateTime(a.dateTime).getTime() || 0));
  APP_STATE.calendarEntries = normalized;
  const visible = normalized.map((item,index)=>({item,index})).filter(({item})=>searchMatch(item.name,item.dateTime,item.mode,item.venue,item.syllabusPreview));
  if (title) title.textContent = `${visible.length} ${visible.length === 1 ? 'exam' : 'exams'}${visible.length !== normalized.length ? ` of ${normalized.length}` : ' in your calendar'}`;
  root.innerHTML = visible.length ? visible.map(({item,index})=>{
    const status = getCalendarExamStatus(item.dateTime);
    return `<article class="calendar-paper"><header><div class="calendar-date-plate">${buildCalendarDatePlate(item.dateTime)}</div><div class="calendar-paper-heading"><span class="calendar-status ${status.key}">${status.label}</span><h2>${escapeHtml(item.name)}</h2><p>${escapeHtml(item.mode || 'Mode not specified')}</p></div></header><dl class="calendar-paper-facts"><div><dt>When</dt><dd>${escapeHtml(formatDateTimeLabel(item.dateTime))}</dd></div><div><dt>Where</dt><dd>${escapeHtml(item.venue || 'Venue not announced')}</dd></div></dl><footer><span>${item.syllabusLines.length ? 'Syllabus available' : 'Syllabus pending'}</span><button type="button" class="calendar-details-button" onclick="openCalendarTest(${index})">View details <span aria-hidden="true">↗</span></button></footer></article>`;
  }).join('') : '<div class="empty">No exams match this calendar or search.</div>';
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
  grid.innerHTML = filtered.map((c, i) => {
    const cid = Number(c.courseId ?? c.id ?? c.courseID ?? 0);
    const image = c.image || c.courseImage || '';
    const typeLabel = c.isLive ? 'Live' : c.isExamType ? 'Exam course' : 'Classroom';
    return `<article class="course-record">
      <div class="course-record-icon">${image ? `<img src="${escapeHtml(image)}" alt="" />` : String(i + 1).padStart(2, '0')}</div>
      <div><h3>${escapeHtml(c.courseName || 'Untitled course')}</h3><small>${escapeHtml(c.goal || 'Course')} / ${escapeHtml(typeLabel)}</small></div>
      <div class="course-record-meta type-meta"><span>Starts</span>${escapeHtml(formatDateLabel(c.startDate))}</div>
      <div class="course-record-meta"><span>Expires</span>${escapeHtml(formatDateLabel(c.expireyDate))}</div>
      <button class="course-btn" onclick="openCourseDetail(${cid})" ${cid ? '' : 'disabled'}>${c.isLive ? 'Join' : 'Open'} ↗</button>
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
  createStudyDialog({id:'att-modal-backdrop', titleId:'att-dialog-title', title:'Your attendance', eyebrow:'CLASSES / ATTENDANCE', bodyId:'att-modal-body', actions:`<form class="detail-filters" onsubmit="event.preventDefault();renderAttendanceModal()"><label>Month<select aria-label="Attendance month" id="att-month"></select></label><label>Year<select aria-label="Attendance year" id="att-year"></select></label><button type="submit" class="theme-mode-btn active">View</button></form>`});
}
function ensureResultModal() {
  createStudyDialog({id:'result-modal-backdrop',titleId:'result-dialog-title',title:'Result analysis',eyebrow:'RESULTS',bodyId:'result-modal-body'});
}
function closeResultModal() { closeStudyDialog(document.getElementById('result-modal-backdrop')); }
function showResultModal(contentHtml) {
  ensureResultModal();
  document.getElementById('result-modal-body').innerHTML = contentHtml;
  openStudyDialog(document.getElementById('result-modal-backdrop'));
}
function buildResultAnalysisHtml(analysis, selected, options = {}) {
  var _r$totalInCorrect, _r$totalUnAttempted;
  const r = (analysis === null || analysis === void 0 ? void 0 : analysis.result) || {};
  const testName = (analysis === null || analysis === void 0 ? void 0 : analysis.testName) || (selected === null || selected === void 0 ? void 0 : selected.testName) || (selected === null || selected === void 0 ? void 0 : selected.name) || 'Exam';
  const fmt = v => v === null || v === undefined || v === '' ? '-' : v;
  const topTotal = Array.isArray(r.topScoreTotal) && r.topScoreTotal.length ? r.topScoreTotal.join(', ') : '-';
  const performanceMap = new Map(((analysis === null || analysis === void 0 ? void 0 : analysis.subjectPerformance) || []).map(p => [String(p.subjectName || '').toLowerCase(), p.performance]));
  const topBySubject = {};
  if (Array.isArray(r.topScoreSubjectData)) {
    r.topScoreSubjectData.forEach(item => {
      var _item$subjectId;
      const key = String((_item$subjectId = item.subjectId) !== null && _item$subjectId !== void 0 ? _item$subjectId : '');
      if (!topBySubject[key]) topBySubject[key] = [];
      topBySubject[key].push(item.totalMarks);
    });
  }
  const subjectRows = Array.isArray(r.subjectData) ? r.subjectData.map(s => {
    var _s$totalCorrect, _ref3, _s$totalInCorrect, _ref4, _s$totalUnAttempted, _s$totalAttempted, _topBySubject$String, _s$subjectId;
    const correct = Number((_s$totalCorrect = s.totalCorrect) !== null && _s$totalCorrect !== void 0 ? _s$totalCorrect : 0);
    const incorrect = Number((_ref3 = (_s$totalInCorrect = s.totalInCorrect) !== null && _s$totalInCorrect !== void 0 ? _s$totalInCorrect : s.totalIncorrect) !== null && _ref3 !== void 0 ? _ref3 : 0);
    const unattempted = Number((_ref4 = (_s$totalUnAttempted = s.totalUnAttempted) !== null && _s$totalUnAttempted !== void 0 ? _s$totalUnAttempted : s.totalUnattempted) !== null && _ref4 !== void 0 ? _ref4 : 0);
    const attempted = Number((_s$totalAttempted = s.totalAttempted) !== null && _s$totalAttempted !== void 0 ? _s$totalAttempted : correct + incorrect);
    const subjectTopScores = ((_topBySubject$String = topBySubject[String((_s$subjectId = s.subjectId) !== null && _s$subjectId !== void 0 ? _s$subjectId : '')]) === null || _topBySubject$String === void 0 ? void 0 : _topBySubject$String.join(', ')) || '-';
    const performance = performanceMap.get(String(s.subjectName || '').toLowerCase()) || '-';
    const average = s.totalAvgMarks ?? s.totalAvg;
    const highest = s.highestMarks ?? s.totalHighest;
    const percent = chartPercent(s.totalMarks,s.totalSubjectMarks);
    return `<article class="subject-result-card"><header class="subject-result-head"><h3 class="subject-result-name">${escapeHtml(s.subjectName || 'Subject')}</h3><div class="subject-result-score">${escapeHtml(fmt(s.totalMarks))}<small> / ${escapeHtml(fmt(s.totalSubjectMarks))}</small></div></header>
      ${percent !== null ? `<div class="subject-score-track" aria-hidden="true"><i style="width:${Math.min(100,Math.max(0,percent))}%"></i></div>`:''}
      <dl class="subject-key-metrics"><div><dt>Subject rank</dt><dd>${escapeHtml(fmt(s.rank ?? s.subjectRank))}</dd></div><div><dt>Average</dt><dd>${escapeHtml(fmt(average))}</dd></div><div><dt>Highest</dt><dd>${escapeHtml(fmt(highest))}</dd></div><div><dt>Percentile</dt><dd>${escapeHtml(fmt(s.percentile))}</dd></div></dl>
      <div class="subject-answer-counts"><span><b>${escapeHtml(fmt(s.totalCorrect))}</b> correct</span><span><b>${escapeHtml(fmt(s.totalInCorrect ?? s.totalIncorrect))}</b> incorrect</span><span><b>${escapeHtml(fmt(s.totalUnAttempted ?? s.totalUnattempted))}</b> skipped</span></div>
      <details class="subject-more"><summary>Question details</summary><dl><div><dt>Attempted</dt><dd>${escapeHtml(fmt(s.totalAttempted ?? ((s.totalCorrect != null && (s.totalInCorrect ?? s.totalIncorrect) != null) ? correct+incorrect : null)))}</dd></div><div><dt>Questions</dt><dd>${escapeHtml(fmt(s.totalQuestion))}</dd></div><div><dt>Not visited</dt><dd>${escapeHtml(fmt(s.totalNotVisited))}</dd></div><div><dt>Top scores</dt><dd>${escapeHtml(subjectTopScores)}</dd></div><div><dt>Performance</dt><dd>${escapeHtml(performance)}</dd></div></dl></details></article>`;
  }).join('') : '<div class="empty">No subject breakdown</div>';
  const appearedRaw = options.includeRaw && options.appeared ? `<details style="margin-top:12px"><summary style="font-size:12px;color:var(--accent);cursor:pointer">Appeared result raw data</summary><pre style="margin-top:8px;background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:10px;white-space:pre-wrap;overflow:auto;font-size:11px;color:var(--text2)">${escapeHtml(JSON.stringify(options.appeared, null, 2))}</pre></details>` : '';
  const analysisRaw = options.includeRaw ? `<details style="margin-top:10px"><summary style="font-size:12px;color:var(--accent);cursor:pointer">Analysis raw data</summary><pre style="margin-top:8px;background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:10px;white-space:pre-wrap;overflow:auto;font-size:11px;color:var(--text2)">${escapeHtml(JSON.stringify(analysis, null, 2))}</pre></details>` : '';
  const omrRow = analysis !== null && analysis !== void 0 && analysis.omrSheetPath ? `<a class="result-link" href="${escapeHtml(analysis.omrSheetPath)}" target="_blank" rel="noopener noreferrer">OMR Sheet</a>` : '';
  const answerKeyRow = analysis !== null && analysis !== void 0 && analysis.answerKeyFileUrl ? `<a class="result-link" href="${escapeHtml(analysis.answerKeyFileUrl)}" target="_blank" rel="noopener noreferrer">Answer Key</a>` : '';
  const leaderboardButton = options.showLeaderboardButton || options.leaderboard ? `<button class="start-btn gray" style="margin-top:0" onclick="openCurrentLeaderboard()">Leaderboard</button>` : '';
  const pseudoLeaderboardButton = `<button class="start-btn" style="margin-top:0" onclick="generatePseudoLeaderboardFromResult()" title="Reconstruct complete Rank 1..N leaderboard using RankNet">Pseudo Leaderboard</button>`;
  const hasSolutions = Array.isArray(r.questionData) && r.questionData.length > 0;
  const solutionsButton = hasSolutions ? `<button class="start-btn gray" style="margin-top:0" onclick="openCurrentSolutions()">Solutions</button>` : '';
  const downloadPdfButton = `<button class="start-btn" style="margin-top:0" onclick="downloadResultPdf('${escapeHtml((analysis === null || analysis === void 0 ? void 0 : analysis.testPaperId) || (selected === null || selected === void 0 ? void 0 : selected.id) || (selected === null || selected === void 0 ? void 0 : selected.testPaperId) || '')}', ${Boolean(options.forced)}, this)">Download PDF</button>`;
  const fullMetrics = `      <div class="result-grid">
        <div class="result-metric"><div class="result-label">Attempted</div><div class="result-value">${escapeHtml(fmt(r.totalAttempted))}</div></div>
        <div class="result-metric"><div class="result-label">Correct</div><div class="result-value" style="color:var(--green)">${escapeHtml(fmt(r.totalCorrect))}</div></div>
        <div class="result-metric"><div class="result-label">Wrong</div><div class="result-value" style="color:var(--red)">${escapeHtml(fmt((_r$totalInCorrect = r.totalInCorrect) !== null && _r$totalInCorrect !== void 0 ? _r$totalInCorrect : r.totalIncorrect))}</div></div>
        <div class="result-metric"><div class="result-label">Unattempted</div><div class="result-value">${escapeHtml(fmt((_r$totalUnAttempted = r.totalUnAttempted) !== null && _r$totalUnAttempted !== void 0 ? _r$totalUnAttempted : r.totalUnattempted))}</div></div>
        <div class="result-metric"><div class="result-label">Average</div><div class="result-value">${escapeHtml(fmt(r.totalAvg))}</div></div>
        <div class="result-metric"><div class="result-label">Highest</div><div class="result-value">${escapeHtml(fmt(r.totalHighest))}</div></div>
        <div class="result-metric"><div class="result-label">Top Scores</div><div class="result-value">${escapeHtml(topTotal)}</div></div>
        <div class="result-metric"><div class="result-label">Students</div><div class="result-value">${escapeHtml(fmt(analysis === null || analysis === void 0 ? void 0 : analysis.totalStudent))}</div></div>
        <div class="result-metric"><div class="result-label">City Rank</div><div class="result-value">${escapeHtml(fmt(analysis === null || analysis === void 0 ? void 0 : analysis.cityRank))}</div></div>
      </div>
`;
  return `<section class="result-recap result-recap-focused">
    <header class="result-heading-block"><div><div class="result-title">${escapeHtml(testName)}</div><div class="result-sub">${escapeHtml(analysis?.attemptDate || '')}${analysis?.testPaperId ? ` · Paper ${escapeHtml(analysis.testPaperId)}` : ''}</div></div></header>
    <div class="result-links">${downloadPdfButton}${solutionsButton}${leaderboardButton}${pseudoLeaderboardButton}${omrRow}${answerKeyRow}</div>
    <div class="score-story"><span class="eyebrow">YOUR SCORE</span><div class="score-story-value">${escapeHtml(fmt(r.totalMarks))} <small>/ ${escapeHtml(fmt(r.totalSubjectMarks))}</small></div><div class="score-comparison"><div>Average<b>${escapeHtml(fmt(r.totalAvg))}</b></div><div>Highest<b>${escapeHtml(fmt(r.totalHighest))}</b></div></div></div>
    <div class="rank-summary"><div><span>Overall rank</span><strong>${escapeHtml(fmt(analysis?.rank))}</strong></div><div><span>Batch rank</span><strong>${escapeHtml(fmt(analysis?.batchRank))}</strong></div><div><span>Percentile</span><strong>${escapeHtml(fmt(analysis?.percentile))}</strong></div></div>
    <section class="subject-overview"><header><h2>Subject performance</h2><p>Your marks, compared with the average and highest scores.</p></header><div class="subject-cards">${subjectRows}</div></section>
    <div class="outcomes-panel">${buildOutcomeChart(r)}</div><div class="subject-chart">${buildSubjectChart(r)}</div>
    <details class="result-extra"><summary>More result statistics</summary>${fullMetrics}</details>
    </section>${appearedRaw}${analysisRaw}`;

}
function buildLeaderboardHtml(analysis, leaderboard) {
  var _analysis$result;
  const rows = Array.isArray(leaderboard === null || leaderboard === void 0 ? void 0 : leaderboard.leaderboardScore) ? leaderboard.leaderboardScore.slice(0, 50) : [];
  if (!rows.length) return '<div class="empty">No leaderboard data found for this test.</div>';
  const subjectNameById = {};
  const subjects = (analysis === null || analysis === void 0 || (_analysis$result = analysis.result) === null || _analysis$result === void 0 ? void 0 : _analysis$result.subjectData) || [];
  if (Array.isArray(subjects)) {
    subjects.forEach(s => {
      if (s.subjectId != null) subjectNameById[String(s.subjectId)] = s.subjectName || `Subject ${s.subjectId}`;
    });
  }
  const fmt = v => v === null || v === undefined || v === '' ? '-' : v;
  const rowData = rows.map(row => {
    const subjectMarks = Array.isArray(row.subjectPerformance) ? row.subjectPerformance.map((s, idx) => {
      var _s$subjectId2;
      const subjectName = s.subjectName || subjectNameById[String((_s$subjectId2 = s.subjectId) !== null && _s$subjectId2 !== void 0 ? _s$subjectId2 : '')] || `S${idx + 1}`;
      return {
        subjectName,
        totalMarks: fmt(s.totalMarks)
      };
    }) : [];
    return {
      ...row,
      subjectMarks
    };
  });
  const highlights = rowData.filter(row => Number(row.ranks) >= 1 && Number(row.ranks) <= 3).sort((a,b) => Number(a.ranks)-Number(b.ranks)).slice(0,3);
  const highlightHtml = highlights.length ? `<div class="leaderboard-highlights">${highlights.map(row => `<div class="standing-highlight"><span class="standing-rank">#${escapeHtml(fmt(row.ranks))}</span><div><small>${escapeHtml(row.studentName || `Student ${fmt(row.examId)}`)}</small><strong>${escapeHtml(fmt(row.totalMarks))}<em>marks</em></strong></div></div>`).join('')}</div>` : '';
  return `${highlightHtml}<div class="leaderboard-wrap"><table class="leaderboard-table">
      <thead><tr><th>Rank</th><th>Student</th><th>Total</th><th>Subject Marks</th></tr></thead>
      <tbody>${rowData.map(row => {
    const subjectMarks = row.subjectMarks.map(s => `<span class="leaderboard-subject">${escapeHtml(s.subjectName)}: ${escapeHtml(s.totalMarks)}</span>`).join('');
    return `<tr>
          <td class="leaderboard-rank">#${escapeHtml(fmt(row.ranks))}</td>
          <td>${escapeHtml(row.studentName || `Student ${fmt(row.examId)}`)}</td>
          <td class="leaderboard-score">${escapeHtml(fmt(row.totalMarks))}</td>
          <td><div class="leaderboard-subjects">${subjectMarks || '-'}</div></td>
        </tr>`;
  }).join('')}</tbody>
    </table></div>
    <div class="leaderboard-card-list">${rowData.map(row => {
    const subjectMarks = row.subjectMarks.map(s => `<span class="leaderboard-subject">${escapeHtml(s.subjectName)}: ${escapeHtml(s.totalMarks)}</span>`).join('');
    return `<div class="leaderboard-card">
        <div class="leaderboard-card-top">
          <div style="display:flex;align-items:center;gap:10px;min-width:0">
            <div class="leaderboard-rank-pill">#${escapeHtml(fmt(row.ranks))}</div>
            <div style="font-size:12px;color:var(--text);font-weight:600;min-width:0;overflow:hidden;text-overflow:ellipsis">${escapeHtml(row.studentName || `Student ${fmt(row.examId)}`)}</div>
          </div>
          <div class="leaderboard-card-score"><span class="leaderboard-score">${escapeHtml(fmt(row.totalMarks))}</span><span style="font-size:10px;color:var(--text2)">marks</span></div>
        </div>
        <div class="leaderboard-subjects">${subjectMarks || '-'}</div>
      </div>`;
  }).join('')}</div>`;
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
      subEl.innerHTML = 'No result available yet';
      if (batchRankEl) batchRankEl.textContent = '--';
      if (batchRankSubEl) batchRankSubEl.textContent = 'No rank available yet';
    } else {
      var _ref5, _forced$batchRank, _forced$marks, _forced$totalMarks;
      const rankVal = (_ref5 = (_forced$batchRank = forced.batchRank) !== null && _forced$batchRank !== void 0 ? _forced$batchRank : forced.rank) !== null && _ref5 !== void 0 ? _ref5 : null;
      nameEl.textContent = forced.testName || 'Latest Test';
      scoreEl.textContent = (_forced$marks = forced.marks) !== null && _forced$marks !== void 0 ? _forced$marks : 'N/A';
      let subHtml = `out of ${(_forced$totalMarks = forced.totalMarks) !== null && _forced$totalMarks !== void 0 ? _forced$totalMarks : '-'}`;
      if (rankVal != null) subHtml += ` · Rank #${rankVal}`;
      subEl.innerHTML = subHtml;
      if (batchRankEl) batchRankEl.textContent = rankVal != null ? `#${rankVal}` : '--';
      if (batchRankSubEl) batchRankSubEl.textContent = forced.testName ? forced.testName : 'Latest available result';
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
