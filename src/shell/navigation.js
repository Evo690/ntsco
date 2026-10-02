/** Bridge new controls to the existing, access-checked navigation API. */
export function initNavigation() {
  const sidebar = document.getElementById('sidebar');
  const trigger = document.getElementById('hamburger');
  const main = document.getElementById('main-content');
  const dock = document.querySelector('.mobile-dock');
  const mobile = matchMedia('(max-width: 768px)');
  let returnFocus = null;
  document.addEventListener('click', event => {
    const control = event.target.closest('[data-navigate]');
    if (!control) return;
    const id = control.dataset.navigate;
    const link = sidebar.querySelector(`.nav-item[onclick*="'${id}'"]`);
    window.nav(id, link);
  });
  const setActive = () => {
    document.querySelectorAll('.nav-item, .dock-btn').forEach(el => {
      if (el.classList.contains('active')) el.setAttribute('aria-current', 'page');
      else el.removeAttribute('aria-current');
    });
  };
  document.addEventListener('portal:navigate', () => {
    setActive();
    const page = document.querySelector('.page.active');
    page.setAttribute('tabindex', '-1');
    page.focus({ preventScroll: true });
  });
  setActive();
  let wasOpen = false;
  const syncSidebar = () => {
    const open = mobile.matches && sidebar.classList.contains('open');
    trigger.setAttribute('aria-expanded', String(open));
    trigger.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
    sidebar.inert = mobile.matches && !open;
    if (open && !wasOpen) {
      returnFocus = document.activeElement;
      sidebar.querySelector('.nav-item.active, .nav-item')?.focus();
    }
    const signedOut = document.getElementById('login-screen').style.display !== 'none';
    main.inert = open;
    dock.inert = open || signedOut;
    if (!open && wasOpen && sidebar.contains(document.activeElement)) returnFocus?.focus();
    wasOpen = open;
  };
  new MutationObserver(syncSidebar).observe(sidebar, { attributes: true, attributeFilter: ['class'] });
  mobile.addEventListener('change', () => { window.closeSidebar(); syncSidebar(); });
  syncSidebar();
  document.addEventListener('keydown', event => {
    if (!mobile.matches || !sidebar.classList.contains('open')) return;
    if (event.key === 'Escape') { event.preventDefault(); window.closeSidebar(); }
    if (event.key !== 'Tab') return;
    const controls = [...sidebar.querySelectorAll('button, a, [tabindex="0"]')].filter(el => el.offsetParent !== null);
    const first = controls[0], last = controls.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  });
}
