/** Presentation only. Authentication, authorization and tokens stay in features/auth. */
export function initAuthView() {
  const screen = document.getElementById('login-screen');
  const app = document.querySelector('.app');
  const dock = document.querySelector('.mobile-dock');
  const password = document.getElementById('login-pass');
  const toggle = document.getElementById('password-toggle');
  toggle.addEventListener('click', () => {
    const visible = password.type === 'password';
    password.type = visible ? 'text' : 'password';
    toggle.setAttribute('aria-pressed', String(visible));
    toggle.setAttribute('aria-label', visible ? 'Hide password' : 'Show password');
  });
  const syncVisibility = () => {
    const signedOut = screen.style.display !== 'none';
    app.inert = signedOut;
    dock.inert = signedOut;
    document.querySelector('.skip-link').href = signedOut ? '#login-user' : '#main-content';
  };
  syncVisibility();
  new MutationObserver(syncVisibility).observe(screen, { attributes: true, attributeFilter: ['style'] });
  document.querySelectorAll('[data-current-year]').forEach(el => { el.textContent = new Date().getFullYear(); });
}
