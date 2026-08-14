const api = window.YeastFit;
if (!api) throw new Error('YeastFit core API is unavailable');

const { S, design, designRefresh, review, runAnalysis, toast } = api;
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const uniq = a => [...new Set(a.filter(v => v !== '' && v != null))];

const PRESETS = [
  { id:'daily', name:'Daily / 24-hour measurements', tag:'Recommended for Jhuang Lab', desc:'Sparse serial OD, growth, fitness, or phenotype measurements over days.', mode:'serial', unit:'days', bundle:'Timepoint fitness + longitudinal change + AUC + slope + replicate QC + control comparisons' },
  { id:'endpoint', name:'Single endpoint growth', tag:'Simple', desc:'One OD, colony, fluorescence, or fitness measurement per sample.', mode:'endpoint', unit:'hours', bundle:'QC + normalization + replicate summaries + effect size + FDR-adjusted control tests' },
  { id:'screen', name:'Mutant / strain screen', tag:'Many strains', desc:'Large strain collection compared with WT or another reference.', mode:'endpoint', unit:'hours', bundle:'Control normalization + robust Z scores + ranked hits + QC + FDR' },
  { id:'matrix', name:'Genotype × condition', tag:'Factorial', desc:'Strains across media, carbon sources, drugs, temperatures, or other conditions.', mode:'auto', unit:'hours', bundle:'Within-condition controls + factorial landscape + interaction contrast + condition-specific effects' },
  { id:'evolution', name:'Evolution trajectory', tag:'Longitudinal', desc:'Ancestor and evolved lines followed across generations or serial timepoints.', mode:'serial', unit:'days', bundle:'Trajectory + endpoint gain + slope + AUC + ancestor normalization + line-to-line variability' },
  { id:'dose', name:'Dose response', tag:'Concentration series', desc:'Drug, nutrient, stressor, or metabolite concentrations.', mode:'endpoint', unit:'hours', bundle:'Dose summaries + normalized response + half-response estimate + effect sizes + QC' },
  { id:'competition', name:'Competition assay', tag:'Frequency data', desc:'Focal strain frequency or fraction measured over time.', mode:'serial', unit:'days', bundle:'Frequency trajectories + logit slope + selection-coefficient proxy + replicate QC' },
  { id:'kinetic', name:'Dense growth curve', tag:'Plate reader', desc:'Frequent measurements that resolve lag and exponential growth.', mode:'kinetic', unit:'hours', bundle:'μmax + doubling time + lag + AUC + threshold time + kinetic QC' },
  { id:'manual', name:'Manual / custom', tag:'Full control', desc:'Keep every mapping and analysis choice fully manual.', mode:'auto', unit:'hours', bundle:'No preset assumptions. Configure every field and analysis manually.' }
];

