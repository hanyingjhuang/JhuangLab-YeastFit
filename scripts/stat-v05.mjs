import fs from 'node:fs';

let advanced=fs.readFileSync('js/advanced.js','utf8');
advanced=advanced.replace(
  "import { groupRows, summarizeBy, controlNormalize, replicateDiagnostics, robustScreen, competitionSelection, halfResponseDose, factorialLandscape, twoByTwoInteraction } from './comprehensive.js';",
  "import { groupRows, summarizeBy, controlNormalize, matchedControlComparisons, replicateDiagnostics, robustScreen, competitionSelection, halfResponseDose, factorialLandscape, twoByTwoInteraction } from './comprehensive.js';"
);
advanced=advanced.replace(
  "out.timepointTests=out.normalizedPoints.length&&group?filteredTests(out.normalizedPoints,'relative_to_control',group,cfg,pointTestStrata):[];",
  "out.timepointTests=out.normalizedPoints.length&&group?matchedControlComparisons(out.normalizedPoints,{groupField:group,controlField:cfg.controlField,controlValue:cfg.controlValue,strata:pointTestStrata}):[];"
);
advanced=advanced.replace(
  "out.metricTests=metric&&group&&out.normalizedMetrics.length?filteredTests(out.normalizedMetrics,'relative_to_control',group,cfg,summaryStrata):[];",
  "out.metricTests=metric&&group&&out.normalizedMetrics.length?matchedControlComparisons(out.normalizedMetrics,{groupField:group,controlField:cfg.controlField,controlValue:cfg.controlValue,strata:summaryStrata}):[];"
);
advanced=advanced.replace(
  "tables={};const data=comprehensiveData(),mode=S.design.analysisModeResolved||'endpoint',group=preferredGroup(),metric=metricForMode(),preset=S.design.presetName||'Automatic / custom',hasTime=data.inferencePoints.some(r=>Number.isFinite(+r.time));",
  "tables={};const data=comprehensiveData(),mode=S.design.analysisModeResolved||'endpoint',group=preferredGroup(),metric=metricForMode(),preset=S.design.presetName||'Automatic / custom',hasTime=data.inferencePoints.some(r=>Number.isFinite(+r.time));if(location.hostname==='127.0.0.1')window.__YEASTFIT_TEST_DEBUG={design:{...S.design},factors:[...(S.factors||[])],group,metric,inferenceMetrics:data.inferenceMetrics.map(r=>({genotype:r.genotype,condition:r.condition,plate:r.plate,biological_rep:r.biological_rep,endpoint:r.endpoint})),normalizedMetrics:(data.normalizedMetrics||[]).map(r=>({genotype:r.genotype,condition:r.condition,plate:r.plate,biological_rep:r.biological_rep,endpoint:r.endpoint,relative_to_control:r.relative_to_control,log2_ratio:r.log2_ratio})),metricTests:data.metricTests};"
);
if(!advanced.includes('matchedControlComparisons'))throw new Error('Failed to wire matched-control inference into advanced.js');
fs.writeFileSync('js/advanced.js',advanced);

let tests=fs.readFileSync('tests/comprehensive.test.mjs','utf8');
tests=tests.replace(
  "import { summarizeBy, controlNormalize, replicateDiagnostics, robustScreen, competitionSelection, halfResponseDose, twoByTwoInteraction } from '../js/comprehensive.js';",
  "import { summarizeBy, controlNormalize, matchedControlComparisons, replicateDiagnostics, robustScreen, competitionSelection, halfResponseDose, twoByTwoInteraction } from '../js/comprehensive.js';"
);
if(!tests.includes("matched-control inference uses biological log2 ratios"))tests += `\n\ntest('matched-control inference uses biological log2 ratios',()=>{\n  const rows=[\n    {condition:'A',genotype:'WT',relative_to_control:1,log2_ratio:0},\n    {condition:'A',genotype:'WT',relative_to_control:1,log2_ratio:0},\n    {condition:'A',genotype:'WT',relative_to_control:1,log2_ratio:0},\n    {condition:'A',genotype:'mut',relative_to_control:.72,log2_ratio:Math.log2(.72)},\n    {condition:'A',genotype:'mut',relative_to_control:.76,log2_ratio:Math.log2(.76)},\n    {condition:'A',genotype:'mut',relative_to_control:.8,log2_ratio:Math.log2(.8)}\n  ];\n  const out=matchedControlComparisons(rows,{groupField:'genotype',controlField:'genotype',controlValue:'WT',strata:['condition']});\n  assert.equal(out.length,1);\n  assert.equal(out[0].group,'mut');\n  assert.equal(out[0].n,3);\n  assert.ok(Number.isFinite(out[0].hedges_g));\n  assert.ok(Number.isFinite(out[0].p));\n  assert.ok(Number.isFinite(out[0].q));\n  assert.ok(out[0].ratio<1);\n});\n`;
if(!tests.includes("matrix demo produces matched-control comparisons after biological collapse"))tests += `\n\ntest('matrix demo produces matched-control comparisons after biological collapse',async()=>{\n  const { makeDemo }=await import('../js/demo-catalog.js');\n  const raw=makeDemo('matrix').rows;\n  const collapsed=summarizeBy(raw,['genotype','condition','biological_rep','plate'],'value').map(r=>({genotype:r.genotype,condition:r.condition,biological_rep:r.biological_rep,plate:r.plate,endpoint:r.median}));\n  const normalized=controlNormalize(collapsed,'endpoint',{controlField:'genotype',controlValue:'WT',strata:['condition','plate']});\n  const out=matchedControlComparisons(normalized,{groupField:'genotype',controlField:'genotype',controlValue:'WT',strata:['condition']});\n  assert.equal(out.length,12);\n  assert.ok(out.every(r=>r.n===3));\n  assert.ok(out.every(r=>Number.isFinite(r.hedges_g)&&Number.isFinite(r.p)&&Number.isFinite(r.q)));\n});\n`;
fs.writeFileSync('tests/comprehensive.test.mjs',tests);
