// ui-runtime-provider.v1 — one package for the declared provider sfx-ui-explorer-region-middle.
import {createRegionProvider} from '../../src/ui-providers/region-provider.mjs';
const provider=createRegionProvider({providerId:"sfx-ui-explorer-region-middle",version:"0.1.0",packageUrl:import.meta.url,definition:{
  "regionId": "middle",
  "regionProviderId": "sfx-ui-explorer-region-middle",
  "capabilityId": "ui-region-middle",
  "platformCapabilityId": "sda-ui-explorer-region-middle-port.v1",
  "role": "scenario-circuit-canvas-and-execution",
  "place": 3,
  "basis": "ui-explorer-region-blueprint.md:172-224; ui-circuit-blueprint-strategy.md:69; live-circuit/circuit/explorer.html:193-257,302"
}});
export const {providerId,toolId,MAX_REQUEST_BYTES,REQUEST_CONTRACT_ID,OUTPUT_CONTRACT_ID,MANIFEST_CONTRACT_ID,MANIFEST_ID,REGION_IDS,descriptor,regions,capabilities,contentManifest,inputShape,outputShape,invoke,handle}=provider;

import {browserPackage} from '../../src/ui-providers/browser-assets.mjs';
export const browser=browserPackage(import.meta.url,{"exports":["mount","mountExplorer"],"styles":["shared:site.css","shared:circuit-canvas.css","shared:run-evidence.css","workspace.css"],"assets":[],"dependencies":{"sfx-ui-explorer-region-header":"0.1.0","sfx-ui-explorer-region-left-sidebar":"0.1.0","sfx-ui-explorer-region-right-sidebar":"0.1.0","sfx-ui-shell-footer":"0.2.0","sfx-ui-provider-drilldown":"0.1.0"}});
