import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {startUiProviderHost} from '../ui-providers-host.mjs';
import {prepareBrowserProviders} from '../src/ui-providers/browser-client.mjs';
let host,baseUrl,pins;
before(async()=>{host=await startUiProviderHost({port:0,host:'127.0.0.1'});baseUrl=`http://127.0.0.1:${host.port}`;pins=(await(await fetch(baseUrl+'/ui-providers')).json()).providers;});
after(async()=>{await new Promise(resolve=>host.server.close(resolve));});
test('all six UI implementations load from verified provider manifests and assets',async()=>{
  const blobs=[],revoked=[];
  const loaded=await prepareBrowserProviders({baseUrl,pins,createUrl:blob=>{blobs.push(blob);return `blob:test-${blobs.length}`;},revokeUrl:url=>revoked.push(url)});
  assert.equal(loaded.entries.size,6);
  assert(loaded.entries.has('sfx-ui-provider-drilldown'));
  assert(loaded.entries.has('sfx-ui-explorer-region-middle'));
  assert(loaded.styles.length>=4);
  const sources=await Promise.all(blobs.filter(b=>b.type==='text/javascript').map(b=>b.text()));
  // Parsing every delivered module catches extraction errors even in exports
  // that the mount fixture does not call (for example mountExplorer).
  for(const source of sources) execFileSync(process.execPath,['--input-type=module','--check'],{input:source,stdio:['pipe','pipe','pipe']});
  const code=sources.join('\n');
  assert.doesNotMatch(code,/(?:from\s*|import\s*)['"](?:shared:|provider:|\.\.?\/)/);
  assert.equal((code.match(/export function configureHost/g)??[]).length,1,'Shared host ports must be one module across packages');
  loaded.dispose();assert.equal(revoked.length,blobs.length);
});
test('missing or wrong dependency selections refuse before any code is materialized',async()=>{
  for(const chosen of [pins.filter(p=>p.providerId!=='sfx-ui-provider-drilldown'),pins.map(p=>p.providerId==='sfx-ui-provider-drilldown'?{...p,version:'999'}:p)]) {
    let materialized=0;
    await assert.rejects(prepareBrowserProviders({baseUrl,pins:chosen,createUrl:()=>{materialized++;return 'blob:no';}}),/UI_BROWSER_DEPENDENCY_UNSELECTED|UI_PROVIDER_READ_FAILED/);
    assert.equal(materialized,0);
  }
});
test('tampered manifests and assets refuse before any executable URL exists',async()=>{
  for(const target of ['manifest','asset']) {
    let changed=false,materialized=0;
    const request=async url=>{
      const response=await fetch(url);
      if(!changed&&url.includes(target==='manifest'?'/manifest?':'/assets/')) {
        changed=true;
        if(target==='manifest'){const body=await response.json();body.identity.package='tampered';return Response.json(body);}
        return new Response('tampered');
      }
      return response;
    };
    await assert.rejects(prepareBrowserProviders({baseUrl,pins,request,createUrl:()=>{materialized++;return 'blob:no';}}),/UI_PROVIDER_(?:MANIFEST|ASSET)_DIGEST_MISMATCH/);
    assert(changed);assert.equal(materialized,0);
  }
});
