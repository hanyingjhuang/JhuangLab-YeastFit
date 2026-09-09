const api=window.YeastFit;
const S=api?.S;
const $=s=>document.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uniq=a=>[...new Set(a.filter(v=>v!==''&&v!=null))];
const missingToken=v=>v==null||/^\s*$|^na$|^n\/a$|^nan$|^null$|^none$|^missing$|^\.$|^-$|^nd$/i.test(String(v).trim());
const wellRe=/^[A-Pa-p]0?([1-9]|1[0-9]|2[0-4])$/;
const records=()=>S.qualityExclusions||(S.qualityExclusions=[]);
let manualIds=new Set();
let initialized=false;

function field(rows,re){return rows?.length?Object.keys(rows[0]).find(k=>re.test(k))||'':''}
function mappedField(id,re,rows){const v=$(id)?.value;return v&&rows?.some(r=>Object.prototype.hasOwnProperty.call(r,v))?v:field(rows,re)}
function currentRows(){return S?.meta?.length?S.meta:S?.raw||[]}
function candidates(){
  const rows=currentRows(),out=new Map();
  const sf=mappedField('#sampleField',/^sample$|sample_id|strain_id|culture_id|clone_id/i,rows);
  const wf=mappedField('#wellField',/^well$|well_id|position/i,rows);
  const pf=mappedField('#plateField',/^plate$|batch|run/i,rows);
  for(const r of rows){
    const sample=sf?String(r[sf]??'').trim():'',well=wf?String(r[wf]??'').trim():'',plate=pf?String(r[pf]??'').trim():'';
    if(sample){const k=`sample|${sample}`;if(!out.has(k))out.set(k,{scope:'sample',key:sample,label:[sample,well&&`well ${well}`,plate&&plate].filter(Boolean).join(' · ')});}
    if(well){const k=`well|${well}`;if(!out.has(k))out.set(k,{scope:'well',key:well,label:[`Well ${well}`,sample,plate].filter(Boolean).join(' · ')});}
  }
  if(!out.size&&S?.raw?.length){for(const h of Object.keys(S.raw[0]))if(wellRe.test(h.trim()))out.set(`well|${h.trim()}`,{scope:'well',key:h.trim(),label:`Well ${h.trim()}`});}
  return [...out.values()].sort((a,b)=>a.label.localeCompare(b.label,undefined,{numeric:true}));
}
function missingSummary(){
  const rows=S?.raw||[];if(!rows.length)return{missing:0,total:0,percent:0,label:'No data loaded'};
  const vf=$('#valueField')?.value||field(rows,/^value$|od600|^od$|absorbance|signal|fitness|growth|measurement/i);
  let vals=[];
  if(vf)vals=rows.map(r=>r[vf]);
  else{const wells=Object.keys(rows[0]).filter(h=>wellRe.test(h.trim()));if(wells.length)vals=rows.flatMap(r=>wells.map(h=>r[h]));}
  if(!vals.length)return{missing:0,total:0,percent:0,label:'Measurement field not mapped yet'};
  const missing=vals.filter(missingToken).length,total=vals.length,percent=total?100*missing/total:0;
  return{missing,total,percent,label:`${missing} of ${total} measurements missing (${percent.toFixed(percent<1?1:0)}%)`};
}
function parseManual(){const ta=$('#excludedIds');if(!ta)return;manualIds=new Set(ta.value.split(/[\n,;]+/).map(x=>x.trim()).filter(Boolean).filter(x=>!records().some(r=>r.key===x)))}
function sync(){
  const ta=$('#excludedIds');if(ta){const ids=uniq([...manualIds,...records().map(r=>r.key)]);ta.value=ids.join('\n');ta.dispatchEvent(new Event('input',{bubbles:true}));}
  S.design.qualityExclusions=records().map(r=>({...r}));
  S.design.missingDataPolicy='Missing values remain missing; no automatic imputation; explicit missing gaps are not bridged for AUC or threshold interpolation.';
  render();
}
function addRecord(target,status,reason,source='manual'){
  if(!target?.key)return;const a=records(),existing=a.find(r=>r.key===target.key&&r.scope===target.scope);
  const next={scope:target.scope,key:target.key,label:target.label||target.key,status,reason:reason||status,source,marked_at:new Date().toISOString()};
  if(existing)Object.assign(existing,next);else a.push(next);sync();
}
function removeRecord(i){records().splice(i,1);sync()}
function detectMetadataFlags(){
  const rows=currentRows();if(!rows.length)return;
  const qf=field(rows,/^(contaminated|contamination|exclude|excluded|qc_status|quality_status|sample_status)$/i);if(!qf)return;
  const rf=field(rows,/^(exclusion_reason|qc_reason|quality_reason|reason)$/i);
  const sf=mappedField('#sampleField',/^sample$|sample_id|strain_id|culture_id|clone_id/i,rows),wf=mappedField('#wellField',/^well$|well_id|position/i,rows);
  for(const r of rows){const v=String(r[qf]??'').trim();if(!/^(1|true|yes|y|contaminated|exclude|excluded|bad|fail|failed|invalid|remove)$/i.test(v))continue;const sample=sf?String(r[sf]??'').trim():'',well=wf?String(r[wf]??'').trim():'';const target=sample?{scope:'sample',key:sample,label:sample}:well?{scope:'well',key:well,label:`Well ${well}`}:null;if(target&&!records().some(x=>x.key===target.key&&x.scope===target.scope))addRecord(target,/contamin/i.test(v)?'contaminated':'excluded',rf?String(r[rf]||'Metadata quality flag'):'Metadata quality flag','metadata');}
}
function csv(rows){if(!rows.length)return'';const h=uniq(rows.flatMap(Object.keys)),q=v=>{const s=String(v??'');return /[",\n]/.test(s)?`"${s.replace(/"/g,'""')}"`:s};return[h.join(','),...rows.map(r=>h.map(k=>q(r[k])).join(','))].join('\n')}
function downloadLog(){const ms=missingSummary(),rows=[...records().map(r=>({record_type:'exclusion',...r})),{record_type:'missing_data_summary',scope:'dataset',key:'',label:ms.label,status:'observed',reason:S.design.missingDataPolicy||'',source:'YeastFit',marked_at:new Date().toISOString()}];const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv(rows)],{type:'text/csv'}));a.download='YeastFit_data_quality_log.csv';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),500)}
function render(){
  const root=$('#dataQualityManager');if(!root)return;const cs=candidates(),ms=missingSummary(),current=root.querySelector('#dqTarget')?.value||'',search=root.querySelector('#dqSearch')?.value||'';
  root.innerHTML=`<div class="dq-summary"><div><small>Missing data</small><b>${esc(ms.label)}</b><span>Missing values are never converted to zero or silently imputed.</span></div><div><small>Excluded / contaminated</small><b>${records().length}</b><span>Marked units remain in the audit log and can be restored.</span></div></div>
  <div class="dq-controls"><label>Find sample or well<input id="dqSearch" value="${esc(search)}" placeholder="Type a sample, strain, well…"></label><label>Target<select id="dqTarget"><option value="">Choose a sample or well</option>${cs.filter(x=>!search||x.label.toLowerCase().includes(search.toLowerCase())).map(x=>`<option value="${esc(`${x.scope}|${x.key}`)}" ${`${x.scope}|${x.key}`===current?'selected':''}>${esc(x.label)}</option>`).join('')}</select></label><label>Reason<select id="dqReason"><option>Contamination</option><option>Pipetting error</option><option>Plate artifact</option><option>Mislabeled sample</option><option>Instrument issue</option><option>Other quality concern</option></select></label><div class="dq-buttons"><button type="button" class="secondary" id="dqContaminate">Mark contaminated</button><button type="button" class="ghost" id="dqExclude">Exclude</button></div></div>
  <div class="dq-list">${records().length?records().map((r,i)=>`<div class="dq-record ${r.status==='contaminated'?'is-contaminated':''}"><div><span class="dq-badge">${esc(r.status==='contaminated'?'CONTAMINATED':'EXCLUDED')}</span><b>${esc(r.label||r.key)}</b><small>${esc(r.reason)} · ${esc(r.scope)}${r.source==='metadata'?' · from metadata':''}</small></div><button type="button" class="ghost small" data-dq-restore="${i}">Restore</button></div>`).join(''):'<div class="dq-empty">No samples are currently excluded.</div>'}</div>
  <details class="dq-advanced"><summary>Advanced manual IDs</summary><p class="muted">Paste curve IDs, sample IDs, or wells. These are combined with the marked records above.</p></details><button type="button" class="ghost small" id="dqDownload">Download quality log</button>`;
  const adv=root.querySelector('.dq-advanced');const ta=$('#excludedIds');if(ta){adv.appendChild(ta);ta.style.display='block';ta.oninput=()=>parseManual();}
  root.querySelector('#dqSearch').oninput=e=>{const v=e.target.value;setTimeout(()=>{const x=$('#dqSearch');if(x)x.value=v;render()},0)};
  const getTarget=()=>{const v=root.querySelector('#dqTarget').value;if(!v)return null;const [scope,...rest]=v.split('|'),key=rest.join('|');return cs.find(x=>x.scope===scope&&x.key===key)||{scope,key,label:key}};
  root.querySelector('#dqContaminate').onclick=()=>{const t=getTarget();if(t)addRecord(t,'contaminated','Contamination')};
  root.querySelector('#dqExclude').onclick=()=>{const t=getTarget();if(t)addRecord(t,'excluded',root.querySelector('#dqReason').value)};
  root.querySelectorAll('[data-dq-restore]').forEach(b=>b.onclick=()=>removeRecord(+b.dataset.dqRestore));
  root.querySelector('#dqDownload').onclick=downloadLog;
}
function install(){
  if(initialized||!S)return;const old=$('#excludedIds')?.closest('.subcard');if(!old)return;initialized=true;parseManual();
  old.innerHTML='<h3>Data quality</h3><p class="muted">Missing values are handled explicitly. Mark contaminated samples or other exclusions here without deleting the original observations.</p><div id="dataQualityManager"></div>';
  const exp=$('.step-panel[data-panel="6"] .export-grid');if(exp&&!$('#qualityLogExport')){const b=document.createElement('button');b.id='qualityLogExport';b.className='export-card';b.innerHTML='<b>Data quality log</b><span>CSV</span><small>Missing-data policy, contaminated samples, exclusions, reasons, and provenance.</small>';b.onclick=downloadLog;exp.appendChild(b)}
  const style=document.createElement('style');style.id='dqStyle';style.textContent='.dq-summary{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:10px 0}.dq-summary>div{border:1px solid var(--line);border-radius:10px;padding:10px;background:#fafbf8}.dq-summary small,.dq-summary span{display:block;color:var(--muted);font-size:10px}.dq-summary b{display:block;font-size:13px;margin:2px 0}.dq-controls{display:grid;grid-template-columns:1fr 1.25fr 1fr;gap:8px;align-items:end}.dq-controls label{margin:0!important}.dq-buttons{display:flex;gap:6px;grid-column:1/-1}.dq-list{margin:10px 0}.dq-record{display:flex;justify-content:space-between;gap:10px;align-items:center;border-top:1px solid #eee;padding:8px 0}.dq-record>div{min-width:0}.dq-record b,.dq-record small{display:block}.dq-record small{color:var(--muted);font-size:10px}.dq-badge{display:inline-block;font-size:9px;font-weight:850;letter-spacing:.06em;padding:2px 6px;border-radius:999px;background:#eee;color:#58635b;margin-right:6px}.dq-record.is-contaminated .dq-badge{background:#f4ddd5;color:#8a4938}.dq-empty{font-size:11px;color:var(--muted);padding:8px 0}.dq-advanced{margin:8px 0}.dq-advanced textarea{width:100%;margin-top:8px}.export-grid #qualityLogExport{display:flex}@media(max-width:700px){.dq-summary,.dq-controls{grid-template-columns:1fr}.dq-buttons{grid-column:auto}}';document.head.appendChild(style);
  detectMetadataFlags();render();
  new MutationObserver(()=>{detectMetadataFlags();render()}).observe($('#fileList')||document.body,{childList:true,subtree:true});
  document.addEventListener('change',e=>{if(['sampleField','wellField','plateField','valueField'].includes(e.target?.id)){detectMetadataFlags();render()}});
}
setTimeout(install,0);
export {missingToken,missingSummary};
