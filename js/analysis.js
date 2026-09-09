import { mean, median, sd, cv, sem, confidenceInterval, welchTTest, hedgesG, benjaminiHochberg } from './stats.js';

export function movingAverage(points, window = 1) {
  if (window <= 1) return points.map(p => ({ ...p }));
  const half = Math.floor(window / 2);
  return points.map((p, i) => {
    if (!Number.isFinite(p.value)) return { ...p };
    const vals = points.slice(Math.max(0, i - half), Math.min(points.length, i + half + 1)).map(x => x.value).filter(Number.isFinite);
    return { ...p, value: vals.length ? mean(vals) : NaN };
  });
}

export function trapezoidAUC(points) {
  const p = points.filter(x => Number.isFinite(x.time)).sort((a, b) => a.time - b.time);
  if (p.length < 2) return NaN;
  let area = 0, intervals = 0;
  for (let i = 1; i < p.length; i++) {
    if (!Number.isFinite(p[i - 1].value) || !Number.isFinite(p[i].value)) continue;
    area += (p[i].time - p[i - 1].time) * (p[i].value + p[i - 1].value) / 2;
    intervals++;
  }
  return intervals ? area : NaN;
}

export function aucCoverage(points) {
  const p = points.filter(x => Number.isFinite(x.time)).sort((a, b) => a.time - b.time);
  if (p.length < 2) return NaN;
  const span = p.at(-1).time - p[0].time;
  if (!(span > 0)) return NaN;
  let covered = 0;
  for (let i = 1; i < p.length; i++) if (Number.isFinite(p[i - 1].value) && Number.isFinite(p[i].value)) covered += p[i].time - p[i - 1].time;
  return Math.max(0, Math.min(1, covered / span));
}

function linearFit(xs, ys) {
  if (xs.length < 2 || ys.length !== xs.length) return { slope: NaN, intercept: NaN, r2: NaN };
  const xm = mean(xs), ym = mean(ys);
  const ssx = xs.reduce((s, x) => s + (x - xm) ** 2, 0);
  if (ssx === 0) return { slope: NaN, intercept: NaN, r2: NaN };
  const slope = xs.reduce((s, x, i) => s + (x - xm) * (ys[i] - ym), 0) / ssx;
  const intercept = ym - slope * xm;
  const sst = ys.reduce((s, y) => s + (y - ym) ** 2, 0);
  const sse = ys.reduce((s, y, i) => s + (y - (intercept + slope * xs[i])) ** 2, 0);
  const r2 = sst === 0 ? 1 : 1 - sse / sst;
  return { slope, intercept, r2 };
}

export function maxSpecificGrowthRate(points, options = {}) {
  const {
    minOD = 0.03,
    maxOD = 0.6,
    windowPoints = 5,
    minR2 = 0.95,
    minPositivePoints = 4
  } = options;
  const p = points
    .filter(x => Number.isFinite(x.time) && Number.isFinite(x.value) && x.value > 0)
    .sort((a, b) => a.time - b.time);
  if (p.length < Math.max(windowPoints, minPositivePoints)) return { mu: NaN, doublingTime: NaN, r2: NaN, start: NaN, end: NaN, n: 0 };
  let best = null;
  for (let i = 0; i <= p.length - windowPoints; i++) {
    const w = p.slice(i, i + windowPoints);
    if (w.some(x => x.value < minOD || x.value > maxOD)) continue;
    const fit = linearFit(w.map(x => x.time), w.map(x => Math.log(x.value)));
    if (!Number.isFinite(fit.slope) || fit.slope <= 0 || fit.r2 < minR2) continue;
    if (!best || fit.slope > best.mu) best = { mu: fit.slope, doublingTime: Math.log(2) / fit.slope, r2: fit.r2, start: w[0].time, end: w.at(-1).time, n: w.length, intercept: fit.intercept };
  }
  return best || { mu: NaN, doublingTime: NaN, r2: NaN, start: NaN, end: NaN, n: 0 };
}

export function estimateLag(points, growthFit) {
  if (!Number.isFinite(growthFit?.mu) || growthFit.mu <= 0) return NaN;
  const valid = points.filter(x => Number.isFinite(x.value) && x.value > 0).sort((a, b) => a.time - b.time);
  if (!valid.length) return NaN;
  const baseline = median(valid.slice(0, Math.min(3, valid.length)).map(x => x.value));
  if (!(baseline > 0)) return NaN;
  return (Math.log(baseline) - growthFit.intercept) / growthFit.mu;
}

export function timeToThreshold(points, threshold) {
  const p = points.filter(x => Number.isFinite(x.time)).sort((a, b) => a.time - b.time);
  for (let i = 1; i < p.length; i++) {
    if (!Number.isFinite(p[i - 1].value) || !Number.isFinite(p[i].value)) continue;
    if (p[i - 1].value < threshold && p[i].value >= threshold) {
      const frac = (threshold - p[i - 1].value) / (p[i].value - p[i - 1].value);
      return p[i - 1].time + frac * (p[i].time - p[i - 1].time);
    }
  }
  return NaN;
}

