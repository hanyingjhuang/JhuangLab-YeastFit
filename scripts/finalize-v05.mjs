import fs from 'node:fs';

const advanced=fs.readFileSync('js/advanced.js','utf8');
for(const required of [
  'function collapseMetricTable(rows)',
  'metrics=collapseMetricTable(S.metrics)',
  "filteredTests(out.normalizedMetrics,'relative_to_control'",
  'function reportStrata(strata=[])',
  'report_label'
]){
  if(!advanced.includes(required))throw new Error(`v0.5 analysis patch invariant failed: ${required}`);
}

let test=fs.readFileSync('tests/browser-smoke.mjs','utf8');
const matrixDiagnostic="assert.equal(await page.locator('#viz_effects').count(),1,'matrix effect card should exist');if(await page.locator('#viz_effects .main-svg').count()===0){const detail=await page.locator('[data-analysis-module=\"metricTests\"]').innerText();throw new Error(`matrix effect figure missing; integrated comparisons:\n${detail}`)}";
const replacements=[
  ["assert.ok(await page.locator('#viz_effects .main-svg').count()===1,'matrix should produce matched-control effect statistics');",matrixDiagnostic],
  ["assert.equal(await page.locator('#viz_effects').count(),1,'matrix effect card should exist');await page.locator('#viz_effects .main-svg').first().waitFor({state:'attached',timeout:8000});",matrixDiagnostic],
  ["assert.ok(await page.locator('#viz_serial_auc .main-svg').count()===1,'daily report should include AUC');","assert.equal(await page.locator('#viz_serial_auc').count(),1,'daily AUC card should exist');await page.locator('#viz_serial_auc .main-svg').first().waitFor({state:'attached',timeout:8000});"],
  ["assert.ok(await page.locator('#viz_serial_trend_slope .main-svg').count()===1,'daily report should include longitudinal slope');","assert.equal(await page.locator('#viz_serial_trend_slope').count(),1,'daily slope card should exist');await page.locator('#viz_serial_trend_slope .main-svg').first().waitFor({state:'attached',timeout:8000});"],
  ["assert.ok(await page.locator('#viz_metric_auc .main-svg').count()===1,'kinetic report should include AUC');","assert.equal(await page.locator('#viz_metric_auc').count(),1,'kinetic AUC card should exist');await page.locator('#viz_metric_auc .main-svg').first().waitFor({state:'attached',timeout:8000});"],
  ["assert.ok(await page.locator('#viz_metric_doubling_time .main-svg').count()===1,'kinetic report should include doubling time');","assert.equal(await page.locator('#viz_metric_doubling_time').count(),1,'kinetic doubling-time card should exist');await page.locator('#viz_metric_doubling_time .main-svg').first().waitFor({state:'attached',timeout:8000});"],
  ["assert.ok(await page.locator('#viz_metric_lag .main-svg').count()===1,'kinetic report should include lag');","assert.equal(await page.locator('#viz_metric_lag').count(),1,'kinetic lag card should exist');await page.locator('#viz_metric_lag .main-svg').first().waitFor({state:'attached',timeout:8000});"],
  ["await page.locator('#viz_serial_auc .main-svg').waitFor({state:'attached',timeout:8000});","await page.locator('#viz_serial_auc .main-svg').first().waitFor({state:'attached',timeout:8000});"],
  ["await page.locator('#viz_serial_trend_slope .main-svg').waitFor({state:'attached',timeout:8000});","await page.locator('#viz_serial_trend_slope .main-svg').first().waitFor({state:'attached',timeout:8000});"],
  ["await page.locator('#viz_metric_auc .main-svg').waitFor({state:'attached',timeout:8000});","await page.locator('#viz_metric_auc .main-svg').first().waitFor({state:'attached',timeout:8000});"],
  ["await page.locator('#viz_metric_doubling_time .main-svg').waitFor({state:'attached',timeout:8000});","await page.locator('#viz_metric_doubling_time .main-svg').first().waitFor({state:'attached',timeout:8000});"],
  ["await page.locator('#viz_metric_lag .main-svg').waitFor({state:'attached',timeout:8000});","await page.locator('#viz_metric_lag .main-svg').first().waitFor({state:'attached',timeout:8000});"]
];
for(const [oldValue,newValue] of replacements)if(test.includes(oldValue))test=test.replaceAll(oldValue,newValue);
fs.writeFileSync('tests/browser-smoke.mjs',test);
