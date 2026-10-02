import { initDirectory } from './directory.js';
import { initDialogs } from './dialogs.js';
import { initMobileSearch } from './search.js';
import { initAuthView } from './auth-view.js';
import { initNavigation } from './navigation.js';
import { initAccessibility } from './accessibility.js';

initAuthView();
initDirectory();
initMobileSearch();
initNavigation();
initAccessibility();
initDialogs();
const date = document.getElementById('workspace-date');
date.textContent = new Intl.DateTimeFormat('en', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }).format(new Date());

const rankResult = document.getElementById('rank-result');
const rankAwaiting = document.querySelector('[data-rank-awaiting]');
if (rankResult && rankAwaiting) {
  const syncRankOutput = () => { rankAwaiting.hidden = rankResult.style.display !== 'none'; };
  new MutationObserver(syncRankOutput).observe(rankResult, { attributes: true, attributeFilter: ['style'] });
  syncRankOutput();
}

const plOutput = document.getElementById('pl-results-section');
const plAwaiting = document.querySelector('[data-pl-awaiting]');
if (plOutput && plAwaiting) {
  const sync = () => { plAwaiting.hidden = plOutput.style.display !== 'none'; };
  new MutationObserver(sync).observe(plOutput, { attributes: true, attributeFilter: ['style'] });
  sync();
}
