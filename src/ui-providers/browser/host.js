// Injected host ports. Provider UI has no implicit credential or transport reader.
let ports=null;
export function configureHost(value) {
  for(const name of ['request','stream','region','asset'])if(typeof value?.[name]!=='function')throw new Error(`UI_HOST_PORT_MISSING: ${name}`);
  ports=Object.freeze({request:value.request,stream:value.stream,region:value.region,asset:value.asset});
}
function port(name){if(!ports)throw new Error('UI_HOST_NOT_CONFIGURED');return ports[name];}
export const request=(...args)=>port('request')(...args);
export const region=(...args)=>port('region')(...args);
export const asset=(...args)=>port('asset')(...args);
export class HostEventSource {constructor(...args){return port('stream')(...args);}}
