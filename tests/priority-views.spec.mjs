import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
const result = JSON.parse(await readFile(new URL('./fixtures/result.json',import.meta.url),'utf8'));
async function open(page){
 await page.route('**/*',r=>r.request().url().startsWith('http://localhost:3000')?r.continue():r.abort());
 await page.goto('/');await page.evaluate(()=>{ensureDataForPage=async()=>{};chemLoadVisitorStat=()=>{};scanAndUploadOnlineTests=()=>{};document.getElementById('login-screen').style.display='none';renderSubnav('dashboard');});
}
test('priority routes appear in order, with only one navigation bar per viewport',async({page})=>{
 await open(page);
 expect(await page.locator('.section-nav [data-route]').evaluateAll(els=>els.slice(0,5).map(e=>e.dataset.route))).toEqual(['dashboard','era','classes','messages','notices']);
 await expect(page.locator('.section-nav')).toBeVisible();await expect(page.locator('.mobile-dock')).not.toBeVisible();
 await expect(page.locator('.section-nav [data-route=courses]')).toHaveCount(0);
 await page.locator('.desk-secondary').getByRole('button',{name:'Tools in Settings'}).click();
 await expect(page.locator('#settings-functions-card')).toBeVisible();
 await page.setViewportSize({width:390,height:844});
 await expect(page.locator('.section-nav')).not.toBeVisible();await expect(page.locator('.mobile-dock')).toBeVisible();await expect(page.locator('#hamburger')).toBeVisible();
 for(const id of ['era','messages','notices']){await page.locator(`.dock-btn[data-page=${id}]`).click();await expect(page.locator('#page-'+id)).toBeVisible();}
 await page.locator('#hamburger').click();await expect(page.locator('#sidebar')).not.toHaveAttribute('inert','');
 await page.keyboard.press('Escape');await expect(page.locator('#hamburger')).toBeFocused();
});
test('Results keeps direct unpublished lookup while Exam Hall retains its published-result actions',async({page})=>{
 await open(page);await page.evaluate(()=>{
  APP_STATE.tests=[{id:101,testName:'Physics unit test',examDate:'2026-09-20',isPublish:true,appeared:{totalMarks:72,totalSubjectMarks:100}},{id:102,testName:'Chemistry review',examDate:'2026-10-12',isPublish:false}];APP_STATE.eraTests=APP_STATE.tests;
  openResultSubpage=(id,options)=>{window.lookup={id,options};};nav('era');
 });
 await page.locator('.result-ledger-row').nth(1).getByRole('button',{name:'View analysis'}).click();
 expect(await page.evaluate(()=>window.lookup)).toEqual({id:'102',options:{forced:true,source:'era'}});
 await page.locator('#manual-force-test-id').fill('999');await page.getByRole('button',{name:'Check result →',exact:true}).click();
 expect(await page.evaluate(()=>window.lookup.id)).toBe('999');expect(await page.evaluate(()=>window.lookup.options.forced)).toBe(true);
 await page.evaluate(()=>nav('examhall'));await expect(page.locator('.paper-card')).toHaveCount(2);
 await expect(page.locator('#era-load-more')).not.toBeVisible();await expect(page.locator('#examhall-load-more')).not.toBeVisible();
 await page.locator('.paper-card').first().getByRole('button',{name:'View Result'}).click();
 expect(await page.evaluate(()=>window.lookup.options.forced)).toBe(false);
 for(const width of [360,768,1440]){await page.setViewportSize({width,height:900});for(const id of ['era','examhall']){await page.evaluate(id=>nav(id),id);expect(await page.locator('#workspace-content').evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);}}
});
test('subject averages, ranks and highest marks stay visible; decorative result tags are gone',async({page})=>{
 await open(page);await page.evaluate(result=>{
  result.result.subjectData[0].rank=12;result.result.subjectData[0].percentile=95.4;
  result.result.subjectData[0].totalAvgMarks=47;result.result.subjectData[0].highestMarks=99;
  document.getElementById('result-detail-body').innerHTML=buildResultAnalysisHtml(result,{id:101},{forced:true});nav('result-detail');
 },result);
 await expect(page.locator('#result-detail-body .result-chip')).toHaveCount(0);
 const card=page.locator('.subject-result-card').first();
 for(const [label,value]of [['Subject rank','12'],['Average','47'],['Highest','99'],['Percentile','95.4']]){const metric=card.locator('.subject-key-metrics>div').filter({hasText:label});await expect(metric).toBeVisible();await expect(metric.locator('dd')).toHaveText(value);}
 await expect(page.locator('.subject-result-card').nth(1).locator('.subject-key-metrics>div').filter({hasText:'Average'}).locator('dd')).toHaveText('45');
 await expect(page.locator('.result-extra')).not.toHaveAttribute('open','');
});
test('timetable is a day selector and agenda with working cross-links',async({page})=>{
 await open(page);await page.evaluate(()=>{
  APP_STATE.timetable=[{classDate:'2026-10-01',startTime:'09:00',subjects:'Physics',classType:'Classroom'},{classDate:'2026-10-01',startTime:'11:00',subjects:'Chemistry',classType:'Classroom'},{classDate:'2026-10-02',startTime:'10:00',subjects:'Mathematics',classType:'Live class'}];nav('timetable');
 });
 await expect(page.locator('.schedule-day')).toHaveCount(2);await page.locator('.schedule-day').last().click();await expect(page.locator('.agenda-event')).toHaveCount(1);await expect(page.locator('.agenda-event')).toContainText('Mathematics');
 await page.locator('.schedule-day').first().click();await expect(page.locator('.agenda-event')).toHaveCount(2);
 await page.setViewportSize({width:390,height:844});expect(await page.locator('#workspace-content').evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);
 await expect(page.locator('#page-timetable')).not.toContainText('recording');
 await expect(page.locator('.dock-btn[data-page=classes]')).toHaveClass(/active/);
});
test('messages and notices keep their reading and attachment flows on a phone',async({page})=>{
 await open(page);await page.setViewportSize({width:390,height:844});
 await page.evaluate(()=>{
  APP_STATE.messageGroups=[{groupId:'g1',title:'Class updates',unreadCount:2}];
  fetchMessages=async()=>[{createdDate:'2026-10-01T09:00:00',messageText:'Bring the revision sheet.',displayTime:'09:00',attachment:'https://example.invalid/revision.pdf'},{createdDate:'2026-10-02T10:00:00',messageText:'Tomorrow’s class starts at ten.',displayTime:'10:00'}];nav('messages');
 });
 await page.locator('.msg-group-item').click();await expect(page.locator('.msg-bubble')).toHaveCount(2);await expect(page.locator('.msg-day-divider')).toHaveCount(2);await expect(page.getByRole('link',{name:'View Attachment'})).toBeVisible();
 await page.locator('.msg-back').click();await expect(page.locator('.msg-sidebar')).toBeVisible();
 await page.evaluate(()=>{fetchMessages=async()=>{throw new Error('offline');};});await page.locator('.msg-group-item').click();await expect(page.locator('.msg-retry')).toBeVisible();
 await page.evaluate(()=>{
  APP_STATE.notices=[{id:1,title:'Updated timetable for the coming week',createdDate:'2026-10-01'}];openNoticeFile=id=>{window.openedNotice=id;};nav('notices');
 });await page.locator('.notice-item button').click();expect(await page.evaluate(()=>window.openedNotice)).toBe('1');
 expect(await page.locator('#workspace-content').evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);
});
