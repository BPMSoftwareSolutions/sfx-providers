using System.Net;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Http.Features;
using Microsoft.Data.SqlClient;

namespace SfxProviders.CliLogin.Hosting;

// Private service transport for the ledger and flight routes. These endpoints do
// not evaluate claims or admit authority. Run evidence is captured and read through
// the estate's declared evidence capabilities, not through this host.
public static class RunEvidenceApplication
{
    private sealed record Caller(string Id, string Key, string[] Actions);
    public static void Map(WebApplication app, HostSettings settings, IdeSessionProvider sessions)
    {
        var configuration = Environment.GetEnvironmentVariable("SFX_EVIDENCE_CALLERS");
        if (string.IsNullOrWhiteSpace(configuration)) return;
        var callers = JsonSerializer.Deserialize<Caller[]>(configuration, new JsonSerializerOptions { PropertyNameCaseInsensitive = true })
            ?? throw new InvalidOperationException("EVIDENCE_CALLERS_INVALID");
        if (callers.Length == 0 || callers.Any(c => c is null || string.IsNullOrEmpty(c.Id) || c.Key is null || c.Actions is null || c.Actions.Length == 0) || callers.Select(c => c.Id).Distinct().Count() != callers.Length ||
            callers.Select(c => c.Key).Distinct().Count() != callers.Length || callers.Any(c => c.Id.Length is < 1 or > 64 || c.Key.Length != 64 ||
                c.Actions.Any(a => a is not ("capture" or "read")))) throw new InvalidOperationException("EVIDENCE_CALLERS_INVALID");
        var keys = callers.Select(c => (c.Id, Hash: SHA256.HashData(Encoding.UTF8.GetBytes(c.Key)), c.Actions)).ToArray();
        var concurrency = new SemaphoreSlim(4);
        app.Use(async (http, next) =>
        {
            if (!http.Request.Path.StartsWithSegments("/evidence/v1") && !http.Request.Path.StartsWithSegments("/ledger/v1")) { await next(http); return; }
            if (!http.Request.IsHttps && !(settings.LocalGateway && http.Connection.RemoteIpAddress is { } remote && IPAddress.IsLoopback(remote)))
            { http.Response.StatusCode = 400; return; }
            // Service identity and user identity are independent. No public
            // principal/session id supplied by a caller is used for authorization.
            var header = http.Request.Headers.Authorization.ToString();
            if (!header.StartsWith("Bearer ", StringComparison.Ordinal) || header.Length != 71) { http.Response.StatusCode = 401; return; }
            var hash = SHA256.HashData(Encoding.UTF8.GetBytes(header[7..]));
            var matches = keys.Where(c => CryptographicOperations.FixedTimeEquals(hash, c.Hash)).ToArray();
            if (matches.Length != 1) { http.Response.StatusCode = 401; return; }
            var caller = matches[0];
            var action = HttpMethods.IsGet(http.Request.Method) ? "read" : "capture";
            if (!caller.Actions.Contains(action)) { http.Response.StatusCode = 403; return; }
            if (!await concurrency.WaitAsync(0, http.RequestAborted)) { http.Response.StatusCode = 429; return; }
            try
            {
                http.Items["evidence.writer"] = caller.Id;
                if (HttpMethods.IsGet(http.Request.Method))
                {
                    var bearer = http.Request.Headers["x-sfx-session"].ToString();
                    var session = bearer.Length == 44 ? await sessions.ValidateAsync(bearer, http.RequestAborted) : null;
                    if (session is null) { http.Response.StatusCode = 401; return; }
                    http.Items["evidence.session"] = session;
                }
                var limit = http.Features.Get<IHttpMaxRequestBodySizeFeature>();
                if (limit is { IsReadOnly: false }) limit.MaxRequestBodySize = 16 * 1024 * 1024;
                await next(http);
            }
            catch (JsonException) { if (!http.Response.HasStarted) http.Response.StatusCode = 400; }
            catch (FormatException) { if (!http.Response.HasStarted) http.Response.StatusCode = 400; }
            catch (InvalidDataException) { if (!http.Response.HasStarted) http.Response.StatusCode = 400; }
            catch (BadHttpRequestException e) { if (!http.Response.HasStarted) http.Response.StatusCode = e.StatusCode; }
            catch (Exception e) when (e.InnerException is SqlException sql && sql.Number == 51000)
            {
                if (!http.Response.HasStarted) http.Response.StatusCode = sql.Message.StartsWith("EVIDENCE_CONFLICT", StringComparison.Ordinal) || sql.Message.StartsWith("EVIDENCE_RUN_CLOSED", StringComparison.Ordinal) || sql.Message.StartsWith("EVIDENCE_CHUNK_OVERLAP", StringComparison.Ordinal) ? 409 : 400;
            }
            finally { concurrency.Release(); }
        });

        TrustAuthorityApplication.Map(app);
        FlightProviderApplication.Map(app);
        app.Lifetime.ApplicationStopped.Register(concurrency.Dispose);
    }
}
