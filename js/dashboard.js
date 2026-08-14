import { median } from './stats.js';

const uniq=a=>[...new Set(a.filter(v=>v!==''&&v!=null))];
const finite=a=>a.map(Number).filter(Number.isFinite);
const med=a=>{const v=finite(a);return v.length?median(v):NaN};
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const base=(y='')=>({margin:{l:55,r:18,t:12,b:52},paper_bgcolor:'white',plot_bgcolor:'white',font:{family:'Inter, sans-serif',color:'#304035',size:11},xaxis:{gridcolor:'#eee',zeroline:false},yaxis:{title:y,gridcolor:'#eee',zeroline:false},legend:{orientation:'h',y:-.2},hovermode:'closest'});
function card(root,id,title,desc,wide=false){const el=document.createElement('section');el.className=`visual-card${wide?' visual-wide':''}`;el.innerHTML=`<div class="visual-card-head"><div><h4>${esc(title)}</h4><p>${esc(desc)}</p></div><button class="ghost small visual-save" data-plot="${id}">SVG</button></div><div id="${id}" class="visual-plot"></div>`;root.appendChild(el);return el.querySelector('.visual-plot');}
function plot(el,traces,layout){if(!el||!window.Plotly||!traces?.length)return false;Plotly.react(el,traces,layout,{responsive:true,displaylogo:false,modeBarButtonsToRemove:['lasso2d','select2d']});return true;}
function groupLevels(rows,field){return field?uniq(rows.map(r=>r[field])):[];}
function groupSummary(rows,group,time,value='value'){const out=[];for(const g of groupLevels(rows,group))for(const t of uniq(rows.map(r=>+r[time]).filter(Number.isFinite)).sort((a,b)=>a-b)){const v=rows.filter(r=>r[group]===g&&+r[time]===t).map(r=>+r[value]);if(finite(v).length)out.push({group:g,time:t,median:med(v)});}return out;}
function boxTraces(rows,group,metric){return groupLevels(rows,group).map(g=>({type:'box',name:String(g),y:finite(rows.filter(r=>r[group]===g).map(r=>r[metric])),boxpoints:'all',jitter:.25,pointpos:0,marker:{size:5}})).filter(t=>t.y.length);}
function lineTraces(rows,group,time,value='value'){const s=groupSummary(rows,group,time,value);return groupLevels(s,'group').map(g=>({type:'scatter',mode:'lines+markers',name:String(g),x:s.filter(r=>r.group===g).map(r=>r.time),y:s.filter(r=>r.group===g).map(r=>r.median),line:{width:2},marker:{size:7}}));}
function effectScatter(tests){const rows=tests.filter(r=>Number.isFinite(+r.hedges_g)&&Number.isFinite(+r.q));return rows.length?[{type:'scatter',mode:'markers+text',x:rows.map(r=>+r.hedges_g),y:rows.map(r=>-Math.log10(Math.max(+r.q,1e-12))),text:rows.map(r=>String(r.group)),textposition:'top center',marker:{size:9},hovertemplate:'%{text}<br>Hedges g=%{x:.3g}<br>-log10(q)=%{y:.3g}<extra></extra>'}]:[];}
function cvHistogram(rows){const v=finite(rows.map(r=>r.cv));return v.length?[{type:'histogram',x:v,nbinsx:16,hovertemplate:'CV=%{x:.3g}<br>count=%{y}<extra></extra>'}]:[];}
function rankTrace(rows,group){const a=rows.filter(r=>Number.isFinite(+r.relative_fitness)).slice().sort((x,y)=>x.relative_fitness-y.relative_fitness).slice(0,30);return a.length?[{type:'bar',x:a.map(r=>String(r[group]??r.rank)),y:a.map(r=>+r.relative_fitness),customdata:a.map(r=>r.median_robust_z),hovertemplate:'%{x}<br>relative=%{y:.3g}<br>robust Z=%{customdata:.3g}<extra></extra>'}]:[];}
function serialHeatmap(rows,group){const times=uniq(rows.map(r=>+r.time).filter(Number.isFinite)).sort((a,b)=>a-b),levels=groupLevels(rows,group);if(!times.length||!levels.length)return[];return[{type:'heatmap',x:times,y:levels,z:levels.map(g=>times.map(t=>med(rows.filter(r=>r[group]===g&&+r.time===t).map(r=>r.relative_to_control)))),zmid:1,colorbar:{title:'Rel.'},hovertemplate:`${group}=%{y}<br>time=%{x}<br>relative=%{z:.3g}<extra></extra>`}];}
function factorialHeatmap(rows){if(!rows?.length)return[];const meta=Object.keys(rows[0]).filter(k=>!['n','mean','median','sd','sem','ci95_low','ci95_high','cv','min','max'].includes(k));if(meta.length<2)return[];const [a,b]=meta,al=uniq(rows.map(r=>r[a])),bl=uniq(rows.map(r=>r[b]));return[{type:'heatmap',x:bl,y:al,z:al.map(x=>bl.map(y=>rows.find(r=>r[a]===x&&r[b]===y)?.median??NaN)),colorbar:{title:'Median'},hovertemplate:`${a}=%{y}<br>${b}=%{x}<br>median=%{z:.3g}<extra></extra>`}];}
function doseTraces(rows,dose,group){const levels=group?groupLevels(rows,group):['all'];return levels.map(g=>{const rr=group?rows.filter(r=>r[group]===g):rows,d=uniq(rr.map(r=>+r[dose]).filter(Number.isFinite)).sort((a,b)=>a-b);return{type:'scatter',mode:'lines+markers',name:String(g),x:d,y:d.map(x=>med(rr.filter(r=>+r[dose]===x).map(r=>r.value))),line:{width:2},marker:{size:7}}});}
function competitionLogit(rows,group){const levels=group?groupLevels(rows,group):['all'];return levels.map(g=>{const rr=group?rows.filter(r=>r[group]===g):rows,t=uniq(rr.map(r=>+r.time).filter(Number.isFinite)).sort((a,b)=>a-b);return{type:'scatter',mode:'lines+markers',name:String(g),x:t,y:t.map(x=>{const f=med(rr.filter(r=>+r.time===x).map(r=>r.value));return f>0&&f<1?Math.log(f/(1-f)):NaN;}),line:{width:2},marker:{size:7}}});}
function selectionBars(rows){const field=Object.keys(rows[0]||{}).find(k=>/strain|genotype|line/i.test(k));return rows.length?[{type:'bar',x:rows.map((r,i)=>String(field?r[field]:i+1)),y:rows.map(r=>+r.selection_coefficient_proxy)}]:[];}
function metricGrid(root,S,group){const metrics=['mu_max','doubling_time','lag','auc','max_value','endpoint'].filter(m=>S.metrics.some(r=>Number.isFinite(+r[m])));for(const m of metrics){const el=card(root,`viz_metric_${m}`,m.replaceAll('_',' '),`Distribution of ${m.replaceAll('_',' ')} across biological groups.`);const lo=base(m.replaceAll('_',' '));lo.xaxis.title=group;lo.showlegend=false;plot(el,boxTraces(S.metrics,group,m),lo);}}

