import assert from 'node:assert/strict';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const base=process.env.YEASTFIT_URL||'http://127.0.0.1:4173';
const out=process.env.YEASTFIT_ARTIFACTS||'test-artifacts';
await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true});
const errors=[];

async function ready(page){
  page.on('pageerror',e=>errors.push(`pageerror: ${e.message}`));
  page.on('console',m=>{if(m.type()==='error')errors.push(`console: ${m.text()}`)});
  await page.goto(base,{waitUntil:'networkidle'});
  await page.waitForFunction(()=>window.YeastFit&&window.YeastFitPresets&&window.YeastFitWorkflowV05);
}
async function analyzePreset(page,preset){
  await page.evaluate(x=>window.YeastFitPresets.applyPreset(x),preset);
  await page.evaluate(()=>window.YeastFit.runAnalysis());
  await page.waitForFunction(()=>window.YeastFit?.S?.metrics?.length>0);
  await page.waitForFunction(()=>document.querySelectorAll('#visualDashboard .visual-card').length>=6);
}
async function uploadAndWait(page,files,minRows=1){
  const list=Array.isArray(files)?files:[files];
  const names=list.map(x=>typeof x==='string'?x.split('/').at(-1):x.name);
  await page.setInputFiles('#dataFiles',files);
  await page.waitForFunction(({names,minRows})=>window.YeastFit?.S?.raw?.length>=minRows&&window.YeastFit.S.files.length===names.length&&names.every(n=>window.YeastFit.S.files.includes(n)),{names,minRows});
}

const context=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true});
const page=await context.newPage();
await ready(page);
assert.equal(await page.locator('.brand-kicker').textContent(),'JHUANG LAB');
assert.equal(await page.locator('.step[data-step="2"]').evaluate(el=>getComputedStyle(el).display),'none');
assert.ok(await page.locator('.step-panel[data-panel="1"] #presetChooser').count()===1,'preset chooser must be on Setup');
assert.ok(await page.locator('.step-panel[data-panel="1"] #setupDesignReview').count()===1,'mapping review must be on Setup');
assert.ok(await page.locator('#templateLibrary .template-card').count()>=10,'template library must cover all designs plus plate map');

const csvDownload=page.waitForEvent('download');
await page.locator('.template-download[data-template="daily"][data-format="csv"]').click();
const csv=await csvDownload;assert.match(csv.suggestedFilename(),/daily_template\.csv$/);await csv.saveAs(`${out}/daily_template.csv`);
const xlsxDownload=page.waitForEvent('download');
await page.locator('.template-download[data-template="matrix"][data-format="xlsx"]').click();
const xlsx=await xlsxDownload;assert.match(xlsx.suggestedFilename(),/matrix_template\.xlsx$/);await xlsx.saveAs(`${out}/matrix_template.xlsx`);

