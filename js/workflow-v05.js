import { TEMPLATES, downloadTemplate } from './templates.js';

const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];

function templateCard(id,t){return `<article class="template-card"><div><span class="template-type">${id==='platemap'?'METADATA':'INPUT'}</span><h4>${t.name}</h4><p>${t.notes}</p></div><div class="template-actions"><button class="ghost small template-download" data-template="${id}" data-format="csv">CSV</button><button class="secondary small template-download" data-template="${id}" data-format="xlsx">Excel</button></div></article>`}

function addTemplateLibrary(panel){if($('#templateLibrary'))return;const section=document.createElement('section');section.id='templateLibrary';section.className='template-library';section.innerHTML=`<div class="template-library-head"><div><span class="section-tag">STARTING FILES</span><h3>Download an input template</h3><p>Optional. Use these when you want students to collect data in a predictable format. Extra metadata columns are always allowed.</p></div><span class="template-badge">CSV + Excel</span></div><div class="template-grid">${Object.entries(TEMPLATES).map(([id,t])=>templateCard(id,t)).join('')}</div>`;const importGrid=panel.querySelector('.import-grid');importGrid?.insertAdjacentElement('afterend',section);section.querySelectorAll('.template-download').forEach(b=>b.onclick=e=>{e.preventDefault();e.stopPropagation();downloadTemplate(b.dataset.template,b.dataset.format)})}

function mergeDesignIntoSetup(){const setup=$('.step-panel[data-panel="1"]'),design=$('.step-panel[data-panel="2"]');if(!setup||!design||$('#setupDesignReview'))return;
  const head=setup.querySelector('.panel-head');head.querySelector('.section-tag').textContent='SETUP';head.querySelector('h2').textContent='Set up the experiment';head.querySelector('p').textContent='Bring data or start from a template, choose the experiment shape, then review the detected measurement, replicate, control, and metadata fields in one place.';
  const roadmap=document.createElement('div');roadmap.className='setup-roadmap';roadmap.innerHTML='<div><span>1</span><b>Bring data</b><small>Upload, paste, or use a template</small></div><i>→</i><div><span>2</span><b>Choose the design</b><small>Pick the experiment picture that matches</small></div><i>→</i><div><span>3</span><b>Review assumptions</b><small>Confirm replicates, controls, and factors</small></div>';head.insertAdjacentElement('afterend',roadmap);
  addTemplateLibrary(setup);
  const chooser=$('#presetChooser');if(chooser){chooser.classList.add('setup-presets');const footer=setup.querySelector('.footer-actions');setup.insertBefore(chooser,footer)}
  const review=document.createElement('section');review.id='setupDesignReview';review.className='setup-design-review';review.innerHTML='<div class="setup-review-head"><div><span class="section-tag">DETECTED DESIGN</span><h3>Review what YeastFit understood</h3><p>These fields are auto-filled when possible. Nothing is hidden or locked.</p></div><span>Advanced choices remain editable</span></div>';
  const cards=design.querySelector('.card-grid');if(cards)review.appendChild(cards);setup.insertBefore(review,setup.querySelector('.footer-actions'));
  design.classList.add('workflow-retired-panel');
  const footer=setup.querySelector('.footer-actions'),next=footer?.querySelector('.next-btn');if(next){next.dataset.next='3';next.textContent='Continue to adjustments →'}
  const nav2=$('.step[data-step="2"]');if(nav2)nav2.classList.add('workflow-retired-step');
  const labels={1:['Setup','Data + experiment'],3:['Adjust','Corrections + QC'],4:['Results','Visual + statistical report'],5:['Compare','Focused comparisons'],6:['Export','Results + recipe']};
  Object.entries(labels).forEach(([step,[title,sub]],i)=>{const n=$(`.step[data-step="${step}"]`);if(!n)return;n.querySelector('span').textContent=String(i+1);n.querySelector('b').textContent=title;n.querySelector('small').textContent=sub});
}

function compactDemoGallery(){const g=$('#demoGallery');if(!g)return;g.classList.add('demo-collapsed','setup-demo-gallery');const btn=$('#hideDemosBtn');if(btn){btn.textContent='Show examples';btn.onclick=()=>{g.classList.toggle('demo-collapsed');btn.textContent=g.classList.contains('demo-collapsed')?'Show examples':'Hide examples'}}const setup=$('.step-panel[data-panel="1"]'),chooser=$('#presetChooser');if(setup&&chooser)setup.insertBefore(g,chooser)}

function organizeResults(){const panel=$('.step-panel[data-panel="4"]');if(!panel)return;
  let details=$('#rawDiagnostics');
  if(!details){details=document.createElement('details');details.id='rawDiagnostics';details.className='raw-diagnostics';details.innerHTML='<summary><div><b>Raw measurements & per-unit details</b><small>Optional audit view: adjusted measurements, per-unit metrics, and QC details.</small></div><span>Show details</span></summary><div class="raw-diagnostics-body"><p class="muted">The visual report above uses biological-level experimental units whenever replicate metadata are available. This section preserves lower-level observations for audit and troubleshooting.</p></div>';const body=details.querySelector('.raw-diagnostics-body');const nodes=[$('#metricCards'),$('#growthPlot')?.closest('.chart-card'),$('#metricsTable')?.closest('.card-grid.two')].filter(Boolean);nodes.forEach(n=>body.appendChild(n));panel.insertBefore(details,panel.querySelector('.footer-actions'));details.addEventListener('toggle',()=>{const label=details.querySelector('summary>span');if(label)label.textContent=details.open?'Hide details':'Show details'})}
  const promote=()=>{const report=$('#comprehensiveResults'),raw=$('#rawDiagnostics');if(report&&raw&&report.parentElement===panel&&report.nextElementSibling!==raw)panel.insertBefore(report,raw)};
  promote();new MutationObserver(promote).observe(panel,{childList:true});
}

function compactResultsLabels(){const panel=$('.step-panel[data-panel="4"]');if(!panel)return;const head=panel.querySelector('.panel-head');if(head){head.querySelector('.section-tag').textContent='RESULTS';head.querySelector('h2').textContent='Comprehensive results';head.querySelector('p').textContent='Start with the visual report. Detailed tables and raw per-unit diagnostics remain available below for audit and export.'}}

function improveTopActions(){const b=$('#demoBtn');if(!b)return;b.textContent='Examples';b.onclick=()=>{window.YeastFit?.step?.(1);const g=$('#demoGallery');g?.classList.remove('demo-collapsed');const hb=$('#hideDemosBtn');if(hb)hb.textContent='Hide examples';g?.scrollIntoView({behavior:'smooth',block:'start'})}}

function initialize(){mergeDesignIntoSetup();compactDemoGallery();organizeResults();compactResultsLabels();improveTopActions()}
initialize();
window.YeastFitWorkflowV05={initialize,TEMPLATES};
