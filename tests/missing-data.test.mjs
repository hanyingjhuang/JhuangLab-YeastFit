import test from 'node:test';
import assert from 'node:assert/strict';
import { optionalNumber, longToCanonical, wideToLong } from '../js/data.js';
import { movingAverage, trapezoidAUC, timeToThreshold, analyzeSerialSeries } from '../js/analysis.js';

test('blank and common missing tokens remain missing, not zero',()=>{
  for(const v of ['', ' ', 'NA', 'N/A', 'null', 'missing', '.', '-', 'ND']) assert.ok(Number.isNaN(optionalNumber(v)));
  assert.equal(optionalNumber('0'),0);
});

test('long-format blank measurements remain NaN',()=>{
  const out=longToCanonical([{day:'0',value:'',sample:'A'}],{time:'day',value:'value',sample:'sample',metadata:{}});
  assert.equal(out.length,1);
  assert.ok(Number.isNaN(out[0].value));
});

test('wide-format blank wells are retained as missing observations',()=>{
  const out=wideToLong([{day:'0',A1:'',A2:'0.2'}],'day',['A1','A2']);
  assert.equal(out.length,2);
  assert.ok(Number.isNaN(out[0].value));
  assert.equal(out[1].value,0.2);
});

test('smoothing never imputes an explicitly missing point',()=>{
  const out=movingAverage([{time:0,value:1},{time:1,value:NaN},{time:2,value:3}],3);
  assert.ok(Number.isNaN(out[1].value));
});

test('AUC does not bridge an explicit missing gap',()=>{
  const out=trapezoidAUC([{time:0,value:0},{time:1,value:1},{time:2,value:NaN},{time:3,value:3},{time:4,value:4}]);
  assert.equal(out,0.5+3.5);
});

test('threshold interpolation does not cross a missing gap',()=>{
  const t=timeToThreshold([{time:0,value:0.1},{time:1,value:NaN},{time:2,value:0.5}],0.3);
  assert.ok(Number.isNaN(t));
});

test('serial analysis reports missingness and incomplete AUC coverage',()=>{
  const out=analyzeSerialSeries([{time:0,value:1},{time:1,value:NaN},{time:2,value:0.8},{time:3,value:0.7}],{qc:{maxMissingFraction:0.2}});
  assert.ok(out.qc.includes('missing_values_present'));
  assert.ok(out.qc.includes('many_missing_values'));
  assert.ok(out.qc.includes('incomplete_auc_coverage'));
  assert.equal(out.observedPoints,3);
  assert.equal(out.totalPoints,4);
});

test('serial analysis flags a missing scheduled endpoint',()=>{
  const out=analyzeSerialSeries([{time:0,value:1},{time:1,value:0.9},{time:2,value:NaN}]);
  assert.ok(out.qc.includes('endpoint_missing_at_last_time'));
  assert.equal(out.endpoint,0.9);
  assert.equal(out.endpointTime,1);
});
