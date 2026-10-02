/* --- ATTENDANCE --- */
window.openAttendanceModal = function () {
  ensureAttendanceModal();
  const now = new Date();
  const mSelect = document.getElementById('att-month');
  const ySelect = document.getElementById('att-year');
  if (!mSelect.options.length) {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    months.forEach((m, i) => mSelect.add(new Option(m, i + 1)));
    const curY = now.getFullYear();
    for (let y = curY - 1; y <= curY + 1; y++) ySelect.add(new Option(y, y));
    mSelect.value = now.getMonth() + 1;
    ySelect.value = curY;
  }
  document.getElementById('att-modal-backdrop').style.display = 'flex';
  renderAttendanceModal(); // Auto-load initially
};
window.renderAttendanceModal = async function () {
  const body = document.getElementById('att-modal-body');
  body.innerHTML = '<div class="empty">Loading...</div>';
  const m = document.getElementById('att-month').value;
  const y = document.getElementById('att-year').value;
  let data;
  try { data = await fetchAttendance(API_CONFIG.token, Number(m), Number(y)); }
  catch (error) { body.innerHTML = `<div class="empty">${escapeHtml(error?.message || 'Attendance unavailable. Try again.')}</div>`; return; }
  if (!data.length) {
    body.innerHTML = '<div class="empty">No attendance records found</div>';
    return;
  }
  body.innerHTML = `<div class="attendance-ledger">${data.map(d => `<div><time>${escapeHtml(d.classDate)}</time><span class="attendance-state ${d.isPresent ? 'present' : 'absent'}">${d.isPresent ? 'Present' : 'Absent'}</span></div>`).join('')}</div>`;
};
async function loadCurrentAttendance() {
  const now = new Date();
  const data = await fetchAttendance(API_CONFIG.token, now.getMonth() + 1, now.getFullYear());
  const valEl = document.getElementById('att-val');
  const subEl = document.getElementById('att-sub');
  if (!valEl || !subEl) return;
  if (!data.length) {
    valEl.textContent = 'N/A';
    subEl.innerHTML = 'No data this month';
    return;
  }
  const total = data.length;
  const present = data.filter(d => d.isPresent).length;
  const absent = total - present;
  const pct = Math.round(present / total * 100);
  valEl.textContent = pct + '%';
  subEl.innerHTML = absent > 0 ? `<span class="dn">${absent} class${absent > 1 ? 'es' : ''}</span> missed this month` : `<span class="up">Perfect attendance</span> this month`;
}

