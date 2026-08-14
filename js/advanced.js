import { compareGroupsToControl } from './analysis.js';
import { median } from './stats.js';
import { summarizeBy, controlNormalize, replicateDiagnostics, robustScreen, competitionSelection, halfResponseDose, factorialLandscape, twoByTwoInteraction } from './comprehensive.js';

const api = window.YeastFit;
if (!api) throw new Error('YeastFit core API is unavailable');
const { S } = api;
const $ = s => document.querySelector(s);
const uniq = a => [...new Set(a.filter(v => v !== '' && v != null))];
const esc = v => String(v ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt = v => Number.isFinite(Number(v)) ? Number(v).toLocaleString(undefined,{maximumSignificantDigits:5}) : (v ?? '');

let tables = {};
function fields(rows) { return rows?.length ? Object.keys(rows[0]) : []; }
function preferredGroup() {
  const f = S.factors || [];
  return f.find(x => /genotype|strain/i.test(x)) || f.find(x => /condition|treatment|medium|carbon|drug/i.test(x)) || f[0] || '';
}
function metricForMode() {
  const mode = S.design.analysisModeResolved || 'endpoint';
  if (mode === 'kinetic') return S.metrics.some(r=>Number.isFinite(+r.mu_max)) ? 'mu_max' : 'auc';
  return S.metrics.some(r=>Number.isFinite(+r.endpoint)) ? 'endpoint' : fields(S.metrics).find(f=>S.metrics.some(r=>Number.isFinite(+r[f]))) || '';
}
function csv(rows) {
  if (!rows?.length) return '';
  const h = [...new Set(rows.flatMap(Object.keys))];
  const q = v => {
    if (v == null || Number.isNaN(v)) return '';
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g,'""')}"` : s;
  };
  return [h.join(','),...rows.map(r=>h.map(k=>q(r[k])).join(','))].join('\n');
}
function download(name, rows) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv(rows)],{type:'text/csv'}));
  a.download = name;
  a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href),500);
}
function tableHtml(rows, limit=80) {
  if (!rows?.length) return '<div class="analysis-empty">Not applicable or insufficient data.</div>';
  const h = [...new Set(rows.flatMap(Object.keys))];
  return `<div class="advanced-table-wrap"><table class="data-table advanced-table"><thead><tr>${h.map(x=>`<th>${esc(x.replaceAll('_',' '))}</th>`).join('')}</tr></thead><tbody>${rows.slice(0,limit).map(r=>`<tr>${h.map(x=>`<td>${esc(fmt(r[x]))}</td>`).join('')}</tr>`).join('')}</tbody></table>${rows.length>limit?`<small class="muted">Showing ${limit} of ${rows.length} rows. Export includes all rows.</small>`:''}</div>`;
}
function section(id,title,subtitle,rows,extra='') {
  tables[id]=rows||[];
  return `<section class="analysis-module" data-analysis-module="${id}"><div class="analysis-module-head"><div><h4>${title}</h4><p>${subtitle}</p></div>${rows?.length?`<button class="ghost small advanced-download" data-table="${id}">CSV</button>`:''}</div>${extra}${tableHtml(rows)}</section>`;
}
function controlConfig() {
  return { controlField:S.design.controlField||'role', controlValue:S.design.controlValue||'control', strata:S.design.controlStrata||[] };
}
function pointRows() { return (S.adj||[]).filter(r=>Number.isFinite(+r.value)); }
function controlsCount(rows, cfg) { return rows.filter(r=>String(r[cfg.controlField]??'').toLowerCase()===String(cfg.controlValue).toLowerCase()).length; }

function buildOverview() {
  const mode=S.design.analysisModeResolved||'endpoint', pts=pointRows(), cfg=controlConfig(), flagged=S.metrics.filter(r=>r.qc_flags).length;
  const group=preferredGroup(), groups=group?uniq(S.metrics.map(r=>r[group])).length:0;
  return `<div class="analysis-overview-grid"><div><small>Analysis mode</small><b>${mode==='serial'?'Serial / sparse timepoints':mode==='kinetic'?'Dense growth kinetics':'Independent endpoints'}</b></div><div><small>Analysis units</small><b>${S.metrics.length}</b></div><div><small>Measurements</small><b>${pts.length || S.metrics.length}</b></div><div><small>Controls found</small><b>${controlsCount(pts.length?pts:S.metrics,cfg)}</b></div><div><small>${group?esc(group):'Groups'}</small><b>${groups||'—'}</b></div><div><small>QC-flagged units</small><b>${flagged}</b></div></div><div class="analysis-guidance"><b>Interpretation guardrail</b><span>${mode==='serial'?'Sparse measurements are treated as discrete longitudinal observations. μmax, doubling time, and lag are not inferred.':mode==='kinetic'?'Kinetic metrics are reported because the sampling was designated dense enough to resolve growth phases.':'Each observation is treated as an endpoint unless you choose another design.'}</span></div>`;
}

