const { test, expect } = require('@playwright/test');
const populate = require('./fixtures/workspace.cjs');
async function settings(page,width=390) {
  await page.context().route('https://**',r=>r.abort());
  await page.setViewportSize({width,height:900});
  await page.goto('/');await page.evaluate(populate);
  await page.evaluate(()=>nav('settings'));
}
async function openFunctions(page) { await page.locator('#settings-functions-btn').click();await expect(page.locator('#page-tools')).toBeVisible();
  await expect(page.locator('#page-settings')).toBeHidden(); }

test('settings appearance controls change and persist the corresponding preferences',async({page})=>{
  await settings(page);
  await page.locator('#theme-mode-light').click();
  await expect(page.locator('body')).toHaveClass(/light-mode/);
  await expect(page.locator('#theme-mode-light')).toHaveAttribute('aria-pressed','true');
  for(const [name,value]of[['Slate Blue','ocean'],['Violet','purple'],['Green','emerald'],['Default','default']]){
    const button=page.locator('#theme-preset-grid').getByRole('button',{name});await button.click();
    await expect(button).toHaveAttribute('aria-pressed','true');
    expect(await page.evaluate(()=>localStorage.getItem(getUserStorageKey('fy_theme_preset')))).toBe(value);
  }
  await page.locator('#theme-mode-dark').click();await expect(page.locator('body')).not.toHaveClass(/light-mode/);
  await page.locator('#theme-mode-light').click();await page.getByRole('button',{name:'Reset Appearance',exact:true}).click();
  await expect(page.locator('#theme-mode-dark')).toHaveAttribute('aria-pressed','true');
  expect(await page.evaluate(()=>[localStorage.getItem(getUserStorageKey('fy_theme_mode')),localStorage.getItem(getUserStorageKey('fy_theme_preset'))])).toEqual(['dark','default']);
});

test('cache controls clear cached responses, preserve preferences/progress, and hard refresh really reloads',async({page})=>{
  await settings(page);
  await page.evaluate(()=>{
    localStorage.setItem(getUserStorageKey(PORTAL_CACHE_KEY),'fixture cache');localStorage.setItem(getTimetableCacheKey(),'fixture timetable');
    localStorage.setItem(getUserStorageKey('fy_theme_mode'),'light');localStorage.setItem(getUserStorageKey('fy_theme_preset'),'purple');
    localStorage.setItem('fy_timetable_cache_2026_301','old batch');localStorage.setItem('fy_timetable_cache_2026_301_Other_User','keep');
    localStorage.setItem('fixture_practice_progress','keep');localStorage.setItem('unrelated-cache','keep');
  });
  await page.getByRole('button',{name:'Clear Local Cache',exact:true}).click();
  await expect(page.locator('#settings-operation-status')).toContainText('Preferences and practice progress kept');
  expect(await page.evaluate(()=>[localStorage.getItem(getUserStorageKey(PORTAL_CACHE_KEY)),localStorage.getItem(getTimetableCacheKey()),localStorage.getItem(getUserStorageKey('fy_theme_mode')),localStorage.getItem('fixture_practice_progress')])).toEqual([null,null,'light','keep']);
  expect(await page.evaluate(()=>[localStorage.getItem('fy_timetable_cache_2026_301'),localStorage.getItem('fy_timetable_cache_2026_301_Other_User')])).toEqual([null,'keep']);
  await page.evaluate(()=>{localStorage.setItem(getUserStorageKey(PORTAL_CACHE_KEY),'cache again')});
  await Promise.all([page.waitForEvent('load'),page.getByRole('button',{name:'Hard Refresh',exact:true}).click()]);
  expect(await page.evaluate(()=>performance.getEntriesByType('navigation')[0].type)).toBe('reload');
  expect(await page.evaluate(()=>[localStorage.getItem(getUserStorageKey(PORTAL_CACHE_KEY)),localStorage.getItem(getUserStorageKey('fy_theme_preset')),localStorage.getItem('fixture_practice_progress'),localStorage.getItem('unrelated-cache')])).toEqual([null,'purple','keep','keep']);
});

