// ui-runtime-provider.v1 — one package for the declared provider sfx-ui-shell-footer.
import {createRegionProvider} from '../../src/ui-providers/region-provider.mjs';
const provider=createRegionProvider({providerId:"sfx-ui-shell-footer",version:"0.2.0",packageUrl:import.meta.url,definition:{
  "regionId": "footer",
  "regionProviderId": "sfx-ui-shell-footer",
  "capabilityId": "ui-region-footer",
  "platformCapabilityId": "sda-ui-shell-footer-port.v1",
  "role": "shell-chrome",
  "place": 5,
  "basis": "implementation-strategy.md:62-65 header/footer chrome stays shell (D6); landing-blueprint.md §2.4 shell chrome"
}});
export const {providerId,toolId,MAX_REQUEST_BYTES,REQUEST_CONTRACT_ID,OUTPUT_CONTRACT_ID,MANIFEST_CONTRACT_ID,MANIFEST_ID,REGION_IDS,descriptor,regions,capabilities,contentManifest,inputShape,outputShape,invoke,handle}=provider;

import {browserPackage} from '../../src/ui-providers/browser-assets.mjs';
export const browser=browserPackage(import.meta.url,{exports:['mount','footerSlots','mountFooter'],assets:['shared:sfx-logo-wordmark.png']});