export function applyAdjustments(points, options = {}) {
  const {
    blank = 0,
    baselineSubtract = false,
    clampNegative = true,
    smoothWindow = 1,
    startTime = -Infinity,
    endTime = Infinity
  } = options;
  let out = points
    .filter(p => p.time >= startTime && p.time <= endTime)
    .map(p => ({ ...p, value: Number.isFinite(p.value) ? p.value - (Number.isFinite(blank) ? blank : 0) : NaN }));
  if (baselineSubtract && out.length) {
    const firstObserved = out.find(x => Number.isFinite(x.value));
    const baseline = firstObserved?.value;
    if (Number.isFinite(baseline)) out = out.map(p => ({ ...p, value: Number.isFinite(p.value) ? p.value - baseline : NaN }));
  }
  if (clampNegative) out = out.map(p => ({ ...p, value: Number.isFinite(p.value) ? Math.max(0, p.value) : NaN }));
  return movingAverage(out, smoothWindow);
}

export function qcCurve(points, options = {}) {
  const {
    saturationOD = 1.5,
    highStartOD = 0.25,
    minDynamicRange = 0.08,
    maxMissingFraction = 0.15,
    maxDropFraction = 0.35
  } = options;
  const values = points.map(x => x.value);
  const finite = values.filter(Number.isFinite);
  const flags = [];
  if (!finite.length) return ['no_numeric_data'];
  const missingFraction = 1 - finite.length / Math.max(1, values.length);
  if (missingFraction > 0) flags.push('missing_values_present');
  if (missingFraction > maxMissingFraction) flags.push('many_missing_values');
  if (finite[0] > highStartOD) flags.push('high_starting_signal');
  if (Math.max(...finite) >= saturationOD) flags.push('possible_saturation');
  if (Math.max(...finite) - Math.min(...finite) < minDynamicRange) flags.push('low_dynamic_range');
  let drops = 0, comparisons = 0;
  const ordered = points.filter(x=>Number.isFinite(x.time)).sort((a,b)=>a.time-b.time);
  for (let i = 1; i < ordered.length; i++) {
    if (!Number.isFinite(ordered[i - 1].value) || !Number.isFinite(ordered[i].value)) continue;
    comparisons++;
    if (ordered[i].value < ordered[i - 1].value) drops++;
  }
  if (comparisons && drops / comparisons > maxDropFraction) flags.push('frequent_signal_decreases');
  return flags;
}

function qualityMeta(adjusted) {
  const total = adjusted.length, observed = adjusted.filter(x=>Number.isFinite(x.value)).length, coverage = aucCoverage(adjusted);
  return { totalPoints: total, observedPoints: observed, missingFraction: total ? 1 - observed / total : NaN, aucCoverage: coverage };
}

export function analyzeCurve(points, options = {}) {
  const adjusted = applyAdjustments(points, options.adjustments || {});
  const fit = maxSpecificGrowthRate(adjusted, options.growth || {});
  const finite = adjusted.map(x => x.value).filter(Number.isFinite);
  const quality=qualityMeta(adjusted),qc=qcCurve(adjusted, options.qc || {});
  if (Number.isFinite(quality.aucCoverage) && quality.aucCoverage < 1 && !qc.includes('incomplete_auc_coverage')) qc.push('incomplete_auc_coverage');
  return {
    adjusted,
    auc: trapezoidAUC(adjusted),
    maxValue: finite.length ? Math.max(...finite) : NaN,
    endpoint: finite.length ? finite.at(-1) : NaN,
    muMax: fit.mu,
    doublingTime: fit.doublingTime,
    growthR2: fit.r2,
    growthStart: fit.start,
    growthEnd: fit.end,
    lag: estimateLag(adjusted, fit),
    timeToThreshold: Number.isFinite(options.threshold) ? timeToThreshold(adjusted, options.threshold) : NaN,
    ...quality,
    qc
  };
}

