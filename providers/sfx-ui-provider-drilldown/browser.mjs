import {configureHost} from 'shared:host.js';
// The provider-owned declared-view implementation for Explorer drill-downs.
//
// A view is a ui-view.v1 document: the same page-shaped members as ui-page.v1
// (layout, sources, sections, actions, events) with the view's own identity
// (viewId, viewDigest). It is read through the deployed page reader
// (`/api/circuit/v1/page?path=/circuit/views/<viewId>`), so a view is published
// data, not a deploy; and it is projected by the same createPageRuntime
// projector and the same 21 ui-component.v1 adapters as a declared page.
//
// The subject is chosen by the Explorer (the capability/namespace/scenario/
// detail selection and snapshot digest) and is bound into the view's declared
// source inputs, so a declaration names no concrete provider. The Explorer
// drill-down reads a view only through this host: a view that is absent or
// unreadable is a named visible state, never a fallback render. There is no
// standalone view page; the drill-down is the only mount point.
import { createPageRuntime, validatePage } from 'shared:page-runtime.js';
import { json } from 'shared:site.js';

export const VIEW_CONTRACT = 'ui-view.v1';
export const DEFAULT_VIEW_ID = 'provider-profile';
const VIEW_PATH_PREFIX = '/circuit/views/';

const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);

// The view selection is the URL. The Explorer carries capability, namespace,
// scenario, detail (the provider detail id) and the circuit snapshot digest; a
// standalone host may name the provider directly.
export function viewSelection(params) {
  const search = params ?? (typeof location === 'undefined' ? new URLSearchParams() : new URLSearchParams(location.search));
  const pick = (...names) => {
    for (const name of names) {
      const value = search.get(name);
      if (value !== null && value !== '') return value;
    }
    return null;
  };
  return {
    viewId: pick('viewId') ?? DEFAULT_VIEW_ID,
    providerId: pick('provider', 'providerId', 'detail', 'detailId'),
    capabilityId: pick('capability', 'capabilityId'),
    namespaceId: pick('namespace', 'namespaceId'),
    scenarioId: pick('scenario', 'scenarioId'),
    detailId: pick('detail', 'detailId'),
    expectedSnapshotDigest: pick('expectedSnapshotDigest', 'snapshotDigest')
  };
}

export function viewPath(viewId = DEFAULT_VIEW_ID) {
  return `${VIEW_PATH_PREFIX}${viewId}`;
}

// The selection becomes the declared sources' input. The viewId never does.
// The host selection wins over the declaration's input: a declaration may carry
// the captured read's identity as a default, but an Explorer selection must
// address the provider being opened.
// Every read/source binding resolves to the same input as its declared source,
// so the runtime issues one fetch per source, never a bare second request.
export {bindViewSelection} from './selection.mjs';
import {bindViewSelection} from './selection.mjs';

// A view declaration is validated by the page validator over its bound document:
// the view inherits the page vocabulary, refusals and limits.
export function validateView(declared, selection) {
  return validatePage(bindViewSelection(declared, selection));
}

// Read the declared view through the deployed page reader. The disposition is
// returned unchanged; the caller decides whether to render it or name a refusal.
// This never synthesizes a view document or renders one.
export async function readView({ viewId = DEFAULT_VIEW_ID, selection } = {}) {
  const chosen = selection ?? viewSelection();
  const query = new URLSearchParams({ path: viewPath(viewId) });
  const response = await json(`/api/circuit/v1/page?${query}`);
  return { ...response, viewId, selection: chosen };
}

// Mount a declared view. The runtime is the page projector over the bound view
// document: the same adapters, bindings, actions, events and refusals apply.
// createPageRuntime is async, so this resolves to the projector before render.
export async function createViewRuntime({ root, document: declared, selection, navigate }) {
  return createPageRuntime({ root, document: bindViewSelection(declared, selection), navigate });
}

export async function mount(root,{host,document,selection,navigate}={}){configureHost(host);const runtime=await createViewRuntime({root,document,selection,navigate});await runtime.render();return runtime;}
