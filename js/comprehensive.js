import { mean, median, sd, studentTCdf, benjaminiHochberg } from './stats.js';

const finite = a => a.map(Number).filter(Number.isFinite);
const keyOf = (r, fields) => fields.map(f => `${f}=${r[f] ?? ''}`).join('|');

export function groupRows(rows, fields = []) {
  const m = new Map();
  for (const r of rows) {
    const k = keyOf(r, fields);
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(r);
  }
  return m;
}

export function summarizeBy(rows, fields = [], valueField = 'value') {
  const out = [];
  for (const group of groupRows(rows, fields).values()) {
    const v = finite(group.map(r => r[valueField]));
    if (!v.length) continue;
    const base = Object.fromEntries(fields.map(f => [f, group[0][f] ?? '']));
    const s = sd(v);
    const se = v.length > 1 && Number.isFinite(s) ? s / Math.sqrt(v.length) : NaN;
    out.push({
      ...base,
      n: v.length,
      mean: mean(v),
      median: median(v),
      sd: s,
      sem: se,
      ci95_low: Number.isFinite(se) ? mean(v) - 1.96 * se : NaN,
      ci95_high: Number.isFinite(se) ? mean(v) + 1.96 * se : NaN,
      cv: mean(v) !== 0 && Number.isFinite(s) ? s / Math.abs(mean(v)) : NaN,
      min: Math.min(...v),
      max: Math.max(...v)
    });
  }
  return out;
}

export function controlNormalize(rows, valueField = 'value', options = {}) {
  const { controlField = 'role', controlValue = 'control', strata = [] } = options;
  const buckets = groupRows(rows, strata);
  const out = [];
  for (const r of rows) {
    const bucket = buckets.get(keyOf(r, strata)) || rows;
    const ctrl = finite(bucket.filter(x => String(x[controlField] ?? '').toLowerCase() === String(controlValue).toLowerCase()).map(x => x[valueField]));
    const ref = median(ctrl);
    const v = Number(r[valueField]);
    const ratio = Number.isFinite(v) && Number.isFinite(ref) && ref !== 0 ? v / ref : NaN;
    out.push({
      ...r,
      control_reference: ref,
      relative_to_control: ratio,
      difference_from_control: Number.isFinite(v) && Number.isFinite(ref) ? v - ref : NaN,
      percent_of_control: Number.isFinite(ratio) ? ratio * 100 : NaN,
      log2_ratio: Number.isFinite(ratio) && ratio > 0 ? Math.log2(ratio) : NaN
    });
  }
  return out;
}

function oneSampleStats(values, nullValue = 0) {
  const v = finite(values);
  if (v.length < 2) return { n: v.length, mean: mean(v), sd: sd(v), t: NaN, df: NaN, p: NaN, hedges_g: NaN };
  const m = mean(v), s = sd(v), df = v.length - 1;
  if (!(s > 0)) {
    if (m === nullValue) return { n: v.length, mean: m, sd: s, t: 0, df, p: 1, hedges_g: 0 };
    return { n: v.length, mean: m, sd: s, t: m > nullValue ? Infinity : -Infinity, df, p: 0, hedges_g: m > nullValue ? Infinity : -Infinity };
  }
  const t = (m - nullValue) / (s / Math.sqrt(v.length));
  const p = 2 * (1 - studentTCdf(Math.abs(t), df));
  const d = (m - nullValue) / s;
  const j = df > 1 ? 1 - 3 / (4 * df - 1) : 1;
  return { n: v.length, mean: m, sd: s, t, df, p, hedges_g: d * j };
}

