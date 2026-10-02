import { tools } from './tool-registry.js';

export function initDirectory() {
  const render = (root, entries) => {
    if (!root) return;
    root.innerHTML = entries.map(tool => `<a class="tool-launcher function-entry" href="${tool.path}" target="_blank" rel="noopener" data-tool-id="${tool.id}">
      <span class="function-symbol" aria-hidden="true">${tool.glyph}</span><div class="function-identity"><code>${tool.code} / ${tool.command}</code><h3>${tool.title}</h3><p>${tool.description}</p><div class="function-io"><span>IN / ${tool.input}</span><span>OUT / ${tool.output}</span></div></div><span class="function-open" aria-hidden="true">↗</span></a>`).join('');
  };
  const full = document.querySelector('[data-tool-directory="all"]');
  render(document.querySelector('[data-tool-directory="quick"]'), tools.slice(0,4));
  render(full, tools);
  let category = 'all';
  const input = document.getElementById('tool-search');
  const filter = () => {
    const q = input.value.trim().toLowerCase();
    const entries = tools.filter(t => (category === 'all' || category === t.group) && [t.title,t.command,t.description,t.input,t.output].join(' ').toLowerCase().includes(q));
    render(full, entries);
    document.querySelector('.directory-empty').hidden = entries.length > 0;
  };
  input.addEventListener('input', filter);
  document.querySelectorAll('[data-tool-filter]').forEach(button => button.addEventListener('click', () => {
    category = button.dataset.toolFilter;
    document.querySelectorAll('[data-tool-filter]').forEach(b => { const active = b === button; b.classList.toggle('active',active); b.setAttribute('aria-pressed',String(active)); });
    filter();
  }));
  // Reattempt access is still enforced by the existing gate, not the launcher.
  document.addEventListener('click', event => {
    const link = event.target.closest('[data-tool-id="attempt-test"]');
    if (!link) return;
    event.preventDefault();
    window.openAttemptTestFeature();
  });
}
