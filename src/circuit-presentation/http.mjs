import * as provider from '../../providers/circuit-presentation/circuit-presentation.mjs';
import * as capabilityProvider from '../capability-presentation/provider.mjs';
import * as migrationProvider from '../google-slides-migration/workflow.mjs';
export const INVOKE='/circuit-presentation/presentation.compile';
export const HEALTH='/circuit-presentation/health';
export const CAPABILITY_INVOKE='/circuit-presentation/presentation.from-capability';
export const MIGRATION_INVOKE='/circuit-presentation/presentation.to-google-slides';
const send=(res,status,body)=>{res.writeHead(status,{'content-type':'application/json; charset=utf-8'});res.end(JSON.stringify(body));};
export function createCircuitRequestHandler(compiler=provider, capabilityApi=capabilityProvider, migrationApi=migrationProvider){
  return async(req,res,pathname)=>{
    if(![INVOKE,HEALTH,CAPABILITY_INVOKE,MIGRATION_INVOKE].includes(pathname))return false;
    const api=pathname===MIGRATION_INVOKE?migrationApi:pathname===CAPABILITY_INVOKE?capabilityApi:compiler;
    const held=(status,code,message)=>send(res,status,{providerId:api.providerId,toolId:api.toolId,disposition:'HELD',candidate:null,findings:[{code,path:'$',message}]});
    if(req.method==='GET'&&pathname===HEALTH){send(res,200,{status:'ok',providerId:api.providerId,toolId:api.toolId,tools:[api.toolId,capabilityApi.toolId,migrationApi.toolId],implementation:'hand-authored',estateStatus:'not-declared',contractStatus:'PROPOSED',inputContract:api.inputShape.contractId,outputContract:api.outputShape.contractId,maxRequestBytes:api.MAX_REQUEST_BYTES,presets:['sidefx-announcement'],endpoints:{invoke:INVOKE,health:HEALTH,fromCapability:CAPABILITY_INVOKE,toGoogleSlides:MIGRATION_INVOKE}});return true;}
    if(req.method!=='POST'||![INVOKE,CAPABILITY_INVOKE,MIGRATION_INVOKE].includes(pathname)){req.resume();held(405,'CIRCUIT_METHOD_NOT_ALLOWED','Use GET for health or POST for a provider operation.');return true;}
    if(req.headers['content-type']?.split(';')[0].trim().toLowerCase()!=='application/json'){req.resume();held(415,'CIRCUIT_CONTENT_TYPE_INVALID','Use application/json.');return true;}
    let bytes=0;const chunks=[];
    try{
      for await(const chunk of req){bytes+=chunk.length;if(bytes<=api.MAX_REQUEST_BYTES)chunks.push(chunk);else chunks.length=0;}
      if(bytes>api.MAX_REQUEST_BYTES){held(413,'CIRCUIT_REQUEST_OVERSIZED','Request exceeds the provider byte limit.');return true;}
      let input;try{input=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{held(400,'CIRCUIT_REQUEST_INVALID','Expected JSON.');return true;}
      const result=await api.handle(input,{requestBytes:bytes});send(res,['AUTHORED','MIGRATED','NEEDS_REVIEW'].includes(result.disposition)?200:422,result);
    }catch{if(!res.headersSent&&!res.destroyed)held(500,'CIRCUIT_REQUEST_FAILED','Request could not be completed.');}
    return true;
  };
}
