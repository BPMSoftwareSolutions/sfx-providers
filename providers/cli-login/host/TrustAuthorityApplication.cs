using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using SFX.Identity.DAL.Repositories;

namespace SfxProviders.CliLogin.Hosting;

// Called behind the shared private service and validated-session middleware.
// Pins are caller-selected identities, not policy authored by this process.
public static class TrustAuthorityApplication
{
    public static void Map(WebApplication app)
    {
        app.MapGet("/ledger/v1/authority/{policyDigest}/{evaluatorDigest}", Read);
    }

    private static async Task<IResult> Read(string policyDigest, string evaluatorDigest)
    {
        static byte[]? Pin(string value) => value.Length == 64 && value.All(Uri.IsHexDigit)
            ? Convert.FromHexString(value) : null;
        var policy = Pin(policyDigest); var evaluator = Pin(evaluatorDigest);
        if (policy is null || evaluator is null) return Results.BadRequest();
        var authority = await new LedgerReadEvaluationAuthorityRepository().ExecuteAsync(policy, evaluator);
        var row = authority.Rows.SingleOrDefault();
        if (row is null) return Results.NotFound();
        if (!CryptographicOperations.FixedTimeEquals(SHA256.HashData(row.PolicyContent), policy) ||
            !CryptographicOperations.FixedTimeEquals(SHA256.HashData(row.EvaluatorContent), evaluator))
            throw new InvalidOperationException("LEDGER_AUTHORITY_DRIFT");
        var rules = await new LedgerReadEvaluationRulesRepository().ExecuteAsync(policy);
        var utf8 = new UTF8Encoding(false, true);
        foreach (var rule in rules.Rows)
            if (!CryptographicOperations.FixedTimeEquals(SHA256.HashData(utf8.GetBytes(rule.RuleJson)), rule.RuleDigest))
                throw new InvalidOperationException("LEDGER_RULE_DRIFT");
        return Results.Json(new {
            contractId = "retained-trust-authority.v1",
            policy = new { digest = "sha256:" + Convert.ToHexString(policy).ToLowerInvariant(), retainedDefinition = utf8.GetString(row.PolicyContent) },
            evaluator = new { digest = "sha256:" + Convert.ToHexString(evaluator).ToLowerInvariant(), retainedDefinition = utf8.GetString(row.EvaluatorContent) },
            rules = rules.Rows.Select(r => new {
                id = r.RuleId, claimKind = r.ClaimKind, scope = r.Scope, target = r.TargetState, available = r.Available,
                digest = "sha256:" + Convert.ToHexString(r.RuleDigest).ToLowerInvariant(), retainedDefinition = r.RuleJson
            })
        });
    }
}
