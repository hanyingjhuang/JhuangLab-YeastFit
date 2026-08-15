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

if(!dashboard.includes('function doseNormalizedTrace')){
  dashboard=dashboard.replace("function competitionLogit(rows,group){",`function doseNormalizedTrace(rows,dose,group){const ls=group?levels(rows,group):['all'];return ls.slice(0,10).map((g,i)=>{const rr=group?rows.filter(r=>r[group]===g):rows,d=uniq(rr.map(r=>+r[dose]).filter(Number.isFinite)).sort((a,b)=>a-b),baseline=med(rr.filter(r=>+r[dose]===d[0]).map(r=>r.value));return{type:'scatter',mode:'lines+markers',name:String(g),x:d,y:d.map(x=>{const v=med(rr.filter(r=>+r[dose]===x).map(r=>r.value));return Number.isFinite(v)&&baseline? v/baseline:NaN}),line:{width:2,color:color(i)},marker:{size:6,color:color(i)}}})}\nfunction doseHeatmap(rows,dose,group){if(!group)return[];const ds=uniq(rows.map(r=>+r[dose]).filter(Number.isFinite)).sort((a,b)=>a-b),ls=levels(rows,group);if(!ds.length||!ls.length)return[];return[{type:'heatmap',x:ds,y:ls,z:ls.map(g=>ds.map(d=>med(rows.filter(r=>r[group]===g&&+r[dose]===d).map(r=>r.value)))),colorscale:'YlGnBu',colorbar:{title:'Response',thickness:12},hovertemplate:\`${'${group}'}=%{y}<br>${'${dose}'}=%{x}<br>response=%{z:.3g}<extra></extra>\`}]}\nfunction competitionLogit(rows,group){`);
}
const oldDose="  if(preset==='dose'){const dose=(S.factors||[]).find(x=>/dose|concentration|conc/i.test(x));if(dose){const el=card(grid,'viz_dose','Dose-response profile','Median biological response at each observed concentration.',{wide:true});let lo=base('Response');lo.xaxis.title=dose;plot(el,doseTrace(points.length?points:metrics,dose,group),lo)}if(data.dose?.length){const label=Object.keys(data.dose[0]).find(k=>!['baseline_response','extreme_response','half_response_target','half_response_dose','n_doses','direction'].includes(k));const el=card(grid,'viz_halfdose','Half-response estimate','Observed-range midpoint estimates where the response crosses its half-response target.');let lo=base('Half-response dose');lo.showlegend=false;plot(el,[{type:'bar',x:data.dose.map((x,i)=>String(label?x[label]:i+1)),y:data.dose.map(x=>+x.half_response_dose),marker:{color:'#315c45'}}],lo)}}";
const newDose="  if(preset==='dose'){const dose=(S.factors||[]).find(x=>/dose|concentration|conc/i.test(x)),source=points.length?points:metrics;if(dose){const el=card(grid,'viz_dose','Dose-response profile','Median biological response at each observed concentration.',{wide:true});let lo=base('Response');lo.xaxis.title=dose;plot(el,doseTrace(source,dose,group),lo);const n=card(grid,'viz_dose_normalized','Normalized dose-response','Response within each biological group relative to its lowest observed dose.');lo=base('Relative to baseline');lo.xaxis.title=dose;plot(n,doseNormalizedTrace(source,dose,group),lo);const h=card(grid,'viz_dose_heatmap','Genotype × dose response map','Median response across genotype and dose without pooling the dose axis.',{wide:true});lo=base('');lo.xaxis.title=dose;lo.yaxis.title=group;lo.showlegend=false;plot(h,doseHeatmap(source,dose,group),lo)}if(data.dose?.length){const label=Object.keys(data.dose[0]).find(k=>!['baseline_response','extreme_response','half_response_target','half_response_dose','n_doses','direction'].includes(k));const el=card(grid,'viz_halfdose','Half-response estimate','Observed-range midpoint estimates where the response crosses its half-response target.');let lo=base('Half-response dose');lo.showlegend=false;plot(el,[{type:'bar',x:data.dose.map((x,i)=>String(label?x[label]:i+1)),y:data.dose.map(x=>+x.half_response_dose),marker:{color:'#315c45'}}],lo)}}";
if(dashboard.includes(oldDose))dashboard=dashboard.replace(oldDose,newDose);

if(!dashboard.includes("aggregateCore=preset!=='dose'"))throw new Error('Dose aggregation guard patch failed');
if(!dashboard.includes('Biological-level observations'))throw new Error('Observation-count label patch failed');
if(!dashboard.includes('viz_dose_normalized')||!dashboard.includes('viz_dose_heatmap'))throw new Error('Dose-specific visual expansion failed');
fs.writeFileSync('js/dashboard.js',dashboard);

let test=fs.readFileSync('tests/browser-smoke.mjs','utf8');
const anchor="  if(id==='endpoint')assert.equal(Number(overview['Biological-level rows']),16,'endpoint demo should contain 16 biological-level observations');";
const addition=`  if(id==='manual'){\n    const mode=await page.locator('.analysis-bundle-badge').textContent();\n    assert.equal(mode?.trim().toLowerCase(),'endpoint','manual demo must not inherit a prior kinetic/serial mode');\n    assert.ok(await page.locator('#viz_primary .main-svg').count()>0,'manual endpoint demo should render its primary phenotype view');\n  }\n  if(id==='dose'){\n    assert.equal(await page.locator('#viz_primary').count(),0,'dose response should not pool all doses into a generic endpoint distribution');\n    assert.equal(await page.locator('#viz_rank').count(),0,'dose response should not show a pooled cross-dose ranking');\n    assert.ok(await page.locator('#viz_dose .main-svg').count()>0,'dose response curve should render');\n    assert.ok(await page.locator('#viz_dose_normalized .main-svg').count()>0,'normalized dose-response curve should render');\n    assert.ok(await page.locator('#viz_dose_heatmap .main-svg').count()>0,'dose heatmap should render');\n    assert.ok(await page.locator('#viz_halfdose .main-svg').count()>0,'half-response summary should render');\n  }\n`;
if(test.includes(anchor)&&!test.includes('manual demo must not inherit'))test=test.replace(anchor,`${anchor}\n${addition}`);
fs.writeFileSync('tests/browser-smoke.mjs',test);
