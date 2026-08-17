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
