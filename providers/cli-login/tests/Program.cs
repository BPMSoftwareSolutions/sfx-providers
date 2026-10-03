using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using SfxProviders.CliLogin;

// Test-only DAL fixture. Never used or selectable by the production package.
// These are provider/contract tests, not live identity-database acceptance.
var policy = new LoginPolicy(TimeSpan.FromMinutes(2), TimeSpan.FromMinutes(30));
using var hasher = new Argon2PasswordVerifier();
string password = Convert.ToHexString(RandomNumberGenerator.GetBytes(24));
var verifier = await hasher.CreateForEnrollmentAsync(Encoding.UTF8.GetBytes(password));
int passed = 0;
async Task Check(string name, Func<Task> test)
{
    try { await test(); Console.WriteLine("PASS " + name); passed++; }
    catch { Console.Error.WriteLine("FAIL " + name); throw new Exception("Provider test failed; secret-bearing diagnostics suppressed."); }
}
FixtureDal NewDal() => new(verifier);
async Task<(FixtureDal Dal, VerifiedLoginAttempt Verified, ResolvedLoginAttempt Attempt)> ResolveVerify(
    FixtureDal? dal = null, string? supplied = null, TestClock? clock = null)
{
    dal ??= NewDal();
    var principal = new IdentityPrincipalProvider(dal, policy, clock);
    var credential = new PasswordCredentialProvider(dal, hasher);
    var attempt = await principal.ResolveAsync(LoginInput.FromPrivateRequest("pilot", supplied ?? password), "pilot-realm", "source");
    var verified = await credential.VerifyAsync(attempt);
    return (dal, verified, attempt);
}
await Check("real Argon2id accepts correct password and rejects incorrect and malformed verifiers", async () =>
{
    Need(await hasher.VerifyAsync(Encoding.UTF8.GetBytes(password), verifier, default));
    Need(!await hasher.VerifyAsync(Encoding.UTF8.GetBytes(password + "x"), verifier, default));
    Need(!await hasher.VerifyAsync(Encoding.UTF8.GetBytes(password), new PasswordVerifier("$argon2id$v=19$m=999999999,t=2,p=1$AA$AA"), default));
    Need(!await hasher.VerifyAsync(Encoding.UTF8.GetBytes(password), null, default));
});
await Check("four boundaries preserve private input and return a real random session credential", async () =>
{
    var terminal = new TestTerminal("pilot\n" + password + "\n");
    using var input = await new CliLoginInputProvider(terminal).AcquireAsync();
    Need(!terminal.Output.Contains(password) && terminal.Output.Contains("Password: "));
    Need(!terminal.TreatControlCAsInput);
    var dal = NewDal();
    var resolved = await new IdentityPrincipalProvider(dal, policy).ResolveAsync(input, "pilot-realm", "source");
    var verified = await new PasswordCredentialProvider(dal, hasher).VerifyAsync(resolved);
    var sessions = new IdeSessionProvider(dal, policy);
    using var session = await sessions.EstablishAsync(verified);
    Need(dal.Calls.SequenceEqual(["begin", "resolve", "verifier", "verification:True", "establish"]));
    Need(session.Receipt.Disposition == LoginDisposition.Authenticated);
    string token = await PrivateToken(session);
    Need(Convert.FromBase64String(token).Length == 32);
    Need(dal.StoredHash!.SequenceEqual(SHA256.HashData(Convert.FromBase64String(token))));
    Need(!dal.StoredHash!.SequenceEqual(Convert.FromBase64String(token)));
    Need(await sessions.ValidateAsync(token) is not null);
    await sessions.RevokeAsync(token);
    Need(await sessions.ValidateAsync(token) is null);
});
await Check("password rejection, missing principal and disabled account never establish a session", async () =>
{
    foreach (var kind in new[] { "wrong", "unknown", "disabled" })
    {
        var dal = NewDal();
        if (kind == "unknown") dal.Principal = null;
        if (kind == "disabled") dal.Principal = dal.Principal! with { Active = false };
        var state = await ResolveVerify(dal, kind == "wrong" ? password + "x" : password);
        Need(state.Verified.Receipt.Disposition == LoginDisposition.AuthenticationRejected);
        await Refusal("AUTHENTICATION_REJECTED", () => new IdeSessionProvider(dal, policy).EstablishAsync(state.Verified));
        Need(!dal.Calls.Contains("establish"));
        Need(dal.Calls.Contains("verification:False"));
    }
});
await Check("forged backend acceptance cannot promote an incorrect password", async () =>
{
    var dal = NewDal(); dal.ForceVerificationReturn = true;
    var state = await ResolveVerify(dal, password + "x");
    Need(state.Verified.Receipt.Disposition == LoginDisposition.AuthenticationRejected);
    await Refusal("AUTHENTICATION_REJECTED", () => new IdeSessionProvider(dal, policy).EstablishAsync(state.Verified));
});
await Check("verification and session tickets reject replay including concurrent use", async () =>
{
    var state = await ResolveVerify();
    await Refusal("LOGIN_ATTEMPT_ALREADY_USED", () => new PasswordCredentialProvider(state.Dal, hasher).VerifyAsync(state.Attempt));
    var provider = new IdeSessionProvider(state.Dal, policy);
    var results = await Task.WhenAll(Enumerable.Range(0, 8).Select(async _ =>
    {
        try { using var session = await provider.EstablishAsync(state.Verified); return true; }
        catch (LoginProviderException e) when (e.Code == "LOGIN_ATTEMPT_ALREADY_USED") { return false; }
    }));
    Need(results.Count(x => x) == 1 && state.Dal.Calls.Count(x => x == "establish") == 1);
});
await Check("attempts cannot cross backend boundaries", async () =>
{
    var dal = NewDal();
    using var attempt = await new IdentityPrincipalProvider(dal, policy).ResolveAsync(
        LoginInput.FromPrivateRequest("pilot", password), "realm", "source");
    await Refusal("LOGIN_CONTEXT_INVALID", () => new PasswordCredentialProvider(NewDal(), hasher).VerifyAsync(attempt));
    var verified = await new PasswordCredentialProvider(dal, hasher).VerifyAsync(attempt);
    await Refusal("LOGIN_CONTEXT_INVALID", () => new IdeSessionProvider(NewDal(), policy).EstablishAsync(verified));
});
await Check("attempt expiry prevents verification and session persistence", async () =>
{
    var clock = new TestClock();
    var dal = NewDal();
    using var attempt = await new IdentityPrincipalProvider(dal, policy, clock).ResolveAsync(
        LoginInput.FromPrivateRequest("pilot", password), "realm", "source");
    clock.Advance(TimeSpan.FromMinutes(3));
    await Refusal("LOGIN_ATTEMPT_EXPIRED", () => new PasswordCredentialProvider(dal, hasher).VerifyAsync(attempt));
    Need(!dal.Calls.Contains("verifier"));
    clock = new TestClock();
    var state = await ResolveVerify(clock: clock);
    clock.Advance(TimeSpan.FromMinutes(3));
    await Refusal("LOGIN_ATTEMPT_EXPIRED", () => new IdeSessionProvider(state.Dal, policy, clock).EstablishAsync(state.Verified));
    Need(!state.Dal.Calls.Contains("establish"));
});
await Check("database recheck rejects account or credential changes after verification", async () =>
{
    var state = await ResolveVerify();
    state.Dal.Principal = state.Dal.Principal! with { CredentialVersion = 2 };
    await Refusal("AUTHENTICATION_REJECTED", () => new IdeSessionProvider(state.Dal, policy).EstablishAsync(state.Verified));
    Need(state.Dal.StoredHash is null);
});
await Check("private objects refuse generic JSON, nested JSON and fabricated input", async () =>
{
    using var input = LoginInput.FromPrivateRequest("pilot", password);
    var state = await ResolveVerify();
    using var session = await new IdeSessionProvider(state.Dal, policy).EstablishAsync(state.Verified);
    foreach (object value in new object[] { input, verifier, state.Attempt, state.Verified, session })
    {
        Throws<JsonException>(() => JsonSerializer.Serialize(value));
        Throws<JsonException>(() => JsonSerializer.Serialize(new { value }));
        Need(!value.ToString()!.Contains(password));
    }
    Throws<JsonException>(() => JsonSerializer.Deserialize<VerifiedLoginAttempt>("{\"Accepted\":true}"));
    string receipts = JsonSerializer.Serialize(new[] { state.Attempt.Receipt, state.Verified.Receipt, session.Receipt });
    Need(!receipts.Contains(password) && !receipts.Contains(await PrivateToken(session)));
});
await Check("backend exceptions are sanitized without secret messages or inner exceptions", async () =>
{
    var dal = NewDal(); dal.FailResolveWith = password;
    using var input = LoginInput.FromPrivateRequest("pilot", password);
    try { await new IdentityPrincipalProvider(dal, policy).ResolveAsync(input, "realm", "source"); Need(false); }
    catch (LoginProviderException e) { Need(e.Code == "IDENTITY_UNAVAILABLE" && !e.ToString().Contains(password) && e.InnerException is null); }
});
await Check("throttling refuses before principal and password work", async () =>
{
    var dal = NewDal(); dal.Allowed = false;
    using var input = LoginInput.FromPrivateRequest("pilot", password);
    await Refusal("THROTTLED", () => new IdentityPrincipalProvider(dal, policy).ResolveAsync(input, "realm", "source"));
    Need(dal.Calls.SequenceEqual(["begin"]));
});
await Check("session values are unique; invalid bearer and expiry fail validation", async () =>
{
    var a = await ResolveVerify(); var b = await ResolveVerify();
    using var sa = await new IdeSessionProvider(a.Dal, policy).EstablishAsync(a.Verified);
    using var sb = await new IdeSessionProvider(b.Dal, policy).EstablishAsync(b.Verified);
    Need(await PrivateToken(sa) != await PrivateToken(sb));
    var provider = new IdeSessionProvider(a.Dal, policy);
    Need(await provider.ValidateAsync("not-a-token") is null);
    a.Dal.Session = a.Dal.Session! with { ExpiresAt = DateTimeOffset.UtcNow.AddSeconds(-1) };
    Need(await provider.ValidateAsync(await PrivateToken(sa)) is null);
});
await Check("redirected input, cancellation and overflow restore terminal state", async () =>
{
    var redirected = new TestTerminal("") { IsInteractive = false };
    await Refusal("INTERACTIVE_LOGIN_REQUIRED", () => new CliLoginInputProvider(redirected).AcquireAsync());
    var cancelled = new TestTerminal("pilot\n" + password);
    cancelled.Keys.Enqueue(new ConsoleKeyInfo('\x03', ConsoleKey.C, false, false, true));
    try { await new CliLoginInputProvider(cancelled).AcquireAsync(); Need(false); } catch (OperationCanceledException) { }
    Need(!cancelled.TreatControlCAsInput && !cancelled.Output.Contains(password));
    var overflow = new TestTerminal("pilot\n" + new string('x', 1025));
    await Refusal("LOGIN_INPUT_TOO_LONG", () => new CliLoginInputProvider(overflow).AcquireAsync());
    Need(!overflow.TreatControlCAsInput);
    var waiting = new TestTerminal("");
    using var cancellation = new CancellationTokenSource(40);
    try { await new CliLoginInputProvider(waiting).AcquireAsync(cancellation.Token); Need(false); } catch (OperationCanceledException) { }
    Need(!waiting.TreatControlCAsInput);
});
Console.WriteLine($"PASS {passed} provider checks; identity database and estate admission not exercised.");

