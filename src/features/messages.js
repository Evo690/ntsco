/* --- MESSAGES --- */
window.selectMessageGroup = async function (groupId, title) {
  currentGroupId = groupId;
  renderMessageGroups(APP_STATE.messageGroups || []);
  const msgPage = document.getElementById('page-messages');
  if (window.innerWidth <= 768 && msgPage) msgPage.classList.add('thread-open');
  const threadTitle = document.getElementById('msg-thread-title');
  const threadList = document.getElementById('msg-thread-list');
  if (threadTitle) threadTitle.textContent = title;
  if (threadList) threadList.innerHTML = '<div class="empty" style="margin:auto">Loading messages...</div>';
  let messages;
  try { messages = await fetchMessages(API_CONFIG.token, groupId); }
  catch (_) {
    if (threadList && currentGroupId === groupId) {
      threadList.innerHTML = '<div class="empty">Couldn’t load this conversation.<br><button class="theme-mode-btn msg-retry">Try again</button></div>';
      threadList.querySelector('button').addEventListener('click', () => selectMessageGroup(groupId, title));
    }
    return;
  }
  if (currentGroupId !== groupId) return;
  if (!messages.length) {
    if (threadList) threadList.innerHTML = '<div class="empty" style="margin:auto">No messages in this group</div>';
    return;
  }

  // Sort by date so newest messages are at bottom
  messages.sort((a, b) => new Date(a.createdDate) - new Date(b.createdDate));
  if (threadList) {
    let previousDay = '';
    threadList.innerHTML = messages.map(m => {
      const dateStr = new Date(m.createdDate).toLocaleDateString('en-IN', {
        month: 'short',
        day: 'numeric'
      });
      const dayKey = new Date(m.createdDate).toDateString();
      const separator = dayKey !== previousDay ? `<div class="msg-day-divider">${escapeHtml(dateStr)}</div>` : '';
      previousDay = dayKey;
      let attachHtml = '';
      if (m.attachment) {
        attachHtml = `<div style="margin-top:8px"><a href="${escapeHtml(m.attachment)}" target="_blank" style="display:inline-flex;align-items:center;gap:6px;padding:6px 10px;background:var(--bg4);border:1px solid var(--border);border-radius:6px;font-size:11px;color:var(--text2)"><svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M7 1v8M4 6l3 3 3-3M2 11h10"/></svg> View Attachment</a></div>`;
      }
      return `
          ${separator}<div class="msg-bubble">
            <div class="msg-bubble-text">${formatMessageText(m.messageText)}</div>
            ${attachHtml}
            <div class="msg-bubble-meta">${escapeHtml(m.displayTime)} · ${escapeHtml(dateStr)}</div>
          </div>
        `;
    }).join('');
    threadList.scrollTop = threadList.scrollHeight;
  }
};
