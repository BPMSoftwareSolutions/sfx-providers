import { normalizeSnapshot } from '../../src/capability-presentation/snapshot.mjs';
export function rawFixture() {
  return {
    capability:{capability_id:'review-request',namespace_id:'example:capabilities',estate_model_pk:'42',capability_pk:'7',capability_version_pk:'9',definition_pk:'11',definition_digest:'a'.repeat(64),name:'Review request',actor:'reviewer',intent:'Evaluate a request under the declared policy',outcome:'A retained decision'},
    graph:{capabilityId:'review-request',rootScenarioId:'review',
      scenarios:[
        {scenarioId:'review',input:{inputId:'request',contract:{contractId:'request.v1'}},event:{eventId:'review-requested',executionAuthorityId:'review.v1'},outcome:{outcomeId:'decision',contract:{contractId:'decision.v1'},terminal:false}},
        {scenarioId:'accept',event:{eventId:'accepted',executionAuthorityId:'accept.v1'},outcome:{outcomeId:'accepted',terminal:true}},
        {scenarioId:'refuse',event:{eventId:'refused',executionAuthorityId:'refuse.v1'},outcome:{outcomeId:'refused',terminal:true}},
      ],
      scenarioOutcomes:[{scenarioId:'review',variants:[{variantId:'ADMITTED',classification:'success'},{variantId:'REFUSED',classification:'failure'}]}],
      transitions:[{transitionId:'yes',from:{scenarioId:'review'},to:{scenarioId:'accept'},selectsVariant:'ADMITTED',topologyKind:'selection'},
        {transitionId:'no',from:{scenarioId:'review'},to:{scenarioId:'refuse'},selectsVariant:'REFUSED',topologyKind:'selection'}],
      executionAuthorities:[{id:'review.v1',owningScenarioId:'review',operations:[{kind:'invoke-port',portId:'policy'},{kind:'invoke-scenario',scenarioId:'accept'}]},
        {id:'accept.v1',owningScenarioId:'accept',operations:[{kind:'invoke-port',portId:'deliver'}]},
        {id:'refuse.v1',owningScenarioId:'refuse',operations:[]}],
      interfaceAuthority:{interfaces:[{id:'review-cli',configuration:{command:'review'}}],portBindings:[
        {portId:'policy',platformCapabilityId:'transform.v1',configuration:{transformationId:'policy.v1'}},
        {portId:'deliver',platformCapabilityId:'http.v1',configuration:{providerId:'example-provider',endpointAuthorities:[{urlPrefixes:['https://example.org/review?access_token=never-keep']}],authorization:'Bearer never-keep',password:'never-keep',credentialReference:'example-reference'}}]},
      semanticTransformations:[{id:'policy.v1',expression:{op:'if',when:{op:'path',path:'approved'},then:{op:'literal',value:{op:'DO_NOT_COUNT_PAYLOAD'}},else:{op:'literal',value:'REFUSED'}}}],
      contractAuthorities:{contracts:{'request.v1':{schema:{type:'object',required:['approved'],properties:{approved:{type:'boolean'}}}},'decision.v1':{schema:{type:'object'}}}},
    },
    features:[{feature_id:'review-feature',name:'Request review',feature_version_pk:'22',definition_digest:'b'.repeat(64),binding_role:'primary'}],
    fixtures:[{fixture_id:'review-fixture',case_id:'refusal',expected_disposition:'REFUSED',assertion_count:2,definition_digest:'c'.repeat(64),semantic_object_definition_pk:'30'}],
    obligations:[{proof_obligation_id:'policy-boundary',statement:'Unapproved requests are refused',obligation_kind:'behavior',definition_digest:'d'.repeat(64),semantic_object_definition_pk:'31'}],
    altitudeCatalog:Array.from({length:11},(_,i)=>({scenario_id:`altitude-${i+1}-example`,name:`Declared altitude ${i+1}`,scenario_version_pk:String(i+50),definition_digest:'e'.repeat(64)})),
    provenance:{adapter:'synthetic-test-fixture.v1',isolation:'fixture'},
  };
}
export function snapshotFixture(){return normalizeSnapshot(rawFixture());}
