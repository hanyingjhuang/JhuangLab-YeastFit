import { median } from './stats.js';
import { controlNormalize } from './comprehensive.js';

const uniq=a=>[...new Set(a.filter(v=>v!==''&&v!=null))];
const finite=a=>a.map(Number).filter(Number.isFinite);
const med=a=>{const v=finite(a);return v.length?median(v):NaN};
const mean=a=>{const v=finite(a);return v.length?v.reduce((x,y)=>x+y,0)/v.length:NaN};
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const PALETTE=['#315c45','#c89a45','#a85f47','#765767','#6d8b64','#55748b','#9a7558','#65806b'];
const HEAT=[[0,'#f2eee4'],[.25,'#dce7d6'],[.5,'#fbfbf8'],[.75,'#ead1a8'],[1,'#a85f47']];
const metricName=m=>String(m||'value').replaceAll('_',' ').replace(/\b\w/g,x=>x.toUpperCase());

function base(y=''){
  return {margin:{l:62,r:18,t:8,b:52},paper_bgcolor:'#fff',plot_bgcolor:'#fff',font:{family:'Inter, ui-sans-serif, sans-serif',color:'#304035',size:11},xaxis:{gridcolor:'#edf0eb',zeroline:false,linecolor:'#d8ddd6',automargin:true},yaxis:{title:y,gridcolor:'#edf0eb',zeroline:false,linecolor:'#d8ddd6',automargin:true},legend:{orientation:'h',y:-.2,x:0,font:{size:10}},hovermode:'closest',showlegend:true};
}
function levels(rows,f){return f?uniq(rows.map(r=>r[f])):[]}
function color(i){return PALETTE[i%PALETTE.length]}
function divider(root,label){const d=document.createElement('div');d.className='report-section-divider';d.textContent=label;root.appendChild(d)}
function addCard(root,id,title,desc,traces,layout,{wide=false,compact=false}={}){
  if(!window.Plotly||!traces?.length)return false;
  const el=document.createElement('section');el.className=`visual-card${wide?' visual-wide':''}${compact?' visual-compact':''}`;
  el.innerHTML=`<div class="visual-card-head"><div><h4>${esc(title)}</h4><p>${esc(desc)}</p></div><button class="ghost small visual-save" data-plot="${id}">SVG</button></div><div id="${id}" class="visual-plot"></div>`;
  root.appendChild(el);Plotly.react(el.querySelector('.visual-plot'),traces,layout,{responsive:true,displaylogo:false,displayModeBar:false});return true;
}
function lineTraces(rows,group,value='value'){
  if(!group)return[];const times=uniq(rows.map(r=>+r.time).filter(Number.isFinite)).sort((a,b)=>a-b),ls=levels(rows,group).slice(0,10);
  if(times.length<2||!ls.length)return[];
  return ls.map((g,i)=>({type:'scatter',mode:'lines+markers',name:String(g),x:times,y:times.map(t=>med(rows.filter(r=>r[group]===g&&+r.time===t).map(r=>r[value]))),line:{width:2,color:color(i)},marker:{size:6,color:color(i)},connectgaps:false})).filter(t=>t.y.some(Number.isFinite));
}
function normalizedLineTraces(rows,group){return lineTraces(rows,group,'relative_to_control')}
function boxOrDot(rows,group,metric){
  if(!group||!metric)return[];const ls=levels(rows,group),valid=ls.map(g=>({g,v:finite(rows.filter(r=>r[group]===g).map(r=>r[metric]))})).filter(x=>x.v.length);
  if(!valid.length)return[];
  if(valid.length<=10)return valid.map((x,i)=>({type:'box',name:String(x.g),y:x.v,boxpoints:'all',jitter:.22,pointpos:0,marker:{size:5,color:color(i),opacity:.72},line:{color:color(i),width:1.4},fillcolor:'rgba(255,255,255,0)',hovertemplate:`${esc(metricName(metric))}=%{y:.4g}<extra>${esc(String(x.g))}</extra>`}));
  const s=valid.map(x=>({g:x.g,m:mean(x.v),n:x.v.length})).sort((a,b)=>a.m-b.m);
  return [{type:'scatter',mode:'markers',x:s.map(x=>x.m),y:s.map(x=>String(x.g)),marker:{size:8,color:'#315c45'},customdata:s.map(x=>x.n),hovertemplate:'%{y}<br>mean=%{x:.4g}<br>n=%{customdata}<extra></extra>'}];
}
function normalizedDistribution(rows,group,metric,cfg){
  if(!cfg.controlField)return[];const n=controlNormalize(rows,metric,cfg);return boxOrDot(n,group,'relative_to_control');
}
function effectTrace(tests){
  const a=(tests||[]).filter(r=>Number.isFinite(+r.q)&&Number.isFinite(+r.ratio)&&+r.ratio>0);if(!a.length)return[];
  const label=r=>[r.group,String(r.stratum||'').replaceAll('|',' · ')].filter(Boolean).join(' · '),top=[...a].sort((x,y)=>(+x.q)-(+y.q)||Math.abs(Math.log2(+y.ratio))-Math.abs(Math.log2(+x.ratio))).slice(0,5),keep=new Set(top);
  return [{type:'scatter',mode:'markers+text',x:a.map(r=>Math.log2(+r.ratio)),y:a.map(r=>-Math.log10(Math.max(+r.q,1e-12))),text:a.map(r=>keep.has(r)?label(r):''),textposition:'top center',textfont:{size:9,color:'#536058'},marker:{size:a.map(r=>keep.has(r)?10:7),color:a.map(r=>+r.q<.05?'#a85f47':'#6d8b64'),opacity:.8},customdata:a.map(r=>[label(r),+r.q,+r.hedges_g]),hovertemplate:'%{customdata[0]}<br>log2 relative=%{x:.3g}<br>q=%{customdata[1]:.3g}<br>Hedges g=%{customdata[2]:.3g}<extra></extra>'}];
}
function rankTrace(rows,group){
  const a=(rows||[]).filter(r=>Number.isFinite(+r.relative_fitness)).sort((x,y)=>x.relative_fitness-y.relative_fitness).slice(0,30);if(!a.length)return[];
  return [{type:'bar',orientation:'h',x:a.map(r=>+r.relative_fitness),y:a.map(r=>String(r.report_label??r[group]??r.rank)),marker:{color:a.map(r=>+r.relative_fitness<1?'#a85f47':'#6d8b64')},customdata:a.map(r=>r.median_robust_z),hovertemplate:'%{y}<br>relative=%{x:.3g}<br>robust Z=%{customdata:.3g}<extra></extra>'}];
}
function timeHeatmap(rows,group){
  const times=uniq(rows.map(r=>+r.time).filter(Number.isFinite)).sort((a,b)=>a-b),ls=levels(rows,group);if(times.length<2||ls.length<5||ls.length>24)return[];
  return [{type:'heatmap',x:times,y:ls,z:ls.map(g=>times.map(t=>med(rows.filter(r=>r[group]===g&&+r.time===t).map(r=>r.relative_to_control)))),zmid:1,colorscale:HEAT,colorbar:{title:'Rel.',thickness:12},hovertemplate:`${group}=%{y}<br>time=%{x}<br>relative=%{z:.3g}<extra></extra>`}];
}
function factorFields(rows,S,group){return (S.factors||[]).filter(f=>f&&f!==group&&rows.some(r=>Object.prototype.hasOwnProperty.call(r,f))&&levels(rows,f).length>1)}
function factorHeatmap(rows,a,b,value='value',title='Median'){
  if(!a||!b)return[];const al=levels(rows,a),bl=levels(rows,b);if(al.length<2||bl.length<2||al.length>30||bl.length>30)return[];
  return [{type:'heatmap',x:bl,y:al,z:al.map(x=>bl.map(y=>med(rows.filter(r=>r[a]===x&&r[b]===y).map(r=>r[value])))),colorscale:'YlGnBu',colorbar:{title,thickness:12},hovertemplate:`${a}=%{y}<br>${b}=%{x}<br>${title.toLowerCase()}=%{z:.3g}<extra></extra>`}];
}
function doseTrace(rows,dose,group,value='value',normalize=false){
  const ls=group?levels(rows,group):['all'];return ls.slice(0,10).map((g,i)=>{const rr=group?rows.filter(r=>r[group]===g):rows,d=uniq(rr.map(r=>+r[dose]).filter(Number.isFinite)).sort((a,b)=>a-b);if(d.length<2)return null;const baseline=med(rr.filter(r=>+r[dose]===d[0]).map(r=>r[value]));return{type:'scatter',mode:'lines+markers',name:String(g),x:d,y:d.map(x=>{const v=med(rr.filter(r=>+r[dose]===x).map(r=>r[value]));return normalize&&Number.isFinite(v)&&baseline?v/baseline:v}),line:{width:2,color:color(i)},marker:{size:6,color:color(i)}}}).filter(Boolean);
}
function competitionLogit(rows,group){
  const ls=group?levels(rows,group):['all'];return ls.slice(0,10).map((g,i)=>{const rr=group?rows.filter(r=>r[group]===g):rows,t=uniq(rr.map(r=>+r.time).filter(Number.isFinite)).sort((a,b)=>a-b);return{type:'scatter',mode:'lines+markers',name:String(g),x:t,y:t.map(x=>{const f=med(rr.filter(r=>+r.time===x).map(r=>r.value));return f>0&&f<1?Math.log(f/(1-f)):NaN}),line:{width:2,color:color(i)},marker:{size:6,color:color(i)}}}).filter(t=>t.y.some(Number.isFinite));
}
function selectionTrace(rows){
  const a=(rows||[]).filter(r=>Number.isFinite(+r.selection_coefficient_proxy));if(!a.length)return[];
  const labelKeys=a.length?Object.keys(a[0]).filter(k=>!['selection_coefficient_proxy','logit_trend_r2','n_timepoints'].includes(k)):[];
  const label=r=>labelKeys.map(k=>r[k]).filter(v=>v!==''&&v!=null).join(' · ')||'replicate';
  return [{type:'bar',orientation:'h',x:a.map(r=>+r.selection_coefficient_proxy),y:a.map(label),marker:{color:a.map(r=>+r.selection_coefficient_proxy<0?'#a85f47':'#315c45')},customdata:a.map(r=>r.logit_trend_r2),hovertemplate:'%{y}<br>s proxy=%{x:.4g}<br>R²=%{customdata:.3g}<extra></extra>'}];
}
function halfDoseTrace(rows){
  const a=(rows||[]).filter(r=>Number.isFinite(+r.half_response_dose));if(!a.length)return[];const keys=Object.keys(a[0]).filter(k=>!['baseline_response','extreme_response','half_response_target','half_response_dose','n_doses','direction'].includes(k));
  return [{type:'bar',orientation:'h',x:a.map(r=>+r.half_response_dose),y:a.map((r,i)=>keys.map(k=>r[k]).filter(Boolean).join(' · ')||String(i+1)),marker:{color:'#315c45'},hovertemplate:'%{y}<br>half-response dose=%{x:.4g}<extra></extra>'}];
}
function flaggedQcTrace(metrics){
  const counts=new Map();for(const r of metrics||[]){for(const f of String(r.qc_flags||'').split(/[;,|]/).map(x=>x.trim()).filter(Boolean))counts.set(f,(counts.get(f)||0)+1)}const a=[...counts].sort((x,y)=>x[1]-y[1]);if(!a.length)return[];
  return [{type:'bar',orientation:'h',x:a.map(x=>x[1]),y:a.map(x=>x[0].replaceAll('_',' ')),marker:{color:'#a85f47'},hovertemplate:'%{y}<br>flagged units=%{x}<extra></extra>'}];
}
function cvTrace(rows){const v=finite((rows||[]).map(r=>r.cv));return v.length>=3?[{type:'histogram',x:v,nbinsx:Math.min(12,Math.max(5,Math.ceil(Math.sqrt(v.length)))),marker:{color:'#6d8b64',line:{color:'#fff',width:1}},hovertemplate:'CV=%{x:.3g}<br>count=%{y}<extra></extra>'}]:[]}
function unequalNTrace(rows,group){
  if(!group)return[];const a=levels(rows,group).map(g=>({g,n:rows.filter(r=>r[group]===g).length}));if(a.length<2||new Set(a.map(x=>x.n)).size===1)return[];a.sort((x,y)=>x.n-y.n);
  return [{type:'bar',orientation:'h',x:a.map(x=>x.n),y:a.map(x=>String(x.g)),marker:{color:'#6d8b64'},hovertemplate:'%{y}<br>biological rows=%{x}<extra></extra>'}];
}
function correlationTrace(rows){
  if((rows||[]).length<8)return[];const ms=['mu_max','doubling_time','lag','auc','max_value','endpoint','trend_slope','absolute_change'].filter(m=>rows.filter(r=>Number.isFinite(+r[m])).length>=8);if(ms.length<3)return[];
  const corr=(a,b)=>{const p=rows.map(r=>[+r[a],+r[b]]).filter(([x,y])=>Number.isFinite(x)&&Number.isFinite(y));if(p.length<8)return NaN;const xm=mean(p.map(x=>x[0])),ym=mean(p.map(x=>x[1])),num=p.reduce((s,[x,y])=>s+(x-xm)*(y-ym),0),dx=Math.sqrt(p.reduce((s,[x])=>s+(x-xm)**2,0)),dy=Math.sqrt(p.reduce((s,[,y])=>s+(y-ym)**2,0));return dx&&dy?num/(dx*dy):NaN};
  return [{type:'heatmap',x:ms.map(metricName),y:ms.map(metricName),z:ms.map(a=>ms.map(b=>corr(a,b))),zmin:-1,zmax:1,zmid:0,colorscale:HEAT,colorbar:{title:'r',thickness:12},hovertemplate:'%{y} × %{x}<br>r=%{z:.3f}<extra></extra>'}];
}
function metricPlot(root,metrics,group,m,id=`viz_metric_${m}`){const tr=boxOrDot(metrics,group,m);if(!tr.length)return false;const lo=base(metricName(m));lo.xaxis.title=tr[0]?.type==='scatter'?'':group;lo.showlegend=false;return addCard(root,id,metricName(m),`Biological-level ${metricName(m).toLowerCase()} across ${group||'groups'}.`,tr,lo)}
function qcSection(grid,data,metrics,group,showCurveFlags=false){
  const cv=cvTrace(data.replicates),flags=showCurveFlags?flaggedQcTrace(metrics):[],n=unequalNTrace(metrics,group);if(!cv.length&&!flags.length&&!n.length)return;
  divider(grid,'Quality & replicate checks');
  if(cv.length){const lo=base('Count');lo.xaxis.title='Technical replicate CV';lo.showlegend=false;addCard(grid,'viz_cv','Technical replicate precision','Distribution of within-biological-replicate technical CV.',cv,lo,{compact:true})}
  if(flags.length){const lo=base('');lo.xaxis.title='Flagged units';lo.showlegend=false;addCard(grid,'viz_qc','QC flags','Only observed QC problems are shown; an all-clear chart is intentionally omitted.',flags,lo,{compact:true})}
  if(n.length){const lo=base('');lo.xaxis.title='Biological-level rows';lo.showlegend=false;addCard(grid,'viz_n','Unequal replicate coverage','Shown only because biological-level coverage differs among groups.',n,lo,{compact:true})}
}

