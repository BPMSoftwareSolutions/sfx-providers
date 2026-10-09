import {el} from 'shared:circuit-viewer.js';
import {configureHost,asset} from 'shared:host.js';
import {createRegionRuntime} from 'shared:region-runtime.js';
export function leftSidebarSlots() {
  const datalist = el('datalist', { id: 'capabilities' });
  const input = el('input', { id: 'capability', list: 'capabilities', autocomplete: 'off', placeholder: 'Find a capability', 'aria-label': 'Capability' });
  const submit = el('button', { class: 'button secondary small', type: 'submit', text: 'Open' });
  return {
    'capability-search': () => [el('form', { class: 'picker', id: 'picker' }, [input, submit])],
    'capability-picker': () => [datalist],
    'section-navigation': () => [el('div', { id: 'tree-sections', 'aria-label': 'Declared sections' })],
    'group-navigation': () => [el('div', { id: 'tree-groups', 'aria-label': 'Declared groups' })],
    'node-navigation': () => [el('div', { id: 'tree-nodes', 'aria-label': 'Declared nodes' })],
    counts: () => [el('div', { id: 'tree-counts', class: 'tree-summary' })],
    states: () => [el('div', { id: 'tree-states', class: 'tree-summary' })],
    badges: () => [el('div', { id: 'tree-badges', class: 'tree-summary' })]
  };
}

export async function mount(root,{host}={}){configureHost(host);return createRegionRuntime({root,regionId:"left-sidebar",slots:leftSidebarSlots()});}
