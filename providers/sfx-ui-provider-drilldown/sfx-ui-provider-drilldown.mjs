// ui-runtime-provider.v1 — realization of the existing declared page/view vocabulary.
import {readFileSync} from 'node:fs';
import {browserPackage} from '../../src/ui-providers/browser-assets.mjs';
import {validatePage} from '../../src/ui-providers/browser/page-runtime.js';
import {bindViewSelection} from './selection.mjs';

export const providerId='sfx-ui-provider-drilldown';
export const toolId='ui.view.prepare';
export const MAX_REQUEST_BYTES=1048576;
const schema=JSON.parse(readFileSync(new URL('../../src/ui-providers/contracts/ui-page.v1.json',import.meta.url),'utf8'));
export const inputShape={contractId:'ui-page.v1',status:'DECLARED',schema};
export const outputShape={contractId:'ui-page.v1',status:'DECLARED',schema};
export const descriptor={moduleContractId:'ui-runtime-provider.v1',providerId,package:`providers/${providerId}`,version:'0.1.0',runtime:'node',type:'ui-runtime',method:'in-process',executionLocation:'browser-runtime',declarationProfile:'sfx-provider-catalog.v1',nativeShape:'candidate',bindingState:'UNBOUND',readiness:{declaration:'REVIEWABLE',execution:'HELD'},contractStatus:{input:'DECLARED',output:'DECLARED'},operations:[{operationId:toolId,inputContractId:'ui-page.v1',outputContractId:'ui-page.v1',effect:'READ_ONLY'}]};
// The installed drill-down circuit still uses its declared reader. This package
// prepares that reader's returned document; it does not create a replacement view.
export const capabilities=[];
export const browser=browserPackage(import.meta.url,{exports:['mount','bindViewSelection','readView','createViewRuntime','validateView']});

export function invoke(input,options={}) {
  const started=performance.now(),requestBytes=options.requestBytes??Buffer.byteLength(JSON.stringify(input)??'');
  const finish=(candidate,findings=[])=>({providerId,toolId,providerExecution:'deterministic',elapsedMs:Math.round(performance.now()-started),requestBytes,disposition:findings.length?'HELD':'AUTHORED',candidate:findings.length?null:candidate,shapeConforms:!findings.length,findings});
  const refusal=(code,message)=>finish(null,[{code,path:'$',message}]);
  if(requestBytes>MAX_REQUEST_BYTES)return refusal('UI_VIEW_REQUEST_OVERSIZED',`Maximum request size is ${MAX_REQUEST_BYTES} bytes.`);
  if(!input||typeof input!=='object'||Array.isArray(input)||input.contractId!=='ui-page.v1'
    ||typeof input.path!=='string'||!input.path||input.path.length>400
    ||!/^[a-f0-9]{64}$/.test(input.readingDefinitionSha256??'')||typeof input.readAt!=='string'
    ||!['READ','NOT_FOUND','NOT_DECLARED','SNAPSHOT_CHANGED'].includes(input.status))return refusal('UI_VIEW_REQUEST_INVALID','Supply the declared ui-page.v1 reader result.');
  if(input.status!=='READ')return refusal('UI_VIEW_NOT_READ',`The declared view reader returned ${input.status}.`);
  if(input.viewContractId!=='ui-view.v1'||typeof input.viewId!=='string'||!input.viewId
    ||!Array.isArray(input.sections)||!input.layout||typeof input.layout!=='object')return refusal('UI_VIEW_REQUEST_INVALID','A READ drill-down must carry its declared ui-view.v1 identity, layout and sections.');
  const candidate=bindViewSelection(structuredClone(input),options.selection??{});
  const check=validatePage(candidate);
  if(!check.ok)return finish(null,check.refusals.map(({code,detail})=>({code,path:'$',message:detail})));
  return finish(candidate);
}
export {invoke as handle};
