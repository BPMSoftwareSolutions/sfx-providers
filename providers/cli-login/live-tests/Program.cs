using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.Data.SqlClient;
using SfxProviders.CliLogin;

if (args.Length == 0 || args[0] != "--live") throw new Exception("Pass --live for isolated tests in sfx-identity.");
var dal = new GeneratedIdentityDal(); // validates the database name before any write
using var hasher = new Argon2PasswordVerifier();
string password = Convert.ToHexString(RandomNumberGenerator.GetBytes(24));
var encoded = await hasher.CreateForEnrollmentAsync(Encoding.UTF8.GetBytes(password));
var policy = new LoginPolicy(TimeSpan.FromMinutes(2), TimeSpan.FromMinutes(30));
string realm = "provider-verification-" + Guid.NewGuid().ToString("N");
var passed = new List<string>();
async Task Check(string name, Func<Task> test)
{
    try { await test(); passed.Add(name); Console.WriteLine("PASS " + name); }
    catch { Console.Error.WriteLine("FAIL " + name); throw new Exception("Identity verification failed; private diagnostics suppressed."); }
}
async Task<(Guid Id, string Identifier)> User()
{
    string id = Guid.NewGuid().ToString("N");
    return (await dal.ProvisionPrincipalCredentialAsync(realm, id, encoded), id);
}
async Task<ResolvedLoginAttempt> Resolve(string identifier, string? supplied = null)
    => await new IdentityPrincipalProvider(dal, policy).ResolveAsync(LoginInput.FromPrivateRequest(identifier, supplied ?? password), realm, realm + Guid.NewGuid().ToString("N"));
async Task<VerifiedLoginAttempt> Verify(ResolvedLoginAttempt attempt)
    => await new PasswordCredentialProvider(dal, hasher).VerifyAsync(attempt);