test('settings refresh calls the exam loader and exposes loading, success and failure',async({page})=>{
  await settings(page);
  await page.evaluate(()=>{window.fixtureRefresh=[];window.ensureDashboardData=force=>{fixtureRefresh.push(force);return new Promise(resolve=>window.finishRefresh=resolve)}});
  const button=page.locator('#settings-refresh-btn');await button.click();await expect(button).toBeDisabled();
  expect(await page.evaluate(()=>fixtureRefresh)).toEqual([true]);
  await page.evaluate(()=>finishRefresh());await expect(button).toBeEnabled();
  await expect(page.locator('#settings-operation-status')).toHaveText('Exam data refreshed.');
  await page.evaluate(()=>{window.ensureDashboardData=async()=>{throw new Error('Fixture service unavailable')}});
  await button.click();await expect(page.locator('#settings-operation-status')).toHaveText('Fixture service unavailable');
  await expect(button).toBeEnabled();
  await page.evaluate(()=>{API_CONFIG.token=''});await button.click();
  await expect(page.locator('#settings-operation-status')).toHaveText('Sign in to refresh exam data.');
});

test('cloud sync calls the progress service and reports failure without losing local progress',async({page})=>{
  await settings(page);
  await page.evaluate(()=>{hasPracticeAccessCache=true;window.fixtureSync=[];window.chemSyncAll=async force=>{fixtureSync.push(force);return true}});
  const button=page.locator('#settings-sync-btn');await button.click();
  await expect(page.locator('#settings-operation-status')).toHaveText('Practice progress synced.');
  expect(await page.evaluate(()=>fixtureSync)).toEqual([true]);
  await page.evaluate(()=>{window.chemSyncAll=async()=>false});await button.click();
  await expect(page.locator('#settings-operation-status')).toContainText('Cloud sync failed');await expect(button).toBeEnabled();
  await page.evaluate(()=>{hasPracticeAccessCache=false});await button.click();
  await expect(page.locator('#settings-operation-status')).toContainText('disabled');
});

test('practice preferences persist and renderer failure falls back to Smiles Drawer',async({page})=>{
  await settings(page);
  await page.locator('label[for="chem-setting-text-mode"]').click();
  await expect(page.locator('#chem-setting-text-mode')).not.toBeChecked();
  await page.locator('label[for="chem-setting-wizard-mode"]').click();await expect(page.locator('#chem-setting-wizard-mode')).toBeChecked();
  expect(await page.evaluate(()=>[localStorage.getItem(getUserStorageKey('chem_setting_text_mode')),localStorage.getItem(getUserStorageKey('chem_setting_wizard_mode'))])).toEqual(['false','true']);
  await page.evaluate(()=>{window.loadRDKitDynamic=async()=>{};window.chemRefreshCurrentDrawing=()=>{window.fixtureRedrawn=true}});
  await page.locator('#chem-setting-renderer').selectOption('rdkit');
  expect(await page.evaluate(()=>localStorage.getItem(getUserStorageKey('chem_setting_renderer')))).toBe('rdkit');
  await page.locator('#chem-setting-renderer').selectOption('smiles');
  expect(await page.evaluate(()=>fixtureRedrawn)).toBe(true);
  await page.evaluate(()=>{window.loadRDKitDynamic=async()=>{throw new Error('fixture blocked')}});
  await page.locator('#chem-setting-renderer').selectOption('rdkit');await expect(page.locator('#chem-setting-renderer')).toHaveValue('smiles');
  expect(await page.evaluate(()=>localStorage.getItem(getUserStorageKey('chem_setting_renderer')))).toBe('smiles');
});

