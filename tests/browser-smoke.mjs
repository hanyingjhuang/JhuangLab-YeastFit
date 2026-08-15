import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const base=process.env.YEASTFIT_URL||'http://127.0.0.1:4173';
const out=process.env.YEASTFIT_ARTIFACTS||'test-artifacts';
await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true});
const errors=[];

async function ready(page){
  page.on('pageerror',e=>errors.push(`pageerror: ${e.message}`));
  page.on('console',m=>{if(m.type()==='error')errors.push(`console: ${m.text()}`)});
  await page.goto(base,{waitUntil:'networkidle'});
  await page.waitForFunction(()=>window.YeastFit&&window.YeastFitPresets&&window.YeastFitWorkflowV05);
}

const context=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true});
const page=await context.newPage();
await ready(page);
assert.equal(await page.locator('.brand-kicker').textContent(),'JHUANG LAB');
assert.equal(await page.locator('.step[data-step="2"]').evaluate(el=>getComputedStyle(el).display),'none');
assert.ok(await page.locator('.step-panel[data-panel="1"] #presetChooser').count()===1,'preset chooser must be on Setup');
assert.ok(await page.locator('.step-panel[data-panel="1"] #setupDesignReview').count()===1,'mapping review must be on Setup');
assert.ok(await page.locator('#templateLibrary .template-card').count()>=10,'template library must cover all designs plus plate map');

const csvDownload=page.waitForEvent('download');
await page.locator('.template-download[data-template="daily"][data-format="csv"]').click();
const csv=await csvDownload;assert.match(csv.suggestedFilename(),/daily_template\.csv$/);await csv.saveAs(`${out}/daily_template.csv`);
const xlsxDownload=page.waitForEvent('download');
await page.locator('.template-download[data-template="matrix"][data-format="xlsx"]').click();
const xlsx=await xlsxDownload;assert.match(xlsx.suggestedFilename(),/matrix_template\.xlsx$/);await xlsx.saveAs(`${out}/matrix_template.xlsx`);

const scenarios=['daily','endpoint','screen','matrix','evolution','dose','competition','kinetic','manual'];
for(const id of scenarios){
  await page.evaluate(x=>window.YeastFitPresets.loadDemo(x),id);
  await page.waitForFunction(x=>window.YeastFit?.S?.design?.preset===x&&window.YeastFit.S.metrics?.length>0,id);
  await page.waitForFunction(()=>document.querySelectorAll('#visualDashboard .visual-card').length>=6);
  await page.waitForTimeout(250);
  const cards=await page.locator('#visualDashboard .visual-card').count();
  const rendered=await page.locator('#visualDashboard .main-svg').count();
  assert.ok(cards>=6,`${id}: comprehensive report needs >=6 figure cards, got ${cards}`);
  assert.ok(rendered>=4,`${id}: at least 4 rendered plots expected, got ${rendered}`);
  const status=await page.locator('#analysisStatus').textContent();assert.doesNotMatch(status||'',/not run/i,`${id}: analysis must run`);
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
  assert.ok(overflow<=6,`${id}: horizontal overflow ${overflow}px`);
  await page.screenshot({path:`${out}/${id}-desktop.png`,fullPage:true});
}

await context.close();
const mobile=await browser.newContext({viewport:{width:390,height:844}});const mpage=await mobile.newPage();await ready(mpage);
await mpage.evaluate(()=>window.YeastFitPresets.loadDemo('daily'));
await mpage.waitForFunction(()=>window.YeastFit?.S?.metrics?.length>0&&document.querySelectorAll('#visualDashboard .visual-card').length>=6);
await mpage.waitForTimeout(250);
const mobileOverflow=await mpage.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
assert.ok(mobileOverflow<=6,`mobile horizontal overflow ${mobileOverflow}px`);
await mpage.screenshot({path:`${out}/daily-mobile.png`,fullPage:true});
await mobile.close();
await browser.close();
assert.deepEqual(errors,[],`Browser errors:\n${errors.join('\n')}`);
console.log(`Browser validation passed for ${scenarios.length} experiment designs.`);
