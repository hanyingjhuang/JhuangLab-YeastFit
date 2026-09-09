const api=window.YeastFit;
const S=api?.S;
const $=s=>document.querySelector(s);
const normWell=v=>{const s=String(v??'').trim().toUpperCase().replace(/\s+/g,'');const m=s.match(/^([A-P])0?([1-9]|1[0-9]|2[0-4])$/);return m?`${m[1]}${Number(m[2])}`:s};
const findField=(rows,re)=>rows?.length?Object.keys(rows[0]).find(k=>re.test(k))||'':'';
const mapped=(id,rows,re)=>{const x=$(id)?.value;return x&&rows?.some(r=>Object.prototype.hasOwnProperty.call(r,x))?x:findField(rows,re)};

function filteredRaw(){
  const rows=S?.raw||[],flags=S?.qualityExclusions||[];
  if(!rows.length||!flags.length)return rows;
  const rawSample=mapped('#sampleField',rows,/^sample$|sample_id|strain_id|culture_id|clone_id/i);
  const rawWell=mapped('#wellField',rows,/^well$|well_id|position/i);
  const meta=S?.meta||[],metaSample=findField(meta,/^sample$|sample_id|strain_id|culture_id|clone_id/i),metaWell=findField(meta,/^well$|well_id|position/i);
  const wellsBySample=new Map();
  if(metaSample&&metaWell){
    for(const r of meta){const sample=String(r[metaSample]??'').trim();if(!sample)continue;if(!wellsBySample.has(sample))wellsBySample.set(sample,new Set());wellsBySample.get(sample).add(normWell(r[metaWell]));}
  }
  return rows.filter(r=>!flags.some(f=>{
    if(f.scope==='sample'){
      if(rawSample&&String(r[rawSample]??'').trim()===String(f.key))return true;
      if(rawWell&&wellsBySample.get(String(f.key))?.has(normWell(r[rawWell])))return true;
    }
    if(f.scope==='well'&&rawWell&&normWell(r[rawWell])===normWell(f.key))return true;
    return false;
  }));
}

const coreRun=api?.runAnalysis;
function runWithQualityExclusions(){
  if(typeof coreRun!=='function')return;
  const original=S.raw,filtered=filteredRaw();
  if(filtered!==original)S.raw=filtered;
  try{return coreRun();}
  finally{S.raw=original;}
}
if(api&&typeof coreRun==='function'){
  api.runAnalysis=runWithQualityExclusions;
  const button=$('#runAnalysisBtn');if(button)button.onclick=runWithQualityExclusions;
}
export {filteredRaw};
