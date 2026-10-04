using System.Diagnostics;
using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.Data.SqlClient;
using SfxProviders.CliLogin;

// Operator acceptance against an already deployed host. Only the randomly
// named fixture is enrolled/removed; no existing user's password is requested.
if(args.Length!=5) throw new Exception("Expected HTTPS endpoint realm CLI-test-module installed-bin evidence-directory");
var endpoint=new Uri(args[0]);
if(endpoint.Scheme!="https" || endpoint.AbsolutePath!="/") throw new Exception("HTTPS origin required");
string realm=args[1],identifier="acceptance-"+Guid.NewGuid().ToString("N"),password=Convert.ToHexString(RandomNumberGenerator.GetBytes(24));
string evidence=Path.GetFullPath(args[4]);Directory.CreateDirectory(evidence);
var dal=new GeneratedIdentityDal();using var hasher=new Argon2PasswordVerifier();
var verifier=await hasher.CreateForEnrollmentAsync(Encoding.UTF8.GetBytes(password));
var principal=await dal.ProvisionPrincipalCredentialAsync(realm,identifier,verifier);
using var client=new HttpClient{BaseAddress=endpoint,Timeout=TimeSpan.FromMinutes(3)};
using var cancel=new CancellationTokenSource();var events=new List<(DateTimeOffset Received,string Json)>();
using var streamResponse=await client.GetAsync("/events",HttpCompletionOption.ResponseHeadersRead);
streamResponse.EnsureSuccessStatusCode();
var streaming=Capture();
try
{
 using(var forged=await client.PostAsJsonAsync("/auth/v1/provider/establish",new {correlationId=Guid.NewGuid().ToString("N")}))
  Need((int)forged.StatusCode==401,"Unowned provider callback refused");
 using(var invalid=await client.PostAsJsonAsync("/auth/v1/login",new {identifier,password,extra=true}))
  Need((int)invalid.StatusCode==400,"Unexpected private input refused");
 using(var rejected=await client.PostAsJsonAsync("/auth/v1/login",new {identifier,password=password+"wrong"}))
  Need((int)rejected.StatusCode==401,"Incorrect password refused");
 var start=new ProcessStartInfo("node"){UseShellExecute=false,CreateNoWindow=true,RedirectStandardInput=true,RedirectStandardOutput=true,RedirectStandardError=true};
 start.ArgumentList.Add(Path.GetFullPath(args[2]));start.Environment.Remove("SFX_IDENTITY_CONNECTION_STRING");start.Environment.Remove("SFX_IDENTITY_SERVICE_KEY");
 using var cli=Process.Start(start)!;var stdout=cli.StandardOutput.ReadToEndAsync();var stderr=cli.StandardError.ReadToEndAsync();
 await cli.StandardInput.WriteAsync(JsonSerializer.Serialize(new {endpoint=endpoint.GetLeftPart(UriPartial.Authority),identifier,password,bin=Path.GetFullPath(args[3])}));cli.StandardInput.Close();
 await cli.WaitForExitAsync();string output=await stdout,error=await stderr;
 if(!error.Contains(password))Console.Error.WriteLine(error);
 Need(cli.ExitCode==0 && !output.Contains(password) && !error.Contains(password),"Installed CLI remote acceptance passed");
 await File.WriteAllTextAsync(Path.Combine(evidence,"cli-receipt.json"),output);
 await Task.Delay(200);cancel.Cancel();try{await streaming;}catch(OperationCanceledException){}
 var material=string.Join('\n',events.Select(x=>x.Json));
 Need(!material.Contains(password) && !material.Contains(identifier),"Private login input absent from live observer");
 await File.WriteAllLinesAsync(Path.Combine(evidence,"observations.ndjson"),events.Select(x=>JsonSerializer.Serialize(new {receivedAt=x.Received,record=JsonSerializer.Deserialize<JsonElement>(x.Json)})));
 var cells=events.Select(x=>JsonDocument.Parse(x.Json)).Where(x=>x.RootElement.GetProperty("payload").TryGetProperty("testimonyType",out var type)&&type.GetString()=="cell-execution-testimony.v1").ToArray();
 var providerIds=new HashSet<string>();
 foreach(var item in events)
 {
  using var document=JsonDocument.Parse(item.Json);var payload=document.RootElement.GetProperty("payload");
  if(payload.TryGetProperty("observationType",out var type)&&type.GetString()=="execution-graph-captured.v1")
   foreach(var cell in payload.GetProperty("cells").EnumerateArray())
    if(cell.GetProperty("altitude").GetString()=="provider"&&cell.GetProperty("authorityId").GetString()=="provider:sda-governed-http-exchange-port.v1")providerIds.Add(cell.GetProperty("cellId").GetString()!);
 }
 var providers=cells.Select(x=>x.RootElement.GetProperty("payload")).Where(x=>providerIds.Contains(x.GetProperty("cellId").GetString()!)).ToArray();
 Need(providers.Length>=5,"Real provider exchange receipts reached hosted observer");
 Need(cells.Any(x=>x.RootElement.GetProperty("payload").TryGetProperty("outcomeVariant",out var variant)&&variant.GetString()=="AUTHENTICATED"),"Authenticated outcome reached hosted observer");
 Need(events.Count(x=>x.Json.Contains("cell-execution-testimony.v1"))>20,"Live SSE received kernel testimony");
 await File.WriteAllTextAsync(Path.Combine(evidence,"receipt.json"),JsonSerializer.Serialize(new {endpoint=args[0],realm,checkedAt=DateTimeOffset.UtcNow,liveEvents=events.Count,providerExchangeReceipts=providers.Length,cliPassed=true,credentialsAbsent=true},new JsonSerializerOptions{WriteIndented=true}));
 foreach(var cell in cells)cell.Dispose();
}
finally
{
 cancel.Cancel();try{await streaming;}catch(OperationCanceledException){}
 using var connection=new SqlConnection(Environment.GetEnvironmentVariable("SFX_IDENTITY_CONNECTION_STRING"));await connection.OpenAsync();using var command=connection.CreateCommand();
 command.CommandText="""
 SET XACT_ABORT ON; BEGIN TRANSACTION;
 DELETE a FROM [identity].authentication_audit a LEFT JOIN [identity].authentication_attempt t ON t.attempt_id=a.attempt_id WHERE a.principal_id=@principal OR (t.realm=@realm AND t.normalized_identifier=@identifier);
 DELETE FROM [identity].session WHERE principal_id=@principal;
 DELETE FROM [identity].authentication_attempt WHERE realm=@realm AND normalized_identifier=@identifier;
 DELETE FROM [identity].password_credential WHERE principal_id=@principal;
 DELETE FROM [identity].principal WHERE principal_id=@principal;
 COMMIT TRANSACTION;
 SELECT COUNT(*) FROM [identity].principal WHERE principal_id=@principal;
 """;
 command.Parameters.AddWithValue("@principal",principal);command.Parameters.AddWithValue("@realm",realm);command.Parameters.AddWithValue("@identifier",identifier);
 Need((int)(await command.ExecuteScalarAsync())! ==0,"Disposable principal removed; existing users preserved");
}
async Task Capture()
{
 using var reader=new StreamReader(await streamResponse.Content.ReadAsStreamAsync(cancel.Token));
 while(await reader.ReadLineAsync(cancel.Token) is {} line)
  if(line.StartsWith("data: ",StringComparison.Ordinal))events.Add((DateTimeOffset.UtcNow,line[6..]));
}
void Need(bool value,string message){if(!value)throw new Exception(message);Console.WriteLine("PASS "+message);}
