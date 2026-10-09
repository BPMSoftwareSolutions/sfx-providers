import {configureHost,asset} from 'shared:host.js';
// The shared declared-footer mount. Every chrome-bearing page (Explorer, home,
// sign-in and declared pages) mounts the same ui-shell-footer region through
// the host's ui.region.load; the shell supplies only the behavior it always
// owned — the wordmark asset, the credit copy, the page links and the release
// label. There is no fallback: a footer that cannot be read, validated or
// projected renders its named failure state and never the hand-authored
// .site-footer it replaced.
import { el } from 'shared:circuit-viewer.js';
import { createRegionRuntime, FOOTER_REGION_ID } from 'shared:region-runtime.js';

export const FOOTER_NAVIGATION = [
  { href: '/circuit/home', label: 'Home' },
  { href: '/circuit/login', label: 'Sign in' },
  { href: '/circuit/explorer', label: 'Live Circuit' },
  { href: '/healthz', label: 'Status' }
];

export function footerSlots(links = FOOTER_NAVIGATION) {
  return {
    'footer-brand': () => [el('img', { src: asset('sfx-logo-wordmark.png'), alt: 'SFX' })],
    'footer-credit': () => [el('span', { class: 'credit', text: 'SideFX / a BPM Intelligence product' })],
    'footer-navigation': () => [el('nav', { class: 'links', 'aria-label': 'Footer' }, links.map(link => el('a', { href: link.href, text: link.label })))],
    'release-label': () => [el('span', { class: 'release', id: 'release' })]
  };
}

export async function mountFooter(links) {
  const root = document.getElementById('region-footer');
  if (!root) return null;
  return createRegionRuntime({ root, regionId: FOOTER_REGION_ID, slots: footerSlots(links) });
}

export async function mount(root,{host,links}={}){configureHost(host);return createRegionRuntime({root,regionId:FOOTER_REGION_ID,slots:footerSlots(links)});}
