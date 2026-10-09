import {el} from 'shared:circuit-viewer.js';
import {configureHost,asset} from 'shared:host.js';
import {createRegionRuntime} from 'shared:region-runtime.js';
export function rightSidebarSlots() {
  const tab = (id, name, label, controls, selected) => el('button', { class: 'tab', id, 'data-context-tab': name, role: 'tab', 'aria-selected': selected ? 'true' : 'false', 'aria-controls': controls, tabindex: selected ? '0' : '-1', text: label });
  const tabs = el('nav', { class: 'tabs context-tabs', role: 'tablist', 'aria-label': 'Run context' }, [
    tab('tab-run', 'run', 'Run', 'context-run', true),
    tab('tab-runs', 'runs', 'Runs', 'context-runs', false),
    tab('tab-evidence', 'evidence', 'Evidence', 'context-evidence', false)]);

  const observe = el('details', { class: 'side-section', id: 'observe-box', open: '' }, [
    el('summary', { text: 'Observe this capability' }),
    el('p', { id: 'payload-contract', class: 'note', text: 'Select a capability to load its input contract.' }),
    el('div', { id: 'payload-fields', class: 'input-fields' }),
    el('label', { class: 'json-label', for: 'payload', text: 'Input JSON · submitted as written; the fields above edit it' }),
    el('textarea', { id: 'payload', spellcheck: 'false', placeholder: 'Enter the capability’s JSON input' }),
    el('div', { class: 'observe-actions' }, [
      el('button', { id: 'observe', class: 'button primary small', type: 'button', disabled: '', text: 'Observe' }),
      el('button', { id: 'payload-template', class: 'button secondary small', type: 'button', disabled: '', text: 'Reset to contract template' })]),
    el('div', { id: 'observe-status', role: 'status', 'aria-live': 'polite' }),
    el('a', { id: 'observe-sign-in', class: 'button secondary small', hidden: '', text: 'Sign in' }),
    el('button', { id: 'observe-resume', class: 'button secondary small', type: 'button', hidden: '', text: 'Resume observation' }),
    el('button', { id: 'observe-external', class: 'button secondary small', type: 'button', hidden: '', text: 'Follow external runs' }),
    el('details', { id: 'observe-result', hidden: '' }, [el('summary', { text: 'API result' }), el('pre', { id: 'observe-output' })]),
    el('details', {}, [el('summary', { text: 'Declared input schema' }), el('pre', { id: 'payload-schema' })])]);

  const runs = el('div', { class: 'runs-history' }, [
    el('h3', { text: 'Your runs' }),
    el('p', { class: 'note', id: 'runs-storage', text: 'Runs admitted in this server session. History is held in memory; a server restart clears it.' }),
    el('label', { class: 'check' }, [el('input', { type: 'checkbox', id: 'runs-all' }), 'All capabilities']),
    el('button', { id: 'runs-refresh', class: 'button secondary small', type: 'button', text: 'Refresh runs' }),
    el('div', { id: 'runs-list', 'aria-live': 'polite' })]);

  const selection = el('section', { class: 'side-section', 'aria-label': 'Selection details' }, [
    el('h3', { text: 'Details' }),
    el('div', { id: 'context-body' }, [el('p', { class: 'note', text: 'Select a section, a row or a circuit component.' })]),
    el('section', { id: 'inspector', 'aria-label': 'Circuit component', hidden: '' })]);
  const authority = el('section', { id: 'declaration-detail', 'aria-label': 'Component authority', hidden: '' });

  return {
    'evidence-tabs': () => [tabs],
    'run-report': () => [el('section', { id: 'run-report', 'aria-label': 'Run report' })],
    'run-steps': () => [el('section', { id: 'run-steps', 'aria-label': 'Execution steps' })],
    'observe-form': () => [observe],
    'runs-history': () => [runs],
    'component-evidence': () => [el('section', { id: 'component-evidence', 'aria-label': 'Captured component evidence' })],
    'selection-details': () => [selection],
    'declared-authority': () => [authority]
  };
}

export async function mount(root,{host}={}){configureHost(host);return createRegionRuntime({root,regionId:"right-sidebar",slots:rightSidebarSlots()});}
