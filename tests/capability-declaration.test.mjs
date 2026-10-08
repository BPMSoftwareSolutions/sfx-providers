import assert from 'node:assert/strict';
import {test} from 'node:test';
import {snapshotFromDeclaration, DECLARATION_ID} from '../src/capability-presentation/declaration-snapshot.mjs';
import {validateSnapshot, digest} from '../src/capability-presentation/snapshot.mjs';

function declaration() {
  return {
    contractId: DECLARATION_ID,
    capability: { id: 'landing', namespaceId: 'example:ui', rootScenarioId: 'landing', name: 'Landing',
      actor: 'a caller', intent: 'read the landing', outcome: 'declared regions render',
      readiness: { declaration: 'REVIEWABLE', execution: 'HELD', reason: 'proposal' },
      authority: { mode: 'capability', rootScenarioId: 'landing', userStory: { actor: 'a caller', intent: 'read the landing', outcome: 'declared regions render' } } },
    scenarios: [
      { id: 'landing', name: 'Landing', owned: true, authorityId: 'landing.v1',
        input: { id: 'page-request', contractId: 'page-request.v1' }, event: { id: 'page-requested' },
        outcome: { id: 'page-read', contractId: 'page.v1' }, variants: [{ id: 'AUTHORED', classification: 'success' }],
        authored: { keyword: 'Scenario', name: 'Landing', tags: ['@scenario:landing'],
          steps: [{ keyword: 'Given', keywordType: 'Context', text: 'declared route and sources' },
            { keyword: 'When', keywordType: 'Action', text: 'the declared events dispatch' },
            { keyword: 'Then', keywordType: 'Outcome', text: 'the read returns a named status' }] } },
    ],
    authorities: [{ id: 'landing.v1', scenarioId: 'landing', operations: [{ id: 'landing.load', kind: 'invoke-port', portId: 'load-port' }] }],
    transitions: [],
    bindings: [{ portId: 'load-port', platformCapabilityId: 'platform.v1', configuration: { providerId: 'region-provider' } }],
    contracts: { 'page-request.v1': { schema: { type: 'object' } }, 'page.v1': { schema: { type: 'object' } } },
    features: [],
    imports: [{
      id: 'entry', capabilityId: 'entry-capability', source: 'retained-snapshot.json', snapshotDigest: 'a'.repeat(64), scenarioIds: ['entry'],
      scenarios: [{ id: 'entry', name: 'Entry', versionPk: '7', definitionDigest: 'd', authorityId: 'entry.v1', eventId: 'entry-requested',
        inputId: 'entry-input', inputContractId: 'entry-input.v1', outcomeId: 'entry-out', outcomeContractId: 'entry-out.v1', terminal: true,
        variants: [{ id: 'ADMITTED', classification: 'success' }], owned: false, authored: { keyword: 'Scenario', name: 'Entry', description: '', tags: [], steps: [], examples: [] },
        inputDescription: '', eventDescription: '', outcomeDescription: '', terminalDisposition: '', meaningSourceRef: '', sourceRef: 'graph:/scenarios/0' }],
      authorities: [{ id: 'entry.v1', scenarioId: 'entry', sourceRef: 'graph:/executionAuthorities/0', digest: 'd',
        operations: [{ id: 'entry.load', ordinal: 1, kind: 'invoke-port', portId: 'entry-port', digest: 'd', sourceRef: 'graph:/executionAuthorities/0/operations/0', variants: [] }] }],
      bindings: [{ portId: 'entry-port', platformCapabilityId: 'platform.v1', declaredRead: false, transformationId: '', configurationDigest: 'd',
        invocationCondition: null, nestedInvocation: null, providerIds: ['entry-provider'], endpoints: [], credentialReferences: [], realizations: [], selectors: {}, sourceRef: 'graph:/interfaceAuthority/portBindings/0' }],
      contracts: [{ id: 'entry-input.v1', schemaId: '', title: 'Entry input', type: 'object', required: [], properties: [], fields: [], sourceRef: 'graph:/contractAuthorities/contracts/entry-input.v1' }],
      transformations: [], interfaces: [],
    }],
  };
}

test('a declaration document normalizes to a valid deterministic snapshot', () => {
  const first = snapshotFromDeclaration(declaration()), second = snapshotFromDeclaration(declaration());
  validateSnapshot(first);
  assert.equal(first.snapshotDigest, second.snapshotDigest);
  assert.equal(first.identity.capabilityId, 'landing');
  assert.equal(first.identity.rootScenarioId, 'landing');
  assert.equal(first.identity.readiness.execution, 'HELD');
  assert.equal(first.scenarios.length, 2);
  assert.equal(first.scenarios[1].id, 'entry');
  assert.equal(first.scenarios[1].sourceRef, 'graph:/scenarios/1');
  assert.equal(first.authorities.find(a => a.id === 'entry.v1').sourceRef, 'graph:/executionAuthorities/1');
  assert.equal(first.bindings.find(b => b.portId === 'entry-port').sourceRef, 'graph:/interfaceAuthority/portBindings/1');
  assert.equal(first.provenance.imports[0].capabilityId, 'entry-capability');
  const { snapshotDigest, ...body } = first;
  assert.equal(digest(body), snapshotDigest);
  assert.doesNotThrow(() => validateSnapshot(JSON.parse(JSON.stringify(first))), 'A declaration snapshot must survive its JSON sidecar.');
});

test('a declaration refuses a foreign contract and a duplicate merged identity', () => {
  assert.throws(() => snapshotFromDeclaration({ ...declaration(), contractId: 'something-else.v1' }), { code: 'CAPABILITY_DECLARATION_INVALID' });
  const duplicate = declaration();
  duplicate.imports[0].bindings = [{ ...duplicate.imports[0].bindings[0], portId: 'load-port' }];
  assert.throws(() => snapshotFromDeclaration(duplicate), { code: 'CAPABILITY_DECLARATION_INVALID' });
});