static void Need(bool condition) { if (!condition) throw new Exception("Assertion failed."); }
static void Throws<T>(Action action) where T : Exception
{
    try { action(); } catch (T) { return; }
    throw new Exception("Expected refusal.");
}
static async Task Refusal(string code, Func<Task> action)
{
    try { await action(); } catch (LoginProviderException e) when (e.Code == code) { return; }
    throw new Exception("Expected refusal.");
}
static async Task<string> PrivateToken(AuthenticatedSession session)
{
    using var stream = new MemoryStream();
    await session.WritePrivateResponseAsync(stream);
    using var json = JsonDocument.Parse(stream.ToArray());
    return json.RootElement.GetProperty("token").GetString()!;
}

sealed class TestClock : TimeProvider
{
    private DateTimeOffset now = DateTimeOffset.UtcNow;
    public override DateTimeOffset GetUtcNow() => now;
    public void Advance(TimeSpan amount) => now += amount;
}
sealed class TestTerminal : ILoginTerminal
{
    public Queue<ConsoleKeyInfo> Keys { get; } = new();
    public string Output { get; private set; } = "";
    public bool IsInteractive { get; set; } = true;
    public bool TreatControlCAsInput { get; set; }
    public bool KeyAvailable => Keys.Count > 0;
    public TestTerminal(string text)
    {
        foreach (char c in text) Keys.Enqueue(new ConsoleKeyInfo(c, c == '\n' ? ConsoleKey.Enter : ConsoleKey.A, false, false, false));
    }
    public ConsoleKeyInfo ReadKey() => Keys.Dequeue();
    public void Write(string text) => Output += text;
}
sealed class FixtureDal(PasswordVerifier verifier) : IIdentityDal
{
    public List<string> Calls { get; } = [];
    public PrincipalRecord? Principal { get; set; } = new(Guid.NewGuid(), true, 1, 1);
    public SessionMetadata? Session { get; set; }
    public byte[]? StoredHash { get; private set; }
    public bool Allowed { get; set; } = true;
    public bool ForceVerificationReturn { get; set; }
    public string? FailResolveWith { get; set; }
    private Guid attemptId;
    private DateTimeOffset attemptExpiry;
    private bool accepted;
    public Task<AttemptRecord> BeginAttemptAsync(string realm, string identifier, string sourceKey, DateTimeOffset expiresAt, CancellationToken ct)
    {
        Calls.Add("begin"); attemptId = Guid.NewGuid(); attemptExpiry = expiresAt;
        return Task.FromResult(new AttemptRecord(attemptId, expiresAt, Allowed));
    }
    public Task<PrincipalRecord?> ResolvePrincipalAsync(Guid attempt, string realm, string identifier, CancellationToken ct)
    {
        Calls.Add("resolve");
        if (FailResolveWith is not null) throw new LoginProviderException(FailResolveWith);
        return Task.FromResult(Principal);
    }
    public Task<PasswordVerifier?> ReadVerifierAsync(Guid attempt, Guid principal, long version, CancellationToken ct)
    { Calls.Add("verifier"); return Task.FromResult<PasswordVerifier?>(verifier); }
    public Task<bool> CompleteVerificationAsync(Guid attempt, Guid? principal, long? security, long? version, bool matched, CancellationToken ct)
    {
        Calls.Add("verification:" + matched);
        accepted = matched && attempt == attemptId && Principal is { Active: true }
            && Principal.PrincipalId == principal && Principal.SecurityVersion == security && Principal.CredentialVersion == version;
        return Task.FromResult(accepted || ForceVerificationReturn);
    }
    public Task<SessionPersistenceResult> EstablishSessionAsync(Guid attempt, Guid principal, long security, long version,
        byte[] hash, DateTimeOffset expiresAt, CancellationToken ct)
    {
        Calls.Add("establish");
        if (!accepted || attempt != attemptId || attemptExpiry <= DateTimeOffset.UtcNow || Principal is not { Active: true }
            || Principal.PrincipalId != principal || Principal.SecurityVersion != security || Principal.CredentialVersion != version)
            return Task.FromResult(new SessionPersistenceResult(false, null));
        accepted = false; StoredHash = hash.ToArray();
        Session = new(Guid.NewGuid(), principal, expiresAt);
        return Task.FromResult(new SessionPersistenceResult(true, Session));
    }
    public Task<SessionMetadata?> ValidateSessionAsync(byte[] hash, CancellationToken ct)
        => Task.FromResult(StoredHash is not null && hash.SequenceEqual(StoredHash) ? Session : null);
    public Task RevokeSessionAsync(byte[] hash, CancellationToken ct)
    {
        if (StoredHash is not null && hash.SequenceEqual(StoredHash)) Session = null;
        return Task.CompletedTask;
    }
}
