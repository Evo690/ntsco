/** Keyboard compatibility for legacy click-only cards, including API-rendered cards. */
export function initAccessibility() {
  const selector = '[onclick]:not(button):not(a):not(input):not(select):not(textarea):not([role])';
  const enhance = root => {
    root.querySelectorAll(selector).forEach(el => {
      // Backdrops and cards containing other controls aren't standalone buttons.
      if (el.id.includes('modal') || el.className.includes('backdrop') || el.classList.contains('overlay') || el.querySelector('button, input, a, select, textarea')) return;
      el.setAttribute('role', 'button');
      el.tabIndex = 0;
    });
  };
  enhance(document);
  const observer = new MutationObserver(records => {
    records.forEach(record => record.addedNodes.forEach(node => {
      if (node.nodeType === Node.ELEMENT_NODE) enhance(node.parentElement || node);
    }));
  });
  observer.observe(document.body, { childList: true, subtree: true });
  document.addEventListener('keydown', event => {
    const el = event.target;
    if (el.matches('[role="button"][onclick]:not(button)') && ['Enter', ' '].includes(event.key)) {
      event.preventDefault(); el.click();
    }
  });
}
