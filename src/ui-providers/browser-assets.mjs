import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

export const SHARED_BROWSER_ROOT = path.resolve(fileURLToPath(new URL('./browser/', import.meta.url)));
const hash = bytes => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;

// A browser package declares its whole static import closure. Shared library files
// are not providers; each package publishes the precise library bytes it uses.
export function browserPackage(moduleUrl, {entry='browser.mjs', exports=[], styles=[], assets=[], dependencies={}}={}) {
  const root=path.dirname(fileURLToPath(moduleUrl)), found=new Map();
  function visit(relative, shared=false) {
    const assetId=(shared?'shared/':'browser/')+relative;
    if(found.has(assetId)) return assetId;
    const base=shared?SHARED_BROWSER_ROOT:root, file=path.resolve(base,relative);
    if(!file.startsWith(base+path.sep)) throw new Error('UI_BROWSER_ASSET_PATH_INVALID');
    const bytes=readFileSync(file), extension=path.extname(relative);
    const mediaType=extension==='.css'?'text/css':extension==='.png'?'image/png':'text/javascript';
    const asset={assetId,path:(shared?'shared/':'')+relative,kind:extension==='.css'?'css':extension==='.png'?'image':'javascript',mediaType,role:extension==='.css'?'style':extension==='.png'?'image':'module',bytes:bytes.length,digest:hash(bytes),imports:[]};
    found.set(assetId,asset);
    if(asset.kind==='javascript') {
      const source=bytes.toString('utf8');
      for(const match of source.matchAll(/^\s*(?:import|export)\s+(?:[^;\n]*?\sfrom\s*)?['"]([^'"]+)['"]/gm)) {
        const specifier=match[1];let target;
        if(specifier.startsWith('shared:')) target={assetId:visit(specifier.slice(7),true)};
        else if(specifier.startsWith('./')||specifier.startsWith('../')) target={assetId:visit(path.posix.normalize(path.posix.join(path.posix.dirname(relative),specifier)),shared)};
        else if(specifier.startsWith('provider:')) {
          const slash=specifier.indexOf('/'),providerId=specifier.slice(9,slash);
          if(!dependencies[providerId])throw new Error(`UI_BROWSER_DEPENDENCY_UNDECLARED: ${specifier}`);
          target={providerId,version:dependencies[providerId],assetId:'browser/'+specifier.slice(slash+1)};
        } else throw new Error(`UI_BROWSER_IMPORT_UNDECLARED: ${specifier}`);
        asset.imports.push({specifier,...target});
      }
      if(/\bimport\s*\(/.test(source))throw new Error(`UI_BROWSER_DYNAMIC_IMPORT_UNDECLARED: ${relative}`);
    }
    return assetId;
  }
  const entrypoint=visit(entry);
  const styleIds=styles.map(file=>file.startsWith('shared:')?visit(file.slice(7),true):visit(file));
  for(const file of assets)file.startsWith('shared:')?visit(file.slice(7),true):visit(file);
  return {entrypoint,exports,styles:styleIds,dependencies:Object.entries(dependencies).map(([providerId,version])=>({providerId,version})),assets:[...found.values()]};
}