export function matchedControlComparisons(normalizedRows, options = {}) {
  const {
    groupField,
    controlField = 'role',
    controlValue = 'control',
    strata = []
  } = options;
  if (!normalizedRows?.length || !groupField || !controlField) return [];
  const results = [];
  for (const [stratum, bucket] of groupRows(normalizedRows, strata)) {
    const labels = [...new Set(bucket.map(r => r[groupField]).filter(v => v !== '' && v != null))]
      .filter(label => !bucket.some(r => r[groupField] === label && String(r[controlField] ?? '').toLowerCase() === String(controlValue).toLowerCase()));
    for (const label of labels) {
      const rows = bucket.filter(r => r[groupField] === label && String(r[controlField] ?? '').toLowerCase() !== String(controlValue).toLowerCase());
      const logValues = finite(rows.map(r => r.log2_ratio));
      const ratioValues = finite(rows.map(r => r.relative_to_control));
      const useLog = logValues.length >= 2;
      const values = useLog ? logValues : ratioValues;
      const nullValue = useLog ? 0 : 1;
      if (values.length < 2) continue;
      const test = oneSampleStats(values, nullValue);
      const ratioCenter = useLog ? 2 ** test.mean : test.mean;
      results.push({
        stratum,
        group: label,
        n: test.n,
        control_n: null,
        test_scale: useLog ? 'log2_ratio' : 'relative_to_control',
        mean: test.mean,
        control_mean: nullValue,
        difference: test.mean - nullValue,
        ratio: ratioCenter,
        hedges_g: test.hedges_g,
        t: test.t,
        df: test.df,
        p: test.p
      });
    }
  }
  const q = benjaminiHochberg(results.map(r => r.p));
  return results.map((r, i) => ({ ...r, q: q[i] }));
}

export function replicateDiagnostics(rows, options = {}) {
  const {
    valueField = 'value',
    technicalField = '',
    biologicalField = '',
    timeField = 'time',
    groupingFields = [],
    cvWarn = 0.15
  } = options;
  if (!technicalField) return [];
  const fields = [...new Set([...groupingFields, biologicalField, timeField].filter(Boolean))];
  return summarizeBy(rows, fields, valueField).map(r => ({
    ...r,
    replicate_cv_flag: Number.isFinite(r.cv) && r.cv > cvWarn ? 'high_technical_cv' : '',
    cv_threshold: cvWarn
  }));
}

function mad(values) {
  const v = finite(values);
  if (!v.length) return NaN;
  const m = median(v);
  return median(v.map(x => Math.abs(x - m)));
}

export function robustScreen(rows, options = {}) {
  const {
    metric = 'endpoint',
    controlField = 'role',
    controlValue = 'control',
    strata = [],
    lowerIsDefect = true
  } = options;
  const buckets = groupRows(rows, strata);
  const scored = rows.map(r => {
    const bucket = buckets.get(keyOf(r, strata)) || rows;
    const controls = finite(bucket.filter(x => String(x[controlField] ?? '').toLowerCase() === String(controlValue).toLowerCase()).map(x => x[metric]));
    const all = finite(bucket.map(x => x[metric]));
    const ref = median(controls.length ? controls : all);
    let scale = mad(controls.length >= 3 ? controls : all) * 1.4826;
    if (!(scale > 0)) scale = sd(controls.length >= 2 ? controls : all);
    const v = Number(r[metric]);
    const z = Number.isFinite(v) && Number.isFinite(ref) && Number.isFinite(scale) && scale > 0 ? (v - ref) / scale : NaN;
    const ratio = Number.isFinite(v) && Number.isFinite(ref) && ref !== 0 ? v / ref : NaN;
    return { ...r, screen_metric: metric, control_reference: ref, relative_fitness: ratio, robust_z: z };
  });
  scored.sort((a, b) => {
    const av = Number(a.relative_fitness), bv = Number(b.relative_fitness);
    if (!Number.isFinite(av)) return 1;
    if (!Number.isFinite(bv)) return -1;
    return lowerIsDefect ? av - bv : bv - av;
  });
  return scored.map((r, i) => ({ ...r, rank: i + 1, hit_flag: Number.isFinite(r.robust_z) && Math.abs(r.robust_z) >= 2 ? 'candidate' : '' }));
}

export function linearTrend(points, timeField = 'time', valueField = 'value') {
  const p = points.map(r => ({ x: Number(r[timeField]), y: Number(r[valueField]) })).filter(r => Number.isFinite(r.x) && Number.isFinite(r.y));
  if (p.length < 2) return { slope: NaN, intercept: NaN, r2: NaN, n: p.length };
  const xm = mean(p.map(r => r.x)), ym = mean(p.map(r => r.y));
  const ssx = p.reduce((s, r) => s + (r.x - xm) ** 2, 0);
  if (!(ssx > 0)) return { slope: NaN, intercept: NaN, r2: NaN, n: p.length };
  const slope = p.reduce((s, r) => s + (r.x - xm) * (r.y - ym), 0) / ssx;
  const intercept = ym - slope * xm;
  const sst = p.reduce((s, r) => s + (r.y - ym) ** 2, 0);
  const sse = p.reduce((s, r) => s + (r.y - (intercept + slope * r.x)) ** 2, 0);
  return { slope, intercept, r2: sst === 0 ? 1 : 1 - sse / sst, n: p.length };
}

