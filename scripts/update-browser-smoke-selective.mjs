import fs from 'node:fs';

let s=fs.readFileSync('tests/browser-smoke.mjs','utf8');
s=s.replace("await page.waitForFunction(()=>document.querySelectorAll('#visualDashboard .visual-card').length>=6);","await page.waitForFunction(()=>document.querySelectorAll('#visualDashboard .visual-card').length>0);");
const start=s.indexOf("const scenarios=['daily','endpoint','screen','matrix','evolution','dose','competition','kinetic','manual'];");
const end=s.indexOf('// Exercise every user-facing import route',start);
if(start<0||end<0)throw new Error('Could not locate scenario loop in browser-smoke.mjs');
const replacement=`const scenarios=['daily','endpoint','screen','matrix','evolution','dose','competition','kinetic','manual'];
const visualExpected={
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
const visualMax={daily:9,endpoint:6,screen:5,matrix:6,evolution:7,dose:7,competition:6,kinetic:8,manual:6};
for(const id of scenarios){
  await page.evaluate(x=>window.YeastFitPresets.loadDemo(x),id);
  await page.waitForFunction(x=>window.YeastFit?.S?.design?.preset===x&&window.YeastFit.S.metrics?.length>0,id);
  await page.waitForFunction(()=>document.querySelectorAll('#visualDashboard .visual-card').length>0);
  await page.waitForTimeout(250);
  const cards=await page.locator('#visualDashboard .visual-card').count();
  assert.ok(cards>=visualExpected[id].length,\`${'${id}'}: too few meaningful figures (${ '${cards}' })\`);
  assert.ok(cards<=visualMax[id],\`${'${id}'}: visual report is redundant (${ '${cards}' } cards)\`);
  assert.equal(await page.locator('#visualDashboard .visual-placeholder').count(),0,\`${'${id}'}: empty plot card rendered\`);
  const titles=(await page.locator('#visualDashboard .visual-card-head h4').allTextContents()).map(x=>x.trim());
  assert.equal(new Set(titles).size,titles.length,\`${'${id}'}: duplicate plot titles\`);
  for(const plotId of visualExpected[id]){const p=page.locator(\`#${'${plotId}'}\`);assert.equal(await p.count(),1,\`${'${id}'}: missing ${'${plotId}'}\`);await p.locator('.main-svg').first().waitFor({state:'attached',timeout:8000});}
  const health=await page.evaluate(()=>[...document.querySelectorAll('#visualDashboard .visual-plot')].map(el=>({id:el.id,traces:el.data?.length||0,w:el.getBoundingClientRect().width,h:el.getBoundingClientRect().height,svg:el.querySelectorAll('.main-svg').length})));
  for(const p of health){assert.ok(p.traces>0,\`${'${id}'}/${'${p.id}'}: no traces\`);assert.ok(p.svg>0,\`${'${id}'}/${'${p.id}'}: no SVG\`);assert.ok(p.w>220&&p.h>180,\`${'${id}'}/${'${p.id}'}: undersized plot\`)}
  const status=await page.locator('#analysisStatus').textContent();assert.doesNotMatch(status||'',/not run/i,\`${'${id}'}: analysis must run\`);
  assert.equal(await page.locator('#rawDiagnostics').count(),1,\`${'${id}'}: raw diagnostics exists\`);
  assert.equal(await page.locator('#rawDiagnostics').evaluate(el=>el.open),false,\`${'${id}'}: raw diagnostics collapsed by default\`);
  const overview=await page.evaluate(()=>Object.fromEntries([...document.querySelectorAll('.analysis-overview-grid>div')].map(x=>[x.querySelector('small')?.textContent?.trim(),x.querySelector('b')?.textContent?.trim()])));
  if(await page.evaluate(()=>Boolean(window.YeastFit.S.design.techRepField)))assert.ok(Number(overview['Biological-level rows'])<Number(overview['Measurements']),\`${'${id}'}: technical replicates must collapse\`);
  if(['endpoint','screen'].includes(id)){const headers=await page.locator('[data-analysis-module="timepoints"] th').allTextContents();assert.ok(!headers.some(h=>h.trim().toLowerCase()==='time'),\`${'${id}'}: endpoint summary has meaningless time\`)}
  if(id==='endpoint')assert.equal(Number(overview['Biological-level rows']),16,'endpoint demo should contain 16 biological-level observations');
  if(id==='screen')assert.equal(Number(overview['Biological-level rows']),39,'screen demo should contain 39 biological-level observations');
  if(id==='dose'){const doseHeaders=await page.locator('[data-analysis-module="timepoints"] th').allTextContents();assert.ok(doseHeaders.some(h=>h.trim().toLowerCase()==='dose'),'dose summaries must retain dose');}
  if(['endpoint','screen','matrix'].includes(id)){const summaryText=await page.locator('[data-analysis-module="timepoints"]').innerText();assert.ok(!/\\bNaN\\b/.test(summaryText),\`${'${id}'}: fragmented n=1 summary\`)}
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);assert.ok(overflow<=6,\`${'${id}'}: horizontal overflow ${'${overflow}'}px\`);
  await page.screenshot({path:\`${'${out}'}/${'${id}'}-desktop.png\`,fullPage:true});
}

`;
s=s.slice(0,start)+replacement+s.slice(end);
s=s.replaceAll(">=4,'CSV endpoint renders report'",">=2,'CSV endpoint renders report'");
s=s.replaceAll(">=4,'TSV daily renders report'",">=2,'TSV daily renders report'");
s=s.replaceAll(">=4,'JSON endpoint renders report'",">=2,'JSON endpoint renders report'");
s=s.replaceAll(">=4,'XLSX endpoint renders report'",">=2,'XLSX endpoint renders report'");
s=s.replaceAll(">=4,'XLS endpoint renders report'",">=2,'XLS endpoint renders report'");
fs.writeFileSync('tests/browser-smoke.mjs',s);