function comprehensiveData() {
  const mode=S.design.analysisModeResolved||'endpoint', cfg=controlConfig(), group=preferredGroup(), pts=pointRows(), metric=metricForMode();
  const out={};
  const pointGroupFields=uniq([group,...cfg.strata,'time'].filter(Boolean));
  out.timepointSummary = pts.length ? summarizeBy(pts,pointGroupFields,'value') : [];
  out.normalizedPoints = pts.length && cfg.controlField ? controlNormalize(pts,'value',{...cfg,strata:uniq([...cfg.strata,'time'])}) : [];
  out.timepointTests = pts.length && group && cfg.controlField ? compareGroupsToControl(pts,'value',group,{...cfg,strata:uniq([...cfg.strata,'time'])}) : [];
  const repGrouping=uniq([group,...cfg.strata].filter(Boolean));
  out.replicates=pts.length?replicateDiagnostics(pts,{technicalField:S.design.techRepField,biologicalField:S.design.bioRepField,timeField:'time',groupingFields:repGrouping,cvWarn:0.15}):[];
  out.metricSummary=metric&&group?summarizeBy(S.metrics,[...new Set([group,...cfg.strata])],metric):[];
  out.metricTests=metric&&group&&cfg.controlField?compareGroupsToControl(S.metrics,metric,group,cfg):[];
  out.ranking=metric&&cfg.controlField?robustScreen(S.metrics,{metric,controlField:cfg.controlField,controlValue:cfg.controlValue,strata:cfg.strata,lowerIsDefect:true}):[];
  const f=(S.factors||[]).filter(x=>fields(pts.length?pts:S.metrics).includes(x));
  if(f.length>=2){out.factorial=factorialLandscape(pts.length?pts:S.metrics,f[0],f[1],pts.length?'value':metric);let ii=twoByTwoInteraction(pts.length?pts:S.metrics,f[0],f[1],pts.length?'value':metric);out.interaction=ii?[ii]:[];}else{out.factorial=[];out.interaction=[];}
  const dose=(S.factors||[]).find(x=>/dose|concentration|conc/i.test(x));
  out.dose=dose&&pts.length?halfResponseDose(pts,{doseField:dose,valueField:'value',groupFields:(S.factors||[]).filter(x=>x!==dose).slice(0,2)}):[];
  out.competition=(S.design.preset==='competition'||(pts.length&&pts.every(r=>+r.value>=0&&+r.value<=1)))?competitionSelection(pts,{idFields:['curve_id'],timeField:'time',valueField:'value'}):[];
  return out;
}

function renderPlots(data) {
  if (!window.Plotly) return;
  const group=preferredGroup(), pts=pointRows(), cfg=controlConfig();
  const el=$('#advancedNormalizedPlot');
  if(el&&data.normalizedPoints.length&&group){
    const times=uniq(data.normalizedPoints.map(r=>+r.time).filter(Number.isFinite)).sort((a,b)=>a-b), levels=uniq(data.normalizedPoints.map(r=>r[group]));
    const traces=levels.map(level=>({type:'scatter',mode:'lines+markers',name:String(level),x:times,y:times.map(t=>{const v=data.normalizedPoints.filter(r=>r[group]===level&&+r.time===t).map(r=>+r.relative_to_control).filter(Number.isFinite);return v.length?median(v):NaN}),line:{width:2},marker:{size:7}}));
    Plotly.react(el,traces,{margin:{l:55,r:20,t:10,b:50},paper_bgcolor:'white',plot_bgcolor:'white',font:{family:'Inter, sans-serif',color:'#304035'},xaxis:{title:`Time (${S.design.timeUnit||'units'})`,gridcolor:'#eee'},yaxis:{title:'Relative to contemporaneous control',gridcolor:'#eee',zeroline:false},legend:{orientation:'h',y:-.2}},{responsive:true,displaylogo:false});
  }
  const rank=$('#advancedRankingPlot');
  if(rank&&data.ranking.length&&group){
    const agg=summarizeBy(data.ranking,[group],'relative_fitness').filter(r=>Number.isFinite(r.median)).sort((a,b)=>a.median-b.median).slice(0,40);
    Plotly.react(rank,[{type:'bar',x:agg.map(r=>String(r[group])),y:agg.map(r=>r.median),hovertemplate:'%{x}<br>relative=%{y:.3g}<extra></extra>'}],{margin:{l:55,r:20,t:10,b:110},paper_bgcolor:'white',plot_bgcolor:'white',font:{family:'Inter, sans-serif',color:'#304035'},xaxis:{tickangle:-55},yaxis:{title:'Median relative phenotype',gridcolor:'#eee'}},{responsive:true,displaylogo:false});
  }
}

