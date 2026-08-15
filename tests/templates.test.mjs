import test from 'node:test';
import assert from 'node:assert/strict';
import { TEMPLATES, templateCsv } from '../js/templates.js';

const designs=['daily','endpoint','screen','matrix','evolution','dose','competition','kinetic','manual','platemap'];
test('all documented templates exist and serialize',()=>{
  assert.deepEqual(Object.keys(TEMPLATES),designs);
  for(const id of designs){
    const t=TEMPLATES[id];
    assert.ok(t.name&&t.notes);
    assert.ok(t.rows.length>=2,`${id} needs example rows`);
    const csv=templateCsv(id);
    assert.ok(csv.includes('\n'));
    assert.ok(csv.split('\n')[0].length>3);
  }
});

test('core measurement templates expose replicate metadata',()=>{
  for(const id of designs.filter(x=>x!=='platemap')){
    const h=Object.keys(TEMPLATES[id].rows[0]);
    assert.ok(h.includes('value'),`${id}: value column`);
    assert.ok(h.includes('biological_rep'),`${id}: biological_rep`);
    assert.ok(h.includes('technical_rep'),`${id}: technical_rep`);
  }
});

test('specialized templates contain design-defining fields',()=>{
  assert.ok('day' in TEMPLATES.daily.rows[0]);
  assert.ok('generation' in TEMPLATES.evolution.rows[0]);
  assert.ok('dose' in TEMPLATES.dose.rows[0]);
  assert.ok('frequency' in TEMPLATES.competition.rows[0]);
  assert.ok('time' in TEMPLATES.kinetic.rows[0]);
  assert.ok('well' in TEMPLATES.platemap.rows[0]);
});
