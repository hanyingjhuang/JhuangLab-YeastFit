import { readFile, writeFile } from 'node:fs/promises';

const idxPath='index.html';
let idx=await readFile(idxPath,'utf8');
const marker='  <script type="module" src="js/advanced.js"></script>';
const extra='  <script type="module" src="js/dashboard-extra.js"></script>';
if(!idx.includes(extra)){
  if(!idx.includes(marker)) throw new Error('advanced.js script marker not found');
  idx=idx.replace(marker,`${marker}\n${extra}`);
  await writeFile(idxPath,idx);
}

const pkgPath='package.json';
const pkg=JSON.parse(await readFile(pkgPath,'utf8'));
if(!pkg.scripts.check.includes('js/dashboard-extra.js')){
  pkg.scripts.check += ' && node --check js/dashboard-extra.js';
  await writeFile(pkgPath,JSON.stringify(pkg,null,2)+'\n');
}

const smokePath='tests/browser-smoke.mjs';
let smoke=await readFile(smokePath,'utf8');
const old=`  const cards=await page.locator('#visualDashboard .visual-card').count();\n  assert.ok(cards>=visualExpected[id].length,\`${'${id}'}: too few meaningful figures (${'${cards}'})\`);\n  assert.ok(cards<=visualMax[id],\`${'${id}'}: visual report is redundant (${'${cards}'} cards)\`);`;
const repl=`  const mainCards=await page.locator('#visualDashboard > .visual-grid > .visual-card').count();\n  const extraCards=await page.locator('#visualMoreAnalyses .visual-card').count();\n  const cards=mainCards+extraCards;\n  assert.ok(mainCards>=visualExpected[id].length,\`${'${id}'}: too few key figures (${'${mainCards}'})\`);\n  assert.ok(mainCards<=visualMax[id],\`${'${id}'}: key report is redundant (${'${mainCards}'} cards)\`);\n  assert.ok(extraCards<=8,\`${'${id}'}: supplementary report is excessive (${'${extraCards}'} cards)\`);`;
if(smoke.includes(old)){
  smoke=smoke.replace(old,repl);
  await writeFile(smokePath,smoke);
}
