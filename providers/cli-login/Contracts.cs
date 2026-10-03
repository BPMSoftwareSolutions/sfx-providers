using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace SfxProviders.CliLogin;

// These outcomes are safe to observe. Never attach requests, DAL rows, exceptions,
// password verifiers or session credentials to an observation.
public enum LoginDisposition { InputAcquired, PrincipalResolved, CredentialVerified,
    AuthenticationRejected, Authenticated, Throttled, IdentityUnavailable }
public sealed record ProviderReceipt(string ProviderId, Guid AttemptId, LoginDisposition Disposition);
public sealed class LoginProviderException(string code) : Exception(code)
{
    public string Code { get; } = code;
}
public sealed record LoginPolicy(TimeSpan AttemptLifetime, TimeSpan SessionLifetime)
{
    public void Validate()
    {
        if (AttemptLifetime <= TimeSpan.Zero || AttemptLifetime > TimeSpan.FromMinutes(10)
            || SessionLifetime <= TimeSpan.Zero || SessionLifetime > TimeSpan.FromDays(1))
            throw new ArgumentOutOfRangeException(nameof(LoginPolicy));
    }
}

[JsonConverter(typeof(PrivateValueConverter<LoginInput>))]
public sealed class LoginInput : IDisposable
{
    private byte[]? password;
    public string Identifier { get; }
    private LoginInput(string identifier, byte[] bytes) { Identifier = identifier; password = bytes; }

    // The trusted API ingress may construct this directly after its request limits
    // and transport checks. This value is not a scenario request or log DTO.
    public static LoginInput FromPrivateRequest(string identifier, ReadOnlySpan<char> password)
    {
        if (string.IsNullOrWhiteSpace(identifier) || identifier.Length > 254 || identifier.Any(char.IsControl)
            || password.Length is < 1 or > 1024 || password.Contains('\0'))
            throw new LoginProviderException("LOGIN_INPUT_INVALID");
        byte[] bytes = new byte[Encoding.UTF8.GetByteCount(password)];
        Encoding.UTF8.GetBytes(password, bytes);
        return new LoginInput(identifier, bytes);
    }
    internal byte[] CopyPassword() => password?.ToArray() ?? throw new ObjectDisposedException(nameof(LoginInput));
    // Explicit private transport escape hatch; never expose this to generic run output.
    public async Task WritePrivateRequestAsync(Stream destination, CancellationToken cancellationToken = default)
    {
        byte[] secret = CopyPassword();
        try
        {
            using var writer = new Utf8JsonWriter(destination);
            writer.WriteStartObject();
            writer.WriteString("identifier", Identifier);
            writer.WriteString("password", secret);
            writer.WriteEndObject();
            await writer.FlushAsync(cancellationToken);
        }
        finally { CryptographicOperations.ZeroMemory(secret); }
    }
    public void Dispose()
    {
        if (password is { } bytes) CryptographicOperations.ZeroMemory(bytes);
        password = null;
    }
    public override string ToString() => "[private login input]";
}

public sealed class PrivateValueConverter<T> : JsonConverter<T>
{
    public override T Read(ref Utf8JsonReader reader, Type type, JsonSerializerOptions options)
        => throw new JsonException("PRIVATE_LOGIN_VALUE_NOT_DESERIALIZABLE");
    public override void Write(Utf8JsonWriter writer, T value, JsonSerializerOptions options)
        => throw new JsonException("PRIVATE_LOGIN_VALUE_NOT_OBSERVABLE");
}

[JsonConverter(typeof(PrivateValueConverter<PasswordVerifier>))]
public sealed class PasswordVerifier
{
    // The backend constructs this from the generated credential DAL. It is not
    // returned by a public provider endpoint.
    internal string Encoded { get; }
    public PasswordVerifier(string encoded) => Encoded = encoded;
    public override string ToString() => "[private password verifier]";
}

public sealed record PrincipalRecord(Guid PrincipalId, bool Active, long SecurityVersion,
    long CredentialVersion);
public sealed record AttemptRecord(Guid AttemptId, DateTimeOffset ExpiresAt, bool Allowed);
public sealed record SessionMetadata(Guid SessionId, Guid PrincipalId, DateTimeOffset ExpiresAt);
public sealed record SessionPersistenceResult(bool Established, SessionMetadata? Session);

[JsonConverter(typeof(PrivateValueConverter<ResolvedLoginAttempt>))]
public sealed class ResolvedLoginAttempt : IDisposable
{
    internal IIdentityDal Dal { get; }
    internal TimeProvider Clock { get; }
    internal LoginInput Input { get; }
    internal PrincipalRecord? Principal { get; }
    internal string Realm { get; }
    internal int VerificationStarted;
    public Guid AttemptId { get; }
    public DateTimeOffset ExpiresAt { get; }
    public ProviderReceipt Receipt { get; }
    internal ResolvedLoginAttempt(IIdentityDal dal, TimeProvider clock, LoginInput input,
        string realm, AttemptRecord attempt, PrincipalRecord? principal)
    {
        Dal = dal; Clock = clock; Input = input; Realm = realm; Principal = principal;
        AttemptId = attempt.AttemptId; ExpiresAt = attempt.ExpiresAt;
        Receipt = new("identity-principal-provider", AttemptId, LoginDisposition.PrincipalResolved);
    }
    public void Dispose() => Input.Dispose();
    public override string ToString() => "[private resolved login attempt]";
}

[JsonConverter(typeof(PrivateValueConverter<VerifiedLoginAttempt>))]
public sealed class VerifiedLoginAttempt
{
    internal ResolvedLoginAttempt Attempt { get; }
    internal bool Accepted { get; }
    internal int SessionStarted;
    public ProviderReceipt Receipt { get; }
    internal VerifiedLoginAttempt(ResolvedLoginAttempt attempt, bool accepted)
    {
        Attempt = attempt; Accepted = accepted;
        Receipt = new("password-credential-provider", attempt.AttemptId,
            accepted ? LoginDisposition.CredentialVerified : LoginDisposition.AuthenticationRejected);
    }
    public override string ToString() => "[private credential verification]";
}

[JsonConverter(typeof(PrivateValueConverter<AuthenticatedSession>))]
public sealed class AuthenticatedSession : IDisposable
{
    private byte[]? token;
    public SessionMetadata Metadata { get; }
    public ProviderReceipt Receipt { get; }
    internal AuthenticatedSession(SessionMetadata metadata, byte[] credential, Guid attemptId)
    {
        Metadata = metadata; token = credential;
        Receipt = new("ide-session-provider", attemptId, LoginDisposition.Authenticated);
    }
    // This is the ONLY serialization of a bearer value, for the protected login
    // response. All normal serialization refuses, including nested serialization.
    public async Task WritePrivateResponseAsync(Stream destination, CancellationToken cancellationToken = default)
    {
        if (token is null) throw new ObjectDisposedException(nameof(AuthenticatedSession));
        using var writer = new Utf8JsonWriter(destination);
        writer.WriteStartObject();
        writer.WriteString("sessionId", Metadata.SessionId);
        writer.WriteString("principalId", Metadata.PrincipalId);
        writer.WriteString("expiresAt", Metadata.ExpiresAt);
        writer.WriteString("tokenType", "Bearer");
        writer.WriteBase64String("token", token);
        writer.WriteEndObject();
        await writer.FlushAsync(cancellationToken);
    }
    public void Dispose()
    {
        if (token is { } bytes) CryptographicOperations.ZeroMemory(bytes);
        token = null;
    }
    public override string ToString() => "[private authenticated session]";
}