function fields() {
  const rows = S.raw || [];
  return rows.length ? Object.keys(rows[0]).filter(x => !x.startsWith('__')) : [];
}
function field(re) { return fields().find(f => re.test(f)); }
function values(f) { return f ? uniq((S.raw || []).map(r => String(r[f] ?? '').trim())) : []; }
function preferredValue(f, candidates) {
  const vals = values(f);
  for (const c of candidates) {
    const hit = vals.find(v => c.test(v));
    if (hit != null) return hit;
  }
  return '';
}
function setValue(sel, value) {
  const e = $(sel);
  if (!e || value == null) return;
  const option = [...e.options].find(o => o.value === String(value) || o.textContent === String(value));
  if (option) e.value = option.value;
}
function selectMultiple(sel, wanted) {
  const e = $(sel);
  if (!e) return;
  const set = new Set(wanted.filter(Boolean));
  [...e.options].forEach(o => { o.selected = set.has(o.value) || set.has(o.textContent); });
}
function factorCandidates() {
  const f = fields();
  return f.filter(x => /genotype|strain|medium|media|condition|treatment|carbon|drug|dose|concentration|temperature|generation|evolution|line|stress|nutrient|background/i.test(x));
}
function identityCandidates() {
  const f = fields();
  const p = f.filter(x => /^(plate|well|sample|sample_id|strain_id|culture|replicate_id)$/i.test(x));
  return p.length ? p.slice(0, 2) : f.filter(x => /well|sample|culture/i.test(x)).slice(0,2);
}
function replicateFields() {
  return {
    bio: field(/biological.*rep|bio.*rep|biorep/i),
    tech: field(/technical.*rep|tech.*rep|techrep/i),
    batch: field(/^plate$|batch|run|experiment_id/i)
  };
}
function chooseControl(preset) {
  const role = field(/^role$|control_type|sample_type/i);
  const genotype = field(/genotype|strain/i);
  const dose = field(/^dose$|concentration|conc/i);
  if (preset === 'screen' || preset === 'matrix') {
    if (genotype) return { field: genotype, value: preferredValue(genotype, [/^WT$/i,/wild.?type/i,/parent/i,/ancestor/i]) || values(genotype)[0] || '' };
  }
  if (preset === 'dose' && dose) {
    const zero = values(dose).find(v => Number(v) === 0);
    if (zero != null) return { field: dose, value: zero };
  }
  if (role) return { field: role, value: preferredValue(role, [/^control$/i,/reference/i,/vehicle/i,/WT/i,/ancestor/i]) || values(role)[0] || 'control' };
  if (genotype) return { field: genotype, value: preferredValue(genotype, [/^WT$/i,/wild.?type/i,/ancestor/i,/parent/i]) || values(genotype)[0] || '' };
  return { field:'', value:'control' };
}
function strataFor(preset, controlField) {
  const candidates = fields().filter(f => /plate|batch|medium|media|carbon|condition|treatment|temperature|background|environment/i.test(f));
  if (preset === 'matrix') return candidates.filter(f => f !== controlField).slice(0,4);
  if (preset === 'dose') return candidates.filter(f => f !== controlField).slice(0,3);
  if (preset === 'screen') return candidates.filter(f => f !== controlField).slice(0,3);
  return candidates.filter(f => f !== controlField).slice(0,3);
}

function applyPreset(id) {
  if (!S.raw?.length) return toast('Load experimental data first, then choose a preset.');
  design();
  const preset = PRESETS.find(p => p.id === id);
  if (!preset) return;
  S.design.preset = id;
  S.design.presetName = preset.name;
  if (id === 'manual') {
    S.design.seriesMode = $('#seriesMode')?.value || 'auto';
    updateSelected(id);
    showSummary(preset, 'No settings changed. Every field remains editable.');
    return;
  }
  S.design.seriesMode = preset.mode;
  S.design.timeUnit = preset.unit;
  setValue('#seriesMode', preset.mode);
  const timeField = field(/^day$|days|time|hour|elapsed|generation/i);
  if (preset.id === 'evolution' && field(/generation/i)) setValue('#timeField', field(/generation/i));
  else if (timeField) setValue('#timeField', timeField);
  if (/day/i.test($('#timeField')?.value || '')) S.design.timeUnit = 'days';
  setValue('#timeUnit', S.design.timeUnit);

  const reps = replicateFields();
  S.design.bioRepField = reps.bio || '';
  S.design.techRepField = reps.tech || '';
  S.design.batchField = reps.batch || '';
  S.id = identityCandidates();
  S.factors = factorCandidates();
  if (preset.id === 'evolution') S.factors = uniq([...S.factors, field(/generation/i), field(/evolution.*line|line/i)]);
  if (preset.id === 'dose') S.factors = uniq([...S.factors, field(/^dose$|concentration|conc/i)]);
  const ctrl = chooseControl(id);
  S.design.controlField = ctrl.field;
  S.design.controlValue = ctrl.value;
  S.design.controlStrata = strataFor(id, ctrl.field);
  designRefresh();
  setValue('#seriesMode', S.design.seriesMode);
  setValue('#timeUnit', S.design.timeUnit);
  setValue('#bioRepField', reps.bio || '');
  setValue('#techRepField', reps.tech || '');
  setValue('#batchField', reps.batch || '');
  setValue('#controlField', ctrl.field);
  if ($('#controlValue')) $('#controlValue').value = ctrl.value;
  selectMultiple('#controlStrata', S.design.controlStrata);
  review();
  updateSelected(id);
  showSummary(preset, describeChoices(ctrl, reps));
}