function render() {
  const root=$('#comprehensiveResults');
  if(!root||!S.metrics?.length)return;
  tables={};
  const data=comprehensiveData(), mode=S.design.analysisModeResolved||'endpoint', group=preferredGroup(), metric=metricForMode(), preset=S.design.presetName||'Automatic / custom';
  root.innerHTML=`<div class="comprehensive-head"><div><span class="section-tag">COMPREHENSIVE ANALYSIS</span><h3>${esc(preset)}</h3><p>YeastFit automatically runs the analyses that are supported by the experimental structure. Modules with insufficient information are shown as not applicable rather than forcing a result.</p></div><span class="analysis-bundle-badge">${mode}</span></div>${buildOverview()}<div class="analysis-tabs"><button class="analysis-tab active" data-tab="core">Core summaries</button><button class="analysis-tab" data-tab="controls">Controls & statistics</button><button class="analysis-tab" data-tab="qc">Replicates & QC</button><button class="analysis-tab" data-tab="screen">Ranking</button><button class="analysis-tab" data-tab="special">Specialized</button></div><div class="analysis-tabpane active" data-pane="core">${section('timepoints','Timepoint summaries','Mean, median, SD, SEM, 95% CI, CV, range, and n for each relevant group and timepoint.',data.timepointSummary)}${section('metrics','Per-group integrated metrics',`Summaries of ${esc(metric||'the primary metric')} across experimental groups.`,data.metricSummary)}</div><div class="analysis-tabpane" data-pane="controls"><div class="advanced-plot-card"><h4>Control-normalized trajectories</h4><p>Each timepoint is normalized to the contemporaneous control within the selected strata.</p><div id="advancedNormalizedPlot" class="plot compact-plot"></div></div>${section('normalized','Normalized observations','Ratio, difference, percent of control, and log2 ratio are retained for every observation.',data.normalizedPoints)}${section('timeTests','Per-timepoint control tests','Welch tests, effect sizes, and BH-adjusted q values for each displayed group versus the control at each timepoint.',data.timepointTests)}${section('metricTests','Integrated-metric control tests',`Control comparisons using ${esc(metric||'the selected metric')}.`,data.metricTests)}</div><div class="analysis-tabpane" data-pane="qc">${section('replicates','Technical replicate diagnostics','CV is calculated within biological sample/timepoint when a technical-replicate field is defined. CV > 0.15 is flagged by default.',data.replicates)}<div class="analysis-guidance"><b>Experimental unit</b><span>Technical replicates should support QC and aggregation, not inflate inferential n. Biological replicates should remain the primary independent units whenever the metadata allow this distinction.</span></div></div><div class="analysis-tabpane" data-pane="screen"><div class="advanced-plot-card"><h4>Ranked relative phenotype</h4><p>Useful for screens and candidate prioritization. The table also reports robust Z scores and candidate flags.</p><div id="advancedRankingPlot" class="plot compact-plot"></div></div>${section('ranking','Robust ranking','Rows are normalized to controls within strata and ranked. |robust Z| ≥ 2 is flagged as a candidate, not as a definitive hit.',data.ranking)}</div><div class="analysis-tabpane" data-pane="special">${section('factorial','Factorial landscape','Descriptive cell summaries for the first two experimental factors.',data.factorial)}${section('interaction','2 × 2 interaction contrast','When both factors have exactly two levels, YeastFit reports a difference-in-differences interaction contrast. This is descriptive and is not presented as a formal mixed-model test.',data.interaction)}${section('dose','Dose-response summary','For quantitative dose fields, an observed-range half-response dose is interpolated when the response crosses the midpoint.',data.dose)}${section('competition','Competition selection proxy','For frequency data between 0 and 1, the slope of logit(frequency) versus time is reported as a selection-coefficient proxy.',data.competition)}</div>`;
  root.querySelectorAll('.analysis-tab').forEach(b=>b.onclick=()=>{root.querySelectorAll('.analysis-tab').forEach(x=>x.classList.toggle('active',x===b));root.querySelectorAll('.analysis-tabpane').forEach(x=>x.classList.toggle('active',x.dataset.pane===b.dataset.tab));if(b.dataset.tab==='controls'||b.dataset.tab==='screen')setTimeout(()=>renderPlots(data),0)});
  root.querySelectorAll('.advanced-download').forEach(b=>b.onclick=()=>download(`YeastFit_${b.dataset.table}.csv`,tables[b.dataset.table]||[]));
  renderPlots(data);
}

function install() {
  const panel=document.querySelector('.step-panel[data-panel="4"]');
  if(!panel||$('#comprehensiveResults'))return;
  const actions=panel.querySelector('.footer-actions');
  const root=document.createElement('div');root.id='comprehensiveResults';root.className='comprehensive-results';
  panel.insertBefore(root,actions);
  const status=$('#analysisStatus');
  if(status)new MutationObserver(()=>{if(S.metrics?.length)setTimeout(render,0)}).observe(status,{childList:true,characterData:true,subtree:true});
  if(S.metrics?.length)render();
}
install();
