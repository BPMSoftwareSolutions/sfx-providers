import {C} from '../circuit-presentation/design.mjs';

const groups=(a,n)=>Array.from({length:Math.ceil(a.length/n)},(_,i)=>a.slice(i*n,(i+1)*n));
const short=(s,n=85)=>String(s??'').length>n?String(s).slice(0,n-1)+'…':String(s??'');
// Prose keeps punctuation and identifiers. Only visual line breaks are added.
function lines(s,width=78){
  const out=[];for(const paragraph of String(s??'').split('\n')){
    let line='';for(const word of paragraph.split(/\s+/).filter(Boolean).flatMap(w=>w.length>width?w.match(new RegExp(`.{1,${width}}`,'g')):[w])){
      if(line&&(line+' '+word).length>width){out.push(line);line=word;}else line=(line+' '+word).trim();
    }out.push(line);
  }return out;
}
function prosePages(page,title,subtitle,text,refs){
  for(const [index,part]of groups(lines(text),10).entries()){
    const p=page(short(title,65),index?`${subtitle} / continued`:subtitle,refs,text);
    p.text(part.join('\n'),58,155,842,300,18,C.white);
  }
}
function rowsPages(page,title,subtitle,rows,refs){
  // Wrap and paginate instead of dropping long authored descriptions.
  const parts=rows.flatMap(r=>groups(lines(r.text,65),3).map((part,i)=>({...r,label:r.label+(i?' (continued)':''),text:part.join('\n')})));
  for(const group of groups(parts,3)){
    const p=page(short(title,65),subtitle,refs,JSON.stringify(rows,null,2));
    for(const [i,r]of group.entries()){
      const y=148+i*106;p.text(r.label,54,y,163,32,14,r.color??C.amber,true);
      p.add('line',220,y+4,220,y+72,r.color??C.amber,2);
      p.text(r.text,245,y-2,659,87,17,C.white);
    }
  }
}
function authoredScenario(page,sc,subtitle){
  const a=sc.authored??sc,ref=sc.meaningSourceRef||sc.sourceRef;
  if(a.description)prosePages(page,a.name||sc.id,subtitle,a.description,[ref]);
  if(a.steps?.length)rowsPages(page,a.name||sc.id,subtitle,a.steps.map(step=>({label:step.keyword||step.keywordType,text:step.text,color:step.keywordType==='Context'?C.amber:step.keywordType==='Action'?C.blue:C.green})),[ref]);
  for(const step of a.steps??[]){
    if(step.docString?.content)prosePages(page,'Gherkin step attachment',short(a.name||sc.id,105),step.docString.content,[ref]);
    if(step.dataTable?.length)prosePages(page,'Gherkin data table',short(a.name||sc.id,105),step.dataTable.map(row=>row.join('  |  ')).join('\n'),[ref]);
  }
  for(const ex of a.examples??[])prosePages(page,'Gherkin examples',short(ex.name||a.name||sc.id,105),[ex.description,ex.header.join('  |  '),...ex.rows.map(row=>row.join('  |  '))].filter(Boolean).join('\n'),[ref]);
}

