-- Presentation evidence only. The host runs this parameterized batch in one
-- SNAPSHOT transaction and rolls it back. No capability is invoked or changed.
SET NOCOUNT ON;
DECLARE @estate bigint = (SELECT estate_model_pk FROM source.current_model WHERE singleton_id=1);
DECLARE @cap TABLE (capability_pk bigint, capability_version_pk bigint, definition_pk bigint, namespace_id nvarchar(400));
INSERT @cap
SELECT c.capability_pk,ec.capability_version_pk,ec.semantic_object_definition_pk,n.namespace_id
FROM model.estate_capability ec
JOIN model.capability c ON c.capability_pk=ec.capability_pk
JOIN model.identity_namespace n ON n.namespace_pk=c.namespace_pk
WHERE ec.estate_model_pk=@estate AND c.capability_id=@capability_id COLLATE Latin1_General_100_BIN2
 AND (@namespace_id IS NULL OR n.namespace_id=@namespace_id COLLATE Latin1_General_100_BIN2);
IF (SELECT COUNT(*) FROM @cap)<>1 THROW 51000,'CAPABILITY_ID_NOT_UNIQUE_OR_NOT_FOUND',1;
DECLARE @cv bigint=(SELECT capability_version_pk FROM @cap);
DECLARE @sv TABLE (scenario_version_pk bigint PRIMARY KEY);
INSERT @sv SELECT scenario_version_pk FROM model.capability_scenario WHERE capability_version_pk=@cv
 UNION SELECT downstream_scenario_version_pk FROM analysis.v_scenario_invocation_closure WHERE capability_version_pk=@cv;

SELECT @estate AS estate_model_pk,c.capability_id,p.namespace_id,p.capability_pk,p.capability_version_pk,
 p.definition_pk,LOWER(CONVERT(varchar(64),cv.definition_digest,2)) AS definition_digest,
 cv.name,cv.actor,cv.intent,cv.outcome,cv.experience_promise,
 CONVERT(nvarchar(max),CONVERT(varchar(max),co.content_bytes) COLLATE Latin1_General_100_BIN2_UTF8) AS definition_json
FROM @cap p JOIN model.capability c ON c.capability_pk=p.capability_pk
JOIN model.capability_version cv ON cv.capability_version_pk=p.capability_version_pk
JOIN model.semantic_object_definition d ON d.semantic_object_definition_pk=p.definition_pk
JOIN source.content_object co ON co.content_object_pk=d.canonical_content_pk;

SELECT g.root_scenario_id,g.graph_source
FROM analysis.capability_graph_source(@capability_id,0,(SELECT namespace_id FROM @cap)) g;

SELECT s.scenario_id,sv.name,sv.scenario_version_pk,sv.semantic_object_definition_pk,
 LOWER(CONVERT(varchar(64),sv.definition_digest,2)) AS definition_digest,
 se.execution_authority_version_pk,se.event_id
FROM @sv v JOIN model.scenario_version sv ON sv.scenario_version_pk=v.scenario_version_pk
JOIN model.scenario s ON s.scenario_pk=sv.scenario_pk
LEFT JOIN model.scenario_event se ON se.scenario_version_pk=sv.scenario_version_pk
ORDER BY s.scenario_id,sv.scenario_version_pk;

SELECT f.feature_id,fv.name,fv.feature_version_pk,fv.semantic_object_definition_pk,
 LOWER(CONVERT(varchar(64),fv.definition_digest,2)) AS definition_digest,ecf.binding_role,
 CONVERT(nvarchar(max),CONVERT(varchar(max),co.content_bytes) COLLATE Latin1_General_100_BIN2_UTF8) AS definition_json
FROM model.estate_capability_feature ecf
JOIN model.feature_version fv ON fv.feature_version_pk=ecf.feature_version_pk
JOIN model.feature f ON f.feature_pk=fv.feature_pk
JOIN model.semantic_object_definition d ON d.semantic_object_definition_pk=fv.semantic_object_definition_pk
JOIN source.content_object co ON co.content_object_pk=d.canonical_content_pk
WHERE ecf.estate_model_pk=@estate AND ecf.capability_version_pk=@cv
ORDER BY f.feature_id,fv.feature_version_pk;

SELECT DISTINCT fx.fixture_id,fx.semantic_object_definition_pk,fc.case_id,fc.expected_disposition,
 LOWER(CONVERT(varchar(64),fx.definition_digest,2)) AS definition_digest,
 (SELECT COUNT(*) FROM model.fixture_assertion fa WHERE fa.fixture_case_pk=fc.fixture_case_pk) AS assertion_count
FROM model.fixture fx
JOIN analysis.v_selected_semantic_definition sd ON sd.semantic_object_definition_pk=fx.semantic_object_definition_pk AND sd.estate_model_pk=@estate
LEFT JOIN model.fixture_case fc ON fc.fixture_pk=fx.fixture_pk
WHERE fx.owner_definition_pk IN (SELECT definition_pk FROM @cap)
 OR EXISTS (SELECT 1 FROM model.fixture_scenario_step st JOIN @sv v ON v.scenario_version_pk=st.scenario_version_pk WHERE st.fixture_case_pk=fc.fixture_case_pk)
 OR fc.terminal_scenario_version_pk IN (SELECT scenario_version_pk FROM @sv)
ORDER BY fx.fixture_id,fc.case_id;

SELECT DISTINCT po.proof_obligation_id,po.statement,po.obligation_kind,po.semantic_object_definition_pk,
 LOWER(CONVERT(varchar(64),po.definition_digest,2)) AS definition_digest
FROM model.proof_obligation po
JOIN analysis.v_selected_semantic_definition sd ON sd.semantic_object_definition_pk=po.semantic_object_definition_pk AND sd.estate_model_pk=@estate
WHERE po.owner_definition_pk IN (SELECT definition_pk FROM @cap)
 OR EXISTS (SELECT 1 FROM model.proof_obligation_subject ps WHERE ps.proof_obligation_pk=po.proof_obligation_pk
 AND ps.subject_definition_pk IN (SELECT definition_pk FROM @cap UNION SELECT sv.semantic_object_definition_pk FROM model.scenario_version sv JOIN @sv v ON v.scenario_version_pk=sv.scenario_version_pk))
ORDER BY po.proof_obligation_id;

SELECT s.scenario_id,sv.name,sv.scenario_version_pk,LOWER(CONVERT(varchar(64),sv.definition_digest,2)) AS definition_digest
FROM model.estate_capability ec JOIN model.capability c ON c.capability_pk=ec.capability_pk
JOIN model.capability_scenario cs ON cs.capability_version_pk=ec.capability_version_pk
JOIN model.scenario_version sv ON sv.scenario_version_pk=cs.scenario_version_pk
JOIN model.scenario s ON s.scenario_pk=sv.scenario_pk
WHERE ec.estate_model_pk=@estate AND c.capability_id=N'authoring-altitude-model-stubs'
ORDER BY s.scenario_id;

SELECT LOWER(CONVERT(varchar(64),HASHBYTES('SHA2_256',CONVERT(varbinary(max),OBJECT_DEFINITION(OBJECT_ID(N'analysis.capability_graph_source')))),2)) AS graph_function_digest;
