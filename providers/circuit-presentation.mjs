import { compilePresentation } from '../src/circuit-presentation/compile.mjs';
import { REQUEST_ID, OUTPUT_ID, MAX_OUTPUT_BYTES, outputSchema, requestSchema, validate } from '../src/circuit-presentation/contracts.mjs';
export { MAX_REQUEST_BYTES } from '../src/circuit-presentation/contracts.mjs';
import { MAX_REQUEST_BYTES } from '../src/circuit-presentation/contracts.mjs';
export const providerId='sfx-circuit-presentation';
export const toolId='presentation.compile';
export const inputShape={contractId:REQUEST_ID,status:'PROPOSED',schema:requestSchema};
export const outputShape={contractId:OUTPUT_ID,status:'PROPOSED',schema:outputSchema};

// Pure authoring boundary: no caller-chosen files, scripts or network writes.
export async function handle(input,options={}){
  const started=performance.now();let requestBytes=0;
  const envelope=body=>({providerId,toolId,providerExecution:'deterministic',elapsedMs:Math.round(performance.now()-started),requestBytes,...body});
  try{
    requestBytes=Buffer.byteLength(JSON.stringify(input)??'');
    if(requestBytes>MAX_REQUEST_BYTES||(options.requestBytes??0)>MAX_REQUEST_BYTES)throw Object.assign(new Error(`Maximum request size is ${MAX_REQUEST_BYTES} bytes.`),{code:'CIRCUIT_REQUEST_OVERSIZED'});
    const candidate=await compilePresentation(input);
    validate(candidate,outputSchema);
    if(Buffer.byteLength(JSON.stringify(candidate))>MAX_OUTPUT_BYTES)throw Object.assign(new Error(`Maximum compiled output size is ${MAX_OUTPUT_BYTES} bytes.`),{code:'CIRCUIT_OUTPUT_OVERSIZED'});
    return envelope({disposition:'AUTHORED',candidate,shapeConforms:true,findings:[]});
  }catch(error){return envelope({disposition:'HELD',candidate:null,findings:[{code:error.code?.startsWith('CIRCUIT_')?error.code:'CIRCUIT_COMPILE_FAILED',path:'$',message:String(error.message).slice(0,1000)}]});}
}
