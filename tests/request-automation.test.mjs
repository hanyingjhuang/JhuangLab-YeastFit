import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { parseIssueBody, applyRequest } from '../scripts/request-automation.mjs';

async function fixture(){
  const root=await mkdtemp(path.join(tmpdir(),'yeastfit-request-'));
  await mkdir(path.join(root,'js'),{recursive:true});
  await writeFile(path.join(root,'index.html'),'<h2>Comprehensive results</h2>\n<input id="minOD" type="number" value="0.03" />\n<input id="maxOD" type="number" value="0.6" />\n<input id="windowPoints" type="number" value="5" />\n<input id="minR2" type="number" value="0.95" />\n<input id="thresholdValue" type="number" value="0.3" />\n<input id="blankValue" type="number" value="0" />\n<input id="saturationOD" type="number" value="1.5" />\n<input id="highStartOD" type="number" value="0.25" />\n<input id="minDynamicRange" type="number" value="0.08" />\n<input id="maxMissingFraction" type="number" value="0.15" />\n');
  await writeFile(path.join(root,'styles.css'),':root{--ink:#223127;--paper:#f7f4ea;--green:#315c45;--green2:#6d8b64;--gold:#c89a45;--rust:#a85f47;--plum:#765767;}\n');
  await writeFile(path.join(root,'js/workflow-v05.js'),'const label="Review assumptions";\n');
  return root;
}
function body(fields){return Object.entries(fields).map(([k,v])=>`### ${k}\n\n${v}`).join('\n\n')}

test('parses issue-form headings',()=>{
  const f=parseIssueBody('### Request type\n\nTheme color\n\n### New color\n\n#123456');
  assert.equal(f['Request type'],'Theme color');assert.equal(f['New color'],'#123456');
});

test('applies one unique plain-text wording change',async()=>{
  const root=await fixture();try{
    const result=await applyRequest({root,body:body({'Request type':'Exact wording change','Current text':'Review assumptions','Replacement text':'Check assumptions','Release preference':'Automatic when supported and tests pass'})});
    assert.equal(result.status,'auto-change');assert.deepEqual(result.changedFiles,['js/workflow-v05.js']);
    assert.match(await readFile(path.join(root,'js/workflow-v05.js'),'utf8'),/Check assumptions/);
  }finally{await rm(root,{recursive:true,force:true})}
});

test('rejects code-like wording payloads',async()=>{
  const root=await fixture();try{
    const result=await applyRequest({root,body:body({'Request type':'Exact wording change','Current text':'Review assumptions','Replacement text':'</script><script>alert(1)</script>','Release preference':'Automatic when supported and tests pass'})});
    assert.equal(result.status,'manual-review');
  }finally{await rm(root,{recursive:true,force:true})}
});

test('changes a bounded numeric default',async()=>{
  const root=await fixture();try{
    const result=await applyRequest({root,body:body({'Request type':'Default analysis setting','Default setting':'Minimum growth-fit R²','New default value':'0.90','Release preference':'Automatic when supported and tests pass'})});
    assert.equal(result.status,'auto-change');assert.deepEqual(result.changedFiles,['index.html']);
    assert.match(await readFile(path.join(root,'index.html'),'utf8'),/id="minR2"[^>]*value="0.90"/);
  }finally{await rm(root,{recursive:true,force:true})}
});

test('rejects inconsistent growth-window bounds',async()=>{
  const root=await fixture();try{
    const result=await applyRequest({root,body:body({'Request type':'Default analysis setting','Default setting':'Minimum log-phase signal','New default value':'0.8','Release preference':'Automatic when supported and tests pass'})});
    assert.equal(result.status,'manual-review');
  }finally{await rm(root,{recursive:true,force:true})}
});

test('changes only approved theme variables',async()=>{
  const root=await fixture();try{
    const result=await applyRequest({root,body:body({'Request type':'Theme color','Theme color':'Primary green','New color':'#244c38','Release preference':'Open a change for review before release'})});
    assert.equal(result.status,'auto-change');assert.equal(result.release,'review');
    assert.match(await readFile(path.join(root,'styles.css'),'utf8'),/--green:#244c38/);
  }finally{await rm(root,{recursive:true,force:true})}
});

test('novel feature requests are queued rather than guessed',async()=>{
  const root=await fixture();try{
    const result=await applyRequest({root,body:body({'Request type':'New feature / analysis','Release preference':'Automatic when supported and tests pass'})});
    assert.equal(result.status,'manual-review');assert.equal(result.changedFiles.length,0);
  }finally{await rm(root,{recursive:true,force:true})}
});
