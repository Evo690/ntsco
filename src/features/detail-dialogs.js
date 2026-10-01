/* One native detail sheet for syllabus, course, attendance and exam information. */
function createStudyDialog({id, titleId, title, eyebrow = 'DETAILS', bodyId, content = '', actions = ''}) {
  const existing = document.getElementById(id);
  if (existing) return existing;
  const dialog = document.createElement('dialog');
  dialog.id = id;
  dialog.className = 'detail-dialog';
  dialog.setAttribute('aria-labelledby', titleId);
  dialog.innerHTML = `<header class="detail-heading"><div><span class="eyebrow">${eyebrow}</span><h2 id="${titleId}">${title}</h2></div><button type="button" class="detail-close" aria-label="Close details">×</button></header><div class="detail-actions">${actions}</div><div id="${bodyId}" class="detail-content">${content}</div>`;
  dialog.querySelector('.detail-close').addEventListener('click', () => closeStudyDialog(dialog));
  dialog.addEventListener('click', event => {
    const rect = dialog.getBoundingClientRect();
    if (event.target === dialog && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) closeStudyDialog(dialog);
  });
  dialog.addEventListener('close', () => {
    if (dialog.returnFocus?.isConnected) dialog.returnFocus.focus({preventScroll:true});
  });
  document.body.append(dialog);
  return dialog;
}
function openStudyDialog(dialog) {
  if (!dialog || dialog.open) return;
  dialog.returnFocus = document.activeElement;
  dialog.showModal();
  dialog.scrollTop = 0;
}
function closeStudyDialog(dialog) {
  if (dialog?.open) dialog.close();
}
