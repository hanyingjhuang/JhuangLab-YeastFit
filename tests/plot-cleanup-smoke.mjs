import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const base=process.env.YEASTFIT_URL||'http://127.0.0.1:4173';
const out=process.env.YEASTFIT_ARTIFACTS||'test-artifacts/plot-cleanup';
await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1000}});
const page=await context.newPage();
const errors=[];
page.on('pageerror',e=>errors.push(`pageerror: ${e.message}`));
page.on('console',m=>{if(m.type()==='error')errors.push(`console: ${m.text()}`)});
await page.goto(base,{waitUntil:'networkidle'});
await page.waitForFunction(()=>window.YeastFit&&window.YeastFitPresets&&window.YeastFitWorkflowV05);

const expected={
  daily:['viz_observed','viz_normalized_time','viz_serial_auc','viz_serial_trend_slope'],
  endpoint:['viz_primary','viz_normalized'],
  screen:['viz_rank','viz_effects'],
  matrix:['viz_factorial','viz_matrix_relative','viz_effects'],
  evolution:['viz_observed','viz_metric_endpoint','viz_metric_trend_slope'],
  dose:['viz_dose','viz_dose_normalized','viz_halfdose'],
  competition:['viz_observed','viz_competition_logit','viz_selection'],
  kinetic:['viz_observed','viz_metric_mu_max','viz_metric_doubling_time','viz_metric_lag','viz_metric_auc'],
  manual:['viz_primary','viz_factorial']
};
const maxCards={daily:9,endpoint:6,screen:5,matrix:6,evolution:7,dose:7,competition:6,kinetic:8,manual:6};

async function validatePlotCards(id){
  const cards=page.locator('#visualDashboard .visual-card');
  const count=await cards.count();
  assert.ok(count>=expected[id].length,`${id}: expected at least ${expected[id].length} meaningful figures, got ${count}`);
  assert.ok(count<=maxCards[id],`${id}: report is still too redundant (${count} cards)`);
  assert.equal(await page.locator('#visualDashboard .visual-placeholder').count(),0,`${id}: empty/not-applicable plot cards must not be rendered`);
  const titles=(await cards.locator('.visual-card-head h4').allTextContents()).map(x=>x.trim());
  assert.equal(new Set(titles).size,titles.length,`${id}: duplicate figure titles found`);
  for(const plotId of expected[id]){
    const p=page.locator(`#${plotId}`);assert.equal(await p.count(),1,`${id}: missing ${plotId}`);
    await p.locator('.main-svg').first().waitFor({state:'attached',timeout:8000});
  }
  const health=await page.evaluate(()=>[...document.querySelectorAll('#visualDashboard .visual-plot')].map(el=>({id:el.id,traces:el.data?.length||0,w:el.getBoundingClientRect().width,h:el.getBoundingClientRect().height,svg:el.querySelectorAll('.main-svg').length})));
  for(const p of health){assert.ok(p.traces>0,`${id}/${p.id}: no Plotly traces`);assert.ok(p.svg>0,`${id}/${p.id}: no rendered SVG`);assert.ok(p.w>220&&p.h>180,`${id}/${p.id}: plot too small (${p.w}×${p.h})`)}
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);assert.ok(overflow<=6,`${id}: desktop horizontal overflow ${overflow}px`);
}

for(const id of Object.keys(expected)){
  await page.evaluate(x=>window.YeastFitPresets.loadDemo(x),id);
  await page.waitForFunction(x=>window.YeastFit?.S?.design?.preset===x&&window.YeastFit.S.metrics?.length>0,id);
  await page.waitForTimeout(300);
  await validatePlotCards(id);
  await page.screenshot({path:`${out}/${id}-desktop.png`,fullPage:true});
  await page.setViewportSize({width:390,height:844});await page.waitForTimeout(180);
  const mobileOverflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);assert.ok(mobileOverflow<=6,`${id}: mobile horizontal overflow ${mobileOverflow}px`);
  const mobileCards=await page.locator('#visualDashboard .visual-card').count();assert.ok(mobileCards<=maxCards[id],`${id}: mobile report still redundant`);
  await page.screenshot({path:`${out}/${id}-mobile.png`,fullPage:true});
  await page.setViewportSize({width:1440,height:1000});await page.waitForTimeout(120);
}

assert.deepEqual(errors,[],`Browser errors:\n${errors.join('\n')}`);
await browser.close();
console.log('Selective visual report passed all nine desktop and mobile scenarios.');
