import test from 'node:test';
import assert from 'node:assert/strict';
import { DEMOS, makeDemo } from '../js/demo-catalog.js';
import { analyzeCurve, analyzeSerialSeries } from '../js/analysis.js';
import { controlNormalize, robustScreen, competitionSelection, halfResponseDose, factorialLandscape } from '../js/comprehensive.js';

const expected=['daily','endpoint','screen','matrix','evolution','dose','competition','kinetic','manual'];
test('demo catalog covers every preset',()=>assert.deepEqual(DEMOS,expected));

for(const id of expected)test(`${id} demo has analyzable structure`,()=>{
  const {rows,preset}=makeDemo(id);assert.equal(preset,id);assert.ok(rows.length>=6);assert.ok(rows.every(r=>Number.isFinite(Number(r.value))));
  const bio=new Set(rows.map(r=>r.biological_rep).filter(v=>v!==undefined));assert.ok(bio.size>=3,`${id}: >=3 biological replicates`);
  if(['daily','evolution','competition','kinetic'].includes(id)){
    const timeField=id==='evolution'?'generation':id==='kinetic'?'time':'day';
    assert.ok(new Set(rows.map(r=>r[timeField])).size>=3,`${id}: repeated timepoints`);
  }
});

test('daily serial analysis returns longitudinal metrics',()=>{
  const rows=makeDemo('daily').rows.filter(r=>r.sample==='WT_B1_T1').map(r=>({time:r.day,value:r.value}));
  const x=analyzeSerialSeries(rows);assert.ok(Number.isFinite(x.endpoint));assert.ok(Number.isFinite(x.auc));assert.ok(Number.isFinite(x.trendSlope));
});

test('kinetic demo supports kinetic metrics',()=>{
  const rows=makeDemo('kinetic').rows.filter(r=>r.sample==='WT_B1_T1').map(r=>({time:r.time,value:r.value}));
  const x=analyzeCurve(rows,{growth:{minOD:.03,maxOD:.9,windowPoints:5,minR2:.9}});assert.ok(Number.isFinite(x.auc));assert.ok(Number.isFinite(x.muMax));assert.ok(x.muMax>0);
});

test('screen demo yields control-normalized ranking',()=>{
  const rows=makeDemo('screen').rows;const out=robustScreen(rows,{metric:'value',controlField:'role',controlValue:'control'});assert.equal(out.length,rows.length);assert.ok(out.some(r=>r.relative_fitness<.5));
});

test('matrix demo yields factorial cells',()=>{
  const rows=makeDemo('matrix').rows;const out=factorialLandscape(rows,'genotype','condition','value');assert.equal(out.length,16);
});

test('dose demo yields midpoint estimates',()=>{
  const rows=makeDemo('dose').rows;const out=halfResponseDose(rows,{doseField:'dose',valueField:'value',groupFields:['genotype']});assert.equal(out.length,2);assert.ok(out.every(r=>Number.isFinite(r.half_response_dose)));
});

test('competition demo yields selection proxies',()=>{
  const rows=makeDemo('competition').rows.map(r=>({...r,time:r.day}));const out=competitionSelection(rows,{idFields:['strain','biological_rep','technical_rep'],timeField:'time',valueField:'value'});assert.ok(out.length>=8);assert.ok(out.some(r=>r.selection_coefficient_proxy>0));assert.ok(out.some(r=>r.selection_coefficient_proxy<0));
});

test('matched control normalization is finite for supported endpoint demo',()=>{
  const rows=makeDemo('endpoint').rows;const out=controlNormalize(rows,'value',{controlField:'role',controlValue:'control',strata:['condition']});assert.ok(out.filter(r=>r.role==='sample').every(r=>Number.isFinite(r.relative_to_control)));
});
