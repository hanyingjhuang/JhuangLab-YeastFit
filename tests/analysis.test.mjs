import test from 'node:test';
import assert from 'node:assert/strict';
import { trapezoidAUC, maxSpecificGrowthRate, analyzeCurve, analyzeSerialSeries, normalizeToControls, compareGroupsToControl } from '../js/analysis.js';
import { detectShape, wideToLong, normalizeWell, optionalNumber } from '../js/data.js';

const pts = [
  { time: 0, value: 0.05 },
  { time: 1, value: 0.10 },
  { time: 2, value: 0.20 },
  { time: 3, value: 0.40 },
  { time: 4, value: 0.75 }
];

test('AUC uses trapezoids', () => {
  assert.ok(Math.abs(trapezoidAUC([{time:0,value:0},{time:2,value:2}]) - 2) < 1e-12);
});

test('mu max recovers approximate exponential slope', () => {
  const fit = maxSpecificGrowthRate(pts, { minOD: 0.03, maxOD: 0.8, windowPoints: 4, minR2: 0.9 });
  assert.ok(fit.mu > 0.6 && fit.mu < 0.75);
  assert.ok(fit.r2 > 0.99);
});

test('analysis returns core metrics', () => {
  const out = analyzeCurve(pts, { threshold: 0.3, growth: { windowPoints: 4, minR2: 0.9, maxOD: 0.8 } });
  assert.ok(Number.isFinite(out.auc));
  assert.ok(Number.isFinite(out.muMax));
  assert.ok(Number.isFinite(out.timeToThreshold));
});

test('serial analysis reports change and trend without requiring growth kinetics', () => {
  const daily = [
    { time: 0, value: 1.0 },
    { time: 1, value: 0.9 },
    { time: 2, value: 0.8 },
    { time: 3, value: 0.7 }
  ];
  const out = analyzeSerialSeries(daily);
  assert.ok(Math.abs(out.absoluteChange + 0.3) < 1e-12);
  assert.ok(Math.abs(out.foldChange - 0.7) < 1e-12);
  assert.ok(out.trendSlope < 0);
  assert.ok(out.trendR2 > 0.99);
});

test('wide plate layout is detected and reshaped', () => {
  const rows = [{ Time: 0, A01: 0.1, A02: 0.2, A03: 0.2, A04: 0.2 }];
  const shape = detectShape(rows);
  assert.equal(shape.type, 'wide_plate_timeseries');
  const long = wideToLong(rows, 'Time', shape.suggestions.wellColumns);
  assert.equal(long.length, 4);
  assert.equal(long[0].well, 'A1');
});

test('daily time headers are recognized', () => {
  const rows = [{ day: 0, A1: 1, A2: 1, A3: 1, A4: 1 }];
  const shape = detectShape(rows);
  assert.equal(shape.type, 'wide_plate_timeseries');
  assert.equal(shape.suggestions.time, 'day');
});

test('blank numeric fields use the requested fallback', () => {
  assert.equal(optionalNumber('', -Infinity), -Infinity);
  assert.equal(optionalNumber('   ', Infinity), Infinity);
  assert.equal(optionalNumber('24', NaN), 24);
});

test('well names normalize', () => assert.equal(normalizeWell(' b07 '), 'B7'));

test('control normalization works within strata', () => {
  const rows = [
    { condition:'YPD', role:'control', metric:2 },
    { condition:'YPD', role:'control', metric:4 },
    { condition:'YPD', role:'sample', metric:3 }
  ];
  const out = normalizeToControls(rows, 'metric', { strata:['condition'] });
  assert.equal(out[2].metric_relative, 1);
});

test('group comparison returns adjusted p value field', () => {
  const rows = [
    { genotype:'WT', role:'control', metric:1 }, { genotype:'WT', role:'control', metric:1.1 }, { genotype:'WT', role:'control', metric:0.9 },
    { genotype:'mut', role:'sample', metric:0.4 }, { genotype:'mut', role:'sample', metric:0.5 }, { genotype:'mut', role:'sample', metric:0.45 }
  ];
  const out = compareGroupsToControl(rows, 'metric', 'genotype');
  assert.ok(out.length >= 1);
  assert.ok('q' in out[0]);
});
