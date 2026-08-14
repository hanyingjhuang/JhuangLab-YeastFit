import fs from 'node:fs';

function patchFile(path, fn) {
  const before = fs.readFileSync(path,'utf8');
  const after = fn(before);
  if (after !== before) fs.writeFileSync(path, after);
}

patchFile('js/app.js', s => {
  let out = s.replace("version:'0.2.0'","version:'0.3.0'");
  if (!out.includes('window.YeastFit={')) {
    out += "\nwindow.YeastFit={S,design,designRefresh,review,runAnalysis,toast,canonical,resolveMode,step,recipe};\n";
  }
  return out;
});

patchFile('index.html', s => {
  let out = s;
  if (!out.includes('styles-advanced.css')) {
    out = out.replace('<link rel="stylesheet" href="styles.css" />','<link rel="stylesheet" href="styles.css" />\n  <link rel="stylesheet" href="styles-advanced.css" />');
  }
  if (!out.includes('js/presets.js')) {
    out = out.replace('<script type="module" src="js/app.js"></script>','<script type="module" src="js/app.js"></script>\n  <script type="module" src="js/presets.js"></script>\n  <script type="module" src="js/advanced.js"></script>');
  }
  out = out.replace('<b>Analyze</b><small>Growth + fitness</small>','<b>Results</b><small>Comprehensive analysis</small>');
  out = out.replace('<h2>Growth and fitness analysis</h2><p>Inspect individual curves first, then summarize. QC flags do not automatically delete data.</p>','<h2>Results and comprehensive analysis</h2><p>YeastFit combines the core measurements with control normalization, replicate diagnostics, statistics, ranking, and experiment-specific analyses. QC flags do not automatically delete data.</p>');
  return out;
});

const pkg = JSON.parse(fs.readFileSync('package.json','utf8'));
pkg.version = '0.3.0';
pkg.scripts.check = 'node --check js/analysis.js && node --check js/data.js && node --check js/stats.js && node --check js/comprehensive.js && node --check js/app.js && node --check js/presets.js && node --check js/advanced.js';
fs.writeFileSync('package.json', JSON.stringify(pkg,null,2)+'\n');

patchFile('README.md', s => {
  if (s.includes('## Experiment presets')) return s;
  return s + `\n## Experiment presets\n\nYeastFit includes guided presets for daily/24-hour measurements, endpoint assays, mutant screens, genotype-by-condition designs, evolution trajectories, dose response, competition assays, dense kinetic growth curves, and fully manual analyses. Presets configure sensible defaults but every mapping, replicate field, control, stratum, correction, and analysis choice remains editable.\n\n## Comprehensive analysis\n\nThe Results page automatically assembles analyses supported by the experimental design, including descriptive summaries with uncertainty, contemporaneous control normalization, per-timepoint and integrated control comparisons, technical-replicate diagnostics, robust screen ranking, factorial landscapes, 2 x 2 interaction contrasts, dose-response midpoint estimates, and competition logit-slope selection proxies. Modules that are not supported by the input data are reported as not applicable rather than forced.\n`;
});

console.log('YeastFit v0.3 interface patch applied');
