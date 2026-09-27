-- Read inside the same SNAPSHOT transaction used by the estate reader.
-- Counts are an inventory filter; the blueprint projection separately checks
-- root reachability and retains actual call/transition identities.
SET NOCOUNT ON;
DECLARE @estate bigint = (SELECT estate_model_pk FROM source.current_model WHERE singleton_id = 1);
SELECT TOP (40)
    @estate AS estate_model_pk,
    c.capability_id,
    n.namespace_id,
    ec.capability_version_pk,
    cv.name,
    cv.intent,
    COUNT(DISTINCT cs.scenario_version_pk) AS declared_scenario_count
FROM model.estate_capability ec
JOIN model.capability c ON c.capability_pk = ec.capability_pk
JOIN model.identity_namespace n ON n.namespace_pk = c.namespace_pk
JOIN model.capability_version cv ON cv.capability_version_pk = ec.capability_version_pk
JOIN model.capability_scenario cs ON cs.capability_version_pk = ec.capability_version_pk
WHERE ec.estate_model_pk = @estate
GROUP BY c.capability_id, n.namespace_id, ec.capability_version_pk, cv.name, cv.intent
HAVING COUNT(DISTINCT cs.scenario_version_pk) > 1
ORDER BY
    CASE WHEN COUNT(DISTINCT cs.scenario_version_pk) BETWEEN 3 AND 8 THEN 0 ELSE 1 END,
    COUNT(DISTINCT cs.scenario_version_pk) DESC,
    c.capability_id;