const tools=[['test-ids','Test registry'],['attempt-test','Exam runner'],['download-tests','Data export'],['batch-timetable','Batch scheduler'],['test-schedule','Schedule explorer'],['classes','Recording index'],['watch-recording','Stream player']];
for(const [id,title]of tools)test(`Settings opens the redesigned ${title} page`,async({page})=>{
  await settings(page);await openFunctions(page);
  await expect(page.locator('#settings-functions-grid .tool-launcher')).toHaveCount(7);
  // Exercise the existing launch gate without changing production access logic.
  if(id==='attempt-test')await page.evaluate(()=>sessionStorage.setItem('fy_reattempt_unlocked','true'));
  const [popup]=await Promise.all([page.waitForEvent('popup'),page.locator(`#settings-functions-grid [data-tool-id="${id}"]`).click()]);
  const errors=[];popup.on('pageerror',e=>errors.push(e.message));
  await popup.waitForLoadState('domcontentloaded');await expect(popup).toHaveURL(new RegExp(`/functions/${id}\\.html`));
  await expect(popup.locator('.tool-heading h1')).toContainText(title);
  await expect(popup.locator('.tool-tabs a')).toHaveCount(7);
  await expect(popup.locator('.tool-tabs [aria-current="page"]')).toHaveAttribute('href',id+'.html');
  for(const width of[390,1440]){
    await popup.setViewportSize({width,height:900});
    expect(await popup.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    // The exam runner deliberately uses its compact timer/header instead.
    await expect(popup.locator(id === 'attempt-test' ? '.exam-header' : '.tool-heading')).toBeVisible();
  }
  expect(errors).toEqual([]);await popup.close();
});

test('quick test launcher validates IDs and retains its access gate and destination',async({page})=>{
  await settings(page);await openFunctions(page);
  await page.locator('#settings-attempt-test-btn').click();await expect(page.locator('#settings-attempt-test-status')).toContainText('valid numeric');
  await page.locator('#settings-attempt-test-id-input').fill('1e3');await page.locator('#settings-attempt-test-btn').click();
  await expect(page.locator('#settings-attempt-test-status')).toBeVisible();
  await page.locator('#settings-attempt-test-id-input').fill('501');
  const promptPromise=page.waitForEvent('dialog').then(async d=>{expect(d.type()).toBe('prompt');await d.dismiss()});
  await page.locator('#settings-attempt-test-btn').click();await promptPromise;
  await page.evaluate(()=>sessionStorage.setItem('fy_reattempt_unlocked','true'));
  const[popup]=await Promise.all([page.waitForEvent('popup'),page.locator('#settings-attempt-test-id-input').press('Enter')]);
  await expect(popup).toHaveURL(/attempt-test\.html\?id=501/);await popup.close();
});

test('quick recording launcher opens the player, calls the recording API and restores history',async({page})=>{
  await settings(page);await openFunctions(page);
  await page.locator('#settings-watch-recording-btn').click();await expect(page.locator('#settings-recording-status')).toContainText('valid Video');
  await page.evaluate(()=>{window.fixtureRecordingCalls=[];window.loginProxyFetch=async url=>{fixtureRecordingCalls.push(url);return {ok:true,json:async()=>({data:'https://example.invalid/fixture-video.mp4'})}}});
  await page.locator('#settings-recording-id-input').fill('207');await page.locator('#settings-recording-id-input').press('Enter');
  await expect(page.locator('#recording-player-modal')).toBeVisible();await expect(page.locator('#portal-recording-video')).toHaveAttribute('src','https://example.invalid/fixture-video.mp4');
  expect(await page.evaluate(()=>fixtureRecordingCalls[0])).toContain('/207');
  await expect(page.getByRole('dialog',{name:'Recording player',exact:true})).toBeVisible();
  expect(await page.locator('#recording-player-modal').evaluate(el=>el.parentElement===document.body)).toBe(true);
  await expect(page.getByRole('button',{name:'Close recording player',exact:true})).toBeFocused();
  await page.locator('#recording-player-modal').getByRole('button',{name:'1.5x',exact:true}).click();
  expect(await page.locator('#portal-recording-video').evaluate(el=>el.playbackRate)).toBe(1.5);
  expect(await page.locator('.player-modal-container').evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);
  await page.keyboard.press('Escape');await expect(page.locator('#recording-player-modal')).toBeHidden();
  await page.locator('#settings-recent-recordings-list').getByRole('button',{name:'#207'}).click();
  await expect(page.locator('#recording-player-modal')).toBeVisible();expect(await page.evaluate(()=>fixtureRecordingCalls.length)).toBe(2);
});

test('list editor reports restricted access, can retry, and routes collection controls correctly',async({page})=>{
  await settings(page);
  await page.evaluate(()=>{window.checkPracticeAccess=async()=>false});await page.locator('#list-editor-toggle').click();
  await expect(page.locator('#list-editor-root')).toContainText('Practice access is required');
  await page.locator('#list-editor-toggle').click();
  await page.evaluate(()=>{
    window.checkPracticeAccess=async()=>true;
    window.chemInitApp=window.reagentInitApp=window.pkaInitApp=async()=>{};
    chemAllCompounds=[{name:'Fixture compound',smiles:'C'}];reagentAllReagents=['Fixture reagent'];pkaAllCompounds=[{name:'Fixture acid',pka:5}];
    chemMyData.myList=[];reagentMyData.myList=[];pkaMyData.myList=[];
  });
  await page.locator('#list-editor-toggle').click();await expect(page.locator('#list-editor-toggle')).toHaveAttribute('aria-expanded','true');
  await page.locator('#list-editor-items input').check();expect(await page.evaluate(()=>chemMyData.myList)).toContain('Fixture compound');
  await page.locator('#list-editor-tab-reagents').click();await expect(page.locator('#list-editor-items')).toContainText('Fixture reagent');
  await page.locator('#list-editor-tab-pka').click();await page.locator('#list-editor-root').getByRole('button',{name:'Select All',exact:true}).click();
  expect(await page.evaluate(()=>pkaMyData.myList)).toContain('Fixture acid');
  await page.locator('#list-editor-root').getByRole('button',{name:'Deselect All',exact:true}).click();expect(await page.evaluate(()=>pkaMyData.myList)).toEqual([]);
  await page.locator('#list-editor-search').fill('missing');await expect(page.locator('#list-editor-items')).toContainText('No pKa compounds');
});

for(const width of[390,1440])for(const theme of['dark','light'])test(`function directory and weekday-first schedule fit ${width}px ${theme}`,async({page})=>{
  await settings(page,width);await page.evaluate(t=>setThemeMode(t),theme);await openFunctions(page);
  expect(await page.evaluate(()=>({doc:document.documentElement.scrollWidth<=innerWidth,content:document.querySelector('.content').scrollWidth<=document.querySelector('.content').clientWidth+1}))).toEqual({doc:true,content:true});
  await expect(page.locator('#page-settings #settings-functions-card')).toHaveCount(0);
  await page.evaluate(()=>nav('settings'));await expect(page.locator('#settings-functions-card')).toBeHidden();
  await page.evaluate(()=>{APP_STATE.timetable=['2026-10-01','2026-10-06'].map(classDate=>({classDate,startTime:'09:00',subjects:'Physics',classType:'Regular'}));nav('timetable')});
  await expect(page.locator('.agenda-weekday')).toHaveText(['THU','TUE']);
  const sizes=await page.locator('.agenda-day').first().evaluate(el=>[parseFloat(getComputedStyle(el.querySelector('.agenda-weekday')).fontSize),parseFloat(getComputedStyle(el.querySelector('.agenda-date')).fontSize)]);
  expect(sizes[0]).toBeGreaterThan(sizes[1]*2);
  await page.evaluate(()=>nav('dashboard'));await expect(page.locator('#today-schedule-day strong')).toHaveText(/^[A-Z]{3}$/);
});