export function analyzeSerialSeries(points, options = {}) {
  const adjusted = applyAdjustments(points, options.adjustments || {});
  const p = adjusted.filter(x => Number.isFinite(x.time) && Number.isFinite(x.value)).sort((a, b) => a.time - b.time);
  const first = p.length ? p[0].value : NaN;
  const endpoint = p.length ? p.at(-1).value : NaN;
  const fit = p.length >= 2 ? linearFit(p.map(x => x.time), p.map(x => x.value)) : { slope: NaN, r2: NaN };
  const quality=qualityMeta(adjusted),qc=qcCurve(adjusted, options.qc || {});
  if (Number.isFinite(quality.aucCoverage) && quality.aucCoverage < 1 && !qc.includes('incomplete_auc_coverage')) qc.push('incomplete_auc_coverage');
  const scheduledTimes=adjusted.map(x=>x.time).filter(Number.isFinite);const lastScheduled=scheduledTimes.length?Math.max(...scheduledTimes):NaN,lastObserved=p.length?p.at(-1).time:NaN;
  if(Number.isFinite(lastScheduled)&&Number.isFinite(lastObserved)&&lastObserved<lastScheduled)qc.push('endpoint_missing_at_last_time');
  return {
    adjusted,
    auc: trapezoidAUC(adjusted),
    maxValue: p.length ? Math.max(...p.map(x => x.value)) : NaN,
    endpoint,
    firstValue: first,
    absoluteChange: Number.isFinite(first) && Number.isFinite(endpoint) ? endpoint - first : NaN,
    foldChange: Number.isFinite(first) && first !== 0 && Number.isFinite(endpoint) ? endpoint / first : NaN,
    log2FoldChange: first > 0 && endpoint > 0 ? Math.log2(endpoint / first) : NaN,
    trendSlope: fit.slope,
    trendR2: fit.r2,
    timeToThreshold: Number.isFinite(options.threshold) ? timeToThreshold(adjusted, options.threshold) : NaN,
    endpointTime:lastObserved,
    ...quality,
    qc
  };
}

function keyFrom(row, fields) {
  return fields.map(f => `${f}=${row[f] ?? ''}`).join('|');
}

export function summarizeMetrics(rows, groupFields, metricFields) {
  const groups = new Map();
  for (const row of rows) {
    const key = keyFrom(row, groupFields);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  const out = [];
  for (const rowsInGroup of groups.values()) {
    const base = Object.fromEntries(groupFields.map(f => [f, rowsInGroup[0][f] ?? '']));
    base.n = rowsInGroup.length;
    for (const metric of metricFields) {
      const vals = rowsInGroup.map(r => Number(r[metric])).filter(Number.isFinite);
      base[`${metric}_mean`] = mean(vals);
      base[`${metric}_median`] = median(vals);
      base[`${metric}_sd`] = sd(vals);
      base[`${metric}_sem`] = sem(vals);
      base[`${metric}_cv`] = cv(vals);
    }
    out.push(base);
  }
  return out;
}

export function normalizeToControls(rows, metric, options = {}) {
  const { controlField = 'role', controlValue = 'control', strata = [] } = options;
  const strataMap = new Map();
  for (const r of rows) {
    const key = keyFrom(r, strata);
    if (!strataMap.has(key)) strataMap.set(key, []);
    strataMap.get(key).push(r);
  }
  return rows.map(r => {
    const group = strataMap.get(keyFrom(r, strata)) || rows;
    const controls = group.filter(x => String(x[controlField] ?? '').toLowerCase() === String(controlValue).toLowerCase()).map(x => Number(x[metric])).filter(Number.isFinite);
    const ref = median(controls);
    const value = Number(r[metric]);
    return { ...r, [`${metric}_control`]: ref, [`${metric}_relative`]: Number.isFinite(value) && Number.isFinite(ref) && ref !== 0 ? value / ref : NaN };
  });
}

export function compareGroupsToControl(rows, metric, groupField, options = {}) {
  const { controlField = 'role', controlValue = 'control', strata = [] } = options;
  const buckets = new Map();
  for (const r of rows) {
    const sk = keyFrom(r, strata);
    if (!buckets.has(sk)) buckets.set(sk, []);
    buckets.get(sk).push(r);
  }
  const results = [];
  for (const [stratum, groupRows] of buckets) {
    const ctrl = groupRows.filter(r => String(r[controlField] ?? '').toLowerCase() === String(controlValue).toLowerCase()).map(r => Number(r[metric])).filter(Number.isFinite);
    const labels = [...new Set(groupRows.map(r => r[groupField]).filter(v => v !== undefined && v !== null && v !== ''))];
    for (const label of labels) {
      const vals = groupRows.filter(r => r[groupField] === label).map(r => Number(r[metric])).filter(Number.isFinite);
      if (!vals.length || !ctrl.length) continue;
      const test = welchTTest(vals, ctrl);
      results.push({ stratum, group: label, n: vals.length, control_n: ctrl.length, mean: mean(vals), control_mean: mean(ctrl), difference: mean(vals) - mean(ctrl), ratio: mean(ctrl) !== 0 ? mean(vals) / mean(ctrl) : NaN, hedges_g: hedgesG(vals, ctrl), t: test.t, df: test.df, p: test.p });
    }
  }
  const q = benjaminiHochberg(results.map(r => r.p));
  return results.map((r, i) => ({ ...r, q: q[i] }));
}

export { confidenceInterval };
