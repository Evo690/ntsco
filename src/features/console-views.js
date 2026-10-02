/* Presentation-only views. API calls, access checks and result handlers stay in
   their feature modules. These components don't inherit legacy card markup. */
function consoleValue(value) {
  return value === null || value === undefined || value === '' ? '—' : String(value);
}
function consoleList(value) {
  return Array.isArray(value) ? value : [];
}
function consoleArgument(value) {
  return escapeHtml(JSON.stringify(String(value)));
}
function subjectTone(subject) {
  const name = String(subject || '').toLowerCase();
  if (name.includes('phy')) return 'cyan';
  if (name.includes('chem')) return 'violet';
  if (name.includes('math')) return 'amber';
  if (/bio|bot|zoo/.test(name)) return 'lime';
  return 'cyan';
}
function consoleDateKey(value) {
  const key = normalizeDateKey(value);
  return /^\d{4}-\d{2}-\d{2}$/.test(key) && !Number.isNaN(new Date(`${key}T12:00:00`).getTime()) ? key : '';
}
function paperState(test) {
  if (test.isPublish) return { key: 'published', label: 'Published' };
  const key = consoleDateKey(test.examDate || test.testDate || test.startDate);
  if (!key) return { key: 'pending', label: 'Unpublished' };
  const today = getIstDateKey();
  if (key > today) return { key: 'scheduled', label: 'Scheduled' };
  if (key === today) return { key: 'live', label: 'Today' };
  return { key: 'pending', label: 'Awaiting result' };
}
function buildPaperIndex(tests, forced = false) {
  return `<div class="paper-index" aria-label="${forced ? 'Result papers' : 'Examination papers'}">
    <div class="paper-index-head"><span>DATE</span><span>PAPER / STATUS</span><span>SCORE</span><span>ACTIONS</span></div>
    ${tests.map((test, index) => {
      const id = String(test.id || test.testPaperId || '');
      const date = consoleDateKey(test.examDate || test.testDate || test.startDate);
      const parts = date ? new Date(`${date}T12:00:00`).toLocaleDateString('en-GB', {day:'2-digit',month:'short',year:'numeric'}).split(' ') : ['—','UNDATED',''];
      const state = paperState(test);
      const appeared = test.appeared || {};
      const score = appeared.totalMarks != null && appeared.totalSubjectMarks != null
        ? `<strong>${escapeHtml(appeared.totalMarks)}<small>/${escapeHtml(appeared.totalSubjectMarks)}</small></strong>${appeared.rank != null ? `<span>Rank ${escapeHtml(appeared.rank)}</span>` : ''}`
        : '<span class="paper-score-pending">Not loaded</span>';
      const action = id && (forced || test.isPublish) ? `<button class="console-button accent" onclick="${forced ? 'openEraForcedResult' : 'openExamResult'}(${consoleArgument(id)})">${forced ? 'Open result' : 'View Result'} <span aria-hidden="true">↗</span></button>` : '';
      return `<article class="paper-row" data-state="${state.key}">
        <div class="paper-date"><strong>${parts[0]}</strong><span>${escapeHtml(parts[1])} ${escapeHtml(parts[2])}</span></div>
        <div class="paper-identity"><div class="paper-eyebrow"><code>${escapeHtml(id ? `#${id}` : String(index + 1).padStart(2,'0'))}</code><span class="paper-status"><i aria-hidden="true"></i>${state.label}</span></div>
          <h2>${escapeHtml(test.testName || test.name || 'Untitled examination')}</h2>
          <p>${test.isOffline != null ? (test.isOffline ? 'Offline' : 'Online') : 'Exam'}${test.duration ? ` <span>/</span> ${escapeHtml(test.duration)} min` : ''}</p>
        </div>
        <div class="paper-score">${score}</div>
        <div class="paper-actions">${action}${hasTestSyllabus(test.syllabus) ? `<button class="console-button paper-syllabus-button" onclick="openTestSyllabusModal(${consoleArgument(id)}, event)"><span aria-hidden="true">≡</span>View syllabus</button>` : ''}</div>
      </article>`;
    }).join('')}</div>`;
}
function scoreRatio(value, max) {
  if (value == null || value === '' || max == null || max === '') return null;
  const n = Number(value), total = Number(max);
  return Number.isFinite(n) && Number.isFinite(total) && total > 0 ? n / total * 100 : null;
}
function consoleMetric(label, value, tone = '') {
  return `<div class="report-datum ${tone}"><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(consoleValue(value))}</dd></div>`;
}
function reportComparison(label, value, max, tone) {
  const ratio = scoreRatio(value, max);
  return `<div class="comparison-row ${tone}"><span>${label}</span><div class="comparison-track" aria-hidden="true"><i style="width:${ratio == null ? 0 : Math.min(100,Math.max(0,ratio))}%"></i></div><strong>${escapeHtml(consoleValue(value))}</strong></div>`;
}
function buildReportConsole(analysis, selected, options = {}) {
  const a = analysis || {}, r = a.result || {};
  const name = a.testName || selected?.testName || selected?.name || 'Exam';
  const id = a.testPaperId || selected?.id || selected?.testPaperId || '';
  const ratio = scoreRatio(r.totalMarks, r.totalSubjectMarks);
  const fraction = ratio == null ? 0 : Math.min(100,Math.max(0,ratio));
  const tops = Array.isArray(r.topScoreTotal) && r.topScoreTotal.length ? r.topScoreTotal.join(', ') : null;
  const performance = new Map(consoleList(a.subjectPerformance).map(s=>[String(s.subjectName||'').toLowerCase(),s.performance]));
  const subjects = Array.isArray(r.subjectData) ? r.subjectData : [];
  const subjectHtml = subjects.map((s,index)=>{
    const correct = s.totalCorrect ?? 0;
    const wrong = s.totalInCorrect ?? s.totalIncorrect ?? 0;
    const skipped = s.totalUnAttempted ?? s.totalUnattempted ?? 0;
    const topScores = consoleList(r.topScoreSubjectData).filter(t=>String(t.subjectId)===String(s.subjectId)).map(t=>t.totalMarks).join(', ');
    const percent = scoreRatio(s.totalMarks,s.totalSubjectMarks);
    return `<article class="subject-ledger tone-${subjectTone(s.subjectName)}">
      <header><span class="subject-index">${String(index+1).padStart(2,'0')}</span><h3>${escapeHtml(s.subjectName || 'Subject')}</h3><strong>${escapeHtml(consoleValue(s.totalMarks))}<small> / ${escapeHtml(consoleValue(s.totalSubjectMarks))}</small></strong></header>
      <div class="subject-meter" aria-hidden="true"><i style="width:${percent == null ? 0 : Math.min(100,Math.max(0,percent))}%"></i></div>
      <dl class="subject-facts">${consoleMetric('Average',s.totalAvgMarks)}${consoleMetric('Highest',s.highestMarks)}${consoleMetric('Rank',s.rank)}${consoleMetric('Percentile',s.percentile)}</dl>
      <details class="subject-details"><summary>Answer breakdown <span>+</span></summary><dl class="subject-audit">
        ${consoleMetric('Attempted',s.totalAttempted ?? Number(correct)+Number(wrong))}${consoleMetric('Correct',correct,'lime')}${consoleMetric('Wrong',wrong,'rose')}${consoleMetric('Unattempted',skipped)}${consoleMetric('Questions',s.totalQuestion)}${consoleMetric('Not visited',s.totalNotVisited)}${consoleMetric('Top Scores',topScores)}${consoleMetric('Performance',performance.get(String(s.subjectName || '').toLowerCase()))}
      </dl></details>
    </article>`;
  }).join('');
  const flags = [a.isLiveTest ? 'Live test' : a.isLiveTest === false ? 'Offline result' : 'Result analysis',a.isLeaderboard && 'Leaderboard',a.isShowScoreSheet && 'Score sheet',a.isShowQuestionsCount && 'Question counts',a.isShowComparisonTestScore && 'Comparison score',a.isShowCandidateTopScore && 'Top scores'].filter(Boolean);
  return `<section class="report-console">
    <header class="report-mast"><div><div class="console-eyebrow"><span class="signal-dot"></span>RESULT FILE <span>/</span> ${escapeHtml(id || '—')}</div><h2>${escapeHtml(name)}</h2><p>${escapeHtml(a.attemptDate || 'Date unavailable')}</p></div><code class="report-watermark" aria-hidden="true">R_</code></header>
    ${options.forced ? '<div class="report-mode-note">Direct result lookup · retrieved independently of publish status.</div>' : ''}
    <nav class="report-actions" aria-label="Result actions">
      <button class="console-button accent" onclick="downloadResultPdf(${consoleArgument(id)}, ${Boolean(options.forced)}, this)">Download PDF <span aria-hidden="true">↓</span></button>
      ${Array.isArray(r.questionData) && r.questionData.length ? '<button class="console-button" onclick="openCurrentSolutions()">Solutions</button>' : ''}
      ${options.showLeaderboardButton || options.leaderboard ? '<button class="console-button" onclick="openCurrentLeaderboard()">Leaderboard</button>' : ''}
      ${a.omrSheetPath ? `<a class="console-button" href="${escapeHtml(a.omrSheetPath)}" target="_blank" rel="noopener noreferrer">OMR Sheet ↗</a>` : ''}
      ${a.answerKeyFileUrl ? `<a class="console-button" href="${escapeHtml(a.answerKeyFileUrl)}" target="_blank" rel="noopener noreferrer">Answer Key ↗</a>` : ''}
    </nav>
    <div class="report-stage">
      <section class="score-instrument"><div class="instrument-caption"><span>01 / SCORE</span><span>MARKS OBTAINED</span></div>
        <div class="score-instrument-main"><div><div class="score-readout" data-score-total>${escapeHtml(consoleValue(r.totalMarks))}<small>/${escapeHtml(consoleValue(r.totalSubjectMarks))}</small></div><p>of the maximum marks</p></div>
          <div class="score-orbit"><svg viewBox="0 0 120 120" aria-hidden="true"><circle class="orbit-track" cx="60" cy="60" r="51"/><circle class="orbit-value" cx="60" cy="60" r="51" pathLength="100" stroke-dasharray="${fraction} 100"/></svg><div><strong>${ratio == null ? '—' : `${Number(ratio.toFixed(1))}%`}</strong><span>SCORE / MAX</span></div></div>
        </div>
        <div class="score-comparison">${reportComparison('You',r.totalMarks,r.totalSubjectMarks,'lime')}${reportComparison('Average',r.totalAvg,r.totalSubjectMarks,'cyan')}${reportComparison('Highest',r.totalHighest,r.totalSubjectMarks,'violet')}</div>
      </section>
      <section class="standing-instrument"><div class="instrument-caption"><span>02 / STANDING</span><span>REPORTED RANKS</span></div><dl class="standing-grid">${consoleMetric('Overall rank',a.rank,'cyan')}${consoleMetric('Batch rank',a.batchRank,'violet')}${consoleMetric('Percentile',a.percentile,'amber')}${consoleMetric('City rank',a.cityRank)}</dl><div class="cohort-caption"><span>Candidate count</span><strong>${escapeHtml(consoleValue(a.totalStudent))}</strong></div></section>
    </div>
    <dl class="response-strip">${consoleMetric('Attempted',r.totalAttempted)}${consoleMetric('Correct',r.totalCorrect,'lime')}${consoleMetric('Wrong',r.totalInCorrect ?? r.totalIncorrect,'rose')}${consoleMetric('Unattempted',r.totalUnAttempted ?? r.totalUnattempted)}</dl>
    <div class="console-section-label"><span>03 / SUBJECT ANALYSIS</span><span>${subjects.length} SUBJECTS</span></div>
    <div class="subject-ledgers">${subjectHtml || '<div class="empty">No subject breakdown returned.</div>'}</div>
    <details class="report-metadata"><summary>Record metadata <span>+</span></summary><dl class="record-metadata-grid">${consoleMetric('Top Scores',tops)}${consoleMetric('Available data',flags.join(' / '))}</dl></details>
    <details class="secondary-actions"><summary>Additional tools &amp; raw data</summary><div class="secondary-actions-body"><button class="console-button" onclick="generatePseudoLeaderboardFromResult()">Pseudo Leaderboard</button>
    ${options.includeRaw && options.appeared ? `<details><summary>Appeared result raw data</summary><pre>${escapeHtml(JSON.stringify(options.appeared,null,2))}</pre></details>` : ''}
    ${options.includeRaw ? `<details><summary>Analysis raw data</summary><pre>${escapeHtml(JSON.stringify(a,null,2))}</pre></details>` : ''}</div></details>
  </section>`;
}
function buildSessionSlot(c, index, dashboard = false) {
  const done = timeToMinutes(c.startTime) < getIstHourMinute();
  return `<article class="session-slot tone-${subjectTone(c.subjects)} ${dashboard && done ? 'elapsed' : ''}">
    <div class="session-clock"><span>${escapeHtml(formatTimeLabel(c.startTime))}</span><i aria-hidden="true"></i></div>
    <div class="session-ticket"><div class="session-ticket-top"><span>SESSION ${String(index+1).padStart(2,'0')}</span>${dashboard ? `<span>${done ? 'Elapsed' : 'Upcoming'}</span>` : ''}</div><h3>${escapeHtml(c.subjects || 'Class')}</h3><p>${escapeHtml(c.classType || 'Class session')}</p></div>
  </article>`;
}
function buildRankLedger(analysis, leaderboard) {
  const rows = Array.isArray(leaderboard?.leaderboardScore) ? leaderboard.leaderboardScore.slice(0,50) : [];
  if (!rows.length) return '<div class="empty">No leaderboard data found for this test.</div>';
  const names = new Map(consoleList(analysis?.result?.subjectData).map(s=>[String(s.subjectId),s.subjectName]));
  return `<section class="rank-ledger"><div class="rank-ledger-heading"><span>RANK</span><span>CANDIDATE</span><span>TOTAL</span><span>SUBJECT MARKS</span></div>${rows.map(row=>`<article class="rank-ledger-row" data-rank="${Number(row.ranks)||0}">
    <span class="rank-position">${escapeHtml(consoleValue(row.ranks))}</span><h3>${escapeHtml(row.studentName || `Student ${consoleValue(row.examId)}`)}</h3><strong class="rank-total">${escapeHtml(consoleValue(row.totalMarks))}<small>marks</small></strong>
    <div class="rank-subjects">${consoleList(row.subjectPerformance).map((s,index)=>{const name=s.subjectName || names.get(String(s.subjectId)) || `Subject ${index+1}`;return `<span class="tone-${subjectTone(name)}"><i></i>${escapeHtml(name)}<b>${escapeHtml(consoleValue(s.totalMarks))}</b></span>`;}).join('') || '<span>Subject marks unavailable</span>'}</div>
  </article>`).join('')}</section>`;
}
function buildCalendarIndex(entries) {
  return `<div class="calendar-index">${entries.slice(0,30).map((item,index)=>{
    const date=parseExamDateTime(item.dateTime), valid=!Number.isNaN(date.getTime());
    const dateKey=valid ? date.toLocaleDateString('en-CA',{timeZone:'Asia/Kolkata'}) : '';
    const today=dateKey===getIstDateKey();
    const past=valid && date<new Date() && !today;
    return `<article class="calendar-line ${today?'calendar-today':''}"><div class="calendar-date"><strong>${valid?date.toLocaleDateString('en-IN',{day:'2-digit'}):'—'}</strong><span>${valid?escapeHtml(date.toLocaleDateString('en-IN',{month:'short',year:'numeric'})):'UNDATED'}</span></div>
      <div class="calendar-record"><div class="console-eyebrow">${today?'TODAY':past?'PAST':'UPCOMING'} <span>/</span> ${escapeHtml(item.mode || 'EXAM')}</div><h3>${escapeHtml(item.name)}</h3><p>${escapeHtml(formatDateTimeLabel(item.dateTime))}${item.venue ? ` · ${escapeHtml(item.venue)}` : ''}</p>${item.syllabusPreview ? `<div class="calendar-preview">${escapeHtml(item.syllabusPreview.slice(0,160))}</div>` : ''}</div>
      <button class="console-button" onclick="openCalendarTest(${index})">View Details <span aria-hidden="true">↗</span></button>
    </article>`;
  }).join('')}</div>`;
}
