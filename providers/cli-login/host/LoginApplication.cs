using System.Collections.Concurrent;
using System.Net;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using SfxProviders.CliLogin;
using SfxProviders.CliLogin.Hosting;

namespace SfxProviders.CliLogin.Hosting;

public static class LoginApplication
{
    public static WebApplication Create(string[] args, HostSettings? settings = null,
        Func<HostSettings, LoginExecution, HttpClient, CancellationToken, Task<string>>? run = null,
        Action<WebApplicationBuilder>? configure = null)
    {
        var builder = WebApplication.CreateBuilder(args);
        // Request bodies and private failures must never enter framework logs.
        builder.Logging.ClearProviders();
        builder.WebHost.ConfigureKestrel(k => k.Limits.MaxRequestBodySize = 4096);
        configure?.Invoke(builder);
        settings ??= HostSettings.Load();
        run ??= KernelRun.ExecuteAsync;
        var serviceKey = Environment.GetEnvironmentVariable("SFX_IDENTITY_SERVICE_KEY");
        if (serviceKey is null || serviceKey.Length != 64) throw new InvalidOperationException("IDENTITY_SERVICE_KEY_REQUIRED");
        var serviceKeyHash = SHA256.HashData(Encoding.UTF8.GetBytes(serviceKey));
        var dal = new GeneratedIdentityDal();
        var policy = new LoginPolicy(TimeSpan.FromMinutes(2), TimeSpan.FromMinutes(30));
        var verifier = new Argon2PasswordVerifier();
        var principal = new IdentityPrincipalProvider(dal, policy);
        var credential = new PasswordCredentialProvider(dal, verifier);
        var sessions = new IdeSessionProvider(dal, policy);
        var contexts = new ConcurrentDictionary<string, LoginExecution>();
        var admission = new SemaphoreSlim(4);
        var telemetry = new HttpClient { Timeout = TimeSpan.FromSeconds(10) };
        var app = builder.Build();
        app.Use(async (context, next) =>
        {
            context.Response.Headers.CacheControl = "no-store";
            context.Response.Headers.XContentTypeOptions = "nosniff";
            // Every private route requires TLS; only an explicitly configured local
            // gateway may terminate TLS before forwarding on the loopback interface.
            if (context.Request.Path.StartsWithSegments("/auth/v1") && !context.Request.IsHttps &&
                !(settings.LocalGateway && context.Connection.RemoteIpAddress is { } remote && IPAddress.IsLoopback(remote)))
            {
                context.Response.StatusCode = 400;
                return;
            }
            try { await next(context); }
            catch (OperationCanceledException) when (context.RequestAborted.IsCancellationRequested) { }
            catch { if (!context.Response.HasStarted) { context.Response.StatusCode = 503; await context.Response.WriteAsJsonAsync(new { disposition = "IDENTITY_UNAVAILABLE" }); } }
        });
        app.MapGet("/health", () => Results.Json(new { ready = true }));

        app.MapPost("/auth/v1/login", async (HttpContext http) =>
        {
            if (!await admission.WaitAsync(0, http.RequestAborted)) return Results.Json(new { disposition = "THROTTLED" }, statusCode: 429);
            LoginExecution? execution = null;
            try
            {
                using var json = await JsonDocument.ParseAsync(http.Request.Body, new JsonDocumentOptions { MaxDepth = 4 }, http.RequestAborted);
                var root = json.RootElement;
                if (root.ValueKind != JsonValueKind.Object || root.EnumerateObject().Count() != 2 ||
                    !root.TryGetProperty("identifier", out var identifier) || identifier.ValueKind != JsonValueKind.String ||
                    !root.TryGetProperty("password", out var password) || password.ValueKind != JsonValueKind.String)
                    return Results.Json(new { disposition = "LOGIN_INPUT_INVALID" }, statusCode: 400);
                LoginInput input;
                try { input = LoginInput.FromPrivateRequest(identifier.GetString()!, password.GetString()!); }
                catch (LoginProviderException) { return Results.Json(new { disposition = "LOGIN_INPUT_INVALID" }, statusCode: 400); }
                execution = new LoginExecution(input);
                if (!contexts.TryAdd(execution.Correlation, execution)) throw new InvalidOperationException();
                var source = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(http.Connection.RemoteIpAddress?.ToString() ?? "unknown")));
                execution.Source = source;
                var result = await run(settings, execution, telemetry, http.RequestAborted);
                // The observed graph result must agree with the actual private effects.
                if (result != execution.Disposition) throw new InvalidOperationException("LOGIN_RESULT_MISMATCH");
                if (result == "AUTHENTICATED" && execution.Session is { } session)
                {
                    http.Response.ContentType = "application/json";
                    await PrivateSession.WriteResponseAsync(session, http.Response.Body, http.RequestAborted);
                    execution.Delivered = true;
                    return Results.Empty;
                }
                return Results.Json(new { contractId = settings.OutcomeContract, disposition = result },
                    statusCode: result == "THROTTLED" ? 429 : result == "IDENTITY_UNAVAILABLE" ? 503 : 401);
            }
            catch (JsonException) { return Results.Json(new { disposition = "LOGIN_INPUT_INVALID" }, statusCode: 400); }
            finally
            {
                try
                {
                    if (execution is not null)
                    {
                        contexts.TryRemove(execution.Correlation, out _);
                        await execution.Gate.WaitAsync(CancellationToken.None);
                        try
                        {
                            execution.Closed = true;
                            if (!execution.Delivered && execution.Session is { } orphan)
                                await PrivateSession.RevokeAsync(sessions, orphan);
                        }
                        finally { execution.Dispose(); execution.Gate.Release(); }
                    }
                }
                finally { admission.Release(); }
            }
        });

        // The vault-held service credential authenticates the kernel transport. A
        // correlation can address only a live private request and grants no authority.
        app.MapPost("/auth/v1/provider/{step}", async (string step, HttpContext http) =>
        {
            string supplied = http.Request.Headers.Authorization.ToString();
            if (!supplied.StartsWith("Bearer ", StringComparison.Ordinal) || supplied.Length != 71)
                return Results.StatusCode(401);
            var hash = SHA256.HashData(Encoding.UTF8.GetBytes(supplied[7..]));
            if (!CryptographicOperations.FixedTimeEquals(hash, serviceKeyHash))
                return Results.StatusCode(401);
            using var body = await JsonDocument.ParseAsync(http.Request.Body, new JsonDocumentOptions { MaxDepth = 3 }, http.RequestAborted);
            if (body.RootElement.ValueKind != JsonValueKind.Object || body.RootElement.EnumerateObject().Count() != 1 ||
                !body.RootElement.TryGetProperty("correlationId", out var correlation) || correlation.ValueKind != JsonValueKind.String)
                return Results.StatusCode(400);
            if (!contexts.TryGetValue(correlation.GetString()!, out var execution) || execution.ExpiresAt <= DateTimeOffset.UtcNow)
                return Results.StatusCode(401);
            await execution.Gate.WaitAsync(http.RequestAborted);
            try
            {
                int wanted = step switch { "resolve" => 0, "verify" => 1, "establish" => 2, _ => -1 };
                if (execution.Closed || wanted < 0 || execution.Stage != wanted || execution.Disposition != "CONTINUE") return Results.StatusCode(409);
                execution.Stage++;
                try
                {
                    switch (step)
                    {
                        case "resolve": execution.Attempt = await principal.ResolveAsync(execution.Input, settings.Realm, execution.Source, http.RequestAborted); break;
                        case "verify":
                            execution.Verification = await credential.VerifyAsync(execution.Attempt!, http.RequestAborted);
                            if (execution.Verification.Receipt.Disposition != LoginDisposition.CredentialVerified) execution.Disposition = "AUTHENTICATION_REJECTED";
                            break;
                        case "establish":
                            execution.Session = await sessions.EstablishAsync(execution.Verification!, http.RequestAborted);
                            execution.Disposition = "AUTHENTICATED";
                            break;
                    }
                }
                catch (LoginProviderException error)
                {
                    execution.Disposition = error.Code == "THROTTLED" ? "THROTTLED" : error.Code == "AUTHENTICATION_REJECTED" ? "AUTHENTICATION_REJECTED" : "IDENTITY_UNAVAILABLE";
                }
                return Results.Json(new { correlationId = execution.Correlation, disposition = execution.Disposition });
            }
            finally { execution.Gate.Release(); }
        });
        app.MapGet("/auth/v1/session", async (HttpContext http) =>
        {
            var bearer = PrivateSession.Bearer(http);
            var session = bearer is null ? null : await sessions.ValidateAsync(bearer, http.RequestAborted);
            return session is null ? Results.Unauthorized() : Results.Json(session);
        });
        app.MapPost("/auth/v1/logout", async (HttpContext http) =>
        {
            var bearer = PrivateSession.Bearer(http);
            if (bearer is null) return Results.Unauthorized();
            await sessions.RevokeAsync(bearer, http.RequestAborted);
            return Results.Json(new { disposition = "REVOKED" });
        });
        app.Lifetime.ApplicationStopped.Register(() => { verifier.Dispose(); admission.Dispose(); telemetry.Dispose(); });
        return app;

    }
}
