import test from 'node:test';
import assert from 'node:assert/strict';
import { DEMOS, makeDemo } from '../js/demo-catalog.js';

test('every design has a runnable demo',()=>{
  assert.deepEqual(DEMO_SORT(DEMO_KEYS()),DEMO_SORT(['daily','endpoint','screen','matrix','evolution','dose','competition','kinetic','manual']));
  for(const id of DEMOS){
    const d=makeDemo(id);
    assert.equal(d.preset,id);
    assert.ok(d.rows.length>=12,`${id} should contain enough observations`);
    assert.ok(d.rows.every(r=>Number.isFinite(Number(r.value))),`${id} values must be numeric`);
    assert.ok(d.rows.some(r=>'biological_rep' in r),`${id} should demonstrate biological replicates`);
  }
});
function DEMO_KEYS(){return [...DEMOS]}
function DEMO_SORT(x){return [...x].sort()}

test('serial demos contain ordered time variables',()=>{
  for(const id of ['daily','evolution','competition','kinetic']){
    const d=makeDemo(id), key=id==='evolution'?'generation':id==='kinetic'?'time':'day';
    const t=[...new Set(d.rows.map(r=>Number(r[key])).filter(Number.isFinite))];
    assert.ok(t.length>=5,`${id} should have multiple timepoints`);
  }
});

test('specialized demos contain their defining factor',()=>{
  assert.ok(makeDemo('dose').rows.every(r=>'dose' in r));
  assert.ok(makeDemo('competition').rows.every(r=>'frequency' in r));
  assert.ok(new Set(makeDemo('matrix').rows.map(r=>r.condition)).size>=3);
  assert.ok(new Set(makeDemo('screen').rows.map(r=>r.genotype)).size>=10);
});
