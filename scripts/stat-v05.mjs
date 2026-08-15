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
if(!advanced.includes('matchedControlComparisons'))throw new Error('Failed to wire matched-control inference into advanced.js');
fs.writeFileSync('js/advanced.js',advanced);

let tests=fs.readFileSync('tests/comprehensive.test.mjs','utf8');
tests=tests.replace(
  "import { summarizeBy, controlNormalize, replicateDiagnostics, robustScreen, competitionSelection, halfResponseDose, twoByTwoInteraction } from '../js/comprehensive.js';",
  "import { summarizeBy, controlNormalize, matchedControlComparisons, replicateDiagnostics, robustScreen, competitionSelection, halfResponseDose, twoByTwoInteraction } from '../js/comprehensive.js';"
);
if(!tests.includes("matched-control inference uses biological log2 ratios"))tests += `\n\ntest('matched-control inference uses biological log2 ratios',()=>{\n  const rows=[\n    {condition:'A',genotype:'WT',relative_to_control:1,log2_ratio:0},\n    {condition:'A',genotype:'WT',relative_to_control:1,log2_ratio:0},\n    {condition:'A',genotype:'WT',relative_to_control:1,log2_ratio:0},\n    {condition:'A',genotype:'mut',relative_to_control:.72,log2_ratio:Math.log2(.72)},\n    {condition:'A',genotype:'mut',relative_to_control:.76,log2_ratio:Math.log2(.76)},\n    {condition:'A',genotype:'mut',relative_to_control:.8,log2_ratio:Math.log2(.8)}\n  ];\n  const out=matchedControlComparisons(rows,{groupField:'genotype',controlField:'genotype',controlValue:'WT',strata:['condition']});\n  assert.equal(out.length,1);\n  assert.equal(out[0].group,'mut');\n  assert.equal(out[0].n,3);\n  assert.ok(Number.isFinite(out[0].hedges_g));\n  assert.ok(Number.isFinite(out[0].p));\n  assert.ok(Number.isFinite(out[0].q));\n  assert.ok(out[0].ratio<1);\n});\n`;
fs.writeFileSync('tests/comprehensive.test.mjs',tests);
