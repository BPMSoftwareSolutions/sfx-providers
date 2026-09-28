import {createHash} from 'node:crypto';
import {invocationCondition,precedingObject,shapeAt,pathInShape} from './invocation-evidence.mjs';
const hash=value=>createHash('sha256').update(typeof value==='string'?value:JSON.stringify(value)).digest('hex');
const array=value=>Array.isArray(value)?value:[];

// Retain only the first declared handoff in a pinned application. The rest of
// its graph remains outside this proof, never an implicitly verified circuit.
export function nestedInvocationContext(config={}){
 if(!config.declaredApplication&&!config.bindingRef)return null;
 const doc=config.declaredApplication?.executionPlanDocument;
 const incomplete=reason=>({status:'unverified',reason,scope:'nested entry handoff'});
 if(!doc)return incomplete('Pinned execution plan is not retained.');
 let plan;try{plan=typeof doc==='string'?JSON.parse(doc):doc;}catch{return incomplete('Pinned execution plan is not valid JSON.');}
 if(!plan||typeof plan!=='object')return incomplete('Pinned execution plan is not an object.');
 const nodes=array(plan.nodes),roots=nodes.filter(n=>n.nodeId===plan.rootNodeId);
 if(roots.length!==1)return incomplete('Pinned root node is missing or ambiguous.');
 const root=roots[0],ops=array(root.operations),first=ops[0];
 const base={status:'unverified',scope:'nested entry handoff',planDigest:hash(doc),capabilityId:plan.capabilityId,
  rootNodeId:plan.rootNodeId,inputContractId:root.scenario?.input?.contract?.contractId??'',nodeCount:nodes.length,
  operationCount:ops.length,inspectedOperations:first?1:0,remainingOperationsVerified:false};
 if(first?.kind!=='invoke-port')return {...base,reason:'First nested operation is not a retained port handoff.'};
 const bindings=array(plan.mechanicBindings),matches=bindings.filter(b=>b.bindingId===first.mechanicBindingId);
 if(matches.length!==1)return {...base,reason:'Nested entry binding is missing or ambiguous.'};
 const b=matches[0],c=b.configuration??{},condition=invocationCondition(c);
 if(typeof c.requestPath!=='string'||(condition&&!condition.supported))return {...base,reason:'Nested entry selector or condition is not supported by this inspection.'};
 return {...base,status:'retained',entry:{operationId:first.operationId,kind:first.kind,bindingId:b.bindingId,
  requestPath:c.requestPath,condition,operationRef:`#/nodes/${nodes.indexOf(root)}/operations/0`,
  bindingRef:`#/mechanicBindings/${bindings.indexOf(b)}/configuration/requestPath`}};
}

// A bounded schema proof for the empty-object witness. Unknown schema keywords
// remain unverified; no general JSON Schema evaluator is reconstructed here.
export function emptyObjectEvidence(schema){
 const allowed=new Set(['type','properties','required','additionalProperties','minProperties','maxProperties','$schema','$id','$comment','title','description','definitions','$defs']);
 if(!schema||typeof schema!=='object'||Array.isArray(schema)||Object.keys(schema).some(k=>!allowed.has(k)))return {admitted:null};
 const types=Array.isArray(schema.type)?schema.type:[schema.type];
 if(schema.type!==undefined&&!types.includes('object'))return {admitted:false};
 if(schema.required!==undefined&&(!Array.isArray(schema.required)||schema.required.length))return {admitted:false};
 if((schema.minProperties??0)>0||(schema.maxProperties??Infinity)<0)return {admitted:false};
 return {admitted:true,witness:{},rule:'empty-object-schema-witness.v1'};
}

