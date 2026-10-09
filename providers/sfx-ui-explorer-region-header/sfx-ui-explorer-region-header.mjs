// ui-runtime-provider.v1 — one package for the declared provider sfx-ui-explorer-region-header.
import {createRegionProvider} from '../../src/ui-providers/region-provider.mjs';
const provider=createRegionProvider({providerId:"sfx-ui-explorer-region-header",version:"0.1.0",packageUrl:import.meta.url,definition:{
  "regionId": "header",
  "regionProviderId": "sfx-ui-explorer-region-header",
  "capabilityId": "ui-region-header",
  "platformCapabilityId": "sda-ui-explorer-region-header-port.v1",
  "role": "shell-chrome",
  "place": 1,
  "basis": "ui-explorer-region-blueprint.md:81-125; ui-circuit-blueprint-strategy.md:67; live-circuit/circuit/explorer.html:180-186"
}});
export const {providerId,toolId,MAX_REQUEST_BYTES,REQUEST_CONTRACT_ID,OUTPUT_CONTRACT_ID,MANIFEST_CONTRACT_ID,MANIFEST_ID,REGION_IDS,descriptor,regions,capabilities,contentManifest,inputShape,outputShape,invoke,handle}=provider;

import {browserPackage} from '../../src/ui-providers/browser-assets.mjs';
export const browser=browserPackage(import.meta.url,{"exports":["mount"],"styles":[],"assets":["shared:sfx-logo-wordmark.png"],"dependencies":{}});
