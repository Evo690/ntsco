const { test, expect } = require('@playwright/test');
const populate = require('./fixtures/workspace.cjs');

async function open(page, width = 390, theme = 'dark') {
  await page.setViewportSize({ width, height: 900 });
  await page.route('https://**', route => route.abort());
  await page.goto('/');
  await page.evaluate(populate);
  await page.evaluate(theme => setThemeMode(theme), theme);
}
async function route(page,id) {
  await page.evaluate(id=>nav(id,document.querySelector(`[data-route="${id}"]`)),id);
}
async function fits(page) {
  const metric=await page.evaluate(()=>({width:innerWidth,doc:document.documentElement.scrollWidth,content:document.querySelector('.content').scrollWidth,client:document.querySelector('.content').clientWidth}));
  expect(metric.doc).toBeLessThanOrEqual(metric.width);
  expect(metric.content).toBeLessThanOrEqual(metric.client+1);
}

for(const width of [390,1440]) {
  for(const theme of ['dark','light']) {
    test(`populated feature pages fit their panels: ${width}px ${theme}`,async({page})=>{
      const errors=[];page.on('pageerror',e=>errors.push(e.message));
      await open(page,width,theme);
      for(const id of ['dashboard','courses','timetable','examhall','era','result-detail','leaderboard','solutions','examcal','messages','study','notices','practice','neural','settings']) {
        await route(page,id);
        if(id==='leaderboard')await page.evaluate(()=>openCurrentLeaderboard());
        if(id==='solutions')await page.evaluate(()=>openCurrentSolutions());
        await expect(page.locator(`#page-${id} .module-heading h1`)).toBeVisible();
        await fits(page);
      }
      expect(errors).toEqual([]);
    });
  }
  test(`schedule precedes metrics and mobile dock does not cover content: ${width}px`,async({page})=>{
    await open(page,width);
    const order=await page.evaluate(()=>{
      const schedule=document.querySelector('#dash-streams').getBoundingClientRect();
      const metrics=document.querySelector('#page-dashboard .stats-row').getBoundingClientRect();
      const content=document.querySelector('.content').getBoundingClientRect();
      const dock=document.querySelector('.mobile-dock').getBoundingClientRect();
      return {schedule:schedule.y,metrics:metrics.y,contentBottom:content.bottom,dockTop:dock.y};
    });
    expect(order.schedule).toBeLessThan(order.metrics);
    await expect(page.locator('#today-classes-list .session-slot')).toHaveCount(3);
    await expect(page.locator('#page-dashboard .launch-strip')).toHaveCount(0);
    await expect(page.locator('#page-dashboard .tool-launcher')).toHaveCount(0);
    if(width<=768){
      expect(order.contentBottom).toBeLessThanOrEqual(order.dockTop);
      await expect(page.locator('.dock-btn svg')).toHaveCount(4);
    }
  });
  test(`course records and full course detail remain usable: ${width}px`,async({page})=>{
    await open(page,width);await route(page,'courses');
    await expect(page.locator('.enrollment-card')).toHaveCount(3);
    await expect(page.locator('.enrollment-card').first()).toHaveCSS('background-image','none');
    await expect(page.locator('.course-prog-bar')).toHaveCount(0);
    await page.locator('.enrollment-card').first().getByRole('button').click();
    const dialog=page.getByRole('dialog',{name:'Course details',exact:true});
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('Fixture batch');
    await expect(dialog).toContainText('Fixture scholarship information');
    await expect(dialog.getByRole('link',{name:'Watch video'})).toHaveAttribute('href','https://example.invalid/video');
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
  });
  test(`exam result, breakdown, leaderboard and solutions drill-down: ${width}px`,async({page})=>{
    await open(page,width);await route(page,'examhall');
    await page.locator('#examhall-list').getByRole('button',{name:'View Result'}).click();
    await expect(page.locator('[data-score-total]')).toHaveText('216/300');
    await expect(page.locator('.subject-ledger')).toHaveCount(3);
    const first=page.locator('.subject-details').first();
    await expect(first.locator('.subject-audit')).toBeHidden();
    await first.locator('summary').click();
    await expect(first.locator('.subject-audit')).toContainText('Top Scores');
    await expect(page.locator('#result-detail-body .secondary-actions')).not.toHaveAttribute('open','');
    await page.locator('#result-detail-body').getByRole('button',{name:'Leaderboard',exact:true}).click();
    await expect(page.locator('#leaderboard-body')).toContainText('Fixture student A');
    await page.locator('#page-leaderboard').getByRole('button',{name:'Back',exact:true}).click();
    await page.locator('#result-detail-body').getByRole('button',{name:'Solutions',exact:true}).click();
    await expect(page.locator('.sol-card')).toHaveCount(3);
    await page.locator('.sol-card').first().getByRole('button',{name:/View Solution/}).click();
    await expect.poll(()=>page.locator('.sol-img').first().evaluate(img=>img.naturalWidth)).toBe(600);
    await expect(page.locator('.sol-img').first()).toBeVisible();
    await page.locator('#ak-toggle-btn').click();
    await expect(page.locator('#ak-panel')).toBeVisible();
    await page.locator('.sol-tabs').getByRole('button',{name:'Chemistry (1)'}).click();
    await expect(page.locator('.sol-card:visible')).toHaveCount(1);
    await fits(page);
  });
  test(`calendar, syllabus and message details: ${width}px`,async({page})=>{
    await open(page,width);await route(page,'examcal');
    await page.locator('#examcal-list').getByRole('button',{name:'View Details'}).click();
    const calendar=page.getByRole('dialog',{name:'Exam details',exact:true});
    await expect(calendar).toBeVisible();
    await expect(calendar).toContainText('Examination hall 2');
    const overflow=await calendar.evaluate(el=>el.scrollWidth>el.clientWidth);
    expect(overflow).toBe(false);
    await page.keyboard.press('Escape');await expect(calendar).toBeHidden();
    await route(page,'examhall');
    await page.locator('#examhall-list').getByRole('button',{name:'View syllabus',exact:true}).click();
    const syllabus=page.getByRole('dialog',{name:'Exam syllabus',exact:true});
    await expect(syllabus).toContainText('Atomic structure');
    await page.keyboard.press('Escape');await expect(syllabus).toBeHidden();
    await route(page,'messages');
    await page.locator('.msg-group-item').click();
    await expect(page.locator('.msg-bubble')).toContainText('The physics session starts at 10:00');
    await fits(page);
  });
  test(`pKa collection, learn and practice subviews: ${width}px`,async({page})=>{
    await open(page,width);await route(page,'practice');
    await page.evaluate(async()=>{selectPracticeMode('pka');await pkaInitApp();pkaLearnNew();});
    await expect(page.locator('#pka-table-body tr')).toHaveCount(5);
    await page.locator('[onclick="pkaInitLearn()"]').click();
    await expect(page.locator('#pka-view-learn')).toBeVisible();
    await expect(page.locator('#pka-learn-index-text')).toHaveText('1 / 5');
    await page.locator('[onclick="pkaChangeLearn(1)"]').click();
    await expect(page.locator('#pka-learn-index-text')).toHaveText('2 / 5');
    await page.evaluate(()=>{pkaGoHome();pkaInitPractice()});
    await expect(page.locator('#pka-view-practice')).toBeVisible();
    await expect(page.locator('#pka-question-container')).not.toBeEmpty();
    await fits(page);
  });
}

test('virtualized resource rows retain their layout height',async({page})=>{
  await open(page);await route(page,'study');
  await page.evaluate(()=>renderStudyContent(Array.from({length:45},(_,id)=>({id,title:'Long fixture resource title / laws of motion and connected bodies',subjectName:'Physics',createdDate:'2026-10-01'})),45));
  await expect(page.locator('#study-list')).toHaveClass(/virtual-list/);
  expect(await page.locator('#study-list .exam-hall-item').first().evaluate(el=>el.getBoundingClientRect().height)).toBe(82);
});
