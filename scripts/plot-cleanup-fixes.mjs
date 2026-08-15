import fs from 'node:fs';

let advanced=fs.readFileSync('js/advanced.js','utf8');
const oldRep="out.replicates=rawPts.length?replicateDiagnostics(rawPts,{technicalField:S.design.techRepField,biologicalField:S.design.bioRepField,timeField:hasTime?'time':'',groupingFields:uniq([group,...summaryStrata].filter(Boolean)),cvWarn:0.15}):[];";
const newRep="out.replicates=rawPts.length?replicateDiagnostics(rawPts,{technicalField:S.design.techRepField,biologicalField:S.design.bioRepField,timeField:hasTime?'time':'',groupingFields:uniq([group,...summaryStrata,...pointReportFactors].filter(Boolean)),cvWarn:0.15}):[];";
if(advanced.includes(oldRep))advanced=advanced.replace(oldRep,newRep);
if(!advanced.includes('groupingFields:uniq([group,...summaryStrata,...pointReportFactors]'))throw new Error('Could not make replicate QC factor-aware');
fs.writeFileSync('js/advanced.js',advanced);

let dash=fs.readFileSync('js/dashboard.js','utf8');
const effect=/function effectTrace\(tests\)\{[\s\S]*?\n\}\nfunction rankTrace/;
const effectReplacement=`function effectTrace(tests){\n  const a=(tests||[]).filter(r=>Number.isFinite(+r.q)&&Number.isFinite(+r.ratio)&&+r.ratio>0);if(!a.length)return[];\n  const label=r=>[r.group,String(r.stratum||'').replaceAll('|',' · ')].filter(Boolean).join(' · '),top=[...a].sort((x,y)=>(+x.q)-(+y.q)||Math.abs(Math.log2(+y.ratio))-Math.abs(Math.log2(+x.ratio))).slice(0,5),keep=new Set(top);\n  return [{type:'scatter',mode:'markers+text',x:a.map(r=>Math.log2(+r.ratio)),y:a.map(r=>-Math.log10(Math.max(+r.q,1e-12))),text:a.map(r=>keep.has(r)?label(r):''),textposition:'top center',textfont:{size:9,color:'#536058'},marker:{size:a.map(r=>keep.has(r)?10:7),color:a.map(r=>+r.q<.05?'#a85f47':'#6d8b64'),opacity:.8},customdata:a.map(r=>[label(r),+r.q,+r.hedges_g]),hovertemplate:'%{customdata[0]}<br>log2 relative=%{x:.3g}<br>q=%{customdata[1]:.3g}<br>Hedges g=%{customdata[2]:.3g}<extra></extra>'}];\n}\nfunction rankTrace`;
if(!effect.test(dash))throw new Error('Could not locate effectTrace');
dash=dash.replace(effect,effectReplacement);
dash=dash.replace('if(times.length<2||ls.length<3||ls.length>24)return[];','if(times.length<2||ls.length<5||ls.length>24)return[];');
dash=dash.replace("function qcSection(grid,data,metrics,group){\n  const cv=cvTrace(data.replicates),flags=flaggedQcTrace(metrics),n=unequalNTrace(metrics,group);", "function qcSection(grid,data,metrics,group,showCurveFlags=false){\n  const cv=cvTrace(data.replicates),flags=showCurveFlags?flaggedQcTrace(metrics):[],n=unequalNTrace(metrics,group);");
dash=dash.replaceAll("qcSection(grid,data,metrics,group);return;","qcSection(grid,data,metrics,group,preset==='kinetic');return;");
dash=dash.replace("qcSection(grid,data,metrics,group);\n}","qcSection(grid,data,metrics,group,preset==='kinetic');\n}");
dash=dash.replaceAll("lo.xaxis.title='Standardized effect'","lo.xaxis.title='log2 relative phenotype'");
dash=dash.replaceAll("elo.xaxis.title='Standardized effect'","elo.xaxis.title='log2 relative phenotype'");
dash=dash.replaceAll("'Effect size & FDR'","'Relative effect & FDR'");
if(!dash.includes("showCurveFlags?flaggedQcTrace(metrics):[]"))throw new Error('Could not restrict curve QC flags');
if(!dash.includes("Math.log2(+r.ratio)"))throw new Error('Could not change effect plot scale');
fs.writeFileSync('js/dashboard.js',dash);
