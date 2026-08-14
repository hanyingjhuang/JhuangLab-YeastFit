const WELL_RE = /^[A-Pa-p]\s*0?([1-9]|1[0-9]|2[0-4])$/;

export function normalizeHeader(v) {
  return String(v ?? '').trim().replace(/^\ufeff/, '');
}

export function normalizeWell(v) {
  const s = String(v ?? '').trim().toUpperCase().replace(/\s+/g, '');
  const m = s.match(/^([A-P])0?([1-9]|1[0-9]|2[0-4])$/);
  return m ? `${m[1]}${Number(m[2])}` : s;
}

export function inferDelimiter(text) {
  const first = text.split(/\r?\n/).filter(Boolean).slice(0, 5);
  const candidates = [',', '\t', ';', '|'];
  let best = ',';
  let score = -Infinity;
  for (const d of candidates) {
    const counts = first.map(line => line.split(d).length);
    const s = (counts.reduce((a, b) => a + b, 0) / Math.max(1, counts.length)) - (Math.max(...counts) - Math.min(...counts));
    if (s > score) { score = s; best = d; }
  }
  return best;
}

export function rowsFromMatrix(matrix) {
  if (!matrix?.length) return [];
  const headers = matrix[0].map(normalizeHeader);
  return matrix.slice(1).filter(r => r.some(v => String(v ?? '').trim() !== '')).map(r => Object.fromEntries(headers.map((h, i) => [h || `column_${i + 1}`, r[i] ?? ''])));
}

export function detectShape(rows) {
  if (!rows.length) return { type: 'empty', confidence: 1, suggestions: {} };
  const headers = Object.keys(rows[0]);
  const lower = Object.fromEntries(headers.map(h => [h.toLowerCase(), h]));
  const timeAliases = ['time', 'time_h', 'time_hr', 'hours', 'hour', 'minutes', 'min', 'elapsed', 'elapsed_time'];
  const valueAliases = ['od', 'od600', 'absorbance', 'value', 'signal', 'fitness', 'growth', 'measurement'];
  const wellAliases = ['well', 'well_id', 'position'];
  const time = timeAliases.find(x => lower[x]);
  const value = valueAliases.find(x => lower[x]);
  const well = wellAliases.find(x => lower[x]);
  if (time && value) return { type: 'long_timeseries', confidence: 0.95, suggestions: { time: lower[time], value: lower[value], well: well ? lower[well] : null } };
  const wellCols = headers.filter(h => WELL_RE.test(h));
  if (wellCols.length >= 4) {
    const probableTime = headers.find(h => /time|hour|min|elapsed/i.test(h)) || headers[0];
    return { type: 'wide_plate_timeseries', confidence: 0.9, suggestions: { time: probableTime, wellColumns: wellCols } };
  }
  if (well && value) return { type: 'endpoint', confidence: 0.85, suggestions: { well: lower[well], value: lower[value] } };
  const numericFractions = headers.map(h => ({ h, f: rows.slice(0, 30).filter(r => Number.isFinite(Number(r[h]))).length / Math.min(30, rows.length) })).sort((a, b) => b.f - a.f);
  if (numericFractions[0]?.f > 0.7) return { type: 'generic_numeric', confidence: 0.6, suggestions: { value: numericFractions[0].h } };
  return { type: 'unknown', confidence: 0.25, suggestions: {} };
}

export function wideToLong(rows, timeField, valueColumns) {
  const out = [];
  rows.forEach((r, rowIndex) => {
    const time = Number(r[timeField]);
    for (const col of valueColumns) {
      const value = Number(r[col]);
      if (Number.isFinite(time) || Number.isFinite(value)) out.push({ source_row: rowIndex + 2, time, well: normalizeWell(col), value });
    }
  });
  return out;
}

export function longToCanonical(rows, mapping) {
  return rows.map((r, i) => {
    const canonical = {
      source_row: i + 2,
      time: mapping.time ? Number(r[mapping.time]) : NaN,
      value: mapping.value ? Number(r[mapping.value]) : NaN,
      well: mapping.well ? normalizeWell(r[mapping.well]) : '',
      sample: mapping.sample ? String(r[mapping.sample] ?? '').trim() : '',
      plate: mapping.plate ? String(r[mapping.plate] ?? '').trim() : ''
    };
    for (const [target, source] of Object.entries(mapping.metadata || {})) canonical[target] = r[source];
    return canonical;
  });
}

export function mergeMetadata(dataRows, metadataRows, keys = ['well']) {
  if (!metadataRows?.length) return dataRows;
  const index = new Map(metadataRows.map(r => [keys.map(k => String(k === 'well' ? normalizeWell(r[k]) : r[k] ?? '')).join('|'), r]));
  return dataRows.map(r => {
    const key = keys.map(k => String(k === 'well' ? normalizeWell(r[k]) : r[k] ?? '')).join('|');
    return { ...r, ...(index.get(key) || {}) };
  });
}

export function inferMetadataFields(rows) {
  if (!rows.length) return [];
  const reserved = new Set(['source_row', 'time', 'value']);
  return Object.keys(rows[0]).filter(h => !reserved.has(h));
}

export function groupCurves(rows, idFields = ['plate', 'well']) {
  const groups = new Map();
  for (const r of rows) {
    const id = idFields.map(f => `${f}=${r[f] ?? ''}`).join('|');
    if (!groups.has(id)) groups.set(id, []);
    groups.get(id).push(r);
  }
  return groups;
}

export function toCsv(rows) {
  if (!rows?.length) return '';
  const headers = [...new Set(rows.flatMap(Object.keys))];
  const esc = v => {
    if (v === null || v === undefined || Number.isNaN(v)) return '';
    const s = Array.isArray(v) ? v.join(';') : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers.join(','), ...rows.map(r => headers.map(h => esc(r[h])).join(','))].join('\n');
}
