function escapeHtml(v) {
  return String(v ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}

function formatMessageText(text) {
  let escaped = escapeHtml(text);
  return escaped.replace(/([a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(?:\/[a-zA-Z0-9.,_@%&?=+~/-]*)?)/g, (match) => {
    let clean = match;
    if (clean.endsWith('.')) clean = clean.slice(0, -1);
    if (!clean.includes('.') || clean.length < 5) return match;
    if (!/\.(com|in|net|org|co|edu|gov|io|me)(\/|$)/i.test(clean)) return match;
    let href = clean;
    if (!/^https?:\/\//i.test(href)) href = 'https://' + href;
    return `<a href="${href}" target="_blank" style="color:var(--accent);text-decoration:underline">${clean}</a>`;
  });
}

function decodeHtmlEntities(v) {
  return String(v ?? '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}

function syllabusToLines(html) {
  const text = decodeHtmlEntities(String(html ?? '')
    .replace(/\u200B/g, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]*>/g, ' ')
  );
  return text.split('\n').map(line => line.replace(/\s+/g, ' ').trim()).filter(Boolean);
}

function formatVenueText(venue) {
  const raw = decodeHtmlEntities(String(venue ?? '')).replace(/\u200B/g, ' ').trim();
  if (!raw) return 'N/A';
  return raw.replace(/\s{2,}/g, '\n').split('\n').map(s => s.trim()).filter(Boolean).join('\n');
}

function normalizeDateKey(value) {
  if (!value) return '';
  const raw = String(value).trim();
  const iso = raw.match(/\d{4}-\d{2}-\d{2}/);
  if (iso) return iso[0];
  const dt = new Date(raw);
  if (Number.isNaN(dt.getTime())) return raw;
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

function formatDateLabel(dateStr) {
  const dt = new Date(dateStr);
  if (Number.isNaN(dt.getTime())) return String(dateStr || 'Unknown date');
  return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatDateTimeLabel(dateStr) {
  const dt = parseExamDateTime(dateStr);
  if (Number.isNaN(dt.getTime())) return String(dateStr || 'Unknown time');
  return dt.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });
}

function parseExamDateTime(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return new Date(NaN);
  const direct = new Date(raw);
  if (!Number.isNaN(direct.getTime())) return direct;
  const m = raw.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})\s+(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!m) return new Date(NaN);
  const monMap = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
  let hour = Number(m[4]);
  if (m[6].toUpperCase() === 'PM' && hour !== 12) hour += 12;
  if (m[6].toUpperCase() === 'AM' && hour === 12) hour = 0;
  return new Date(Number(m[3]), monMap[m[2].toLowerCase()], Number(m[1]), hour, Number(m[5]), 0, 0);
}

function formatTimeLabel(raw) {
  const parts = String(raw || '').split(':');
  const h = Number(parts[0]), m = Number(parts[1] || 0);
  if (Number.isNaN(h) || Number.isNaN(m)) return String(raw || '');
  const d = new Date(); d.setHours(h, m, 0, 0);
  return d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true });
}

function timeToMinutes(raw) {
  const parts = String(raw || '').split(':');
  const h = Number(parts[0]), m = Number(parts[1] || 0);
  return (Number.isNaN(h) || Number.isNaN(m)) ? Number.MAX_SAFE_INTEGER : h * 60 + m;
}

function getIstDateKey() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

function getIstHourMinute() {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(new Date());
  return Number(parts.find(p => p.type === 'hour')?.value || 0) * 60 + Number(parts.find(p => p.type === 'minute')?.value || 0);
}

function getSubjectClass(subject) {
  const s = String(subject || '').toLowerCase();
  if (s.includes('phy')) return 'tt-phy';
  if (s.includes('chem')) return 'tt-chem';
  if (s.includes('math')) return 'tt-math';
  return 'tt-phy';
}