export function renderVisualDashboard(root,{S,data,group,metric}){
  if(!root)return;root.innerHTML='';
  const preset=S.design.preset||'manual',points=data.inferencePoints||[],norm=data.normalizedPoints||[],tests=data.metricTests?.length?data.metricTests:data.timepointTests||[];
  const intro=document.createElement('div');intro.className='visual-report-head';intro.innerHTML=`<div><span class="section-tag">VISUAL REPORT</span><h3>${esc(S.design.presetName||'Custom analysis')}</h3><p>Multiple complementary views are shown because no single plot can represent trajectory, magnitude, uncertainty, controls, and QC at the same time.</p></div><span>${preset==='manual'?'custom':preset}</span>`;root.appendChild(intro);
  const grid=document.createElement('div');grid.className='visual-grid';root.appendChild(grid);

  if(points.some(r=>Number.isFinite(+r.time))&&group){const el=card(grid,'viz_raw','Observed trajectories','Median biological-level measurement at each sampled timepoint.');const lo=base('Measurement');lo.xaxis.title=`Time (${S.design.timeUnit||'units'})`;plot(el,lineTraces(points,group,'time','value'),lo);}
  if(norm.length&&group){const el=card(grid,'viz_norm','Control-normalized trajectories','Each timepoint relative to its contemporaneous matched control.');const lo=base('Relative to control');lo.xaxis.title=`Time (${S.design.timeUnit||'units'})`;plot(el,lineTraces(norm,group,'time','relative_to_control'),lo);}

  if(['daily','evolution'].includes(preset)&&group){
    const end=card(grid,'viz_endpoint','Endpoint distribution','Biological-level endpoint values, with individual observations.');let lo=base('Endpoint');lo.xaxis.title=group;lo.showlegend=false;plot(end,boxTraces(S.metrics,group,'endpoint'),lo);
    const auc=card(grid,'viz_auc','Integrated phenotype','AUC across sparse sampled timepoints. This summarizes total exposure to the phenotype, not growth rate.');lo=base('AUC');lo.xaxis.title=group;lo.showlegend=false;plot(auc,boxTraces(S.metrics,group,'auc'),lo);
    if(norm.length){const hm=card(grid,'viz_time_heatmap','Effect map across time','Median relative phenotype by group and sampled timepoint.',true);lo=base();lo.xaxis.title=`Time (${S.design.timeUnit||'units'})`;lo.yaxis.title=group;plot(hm,serialHeatmap(norm,group),lo);}
  }
  if(['endpoint','manual'].includes(preset)&&group){
    const e=card(grid,'viz_endpoint_box','Group distributions','Raw endpoint distributions with biological observations.');let lo=base('Endpoint');lo.xaxis.title=group;lo.showlegend=false;plot(e,boxTraces(S.metrics,group,metric||'endpoint'),lo);
    if(data.ranking.length){const r=card(grid,'viz_endpoint_rel','Relative phenotype','Groups ranked after matched-control normalization.');lo=base('Relative phenotype');lo.xaxis.title=group;plot(r,rankTrace(data.ranking,group),lo);}
  }
  if(preset==='screen'&&group){
    const r=card(grid,'viz_rank','Ranked screen','Lowest relative phenotypes first; use with replicate consistency and effect size.','wide');let lo=base('Relative phenotype');lo.xaxis.tickangle=-55;plot(r,rankTrace(data.ranking,group),lo);
    const sc=card(grid,'viz_screen_scatter','Screen effect landscape','Relative phenotype versus robust Z score for candidate prioritization.');const a=data.ranking.filter(x=>Number.isFinite(+x.relative_fitness)&&Number.isFinite(+x.median_robust_z));lo=base('Robust Z');lo.xaxis.title='Relative phenotype';plot(sc,a.length?[{type:'scatter',mode:'markers+text',x:a.map(x=>+x.relative_fitness),y:a.map(x=>+x.median_robust_z),text:a.map(x=>String(x[group])),textposition:'top center',marker:{size:8}}]:[],lo);
  }
  if(preset==='matrix'){
    const h=card(grid,'viz_matrix','Genotype × condition landscape','Heatmap of median phenotype across the first two experimental factors.',true);let lo=base('');plot(h,factorialHeatmap(data.factorial),lo);
    if(group){const b=card(grid,'viz_matrix_groups','Group distributions','Biological-level phenotype across genotypes or strains.');lo=base(metric||'endpoint');lo.xaxis.title=group;lo.showlegend=false;plot(b,boxTraces(S.metrics,group,metric||'endpoint'),lo);}
  }
  if(preset==='dose'){
    const dose=(S.factors||[]).find(x=>/dose|concentration|conc/i.test(x));if(dose){const d=card(grid,'viz_dose','Dose-response curves','Median response at each observed concentration.',true);let lo=base('Response');lo.xaxis.title=dose;plot(d,doseTraces(points.length?points:S.metrics,dose,group),lo);}
    if(data.dose.length){const d=card(grid,'viz_halfdose','Half-response estimates','Interpolated midpoint dose for each supported group.');let lo=base('Half-response dose');const label=Object.keys(data.dose[0]).find(k=>!['baseline_response','extreme_response','half_response_target','half_response_dose','n_doses','direction'].includes(k));plot(d,[{type:'bar',x:data.dose.map((x,i)=>String(label?x[label]:i+1)),y:data.dose.map(x=>+x.half_response_dose)}],lo);}
  }
  if(preset==='competition'){
    const f=card(grid,'viz_comp_freq','Competition frequency','Median focal-strain frequency through time.',true);let lo=base('Frequency');lo.xaxis.title=`Time (${S.design.timeUnit||'units'})`;plot(f,lineTraces(points,group,'time','value'),lo);
    const l=card(grid,'viz_comp_logit','Logit-frequency trajectories','A straight trend in logit frequency is the basis of the selection-coefficient proxy.');lo=base('logit(frequency)');lo.xaxis.title=`Time (${S.design.timeUnit||'units'})`;plot(l,competitionLogit(points,group),lo);
    if(data.competition.length){const s=card(grid,'viz_selection','Selection coefficient proxy','Slope of logit frequency versus time for each competition unit.');lo=base('Selection coefficient proxy');plot(s,selectionBars(data.competition),lo);}
  }
  if(preset==='kinetic'&&group)metricGrid(grid,S,group);

  if(tests.length){const e=card(grid,'viz_effects','Effect size and statistical strength','Hedges’ g versus FDR-adjusted statistical strength. Interpret effect size and q together.');let lo=base('-log10(q)');lo.xaxis.title='Hedges’ g';plot(e,effectScatter(tests),lo);}
  if(data.replicates.length){const q=card(grid,'viz_cv','Technical-replicate precision','Distribution of technical-replicate coefficient of variation.');let lo=base('Count');lo.xaxis.title='Technical replicate CV';plot(q,cvHistogram(data.replicates),lo);}
  if(data.ranking.length&& !['screen'].includes(preset) && group){const r=card(grid,'viz_ranking','Ranked relative phenotype','Control-normalized ranking provides a complementary magnitude view.');let lo=base('Relative phenotype');lo.xaxis.tickangle=-45;plot(r,rankTrace(data.ranking,group),lo);}

  root.querySelectorAll('.visual-save').forEach(b=>b.onclick=()=>window.Plotly&&Plotly.downloadImage(b.dataset.plot,{format:'svg',filename:`JhuangLab_YeastFit_${b.dataset.plot}`,height:650,width:950}));
  if(!grid.querySelector('.visual-plot'))grid.innerHTML='<div class="analysis-empty">No plot-compatible variables were detected. Review the mapping or use Manual / custom.</div>';
}