export function inspectBoundaries(snapshot){
 const findings=[];
 for(const a of snapshot.authorities)for(const [index,op]of a.operations.entries()){
  const binding=snapshot.bindings.find(b=>b.portId===op.portId),nested=binding?.nestedInvocation;
  if(!nested)continue;
  const nodeId=`operation:${a.id}:${op.ordinal}`,refs=[op.sourceRef,binding.sourceRef];
  const producer=precedingObject(snapshot,a,index);
  const supplied=producer?shapeAt(producer.transform.resultShape,binding.selectors?.requestPath):null;
  if(nested.status!=='retained'||!supplied){
   findings.push({severity:'warning',code:'NESTED_INVOCATION_INPUT_UNVERIFIED',message:`Operation ${op.ordinal}: nested input compatibility is unverified. ${nested.reason??'The supplied request shape is not statically known.'}`,
    nodeIds:[nodeId,'binding:'+op.portId],sourceRefs:refs,evidence:{scope:nested.scope,execution:'not-observed'}});continue;
  }
  const entry=nested.entry,verdict=entry.requestPath==='.'?'present':pathInShape(supplied,entry.requestPath);
  if(verdict==='present')continue;
  if(verdict==='unknown'){
   findings.push({severity:'warning',code:'NESTED_INVOCATION_INPUT_UNVERIFIED',message:`Operation ${op.ordinal}: nested selector ${entry.requestPath} cannot be proven from the retained request shape.`,nodeIds:[nodeId,'binding:'+op.portId],sourceRefs:refs,evidence:{scope:nested.scope,execution:'not-observed'}});continue;
  }
  const conditional=!!(binding.invocationCondition||entry.condition),docRef=binding.sourceRef+'/configuration/declaredApplication/executionPlanDocument';
  findings.push({severity:'error',code:'NESTED_INVOCATION_REQUEST_PATH_ABSENT',
   message:`Operation ${op.ordinal}: ${binding.selectors.requestPath} lacks ${entry.requestPath}, required by ${nested.capabilityId} / ${entry.operationId}. ${conditional?'If its guards allow entry, this handoff fails.':'The nested entry handoff fails before downstream provider dispatch.'}`,
   nodeIds:[nodeId,'binding:'+op.portId],sourceRefs:[...refs,producer.previous.sourceRef,producer.transform.sourceRef+supplied.expressionPath,docRef+entry.operationRef,docRef+entry.bindingRef],
   evidence:{path:entry.requestPath,outerRequestPath:binding.selectors.requestPath,nestedCapabilityId:nested.capabilityId,nestedOperationId:entry.operationId,
    nestedBindingId:entry.bindingId,suppliedFields:Object.keys(supplied.fields??{}),conditional,execution:'not-observed',
    proof:{rule:'closed-object-path-absence.v1',verdict:'disproved',property:'nested entry selector is defined',scope:nested.scope,
     sourceExpressionDigest:producer.transform.expressionDigest,planDigest:nested.planDigest,remainingOperationsVerified:false}}});
 }
 for(const i of snapshot.interfaces){
  if(!i.displaySelect?.startsWith('outcome.')||i.displayTransformationId)continue;
  const sc=snapshot.scenarios.find(s=>s.id===(i.rootScenarioId||snapshot.identity.rootScenarioId));
  const contract=snapshot.contracts.find(c=>c.id===sc?.outcomeContractId);
  if(!sc||contract?.emptyObjectEvidence?.admitted!==true)continue;
  const path=i.displaySelect.slice('outcome.'.length);
  if(!/^\w+(?:\.\w+)*$/.test(path))continue;
  findings.push({severity:'error',code:'CLI_DISPLAY_SELECTOR_NOT_TOTAL',
   message:`CLI selector ${i.displaySelect} is not defined for every allowed outcome. Contract ${contract.id} admits {}, which has no ${path}; this selection renders null and can hide failure details.`,
   nodeIds:['outcome:'+sc.id],sourceRefs:[i.sourceRef+'/configuration/display',contract.sourceRef],
   evidence:{path:i.displaySelect,interfaceId:i.id,contractId:contract.id,execution:'not-observed',
    proof:{rule:'display-selector-totality.v1',verdict:'disproved',property:'display selector is defined for every allowed outcome',
     schemaDigest:contract.schemaDigest,interfaceDigest:i.configurationDigest,witness:{},witnessAdmitted:true,selectedValue:null}}});
 }
 return findings;
}