async Task<string> Token(AuthenticatedSession session)
{
    using var stream = new MemoryStream();
    await session.WritePrivateResponseAsync(stream);
    using var json = JsonDocument.Parse(stream.ToArray());
    return json.RootElement.GetProperty("token").GetString()!;
}
async Task<int> Sql(string sql, params (string Name, object Value)[] parameters)
{
    using var connection = new SqlConnection(Environment.GetEnvironmentVariable("SFX_IDENTITY_CONNECTION_STRING"));
    await connection.OpenAsync();
    using var command = connection.CreateCommand();
    command.CommandText = sql; command.CommandTimeout = 60;
    foreach (var p in parameters) command.Parameters.AddWithValue(p.Name, p.Value);
    return await command.ExecuteNonQueryAsync();
}
void Need(bool condition) { if (!condition) throw new Exception("Assertion failed."); }
int remaining = -1;
try
{
    await Check("real Argon2 login through generated DAL; validate and revoke real session", async () =>
    {
        var user = await User();
        using var attempt = await Resolve(user.Identifier);
        var verified = await Verify(attempt);
        Need(verified.Receipt.Disposition == LoginDisposition.CredentialVerified);
        var sessions = new IdeSessionProvider(dal, policy);
        using var session = await sessions.EstablishAsync(verified);
        string token = await Token(session);
        Need((await sessions.ValidateAsync(token))?.PrincipalId == user.Id);
        await sessions.RevokeAsync(token); await sessions.RevokeAsync(token);
        Need(await sessions.ValidateAsync(token) is null);
    });
    await Check("wrong password and unknown principal rejected with no session", async () =>
    {
        var user = await User();
        foreach (var pair in new[] { (user.Identifier, password + "x"), (Guid.NewGuid().ToString("N"), password) })
        {
            using var attempt = await Resolve(pair.Item1, pair.Item2);
            var result = await Verify(attempt);
            Need(result.Receipt.Disposition == LoginDisposition.AuthenticationRejected);
        }
    });
    await Check("disabled principal rejected despite correct password", async () =>
    {
        var user = await User();
        await Sql("UPDATE [identity].principal SET active=0 WHERE principal_id=@id AND realm=@realm;", ("@id",user.Id),("@realm",realm));
        using var attempt = await Resolve(user.Identifier);
        Need((await Verify(attempt)).Receipt.Disposition == LoginDisposition.AuthenticationRejected);
    });
    await Check("database verification is consumed once across concurrent callers", async () =>
    {
        var user = await User();
        using var attempt = await Resolve(user.Identifier);
        // Tests the trusted persistence boundary, not a substitute for KDF verification.
        var accepted = await Task.WhenAll(Enumerable.Range(0, 6).Select(_ =>
            dal.CompleteVerificationAsync(attempt.AttemptId,user.Id,1,1,true,default)));
        Need(accepted.Count(x => x) == 1);
    });
    await Check("database session creation is consumed once across concurrent callers", async () =>
    {
        var user = await User();
        using var attempt = await Resolve(user.Identifier);
        await Verify(attempt); // real password verification first
        var results = await Task.WhenAll(Enumerable.Range(0, 6).Select(_ =>
            dal.EstablishSessionAsync(attempt.AttemptId,user.Id,1,1,RandomNumberGenerator.GetBytes(32),
                DateTimeOffset.UtcNow.AddMinutes(10),default)));
        Need(results.Count(x => x.Established) == 1);
    });
    await Check("credential rotation between verification and establishment refuses session", async () =>
    {
        var user = await User();
        using var attempt = await Resolve(user.Identifier);
        await Verify(attempt);
        await Sql("UPDATE [identity].password_credential SET credential_version=credential_version+1 WHERE principal_id=@id;",("@id",user.Id));
        Need(!(await dal.EstablishSessionAsync(attempt.AttemptId,user.Id,1,1,RandomNumberGenerator.GetBytes(32),DateTimeOffset.UtcNow.AddMinutes(10),default)).Established);
    });
    await Check("account throttle atomically admits only five concurrent attempts", async () =>
    {
        var user = await User();
        var attempts = await Task.WhenAll(Enumerable.Range(0, 8).Select(i =>
            dal.BeginAttemptAsync(realm,i % 2 == 0 ? user.Identifier.ToUpperInvariant() : " " + user.Identifier + " ",
                realm + Guid.NewGuid().ToString("N"), DateTimeOffset.UtcNow.AddMinutes(1),default)));
        Need(attempts.Count(x => x.Allowed) == 5);
    });
    await Check("expired attempt cannot verify or establish", async () =>
    {
        var user = await User();
        using var attempt = await Resolve(user.Identifier);
        await Sql("UPDATE [identity].authentication_attempt SET expires_at=DATEADD(second,-1,SYSUTCDATETIME()) WHERE attempt_id=@id;",("@id",attempt.AttemptId));
        Need((await Verify(attempt)).Receipt.Disposition == LoginDisposition.AuthenticationRejected);
        Need(!(await dal.EstablishSessionAsync(attempt.AttemptId,user.Id,1,1,RandomNumberGenerator.GetBytes(32),DateTimeOffset.UtcNow.AddMinutes(1),default)).Established);
    });
    await Check("absolute expiry, idle expiry and security version invalidate sessions", async () =>
    {
        foreach (string mutation in new[] { "absolute", "idle", "security" })
        {
            var user = await User();
            using var attempt = await Resolve(user.Identifier);
            var verified = await Verify(attempt);
            var sessions = new IdeSessionProvider(dal, policy);
            using var session = await sessions.EstablishAsync(verified);
            string token = await Token(session);
            string sql = mutation switch {
                "absolute" => "UPDATE [identity].session SET expires_at=DATEADD(second,-1,SYSUTCDATETIME()) WHERE session_id=@id;",
                "idle" => "UPDATE [identity].session SET last_seen_at=DATEADD(day,-1,SYSUTCDATETIME()) WHERE session_id=@id;",
                _ => "UPDATE [identity].principal SET security_version=security_version+1 WHERE principal_id=@id;"
            };
            await Sql(sql,("@id",mutation == "security" ? user.Id : session.Metadata.SessionId));
            Need(await sessions.ValidateAsync(token) is null);
        }
    });
    await Check("runtime role executes validation but cannot read credentials or enroll", async () =>
    {
        string name = "verify_identity_" + Guid.NewGuid().ToString("N");
        await Sql($"""
            SET XACT_ABORT OFF;
            BEGIN TRANSACTION;
            BEGIN TRY
              CREATE USER [{name}] WITHOUT LOGIN;
              ALTER ROLE sfx_identity_runtime ADD MEMBER [{name}];
              EXECUTE AS USER = '{name}';
              EXEC [identity].validate_session @verifier_hash=@hash;
              DECLARE @select_denied bit=0,@enroll_denied bit=0;
              BEGIN TRY
                SELECT COUNT(*) FROM [identity].password_credential;
              END TRY BEGIN CATCH
                IF ERROR_NUMBER()=229 SET @select_denied=1; ELSE THROW;
              END CATCH;
              BEGIN TRY
                EXEC [identity].provision_principal_credential N'forbidden',N'forbidden',N'forbidden';
              END TRY BEGIN CATCH
                IF ERROR_NUMBER()=229 SET @enroll_denied=1; ELSE THROW;
              END CATCH;
              REVERT;
              IF @select_denied<>1 OR @enroll_denied<>1 THROW 51000,'ROLE_CHECK_FAILED',1;
              ROLLBACK TRANSACTION;
            END TRY BEGIN CATCH
              IF USER_NAME()='{name}' REVERT;
              IF XACT_STATE()<>0 ROLLBACK TRANSACTION;
              THROW;
            END CATCH;
            """,("@hash",RandomNumberGenerator.GetBytes(32)));
    });
}
finally
{
    // Delete only the unique realm created by this test process and its FK children.
    // No shared policy or other principal is modified. Throttle hashes are derived
    // from this realm's principals/source values and expire normally (see receipt).
    await Sql("""
        SET XACT_ABORT ON;
        BEGIN TRANSACTION;
        DELETE a FROM [identity].authentication_audit a
        LEFT JOIN [identity].authentication_attempt t ON t.attempt_id=a.attempt_id
        LEFT JOIN [identity].principal p ON p.principal_id=a.principal_id
        WHERE t.realm=@realm OR p.realm=@realm;
        DELETE s FROM [identity].session s JOIN [identity].principal p ON p.principal_id=s.principal_id WHERE p.realm=@realm;
        DELETE FROM [identity].authentication_attempt WHERE realm=@realm;
        DELETE c FROM [identity].password_credential c JOIN [identity].principal p ON p.principal_id=c.principal_id WHERE p.realm=@realm;
        DELETE FROM [identity].principal WHERE realm=@realm;
        COMMIT TRANSACTION;
        """,("@realm",realm));
    using var connection = new SqlConnection(Environment.GetEnvironmentVariable("SFX_IDENTITY_CONNECTION_STRING"));
    await connection.OpenAsync();
    using var command = connection.CreateCommand();
    command.CommandText = "SELECT (SELECT COUNT(*) FROM [identity].principal WHERE realm=@realm)+(SELECT COUNT(*) FROM [identity].authentication_attempt WHERE realm=@realm);";
    command.Parameters.AddWithValue("@realm",realm);
    remaining = (int)(await command.ExecuteScalarAsync())!;
    Need(remaining == 0);
}
if (args.Length > 1)
    await File.WriteAllTextAsync(args[1],JsonSerializer.Serialize(new { checkedAt=DateTimeOffset.UtcNow,database="sfx-identity",passed,
        remainingTestPrincipalsAndAttempts=remaining,scope="Real database + generated DAL + providers; no HTTP, CLI command, estate or staging application deployment tested." }, new JsonSerializerOptions { WriteIndented=true }));
Console.WriteLine($"PASS {passed.Count} live checks; test principals, credentials, attempts and sessions removed.");
