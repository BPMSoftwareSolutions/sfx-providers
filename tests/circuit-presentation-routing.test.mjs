import assert from 'node:assert/strict';
import {test} from 'node:test';
import {validateConnectorRoute} from '../src/circuit-presentation/contracts.mjs';
import {handle} from '../providers/circuit-presentation.mjs';
import {layoutBlueprint} from '../src/capability-presentation/blueprint-sheet.mjs';

test('rendering contract rejects the slide-14 spike before authoring native output',async()=>{
 const spike=[[990,75],[1005,75],[1005,-4],[1013,-4],[1013,215],[1025,215]];
 assert.throws(()=>validateConnectorRoute(spike,'forward'),{code:'CIRCUIT_CONNECTOR_INVALID'});
 // Translate into the native canvas so refusal is about routing, not bounds.
 const points=spike.map(([x,y])=>[(x-900)*2,y+100]);
 const result=await handle({contractId:'circuit-presentation-request.v1',deck:{title:'Routing regression',slides:[{title:'Provider branch',commands:[{op:'route',args:[points,'#A98AF2',{routing:'forward'}]}]}]}});
 assert.equal(result.disposition,'HELD');assert.equal(result.candidate,null);
 assert.equal(result.findings[0].code,'CIRCUIT_CONNECTOR_INVALID');
});

test('forward rule catches needless zigzags, reversals, diagonal and zero segments',()=>{
 for(const points of [
  [[0,0],[10,0],[10,10],[20,10],[20,20],[30,20]], // shortest length, excessive bends
  [[0,0],[20,0],[10,0],[30,0]],                 // collinear reversal
  [[0,0],[10,10]],[[0,0],[0,0],[10,0]],
 ])assert.throws(()=>validateConnectorRoute(points,'forward'),{code:'CIRCUIT_CONNECTOR_INVALID'});
 for(const points of [[[0,0],[30,0]],[[0,0],[15,0],[15,20],[30,20]],[[0,20],[15,20],[15,0],[30,0]]])
  assert.doesNotThrow(()=>validateConnectorRoute(points,'forward'));
 // A real recurrence or wrapped row needs a different policy, not erased edges.
 assert.doesNotThrow(()=>validateConnectorRoute([[30,30],[40,30],[40,0],[0,0],[0,60],[10,60]],'orthogonal'));
});

test('provider fan-out uses a shared clear channel without spikes or changed identities',()=>{
 const nodes=[{id:'platform',kind:'platform'},...Array.from({length:4},(_,i)=>({id:'provider-'+i,kind:'provider'}))];
 const edges=nodes.slice(1).map(n=>({id:'edge-'+n.id,from:'platform',to:n.id,kind:'provider-selection'}));
 const {routes,positions}=layoutBlueprint({altitude:'provider',nodes,edges});
 assert.deepEqual(routes.map(r=>r.id),edges.map(e=>e.id));
 const trunkX=(positions.platform.x+positions.platform.w+positions['provider-0'].x)/2;
 for(const route of routes){
  assert.equal(route.routing,'forward');assert.ok(route.points.length<=4);
  assert.doesNotThrow(()=>validateConnectorRoute(route.points,'forward'));
  if(route.points.length===4)assert.equal(route.points[1][0],trunkX);
  const ys=route.points.map(p=>p[1]);assert.equal(Math.min(...ys),route.points[0][1]);
 }
});

test('physical edges that skip an occupied column retain an obstacle detour',()=>{
 const nodes=['operation','port','binding','platform','provider','endpoint'].map(kind=>({id:kind,kind}));
 const {routes}=layoutBlueprint({altitude:'physical',nodes,edges:[{id:'physical-edge',from:'binding',to:'endpoint',kind:'physical'}]});
 assert.equal(routes[0].routing,'orthogonal');assert.ok(routes[0].points.length>4);
 assert.doesNotThrow(()=>validateConnectorRoute(routes[0].points,'orthogonal'));
});
