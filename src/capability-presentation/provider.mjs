import { compilePresentation } from '../circuit-presentation/compile.mjs';
import { validate } from '../circuit-presentation/contracts.mjs';
import { validateSnapshot, digest, fail } from './snapshot.mjs';
import { buildCircuitModel, VIEWS } from './model.mjs';
import { buildStoryboard } from './storyboard.mjs';
import { loadEstateReader } from './estate.mjs';

export const providerId = 'sfx-circuit-presentation';
export const toolId = 'presentation.from-capability';
export const MAX_REQUEST_BYTES = 16 * 1024;
export const MAX_OUTPUT_BYTES = 48 * 1024 * 1024;
export const inputShape = {contractId:'capability-presentation-request.v1',status:'PROPOSED',schema:{
  $schema:'https://json-schema.org/draft/2020-12/schema',type:'object',additionalProperties:false,required:['contractId','capabilityId'],
  properties:{contractId:{const:'capability-presentation-request.v1'},capabilityId:{type:'string',minLength:1,maxLength:400},namespaceId:{type:'string',minLength:1,maxLength:400},
    view:{enum:VIEWS},contextAltitude:{oneOf:[{const:'all'},{type:'integer',minimum:1,maximum:11}]},
    objectPrefix:{type:'string',pattern:'^[A-Za-z][A-Za-z0-9_]{4,24}$'}},
}};
export const outputShape = {contractId:'capability-presentation-output.v1',status:'PROPOSED',schema:{
  $schema:'https://json-schema.org/draft/2020-12/schema',type:'object',additionalProperties:false,
  required:['contractId','capabilityId','view','contextAltitude','snapshot','model','storyboard','inference','coverage','volumes','contentDigest'],
  properties:{contractId:{const:'capability-presentation-output.v1'},capabilityId:{type:'string'},view:{enum:VIEWS},contextAltitude:inputShape.schema.properties.contextAltitude,
    snapshot:{},model:{},storyboard:{},inference:{},coverage:{},volumes:{type:'array',minItems:1,maxItems:8},contentDigest:{type:'string',pattern:'^[a-f0-9]{64}$'}},
}};

export async function presentCapability(input, { readEstate, narrator } = {}) {
  validate(input,inputShape.schema);
  readEstate ??= await loadEstateReader();
  const snapshot=validateSnapshot(await readEstate({capabilityId:input.capabilityId,namespaceId:input.namespaceId}));
  if(snapshot.identity.capabilityId!==input.capabilityId||(input.namespaceId&&snapshot.identity.namespaceId!==input.namespaceId))fail('Requested identity does not match the selected snapshot.');
  const view=input.view??'scenario',model=buildCircuitModel(snapshot,view);
  const storyboard=buildStoryboard(snapshot,model,input);
  if(storyboard.slides.length>256)fail('This projection exceeds 256 slides; use a narrower view or context altitude.','CAPABILITY_PRESENTATION_TOO_LARGE');
  let inference={mode:'deterministic-context',applied:0};
  if(narrator){
    // Narrative enrichment gets bounded facts, never credential configuration or
    // executable authority. It can add notes, not change nodes, edges or titles.
    const enrichments=await narrator(structuredClone({capability:snapshot.identity,view,contexts:storyboard.contexts,
      slides:storyboard.slides.map(s=>({id:s.id,title:s.title,evidenceRefs:s.evidenceRefs,context:s.interpretation||s.subtitle}))}));
    if(!Array.isArray(enrichments)||enrichments.length>storyboard.slides.length)fail('Invalid narrator response.');
    const enriched=new Set();
    for(const e of enrichments){
      const slide=storyboard.slides.find(s=>s.id===e.slideId);
      if(!slide||enriched.has(e.slideId)||typeof e.text!=='string'||e.text.length>1000||!Array.isArray(e.evidenceRefs)||!e.evidenceRefs.length||e.evidenceRefs.some(ref=>!slide.evidenceRefs.includes(ref)))fail('Narrative must cite existing evidence on its slide.');
      enriched.add(e.slideId);slide.inferredNarrative={text:e.text,evidenceRefs:e.evidenceRefs};
      slide.notes=slide.notes.slice(0,18000)+'\n\nInferred explanation (not estate authority):\n'+e.text+'\nEvidence: '+e.evidenceRefs.join(', ');
    }
    inference={mode:'host-narrator',applied:enriched.size};
  }
  const coveredNodes=new Set(storyboard.slides.flatMap(s=>s.coverage.nodes)),coveredEdges=new Set(storyboard.slides.flatMap(s=>s.coverage.edges));
  const blueprint=storyboard.blueprint,overview=storyboard.slides.find(s=>s.blueprint?.role==='overview')?.blueprint;
  if(!overview||blueprint.nodes.some(n=>!overview.nodes.includes(n.id))||blueprint.edges.some(e=>!overview.edges.includes(e.id)))fail('The complete blueprint lost a node or edge.','CAPABILITY_BLUEPRINT_INCOMPLETE');
  if(model.nodes.some(n=>!coveredNodes.has(n.id))||model.edges.some(e=>!coveredEdges.has(e.id)))fail('Circuit projection lost a node or edge.','CAPABILITY_COVERAGE_INCOMPLETE');
  const volumes=[];
  for(let i=0;i<storyboard.slides.length;i+=32){
    const subset=storyboard.slides.slice(i,i+32),volume=i/32+1;
    const deck={title:`${snapshot.identity.capabilityId} — ${view} — ${volume}`,slides:subset.map(({title,subtitle,notes,commands})=>({title,subtitle,notes,commands}))};
    const compiled=await compilePresentation({contractId:'circuit-presentation-request.v1',objectPrefix:`${input.objectPrefix??'capability'}_v${volume}`,deck});
    volumes.push({volume,firstSlide:i+1,lastSlide:i+subset.length,presentation:compiled});
  }
  const body={contractId:outputShape.contractId,capabilityId:input.capabilityId,view,contextAltitude:input.contextAltitude??'all',snapshot,model,storyboard,inference,
    coverage:{nodeCount:model.nodes.length,edgeCount:model.edges.length,coveredNodes:coveredNodes.size,coveredEdges:coveredEdges.size,contextLayers:11,blueprint:blueprint.coverage},volumes};
  return {...body,contentDigest:digest(body)};
}

export async function handle(input,options={}) {
  const started=performance.now();
  try {
    if(Buffer.byteLength(JSON.stringify(input)??'')>MAX_REQUEST_BYTES||(options.requestBytes??0)>MAX_REQUEST_BYTES)fail('Request exceeds 16 KiB.','CAPABILITY_REQUEST_OVERSIZED');
    const candidate=await presentCapability(input,options);
    validate(candidate,outputShape.schema);
    if(Buffer.byteLength(JSON.stringify(candidate))>MAX_OUTPUT_BYTES)fail('Presentation output exceeds 48 MiB.','CAPABILITY_PRESENTATION_TOO_LARGE');
    return {providerId,toolId,disposition:'AUTHORED',candidate,elapsedMs:Math.round(performance.now()-started),findings:candidate.model.findings};
  }catch(error){return {providerId,toolId,disposition:'HELD',candidate:null,elapsedMs:Math.round(performance.now()-started),findings:[{code:error.code??'CAPABILITY_PRESENTATION_FAILED',message:String(error.message).slice(0,800)}]};}
}
