using System.IO.Compression;
using System.Net;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Http.Features;
using Microsoft.Data.SqlClient;
using SFX.Identity.DAL.Repositories;

namespace SfxProviders.CliLogin.Hosting;

// Private material transport. These endpoints do not evaluate claims or admit
// authority. Only specifically named generated repositories touch the store.
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
            if (!http.Request.Path.StartsWithSegments("/evidence/v1")) { await next(http); return; }
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
                if (HttpMethods.IsGet(http.Request.Method) || http.Request.Path == "/evidence/v1/runs")
                {
                    var bearer = http.Request.Headers["x-sfx-session"].ToString();
                    var session = bearer.Length == 44 ? await sessions.ValidateAsync(bearer, http.RequestAborted) : null;
                    if (session is null) { http.Response.StatusCode = 401; return; }
                    http.Items["evidence.session"] = session;
                }
                var limit = http.Features.Get<IHttpMaxRequestBodySizeFeature>();
                if (limit is { IsReadOnly: false }) limit.MaxRequestBodySize = http.Request.Path.Value!.EndsWith("/chunks", StringComparison.Ordinal) ? 1500000 : 16 * 1024 * 1024;
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

        app.MapPost("/evidence/v1/runs", async (HttpContext http) =>
        {
            using var body = await Read(http); var root = body.RootElement;
            var session = (SessionMetadata)http.Items["evidence.session"]!;
            var result = await new EvidenceRegisterRunRepository().ExecuteAsync(Text(root, "runId", 128), session.PrincipalId, session.SessionId,
                Text(root, "capabilityId", 512), Text(root, "namespaceId", 256), Writer(http));
            return Results.Json(new { runId = result.Rows.Single().RunId, persistence = "registered", trust = "NOT_EVALUATED" });
        });
        app.MapPost("/evidence/v1/runs/{runId}/chunks", async (string runId, HttpContext http) =>
        {
            using var body = await Read(http); var root = body.RootElement;
            var bytes = Convert.FromBase64String(Text(root, "content", 1400000));
            var digest = Convert.FromHexString(Text(root, "sha256", 64));
            if (digest.Length != 32 || bytes.Length is < 1 or > 1048576 || !CryptographicOperations.FixedTimeEquals(digest, SHA256.HashData(bytes))) return Results.BadRequest();
            var first = Number(root, "firstCursor"); var last = Number(root, "lastCursor");
            var count = Number(root, "recordCount");
            if (first < 1 || last < first || count is < 1 or > 128 || last - first + 1 != count) return Results.BadRequest();
            using var stream = new BrotliStream(new MemoryStream(bytes), CompressionMode.Decompress);
            using var expanded = new MemoryStream(); var buffer = new byte[8192];
            for (int n; (n = await stream.ReadAsync(buffer, http.RequestAborted)) != 0;)
            { if (expanded.Length + n > 8 * 1024 * 1024) return Results.StatusCode(413); await expanded.WriteAsync(buffer.AsMemory(0, n), http.RequestAborted); }
            using var events = JsonDocument.Parse(expanded.ToArray());
            if (events.RootElement.ValueKind != JsonValueKind.Array || events.RootElement.GetArrayLength() != count || count < 1 || last - first + 1 != count) return Results.BadRequest();
            long cursor = first;
            foreach (var e in events.RootElement.EnumerateArray())
            {
                if (Number(e, "cursor") != cursor || Text(e, "eventId", 256) != $"urn:sda-api:run-event:{runId}:{cursor}" ||
                    (e.TryGetProperty("runId", out _) && Text(e, "runId", 128) != runId)) return Results.BadRequest();
                cursor++;
            }
            await new EvidenceAppendTraceChunkRepository().ExecuteAsync(runId, Writer(http), first, last, (int)count, digest, bytes);
            return Results.Json(new { stored = true });
        });
        app.MapPost("/evidence/v1/runs/{runId}/complete", async (string runId, HttpContext http) =>
        {
            using var body = await Read(http); var root = body.RootElement;
            var run = Member(root, "run");
            // Store the API envelope verbatim; never derive a terminal variant
            // from an exit code or translate an outcome into ledger admission.
            if (Text(run, "runId", 128) != runId) return Results.BadRequest();
            var result = await new EvidenceCompleteRunRepository().ExecuteAsync(runId, Writer(http), run.GetRawText(),
                Optional(root, "graph")!, Optional(root, "output")!, Number(root, "latestCursor"));
            return Results.Json(new { persistence = "stored", traceComplete = result.Rows.Single().TraceComplete, trust = "NOT_EVALUATED" });
        });
        app.MapGet("/evidence/v1/runs", async (HttpContext http) =>
        {
            var session = (SessionMetadata)http.Items["evidence.session"]!;
            var result = await new EvidenceListRunsRepository().ExecuteAsync(session.PrincipalId);
            return Results.Json(new { principalId = session.PrincipalId, storage = "durable", runs = result.Rows.Select(r => new {
                runId = r.RunId, capabilityId = r.CapabilityId, namespaceId = r.NamespaceId, admittedAt = r.AdmittedAt, sessionId = r.SessionId, captureStatus = r.CaptureStatus }) });
        });
        app.MapGet("/evidence/v1/runs/{runId}", async (string runId, HttpContext http) =>
        {
            var session = (SessionMetadata)http.Items["evidence.session"]!;
            var result = await new EvidenceReadRunRepository().ExecuteAsync(session.PrincipalId, runId); var row = result.Rows.SingleOrDefault();
            if (row is null) return Results.NotFound();
            return Results.Json(new { runId = row.RunId, capabilityId = row.CapabilityId, namespaceId = row.NamespaceId,
                captureStatus = row.CaptureStatus, traceComplete = row.TraceComplete, latestCursor = row.LatestCursor,
                run = Parse(row.RunJson), graph = Parse(row.GraphJson), output = Parse(row.OutputJson), trust = "NOT_EVALUATED",
                limitations = new[] { "Exact executor identity and estate evaluator are required before claim evaluation." } });
        });
        app.MapGet("/evidence/v1/runs/{runId}/chunks", async (string runId, HttpContext http) =>
        {
            var session = (SessionMetadata)http.Items["evidence.session"]!;
            var owned = await new EvidenceReadRunRepository().ExecuteAsync(session.PrincipalId, runId);
            if (owned.Rows.Count == 0) return Results.NotFound();
            if (!long.TryParse(http.Request.Query["after"].FirstOrDefault() ?? "0", out var after) || after < 0) return Results.BadRequest();
            var chunks = await new EvidenceReadTraceChunksRepository().ExecuteAsync(session.PrincipalId, runId, after);
            return Results.Json(new { runId, chunks = chunks.Rows.Select(c => new { firstCursor = c.FirstCursor, lastCursor = c.LastCursor,
                recordCount = c.RecordCount, sha256 = Convert.ToHexString(c.ContentDigest).ToLowerInvariant(), content = Convert.ToBase64String(c.Content) }) });
        });
        app.Lifetime.ApplicationStopped.Register(concurrency.Dispose);
    }
    private static string Writer(HttpContext http) => (string)http.Items["evidence.writer"]!;
    private static Task<JsonDocument> Read(HttpContext http) => JsonDocument.ParseAsync(http.Request.Body, new JsonDocumentOptions { MaxDepth = 128 }, http.RequestAborted);
    private static string Text(JsonElement root, string key, int max)
    {
        var e = Member(root, key);
        if (e.ValueKind != JsonValueKind.String || e.GetString() is not { } s || s.Length is < 1 || s.Length > max) throw new JsonException();
        return s;
    }
    private static JsonElement Member(JsonElement root, string key) => root.ValueKind == JsonValueKind.Object && root.TryGetProperty(key, out var e) ? e : throw new JsonException();
    private static long Number(JsonElement root, string key)
    {
        var e = Member(root, key);
        return e.ValueKind == JsonValueKind.Number && e.TryGetInt64(out var n) ? n : throw new JsonException();
    }
    private static string? Optional(JsonElement root, string key) => root.TryGetProperty(key, out var v) && v.ValueKind != JsonValueKind.Null ? v.GetRawText() : null;
    private static JsonElement? Parse(string? json) { if (json is null) return null; using var d = JsonDocument.Parse(json); return d.RootElement.Clone(); }
}
