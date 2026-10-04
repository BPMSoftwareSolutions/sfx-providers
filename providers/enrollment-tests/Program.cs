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

// Real database, generated DAL, private HTTPS providers and installed/preflight kernel.
// --preflight <estate> <runner> <rollback-migration> <evidence>
// --installed <estate> <evidence>
if (args.Length < 3 || args[0] is not ("--preflight" or "--installed")) throw new Exception("Mode required");
bool preflight=args[0]=="--preflight";
string estate=Path.GetFullPath(args[1]), evidence=Path.GetFullPath(args[^1]);
Directory.CreateDirectory(evidence);
string realm="enrollment-test-"+Guid.NewGuid().ToString("N"), identifier=Guid.NewGuid().ToString("N"), password=Convert.ToHexString(RandomNumberGenerator.GetBytes(24));
string operatorToken=Convert.ToHexString(RandomNumberGenerator.GetBytes(12));
Environment.SetEnvironmentVariable("SFX_IDENTITY_ENROLLMENT_TOKEN",operatorToken);
Environment.SetEnvironmentVariable("SFX_ENROLLMENT_CAPABILITY","enroll-ide-user");
Environment.SetEnvironmentVariable("SFX_ENROLLMENT_INPUT_CONTRACT","ide-enrollment-observation-request.v1");
Environment.SetEnvironmentVariable("SFX_ENROLLMENT_OUTCOME_CONTRACT","ide-enrollment-result.v1");
var settings=new HostSettings(estate,"authenticate-ide-user","ide-login-observation-request.v1","ide-authentication-result.v1",realm,"https://localhost:8795","https://localhost:8795/test/observations",false);
var passed=new List<string>(); var observations=new List<string>(); int runNumber=0;
using var store=new X509Store(StoreName.My,StoreLocation.CurrentUser);store.Open(OpenFlags.ReadOnly);
var certificate=store.Certificates.Where(x=>x.Subject=="CN=localhost" && x.HasPrivateKey && x.NotAfter>DateTime.UtcNow && x.Extensions.Any(e=>e.Oid?.Value=="1.3.6.1.4.1.311.84.1.1")).OrderByDescending(x=>x.NotAfter).First();
var app=LoginApplication.Create([],settings,configure:b=>b.WebHost.ConfigureKestrel(k=>{k.ListenLocalhost(8795,l=>l.UseHttps(certificate));k.ListenLocalhost(8796);}),enrollmentRun:Run);
app.MapPost("/test/observations",async(HttpContext http)=>{
 http.Features.Get<Microsoft.AspNetCore.Http.Features.IHttpMaxRequestBodySizeFeature>()!.MaxRequestBodySize=16*1024*1024;
 using var reader=new StreamReader(http.Request.Body);string line=await reader.ReadToEndAsync(); lock(observations)observations.Add(line);return Results.Ok();
});
using var client=new HttpClient{BaseAddress=new Uri(settings.ProviderOrigin),Timeout=TimeSpan.FromMinutes(3)};
await app.StartAsync();
try{
 using(var db=new SqlConnection(Environment.GetEnvironmentVariable("SFX_IDENTITY_CONNECTION_STRING"))){
  await db.OpenAsync();using var command=db.CreateCommand();
  command.CommandText="SELECT DB_NAME() db_name,(SELECT COUNT(*) FROM sys.procedures p JOIN sys.schemas s ON s.schema_id=p.schema_id WHERE s.name=N'identity' AND p.name=N'provision_principal_credential') procedure_count,OBJECT_DEFINITION(OBJECT_ID(N'identity.provision_principal_credential')) definition";
  using var rows=await command.ExecuteReaderAsync();Need(await rows.ReadAsync() && rows.GetString(0)=="sfx-identity" && rows.GetInt32(1)==1,"Installed identity writer exists in sfx-identity");
  await File.WriteAllTextAsync(Path.Combine(evidence,"identity-writer.sql"),rows.GetString(2));
 }
 using(var anonymous=await client.PostAsJsonAsync("/auth/v1/enroll",new{identifier,password}))Need((int)anonymous.StatusCode==401,"Anonymous enrollment refused before execution");
 client.DefaultRequestHeaders.Authorization=new("Bearer",operatorToken);
 using(var invalid=await client.PostAsJsonAsync("/auth/v1/enroll",new{identifier,password,realm="forged"}))Need((int)invalid.StatusCode==400,"Caller cannot select realm");
 using(var plain=new HttpClient()){
  plain.DefaultRequestHeaders.Authorization=new("Bearer",operatorToken);
  using var response=await plain.PostAsJsonAsync("http://localhost:8796/auth/v1/enroll",new{identifier,password});Need((int)response.StatusCode==400,"Plaintext enrollment refused");
 }
 using(var forged=await client.PostAsJsonAsync("/auth/v1/enrollment-provider/provision",new{correlationId=new string('0',32)}))Need((int)forged.StatusCode==401,"Operator bearer cannot invoke private provider");
 await Enroll("short",422,"ENROLLMENT_REJECTED");
 Need(await Counts()==0,"Rejected password creates no principal or credential");
 await Enroll(password,201,"ENROLLED");
 Need(await Counts()==3,"Enrollment atomically creates principal, credential and audit");
 await Enroll(password+"different",409,"ALREADY_ENROLLED");
 Need(await Counts()==3,"Duplicate enrollment makes no additional identity writes");
 var dal=new GeneratedIdentityDal();using var hasher=new Argon2PasswordVerifier();var policy=new LoginPolicy(TimeSpan.FromMinutes(2),TimeSpan.FromMinutes(30));
 using var input=LoginInput.FromPrivateRequest(identifier,password);using var attempt=await new IdentityPrincipalProvider(dal,policy).ResolveAsync(input,realm,"enrollment-acceptance");
 var verified=await new PasswordCredentialProvider(dal,hasher).VerifyAsync(attempt);Need(verified.Receipt.Disposition==LoginDisposition.CredentialVerified,"Original password remains valid after duplicate enrollment");
 string text=string.Join('\n',observations);
 Need(text.Length>0 && new[]{identifier,password,operatorToken,Environment.GetEnvironmentVariable("SFX_IDENTITY_SERVICE_KEY")!}.All(x=>!text.Contains(x,StringComparison.Ordinal)) && !text.Contains("$argon2id$"),"Private inputs, verifier and operator/service secrets absent from evidence");
 if(!preflight)Need(observations.Count>50,"Installed kernel emits genuine enrollment observations");
 await File.WriteAllTextAsync(Path.Combine(evidence,"receipt.json"),JsonSerializer.Serialize(new{checkedAt=DateTimeOffset.UtcNow,mode=args[0],passed,observationCount=observations.Count},new JsonSerializerOptions{WriteIndented=true}));
 await File.WriteAllLinesAsync(Path.Combine(evidence,"observations.ndjson"),observations);
}finally{
 await app.StopAsync();await app.DisposeAsync();
 using var db=new SqlConnection(Environment.GetEnvironmentVariable("SFX_IDENTITY_CONNECTION_STRING"));await db.OpenAsync();using var command=db.CreateCommand();
 command.CommandText="""
 SET XACT_ABORT ON; BEGIN TRANSACTION;
 DELETE a FROM [identity].authentication_audit a LEFT JOIN [identity].authentication_attempt t ON t.attempt_id=a.attempt_id LEFT JOIN [identity].principal p ON p.principal_id=a.principal_id WHERE t.realm=@realm OR p.realm=@realm;
 DELETE s FROM [identity].session s JOIN [identity].principal p ON p.principal_id=s.principal_id WHERE p.realm=@realm;
 DELETE FROM [identity].authentication_attempt WHERE realm=@realm;
 DELETE c FROM [identity].password_credential c JOIN [identity].principal p ON p.principal_id=c.principal_id WHERE p.realm=@realm;
 DELETE FROM [identity].principal WHERE realm=@realm;
 COMMIT;
 """;command.Parameters.AddWithValue("@realm",realm);await command.ExecuteNonQueryAsync();
}
void Need(bool value,string label){if(!value)throw new Exception(label);passed.Add(label);Console.WriteLine("PASS "+label);}
async Task Enroll(string secret,int status,string expected){
 using var response=await client.PostAsJsonAsync("/auth/v1/enroll",new{identifier,password=secret});using var body=JsonDocument.Parse(await response.Content.ReadAsStringAsync());
 Need((int)response.StatusCode==status && body.RootElement.GetProperty("disposition").GetString()==expected,"Declared outcome "+expected+" (HTTP "+(int)response.StatusCode+")");
}
async Task<int> Counts(){
 using var db=new SqlConnection(Environment.GetEnvironmentVariable("SFX_IDENTITY_CONNECTION_STRING"));await db.OpenAsync();using var command=db.CreateCommand();
 command.CommandText="SELECT (SELECT COUNT(*) FROM [identity].principal WHERE realm=@realm)+(SELECT COUNT(*) FROM [identity].password_credential c JOIN [identity].principal p ON p.principal_id=c.principal_id WHERE p.realm=@realm)+(SELECT COUNT(*) FROM [identity].authentication_audit a JOIN [identity].principal p ON p.principal_id=a.principal_id WHERE p.realm=@realm)";
 command.Parameters.AddWithValue("@realm",realm);return (int)(await command.ExecuteScalarAsync())!;
}
async Task<string> Run(HostSettings configuration,string correlation,HttpClient telemetry,CancellationToken cancellation){
 if(!preflight)return await KernelRun.ExecuteAsync(configuration,correlation,telemetry,cancellation);
 int number=Interlocked.Increment(ref runNumber);string inputPath=Path.Combine(evidence,$"input-{number}.json"),pem=Path.Combine(evidence,"localhost-public.pem");
 await File.WriteAllTextAsync(inputPath,JsonSerializer.Serialize(new{contractId=configuration.InputContract,payload=new{correlationId=correlation,providerOrigin=configuration.ProviderOrigin}}));
 await File.WriteAllTextAsync(pem,certificate.ExportCertificatePem());
 var start=new ProcessStartInfo("node"){WorkingDirectory=estate,UseShellExecute=false,CreateNoWindow=true,RedirectStandardOutput=true,RedirectStandardError=true};
 foreach(var argument in new[]{Path.GetFullPath(args[2]),Path.GetFullPath(args[3]),configuration.Capability,inputPath})start.ArgumentList.Add(argument);
 foreach(var key in new[]{"SFX_IDENTITY_SERVICE_KEY","SFX_IDENTITY_ENROLLMENT_TOKEN","SFX_IDENTITY_CONNECTION_STRING"})start.Environment.Remove(key);
 start.Environment["NODE_EXTRA_CA_CERTS"]=pem;start.Environment["SFX_PREFLIGHT_PHYSICAL_TRACE"]="1";
 using var process=Process.Start(start)!;using var stop=cancellation.Register(()=>{try{process.Kill(true);}catch(InvalidOperationException){}});
 var stdout=process.StandardOutput.ReadToEndAsync();var stderr=process.StandardError.ReadToEndAsync();await process.WaitForExitAsync(cancellation);
 string record=await stdout+await stderr;
 if(record.Contains(Environment.GetEnvironmentVariable("SFX_IDENTITY_SERVICE_KEY")!) || record.Contains(operatorToken))throw new Exception("Private material in preflight");
 observations.Add(record);await File.WriteAllTextAsync(Path.Combine(evidence,$"preflight-{number}.txt"),record);
 if(process.ExitCode!=0)throw new Exception("Preflight failed; inspect safe evidence");
 using var result=JsonDocument.Parse(record.Split('\n').Single(x=>x.StartsWith("OUTCOME "))[8..]);var value=result.RootElement;
 if(value.TryGetProperty("outcome",out var outcome))value=outcome;
 return value.GetProperty("disposition").GetString()!;
}