const scenarios=['daily','endpoint','screen','matrix','evolution','dose','competition','kinetic','manual'];
for(const id of scenarios){
  await page.evaluate(x=>window.YeastFitPresets.loadDemo(x),id);
  await page.waitForFunction(x=>window.YeastFit?.S?.design?.preset===x&&window.YeastFit.S.metrics?.length>0,id);
  await page.waitForFunction(()=>document.querySelectorAll('#visualDashboard .visual-card').length>=6);
  await page.waitForTimeout(250);
  const cards=await page.locator('#visualDashboard .visual-card').count();
  const rendered=await page.locator('#visualDashboard .main-svg').count();
  assert.ok(cards>=6,`${id}: comprehensive report needs >=6 figure cards, got ${cards}`);
  assert.ok(rendered>=4,`${id}: at least 4 rendered plots expected, got ${rendered}`);
  const status=await page.locator('#analysisStatus').textContent();assert.doesNotMatch(status||'',/not run/i,`${id}: analysis must run`);
  assert.ok(await page.locator('#rawDiagnostics').count()===1,`${id}: raw diagnostics section exists`);
  assert.equal(await page.locator('#rawDiagnostics').evaluate(el=>el.open),false,`${id}: raw diagnostics collapsed by default`);
  assert.equal(await page.evaluate(()=>{const p=document.querySelector('.step-panel[data-panel="4"]'),a=document.querySelector('#comprehensiveResults'),b=document.querySelector('#rawDiagnostics'),c=[...p.children];return c.indexOf(a)<c.indexOf(b)}),true,`${id}: visual report must precede raw diagnostics`);
  const overview=await page.evaluate(()=>Object.fromEntries([...document.querySelectorAll('.analysis-overview-grid>div')].map(x=>[x.querySelector('small')?.textContent?.trim(),x.querySelector('b')?.textContent?.trim()])));
  if(await page.evaluate(()=>Boolean(window.YeastFit.S.design.techRepField))){
    assert.ok(Number(overview['Biological-level rows'])<Number(overview['Measurements']),`${id}: technical replicates must collapse before biological inference`);
  }
  if(['endpoint','screen'].includes(id)){
    const headers=await page.locator('[data-analysis-module="timepoints"] th').allTextContents();
    assert.ok(!headers.some(h=>h.trim().toLowerCase()==='time'),`${id}: endpoint summaries must not contain meaningless time columns`);
  }
  if(id==='endpoint')assert.equal(Number(overview['Biological-level rows']),16,'endpoint demo should contain 16 biological-level observations');
  if(id==='screen')assert.equal(Number(overview['Biological-level rows']),39,'screen demo should contain 39 biological-level observations');
  if(['endpoint','screen','matrix'].includes(id)){const summaryText=await page.locator('[data-analysis-module="timepoints"]').innerText();assert.ok(!/\bNaN\b/.test(summaryText),`${id}: biological summaries should not be fragmented into n=1 batch strata`);}
  if(id==='matrix'){assert.equal(await page.locator('#viz_effects').count(),1,'matrix effect card should exist');if(await page.locator('#viz_effects .main-svg').count()===0){const detail=await page.locator('[data-analysis-module="metricTests"]').innerText();const debug=await page.evaluate(()=>window.__YEASTFIT_TEST_DEBUG);throw new Error(`matrix effect figure missing; integrated comparisons:
${detail}
DEBUG=${JSON.stringify(debug)}`)}}
  if(id==='daily'){assert.equal(await page.locator('#viz_serial_auc').count(),1,'daily AUC card should exist');await page.locator('#viz_serial_auc .main-svg').first().waitFor({state:'attached',timeout:8000});assert.equal(await page.locator('#viz_serial_trend_slope').count(),1,'daily slope card should exist');await page.locator('#viz_serial_trend_slope .main-svg').first().waitFor({state:'attached',timeout:8000});}
  if(id==='kinetic'){assert.equal(await page.locator('#viz_metric_auc').count(),1,'kinetic AUC card should exist');await page.locator('#viz_metric_auc .main-svg').first().waitFor({state:'attached',timeout:8000});assert.equal(await page.locator('#viz_metric_doubling_time').count(),1,'kinetic doubling-time card should exist');await page.locator('#viz_metric_doubling_time .main-svg').first().waitFor({state:'attached',timeout:8000});assert.equal(await page.locator('#viz_metric_lag').count(),1,'kinetic lag card should exist');await page.locator('#viz_metric_lag .main-svg').first().waitFor({state:'attached',timeout:8000});}
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
  assert.ok(overflow<=6,`${id}: horizontal overflow ${overflow}px`);
  await page.screenshot({path:`${out}/${id}-desktop.png`,fullPage:true});
}

// Exercise every user-facing import route with actual files, not only demos.
const inputPage=await context.newPage();await ready(inputPage);
const endpointCsv=`value,sample,genotype,condition,role,biological_rep,technical_rep,plate\n1.00,WT_B1,WT,YPGly,control,1,1,P1\n1.02,WT_B2,WT,YPGly,control,2,1,P1\n0.98,WT_B3,WT,YPGly,control,3,1,P1\n0.63,M_B1,mutA,YPGly,sample,1,1,P1\n0.67,M_B2,mutA,YPGly,sample,2,1,P1\n0.65,M_B3,mutA,YPGly,sample,3,1,P1\n`;
const endpointPath=`${out}/upload_endpoint.csv`;await writeFile(endpointPath,endpointCsv);
await uploadAndWait(inputPage,endpointPath,6);await analyzePreset(inputPage,'endpoint');assert.ok((await inputPage.locator('#visualDashboard .main-svg').count())>=4,'CSV endpoint renders report');

