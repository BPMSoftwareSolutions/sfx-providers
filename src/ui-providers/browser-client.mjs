// Reference consumer for independent provider verification. Selection is supplied
// by the caller; discovery does not confer admission or choose a provider version.
const digest = async bytes => 'sha256:' + [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(b => b.toString(16).padStart(2, '0')).join('');
const encode = value => new TextEncoder().encode(value);
const fail = (code, detail) => { throw new Error(`${code}: ${detail}`); };
const imports = /^\s*(?:import|export)\s+(?:[^;\n]*?\sfrom\s*)?['"]([^'"]+)['"]/gm;

export async function prepareBrowserProviders({baseUrl, pins, request=fetch, createUrl=blob=>URL.createObjectURL(blob), revokeUrl=url=>URL.revokeObjectURL(url)}) {
  const base = new URL(baseUrl), selections = new Map(pins.map(pin=>[pin.providerId,pin]));
  if(selections.size!==pins.length) fail('UI_PROVIDER_SELECTION_INVALID','Duplicate provider identity');
  const manifests=new Map(), records=new Map(), pending=new Map(), urls=new Map(), created=[];
  const absolute = value => {
    const url = new URL(value,base);
    if(url.origin!==base.origin) fail('UI_PROVIDER_ASSET_ORIGIN_INVALID',value);
    return url.href;
  };
  async function read(url) {
    const response=await request(absolute(url));
    if(!response.ok) fail('UI_PROVIDER_READ_FAILED',`${response.status} ${url}`);
    return response;
  }
  await Promise.all(pins.map(async pin=>{
    if(!pin.version||!/^sha256:[a-f0-9]{64}$/.test(pin.manifestDigest??'')) fail('UI_PROVIDER_SELECTION_INVALID',pin.providerId);
    const manifest=await (await read(`/ui-providers/${encodeURIComponent(pin.providerId)}/manifest?version=${encodeURIComponent(pin.version)}`)).json();
    const {digest:claimed,...body}=manifest;
    if(claimed!==pin.manifestDigest||await digest(encode(JSON.stringify(body)))!==claimed) fail('UI_PROVIDER_MANIFEST_DIGEST_MISMATCH',pin.providerId);
    if(manifest.identity?.providerId!==pin.providerId||manifest.version?.version!==pin.version) fail('UI_PROVIDER_SELECTION_MISMATCH',pin.providerId);
    const assets=new Map(manifest.integrity.assets.map(asset=>[asset.assetId,asset]));
    if(assets.size!==manifest.integrity.assets.length) fail('UI_PROVIDER_MANIFEST_INVALID',pin.providerId);
    manifests.set(pin.providerId,{manifest,assets});
  }));
  for(const {manifest} of manifests.values()) for(const dependency of manifest.entrypoint.browser?.dependencies??[])
    if(selections.get(dependency.providerId)?.version!==dependency.version) fail('UI_BROWSER_DEPENDENCY_UNSELECTED',`${dependency.providerId}@${dependency.version}`);
  async function asset(providerId,assetId) {
    const key=JSON.stringify([providerId,assetId]);
    if(records.has(key))return records.get(key);
    if(pending.has(key))return pending.get(key);
    const promise=(async()=>{
      const declared=manifests.get(providerId)?.assets.get(assetId);
      if(!declared)fail('UI_BROWSER_ASSET_UNDECLARED',key);
      const bytes=new Uint8Array(await (await read(declared.url)).arrayBuffer());
      if(bytes.byteLength!==declared.bytes||await digest(bytes)!==declared.digest)fail('UI_PROVIDER_ASSET_DIGEST_MISMATCH',key);
      const record={...declared,key,providerId,bytes};records.set(key,record);
      await Promise.all((declared.imports??[]).map(edge=>asset(edge.providerId??providerId,edge.assetId)));
      return record;
    })();
    pending.set(key,promise);return promise;
  }
  // Verify the entire published browser closure before producing executable URLs.
  await Promise.all([...manifests].flatMap(([id,{manifest}])=>manifest.integrity.assets.filter(a=>a.assetId.startsWith('browser/')||a.assetId.startsWith('shared/')).map(a=>asset(id,a.assetId))));
  const shared=new Map(), active=new Set();
  async function materialize(providerId,assetId) {
    const record=records.get(JSON.stringify([providerId,assetId]));
    if(!record)fail('UI_BROWSER_ASSET_UNVERIFIED',`${providerId}/${assetId}`);
    if(urls.has(record.key))return urls.get(record.key);
    if(active.has(record.key))fail('UI_BROWSER_IMPORT_CYCLE',record.key);
    active.add(record.key);
    const replacements=new Map();
    for(const edge of record.imports??[])replacements.set(edge.specifier,await materialize(edge.providerId??providerId,edge.assetId));
    const identity=JSON.stringify([record.digest,[...replacements]]);
    let url=shared.get(identity);
    if(!url) {
      let bytes=record.bytes;
      if(record.kind==='javascript') {
        const source=new TextDecoder().decode(bytes), seen=new Set();
        const rewritten=source.replace(imports,(whole,specifier)=>{
          if(!replacements.has(specifier))fail('UI_BROWSER_IMPORT_UNDECLARED',specifier);
          seen.add(specifier);return whole.replace(/(['"])[^'"]+\1$/,JSON.stringify(replacements.get(specifier)));
        });
        if(seen.size!==replacements.size)fail('UI_BROWSER_IMPORT_MANIFEST_MISMATCH',record.key);
        bytes=encode(rewritten);
      }
      url=createUrl(new Blob([bytes],{type:record.mediaType}));created.push(url);shared.set(identity,url);
    }
    urls.set(record.key,url);active.delete(record.key);return url;
  }
  try {
    const entries=new Map(),styles=new Set(),assets=new Map();
    for(const [id,{manifest}] of manifests) {
      const browser=manifest.entrypoint.browser;
      if(!browser)continue;
      entries.set(id,await materialize(id,browser.assetId));
      for(const style of browser.styles)styles.add(await materialize(id,style));
      for(const item of manifest.integrity.assets.filter(a=>a.kind==='image'))assets.set(item.assetId,await materialize(id,item.assetId));
    }
    return {entries,styles:[...styles],assets,manifests,dispose(){for(const url of created)revokeUrl(url);}};
  } catch(error) {for(const url of created)revokeUrl(url);throw error;}
}