export function renderVisualDashboard(root,{S,data,group,metric}){
  if(!root)return;root.innerHTML='';const preset=S.design.preset||'manual',points=data.inferencePoints||[],metrics=data.inferenceMetrics||S.metrics||[],normPoints=data.normalizedPoints||[],cfg={controlField:S.design.controlField||'',controlValue:S.design.controlValue||'control',strata:S.design.controlStrata||[]},hasTime=points.some(r=>Number.isFinite(+r.time)),primary=metric||['endpoint','auc','max_value','trend_slope'].find(m=>metrics.some(r=>Number.isFinite(+r[m])))||'',tests=data.metricTests?.length?data.metricTests:(data.timepointTests||[]),factors=factorFields(points.length?points:metrics,S,group);
  const intro=document.createElement('div');intro.className='visual-report-head';intro.innerHTML=`<div><span class="section-tag">VISUAL REPORT</span><h3>${esc(S.design.presetName||'Comprehensive analysis')}</h3><p>Each figure answers a distinct question. Empty, redundant, or low-information plots are automatically suppressed.</p></div><span>${esc(preset)}</span>`;root.appendChild(intro);const grid=document.createElement('div');grid.className='visual-grid';root.appendChild(grid);

  if(preset==='daily'){
    divider(grid,'Phenotype over time');
    const lo=base('Measurement');lo.xaxis.title=`Time (${S.design.timeUnit||'units'})`;addCard(grid,'viz_observed','Observed trajectory','Median biological measurement at each sampled timepoint.',lineTraces(points,group),lo,{wide:true});
    if(normPoints.length){const nlo=base('Relative to control');nlo.xaxis.title=`Time (${S.design.timeUnit||'units'})`;addCard(grid,'viz_normalized_time','Control-normalized trajectory','Same time course after contemporaneous control normalization.',normalizedLineTraces(normPoints,group),nlo,{wide:true});const ht=timeHeatmap(normPoints,group);if(ht.length){const hlo=base('');hlo.xaxis.title=`Time (${S.design.timeUnit||'units'})`;hlo.yaxis.title=group;addCard(grid,'viz_time_heatmap','Time × group fitness map','Compact view of relative phenotype across many groups and timepoints.',ht,hlo,{wide:true})}}
    divider(grid,'Longitudinal summaries');metricPlot(grid,metrics,group,'endpoint');metricPlot(grid,metrics,group,'auc','viz_serial_auc');metricPlot(grid,metrics,group,'trend_slope','viz_serial_trend_slope');
    const ef=effectTrace(tests);if(ef.length){const elo=base('-log10(q)');elo.xaxis.title='log2 relative phenotype';addCard(grid,'viz_effects','Relative effect & FDR','Magnitude and multiplicity-adjusted evidence for control comparisons.',ef,elo,{wide:true})}
    qcSection(grid,data,metrics,group,preset==='kinetic');return;
  }

  if(preset==='endpoint'||preset==='manual'){
    divider(grid,'Phenotype & evidence');if(primary)metricPlot(grid,metrics,group,primary,'viz_primary');
    if(cfg.controlField&&primary){const tr=normalizedDistribution(metrics,group,primary,cfg);if(tr.length){const lo=base('Relative to control');lo.showlegend=false;addCard(grid,'viz_normalized','Control-normalized phenotype','Biological-level phenotype relative to the selected control.',tr,lo)}}
    const ef=effectTrace(tests);if(ef.length){const lo=base('-log10(q)');lo.xaxis.title='log2 relative phenotype';addCard(grid,'viz_effects','Relative effect & FDR','Control comparisons summarized by effect size and adjusted evidence.',ef,lo,{wide:true})}
    if(preset==='manual'&&factors.length>=1&&group){const tr=factorHeatmap(points.length?points:metrics,group,factors[0],points.length?'value':primary,'Median');if(tr.length){const lo=base('');lo.xaxis.title=factors[0];lo.yaxis.title=group;addCard(grid,'viz_factorial','Factorial landscape','Median phenotype across the first two detected experimental factors.',tr,lo,{wide:true})}}
    qcSection(grid,data,metrics,group,preset==='kinetic');return;
  }

  if(preset==='screen'){
    divider(grid,'Screen prioritization');const rk=rankTrace(data.ranking,group);if(rk.length){const lo=base('');lo.xaxis.title='Relative phenotype';lo.showlegend=false;addCard(grid,'viz_rank','Ranked relative phenotype','Candidates ordered by control-normalized biological phenotype.',rk,lo,{wide:true})}
    const ef=effectTrace(tests);if(ef.length){const lo=base('-log10(q)');lo.xaxis.title='log2 relative phenotype';addCard(grid,'viz_effects','Relative effect & FDR','Separates large effects from statistically supported effects.',ef,lo,{wide:true})}
    qcSection(grid,data,metrics,group,preset==='kinetic');return;
  }

  if(preset==='matrix'){
    divider(grid,'Genotype × condition');const condition=factors.find(f=>/condition|medium|media|treatment|drug|carbon|stress|environment/i.test(f))||factors[0];
    const raw=factorHeatmap(points.length?points:metrics,group,condition,points.length?'value':primary,'Median');if(raw.length){const lo=base('');lo.xaxis.title=condition;lo.yaxis.title=group;addCard(grid,'viz_factorial','Phenotype landscape','Raw biological phenotype across genotype and condition.',raw,lo,{wide:true})}
    if(normPoints.length&&condition){const rel=factorHeatmap(normPoints,group,condition,'relative_to_control','Relative');if(rel.length){const lo=base('');lo.xaxis.title=condition;lo.yaxis.title=group;addCard(grid,'viz_matrix_relative','Control-normalized landscape','Condition-aware relative phenotype without pooling across environments.',rel,lo,{wide:true})}}
    const ef=effectTrace(tests);if(ef.length){const lo=base('-log10(q)');lo.xaxis.title='log2 relative phenotype';addCard(grid,'viz_effects','Condition-specific effects','Effect size and FDR across genotype-by-condition comparisons.',ef,lo,{wide:true})}
    qcSection(grid,data,metrics,group,preset==='kinetic');return;
  }

  if(preset==='evolution'){
    divider(grid,'Evolution through time');const lo=base('Measurement');lo.xaxis.title=`Time (${S.design.timeUnit||'units'})`;addCard(grid,'viz_observed','Evolution trajectories','Median phenotype through passages or generations.',lineTraces(points,group),lo,{wide:true});
    if(normPoints.length){const nlo=base('Relative to control');nlo.xaxis.title=`Time (${S.design.timeUnit||'units'})`;addCard(grid,'viz_normalized_time','Relative trajectory','Trajectory relative to the contemporaneous reference.',normalizedLineTraces(normPoints,group),nlo,{wide:true})}
    divider(grid,'Adaptation summaries');metricPlot(grid,metrics,group,'endpoint');metricPlot(grid,metrics,group,'trend_slope');const ef=effectTrace(tests);if(ef.length){const elo=base('-log10(q)');elo.xaxis.title='log2 relative phenotype';addCard(grid,'viz_effects','Relative effect & FDR','Integrated evidence for evolved-line differences.',ef,elo,{wide:true})}qcSection(grid,data,metrics,group,preset==='kinetic');return;
  }

  if(preset==='dose'){
    const dose=(S.factors||[]).find(x=>/dose|concentration|conc/i.test(x));divider(grid,'Dose dependence');if(dose){const source=points.length?points:metrics,lo=base('Response');lo.xaxis.title=dose;addCard(grid,'viz_dose','Dose-response profile','Median biological response at each observed concentration.',doseTrace(source,dose,group),lo,{wide:true});const nlo=base('Relative to lowest dose');nlo.xaxis.title=dose;addCard(grid,'viz_dose_normalized','Normalized dose-response','Within-group response relative to the lowest observed dose.',doseTrace(source,dose,group,'value',true),nlo,{wide:true});if(levels(source,group).length>=3){const ht=factorHeatmap(source,group,dose,'value','Response');if(ht.length){const hlo=base('');hlo.xaxis.title=dose;hlo.yaxis.title=group;addCard(grid,'viz_dose_heatmap','Genotype × dose map','Compact response landscape when several groups are compared.',ht,hlo,{wide:true})}}}
    const hd=halfDoseTrace(data.dose);if(hd.length){const lo=base('');lo.xaxis.title='Half-response dose';lo.showlegend=false;addCard(grid,'viz_halfdose','Half-response estimates','Observed-range midpoint estimates; descriptive rather than a fitted EC50.',hd,lo)}qcSection(grid,data,metrics,group,preset==='kinetic');return;
  }

  if(preset==='competition'){
    divider(grid,'Competition dynamics');const lo=base('Focal frequency');lo.xaxis.title=`Time (${S.design.timeUnit||'units'})`;addCard(grid,'viz_observed','Frequency trajectory','Observed focal-strain frequency through time.',lineTraces(points,group),lo,{wide:true});const lg=competitionLogit(points,group);if(lg.length){const llo=base('logit(frequency)');llo.xaxis.title=`Time (${S.design.timeUnit||'units'})`;addCard(grid,'viz_competition_logit','Logit-frequency trajectory','Linearized frequency view used for the selection-coefficient proxy.',lg,llo,{wide:true})}const st=selectionTrace(data.competition);if(st.length){const slo=base('');slo.xaxis.title='Selection-coefficient proxy';slo.showlegend=false;addCard(grid,'viz_selection','Selection proxy by replicate','Slope of logit frequency versus time for each biological trajectory.',st,slo,{wide:true})}qcSection(grid,data,metrics,group,preset==='kinetic');return;
  }

  if(preset==='kinetic'){
    divider(grid,'Growth kinetics');const lo=base('Measurement');lo.xaxis.title=`Time (${S.design.timeUnit||'units'})`;addCard(grid,'viz_observed','Growth trajectories','Median biological growth curves across groups.',lineTraces(points,group),lo,{wide:true});
    divider(grid,'Kinetic parameters');['mu_max','doubling_time','lag','auc'].forEach(m=>metricPlot(grid,metrics,group,m));const cr=correlationTrace(metrics);if(cr.length){const clo=base('');clo.xaxis.title='Metric';clo.yaxis.title='Metric';addCard(grid,'viz_metric_correlations','Metric relationships','Correlation among distinct kinetic summaries when enough biological observations are available.',cr,clo,{wide:true})}qcSection(grid,data,metrics,group,preset==='kinetic');return;
  }

  divider(grid,'Phenotype summary');if(hasTime&&group){const lo=base('Measurement');lo.xaxis.title=`Time (${S.design.timeUnit||'units'})`;addCard(grid,'viz_observed','Observed trajectory','Biological-level measurements through time.',lineTraces(points,group),lo,{wide:true})}if(primary)metricPlot(grid,metrics,group,primary,'viz_primary');const ef=effectTrace(tests);if(ef.length){const lo=base('-log10(q)');lo.xaxis.title='log2 relative phenotype';addCard(grid,'viz_effects','Relative effect & FDR','Control comparisons with adjusted evidence.',ef,lo,{wide:true})}qcSection(grid,data,metrics,group,preset==='kinetic');
}