const dailyTsv=`day\tvalue\tsample\tgenotype\tcondition\trole\tbiological_rep\ttechnical_rep\tplate\n0\t0.12\tWT_B1\tWT\tYPGly\tcontrol\t1\t1\tP1\n1\t0.62\tWT_B1\tWT\tYPGly\tcontrol\t1\t1\tP1\n2\t1.00\tWT_B1\tWT\tYPGly\tcontrol\t1\t1\tP1\n0\t0.12\tWT_B2\tWT\tYPGly\tcontrol\t2\t1\tP1\n1\t0.64\tWT_B2\tWT\tYPGly\tcontrol\t2\t1\tP1\n2\t1.02\tWT_B2\tWT\tYPGly\tcontrol\t2\t1\tP1\n0\t0.12\tWT_B3\tWT\tYPGly\tcontrol\t3\t1\tP1\n1\t0.60\tWT_B3\tWT\tYPGly\tcontrol\t3\t1\tP1\n2\t0.99\tWT_B3\tWT\tYPGly\tcontrol\t3\t1\tP1\n0\t0.12\tM_B1\tmutA\tYPGly\tsample\t1\t1\tP1\n1\t0.43\tM_B1\tmutA\tYPGly\tsample\t1\t1\tP1\n2\t0.66\tM_B1\tmutA\tYPGly\tsample\t1\t1\tP1\n0\t0.12\tM_B2\tmutA\tYPGly\tsample\t2\t1\tP1\n1\t0.45\tM_B2\tmutA\tYPGly\tsample\t2\t1\tP1\n2\t0.68\tM_B2\tmutA\tYPGly\tsample\t2\t1\tP1\n0\t0.12\tM_B3\tmutA\tYPGly\tsample\t3\t1\tP1\n1\t0.42\tM_B3\tmutA\tYPGly\tsample\t3\t1\tP1\n2\t0.64\tM_B3\tmutA\tYPGly\tsample\t3\t1\tP1\n`;
const tsvPath=`${out}/upload_daily.tsv`;await writeFile(tsvPath,dailyTsv);await uploadAndWait(inputPage,tsvPath,18);await analyzePreset(inputPage,'daily');assert.ok((await inputPage.locator('#visualDashboard .main-svg').count())>=4,'TSV daily renders report');

const jsonPath=`${out}/upload_endpoint.json`;await writeFile(jsonPath,JSON.stringify([
  {value:1.01,sample:'WT1',genotype:'WT',condition:'YPGly',role:'control',biological_rep:1},{value:.99,sample:'WT2',genotype:'WT',condition:'YPGly',role:'control',biological_rep:2},{value:1.02,sample:'WT3',genotype:'WT',condition:'YPGly',role:'control',biological_rep:3},
  {value:.7,sample:'M1',genotype:'mutB',condition:'YPGly',role:'sample',biological_rep:1},{value:.72,sample:'M2',genotype:'mutB',condition:'YPGly',role:'sample',biological_rep:2},{value:.68,sample:'M3',genotype:'mutB',condition:'YPGly',role:'sample',biological_rep:3}
]));await uploadAndWait(inputPage,jsonPath,6);await analyzePreset(inputPage,'endpoint');

const multiA=`${out}/multi_A.csv`,multiB=`${out}/multi_B.csv`;await writeFile(multiA,endpointCsv.replaceAll(',P1',',P_A'));await writeFile(multiB,endpointCsv.replaceAll(',P1',',P_B').replaceAll('mutA','mutB'));await uploadAndWait(inputPage,[multiA,multiB],12);await inputPage.waitForFunction(()=>window.YeastFit.S.files.length===2);await analyzePreset(inputPage,'endpoint');

