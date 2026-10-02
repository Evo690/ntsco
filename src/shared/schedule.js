/* Shared presentation for the portal agenda and standalone batch scheduler. */
function buildScheduleDayHeader(dateKey, count) {
  const date = new Date(`${dateKey}T12:00:00`);
  const valid = !Number.isNaN(date.getTime());
  const today = dateKey === new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  const weekday = valid ? date.toLocaleDateString('en-IN', { weekday: 'short' }).toUpperCase() : '—';
  const fullDay = valid ? date.toLocaleDateString('en-IN', { weekday: 'long' }) : 'Unknown day';
  const label = valid ? date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : 'Date unavailable';
  return `<header class="agenda-day"><div class="agenda-day-identity"><h3 class="agenda-weekday"><abbr title="${escapeHtml(fullDay)}">${weekday}</abbr></h3><time class="agenda-date" datetime="${escapeHtml(dateKey)}">${escapeHtml(label)}</time></div><span class="agenda-count">${today ? '<b>TODAY</b>' : ''}${count} SESSION${count === 1 ? '' : 'S'}</span></header>`;
}
