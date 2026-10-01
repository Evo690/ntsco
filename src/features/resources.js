/* --- FILE OPENERS --- */
window.openNoticeFile = async function (id) {
  if (!API_CONFIG.token) return;
  try {
    const res = await fetch(API_ENDPOINTS.noticeFile(id), {
      method: 'GET',
      headers: authHeaders(API_CONFIG.token)
    });
    const json = await res.json();
    if (json !== null && json !== void 0 && json.data) window.open(json.data, '_blank');else alert('Notice file URL not found.');
  } catch (err) {
    alert('Failed to open notice.');
  }
};
window.openStudyFile = async function (id) {
  if (!API_CONFIG.token) return;
  try {
    const res = await fetch(API_ENDPOINTS.studyFile(id), {
      method: 'GET',
      headers: authHeaders(API_CONFIG.token)
    });
    const json = await res.json();
    if (json !== null && json !== void 0 && json.data) window.open(json.data, '_blank');else alert('Study file URL not found.');
  } catch (err) {
    alert('Failed to open study content.');
  }
};
