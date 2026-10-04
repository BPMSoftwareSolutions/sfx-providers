using System.Collections.Concurrent;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace SfxProviders.CliLogin.Hosting;

public sealed record EnrollmentSettings(string Capability, string InputContract, string OutcomeContract)
{
    public static EnrollmentSettings? Load()
    {
        var capability = Environment.GetEnvironmentVariable("SFX_ENROLLMENT_CAPABILITY");
        if (string.IsNullOrEmpty(capability)) return null;
        string Required(string key) => Environment.GetEnvironmentVariable(key) is { Length: > 0 } value
            ? value : throw new InvalidOperationException(key + "_REQUIRED");
        return new(capability, Required("SFX_ENROLLMENT_INPUT_CONTRACT"), Required("SFX_ENROLLMENT_OUTCOME_CONTRACT"));
    }
}

// Operator authorization and private request state belong to this ingress.
// The installed graph controls provider order and the observed result.
public static class EnrollmentApplication
{
    public static void Map(WebApplication app, HostSettings host,
        PasswordCredentialProvider credential, IdentityPrincipalProvider principal,
        byte[] serviceKeyHash, HttpClient telemetry,
        Func<HostSettings, string, HttpClient, CancellationToken, Task<string>>? run = null)
    {
        var policy = EnrollmentSettings.Load();
        if (policy is null) return;
        run ??= KernelRun.ExecuteAsync;
        var token = Environment.GetEnvironmentVariable("SFX_IDENTITY_ENROLLMENT_TOKEN");
        // Match the existing operator credential. Its issuance policy belongs to
        // the deployment, not to an additional enrollment-only length rule.
        if (string.IsNullOrWhiteSpace(token) || token.Length > 4089 || token.Any(char.IsControl))
            throw new InvalidOperationException("ENROLLMENT_AUTHORITY_REQUIRED");
        byte[] operatorHash = SHA256.HashData(Encoding.UTF8.GetBytes(token));
        var settings = host with { Capability = policy.Capability, InputContract = policy.InputContract, OutcomeContract = policy.OutcomeContract };
        var contexts = new ConcurrentDictionary<string, EnrollmentExecution>();
        var admission = new SemaphoreSlim(2);
        app.MapPost("/auth/v1/enroll", async (HttpContext http) =>
        {
            if (!Authorized(http, operatorHash)) return Results.Unauthorized();
            if (!await admission.WaitAsync(0, http.RequestAborted)) return Results.StatusCode(429);
            EnrollmentExecution? execution = null;
            try
            {
                using var json = await JsonDocument.ParseAsync(http.Request.Body, new JsonDocumentOptions { MaxDepth = 4 }, http.RequestAborted);
                var root = json.RootElement;
                if (root.ValueKind != JsonValueKind.Object || root.EnumerateObject().Count() != 2 ||
                    !root.TryGetProperty("identifier", out var identifier) || identifier.ValueKind != JsonValueKind.String ||
                    !root.TryGetProperty("password", out var password) || password.ValueKind != JsonValueKind.String)
                    return Results.BadRequest(new { disposition = "ENROLLMENT_INPUT_INVALID" });
                LoginInput input;
                try { input = LoginInput.FromPrivateRequest(identifier.GetString()!, password.GetString()!); }
                catch (LoginProviderException) { return Results.BadRequest(new { disposition = "ENROLLMENT_INPUT_INVALID" }); }
                execution = new(input);
                if (!contexts.TryAdd(execution.Correlation, execution)) throw new InvalidOperationException();
                var disposition = await run(settings, execution.Correlation, telemetry, http.RequestAborted);
                if (disposition != execution.Disposition) throw new InvalidOperationException("ENROLLMENT_RESULT_MISMATCH");
                return Results.Json(new { contractId = settings.OutcomeContract, disposition }, statusCode:
                    disposition == "ENROLLED" ? 201 : disposition == "ALREADY_ENROLLED" ? 409 : disposition == "ENROLLMENT_REJECTED" ? 422 : 503);
            }
            catch (JsonException) { return Results.BadRequest(new { disposition = "ENROLLMENT_INPUT_INVALID" }); }
            finally
            {
                if (execution is not null)
                {
                    contexts.TryRemove(execution.Correlation, out _);
                    await execution.Gate.WaitAsync(CancellationToken.None);
                    try { execution.Closed = true; execution.Dispose(); }
                    finally { execution.Gate.Release(); }
                }
                admission.Release();
            }
        });
        app.MapPost("/auth/v1/enrollment-provider/{step}", async (string step, HttpContext http) =>
        {
            if (!Authorized(http, serviceKeyHash)) return Results.Unauthorized();
            using var json = await JsonDocument.ParseAsync(http.Request.Body, new JsonDocumentOptions { MaxDepth = 3 }, http.RequestAborted);
            var root = json.RootElement;
            if (root.ValueKind != JsonValueKind.Object ||
                !root.TryGetProperty("correlationId", out var correlation) || correlation.ValueKind != JsonValueKind.String)
                return Results.BadRequest();
            int minimum = 0;
            if (root.EnumerateObject().Count() != (step == "hash" ? 2 : 1) ||
                (step == "hash" && (!root.TryGetProperty("minimumPasswordLength", out var length) || length.ValueKind != JsonValueKind.Number || !length.TryGetInt32(out minimum))))
                return Results.BadRequest();
            if (!contexts.TryGetValue(correlation.GetString()!, out var execution) || execution.ExpiresAt <= DateTimeOffset.UtcNow)
                return Results.Unauthorized();
            await execution.Gate.WaitAsync(http.RequestAborted);
            try
            {
                int wanted = step switch { "hash" => 0, "provision" => 1, _ => -1 };
                if (execution.Closed || wanted < 0 || wanted != execution.Stage || execution.Disposition != "CONTINUE")
                    return Results.StatusCode(409);
                execution.Stage++;
                try
                {
                    if (step == "hash") execution.Verifier = await credential.CreateForEnrollmentAsync(execution.Input, minimum, http.RequestAborted);
                    else
                    {
                        var id = await principal.ProvisionAsync(settings.Realm, execution.Input.Identifier, execution.Verifier!, http.RequestAborted);
                        execution.Disposition = id.HasValue ? "ENROLLED" : "ALREADY_ENROLLED";
                    }
                }
                catch (LoginProviderException error)
                {
                    execution.Disposition = error.Code == "ENROLLMENT_REJECTED" ? error.Code : "IDENTITY_UNAVAILABLE";
                }
                return Results.Json(new { correlationId = execution.Correlation, disposition = execution.Disposition });
            }
            finally { execution.Gate.Release(); }
        });
        app.Lifetime.ApplicationStopped.Register(admission.Dispose);
    }
    private static bool Authorized(HttpContext http, byte[] expected)
    {
        string value = http.Request.Headers.Authorization.ToString();
        return value.StartsWith("Bearer ", StringComparison.Ordinal) && value.Length is > 7 and <= 4096 &&
            CryptographicOperations.FixedTimeEquals(SHA256.HashData(Encoding.UTF8.GetBytes(value[7..])), expected);
    }
    private sealed class EnrollmentExecution(LoginInput input) : IDisposable
    {
        public string Correlation { get; } = Guid.NewGuid().ToString("N");
        public DateTimeOffset ExpiresAt { get; } = DateTimeOffset.UtcNow.AddMinutes(2);
        public LoginInput Input { get; } = input;
        public PasswordVerifier? Verifier { get; set; }
        public int Stage { get; set; }
        public string Disposition { get; set; } = "CONTINUE";
        public bool Closed { get; set; }
        public SemaphoreSlim Gate { get; } = new(1);
        public void Dispose() { Input.Dispose(); Verifier = null; }
    }
}
