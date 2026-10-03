namespace SfxProviders.CliLogin;

// Application adapter implemented against the separately generated identity DAL.
// No SQL, connection singleton, generic extractor or default in-memory backend.
// The host supplies an implementation; no configured backend means no login.
public interface IIdentityDal
{
    // Atomically enforce shared account/source throttles and create an attempt.
    Task<AttemptRecord> BeginAttemptAsync(string realm, string identifier, string sourceKey,
        DateTimeOffset expiresAt, CancellationToken cancellationToken);
    // Identifier normalization and uniqueness are database-owned.
    Task<PrincipalRecord?> ResolvePrincipalAsync(Guid attemptId, string realm, string identifier,
        CancellationToken cancellationToken);
    Task<PasswordVerifier?> ReadVerifierAsync(Guid attemptId, Guid principalId,
        long credentialVersion, CancellationToken cancellationToken);
    // The DB binds the resolution to this attempt and checks principal/credential
    // versions. Accept once, audit failure as well as success, refuse expired/replay.
    Task<bool> CompleteVerificationAsync(Guid attemptId, Guid? principalId,
        long? securityVersion, long? credentialVersion, bool matched,
        CancellationToken cancellationToken);
    // One DB transaction: consume successful unexpired verification; recheck
    // account+credential version; create session and success audit. Unique attempt.
    // Only SHA-256 of the 32 random token bytes is persisted, NEVER the bearer.
    Task<SessionPersistenceResult> EstablishSessionAsync(Guid attemptId, Guid principalId,
        long securityVersion, long credentialVersion, byte[] verifierHash,
        DateTimeOffset expiresAt, CancellationToken cancellationToken);
    Task<SessionMetadata?> ValidateSessionAsync(byte[] verifierHash, CancellationToken cancellationToken);
    Task RevokeSessionAsync(byte[] verifierHash, CancellationToken cancellationToken);
}

// Bind strongly typed generated methods in the identity service composition root.
// Delegates adapt generated result sets to the records above; they do not infer
// uninstalled stored procedure signatures or choose connections from user input.
public sealed class IdentityDalBindings(
    Func<string, string, string, DateTimeOffset, CancellationToken, Task<AttemptRecord>> begin,
    Func<Guid, string, string, CancellationToken, Task<PrincipalRecord?>> resolve,
    Func<Guid, Guid, long, CancellationToken, Task<PasswordVerifier?>> readVerifier,
    Func<Guid, Guid?, long?, long?, bool, CancellationToken, Task<bool>> complete,
    Func<Guid, Guid, long, long, byte[], DateTimeOffset, CancellationToken, Task<SessionPersistenceResult>> establish,
    Func<byte[], CancellationToken, Task<SessionMetadata?>> validate,
    Func<byte[], CancellationToken, Task> revoke) : IIdentityDal
{
    public Task<AttemptRecord> BeginAttemptAsync(string r, string i, string s, DateTimeOffset e, CancellationToken c)
        => (begin ?? throw Missing())(r, i, s, e, c);
    public Task<PrincipalRecord?> ResolvePrincipalAsync(Guid a, string r, string i, CancellationToken c)
        => (resolve ?? throw Missing())(a, r, i, c);
    public Task<PasswordVerifier?> ReadVerifierAsync(Guid a, Guid p, long v, CancellationToken c)
        => (readVerifier ?? throw Missing())(a, p, v, c);
    public Task<bool> CompleteVerificationAsync(Guid a, Guid? p, long? s, long? v, bool m, CancellationToken c)
        => (complete ?? throw Missing())(a, p, s, v, m, c);
    public Task<SessionPersistenceResult> EstablishSessionAsync(Guid a, Guid p, long s, long v, byte[] h, DateTimeOffset e, CancellationToken c)
        => (establish ?? throw Missing())(a, p, s, v, h, e, c);
    public Task<SessionMetadata?> ValidateSessionAsync(byte[] h, CancellationToken c) => (validate ?? throw Missing())(h, c);
    public Task RevokeSessionAsync(byte[] h, CancellationToken c) => (revoke ?? throw Missing())(h, c);
    private static LoginProviderException Missing() => new("IDENTITY_DAL_NOT_CONFIGURED");
}
