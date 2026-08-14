export function mean(xs) {
  const v = xs.filter(Number.isFinite);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : NaN;
}

export function median(xs) {
  const v = xs.filter(Number.isFinite).sort((a, b) => a - b);
  if (!v.length) return NaN;
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}

export function variance(xs, sample = true) {
  const v = xs.filter(Number.isFinite);
  if (v.length < (sample ? 2 : 1)) return NaN;
  const m = mean(v);
  const denom = sample ? v.length - 1 : v.length;
  return v.reduce((s, x) => s + (x - m) ** 2, 0) / denom;
}

export function sd(xs, sample = true) {
  const v = variance(xs, sample);
  return Number.isFinite(v) ? Math.sqrt(v) : NaN;
}

export function sem(xs) {
  const v = xs.filter(Number.isFinite);
  return v.length > 1 ? sd(v) / Math.sqrt(v.length) : NaN;
}

export function cv(xs) {
  const m = mean(xs);
  return Number.isFinite(m) && m !== 0 ? sd(xs) / Math.abs(m) : NaN;
}

export function quantile(xs, q) {
  const v = xs.filter(Number.isFinite).sort((a, b) => a - b);
  if (!v.length) return NaN;
  const pos = (v.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  return v[base + 1] !== undefined ? v[base] + rest * (v[base + 1] - v[base]) : v[base];
}

export function confidenceInterval(xs, level = 0.95) {
  const v = xs.filter(Number.isFinite);
  if (!v.length) return [NaN, NaN];
  const alpha = (1 - level) / 2;
  return [quantile(v, alpha), quantile(v, 1 - alpha)];
}

export function cohensD(a, b) {
  const av = a.filter(Number.isFinite);
  const bv = b.filter(Number.isFinite);
  if (av.length < 2 || bv.length < 2) return NaN;
  const pooled = Math.sqrt(((av.length - 1) * variance(av) + (bv.length - 1) * variance(bv)) / (av.length + bv.length - 2));
  return pooled > 0 ? (mean(av) - mean(bv)) / pooled : NaN;
}

export function hedgesG(a, b) {
  const d = cohensD(a, b);
  if (!Number.isFinite(d)) return NaN;
  const df = a.filter(Number.isFinite).length + b.filter(Number.isFinite).length - 2;
  const j = df > 1 ? 1 - 3 / (4 * df - 1) : 1;
  return d * j;
}

// Numerical Recipes style log-gamma approximation.
function logGamma(z) {
  const c = [
    676.5203681218851, -1259.1392167224028, 771.32342877765313,
    -176.61502916214059, 12.507343278686905, -0.13857109526572012,
    9.9843695780195716e-6, 1.5056327351493116e-7
  ];
  if (z < 0.5) return Math.log(Math.PI) - Math.log(Math.sin(Math.PI * z)) - logGamma(1 - z);
  z -= 1;
  let x = 0.99999999999980993;
  for (let i = 0; i < c.length; i++) x += c[i] / (z + i + 1);
  const t = z + c.length - 0.5;
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
}

function betacf(a, b, x) {
  const MAXIT = 200;
  const EPS = 3e-12;
  const FPMIN = 1e-30;
  let qab = a + b;
  let qap = a + 1;
  let qam = a - 1;
  let c = 1;
  let d = 1 - qab * x / qap;
  if (Math.abs(d) < FPMIN) d = FPMIN;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= MAXIT; m++) {
    const m2 = 2 * m;
    let aa = m * (b - m) * x / ((qam + m2) * (a + m2));
    d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d; h *= d * c;
    aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
    d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < EPS) break;
  }
  return h;
}

function regularizedBeta(x, a, b) {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const bt = Math.exp(logGamma(a + b) - logGamma(a) - logGamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  if (x < (a + 1) / (a + b + 2)) return bt * betacf(a, b, x) / a;
  return 1 - bt * betacf(b, a, 1 - x) / b;
}

export function studentTCdf(t, df) {
  if (!Number.isFinite(t) || !Number.isFinite(df) || df <= 0) return NaN;
  const x = df / (df + t * t);
  const ib = regularizedBeta(x, df / 2, 0.5);
  return t >= 0 ? 1 - 0.5 * ib : 0.5 * ib;
}

export function welchTTest(a, b) {
  const av = a.filter(Number.isFinite);
  const bv = b.filter(Number.isFinite);
  if (av.length < 2 || bv.length < 2) return { t: NaN, df: NaN, p: NaN };
  const ma = mean(av), mb = mean(bv);
  const va = variance(av), vb = variance(bv);
  const se2 = va / av.length + vb / bv.length;
  if (se2 === 0) return { t: 0, df: av.length + bv.length - 2, p: 1 };
  const t = (ma - mb) / Math.sqrt(se2);
  const df = se2 ** 2 / ((va / av.length) ** 2 / (av.length - 1) + (vb / bv.length) ** 2 / (bv.length - 1));
  const p = 2 * (1 - studentTCdf(Math.abs(t), df));
  return { t, df, p };
}

export function benjaminiHochberg(pValues) {
  const pairs = pValues.map((p, i) => ({ p, i })).filter(x => Number.isFinite(x.p)).sort((a, b) => a.p - b.p);
  const out = Array(pValues.length).fill(NaN);
  let prev = 1;
  for (let k = pairs.length - 1; k >= 0; k--) {
    const rank = k + 1;
    const q = Math.min(prev, pairs[k].p * pairs.length / rank, 1);
    out[pairs[k].i] = q;
    prev = q;
  }
  return out;
}

export function bootstrapStatistic(values, statistic = mean, iterations = 1000, rng = Math.random) {
  const v = values.filter(Number.isFinite);
  if (!v.length) return [];
  const out = [];
  for (let i = 0; i < iterations; i++) {
    const sample = Array.from({ length: v.length }, () => v[Math.floor(rng() * v.length)]);
    out.push(statistic(sample));
  }
  return out;
}
