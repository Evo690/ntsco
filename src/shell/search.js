export function initMobileSearch() {
  const toggle = document.querySelector('.mobile-search-toggle');
  const topbar = document.querySelector('.topbar');
  const input = document.getElementById('global-search');
  function setOpen(open) {
    topbar.dataset.searchOpen = String(open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Close search' : 'Search workspace');
    if (open) input.focus(); else toggle.focus();
  }
  toggle.addEventListener('click', () => setOpen(topbar.dataset.searchOpen !== 'true'));
  input.addEventListener('keydown', e => { if (e.key === 'Escape') setOpen(false); });
}
