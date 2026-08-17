import { readFile, writeFile, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SAFE_TEXT_FILES=[
  'index.html',
  'js/workflow-v05.js',
  'js/dashboard.js',
  'js/dashboard-extra.js',
  'js/advanced.js',
  'js/presets.js',
  'js/templates.js'
];

const DEFAULT_SETTINGS={
  'Blank value':{id:'blankValue',min:-1e6,max:1e6},
  'Minimum log-phase signal':{id:'minOD',min:0,max:10,relation:'lt:maxOD'},
  'Maximum log-phase signal':{id:'maxOD',min:0,max:10,relation:'gt:minOD'},
  'Growth window points':{id:'windowPoints',min:3,max:30,integer:true},
  'Minimum growth-fit R²':{id:'minR2',min:0,max:1},
  'Threshold value':{id:'thresholdValue',min:-1e6,max:1e6},
  'Saturation signal':{id:'saturationOD',min:0,max:1e6},
  'High starting signal':{id:'highStartOD',min:0,max:1e6},
  'Minimum dynamic range':{id:'minDynamicRange',min:0,max:1e6},
  'Maximum missing fraction':{id:'maxMissingFraction',min:0,max:1}
};

const THEME_COLORS={
  'Primary green':'green',
  'Secondary green':'green2',
  'Gold accent':'gold',
  'Rust accent':'rust',
  'Plum accent':'plum',
  'Page background':'paper',
  'Main text':'ink'
};

export function parseIssueBody(body=''){
  const out={};
  const chunks=String(body).split(/^###\s+/m).slice(1);
  for(const chunk of chunks){
    const nl=chunk.indexOf('\n');
    if(nl<0)continue;
    const label=chunk.slice(0,nl).trim();
    let value=chunk.slice(nl+1).trim();
    if(value==='_No response_'||value==='No response')value='';
    out[label]=value;
  }
  return out;
}

function plan(status,reason,extra={}){return{status,reason,changedFiles:[],release:'review',...extra}}
function count(text,needle){if(!needle)return 0;let n=0,pos=0;while((pos=text.indexOf(needle,pos))!==-1){n++;pos+=needle.length||1}return n}
function safePlainText(s){
  const v=String(s??'').trim();
  if(v.length<2||v.length>180)return false;
  if(/[<>{}\[\]\\`"'=\r\n]/.test(v))return false;
  if(/https?:\/\//i.test(v))return false;
  return /[\p{L}\p{N}]/u.test(v);
}
function escapeRe(s){return s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}
async function exists(p){try{await access(p);return true}catch{return false}}
async function read(root,file){return readFile(path.join(root,file),'utf8')}
async function write(root,file,content){await writeFile(path.join(root,file),content,'utf8')}

function inputTag(content,id){
  const re=new RegExp(`<input\\b[^>]*\\bid="${escapeRe(id)}"[^>]*>`);
  const m=content.match(re);return m?.[0]||'';
}
function inputValue(content,id){const tag=inputTag(content,id);const m=tag.match(/\bvalue="([^"]*)"/);return m?Number(m[1]):NaN}

async function exactWording(root,fields,release){
  const current=(fields['Current text']||'').trim(),replacement=(fields['Replacement text']||'').trim();
  if(!safePlainText(current)||!safePlainText(replacement))return plan('manual-review','Exact wording automation accepts short plain text without code-like characters.',{release});
  if(current===replacement)return plan('no-change','The requested wording already matches the replacement.',{release});
  const hits=[];
  for(const file of SAFE_TEXT_FILES){
    if(!await exists(path.join(root,file)))continue;
    const content=await read(root,file),n=count(content,current);
    if(n)hits.push({file,n,content});
  }
  const total=hits.reduce((s,x)=>s+x.n,0);
  if(total!==1)return plan('manual-review',total===0?'The exact current text was not found in the supported interface files.':'The exact current text appears more than once, so an automatic replacement would be ambiguous.',{release});
  const hit=hits.find(x=>x.n===1);
  const updated=hit.content.replace(current,replacement);
  await write(root,hit.file,updated);
  return plan('auto-change','A unique plain-text interface replacement is safe to validate automatically.',{release,changedFiles:[hit.file],operation:'wording'});
}

async function defaultSetting(root,fields,release){
  const key=(fields['Default setting']||'').trim(),spec=DEFAULT_SETTINGS[key];
  if(!spec)return plan('manual-review','The requested setting is outside the supported deterministic defaults.',{release});
  const raw=(fields['New default value']||'').trim(),value=Number(raw);
  if(!Number.isFinite(value)||value<spec.min||value>spec.max||(spec.integer&&!Number.isInteger(value)))return plan('manual-review',`The new value is outside the accepted range for ${key}.`,{release});
  const file='index.html',content=await read(root,file),tag=inputTag(content,spec.id);
  if(!tag)return plan('manual-review','The target setting could not be located safely.',{release});
  if(spec.relation){
    const [op,other]=spec.relation.split(':'),otherValue=inputValue(content,other);
    if(Number.isFinite(otherValue)&&((op==='lt'&&!(value<otherValue))||(op==='gt'&&!(value>otherValue))))return plan('manual-review',`The requested value conflicts with the paired growth-window bound (${other}).`,{release});
  }
  const newTag=tag.replace(/\bvalue="[^"]*"/,`value="${raw}"`);
  if(newTag===tag)return plan('no-change','The requested default is already in place.',{release});
  await write(root,file,content.replace(tag,newTag));
  return plan('auto-change','The request changes one bounded numeric default.',{release,changedFiles:[file],operation:'default-setting'});
}

async function themeColor(root,fields,release){
  const key=(fields['Theme color']||'').trim(),variable=THEME_COLORS[key],value=(fields['New color']||'').trim();
  if(!variable||!/^#[0-9a-fA-F]{6}$/.test(value))return plan('manual-review','Theme-color automation requires one supported palette role and a six-digit hex color.',{release});
  const file='styles.css',content=await read(root,file),re=new RegExp(`(--${escapeRe(variable)}\\s*:\\s*)#[0-9a-fA-F]{6}`);
  if(!re.test(content))return plan('manual-review','The requested palette variable could not be located safely.',{release});
  const updated=content.replace(re,`$1${value.toLowerCase()}`);
  if(updated===content)return plan('no-change','The requested color is already in place.',{release});
  await write(root,file,updated);
  return plan('auto-change','The request changes one approved theme palette variable.',{release,changedFiles:[file],operation:'theme-color'});
}

export async function applyRequest({root='.',body=''}){
  const fields=parseIssueBody(body);
  const type=(fields['Request type']||'').trim();
  const release=/^Automatic when supported/i.test(fields['Release preference']||'')?'automatic':'review';
  if(type==='Exact wording change')return exactWording(root,fields,release);
  if(type==='Default analysis setting')return defaultSetting(root,fields,release);
  if(type==='Theme color')return themeColor(root,fields,release);
  if(['Bug / unexpected behavior','New feature / analysis','Other'].includes(type))return plan('manual-review','This request requires code or scientific judgment beyond the deterministic maintenance rules.',{release});
  return plan('manual-review','The request form could not be classified safely.',{release});
}

async function cli(){
  const args=process.argv.slice(2),eventIndex=args.indexOf('--event'),rootIndex=args.indexOf('--root');
  const eventPath=eventIndex>=0?args[eventIndex+1]:process.env.GITHUB_EVENT_PATH;
  const root=rootIndex>=0?args[rootIndex+1]:process.cwd();
  if(!eventPath)throw new Error('Missing --event or GITHUB_EVENT_PATH');
  const event=JSON.parse(await readFile(eventPath,'utf8'));
  const result=await applyRequest({root,body:event.issue?.body||''});
  result.issueNumber=Number(event.issue?.number)||null;
  await writeFile(path.join(root,'request-plan.json'),JSON.stringify(result,null,2)+'\n','utf8');
  process.stdout.write(`${result.status}: ${result.reason}\n`);
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))cli().catch(err=>{console.error(err);process.exitCode=1});
