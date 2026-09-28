import {createHash} from 'node:crypto';

const pointer=s=>s.replaceAll('~','~0').replaceAll('/','~1');
// Retain object construction shape, not literals or a second expression evaluator.
// Unsupported expressions remain unknown; absence is asserted only in closed objects.
export function resultShape(expression,path='/expression',depth=0){
 if(depth>30||expression?.op!=='object'||!expression.fields||Array.isArray(expression.fields))return {kind:'unknown',expressionPath:path};
 return {kind:'object',expressionPath:path,fields:Object.fromEntries(Object.entries(expression.fields).map(([key,value])=>[key,resultShape(value,path+'/fields/'+pointer(key),depth+1)]))};
}

export function invocationCondition(config={}){
 if(!Object.hasOwn(config,'invocationCondition'))return null;
 const c=config.invocationCondition,object=c&&typeof c==='object'&&!Array.isArray(c);
 const type=object&&Object.hasOwn(c,'equals')?(c.equals===null?'null':typeof c.equals):'absent';
 const path=object&&typeof c.path==='string'?c.path:'';
 const safeEnum=type==='string'&&/^[A-Z][A-Z0-9_]{0,63}$/.test(c.equals)&&!/secret|token|password|credential/i.test(path);
 return {path,equalsType:type,equalsLabel:safeEnum?c.equals:['number','boolean','null'].includes(type)?String(c.equals):'['+type+' value withheld]',
  equalsDigest:createHash('sha256').update(JSON.stringify(object?c.equals??null:null)).digest('hex'),
  whenFalse:object&&typeof c.whenFalse==='string'?c.whenFalse:'',
  supported:!!(object&&path&&Object.hasOwn(c,'equals')&&c.whenFalse==='preserve-carrier')};
}

export function pathInShape(shape,path){
 // This inspection supports simple dotted property paths only. JSON pointers,
 // array selectors, and opaque descendants cannot prove a path absent.
 if(typeof path!=='string'||!/^\w+(?:\.\w+)*$/.test(path))return 'unknown';
 let at=shape;
 for(const part of path.split('.')){
  if(at?.kind!=='object')return 'unknown';
  if(!Object.hasOwn(at.fields,part))return 'absent';
  at=at.fields[part];
 }
 return 'present';
}

export function inspectInvocationPaths(snapshot){
 const findings=[];
 for(const a of snapshot.authorities)for(const [index,op]of a.operations.entries()){
  const binding=snapshot.bindings.find(b=>b.portId===op.portId),guard=binding?.invocationCondition;
  if(!guard?.supported)continue;
  const previous=a.operations[index-1],priorBinding=snapshot.bindings.find(b=>b.portId===previous?.portId);
  const transform=snapshot.transformations.find(t=>t.id===priorBinding?.transformationId);
  // Only an immediately preceding, unconditional whole-value transformation
  // establishes a known carrier here. Never carry shape through SQL, providers,
  // nested calls, conditional operations or declared result mappings.
  if(previous?.kind!=='invoke-port'||priorBinding?.invocationCondition||!transform||
   ['inputPath','outputPath','resultPath','resultMode'].some(k=>priorBinding.selectors?.[k]))continue;
  const originId=`operation:${a.id}:${previous.ordinal}`,nodeId=`operation:${a.id}:${op.ordinal}`;
  const refs=[op.sourceRef,binding.sourceRef+'/configuration/invocationCondition',previous.sourceRef,transform.sourceRef+(transform.resultShape?.expressionPath??'/expression')];
  const evidence={basis:'immediately preceding declared object transformation',originOperationId:originId,originOrdinal:previous.ordinal,transformationId:transform.id,execution:'not-observed'};
  if(guard.equalsType!=='null'&&pathInShape(transform.resultShape,guard.path)==='absent')findings.push({
   severity:'error',code:'INVOCATION_CONDITION_PATH_ABSENT',
   message:`Operation ${op.ordinal}: gate path ${guard.path} is absent from operation ${previous.ordinal}'s declared output. Requires ${guard.equalsLabel}; false preserves the carrier and skips invocation.`,
   nodeIds:[nodeId,'binding:'+op.portId],sourceRefs:refs,evidence:{...evidence,path:guard.path,condition:guard},
  });
  const requestPath=binding.selectors?.requestPath;
  if(pathInShape(transform.resultShape,requestPath)==='absent')findings.push({
   severity:'error',code:'INVOCATION_REQUEST_PATH_ABSENT',
   message:`Operation ${op.ordinal}: request path ${requestPath} is absent from operation ${previous.ordinal}'s declared output. If the gate opens, this request selector still cannot supply the invocation input.`,
   nodeIds:[nodeId,'binding:'+op.portId],sourceRefs:[...refs,binding.sourceRef+'/configuration/requestPath'],evidence:{...evidence,path:requestPath,conditional:true},
  });
 }
 return findings;
}