function describeChoices(ctrl, reps) {
  const bits = [];
  if (S.id.length) bits.push(`analysis unit: ${S.id.join(' + ')}`);
  if (ctrl.field) bits.push(`control: ${ctrl.field} = ${ctrl.value || '(choose value)'}`);
  if (reps.bio) bits.push(`biological replicate: ${reps.bio}`);
  if (reps.tech) bits.push(`technical replicate: ${reps.tech}`);
  if (S.design.controlStrata?.length) bits.push(`normalize within: ${S.design.controlStrata.join(', ')}`);
  return bits.length ? `Configured ${bits.join(' · ')}` : 'Preset applied. Review the detected fields below.';
}
function updateSelected(id) {
  $$('.preset-card').forEach(b => b.classList.toggle('selected', b.dataset.preset === id));
}
function showSummary(preset, choices='') {
  const el = $('#presetSummary');
  if (!el) return;
  el.innerHTML = `<div><b>${preset.name}</b><span>${preset.bundle}</span><small>${choices}</small></div><button class="primary" id="presetAnalyzeBtn">Run recommended analysis →</button>`;
  $('#presetAnalyzeBtn').onclick = () => runAnalysis();
}
function recommend() {
  if (!S.raw?.length) return 'daily';
  const f = fields();
  if (f.some(x => /frequency|fraction|proportion/i.test(x))) return 'competition';
  if (f.some(x => /^dose$|concentration|conc/i.test(x))) return 'dose';
  if (f.some(x => /generation|evolution.*line/i.test(x))) return 'evolution';
  const genotype = field(/genotype|strain/i);
  const condition = field(/medium|condition|treatment|carbon|drug|temperature/i);
  if (genotype && condition && values(genotype).length > 1 && values(condition).length > 1) return 'matrix';
  const time = field(/^day$|days|time|hour|elapsed/i);
  if (time) {
    const t = uniq(S.raw.map(r => Number(r[time])).filter(Number.isFinite)).sort((a,b)=>a-b);
    const gaps = t.slice(1).map((x,i)=>x-t[i]).filter(x=>x>0);
    const med = gaps.length ? gaps.sort((a,b)=>a-b)[Math.floor(gaps.length/2)] : NaN;
    if (/day/i.test(time) || med >= 12 || t.length < 8) return 'daily';
    return 'kinetic';
  }
  if (genotype && values(genotype).length >= 8) return 'screen';
  return 'endpoint';
}
function renderPresets() {
  const panel = document.querySelector('.step-panel[data-panel="2"]');
  if (!panel || $('#presetChooser')) return;
  const head = panel.querySelector('.panel-head');
  const wrap = document.createElement('div');
  wrap.id = 'presetChooser';
  wrap.className = 'preset-section';
  wrap.innerHTML = `<div class="preset-heading"><div><span class="section-tag">QUICK SETUP</span><h3>What kind of experiment is this?</h3><p>Choose the closest design. YeastFit will configure sensible defaults, then show every assumption for review.</p></div><span class="preset-recommendation" id="presetRecommendation"></span></div><div class="preset-grid">${PRESETS.map(p => `<button type="button" class="preset-card" data-preset="${p.id}"><span class="preset-tag">${p.tag}</span><b>${p.name}</b><small>${p.desc}</small><em>${p.bundle}</em></button>`).join('')}</div><div id="presetSummary" class="preset-summary"><span>Choose a preset, or continue below for manual setup.</span></div>`;
  head.insertAdjacentElement('afterend', wrap);
  $$('.preset-card').forEach(b => b.onclick = () => applyPreset(b.dataset.preset));
  refreshRecommendation();
}
function refreshRecommendation() {
  const id = recommend(), p = PRESETS.find(x => x.id === id), badge = $('#presetRecommendation');
  if (badge && p) badge.textContent = `Suggested: ${p.name}`;
  $$('.preset-card').forEach(b => b.classList.toggle('recommended', b.dataset.preset === id));
}

renderPresets();
const navDesign = document.querySelector('.step[data-step="2"]');
navDesign?.addEventListener('click', () => setTimeout(refreshRecommendation, 0));
$('#demoBtn')?.addEventListener('click', () => setTimeout(() => { refreshRecommendation(); applyPreset('daily'); }, 80));
$('#dataFiles')?.addEventListener('change', () => setTimeout(refreshRecommendation, 100));
$('#parsePasteBtn')?.addEventListener('click', () => setTimeout(refreshRecommendation, 50));
