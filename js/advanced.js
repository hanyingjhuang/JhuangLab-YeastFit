import { renderVisualDashboard } from './dashboard.js';
import { compareGroupsToControl, normalizeToControls } from './analysis.js';
import { median } from './stats.js';
import { groupRows, summarizeBy, controlNormalize, matchedControlComparisons, replicateDiagnostics, robustScreen, competitionSelection, halfResponseDose, factorialLandscape, twoByTwoInteraction } from './comprehensive.js';

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
  const q = v => { if (v == null || Number.isNaN(v)) return ''; const s=String(v); return /[",\n]/.test(s)?`"${s.replace(/"/g,'""')}"`:s; };
  return [h.join(','),...rows.map(r=>h.map(k=>q(r[k])).join(','))].join('\n');
}
function download(name, rows) {
  const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([csv(rows)],{type:'text/csv'})); a.download=name; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),500);
}
function tableHtml(rows, limit=80) {
  if (!rows?.length) return '<div class="analysis-empty">Not applicable or insufficient data.</div>';
  const h=[...new Set(rows.flatMap(Object.keys))];
  return `<div class="advanced-table-wrap"><table class="data-table advanced-table"><thead><tr>${h.map(x=>`<th>${esc(x.replaceAll('_',' '))}</th>`).join('')}</tr></thead><tbody>${rows.slice(0,limit).map(r=>`<tr>${h.map(x=>`<td>${esc(fmt(r[x]))}</td>`).join('')}</tr>`).join('')}</tbody></table>${rows.length>limit?`<small class="muted">Showing ${limit} of ${rows.length} rows. Export includes all rows.</small>`:''}</div>`;
}
function section(id,title,subtitle,rows,extra='') {
  tables[id]=rows||[];
  return `<section class="analysis-module" data-analysis-module="${id}"><div class="analysis-module-head"><div><h4>${title}</h4><p>${subtitle}</p></div>${rows?.length?`<button class="ghost small advanced-download" data-table="${id}">CSV</button>`:''}</div>${extra}${tableHtml(rows)}</section>`;
}
function controlConfig() { return { controlField:S.design.controlField||'role', controlValue:S.design.controlValue||'control', strata:S.design.controlStrata||[] }; }
function pointRows() { return (S.adj||[]).filter(r=>Number.isFinite(+r.value)); }
function controlsCount(rows,cfg) { return rows.filter(r=>String(r[cfg.controlField]??'').toLowerCase()===String(cfg.controlValue).toLowerCase()).length; }
function has(rows,f){return !!f&&rows.some(r=>Object.prototype.hasOwnProperty.call(r,f));}

function biologicalKeyFields(rows, includeTime=true) {
  const sampleFallback=S.design.bioRepField?'':fieldByName(rows,/^sample$|sample_id|culture_id/i);
  const timeKey=includeTime&&rows.some(r=>Number.isFinite(+r.time))?'time':'';
  const candidate=[...(S.factors||[]),S.design.controlField,...(S.design.controlStrata||[]),S.design.bioRepField,S.design.batchField,sampleFallback,timeKey].filter(Boolean);
  return uniq(candidate).filter(f=>f!==S.design.techRepField&&has(rows,f));
}
function fieldByName(rows,re){return fields(rows).find(f=>re.test(f))||'';}
function reportStrata(strata=[]){return uniq(strata.filter(f=>!/(^|_)(plate|batch|run|experiment)(_|$)/i.test(f)));}
function reportFactors(rows,group,summaryStrata=[],hasTime=false){return (S.factors||[]).filter(f=>{if(!f||f===group||summaryStrata.includes(f)||!has(rows,f))return false;if(hasTime&&/^(time|day|days|generation|generations)$/i.test(f))return false;if(group&&rows.every(r=>String(r[f]??'')===String(r[group]??'')))return false;return uniq(rows.map(r=>r[f])).length>1;});}
function collapseMetricTable(rows){
  if(!rows?.length||!S.design.techRepField||!has(rows,S.design.techRepField))return rows||[];
  const keys=biologicalKeyFields(rows,false);
  if(!keys.length)return rows;
  const numeric=fields(rows).filter(f=>!keys.includes(f)&&f!==S.design.techRepField&&f!=='source_row'&&rows.some(r=>Number.isFinite(+r[f])));
  const out=[];
  for(const g of groupRows(rows,keys).values()){
    const r={...Object.fromEntries(keys.map(k=>[k,g[0][k]??'']))};
    for(const f of numeric){const v=g.map(x=>+x[f]).filter(Number.isFinite);if(v.length)r[f]=median(v);}
    const flags=uniq(g.flatMap(x=>String(x.qc_flags||'').split(/[;,|]/).map(y=>y.trim()).filter(Boolean)));
    if(flags.length)r.qc_flags=flags.join('; ');
    r.technical_n=g.length;out.push(r);
  }
  return out;
}
function collapseTechnical(rows,valueField,includeTime=true) {
  if (!rows?.length || !S.design.techRepField || !has(rows,S.design.techRepField)) return rows||[];
  const keys=biologicalKeyFields(rows,includeTime);
  if(!keys.length)return rows;
  return summarizeBy(rows,keys,valueField).map(r=>({
    ...Object.fromEntries(keys.map(k=>[k,r[k]])),
    [valueField]:r.median,
    technical_n:r.n,
    technical_mean:r.mean,
    technical_sd:r.sd,
    technical_cv:r.cv
  }));
}
function nonControlLabels(rows,group,cfg){
  return new Set(rows.filter(r=>String(r[cfg.controlField]??'').toLowerCase()!==String(cfg.controlValue).toLowerCase()).map(r=>r[group]));
}
function filteredTests(rows,metric,group,cfg,strata=cfg.strata){
  if(!rows.length||!metric||!group||!cfg.controlField)return[];
  const allowed=nonControlLabels(rows,group,cfg);
  return compareGroupsToControl(rows,metric,group,{...cfg,strata}).filter(r=>allowed.has(r.group));
}
function aggregateRanking(rows,metric,group,cfg){
  if(!rows.length||!group)return[];
  const scored=robustScreen(rows,{metric,controlField:cfg.controlField,controlValue:cfg.controlValue,strata:cfg.strata,lowerIsDefect:true});
  const displayStrata=reportStrata(cfg.strata).filter(f=>uniq(scored.map(r=>r[f])).length>1);
  const keys=uniq([group,...displayStrata,cfg.controlField].filter(Boolean));
  const out=[];
  for(const g of groupRows(scored,keys).values()){
    const rel=g.map(r=>+r.relative_fitness).filter(Number.isFinite),z=g.map(r=>+r.robust_z).filter(Number.isFinite);
    const base=Object.fromEntries(keys.map(k=>[k,g[0][k]??'']));
    const report_label=[String(g[0][group]??''),...displayStrata.map(f=>String(g[0][f]??''))].filter(Boolean).join(' · ');
    out.push({...base,report_label,biological_n:g.length,relative_fitness:rel.length?median(rel):NaN,mean_relative_fitness:rel.length?rel.reduce((a,b)=>a+b,0)/rel.length:NaN,median_robust_z:z.length?median(z):NaN,candidate_flag:z.length&&Math.abs(median(z))>=2?'candidate':''});
  }
  out.sort((a,b)=>(Number.isFinite(a.relative_fitness)?a.relative_fitness:Infinity)-(Number.isFinite(b.relative_fitness)?b.relative_fitness:Infinity));
  return out.map((r,i)=>({...r,rank:i+1}));
}

function buildOverview() {
  const mode=S.design.analysisModeResolved||'endpoint',raw=pointRows(),bio=collapseTechnical(raw,'value',true),cfg=controlConfig(),flagged=S.metrics.filter(r=>r.qc_flags).length,group=preferredGroup(),groups=group?uniq(S.metrics.map(r=>r[group])).length:0;
  return `<div class="analysis-overview-grid"><div><small>Analysis mode</small><b>${mode==='serial'?'Serial / sparse timepoints':mode==='kinetic'?'Dense growth kinetics':'Independent endpoints'}</b></div><div><small>Analysis units</small><b>${S.metrics.length}</b></div><div><small>Measurements</small><b>${raw.length||S.metrics.length}</b></div><div><small>Biological-level rows</small><b>${bio.length||'—'}</b></div><div><small>${group?esc(group):'Groups'}</small><b>${groups||'—'}</b></div><div><small>QC-flagged units</small><b>${flagged}</b></div></div><div class="analysis-guidance"><b>Inference guardrail</b><span>${S.design.techRepField?'Technical replicates are summarized for QC, then collapsed to the biological-replicate level before control tests and ranking. ':'No technical-replicate field is defined, so YeastFit uses the supplied analysis units. '}${mode==='serial'?'Sparse measurements are treated as discrete longitudinal observations. μmax, doubling time, and lag are not inferred.':mode==='kinetic'?'Kinetic metrics are reported because the sampling was designated dense enough to resolve growth phases.':'Each observation is treated as an endpoint unless you choose another design.'}</span></div>`;
}

function comprehensiveData() {
  const mode=S.design.analysisModeResolved||'endpoint',cfg=controlConfig(),group=preferredGroup(),rawPts=pointRows(),metric=metricForMode();
  const pts=collapseTechnical(rawPts,'value',true),metrics=collapseMetricTable(S.metrics);
  const out={},hasTime=pts.some(r=>Number.isFinite(+r.time)),summaryStrata=reportStrata(cfg.strata);
  const pointNormStrata=uniq([...cfg.strata,hasTime?'time':''].filter(Boolean));
  const pointTestStrata=uniq([...summaryStrata,hasTime?'time':''].filter(Boolean));
  const pointReportFactors=reportFactors(pts,group,summaryStrata,hasTime);
  const metricReportFactors=reportFactors(metrics,group,summaryStrata,false);
  const pointGroupFields=uniq([group,...summaryStrata,...pointReportFactors,hasTime?'time':''].filter(Boolean));
  out.timepointSummary=pts.length?summarizeBy(pts,pointGroupFields,'value'):[];
  out.normalizedPoints=pts.length&&cfg.controlField?controlNormalize(pts,'value',{...cfg,strata:pointNormStrata}):[];
  out.timepointTests=out.normalizedPoints.length&&group?matchedControlComparisons(out.normalizedPoints,{groupField:group,controlField:cfg.controlField,controlValue:cfg.controlValue,strata:pointTestStrata}):[];
  out.replicates=rawPts.length?replicateDiagnostics(rawPts,{technicalField:S.design.techRepField,biologicalField:S.design.bioRepField,timeField:hasTime?'time':'',groupingFields:uniq([group,...summaryStrata,...pointReportFactors].filter(Boolean)),cvWarn:0.15}):[];
  out.metricSummary=metric&&group?summarizeBy(metrics,uniq([group,...summaryStrata,...metricReportFactors].filter(Boolean)),metric):[];
  out.normalizedMetrics=metric&&cfg.controlField?controlNormalize(metrics,metric,cfg):[];
  out.metricTests=metric&&group&&out.normalizedMetrics.length?matchedControlComparisons(out.normalizedMetrics,{groupField:group,controlField:cfg.controlField,controlValue:cfg.controlValue,strata:summaryStrata}):[];
  out.ranking=metric&&group&&cfg.controlField?aggregateRanking(metrics,metric,group,cfg):[];
  const f=(S.factors||[]).filter(x=>fields(pts.length?pts:metrics).includes(x));
  if(f.length>=2){const source=pts.length?pts:metrics,value=pts.length?'value':metric;out.factorial=factorialLandscape(source,f[0],f[1],value);const ii=twoByTwoInteraction(source,f[0],f[1],value);out.interaction=ii?[ii]:[];}else{out.factorial=[];out.interaction=[];}
  const dose=(S.factors||[]).find(x=>/dose|concentration|conc/i.test(x));
  out.dose=dose&&pts.length?halfResponseDose(pts,{doseField:dose,valueField:'value',groupFields:(S.factors||[]).filter(x=>x!==dose).slice(0,2)}):[];
  const frequencyField=fieldByName(rawPts,/frequency|fraction|proportion|allele_freq/i);
  out.competition=(S.design.preset==='competition'||frequencyField)?competitionSelection(pts,{idFields:biologicalKeyFields(pts,false).filter(f=>f!=='time').slice(0,4),timeField:'time',valueField:'value'}):[];
  out.inferencePoints=pts;out.inferenceMetrics=metrics;
  return out;
}

function renderPlots(data) {
  if(!window.Plotly)return;
  const group=preferredGroup(),el=$('#advancedNormalizedPlot');
  if(el&&data.normalizedPoints.length&&group){
    const times=uniq(data.normalizedPoints.map(r=>+r.time).filter(Number.isFinite)).sort((a,b)=>a-b),levels=uniq(data.normalizedPoints.map(r=>r[group]));
    const traces=levels.map(level=>({type:'scatter',mode:'lines+markers',name:String(level),x:times,y:times.map(t=>{const v=data.normalizedPoints.filter(r=>r[group]===level&&+r.time===t).map(r=>+r.relative_to_control).filter(Number.isFinite);return v.length?median(v):NaN}),line:{width:2},marker:{size:7}}));
    Plotly.react(el,traces,{margin:{l:55,r:20,t:10,b:50},paper_bgcolor:'white',plot_bgcolor:'white',font:{family:'Inter, sans-serif',color:'#304035'},xaxis:{title:`Time (${S.design.timeUnit||'units'})`,gridcolor:'#eee'},yaxis:{title:'Relative to contemporaneous control',gridcolor:'#eee',zeroline:false},legend:{orientation:'h',y:-.2}},{responsive:true,displaylogo:false});
  }
  const rank=$('#advancedRankingPlot');
  if(rank&&data.ranking.length&&group){
    const agg=[...data.ranking].filter(r=>Number.isFinite(+r.relative_fitness)).sort((a,b)=>a.relative_fitness-b.relative_fitness).slice(0,40);
    Plotly.react(rank,[{type:'bar',x:agg.map(r=>String(r[group])),y:agg.map(r=>r.relative_fitness),hovertemplate:'%{x}<br>relative=%{y:.3g}<extra></extra>'}],{margin:{l:55,r:20,t:10,b:110},paper_bgcolor:'white',plot_bgcolor:'white',font:{family:'Inter, sans-serif',color:'#304035'},xaxis:{tickangle:-55},yaxis:{title:'Median relative phenotype',gridcolor:'#eee'}},{responsive:true,displaylogo:false});
  }
}

function installSafeComparison(){
  const b=$('#runComparisonBtn');if(!b)return;
  b.onclick=()=>{
    const m=$('#comparisonMetric')?.value,g=$('#comparisonGroup')?.value,cf=$('#comparisonControlField')?.value,cv=$('#comparisonControlValue')?.value,cfg={controlField:cf,controlValue:cv,strata:S.design.controlStrata||[]};
    if(!m||!g||!cf)return api.toast('Choose metric, group, and control');
    if(m==='timepoint_value'){
      const rows=collapseTechnical(pointRows(),'value',true),hasTime=rows.some(r=>Number.isFinite(+r.time)),normStrata=uniq([...cfg.strata,hasTime?'time':''].filter(Boolean)),testStrata=uniq([...reportStrata(cfg.strata),hasTime?'time':''].filter(Boolean));
      S.norm=normalizeToControls(rows,'value',{...cfg,strata:normStrata});S.cmp=filteredTests(S.norm,'value_relative',g,cfg,testStrata);
      $('#comparisonTable').innerHTML=tableHtml(S.cmp,300);
      if(window.Plotly){const times=uniq(S.norm.map(r=>+r.time).filter(Number.isFinite)).sort((a,b)=>a-b),labs=uniq(S.norm.map(r=>r[g])),tr=labs.map(l=>({type:'scatter',mode:'lines+markers',name:String(l),x:times,y:times.map(t=>{const v=S.norm.filter(r=>r[g]===l&&+r.time===t).map(r=>+r.value_relative).filter(Number.isFinite);return v.length?median(v):NaN})}));Plotly.react('comparisonPlot',tr,{margin:{l:58,r:20,t:15,b:48},paper_bgcolor:'white',plot_bgcolor:'white',xaxis:{title:`Time (${S.design.timeUnit||'units'})`,gridcolor:'#eee'},yaxis:{title:'Relative to contemporaneous control',gridcolor:'#eee'},legend:{orientation:'h',y:-.18}},{responsive:true,displaylogo:false});}
      api.recipe();return api.toast(`${S.cmp.length} biological-level timepoint comparisons calculated`);
    }
    const rows=collapseMetricTable(S.metrics);S.norm=normalizeToControls(rows,m,cfg);S.cmp=filteredTests(S.norm,`${m}_relative`,g,cfg,reportStrata(cfg.strata));$('#comparisonTable').innerHTML=tableHtml(S.cmp,200);
    if(window.Plotly){const rel=`${m}_relative`,labs=uniq(S.norm.map(r=>r[g])),tr=labs.map(l=>({type:'box',name:String(l),y:S.norm.filter(r=>r[g]===l).map(r=>r[rel]).filter(Number.isFinite),boxpoints:'all',jitter:.28,pointpos:0}));Plotly.react('comparisonPlot',tr,{margin:{l:58,r:20,t:15,b:48},paper_bgcolor:'white',plot_bgcolor:'white',xaxis:{title:g},yaxis:{title:`Relative ${m}`,gridcolor:'#eee'},showlegend:false},{responsive:true,displaylogo:false});}
    api.recipe();api.toast(`${S.cmp.length} biological-level comparisons calculated`);
  };
}

function render() {
  const root=$('#comprehensiveResults');if(!root||!S.metrics?.length)return;
  tables={};const data=comprehensiveData(),mode=S.design.analysisModeResolved||'endpoint',group=preferredGroup(),metric=metricForMode(),preset=S.design.presetName||'Automatic / custom',hasTime=data.inferencePoints.some(r=>Number.isFinite(+r.time));if(location.hostname==='127.0.0.1')window.__YEASTFIT_TEST_DEBUG={design:{...S.design},factors:[...(S.factors||[])],group,metric,inferenceMetrics:data.inferenceMetrics.map(r=>({genotype:r.genotype,condition:r.condition,plate:r.plate,biological_rep:r.biological_rep,endpoint:r.endpoint})),normalizedMetrics:(data.normalizedMetrics||[]).map(r=>({genotype:r.genotype,condition:r.condition,plate:r.plate,biological_rep:r.biological_rep,endpoint:r.endpoint,relative_to_control:r.relative_to_control,log2_ratio:r.log2_ratio})),metricTests:data.metricTests};if(location.hostname==='127.0.0.1')window.__YEASTFIT_TEST_DEBUG={design:{...S.design},factors:[...(S.factors||[])],group,metric,inferenceMetrics:data.inferenceMetrics.map(r=>({genotype:r.genotype,condition:r.condition,plate:r.plate,biological_rep:r.biological_rep,endpoint:r.endpoint})),normalizedMetrics:(data.normalizedMetrics||[]).map(r=>({genotype:r.genotype,condition:r.condition,plate:r.plate,biological_rep:r.biological_rep,endpoint:r.endpoint,relative_to_control:r.relative_to_control,log2_ratio:r.log2_ratio})),metricTests:data.metricTests};if(location.hostname==='127.0.0.1')window.__YEASTFIT_TEST_DEBUG={design:{...S.design},factors:[...(S.factors||[])],group,metric,inferenceMetrics:data.inferenceMetrics.map(r=>({genotype:r.genotype,condition:r.condition,plate:r.plate,biological_rep:r.biological_rep,endpoint:r.endpoint})),normalizedMetrics:(data.normalizedMetrics||[]).map(r=>({genotype:r.genotype,condition:r.condition,plate:r.plate,biological_rep:r.biological_rep,endpoint:r.endpoint,relative_to_control:r.relative_to_control,log2_ratio:r.log2_ratio})),metricTests:data.metricTests};
  root.innerHTML=`<div class="comprehensive-head"><div><span class="section-tag">COMPREHENSIVE ANALYSIS</span><h3>${esc(preset)}</h3><p>YeastFit automatically runs the analyses supported by the experimental structure. Unsupported modules are marked not applicable rather than forced.</p></div><span class="analysis-bundle-badge">${mode}</span></div>${buildOverview()}<div id="visualDashboard" class="visual-dashboard"></div><div class="analysis-tabs"><button class="analysis-tab active" data-tab="core">Core summaries</button><button class="analysis-tab" data-tab="controls">Controls & statistics</button><button class="analysis-tab" data-tab="qc">Replicates & QC</button><button class="analysis-tab" data-tab="screen">Ranking</button><button class="analysis-tab" data-tab="special">Specialized</button></div><div class="analysis-tabpane active" data-pane="core">${section('timepoints',hasTime?'Timepoint summaries':'Observation summaries',hasTime?'Biological-level mean, median, SD, SEM, 95% CI, CV, range, and n for each relevant group and sampled timepoint.':'Biological-level mean, median, SD, SEM, 95% CI, CV, range, and n for each relevant group.',data.timepointSummary)}${section('metrics','Per-group integrated metrics',`Biological-level summaries of ${esc(metric||'the primary metric')} across experimental groups.`,data.metricSummary)}</div><div class="analysis-tabpane" data-pane="controls"><div class="advanced-plot-card"><h4>Control-normalized trajectories</h4><p>Each timepoint is normalized to the contemporaneous control within the selected strata.</p><div id="advancedNormalizedPlot" class="plot compact-plot"></div></div>${section('normalized','Normalized biological observations','Ratio, difference, percent of control, and log2 ratio are retained for every biological-level observation.',data.normalizedPoints)}${section('timeTests','Per-timepoint control tests','Welch tests, effect sizes, and BH-adjusted q values at the biological-replicate level.',data.timepointTests)}${section('metricTests','Integrated-metric control tests',`Biological-level control comparisons using ${esc(metric||'the selected metric')}.`,data.metricTests)}</div><div class="analysis-tabpane" data-pane="qc">${section('replicates','Technical replicate diagnostics','Technical-replicate CV is calculated within biological sample/timepoint when the metadata define technical replicates. CV > 0.15 is flagged by default.',data.replicates)}<div class="analysis-guidance"><b>Experimental unit</b><span>Technical replicates support QC and are collapsed before inferential comparisons. Biological replicates remain the independent units when that field is available.</span></div></div><div class="analysis-tabpane" data-pane="screen"><div class="advanced-plot-card"><h4>Ranked relative phenotype</h4><p>Ranking is aggregated across biological replicates and is useful for screens and candidate prioritization.</p><div id="advancedRankingPlot" class="plot compact-plot"></div></div>${section('ranking','Robust ranking','Groups are normalized to controls within strata. Median robust Z and relative phenotype are reported; candidate flags are prioritization aids, not definitive hits.',data.ranking)}</div><div class="analysis-tabpane" data-pane="special">${section('factorial','Factorial landscape','Descriptive biological-level cell summaries for the first two experimental factors.',data.factorial)}${section('interaction','2 × 2 interaction contrast','When both factors have exactly two levels, a difference-in-differences interaction contrast is reported. It is descriptive, not a substitute for a design-specific mixed model.',data.interaction)}${section('dose','Dose-response summary','For quantitative dose fields, an observed-range half-response dose is interpolated when the response crosses the midpoint.',data.dose)}${section('competition','Competition selection proxy','For frequency experiments, the slope of logit(frequency) versus time is reported as a selection-coefficient proxy.',data.competition)}</div>`;
  root.querySelectorAll('.analysis-tab').forEach(b=>b.onclick=()=>{root.querySelectorAll('.analysis-tab').forEach(x=>x.classList.toggle('active',x===b));root.querySelectorAll('.analysis-tabpane').forEach(x=>x.classList.toggle('active',x.dataset.pane===b.dataset.tab));if(b.dataset.tab==='controls'||b.dataset.tab==='screen')setTimeout(()=>renderPlots(data),0)});
  root.querySelectorAll('.advanced-download').forEach(b=>b.onclick=()=>download(`YeastFit_${b.dataset.table}.csv`,tables[b.dataset.table]||[]));renderVisualDashboard($('#visualDashboard'),{S,data,group,metric});renderPlots(data);
}

function install() {
  const panel=document.querySelector('.step-panel[data-panel="4"]');if(!panel||$('#comprehensiveResults'))return;
  const actions=panel.querySelector('.footer-actions'),root=document.createElement('div');root.id='comprehensiveResults';root.className='comprehensive-results';panel.insertBefore(root,actions);
  const status=$('#analysisStatus');if(status)new MutationObserver(()=>{if(S.metrics?.length)setTimeout(render,0)}).observe(status,{childList:true,characterData:true,subtree:true});
  installSafeComparison();if(S.metrics?.length)render();
}
install();
