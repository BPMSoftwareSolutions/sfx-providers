// ui-runtime-provider.v1 — one package for the declared provider sfx-ui-explorer-region-left-sidebar.
import {createRegionProvider} from '../../src/ui-providers/region-provider.mjs';
const provider=createRegionProvider({providerId:"sfx-ui-explorer-region-left-sidebar",version:"0.1.0",packageUrl:import.meta.url,definition:{
  "regionId": "left-sidebar",
  "regionProviderId": "sfx-ui-explorer-region-left-sidebar",
  "capabilityId": "ui-region-left-sidebar",
  "platformCapabilityId": "sda-ui-explorer-region-left-sidebar-port.v1",
  "role": "navigate-and-select",
  "place": 2,
  "basis": "ui-explorer-region-blueprint.md:126-171; ui-circuit-blueprint-strategy.md:68; live-circuit/circuit/explorer.html:188-191"
}});
export const {providerId,toolId,MAX_REQUEST_BYTES,REQUEST_CONTRACT_ID,OUTPUT_CONTRACT_ID,MANIFEST_CONTRACT_ID,MANIFEST_ID,REGION_IDS,descriptor,regions,capabilities,contentManifest,inputShape,outputShape,invoke,handle}=provider;

import {browserPackage} from '../../src/ui-providers/browser-assets.mjs';
export const browser=browserPackage(import.meta.url,{"exports":["mount"],"styles":[],"assets":[],"dependencies":{}});
