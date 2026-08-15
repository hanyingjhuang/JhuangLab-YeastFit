import fs from 'node:fs';

let presets=fs.readFileSync('js/presets.js','utf8');
const demoNeedle="step(2);design();applyPreset(id);if(id==='manual'){review();runAnalysis()}else runAnalysis();";
const demoReplacement="step(2);design();if(id==='manual'){S.design.seriesMode='auto';setValue('#seriesMode','auto')}applyPreset(id);if(id==='manual'){review();runAnalysis()}else runAnalysis();";
if(presets.includes(demoNeedle))presets=presets.replace(demoNeedle,demoReplacement);
if(!presets.includes("if(id==='manual'){S.design.seriesMode='auto';setValue('#seriesMode','auto')}applyPreset(id)"))throw new Error('Manual demo reset patch failed');
fs.writeFileSync('js/presets.js',presets);

let dashboard=fs.readFileSync('js/dashboard.js','utf8');
dashboard=dashboard.replace(
  "primary=metric||['endpoint','auc','max_value','trend_slope'].find(m=>metrics.some(r=>Number.isFinite(+r[m])))||'';",
  "primary=metric||['endpoint','auc','max_value','trend_slope'].find(m=>metrics.some(r=>Number.isFinite(+r[m])))||'',aggregateCore=preset!=='dose';"
);
dashboard=dashboard.replace(
  "<p>Every experiment receives the same core views for magnitude, uncertainty, controls, statistics, sample size, and QC. Design-specific views are added below when supported.</p>",
  "<p>Every experiment receives core views for magnitude, uncertainty, controls, statistics, replicate coverage, and QC when they are meaningful. Design-specific views replace generic summaries when the design calls for them.</p>"
);
dashboard=dashboard.replaceAll("if(group&&primary){const el=card(grid,'viz_primary'","if(aggregateCore&&group&&primary){const el=card(grid,'viz_primary'");
dashboard=dashboard.replaceAll("if(group&&primary){const el=card(grid,'viz_group_summary'","if(aggregateCore&&group&&primary){const el=card(grid,'viz_group_summary'");
dashboard=dashboard.replaceAll("if(group&&primary&&cfg.controlField){const el=card(grid,'viz_normalized'","if(aggregateCore&&group&&primary&&cfg.controlField){const el=card(grid,'viz_normalized'");
dashboard=dashboard.replace(
  "if(group){const el=card(grid,'viz_n','Biological sample size','Number of biological-level observations contributing to each group.');let lo=base('');lo.xaxis.title='Biological n';",
  "if(group){const el=card(grid,'viz_n','Biological-level observations','Number of biological-level rows represented in the current report. Repeated timepoints, doses, or conditions may contribute multiple rows per biological replicate.');let lo=base('');lo.xaxis.title='Biological-level rows';"
);
dashboard=dashboard.replace("if(group&&data.ranking?.length){const el=card(grid,'viz_rank'","if(aggregateCore&&group&&data.ranking?.length){const el=card(grid,'viz_rank'");
if(!dashboard.includes("aggregateCore=preset!=='dose'"))throw new Error('Dose aggregation guard patch failed');
if(!dashboard.includes('Biological-level observations'))throw new Error('Observation-count label patch failed');
fs.writeFileSync('js/dashboard.js',dashboard);

let test=fs.readFileSync('tests/browser-smoke.mjs','utf8');
const anchor="  if(id==='endpoint')assert.equal(Number(overview['Biological-level rows']),16,'endpoint demo should contain 16 biological-level observations');";
const addition=`  if(id==='manual'){\n    const mode=await page.locator('.analysis-bundle-badge').textContent();\n    assert.equal(mode?.trim().toLowerCase(),'endpoint','manual demo must not inherit a prior kinetic/serial mode');\n    assert.ok(await page.locator('#viz_primary .main-svg').count()>0,'manual endpoint demo should render its primary phenotype view');\n  }\n  if(id==='dose'){\n    assert.equal(await page.locator('#viz_primary').count(),0,'dose response should not pool all doses into a generic endpoint distribution');\n    assert.equal(await page.locator('#viz_rank').count(),0,'dose response should not show a pooled cross-dose ranking');\n    assert.ok(await page.locator('#viz_dose .main-svg').count()>0,'dose response curve should render');\n    assert.ok(await page.locator('#viz_halfdose .main-svg').count()>0,'half-response summary should render');\n  }\n`;
if(test.includes(anchor)&&!test.includes('manual demo must not inherit'))test=test.replace(anchor,`${anchor}\n${addition}`);
fs.writeFileSync('tests/browser-smoke.mjs',test);
