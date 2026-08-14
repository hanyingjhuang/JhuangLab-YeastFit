import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeBy, controlNormalize, replicateDiagnostics, robustScreen, competitionSelection, halfResponseDose, twoByTwoInteraction } from '../js/comprehensive.js';

test('summary returns replicate statistics',()=>{
  const out=summarizeBy([{g:'A',value:1},{g:'A',value:2},{g:'A',value:3}],['g']);
  assert.equal(out[0].n,3);assert.equal(out[0].mean,2);assert.ok(Number.isFinite(out[0].sem));
});

test('control normalization respects time strata',()=>{
  const rows=[{time:0,role:'control',value:2},{time:0,role:'sample',value:1},{time:1,role:'control',value:4},{time:1,role:'sample',value:2}];
  const out=controlNormalize(rows,'value',{strata:['time']});
  assert.equal(out[1].relative_to_control,.5);assert.equal(out[3].relative_to_control,.5);
});

test('technical replicate diagnostics flag high CV',()=>{
  const rows=[{bio:1,tech:1,time:0,value:1},{bio:1,tech:2,time:0,value:2}];
  const out=replicateDiagnostics(rows,{technicalField:'tech',biologicalField:'bio',cvWarn:.1});
  assert.equal(out[0].replicate_cv_flag,'high_technical_cv');
});

test('robust screen ranks low fitness first',()=>{
  const rows=[{role:'control',endpoint:1},{role:'control',endpoint:1.1},{role:'control',endpoint:.9},{role:'sample',endpoint:.2},{role:'sample',endpoint:.8}];
  const out=robustScreen(rows,{metric:'endpoint'});
  assert.equal(out[0].endpoint,.2);assert.equal(out[0].rank,1);
});

test('competition proxy uses logit slope',()=>{
  const rows=[{curve_id:'x',time:0,value:.2},{curve_id:'x',time:1,value:.3},{curve_id:'x',time:2,value:.45}];
  const out=competitionSelection(rows);
  assert.ok(out[0].selection_coefficient_proxy>0);assert.ok(out[0].logit_trend_r2>.9);
});

test('half response dose interpolates a crossing',()=>{
  const rows=[{dose:0,value:1},{dose:1,value:.8},{dose:10,value:.2},{dose:100,value:.1}];
  const out=halfResponseDose(rows,{doseField:'dose'});
  assert.equal(out.length,1);assert.ok(Number.isFinite(out[0].half_response_dose));
});

test('2x2 interaction returns difference in differences',()=>{
  const rows=[{a:'A0',b:'B0',value:1},{a:'A1',b:'B0',value:2},{a:'A0',b:'B1',value:1},{a:'A1',b:'B1',value:4}];
  const out=twoByTwoInteraction(rows,'a','b');
  assert.equal(out.interaction_difference_in_differences,2);
});
