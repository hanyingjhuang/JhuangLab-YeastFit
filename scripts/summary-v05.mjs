import fs from 'node:fs';

let advanced=fs.readFileSync('js/advanced.js','utf8');
const helperAnchor="function reportStrata(strata=[]){return uniq(strata.filter(f=>!/(^|_)(plate|batch|run|experiment)(_|$)/i.test(f)));}";
const helperReplacement=`${helperAnchor}\nfunction reportFactors(rows,group,summaryStrata=[],hasTime=false){return (S.factors||[]).filter(f=>{if(!f||f===group||summaryStrata.includes(f)||!has(rows,f))return false;if(hasTime&&/^(time|day|days|generation|generations)$/i.test(f))return false;if(group&&rows.every(r=>String(r[f]??'')===String(r[group]??'')))return false;return uniq(rows.map(r=>r[f])).length>1;});}`;
if(advanced.includes(helperAnchor)&&!advanced.includes('function reportFactors(rows'))advanced=advanced.replace(helperAnchor,helperReplacement);

const oldBlock="  const out={},hasTime=pts.some(r=>Number.isFinite(+r.time)),summaryStrata=reportStrata(cfg.strata);\n  const pointNormStrata=uniq([...cfg.strata,hasTime?'time':''].filter(Boolean));\n  const pointTestStrata=uniq([...summaryStrata,hasTime?'time':''].filter(Boolean));\n  const pointGroupFields=uniq([group,...pointTestStrata].filter(Boolean));\n  out.timepointSummary=pts.length?summarizeBy(pts,pointGroupFields,'value'):[];";
const newBlock="  const out={},hasTime=pts.some(r=>Number.isFinite(+r.time)),summaryStrata=reportStrata(cfg.strata);\n  const pointNormStrata=uniq([...cfg.strata,hasTime?'time':''].filter(Boolean));\n  const pointTestStrata=uniq([...summaryStrata,hasTime?'time':''].filter(Boolean));\n  const pointReportFactors=reportFactors(pts,group,summaryStrata,hasTime);\n  const metricReportFactors=reportFactors(metrics,group,summaryStrata,false);\n  const pointGroupFields=uniq([group,...summaryStrata,...pointReportFactors,hasTime?'time':''].filter(Boolean));\n  out.timepointSummary=pts.length?summarizeBy(pts,pointGroupFields,'value'):[];";
if(advanced.includes(oldBlock))advanced=advanced.replace(oldBlock,newBlock);
advanced=advanced.replace(
  "out.metricSummary=metric&&group?summarizeBy(metrics,uniq([group,...summaryStrata].filter(Boolean)),metric):[];",
  "out.metricSummary=metric&&group?summarizeBy(metrics,uniq([group,...summaryStrata,...metricReportFactors].filter(Boolean)),metric):[];"
);
if(!advanced.includes('pointReportFactors=reportFactors'))throw new Error('Point summary factor preservation patch failed');
if(!advanced.includes('metricReportFactors=reportFactors'))throw new Error('Metric summary factor preservation patch failed');
fs.writeFileSync('js/advanced.js',advanced);

let test=fs.readFileSync('tests/browser-smoke.mjs','utf8');
const doseNeedle="    assert.ok(await page.locator('#viz_halfdose .main-svg').count()>0,'half-response summary should render');";
const doseExtra=`${doseNeedle}\n    const doseHeaders=await page.locator('[data-analysis-module=\"timepoints\"] th').allTextContents();\n    assert.ok(doseHeaders.some(h=>h.trim().toLowerCase()==='dose'),'dose summaries must retain the dose factor');`;
if(test.includes(doseNeedle)&&!test.includes('dose summaries must retain'))test=test.replace(doseNeedle,doseExtra);
const manualNeedle="    assert.ok(await page.locator('#viz_factorial .main-svg').count()>0,'manual custom demo should render its detected factorial landscape');";
const manualExtra=`${manualNeedle}\n    const manualHeaders=await page.locator('[data-analysis-module=\"timepoints\"] th').allTextContents();\n    assert.ok(manualHeaders.some(h=>h.trim().toLowerCase()==='background'),'manual summaries must retain background');\n    assert.ok(manualHeaders.some(h=>h.trim().toLowerCase()==='stress'),'manual summaries must retain stress');`;
if(test.includes(manualNeedle)&&!test.includes('manual summaries must retain'))test=test.replace(manualNeedle,manualExtra);
fs.writeFileSync('tests/browser-smoke.mjs',test);
