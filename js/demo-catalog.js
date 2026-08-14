const r=(x,n=4)=>Number(x.toFixed(n));
const well=(i)=>`${String.fromCharCode(65+Math.floor(i/12))}${(i%12)+1}`;
const techNoise=(bio,tech)=>1+(bio-2)*0.018+(tech===2?0.012:-0.008);

function daily(){
  const rows=[];let i=0;
  const strains=[['WT',1,'control'],['mild',0.82,'sample'],['severe',0.53,'sample']];
  for(const [genotype,effect,role] of strains)for(let bio=1;bio<=3;bio++)for(let tech=1;tech<=2;tech++)for(let day=0;day<=4;day++){
    const base=0.12+(1.05*(1-Math.exp(-0.72*day)))*effect;
    rows.push({day,value:r(base*techNoise(bio,tech)),well:well(i),sample:`${genotype}_B${bio}_T${tech}`,genotype,condition:'YPGly',role,biological_rep:bio,technical_rep:tech,plate:'Daily_demo'});
  } i++;
  return{rows,preset:'daily',title:'Daily / 24-hour measurements',question:'How do strains diverge across sparse daily measurements?'};
}
function endpoint(){
  const rows=[];let i=0;
  for(const [genotype,mu,role] of [['WT',1,'control'],['mutA',0.72,'sample'],['mutB',1.18,'sample'],['mutC',0.91,'sample']])for(let bio=1;bio<=4;bio++)for(let tech=1;tech<=2;tech++)rows.push({value:r(mu*techNoise(bio,tech)),well:well(i++),sample:`${genotype}_B${bio}_T${tech}`,genotype,condition:'YPGly',role,biological_rep:bio,technical_rep:tech,plate:'Endpoint_demo'});
  return{rows,preset:'endpoint',title:'Single endpoint growth',question:'Which groups differ from the control at one measurement time?'};
}
function screen(){
  const rows=[];let i=0;const effects={WT:1,ko01:.95,ko02:.79,ko03:.42,ko04:1.12,ko05:.88,ko06:.61,ko07:1.05,ko08:.31,ko09:.73,ko10:.98,ko11:.55,ko12:1.21};
  for(const [genotype,effect] of Object.entries(effects))for(let bio=1;bio<=3;bio++)for(let tech=1;tech<=2;tech++)rows.push({value:r(effect*techNoise(bio,tech)),well:well(i++),sample:`${genotype}_B${bio}_T${tech}`,genotype,condition:'YPGly',role:genotype==='WT'?'control':'sample',biological_rep:bio,technical_rep:tech,plate:bio<3?'Screen_A':'Screen_B'});
  return{rows,preset:'screen',title:'Mutant / strain screen',question:'Which strains are reproducible defects or gains relative to WT?'};
}
function matrix(){
  const rows=[];let i=0,genos=['WT','mutA','mutB','mutC'],conds=['YPD','YPGly','YPGly + Fe','YPD + BPS'];
  const ge={WT:1,mutA:.77,mutB:.91,mutC:1.08},ce={'YPD':1,'YPGly':.82,'YPGly + Fe':.9,'YPD + BPS':.68};
  for(const genotype of genos)for(const condition of conds)for(let bio=1;bio<=3;bio++)for(let tech=1;tech<=2;tech++){
    let interaction=1;if(genotype==='mutA'&&condition==='YPGly + Fe')interaction=1.28;if(genotype==='mutB'&&condition==='YPD + BPS')interaction=.72;
    rows.push({value:r(ge[genotype]*ce[condition]*interaction*techNoise(bio,tech)),well:well(i++),sample:`${genotype}_${condition}_B${bio}_T${tech}`,genotype,condition,role:genotype==='WT'?'control':'sample',biological_rep:bio,technical_rep:tech,plate:`Matrix_${bio}`});
  }
  return{rows,preset:'matrix',title:'Genotype × condition',question:'Does the phenotype depend on both genotype and environment?'};
}
function evolution(){
  const rows=[];let i=0,gens=[0,100,250,500,750,1000],lines=['Ancestor','Evo1','Evo2','Evo3'];
  for(const line of lines)for(let bio=1;bio<=3;bio++)for(let tech=1;tech<=2;tech++)for(const generation of gens){
    const gain=line==='Ancestor'?0:line==='Evo1'?.00034:line==='Evo2'?.00025:.00042;
    const value=.58+gain*generation+(bio-2)*.012+(tech===2?.008:-.006);
    rows.push({generation,value:r(value),well:well(i),sample:`${line}_B${bio}_T${tech}`,line,genotype:line,environment:'YPGly',role:line==='Ancestor'?'control':'sample',biological_rep:bio,technical_rep:tech,plate:'Evolution_demo'});
  } i++;
  return{rows,preset:'evolution',title:'Evolution trajectory',question:'How quickly and consistently do independent lines improve?'};
}
function dose(){
  const rows=[];let i=0,doses=[0,.25,.5,1,2,4,8];
  for(const genotype of ['WT','mutA'])for(let bio=1;bio<=4;bio++)for(let tech=1;tech<=2;tech++)for(const dose of doses){
    const ic=genotype==='WT'?2.4:1.15, response=.12+.95/(1+(dose/ic)**1.7);
    rows.push({dose,value:r(response*techNoise(bio,tech)),well:well(i),sample:`${genotype}_B${bio}_T${tech}`,genotype,treatment:'Drug X',role:dose===0?'control':'sample',biological_rep:bio,technical_rep:tech,plate:'Dose_demo'});
  } i++;
  return{rows,preset:'dose',title:'Dose response',question:'How does response change with dose, and do strains differ in sensitivity?'};
}
function competition(){
  const rows=[];let i=0,days=[0,1,2,3,4,5];
  for(const strain of ['focal_A','focal_B'])for(let bio=1;bio<=4;bio++)for(let tech=1;tech<=2;tech++)for(const day of days){
    const s=strain==='focal_A'?.24:-.16,logit=Math.log(.35/.65)+s*day+(bio-2.5)*.035+(tech===2?.012:-.01),freq=1/(1+Math.exp(-logit));
    rows.push({day,value:r(freq),frequency:r(freq),well:well(i),sample:`${strain}_B${bio}_T${tech}`,strain,role:'sample',biological_rep:bio,technical_rep:tech,plate:'Competition_demo'});
  } i++;
  return{rows,preset:'competition',title:'Competition assay',question:'Does the focal strain increase or decrease in frequency over time?'};
}
function kinetic(){
  const rows=[];let i=0,times=Array.from({length:25},(_,k)=>k*.5);
  for(const [genotype,rate,cap,lag,role] of [['WT',.72,1.12,2.2,'control'],['slow',.43,.92,3.3,'sample'],['fast',.9,1.08,1.8,'sample']])for(let bio=1;bio<=3;bio++)for(let tech=1;tech<=2;tech++)for(const time of times){
    const value=.025+cap/(1+Math.exp(-rate*(time-(lag+4.0))));
    rows.push({time,value:r(value*techNoise(bio,tech)),well:well(i),sample:`${genotype}_B${bio}_T${tech}`,genotype,condition:'YPD',role,biological_rep:bio,technical_rep:tech,plate:'Kinetic_demo'});
  } i++;
  return{rows,preset:'kinetic',title:'Dense growth curve',question:'Which strains differ in growth rate, lag, carrying capacity, and integrated growth?'};
}
function manual(){
  const rows=[];let i=0;for(const background of ['A','B'])for(const stress of ['none','heat'])for(const genotype of ['WT','mut'])for(let bio=1;bio<=3;bio++)rows.push({value:r((genotype==='WT'?1:.78)*(stress==='heat'?.72:1)*(background==='B'?1.08:1)*(1+(bio-2)*.025)),well:well(i++),sample:`${background}_${stress}_${genotype}_${bio}`,genotype,background,stress,role:genotype==='WT'?'control':'sample',biological_rep:bio,batch:`Run_${bio}`});
  return{rows,preset:'manual',title:'Manual / custom',question:'A deliberately nonstandard factorial dataset for practicing manual mapping.'};
}

const BUILDERS={daily,endpoint,screen,matrix,evolution,dose,competition,kinetic,manual};
export const DEMOS=Object.keys(BUILDERS);
export function makeDemo(id){const fn=BUILDERS[id]||BUILDERS.daily;return fn();}
