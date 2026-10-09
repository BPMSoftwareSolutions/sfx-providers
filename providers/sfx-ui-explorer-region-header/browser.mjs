import {el} from 'shared:circuit-viewer.js';
import {configureHost,asset} from 'shared:host.js';
import {createRegionRuntime} from 'shared:region-runtime.js';
export function headerSlots() {
  const brand = el('a', { class: 'brand', href: '/circuit/home', 'aria-label': 'SFX Live Circuit Platform home' });
  brand.append(el('img', { src: asset('sfx-logo-wordmark.png'), alt: 'SFX' }), el('span', { class: 'divider' }), el('span', { class: 'label', text: 'Live Circuit Platform' }));
  const nav = el('span', { class: 'site-nav' }, [el('a', { href: '/circuit/home', text: 'Home' })]);
  nav.append(el('a', { href: '/circuit/explorer', text: 'Explorer', 'aria-current': 'page' }));
  return {
    brand: () => [brand],
    'primary-navigation': () => [nav],
    'environment-label': () => [el('span', { class: 'env', id: 'env', hidden: '' })],
    'identity-session-mount': () => [el('span', { id: 'identity' })]
  };
}

export async function mount(root,{host}={}){configureHost(host);return createRegionRuntime({root,regionId:"header",slots:headerSlots()});}
