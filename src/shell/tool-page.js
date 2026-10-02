import { tools } from './tool-registry.js';
import { initAccessibility } from './accessibility.js';

const current = document.body.dataset.tool;
const tabs = document.querySelector('[data-tool-tabs]');
tabs.innerHTML = tools.map(t => `<a href="${t.id}.html" ${t.id===current?'aria-current="page"':''}><span>${t.code}</span>${t.title}</a>`).join('');
const activeTab = tabs.querySelector('[aria-current="page"]');
if (activeTab) tabs.scrollLeft = activeTab.offsetLeft - tabs.offsetLeft - (tabs.clientWidth - activeTab.clientWidth) / 2;
function preferenceKey() {
  const name = sessionStorage.getItem('fy_user_name');
  let id = name && name.trim() !== 'Student' ? name.trim() : (sessionStorage.getItem('fy_logged_in_user') || '');
  if (/^\+?[0-9\s-]{8,15}$/.test(id)) id = '';
  return 'fy_theme_mode' + (id ? '_' + id.replace(/[^a-zA-Z0-9_]/g,'_') : '');
}
document.querySelector('.tool-theme-toggle').addEventListener('click', () => {
  const light = document.body.classList.toggle('light-mode');
  localStorage.setItem(preferenceKey(), light ? 'light' : 'dark');
});
// Labels for original dynamically-controlled inputs, without replacing their handlers.
document.querySelectorAll('input:not([type="checkbox"]), select').forEach(input => {
  if (input.hasAttribute('aria-label') || document.querySelector(`label[for="${input.id}"]`)) return;
  input.setAttribute('aria-label',input.placeholder || input.id.replaceAll('-',' '));
});
const sidebar = document.getElementById('sidebar');
const trigger = document.getElementById('hamburger');
if (sidebar && trigger) {
  const mobile = matchMedia('(max-width: 768px)');
  let previous = null, wasOpen = false;
  const sync = () => {
    const open = mobile.matches && sidebar.classList.contains('open');
    sidebar.inert = mobile.matches && !open;
    trigger.setAttribute('aria-expanded',String(open));
    if(open && !wasOpen) { previous=document.activeElement; sidebar.querySelector('input,button,select')?.focus(); }
    if(!open && wasOpen && sidebar.contains(document.activeElement)) previous?.focus();
    wasOpen=open;
  };
  new MutationObserver(sync).observe(sidebar,{attributes:true,attributeFilter:['class']});
  mobile.addEventListener('change',()=>{window.closeSidebar();sync();});
  document.querySelectorAll('.explorer-jump').forEach(b=>b.addEventListener('click',()=>{
    if(mobile.matches)window.toggleSidebar();
    else sidebar.querySelector('input,select')?.focus();
  }));
  document.addEventListener('keydown',e=>{
    if(!mobile.matches || !sidebar.classList.contains('open'))return;
    if(e.key==='Escape'){e.preventDefault();window.closeSidebar();}
    if(e.key==='Tab'){
      const controls=[...sidebar.querySelectorAll('a,button,input,select,[tabindex="0"]')].filter(el=>el.offsetParent!==null && !el.disabled);
      if(e.shiftKey && document.activeElement===controls[0]){e.preventDefault();controls.at(-1)?.focus();}
      else if(!e.shiftKey && document.activeElement===controls.at(-1)){e.preventDefault();controls[0]?.focus();}
    }
  });
  sync();
}
initAccessibility();
