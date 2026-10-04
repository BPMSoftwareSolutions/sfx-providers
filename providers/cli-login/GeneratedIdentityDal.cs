using Microsoft.Data.SqlClient;
using SFX.Identity.DAL.Helpers;
using SFX.Identity.DAL.Repositories;

namespace SfxProviders.CliLogin;

// Internal identity-service composition. Never registered with procedure-extract.
// Every persistence operation calls its generated, specifically named repository.
public interface IEnrollmentDal
{
    Task<Guid?> EnrollAsync(string realm, string identifier, PasswordVerifier verifier, CancellationToken cancellationToken);
}

public sealed class GeneratedIdentityDal : IIdentityDal, IEnrollmentDal
{
    public GeneratedIdentityDal()
    {
        try
        {
            var target = new SqlConnectionStringBuilder(DatabaseHelper.GetConnectionString());
            if (!string.Equals(target.InitialCatalog, "sfx-identity", StringComparison.OrdinalIgnoreCase))
                throw new LoginProviderException("IDENTITY_DATABASE_MISMATCH");
        }
        catch { throw new LoginProviderException("IDENTITY_DAL_NOT_CONFIGURED"); }
    }

    public Task<AttemptRecord> BeginAttemptAsync(string realm, string identifier, string sourceKey,
        DateTimeOffset expiresAt, CancellationToken cancellationToken) => Guard(async () =>
    {
        var row = One((await new IdentityBeginAuthenticationAttemptRepository().ExecuteAsync(realm, identifier, sourceKey, expiresAt)).Rows);
        return new AttemptRecord(Required(row.AttemptId), Required(row.ExpiresAt), Required(row.Allowed));
    }, cancellationToken);

    public Task<PrincipalRecord?> ResolvePrincipalAsync(Guid attemptId, string realm, string identifier,
        CancellationToken cancellationToken) => Guard<PrincipalRecord?>(async () =>
    {
        var row = Optional((await new IdentityResolveLoginPrincipalRepository().ExecuteAsync(attemptId, realm, identifier)).Rows);
        return row is null ? null : new PrincipalRecord(Required(row.PrincipalId), Required(row.Active),
            Required(row.SecurityVersion), Required(row.CredentialVersion));
    }, cancellationToken);

    public Task<PasswordVerifier?> ReadVerifierAsync(Guid attemptId, Guid principalId, long credentialVersion,
        CancellationToken cancellationToken) => Guard<PasswordVerifier?>(async () =>
    {
        var row = Optional((await new IdentityReadPasswordVerifierRepository().ExecuteAsync(attemptId, principalId, credentialVersion)).Rows);
        return row is null ? null : new PasswordVerifier(row.Verifier);
    }, cancellationToken);

    public Task<bool> CompleteVerificationAsync(Guid attemptId, Guid? principalId, long? securityVersion,
        long? credentialVersion, bool matched, CancellationToken cancellationToken) => Guard(async () =>
        Required(One((await new IdentityCompleteCredentialVerificationRepository()
            .ExecuteAsync(attemptId, principalId, securityVersion, credentialVersion, matched)).Rows).Accepted), cancellationToken);

    public Task<SessionPersistenceResult> EstablishSessionAsync(Guid attemptId, Guid principalId,
        long securityVersion, long credentialVersion, byte[] verifierHash, DateTimeOffset expiresAt,
        CancellationToken cancellationToken) => Guard(async () =>
    {
        var row = One((await new IdentityEstablishSessionRepository().ExecuteAsync(attemptId, principalId,
            securityVersion, credentialVersion, verifierHash, expiresAt)).Rows);
        bool established = Required(row.Established);
        return new SessionPersistenceResult(established, established
            ? new SessionMetadata(Required(row.SessionId), Required(row.PrincipalId), Required(row.ExpiresAt)) : null);
    }, cancellationToken);

    public Task<SessionMetadata?> ValidateSessionAsync(byte[] verifierHash, CancellationToken cancellationToken)
        => Guard<SessionMetadata?>(async () =>
    {
        var row = Optional((await new IdentityValidateSessionRepository().ExecuteAsync(verifierHash)).Rows);
        return row is null ? null : new SessionMetadata(Required(row.SessionId), Required(row.PrincipalId), Required(row.ExpiresAt));
    }, cancellationToken);

    public async Task RevokeSessionAsync(byte[] verifierHash, CancellationToken cancellationToken)
    {
        await Guard(async () => Required(One((await new IdentityRevokeSessionRepository().ExecuteAsync(verifierHash)).Rows).Revoked),
            cancellationToken);
    }

    // Operator-only enrollment. The runtime role is denied this procedure.
    // Verifier bytes never enter generic observations.
    public Task<Guid> ProvisionPrincipalCredentialAsync(string realm, string identifier, PasswordVerifier verifier,
        CancellationToken cancellationToken = default) => Guard(async () =>
        Required(One((await new IdentityProvisionPrincipalCredentialRepository().ExecuteAsync(realm, identifier, verifier.Encoded)).Rows).PrincipalId),
        cancellationToken);

    // The unique realm/normalized-identifier key is the concurrency boundary.
    // A duplicate never rotates a credential. Do not abandon an admitted write
    // on caller cancellation and then incorrectly report that it did not commit.
    public async Task<Guid?> EnrollAsync(string realm, string identifier, PasswordVerifier verifier,
        CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        try
        {
            return Required(One((await new IdentityProvisionPrincipalCredentialRepository()
                .ExecuteAsync(realm, identifier, verifier.Encoded)).Rows).PrincipalId);
        }
        catch (Exception error) when (error is SqlException { Number: 2601 or 2627 } ||
            error is ApplicationException { InnerException: SqlException { Number: 2601 or 2627 } }) { return null; }
        catch { throw new LoginProviderException("IDENTITY_UNAVAILABLE"); }
    }

    private static T One<T>(IReadOnlyList<T> rows) => rows.Count == 1 ? rows[0] : throw InvalidResult();
    private static T? Optional<T>(IReadOnlyList<T> rows) where T : class
        => rows.Count == 0 ? null : rows.Count == 1 ? rows[0] : throw InvalidResult();
    private static T Required<T>(T? value) where T : struct => value ?? throw InvalidResult();
    private static LoginProviderException InvalidResult() => new("IDENTITY_UNAVAILABLE");

    // Generated methods do not currently accept CancellationToken. Await the real
    // call, then honor cancellation; do not abandon a write and pretend it stopped.
    private static async Task<T> Guard<T>(Func<Task<T>> action, CancellationToken cancellationToken)
    {
        try
        {
            cancellationToken.ThrowIfCancellationRequested();
            T result = await action();
            cancellationToken.ThrowIfCancellationRequested();
            return result;
        }
        catch (OperationCanceledException) { throw new OperationCanceledException(cancellationToken); }
        catch { throw new LoginProviderException("IDENTITY_UNAVAILABLE"); }
    }
}
