/* Small, accessible SVG views of existing result data. Never invent missing values. */
function chartNumber(value) {
  if (
    !["number", "string"].includes(typeof value) ||
    (typeof value === "string" && !value.trim())
  )
    return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}
function chartPercent(score, maximum) {
  const s = chartNumber(score),
    m = chartNumber(maximum);
  return s !== null && m !== null && m > 0 ? (s / m) * 100 : null;
}
function buildOutcomeChart(result) {
  const labels = ["Correct", "Incorrect", "Unattempted"];
  const values = [
    result.totalCorrect,
    result.totalInCorrect ?? result.totalIncorrect,
    result.totalUnAttempted ?? result.totalUnattempted,
  ].map(chartNumber);
  if (
    values.some((value) => value === null || value < 0) ||
    values.reduce((a, b) => a + b, 0) === 0
  )
    return '<h3>Question breakdown</h3><div class="chart-empty"><span>◌</span>Question counts aren’t available for this result.</div>';
  const total = values.reduce((a, b) => a + b, 0),
    colors = ["var(--green)", "var(--red)", "var(--border2)"];
  let offset = 0;
  const segments = values
    .map((value, i) => {
      const length = (value / total) * 100;
      const segment = `<circle cx="80" cy="80" r="59" fill="none" stroke="${colors[i]}" stroke-width="15" pathLength="100" stroke-dasharray="${length} ${100 - length}" stroke-dashoffset="${-offset}" transform="rotate(-90 80 80)"/>`;
      offset += length;
      return segment;
    })
    .join("");
  return `<h3>Every question, accounted for.</h3><div class="outcomes-body"><svg class="outcome-donut" viewBox="0 0 160 160" role="img" aria-label="${values.map((value, i) => `${labels[i]} ${value}`).join(", ")}">${segments}<text x="80" y="78" text-anchor="middle" fill="var(--text)" style="font:500 31px var(--font-heading)">${total}</text><text x="80" y="100" text-anchor="middle" fill="var(--text3)" style="font:11px var(--font-body)">questions</text></svg><div class="outcome-legend">${values.map((value, i) => `<div><i class="legend-dot" style="background:${colors[i]}"></i>${labels[i]}<b>${value}</b></div>`).join("")}</div></div>`;
}
function buildSubjectChart(result) {
  const subjects = (Array.isArray(result.subjectData) ? result.subjectData : [])
    .map((subject) => ({
      ...subject,
      percent: chartPercent(subject.totalMarks, subject.totalSubjectMarks),
    }))
    .filter((subject) => subject.percent !== null);
  if (!subjects.length)
    return '<h3>Subject by subject</h3><div class="chart-empty"><span>▥</span>Subject scores aren’t available yet.</div>';
  return `<h3>Subject by subject</h3>${subjects.map((subject) => `<div class="subject-bar-row"><span>${escapeHtml(subject.subjectName || "Subject")}</span><div class="subject-bar-track" role="img" aria-label="${escapeHtml(subject.subjectName || "Subject")}: ${escapeHtml(subject.totalMarks)} out of ${escapeHtml(subject.totalSubjectMarks)}"><div class="subject-bar-fill" style="width:${Math.min(100, Math.max(0, subject.percent))}%"></div></div><b>${escapeHtml(subject.totalMarks)}<span style="font-weight:400;color:var(--text3)"> / ${escapeHtml(subject.totalSubjectMarks)}</span></b></div>`).join("")}<p class="result-sub">Bars show the share of available marks. Exact scores are shown alongside.</p>`;
}
function renderRecentScoreChart() {
  const root = document.getElementById("home-score-chart");
  if (!root) return;
  const seen = new Set();
  const entries = [...(APP_STATE.tests || []), ...(APP_STATE.eraTests || [])]
    .filter((test) => {
      const key = String(
        test.id ?? test.testPaperId ?? `${test.testName}-${test.examDate}`,
      );
      if (
        seen.has(key) ||
        chartPercent(
          test.appeared?.totalMarks,
          test.appeared?.totalSubjectMarks,
        ) === null
      )
        return false;
      seen.add(key);
      return true;
    })
    .sort(
      (a, b) =>
        (Date.parse(a.examDate || a.testDate) || 0) -
        (Date.parse(b.examDate || b.testDate) || 0),
    )
    .slice(-8);
  if (!entries.length) {
    root.innerHTML =
      '<div class="chart-empty"><span>⌁</span><b>Your scores will find their place here.</b><span style="font-size:11px;opacity:1;color:var(--text3)">Once result data is available, this becomes your score history.</span></div>';
    return;
  }
  const points = entries
    .map((entry, i) => ({
      name: entry.testName || "Test",
      score: entry.appeared.totalMarks,
      max: entry.appeared.totalSubjectMarks,
      percent: chartPercent(
        entry.appeared.totalMarks,
        entry.appeared.totalSubjectMarks,
      ),
      x: entries.length === 1 ? 300 : 45 + (i * 515) / (entries.length - 1),
    }))
    .map((p) => ({
      ...p,
      y: 150 - Math.min(100, Math.max(0, p.percent)) * 1.25,
    }));
  const path = points.map((p, i) => `${i ? "L" : "M"} ${p.x} ${p.y}`).join(" ");
  const grid = [0, 50, 100]
    .map(
      (value) =>
        `<line x1="40" y1="${150 - value * 1.25}" x2="570" y2="${150 - value * 1.25}" stroke="var(--border)" stroke-dasharray="4 5"/><text x="0" y="${154 - value * 1.25}" fill="var(--text3)" style="font:10px var(--font-body)">${value}%</text>`,
    )
    .join("");
  root.innerHTML = `<svg class="score-line-chart" viewBox="0 0 600 180" role="img" aria-label="Recent score history, percentages of available marks">${grid}${points.length > 1 ? `<path d="${path} L ${points.at(-1).x} 150 L ${points[0].x} 150 Z" fill="var(--accent-glow)"/><path d="${path}" fill="none" stroke="var(--accent)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>` : ""}${points.map((p, i) => `<circle cx="${p.x}" cy="${p.y}" r="5" fill="var(--accent)" stroke="var(--bg2)" stroke-width="3"><title>${escapeHtml(p.name)}: ${escapeHtml(p.score)} / ${escapeHtml(p.max)}</title></circle><text x="${p.x}" y="174" text-anchor="middle" fill="var(--text3)" style="font:10px var(--font-body)">${i + 1}</text>`).join("")}</svg><div class="score-chart-caption"><span>${points.length} recent result${points.length === 1 ? "" : "s"} · oldest to newest</span><span>% of total marks</span></div><details class="chart-data"><summary>See exact scores</summary><table><thead><tr><th>Test</th><th>Marks</th></tr></thead><tbody>${points.map((p) => `<tr><td>${escapeHtml(p.name)}</td><td>${escapeHtml(p.score)} / ${escapeHtml(p.max)}</td></tr>`).join("")}</tbody></table></details>`;
}
