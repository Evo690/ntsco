/* Presentation controller. No API calls, credentials, or domain data live here. */
(() => {
  const login = document.getElementById('login-screen');
  const sidebar = document.getElementById('sidebar');
  const desktopMenu = document.getElementById('hamburger');

  const navigationTrigger = () => desktopMenu;
  const app = document.querySelector('.app');
  const dock = document.querySelector('.mobile-dock');
  const content = document.getElementById('workspace-content');
  const password = document.getElementById('login-pass');
  const passwordToggle = document.getElementById('password-toggle');
  document.addEventListener('keydown', event => {
    if (!window.__fyEnhancementsInited && login.style.display === 'none' && (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault(); openCommandPalette();
    }
  });
  const mobile = window.matchMedia('(max-width: 768px)');

  passwordToggle?.addEventListener('click', () => {
    const show = password.type === 'password';
    password.type = show ? 'text' : 'password';
    passwordToggle.setAttribute('aria-pressed', String(show));
    passwordToggle.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
  });

  function updateGreeting() {
    const name = sessionStorage.getItem('fy_user_name')?.trim().split(/\s+/)[0];
    const greeting = document.getElementById('workspace-greeting');
    if (greeting) greeting.textContent = name ? `Welcome back, ${name}. Here’s your day at a glance.` : 'A little overview of today.';
    const date = document.getElementById('workspace-date');
    const day = document.getElementById('home-day');
    if (day) day.textContent = new Intl.DateTimeFormat('en', { weekday: 'long' }).format(new Date());
    if (date) date.textContent = new Intl.DateTimeFormat('en', { weekday: 'short', day: 'numeric', month: 'short' }).format(new Date());
  }

  function syncAuthSurface() {
    const signedOut = login.style.display !== 'none';
    app.inert = signedOut;
    if (dock) dock.inert = signedOut;
    document.querySelector('.skip-link').hidden = signedOut;
    if (!signedOut) updateGreeting();
  }
  new MutationObserver(syncAuthSurface).observe(login, { attributes: true, attributeFilter: ['style'] });
  syncAuthSurface();
  updateGreeting();
  const query = new URLSearchParams(location.search);
  const requestedModule = query.get('module') === 'tools' ? 'settings' : query.get('module');
  let requestedModuleOpened = false;
  function restoreModule() {
    if (login.style.display !== 'none' || requestedModuleOpened || !pages[requestedModule]) return;
    requestedModuleOpened = true;
    nav(requestedModule, document.querySelector(`.nav-item[onclick*="'${requestedModule}'"]`));
    if (requestedModule === 'settings' && (query.get('panel') === 'functions' || query.get('module') === 'tools')) {
      if (document.getElementById('settings-functions-card').hidden) toggleSettingsFunctions();
      requestAnimationFrame(() => document.getElementById('settings-functions-card').scrollIntoView({ block: 'start' }));
    }
  }
  new MutationObserver(restoreModule).observe(login, { attributes: true, attributeFilter: ['style'] });
  restoreModule();
  const activeRoute = document.querySelector('.page.active')?.id.replace('page-', '');
  document.querySelectorAll('.section-nav [data-route]').forEach(button => button.classList.toggle('active', button.dataset.route === (activeRoute === 'timetable' ? 'classes' : activeRoute)));
  document.querySelectorAll('.dock-btn').forEach(button => {
    const active = button.dataset.page === (activeRoute === 'timetable' ? 'classes' : activeRoute);
    button.classList.toggle('active', active);
    button.setAttribute('aria-current', active ? 'page' : 'false');
  });
  const toolCards = [...document.querySelectorAll('.function-nav-card')];
  const countLabel = document.getElementById('tool-filter-count');
  const toolSearch = document.getElementById('tool-search');
  toolSearch?.addEventListener('input', () => {
    const query = toolSearch.value.trim().toLowerCase();
    let visible = 0;
    toolCards.forEach(card => { card.hidden = !card.textContent.toLowerCase().includes(query); if (!card.hidden) visible++; });
    countLabel.textContent = `${visible} / ${toolCards.length} functions`;
    document.getElementById('tool-filter-empty').hidden = visible !== 0;
  });
  countLabel.textContent = `${toolCards.length} functions`;
  document.querySelectorAll('#settings-functions-card > div:not(.card-header):not(#settings-functions-grid):not(.tool-filterbar):not(#tool-filter-empty)').forEach(el => el.classList.add('quick-runner'));

  for (const resultId of ['rank-result', 'pl-results-section']) {
    const result = document.getElementById(resultId);
    const idle = document.getElementById(`${resultId}-idle`);
    if (!result || !idle) continue;
    const syncOutput = () => { idle.hidden = result.style.display !== 'none'; };
    new MutationObserver(syncOutput).observe(result, { attributes:true, attributeFilter:['style'] });
    syncOutput();
  }

  let wasOpen = false;
  function syncSidebar() {
    const open = sidebar.classList.contains('open');
    sidebar.inert = !open;
    [desktopMenu].forEach(menu => {
      menu.setAttribute('aria-expanded', String(open));
      menu.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
    });
    if (open && !wasOpen) sidebar.querySelector('.nav-item.active, .nav-item')?.focus();
    if (!open && wasOpen && sidebar.contains(document.activeElement)) navigationTrigger().focus();
    wasOpen = open;
  }
  new MutationObserver(syncSidebar).observe(sidebar, { attributes: true, attributeFilter: ['class'] });
  mobile.addEventListener('change', () => { if (!mobile.matches) closeSidebar(); syncSidebar(); });
  syncSidebar();
  document.addEventListener('keydown', event => {
    if (!sidebar.classList.contains('open')) return;
    if (event.key === 'Escape') { closeSidebar(); navigationTrigger().focus(); }
    if (event.key !== 'Tab') return;
    const items = [...sidebar.querySelectorAll('button, a[href], [tabindex="0"]')].filter(el => el.offsetParent !== null);
    const first = items[0], last = items.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  });

  // Retain existing inline handlers while making legacy clickable cards keyboard-accessible.
  function enhanceActions(root) {
    root.querySelectorAll('div.card-action[onclick], .stat-card[onclick], .function-nav-card[onclick]:not(button), .mode-card[onclick]').forEach(el => {
      el.setAttribute('role', 'button');
      el.tabIndex = 0;
    });
    document.querySelectorAll('.nav-item').forEach(button => {
      if (button.classList.contains('active')) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    });
  }
  enhanceActions(document);
  document.addEventListener('keydown', event => {
    if ((event.key === 'Enter' || event.key === ' ') && event.target.matches('[role="button"][onclick]')) {
      event.preventDefault(); event.target.click();
    }
  });
  new MutationObserver(() => enhanceActions(document)).observe(sidebar, { subtree: true, attributes: true, attributeFilter: ['class'] });
  content.addEventListener('click', event => {
    if (event.target.closest('.command-strip button, .pinned-grid button')) content.focus({ preventScroll: true });
  });
})();