export function appendContextSlides({snapshot:s,altitude,page}) {
  switch(altitude){
    case 1:
      for(const f of s.features){
        if(f.sourceText)prosePages(page,'Retained feature writeup',short(f.sourcePath||f.id,105),f.sourceText.split('\n').filter(line=>!/^\s*@/.test(line)).join('\n').trim(),[f.sourceRef,f.sourceContentRef].filter(Boolean));
        for(const sc of f.scenarios??[])authoredScenario(page,sc,`FEATURE SCENARIO / ${f.id} / VERSION ${sc.versionPk}`);
      }break;
    case 2:
      if(s.identity.experiencePromise||s.identity.observableConditions?.length||(s.conditions??[]).length){
        const cs=new Map((s.identity.observableConditions??[]).map(v=>[v.id,v]));for(const c of s.conditions??[])cs.set(c.id,c);
        rowsPages(page,'Experience and observable conditions','SELECTED CAPABILITY DECLARATION',[
          ...(s.identity.experiencePromise?[{label:'Promise',text:s.identity.experiencePromise,color:C.green}]:[]),
          ...[...cs.values()].map(v=>({label:'Condition',text:v.statement||`${v.id}: no retained statement.`}))
        ],[s.identity.meaningSourceRef,...(s.conditions??[]).map(v=>v.sourceRef)]);
      }break;
    case 3:
      for(const sc of s.scenarios)authoredScenario(page,sc,`${sc.owned===false?'CALLED':'SELECTED'} SCENARIO / ${sc.id} / VERSION ${sc.versionPk}`);
      break;
    case 4:
      for(const c of s.contracts){
        const rows=(c.fields??[]).filter(f=>f.path!=='$').map(f=>({label:short(f.path,25),text:[f.type||'type unconstrained',f.required?'required':'optional',f.description,
          ...['minLength','maxLength','minimum','maximum','minItems','maxItems','format','pattern','additionalProperties'].filter(k=>k in f).map(k=>`${k}: ${f[k]}`),
          f.reference?`reference: ${f.reference}`:'',f.enumCount?`${f.enumCount} allowed values`:''
        ].filter(Boolean).join('; '),color:f.required?C.amber:C.violet}));
        if(rows.length)rowsPages(page,'Contract field semantics',short(`${c.id} / extra fields: ${(c.fields??[])[0]?.additionalProperties??'schema default'}`,105),rows,[c.sourceRef]);
      }break;
    case 5:
      rowsPages(page,'Declared roots and selected execution','SAME CAPABILITY / DISTINCT SOURCE DECLARATIONS',[
        {label:'Authority root',text:s.identity.declaredRootScenarioId||'Not retained'},
        {label:'Graph root',text:s.identity.rootScenarioId,color:C.blue},
        {label:'Feature selection',text:s.features.map(f=>`${f.id}@${f.versionPk}: ${f.selectionSource||f.role}`).join('\n')||'No feature returned',color:C.violet}
      ],[s.identity.meaningSourceRef,...s.features.map(f=>f.sourceRef)]);break;
    case 6: break; // The main altitude slide already renders the expression tree.
    case 7:
      for(const a of s.authorities){
        const operations=a.operations;
        if(operations.length<2)continue;
        rowsPages(page,'Execution authority responsibilities',short(a.id,105),operations.map(o=>({label:`Operation ${o.ordinal}`,text:`${o.kind}: ${o.portId||o.scenarioId||o.id}${o.outcomeContractId?`; outcome contract: ${o.outcomeContractId}`:''}`,color:C.amber})),[a.sourceRef,...operations.map(o=>o.sourceRef)]);
      }break;
    case 8:
      for(const b of s.bindings){
        const mappings=Object.entries(b.selectors??{}).filter(([key])=>key.endsWith('Path'));
        for(const group of groups(mappings,4)){
          const p=page('Provider input and result bindings',short(b.portId,105),[b.sourceRef],JSON.stringify(b,null,2));
          p.chip(555,230,320,88,b.platformCapabilityId,C.green,17);
          for(const [i,[key,value]]of group.entries()){
            const y=146+i*75;p.text(key,53,y-8,250,23,12,C.muted);p.chip(52,y+20,260,43,value,C.amber,15);
            p.wire([[319,y+42],[438,y+42],[438,274],[548,274]],C.violet);p.add('junction',438,274,C.violet,4);
          }
          p.text('Declared configuration selectors',550,348,344,35,14,C.muted);
        }
        const controls=Object.entries(b.selectors??{}).filter(([k])=>!k.endsWith('Path'));
        if(controls.length)rowsPages(page,'Provider authority and lineage',short(b.platformCapabilityId,105),controls.map(([label,text])=>({label:short(label,23),text})),[b.sourceRef]);
      }break;
    case 9:
      for(const i of s.interfaces)if(i.rootScenarioId||i.inputType||i.displayAs)rowsPages(page,'CLI input and display contract',short(i.id,105),[
        {label:'Input',text:`${i.inputType||'Not retained'} through ${i.platformCapabilityId||i.profile}`,color:C.amber},
        {label:'Root scenario',text:i.rootScenarioId||'Not retained',color:C.blue},
        {label:'Output',text:`select ${i.displaySelect||'not retained'}; render ${i.displayAs||'not retained'}`,color:C.green}
      ],[i.sourceRef]);break;
    case 10:
      for(const f of s.fixtures)if(f.assertions?.length)rowsPages(page,'Fixture assertions',short(`${f.id} / ${f.caseId} / expected ${f.expectedDisposition}`,105),f.assertions.map(a=>({label:a.operator,text:`${a.path}${a.conditionId?` / condition: ${a.conditionId}`:''} / expected value digest: ${a.expectedDigest||'not retained'}`})),[f.sourceRef]);
      if(s.obligations.length)rowsPages(page,'Proof obligations','DECLARED STATEMENTS / NO EXECUTION RESULT INFERRED',s.obligations.map(o=>({label:short(o.id,25),text:o.statement||o.kind})),s.obligations.map(o=>o.sourceRef));
      break;
    case 11: break; // The main slide pages through every check, including gaps.
  }
}