export function competitionSelection(rows, options = {}) {
  const { idFields = ['curve_id'], timeField = 'time', valueField = 'value' } = options;
  const out = [];
  for (const group of groupRows(rows, idFields).values()) {
    const transformed = group.map(r => {
      const f = Number(r[valueField]);
      return { ...r, __logit: f > 0 && f < 1 ? Math.log(f / (1 - f)) : NaN };
    });
    const fit = linearTrend(transformed, timeField, '__logit');
    const base = Object.fromEntries(idFields.map(f => [f, group[0][f] ?? '']));
    out.push({ ...base, selection_coefficient_proxy: fit.slope, logit_trend_r2: fit.r2, n_timepoints: fit.n });
  }
  return out;
}

export function halfResponseDose(rows, options = {}) {
  const { doseField, valueField = 'value', groupFields = [] } = options;
  if (!doseField) return [];
  const out = [];
  for (const group of groupRows(rows, groupFields).values()) {
    const byDose = summarizeBy(group, [doseField], valueField)
      .map(r => ({ dose: Number(r[doseField]), response: r.median }))
      .filter(r => Number.isFinite(r.dose) && Number.isFinite(r.response))
      .sort((a, b) => a.dose - b.dose);
    if (byDose.length < 3) continue;
    const baseResponse = byDose[0].response;
    const extreme = byDose.at(-1).response;
    const target = (baseResponse + extreme) / 2;
    let estimate = NaN;
    for (let i = 1; i < byDose.length; i++) {
      const a = byDose[i - 1], b = byDose[i];
      if ((a.response - target) * (b.response - target) <= 0 && a.response !== b.response) {
        const frac = (target - a.response) / (b.response - a.response);
        if (a.dose > 0 && b.dose > 0) estimate = 10 ** (Math.log10(a.dose) + frac * (Math.log10(b.dose) - Math.log10(a.dose)));
        else estimate = a.dose + frac * (b.dose - a.dose);
        break;
      }
    }
    const base = Object.fromEntries(groupFields.map(f => [f, group[0][f] ?? '']));
    out.push({ ...base, baseline_response: baseResponse, extreme_response: extreme, half_response_target: target, half_response_dose: estimate, n_doses: byDose.length, direction: extreme < baseResponse ? 'decreasing' : 'increasing' });
  }
  return out;
}

export function factorialLandscape(rows, factorA, factorB, valueField = 'value') {
  if (!factorA || !factorB) return [];
  return summarizeBy(rows, [factorA, factorB], valueField);
}

export function twoByTwoInteraction(rows, factorA, factorB, valueField = 'value') {
  const aLevels = [...new Set(rows.map(r => r[factorA]).filter(v => v !== '' && v != null))];
  const bLevels = [...new Set(rows.map(r => r[factorB]).filter(v => v !== '' && v != null))];
  if (aLevels.length !== 2 || bLevels.length !== 2) return null;
  const get = (a, b) => mean(finite(rows.filter(r => r[factorA] === a && r[factorB] === b).map(r => r[valueField])));
  const m00 = get(aLevels[0], bLevels[0]), m10 = get(aLevels[1], bLevels[0]), m01 = get(aLevels[0], bLevels[1]), m11 = get(aLevels[1], bLevels[1]);
  if (![m00, m10, m01, m11].every(Number.isFinite)) return null;
  return {
    factor_a: factorA,
    factor_b: factorB,
    a0: aLevels[0], a1: aLevels[1], b0: bLevels[0], b1: bLevels[1],
    mean_a0_b0: m00, mean_a1_b0: m10, mean_a0_b1: m01, mean_a1_b1: m11,
    interaction_difference_in_differences: (m11 - m01) - (m10 - m00)
  };
}
