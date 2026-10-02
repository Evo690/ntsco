/** Shared focus lifecycle for feature dialogs, including their nested detail views. */
export function initDialogs() {
  let active = null;
  let previousFocus = null;
  const dialogs = {
    'recording-player-modal': ['Recording player', '[data-recording-close]'],
    'att-modal-backdrop': ['Attendance report', 'button'],
    'course-detail-modal-backdrop': ['Course details', '[onclick="closeCourseDetailModal()"]'],
    'result-modal-backdrop': ['Result analysis', '[onclick="closeResultModal()"]'],
    'exam-syllabus-modal-backdrop': ['Exam syllabus', '[onclick="closeTestSyllabusModal()"]'],
    'calendar-detail-modal-backdrop': ['Exam details', '[onclick="closeCalendarDetailModal()"]']
  };
  const ids = Object.keys(dialogs);
  function sync() {
    const next = ids.map(id => document.getElementById(id)).find(el => el && getComputedStyle(el).display !== 'none') || null;
    if (next === active) return;
    if (!next) {
      active = null;
      if (previousFocus?.isConnected && !previousFocus.closest('[inert]')) previousFocus.focus();
      return;
    }
    previousFocus = document.activeElement;
    active = next;
    active.setAttribute('role', 'dialog');
    active.setAttribute('aria-modal', 'true');
    active.setAttribute('aria-label', dialogs[active.id][0]);
    active.querySelector('#att-month')?.setAttribute('aria-label', 'Attendance month');
    active.querySelector('#att-year')?.setAttribute('aria-label', 'Attendance year');
    active.querySelector(dialogs[active.id][1])?.focus();
  }
  new MutationObserver(sync).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['style'] });
  document.addEventListener('keydown', event => {
    if (!active) return;
    const controls = [...active.querySelectorAll('button, a, input, select, [tabindex="0"]')].filter(el => el.offsetParent !== null && !el.disabled);
    if (event.key === 'Escape') { event.preventDefault(); active.querySelector(dialogs[active.id][1])?.click(); }
    if (event.key !== 'Tab') return;
    const first = controls[0], last = controls.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  });
}
