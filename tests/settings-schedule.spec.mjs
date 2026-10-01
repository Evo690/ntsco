import {test,expect} from '@playwright/test';
const fixtures=[{classDate:'2026-10-01',startTime:'09:00',subjects:'Physics',classType:'Classroom'},{classDate:'2026-10-02',startTime:'11:00',subjects:'Chemistry',classType:'Classroom'}];
async function open(page){
 await page.route('**/*',r=>r.request().url().startsWith('http://localhost:3000')?r.continue():r.abort());
 await page.goto('/');await page.evaluate(()=>{ensureDataForPage=async()=>{};chemLoadVisitorStat=()=>{};scanAndUploadOnlineTests=()=>{};document.getElementById('login-screen').style.display='none';});
}
test('Classes is the timetable on desktop, phone, home and the command palette; utilities stay in Settings',async({page})=>{
 await open(page);await page.evaluate(data=>{APP_STATE.timetable=data;},fixtures);
 await page.locator('.section-nav [data-route=classes]').click();await expect(page.locator('#page-timetable')).toBeVisible();await expect(page.locator('#page-recordings')).not.toBeVisible();await expect(page.locator('#classes-frame')).toHaveCount(0);
 await expect(page.locator('.schedule-weekday').first()).toHaveText('Thu');
 const sizes=await page.locator('.schedule-day').first().evaluate(el=>[parseFloat(getComputedStyle(el.querySelector('.schedule-weekday')).fontSize),parseFloat(getComputedStyle(el.querySelector('.schedule-date')).fontSize)]);expect(sizes[0]).toBeGreaterThan(sizes[1]);
 await expect(page.locator('#page-timetable')).not.toContainText(/recording/i);
 await page.evaluate(()=>nav('dashboard'));await page.locator('.desk-links').getByRole('button',{name:/Classes/}).click();await expect(page.locator('#page-timetable')).toBeVisible();
 await page.evaluate(()=>{nav('dashboard');COMMANDS.find(c=>c.id==='go-classes').run();});await expect(page.locator('#page-timetable')).toBeVisible();
 await page.setViewportSize({width:390,height:844});await page.locator('.dock-btn[data-page=messages]').click();await page.locator('.dock-btn[data-page=classes]').click();await expect(page.locator('#page-timetable')).toBeVisible();
 await expect(page.locator('.dock-btn[data-page=classes]')).toHaveClass(/active/);await expect(page.locator('#settings-functions-card')).not.toBeVisible();
});
test('all seven Settings launchers point to the matching function and preserve the attempt lock',async({page})=>{
 await open(page);await page.evaluate(()=>{window.opened=[];window.open=url=>{window.opened.push(url);};openAdvancedSettings();});
 for(const id of ['batch-timetable','test-ids','test-schedule','download-tests','watch-recording']){
  await page.locator(`[data-function="${id}"]`).click();expect(await page.evaluate(()=>window.opened.at(-1))).toBe(`functions/${id}.html`);
 }
 page.once('dialog',d=>d.dismiss());await page.locator('[data-function=attempt-test]').click();expect(await page.evaluate(()=>window.opened.length)).toBe(5);
 await page.evaluate(()=>sessionStorage.setItem('fy_reattempt_unlocked','true'));await page.locator('[data-function=attempt-test]').focus();await page.keyboard.press('Enter');expect(await page.evaluate(()=>window.opened)).toHaveLength(6);expect(await page.evaluate(()=>window.opened.at(-1))).toBe('functions/attempt-test.html');
 await page.getByRole('button',{name:'Open attempt launcher ↗',exact:true}).click();expect(await page.evaluate(()=>window.opened.at(-1))).toBe('functions/attempt-test.html');
 await page.locator('#settings-attempt-test-id-input').fill('456');await page.locator('#settings-attempt-test-btn').click();expect(await page.evaluate(()=>window.opened.at(-1))).toBe('functions/attempt-test.html?id=456');
 await page.evaluate(()=>{window.played=[];startWatchRecording=id=>window.played.push(id);});await page.locator('#settings-recording-id-input').fill('789');await page.locator('#settings-watch-recording-btn').click();expect(await page.evaluate(()=>window.played)).toEqual(['789']);
 await page.locator('[data-function=classes]').click();expect(await page.evaluate(()=>window.opened.at(-1))).toBe('functions/classes.html');
await expect(page.locator('#settings-functions-card')).toBeVisible();
 await page.setViewportSize({width:390,height:844});expect(await page.locator('#settings-functions-grid').evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);
});
test('Settings appearance, cache and refresh actions perform their stated job',async({page})=>{
 await open(page);await page.evaluate(()=>nav('settings'));await page.locator('#theme-mode-dark').click();await expect(page.locator('body')).not.toHaveClass(/light-mode/);
 await expect(page.locator('meta[name=theme-color]')).toHaveAttribute('content','#111719');await expect(page.locator('#theme-preset-grid')).toContainText('Sea glass');
 await page.getByRole('button',{name:'Slate Blue',exact:true}).click();await expect(page.locator('body')).toHaveClass(/theme-ocean/);
 await page.evaluate(()=>localStorage.setItem(getUserStorageKey(PORTAL_CACHE_KEY),'cached'));await page.getByRole('button',{name:'Clear Local Cache',exact:true}).click();expect(await page.evaluate(()=>localStorage.getItem(getUserStorageKey(PORTAL_CACHE_KEY)))).toBeNull();expect(await page.evaluate(()=>localStorage.getItem(getUserStorageKey('fy_theme_preset')))).toBe('ocean');
 await page.getByRole('button',{name:'Reset Appearance',exact:true}).click();await expect(page.locator('body')).toHaveClass(/light-mode/);await expect(page.locator('body')).not.toHaveClass(/theme-ocean/);await expect(page.locator('meta[name=theme-color]')).toHaveAttribute('content','#f6f3ef');
 await page.evaluate(()=>{window.refreshed=[];ensureDataForPage=async(id,force)=>window.refreshed.push([id,force]);});await page.getByRole('button',{name:'Refresh Portal Data',exact:true}).click();expect(await page.evaluate(()=>window.refreshed)).toEqual(['dashboard','courses','messages','notices','study'].map(id=>[id,true]));
 await page.evaluate(()=>{syncCloudProgress=()=>window.synced=true;updatePracticeAccessUI(true);});await page.locator('#settings-sync-btn').click();expect(await page.evaluate(()=>window.synced)).toBe(true);
 const missing=await page.locator('#page-settings [onclick]').evaluateAll(els=>els.flatMap(el=>[...el.getAttribute('onclick').matchAll(/\b([a-zA-Z_$][\w$]*)\(/g)].map(m=>m[1])).filter(name=>!['if'].includes(name)&&typeof window[name]!=='function'));expect(missing).toEqual([]);
 await page.evaluate(()=>localStorage.setItem(getUserStorageKey(PORTAL_CACHE_KEY),'cache-again'));await Promise.all([page.waitForEvent('framenavigated'),page.getByRole('button',{name:'Hard Refresh',exact:true}).click()]);await page.waitForFunction(()=>typeof getUserStorageKey==='function');expect(await page.evaluate(()=>localStorage.getItem(getUserStorageKey(PORTAL_CACHE_KEY)))).toBeNull();
});
test('batch timetable and exam schedule render redesigned, keyboard-accessible detail data',async({page})=>{
 await page.route('**/*',r=>r.request().url().startsWith('http://localhost:3000')?r.continue():r.abort());
 await page.goto('/functions/batch-timetable.html');await page.evaluate(async data=>{API_CONFIG.token='fixture';fetchTimetable=async()=>data;await selectBatch('123','Batch A');},fixtures);await expect(page.locator('.batch-day-card h3').first()).toHaveText('Thursday');await expect(page.locator('.batch-day-card')).toHaveCount(2);
 await page.goto('/functions/test-schedule.html');await page.evaluate(()=>{allSchedules=[{id:55,name:'Physics paper',dateTime:'2026-10-01T09:00:00',venue:'Room 12',courses:'Batch A',duration:'90 min',syllabus:'Physics: Optics'}];renderSchedulesList(allSchedules);});
 expect(await page.locator('.sidebar-head').evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);
 expect((await page.locator('.exam-schedule-card').boundingBox()).height).toBeLessThan(200);
 await page.locator('.exam-schedule-card').focus();await page.keyboard.press('Enter');await expect(page.locator('#selected-schedule-title')).toHaveText('Physics paper');await expect(page.locator('#detail-venue')).toHaveText('Room 12');
 await page.getByRole('button',{name:'Toggle light and dark theme',exact:true}).click();await expect(page.locator('meta[name=theme-color]')).toHaveAttribute('content','#111719');
 await page.setViewportSize({width:360,height:900});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
