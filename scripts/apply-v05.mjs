import fs from 'node:fs';

function replaceOnce(text,needle,repl){if(!text.includes(needle))throw new Error(`Missing patch target: ${needle}`);return text.replace(needle,repl)}

let html=fs.readFileSync('index.html','utf8');
if(!html.includes('styles-v05.css'))html=replaceOnce(html,'  <link rel="stylesheet" href="styles-advanced.css" />','  <link rel="stylesheet" href="styles-advanced.css" />\n  <link rel="stylesheet" href="styles-v05.css" />');
if(!html.includes('workflow-v05.js'))html=replaceOnce(html,'  <script type="module" src="js/presets.js"></script>','  <script type="module" src="js/presets.js"></script>\n  <script type="module" src="js/workflow-v05.js"></script>');
fs.writeFileSync('index.html',html);

let dashboard=fs.readFileSync('js/dashboard.js','utf8');
const bad="z:ls.map(g=>times.map(t=>med(rows.filter(r=>r[group]===g&&+r.time===t).map(r=>r.relative_to_control))),zmid:1";
const good="z:ls.map(g=>times.map(t=>med(rows.filter(r=>r[group]===g&&+r.time===t).map(r=>r.relative_to_control)))),zmid:1";
if(dashboard.includes(bad))dashboard=dashboard.replace(bad,good);
fs.writeFileSync('js/dashboard.js',dashboard);

let browserTest=fs.readFileSync('tests/browser-smoke.mjs','utf8');
browserTest=browserTest.replace("await analyzePreset(inputPage,'daily');assert.ok(window!==undefined);","await analyzePreset(inputPage,'daily');assert.ok((await inputPage.locator('#visualDashboard .main-svg').count())>=4,'TSV daily renders report');");
const oldWait="async function uploadAndWait(page,files,minRows=1){\n  await page.setInputFiles('#dataFiles',files);\n  await page.waitForFunction(n=>window.YeastFit?.S?.raw?.length>=n,minRows);\n}";
const newWait="async function uploadAndWait(page,files,minRows=1){\n  const list=Array.isArray(files)?files:[files];\n  const names=list.map(x=>typeof x==='string'?x.split('/').at(-1):x.name);\n  await page.setInputFiles('#dataFiles',files);\n  await page.waitForFunction(({names,minRows})=>window.YeastFit?.S?.raw?.length>=minRows&&window.YeastFit.S.files.length===names.length&&names.every(n=>window.YeastFit.S.files.includes(n)),{names,minRows});\n}";
if(browserTest.includes(oldWait))browserTest=browserTest.replace(oldWait,newWait);
browserTest=browserTest.replace("// Pasted table path.\nawait inputPage.locator('#pasteArea').fill(endpointCsv);","// Pasted table path.\nawait inputPage.evaluate(()=>window.YeastFit.step(1));\nawait inputPage.locator('.paste-box').evaluate(el=>el.open=true);\nawait inputPage.locator('#pasteArea').fill(endpointCsv);");
browserTest=browserTest.replace("// Pasted table path.\nawait inputPage.locator('.paste-box').evaluate(el=>el.open=true);\nawait inputPage.locator('#pasteArea').fill(endpointCsv);","// Pasted table path.\nawait inputPage.evaluate(()=>window.YeastFit.step(1));\nawait inputPage.locator('.paste-box').evaluate(el=>el.open=true);\nawait inputPage.locator('#pasteArea').fill(endpointCsv);");
fs.writeFileSync('tests/browser-smoke.mjs',browserTest);

const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));pkg.version='0.5.0';pkg.scripts.check='node --check js/analysis.js && node --check js/data.js && node --check js/stats.js && node --check js/comprehensive.js && node --check js/app.js && node --check js/demo-catalog.js && node --check js/templates.js && node --check js/presets.js && node --check js/workflow-v05.js && node --check js/dashboard.js && node --check js/advanced.js';pkg.scripts['test:browser']='node tests/browser-smoke.mjs';fs.writeFileSync('package.json',JSON.stringify(pkg,null,2)+'\n');

let readme=fs.readFileSync('README.md','utf8');
const note='\n## Unified setup and input templates\n\nYeastFit uses a single Setup page for data import, experiment selection, replicate/control mapping, and design review. Downloadable CSV and Excel templates are provided for every preset experiment plus a generic custom format and a 96-well plate-map template.\n\n## Visual report\n\nEvery supported experiment receives a comprehensive core report covering biological-level magnitude, group estimates with uncertainty, matched-control normalization when defined, effect sizes and FDR, biological sample size, QC, ranking, and metric relationships when available. Design-specific plots are added on top of this common report.\n';
if(!readme.includes('## Unified setup and input templates'))readme+=note;fs.writeFileSync('README.md',readme);
