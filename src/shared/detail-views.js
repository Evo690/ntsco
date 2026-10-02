/* Shared topic presentation; used by the portal and the standalone schedule tool. */
function buildTopicLedger(subjects) {
  if (!subjects.length) return '<div class="empty">No syllabus details returned.</div>';
  return `<div class="topic-ledgers">${subjects.map((subject,index)=>{
    const name = subject.subject || 'General';
    const tone = /chem/i.test(name) ? 'violet' : /math/i.test(name) ? 'amber' : /bio|bot|zoo/i.test(name) ? 'lime' : 'cyan';
    return `<section class="topic-ledger topic-${tone}"><header><code>${String(index+1).padStart(2,'0')}</code><h3>${escapeHtml(name)}</h3><span>${subject.lines.length} TOPIC${subject.lines.length === 1 ? '' : 'S'}</span></header><ol>${subject.lines.map(line=>`<li><span>${escapeHtml(line)}</span></li>`).join('')}</ol></section>`;
  }).join('')}</div>`;
}
function buildInspectorFrame({kicker, title, titleId = '', metaId = '', close, actions = '', bodyId = '', body = ''}) {
  return `<section class="inspector-dialog"><header class="inspector-mast"><div><code>${kicker}</code><h2 ${titleId ? `id="${titleId}"` : ''}>${title}</h2>${metaId ? `<p id="${metaId}"></p>` : ''}</div><button class="console-button inspector-close-button" onclick="${close}">Close <span aria-hidden="true">×</span></button></header>${actions ? `<div class="inspector-actions">${actions}</div>` : ''}<div class="inspector-body" ${bodyId ? `id="${bodyId}"` : ''}>${body}</div></section>`;
}
