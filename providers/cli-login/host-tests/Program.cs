using System.Diagnostics;
using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Security.Cryptography.X509Certificates;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Data.SqlClient;
using SfxProviders.CliLogin;
using SfxProviders.CliLogin.Hosting;

// Real identity database, HTTPS host, providers and kernel. No provider fixture.
// --preflight <estate> <lifecycle-runner> <migration> <evidence-directory>
// --installed <estate> <evidence-directory>
if (args.Length < 3 || args[0] is not ("--preflight" or "--installed")) throw new Exception("Explicit integration mode required.");
bool preflight = args[0] == "--preflight";
string estate = Path.GetFullPath(args[1]), evidence = Path.GetFullPath(args[^1]);
Directory.CreateDirectory(evidence);
string realm = "host-verification-" + Guid.NewGuid().ToString("N");
string identifier = Guid.NewGuid().ToString("N"), password = Convert.ToHexString(RandomNumberGenerator.GetBytes(24));
var dal = new GeneratedIdentityDal();
using var hasher = new Argon2PasswordVerifier();
var verifier = await hasher.CreateForEnrollmentAsync(Encoding.UTF8.GetBytes(password));
var user = await dal.ProvisionPrincipalCredentialAsync(realm, identifier, verifier);
var settings = new HostSettings(estate,"authenticate-ide-user","ide-login-observation-request.v1","ide-authentication-result.v1",realm,"https://localhost:8793","https://localhost:8793/test/observations",false);
var observations = new List<string>();
var stages = new List<int>();
var passed = new List<string>();
int runNumber = 0;
using var client = new HttpClient { BaseAddress = new Uri(settings.ProviderOrigin), Timeout = TimeSpan.FromMinutes(3) };
using var certificateStore=new X509Store(StoreName.My,StoreLocation.CurrentUser); certificateStore.Open(OpenFlags.ReadOnly);
var certificate=certificateStore.Certificates.Where(x=>x.Subject=="CN=localhost" && x.HasPrivateKey && x.NotAfter>DateTime.UtcNow && x.Extensions.Any(e=>e.Oid?.Value=="1.3.6.1.4.1.311.84.1.1")).OrderByDescending(x=>x.NotAfter).First();
var app = LoginApplication.Create([], settings, Run, builder=>builder.WebHost.ConfigureKestrel(k=>
{
    k.ListenLocalhost(8793,listen=>listen.UseHttps(certificate));
    k.ListenLocalhost(8794);
}));
string? observerEndpoint = Environment.GetEnvironmentVariable("SFX_LOGIN_TEST_OBSERVER_ENDPOINT");
using var liveObserver = new HttpClient { Timeout = TimeSpan.FromSeconds(10) };
app.Urls.Add(settings.ProviderOrigin);
app.MapPost("/test/observations", async (HttpContext context) =>
{
    context.Features.Get<Microsoft.AspNetCore.Http.Features.IHttpMaxRequestBodySizeFeature>()!.MaxRequestBodySize=16*1024*1024;
    using var reader = new StreamReader(context.Request.Body);
    string value = await reader.ReadToEndAsync();
    lock (observations) observations.Add(value);
    if (observerEndpoint is not null)
    {
        using var sent = await liveObserver.PostAsync(observerEndpoint, new StringContent(value, Encoding.UTF8, "application/json"), context.RequestAborted);
        sent.EnsureSuccessStatusCode();
    }
    return Results.Ok();
});
await app.StartAsync();
try
{
    using (var plaintext = new HttpClient { BaseAddress = new Uri("http://localhost:8794") })
        foreach (string path in new[] { "login", "provider/resolve", "session", "logout" })
        {
            using var message = new HttpRequestMessage(path == "session" ? HttpMethod.Get : HttpMethod.Post, "/auth/v1/" + path);
            using var refused = await plaintext.SendAsync(message);
            Need((int)refused.StatusCode == 400, "Plaintext " + path + " refused");
        }
    using (var forged = await client.PostAsJsonAsync("/auth/v1/provider/establish",new {correlationId=Guid.NewGuid().ToString("N")})) Need((int)forged.StatusCode==401,"Unowned provider context rejected");
    using (var invalid = await client.PostAsJsonAsync("/auth/v1/login",new {identifier,password,extra=true})) Need((int)invalid.StatusCode==400,"Unexpected private input refused");
    using var response = await client.PostAsJsonAsync("/auth/v1/login",new {identifier,password});
    var text = await response.Content.ReadAsStringAsync();
    if (!response.IsSuccessStatusCode) throw new Exception("Valid login HTTP "+(int)response.StatusCode+"; stages="+string.Join(',',stages));
    using var session = JsonDocument.Parse(text);
    string token = session.RootElement.GetProperty("token").GetString()!;
    Need(stages[^1]==3,"Successful login calls all three providers");
    client.DefaultRequestHeaders.Authorization=new("Bearer",token);
    using (var status=await client.GetAsync("/auth/v1/session")) Need(status.IsSuccessStatusCode,"Issued session validates against database (HTTP "+(int)status.StatusCode+")");
    using (var logout=await client.PostAsync("/auth/v1/logout",null)) Need(logout.IsSuccessStatusCode,"Logout revokes session");
    using (var status=await client.GetAsync("/auth/v1/session")) Need((int)status.StatusCode==401,"Revoked session rejected");
    client.DefaultRequestHeaders.Authorization=null;
    foreach (var pair in new[] {(identifier,password+"wrong"),(Guid.NewGuid().ToString("N"),password)})
    {
        using var rejected=await client.PostAsJsonAsync("/auth/v1/login",new {identifier=pair.Item1,password=pair.Item2});
        using var body=JsonDocument.Parse(await rejected.Content.ReadAsStringAsync());
        Need((int)rejected.StatusCode==401 && body.RootElement.GetProperty("disposition").GetString()=="AUTHENTICATION_REJECTED","Wrong or unknown credential rejected");
        Need(stages[^1]==2,"Rejected credential never calls session provider");
    }
    // A rejected request must not poison a subsequent independent login.
    using var repeated = await client.PostAsJsonAsync("/auth/v1/login",new {identifier,password});
    Need(repeated.IsSuccessStatusCode && stages[^1]==3,"Valid login after rejection calls all three providers");
    using var repeatedSession = JsonDocument.Parse(await repeated.Content.ReadAsStringAsync());
    string repeatedToken = repeatedSession.RootElement.GetProperty("token").GetString()!;
    client.DefaultRequestHeaders.Authorization=new("Bearer",repeatedToken);
    using (var logout=await client.PostAsync("/auth/v1/logout",null)) Need(logout.IsSuccessStatusCode,"Subsequent session revoked");
    client.DefaultRequestHeaders.Authorization=null;
    string material=string.Join('\n',observations);
    Need(material.Length>0 && !material.Contains(password,StringComparison.Ordinal) && !material.Contains(token,StringComparison.Ordinal) && !material.Contains(repeatedToken,StringComparison.Ordinal) && !material.Contains(identifier,StringComparison.Ordinal) && !material.Contains(Environment.GetEnvironmentVariable("SFX_IDENTITY_SERVICE_KEY")!,StringComparison.Ordinal),"Private credentials and session absent from captured kernel evidence");
    if (!preflight) Need(observations.Count>10,"Installed kernel publishes real execution observations");
    await File.WriteAllTextAsync(Path.Combine(evidence,"receipt.json"),JsonSerializer.Serialize(new {checkedAt=DateTimeOffset.UtcNow,mode=args[0],database="sfx-identity",passed,providerCallCounts=stages,observationCount=observations.Count},new JsonSerializerOptions{WriteIndented=true}));
    await File.WriteAllLinesAsync(Path.Combine(evidence,"observations.ndjson"),observations);
}
finally
{
    await app.StopAsync(); await app.DisposeAsync();
    using var connection = new SqlConnection(Environment.GetEnvironmentVariable("SFX_IDENTITY_CONNECTION_STRING"));
    await connection.OpenAsync(); using var command=connection.CreateCommand();
    command.CommandText="""
        SET XACT_ABORT ON; BEGIN TRANSACTION;
        DELETE a FROM [identity].authentication_audit a LEFT JOIN [identity].authentication_attempt t ON t.attempt_id=a.attempt_id LEFT JOIN [identity].principal p ON p.principal_id=a.principal_id WHERE t.realm=@realm OR p.realm=@realm;
        DELETE s FROM [identity].session s JOIN [identity].principal p ON p.principal_id=s.principal_id WHERE p.realm=@realm;
        DELETE FROM [identity].authentication_attempt WHERE realm=@realm;
        DELETE c FROM [identity].password_credential c JOIN [identity].principal p ON p.principal_id=c.principal_id WHERE p.realm=@realm;
        DELETE FROM [identity].principal WHERE realm=@realm;
        COMMIT TRANSACTION;
        SELECT (SELECT COUNT(*) FROM [identity].principal WHERE realm=@realm)+(SELECT COUNT(*) FROM [identity].authentication_attempt WHERE realm=@realm);
        """;
    command.Parameters.AddWithValue("@realm",realm);
    if ((int)(await command.ExecuteScalarAsync())! != 0) throw new Exception("Test cleanup incomplete");
}
void Need(bool condition,string name) { if (!condition) throw new Exception(name); passed.Add(name); Console.WriteLine("PASS "+name); }
async Task<string> Run(HostSettings configuration,LoginExecution execution,HttpClient telemetry,CancellationToken cancellation)
{
    try
    {
        if (!preflight) return await KernelRun.ExecuteAsync(configuration,execution,telemetry,cancellation);
        int number=Interlocked.Increment(ref runNumber);
        var inputPath=Path.Combine(evidence,$"input-{number}.json");
        await File.WriteAllTextAsync(inputPath,JsonSerializer.Serialize(new {contractId=configuration.InputContract,payload=new {correlationId=execution.Correlation,providerOrigin=configuration.ProviderOrigin}}),cancellation);
        // Trust only the real local development certificate; never disable TLS validation.
        string pem=Path.Combine(evidence,"localhost-public.pem"); await File.WriteAllTextAsync(pem,certificate.ExportCertificatePem(),cancellation);
        var start=new ProcessStartInfo("node"){WorkingDirectory=estate,UseShellExecute=false,CreateNoWindow=true,RedirectStandardOutput=true,RedirectStandardError=true};
        foreach(var arg in new[]{Path.GetFullPath(args[2]),Path.GetFullPath(args[3]),configuration.Capability,inputPath}) start.ArgumentList.Add(arg);
        start.Environment.Remove("SFX_IDENTITY_SERVICE_KEY");
        start.Environment["NODE_EXTRA_CA_CERTS"]=pem;
        start.Environment["SFX_PREFLIGHT_PHYSICAL_TRACE"]="1";
        start.Environment.Remove("SFX_IDENTITY_CONNECTION_STRING");
        using var process=Process.Start(start)!;
        using var stop=cancellation.Register(()=>{try{process.Kill(true);}catch(InvalidOperationException){}});
        var output=process.StandardOutput.ReadToEndAsync(cancellation);var error=process.StandardError.ReadToEndAsync(cancellation);
        await Task.WhenAll(output,error,process.WaitForExitAsync(cancellation));
        string record=await output,diagnostic=await error;
        if ((record+diagnostic).Contains(Environment.GetEnvironmentVariable("SFX_IDENTITY_SERVICE_KEY")!,StringComparison.Ordinal)) throw new Exception("Private service key exposed by kernel");
        lock(observations) observations.Add(record);
        await File.WriteAllTextAsync(Path.Combine(evidence,$"preflight-{number}.txt"),record+diagnostic,cancellation);
        if(process.ExitCode!=0) throw new Exception("Preflight invocation failed; inspect safe evidence");
        using var result=JsonDocument.Parse(record.Split('\n').Single(x=>x.StartsWith("OUTCOME ",StringComparison.Ordinal))[8..]);
        JsonElement value=result.RootElement;
        if(value.TryGetProperty("outcome",out var outcome)) value=outcome;
        return value.GetProperty("disposition").GetString()!;
    }
    catch(Exception error) { Console.Error.WriteLine("Kernel integration failure: "+error.GetType().Name+" "+error.Message); throw; }
    finally { stages.Add(execution.Stage); }
}
