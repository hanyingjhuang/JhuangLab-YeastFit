const csvEscape=v=>{const s=String(v??'');return /[",\n]/.test(s)?`"${s.replace(/"/g,'""')}"`:s};
const toCsv=rows=>{const headers=[...new Set(rows.flatMap(Object.keys))];return [headers.join(','),...rows.map(r=>headers.map(h=>csvEscape(r[h])).join(','))].join('\n')};

export const TEMPLATES={
  daily:{name:'Daily / 24-hour measurements',notes:'Same biological cultures followed at sparse repeated timepoints.',rows:[
    {day:0,value:'',sample:'WT_B1',genotype:'WT',condition:'YPGly',role:'control',biological_rep:1,technical_rep:1,plate:'P1'},
    {day:1,value:'',sample:'WT_B1',genotype:'WT',condition:'YPGly',role:'control',biological_rep:1,technical_rep:1,plate:'P1'},
    {day:0,value:'',sample:'mutA_B1',genotype:'mutA',condition:'YPGly',role:'sample',biological_rep:1,technical_rep:1,plate:'P1'}]},
  endpoint:{name:'Single endpoint',notes:'One final quantitative measurement per observation.',rows:[
    {value:'',sample:'WT_B1',genotype:'WT',condition:'YPGly',role:'control',biological_rep:1,technical_rep:1,plate:'P1'},
    {value:'',sample:'mutA_B1',genotype:'mutA',condition:'YPGly',role:'sample',biological_rep:1,technical_rep:1,plate:'P1'}]},
  screen:{name:'Strain / mutant screen',notes:'Many strains compared with a matched reference.',rows:[
    {value:'',well:'A1',genotype:'WT',condition:'YPGly',role:'control',biological_rep:1,technical_rep:1,plate:'Screen_1'},
    {value:'',well:'A2',genotype:'ko01',condition:'YPGly',role:'sample',biological_rep:1,technical_rep:1,plate:'Screen_1'},
    {value:'',well:'A3',genotype:'ko02',condition:'YPGly',role:'sample',biological_rep:1,technical_rep:1,plate:'Screen_1'}]},
  matrix:{name:'Genotype × condition',notes:'Cross genotypes with media, drugs, stresses, or other environments.',rows:[
    {value:'',genotype:'WT',condition:'YPD',role:'control',biological_rep:1,technical_rep:1,plate:'P1'},
    {value:'',genotype:'mutA',condition:'YPD',role:'sample',biological_rep:1,technical_rep:1,plate:'P1'},
    {value:'',genotype:'WT',condition:'YPGly',role:'control',biological_rep:1,technical_rep:1,plate:'P2'},
    {value:'',genotype:'mutA',condition:'YPGly',role:'sample',biological_rep:1,technical_rep:1,plate:'P2'}]},
  evolution:{name:'Evolution trajectory',notes:'Independent lines sampled across generations or passages.',rows:[
    {generation:0,value:'',line:'Ancestor',genotype:'Ancestor',environment:'YPGly',role:'control',biological_rep:1,technical_rep:1,plate:'P1'},
    {generation:500,value:'',line:'Evo1',genotype:'Evo1',environment:'YPGly',role:'sample',biological_rep:1,technical_rep:1,plate:'P1'},
    {generation:1000,value:'',line:'Evo1',genotype:'Evo1',environment:'YPGly',role:'sample',biological_rep:1,technical_rep:1,plate:'P1'}]},
  dose:{name:'Dose response',notes:'Quantitative response measured across concentrations.',rows:[
    {dose:0,value:'',sample:'WT_B1',genotype:'WT',treatment:'Drug X',role:'control',biological_rep:1,technical_rep:1,plate:'P1'},
    {dose:0.5,value:'',sample:'WT_B1',genotype:'WT',treatment:'Drug X',role:'sample',biological_rep:1,technical_rep:1,plate:'P1'},
    {dose:2,value:'',sample:'WT_B1',genotype:'WT',treatment:'Drug X',role:'sample',biological_rep:1,technical_rep:1,plate:'P1'}]},
  competition:{name:'Competition assay',notes:'Track focal-strain frequency or fraction through time.',rows:[
    {day:0,frequency:'',value:'',sample:'A_B1',strain:'focal_A',biological_rep:1,technical_rep:1,plate:'P1'},
    {day:1,frequency:'',value:'',sample:'A_B1',strain:'focal_A',biological_rep:1,technical_rep:1,plate:'P1'},
    {day:2,frequency:'',value:'',sample:'A_B1',strain:'focal_A',biological_rep:1,technical_rep:1,plate:'P1'}]},
  kinetic:{name:'Dense growth curve',notes:'Frequent plate-reader sampling sufficient to resolve growth phases.',rows:[
    {time:0,value:'',well:'A1',sample:'WT_B1',genotype:'WT',condition:'YPD',role:'control',biological_rep:1,technical_rep:1,plate:'P1'},
    {time:0.5,value:'',well:'A1',sample:'WT_B1',genotype:'WT',condition:'YPD',role:'control',biological_rep:1,technical_rep:1,plate:'P1'},
    {time:1,value:'',well:'A1',sample:'WT_B1',genotype:'WT',condition:'YPD',role:'control',biological_rep:1,technical_rep:1,plate:'P1'}]},
  manual:{name:'Generic / custom',notes:'A tidy long-format starting point. Rename or add metadata columns freely.',rows:[
    {time:'',value:'',sample:'Sample_1',genotype:'WT',condition:'Condition_A',role:'control',biological_rep:1,technical_rep:1,batch:'Run_1'},
    {time:'',value:'',sample:'Sample_2',genotype:'mutA',condition:'Condition_A',role:'sample',biological_rep:1,technical_rep:1,batch:'Run_1'}]},
  platemap:{name:'96-well plate map / metadata',notes:'Optional metadata table that can be joined to plate-reader wells.',rows:[
    {plate:'P1',well:'A1',sample:'WT_B1_T1',genotype:'WT',condition:'YPGly',role:'control',biological_rep:1,technical_rep:1},
    {plate:'P1',well:'A2',sample:'WT_B1_T2',genotype:'WT',condition:'YPGly',role:'control',biological_rep:1,technical_rep:2},
    {plate:'P1',well:'A3',sample:'mutA_B1_T1',genotype:'mutA',condition:'YPGly',role:'sample',biological_rep:1,technical_rep:1}]}
};

export function templateCsv(id){const t=TEMPLATES[id];if(!t)throw new Error(`Unknown template: ${id}`);return toCsv(t.rows)}

export function downloadTemplate(id,format='csv'){
  const t=TEMPLATES[id];if(!t)throw new Error(`Unknown template: ${id}`);
  const safe=`JhuangLab_YeastFit_${id}_template`;
  if(format==='xlsx'&&window.XLSX){
    const wb=XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(t.rows),'Data');
    XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([
      ['Jhuang Lab YeastFit input template'],['Design',t.name],['Purpose',t.notes],[],
      ['Guidance'],['Keep one row per measurement.'],['Use biological_rep for independent cultures and technical_rep for repeated measurements of the same biological culture.'],['Controls can be defined with role=control or another field/value in YeastFit.'],['Extra metadata columns are allowed and preserved.']
    ]),'Instructions');
    XLSX.writeFile(wb,`${safe}.xlsx`);return;
  }
  const blob=new Blob([templateCsv(id)],{type:'text/csv;charset=utf-8'}),a=document.createElement('a');
  a.href=URL.createObjectURL(blob);a.download=`${safe}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),500);
}
