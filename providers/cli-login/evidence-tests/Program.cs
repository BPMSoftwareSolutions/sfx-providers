using System.IO.Compression;
using System.Diagnostics;
using System.Net;
using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Hosting.Server;
using Microsoft.AspNetCore.Hosting.Server.Features;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.DependencyInjection;
using SfxProviders.CliLogin;
using SfxProviders.CliLogin.Hosting;

if (args.Length < 1 || args[0] != "--live") throw new Exception("Use --live for disposable fixtures in sfx-identity.");
string realm = "evidence-verification-" + Guid.NewGuid().ToString("N"), runId = "fixture-" + Guid.NewGuid().ToString("N");
string serviceKey = Convert.ToHexString(RandomNumberGenerator.GetBytes(32)), readKey = Convert.ToHexString(RandomNumberGenerator.GetBytes(32));
Environment.SetEnvironmentVariable("SFX_IDENTITY_SERVICE_KEY", Convert.ToHexString(RandomNumberGenerator.GetBytes(32)));
Environment.SetEnvironmentVariable("SFX_EVIDENCE_CALLERS", JsonSerializer.Serialize(new[] { new { id = "fixture-circuit", key = serviceKey, actions = new[] { "capture", "read" } }, new { id = "fixture-reader", key = readKey, actions = new[] { "read" } } }));
var dal = new GeneratedIdentityDal(); using var hasher = new Argon2PasswordVerifier();
var policy = new LoginPolicy(TimeSpan.FromMinutes(2), TimeSpan.FromMinutes(30));
var provider = new IdeSessionProvider(dal, policy); var checks = new List<string>();
var settings = new HostSettings("unused", "unused", "unused", "unused", realm, "https://localhost", "http://127.0.0.1/unused", true);
WebApplication? app = null;
async Task<string> Start()
{
    app = LoginApplication.Create([], settings, configure: b => b.WebHost.ConfigureKestrel(k => k.Listen(IPAddress.Loopback, 0)));
    await app.StartAsync();
    return app.Services.GetRequiredService<IServer>().Features.Get<IServerAddressesFeature>()!.Addresses.Single();
}
async Task<string> User()
{
    string identifier = Guid.NewGuid().ToString("N"), password = Convert.ToHexString(RandomNumberGenerator.GetBytes(24));
    var verifier = await hasher.CreateForEnrollmentAsync(Encoding.UTF8.GetBytes(password));
    await dal.ProvisionPrincipalCredentialAsync(realm, identifier, verifier);
    using var attempt = await new IdentityPrincipalProvider(dal, policy).ResolveAsync(LoginInput.FromPrivateRequest(identifier, password), realm, identifier);
    var verification = await new PasswordCredentialProvider(dal, hasher).VerifyAsync(attempt);
    using var session = await provider.EstablishAsync(verification); using var bytes = new MemoryStream();
    await session.WritePrivateResponseAsync(bytes); using var json = JsonDocument.Parse(bytes.ToArray());
    return json.RootElement.GetProperty("token").GetString()!;
}
void Need(bool yes, string name) { if (!yes) throw new Exception(name); checks.Add(name); Console.WriteLine("PASS " + name); }
using var client = new HttpClient(); string origin = "";
async Task<HttpResponseMessage> Send(string path, object? body = null, string? token = null, string? key = null)
{
    using var request = new HttpRequestMessage(body is null ? HttpMethod.Get : HttpMethod.Post, origin + (path.StartsWith("/ledger/", StringComparison.Ordinal) ? path : "/evidence/v1" + path));
    request.Headers.Authorization = new("Bearer", key ?? serviceKey);
    if (token is not null) request.Headers.Add("x-sfx-session", token);
    if (body is not null) request.Content = JsonContent.Create(body);
    return await client.SendAsync(request);
}
try
{
    string user = await User(), other = await User(); origin = await Start();
    Need((int)(await Send("/runs")).StatusCode == 401, "service identity alone cannot list runs");
    const string policyPin = "98b97712ba40153553186212b6094970433b9b4fee810fb67e2c9921368f4454";
    const string evaluatorPin = "0d8869aafd2ae49894f26b76b1d8bf2ea347289b355fd8d0009f13cb106e25a1";
    string authorityPath = $"/ledger/v1/authority/{policyPin}/{evaluatorPin}";
    Need((int)(await Send(authorityPath)).StatusCode == 401, "ledger authority also requires validated session");
    Need((int)(await Send(authorityPath, token: user, key: new string('0', 64))).StatusCode == 401, "ledger authority rejects unknown service");
    Need((int)(await Send($"/ledger/v1/authority/invalid/{evaluatorPin}", token: user)).StatusCode == 400, "malformed authority pin refused");
    Need((int)(await Send($"/ledger/v1/authority/{new string('0', 64)}/{evaluatorPin}", token: user)).StatusCode == 404, "unknown authority pin never substitutes latest");
    using var authority = JsonDocument.Parse(await (await Send(authorityPath, token: user, key: readKey)).Content.ReadAsStringAsync());
    foreach (var (member, pin) in new[] { ("policy", policyPin), ("evaluator", evaluatorPin) })
    {
        var bytes = Encoding.UTF8.GetBytes(authority.RootElement.GetProperty(member).GetProperty("retainedDefinition").GetString()!);
        Need(Convert.ToHexString(SHA256.HashData(bytes)).Equals(pin, StringComparison.OrdinalIgnoreCase), "retained " + member + " bytes match installed estate pin");
    }
    using var vocabulary = JsonDocument.Parse(authority.RootElement.GetProperty("policy").GetProperty("retainedDefinition").GetString()!);
    var semantics = vocabulary.RootElement.GetProperty("semantics");
    Need(semantics.GetProperty("states").GetArrayLength() == 9 && semantics.GetProperty("evidenceClasses").GetArrayLength() == 8 && semantics.GetProperty("claimKinds").GetArrayLength() == 2, "estate vocabulary survives generated DAL and private API");
    var rules = authority.RootElement.GetProperty("rules");
    Need(rules.GetArrayLength() == 2 && rules.EnumerateArray().Single(r => r.GetProperty("claimKind").GetString() == "C2").GetProperty("available").GetBoolean() == false, "C2 remains unavailable in retained rule copy");
    var registration = new { runId, capabilityId = "explicit-transport-fixture", namespaceId = "fixture" };
    Need((int)(await Send("/runs", registration, user, readKey)).StatusCode == 403, "read-only service cannot capture");
    foreach (var malformed in new object[] { new { }, new[] { "array" }, new { runId = 7 } })
        Need((int)(await Send("/runs", malformed, user)).StatusCode == 400, "malformed registration is a client error");
    Need((await Send("/runs", registration, user)).IsSuccessStatusCode, "register validates actual database session");
    Need((await Send("/runs", registration, user)).IsSuccessStatusCode, "register retry is idempotent");
    Need((int)(await Send("/runs", registration, other)).StatusCode == 409, "another principal cannot claim existing run");
    var events = new[] { new { runId, cursor = 1, eventId = $"urn:sda-api:run-event:{runId}:1", kind = "fixture", payload = new { label = "transport fixture; not execution evidence" } } };
    byte[] content;
    using (var bytes = new MemoryStream()) { using (var compress = new BrotliStream(bytes, CompressionLevel.Fastest, true)) await compress.WriteAsync(JsonSerializer.SerializeToUtf8Bytes(events)); content = bytes.ToArray(); }
    var chunk = new { firstCursor = 1, lastCursor = 1, recordCount = 1, sha256 = Convert.ToHexString(SHA256.HashData(content)), content = Convert.ToBase64String(content) };
    Need((await Send($"/runs/{runId}/chunks", chunk)).IsSuccessStatusCode, "Brotli chunk stored through generated DAL");
    Need((await Send($"/runs/{runId}/chunks", chunk)).IsSuccessStatusCode, "chunk retry is idempotent");
    Need((int)(await Send($"/runs/{runId}/chunks", chunk with { sha256 = new string('0', 64) })).StatusCode == 400, "digest mismatch refused");
    Need((int)(await Send($"/runs/{runId}/chunks", new { chunk.content, chunk.sha256, firstCursor = "1" })).StatusCode == 400, "malformed chunk cursor refused");
    Need((int)(await Send($"/runs/{runId}/complete", new { })).StatusCode == 400, "missing completion refused");
    var completion = new { run = new { runId, state = "completed", partial = false }, graph = new { fixture = true }, output = new { fixture = true }, latestCursor = 1 };
    Need((await Send($"/runs/{runId}/complete", completion)).IsSuccessStatusCode, "complete verifies contiguous cursor coverage");
    Need((await Send($"/runs/{runId}/complete", completion)).IsSuccessStatusCode, "completion retry is idempotent");
    Need((int)(await Send($"/runs/{runId}/complete", completion with { latestCursor = 2 })).StatusCode == 409, "contradictory completion refused");
    foreach (var path in new[] { $"/runs/{runId}", $"/runs/{runId}/chunks" })
    { Need((int)(await Send(path, token: other)).StatusCode == 404, "cross-principal read concealed " + path.Split('/').Last()); }
    await app!.StopAsync(); await app.DisposeAsync(); app = null; origin = await Start();
    using var read = JsonDocument.Parse(await (await Send($"/runs/{runId}", token: user)).Content.ReadAsStringAsync());
    Need(read.RootElement.GetProperty("traceComplete").GetBoolean(), "complete capture survives identity host restart");
    Need(read.RootElement.GetProperty("trust").GetString() == "NOT_EVALUATED", "stored fixture never becomes a trust claim");
    using var chunks = JsonDocument.Parse(await (await Send($"/runs/{runId}/chunks", token: user)).Content.ReadAsStringAsync());
    Need(chunks.RootElement.GetProperty("chunks").GetArrayLength() == 1, "immutable chunk survives restart without duplicates");
    if (args.Length > 2)
    {
        var start = new ProcessStartInfo("node") { UseShellExecute = false, CreateNoWindow = true, RedirectStandardInput = true, RedirectStandardOutput = true, RedirectStandardError = true };
        start.ArgumentList.Add(Path.GetFullPath(args[2]));
        foreach (var name in new[] { "SFX_IDENTITY_CONNECTION_STRING", "SFX_IDENTITY_SERVICE_KEY", "SFX_EVIDENCE_CALLERS" }) start.Environment.Remove(name);
        using var child = Process.Start(start)!;
        var stdout = child.StandardOutput.ReadToEndAsync(); var stderr = child.StandardError.ReadToEndAsync();
        await child.StandardInput.WriteAsync(JsonSerializer.Serialize(new { endpoint = origin, serviceKey, bearer = user })); child.StandardInput.Close();
        await child.WaitForExitAsync(); string message = await stdout, errors = await stderr;
        Need(child.ExitCode == 0, "circuit capture/replay integration passed");
        if (message.Contains(user) || message.Contains(serviceKey) || errors.Contains(user) || errors.Contains(serviceKey)) throw new Exception("Private material appeared in child diagnostics.");
        Console.WriteLine(message);
        if (args.Length > 1) await File.WriteAllTextAsync(args[1] + ".capture.json", message);
    }
    await provider.RevokeAsync(user);
    Need((int)(await Send($"/runs/{runId}", token: user)).StatusCode == 401, "revoked session cannot read retained content");
    var receipt = JsonSerializer.Serialize(new { capturedAt = DateTimeOffset.UtcNow, basis = "Live sfx-identity and local HTTP host with explicit transport fixtures; no capability execution", checks, status = "PASS" }, new JsonSerializerOptions { WriteIndented = true });
    if (args.Length > 1) await File.WriteAllTextAsync(args[1], receipt);
}
finally
{
    if (app is not null) { await app.StopAsync(); await app.DisposeAsync(); }
    using var connection = new SqlConnection(Environment.GetEnvironmentVariable("SFX_IDENTITY_CONNECTION_STRING")); await connection.OpenAsync();
    using var command = connection.CreateCommand(); command.CommandText = """
    SET XACT_ABORT ON; BEGIN TRANSACTION;
    DELETE a FROM evidence.access_audit a JOIN evidence.run r ON r.run_id=a.run_id JOIN [identity].principal p ON p.principal_id=r.principal_id WHERE p.realm=@realm;
    DELETE a FROM evidence.run_capture_issue a JOIN evidence.run r ON r.run_id=a.run_id JOIN [identity].principal p ON p.principal_id=r.principal_id WHERE p.realm=@realm;
    DELETE a FROM evidence.run_completion a JOIN evidence.run r ON r.run_id=a.run_id JOIN [identity].principal p ON p.principal_id=r.principal_id WHERE p.realm=@realm;
    DELETE a FROM evidence.run_trace_chunk a JOIN evidence.run r ON r.run_id=a.run_id JOIN [identity].principal p ON p.principal_id=r.principal_id WHERE p.realm=@realm;
    DELETE r FROM evidence.run r JOIN [identity].principal p ON p.principal_id=r.principal_id WHERE p.realm=@realm;
    DELETE a FROM [identity].authentication_audit a LEFT JOIN [identity].authentication_attempt t ON t.attempt_id=a.attempt_id LEFT JOIN [identity].principal p ON p.principal_id=a.principal_id WHERE t.realm=@realm OR p.realm=@realm;
    DELETE s FROM [identity].session s JOIN [identity].principal p ON p.principal_id=s.principal_id WHERE p.realm=@realm;
    DELETE FROM [identity].authentication_attempt WHERE realm=@realm;
    DELETE c FROM [identity].password_credential c JOIN [identity].principal p ON p.principal_id=c.principal_id WHERE p.realm=@realm;
    DELETE FROM [identity].principal WHERE realm=@realm;
    COMMIT TRANSACTION;
    """; command.Parameters.AddWithValue("@realm", realm); await command.ExecuteNonQueryAsync();
    Environment.SetEnvironmentVariable("SFX_EVIDENCE_CALLERS", null);
}