// Wide plate-reader matrix + separate plate map exercises metadata joining.
const widePath=`${out}/wide_plate.csv`,metaPath=`${out}/plate_map.csv`;const wells=Array.from({length:12},(_,i)=>`A${i+1}`);
const wideRows=['day,'+wells.join(',')];for(const day of [0,1,2]){const vals=wells.map((_,i)=>{const mutant=i>=6,effect=mutant?.65:1;return (0.12+(0.44*day)*effect+((i%2)*.01)).toFixed(3)});wideRows.push(`${day},${vals.join(',')}`)}await writeFile(widePath,wideRows.join('\n'));
const meta=['well,sample,genotype,condition,role,biological_rep,technical_rep'];for(let i=0;i<12;i++){const mutant=i>=6,bio=(Math.floor((i%6)/2)+1),tech=(i%2)+1;meta.push(`${wells[i]},${mutant?'mutA':'WT'}_B${bio}_T${tech},${mutant?'mutA':'WT'},YPGly,${mutant?'sample':'control'},${bio},${tech}`)}await writeFile(metaPath,meta.join('\n'));
await uploadAndWait(inputPage,widePath,3);await inputPage.setInputFiles('#metaFiles',metaPath);await inputPage.waitForFunction(()=>window.YeastFit.S.meta.length===12);await analyzePreset(inputPage,'daily');assert.ok(await inputPage.locator('#visualDashboard .main-svg').count()>=4,'wide + plate map renders report');

// Pasted table path.
await inputPage.evaluate(()=>window.YeastFit.step(1));
await inputPage.locator('.paste-box').evaluate(el=>el.open=true);
await inputPage.locator('#pasteArea').fill(endpointCsv);await inputPage.locator('#parsePasteBtn').click();await inputPage.waitForFunction(()=>window.YeastFit.S.files[0]==='pasted table'&&window.YeastFit.S.raw.length===6);await analyzePreset(inputPage,'endpoint');

// XLSX and legacy .xls parser routes. Parsing is enough here because the same canonicalization is tested above.
await inputPage.setInputFiles('#dataFiles',`${out}/matrix_template.xlsx`);await inputPage.waitForFunction(()=>window.YeastFit.S.files.some(x=>x.endsWith('.xlsx'))&&window.YeastFit.S.raw.length>0);
const workbookBytes=await readFile(`${out}/matrix_template.xlsx`);await inputPage.setInputFiles('#dataFiles',{name:'matrix_legacy.xls',mimeType:'application/vnd.ms-excel',buffer:workbookBytes});await inputPage.waitForFunction(()=>window.YeastFit.S.files.includes('matrix_legacy.xls')&&window.YeastFit.S.raw.length>0);
await inputPage.screenshot({path:`${out}/input-routes-desktop.png`,fullPage:true});

await context.close();
const mobile=await browser.newContext({viewport:{width:390,height:844}});const mpage=await mobile.newPage();await ready(mpage);
await mpage.evaluate(()=>window.YeastFitPresets.loadDemo('daily'));
await mpage.waitForFunction(()=>window.YeastFit?.S?.metrics?.length>0&&document.querySelectorAll('#visualDashboard .visual-card').length>=6);
await mpage.waitForTimeout(250);
await mpage.screenshot({path:`${out}/daily-mobile.png`,fullPage:true});
const mobileOverflow=await mpage.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
assert.ok(mobileOverflow<=6,`mobile horizontal overflow ${mobileOverflow}px`);
assert.equal(await mpage.locator('#rawDiagnostics').evaluate(el=>el.open),false,'mobile raw diagnostics collapsed');
await mobile.close();
await browser.close();
assert.deepEqual(errors,[],`Browser errors:\n${errors.join('\n')}`);
console.log(`Browser validation passed for ${scenarios.length} experiment designs plus CSV, TSV, JSON, XLSX, XLS, multi-file, paste, and plate-map routes.`);
