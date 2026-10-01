import {test,expect} from '@playwright/test';
async function open(page){
 await page.route('**/*',r=>r.request().url().startsWith('http://localhost:3000')?r.continue():r.abort());
 await page.goto('/');await page.evaluate(()=>{ensureDataForPage=async()=>{};chemLoadVisitorStat=()=>{};scanAndUploadOnlineTests=()=>{};document.getElementById('login-screen').style.display='none';});
}
test('Overview leads both navigation bars, with no Others or More tab',async({page})=>{
 await open(page);await expect(page.locator('.section-nav [data-route]').first()).toHaveAttribute('data-route','dashboard');await expect(page.locator('#mobile-more')).toHaveCount(0);
 await page.setViewportSize({width:390,height:844});expect(await page.locator('.mobile-dock [data-page]').evaluateAll(els=>els.map(el=>el.dataset.page))).toEqual(['dashboard','era','classes','messages','notices']);
 await page.locator('.dock-btn[data-page=messages]').click();await page.locator('.dock-btn[data-page=dashboard]').click();await expect(page.locator('#page-dashboard')).toBeVisible();await expect(page.locator('.dock-btn[data-page=dashboard]')).toHaveAttribute('aria-current','page');
 await page.locator('#hamburger').click();await page.locator('.nav-item').filter({hasText:'Settings'}).click();await expect(page.locator('#page-settings')).toBeVisible();
});
test('View syllabus opens a new native sheet, copies actual topics, and returns keyboard focus',async({page})=>{
 await open(page);await page.evaluate(()=>{
 APP_STATE.tests=[{id:101,testName:'Unit review',examDate:'2026-10-01',syllabus:'PHYSICS: Ray optics\nCHEMISTRY: Equilibrium',isPublish:true}];nav('examhall');
 Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>window.copiedSyllabus=text}});
 });
 const trigger=page.getByRole('button',{name:'View syllabus'});await trigger.click();const dialog=page.locator('#exam-syllabus-modal-backdrop');await expect(dialog).toHaveAttribute('open','');await expect(dialog).toHaveClass('detail-dialog');await expect(dialog.locator('.syllabus-section')).toHaveCount(2);
 await dialog.getByRole('button',{name:'Copy syllabus'}).click();expect(await page.evaluate(()=>window.copiedSyllabus)).toContain('Ray optics');
 for(const width of [1440,390]){await page.setViewportSize({width,height:900});await page.evaluate(()=>setThemeMode('dark'));expect(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);}
 await page.keyboard.press('Escape');await expect(dialog).not.toBeVisible();await expect(trigger).toBeFocused();
});
test('course, calendar and attendance details share the redesigned sheet and retain their data/actions',async({page})=>{
 await open(page);await page.evaluate(async()=>{API_CONFIG.token='fixture';fetchCourseDetail=async()=>({title:'Physics course',batchName:'Batch A',courseMedium:'English',courseFees:{price:1000,displayPrice:800},description:'<p>Wave optics and mechanics.</p>',campus:[{campusName:'Main campus'}]});await openCourseDetail(1);});
 await expect(page.locator('#course-detail-modal-backdrop')).toHaveAttribute('open','');await expect(page.locator('#course-detail-modal-body')).toContainText('800');await expect(page.locator('#course-detail-modal-body')).toContainText('Main campus');await page.keyboard.press('Escape');
 await page.evaluate(()=>{APP_STATE.calendarEntries=[{name:'Weekly review',dateTime:'2026-10-01T09:00:00',venue:'Room 3',mode:'Offline',syllabusLines:['Optics','Equilibrium']}];printCalendarDetail=index=>window.printedIndex=index;openCalendarTest(0);});
 const calendar=page.locator('#calendar-detail-modal-backdrop');await expect(calendar).toHaveClass(/detail-dialog/);await expect(calendar).toContainText('Room 3');await calendar.getByRole('button',{name:'Download PDF / Print'}).click();expect(await page.evaluate(()=>window.printedIndex)).toBe(0);await page.keyboard.press('Escape');
 await page.evaluate(()=>{fetchAttendance=async()=>[{classDate:'2026-10-01',isPresent:true}];openAttendanceModal();});await expect(page.locator('#att-modal-backdrop')).toHaveAttribute('open','');await expect(page.locator('#att-modal-body')).toContainText('Present');await page.setViewportSize({width:390,height:844});expect(await page.locator('#att-modal-backdrop').evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);
});
test('model lab switches whole workflows, preserves inputs and offers collapsed diagnostics',async({page})=>{
 await open(page);await page.evaluate(()=>{initRankPredictor=async()=>{};nav('neural');});
 await expect(page.locator('#subnav')).not.toBeVisible();await expect(page.locator('#card-ranknet-predictor')).toBeVisible();await page.locator('#inp-score').fill('210');await page.locator('#inp-avg').fill('120');await page.locator('#inp-N').fill('500');
 await page.locator('.model-tab[data-view=leaderboard]').click();await expect(page.locator('#card-pseudo-leaderboard')).toBeVisible();await expect(page.locator('#card-ranknet-predictor')).not.toBeVisible();await page.getByRole('button',{name:'Use prediction inputs'}).click();await expect(page.locator('#pl-avg')).toHaveValue('120');
 await page.locator('.model-options summary').click();await page.getByRole('button',{name:'More Passes',exact:true}).click();await expect(page.locator('#pl-card-passes-slider')).toBeVisible();
 await page.getByRole('button',{name:'+ Add Anchor',exact:true}).click();await expect(page.locator('#pl-anchor-list .pl-anchor-row')).toHaveCount(3);
 await page.locator('.model-tab[data-view=predictor]').click();await expect(page.locator('#inp-score')).toHaveValue('210');
 await page.evaluate(()=>{document.getElementById('r-pct').textContent='94.3';document.getElementById('r-rank').textContent='29';document.getElementById('rank-result').style.display='block';});
 await expect(page.locator('#rank-result-idle')).not.toBeVisible();await expect(page.locator('.model-diagnostics')).not.toHaveAttribute('open','');
 for(const width of [360,768,1440]){await page.setViewportSize({width,height:900});for(const view of ['predictor','leaderboard']){await page.locator(`.model-tab[data-view=${view}]`).click();expect(await page.locator('#workspace-content').evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);}}
});
test('Settings recordings open the redesigned standalone page, without an iframe or old header',async({page,context})=>{
 await context.route('**/*',r=>r.request().url().startsWith('http://localhost:3000')?r.continue():r.abort());await open(page);await page.evaluate(()=>openAdvancedSettings());
 const popupPromise=page.waitForEvent('popup');await page.locator('[data-function=classes]').click();const tool=await popupPromise;await tool.waitForLoadState();await expect(tool).toHaveURL(/functions\/classes.html/);await expect(tool.locator('.workbench-bar')).toBeVisible();await expect(tool.locator('.legacy-tool-topbar')).not.toBeVisible();await expect(tool.locator('.legacy-tool-topbar')).toHaveAttribute('inert','');await expect(page.locator('iframe')).toHaveCount(0);
 await tool.locator('.tool-back').click();await expect(tool).toHaveURL(/module=settings&panel=functions/);
});
test('simulated leaderboard output retains pagination, rank search, filters and CSV export',async({page})=>{
 await open(page);await page.evaluate(()=>{
 initRankPredictor=async()=>{};nav('neural');setSubTab('neural','leaderboard');
 PL_STATE.fullLeaderboard=Array.from({length:61},(_,i)=>({rank:i+1,marks:275-i,percentile:100-i,isAnchor:i===9}));
 document.getElementById('pl-results-section').style.display='block';applyLeaderboardFilters();
 });
 await expect(page.locator('#pl-results-section-idle')).not.toBeVisible();await expect(page.locator('#pl-table-tbody tr')).toHaveCount(50);
 await page.locator('#pl-next-page-btn').click();await expect(page.locator('#pl-table-tbody tr')).toHaveCount(11);
 await page.locator('#pl-search-rank').fill('10');await expect(page.locator('#pl-table-tbody tr')).toHaveCount(1);await expect(page.locator('#pl-table-tbody')).toContainText('Anchor');
 await page.locator('#pl-search-rank').fill('');await page.locator('.pl-f-chip[data-filter=top20]').click();await expect(page.locator('#pl-table-tbody tr')).toHaveCount(20);
 const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'Export CSV',exact:true}).click();const download=await downloadPromise;expect(download.suggestedFilename()).toMatch(/\.csv$/);
 await page.setViewportSize({width:390,height:844});expect(await page.locator('#workspace-content').evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);
});
