// ui-runtime-provider.v1 — one package for the declared provider sfx-ui-explorer-region-right-sidebar.
import {createRegionProvider} from '../../src/ui-providers/region-provider.mjs';
const provider=createRegionProvider({providerId:"sfx-ui-explorer-region-right-sidebar",version:"0.1.0",packageUrl:import.meta.url,definition:{
  "regionId": "right-sidebar",
  "regionProviderId": "sfx-ui-explorer-region-right-sidebar",
  "capabilityId": "ui-region-right-sidebar",
  "platformCapabilityId": "sda-ui-explorer-region-right-sidebar-port.v1",
  "role": "context-inspection-and-evidence",
  "place": 4,
  "basis": "ui-explorer-region-blueprint.md:225-273; ui-circuit-blueprint-strategy.md:70; live-circuit/circuit/explorer.html:259-300"
}});
export const {providerId,toolId,MAX_REQUEST_BYTES,REQUEST_CONTRACT_ID,OUTPUT_CONTRACT_ID,MANIFEST_CONTRACT_ID,MANIFEST_ID,REGION_IDS,descriptor,regions,capabilities,contentManifest,inputShape,outputShape,invoke,handle}=provider;

import {browserPackage} from '../../src/ui-providers/browser-assets.mjs';
export const browser=browserPackage(import.meta.url,{"exports":["mount"],"styles":[],"assets":[],"dependencies":{}});
