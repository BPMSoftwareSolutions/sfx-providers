namespace SfxProviders.CliLogin;

public sealed class IdentityPrincipalProvider
{
    public const string ProviderId = "identity-principal-provider";
    private readonly IIdentityDal dal;
    private readonly LoginPolicy policy;
    private readonly TimeProvider clock;
    public Task<Guid?> ProvisionAsync(string realm, string identifier, PasswordVerifier verifier,
        CancellationToken cancellationToken = default)
    {
        if (dal is not IEnrollmentDal enrollment) throw new LoginProviderException("IDENTITY_UNAVAILABLE");
        return enrollment.EnrollAsync(realm, identifier, verifier, cancellationToken);
    }
    public IdentityPrincipalProvider(IIdentityDal dal, LoginPolicy policy, TimeProvider? clock = null)
    {
        this.dal = dal ?? throw new ArgumentNullException(nameof(dal));
        policy.Validate(); this.policy = policy; this.clock = clock ?? TimeProvider.System;
    }
    public async Task<ResolvedLoginAttempt> ResolveAsync(LoginInput input, string realm,
        string sourceKey, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(input);
        if (string.IsNullOrWhiteSpace(realm) || realm.Length > 128 || realm.Any(char.IsControl)
            || string.IsNullOrWhiteSpace(sourceKey) || sourceKey.Length > 256 || sourceKey.Any(char.IsControl))
            throw new LoginProviderException("LOGIN_CONTEXT_INVALID");
        try
        {
            cancellationToken.ThrowIfCancellationRequested();
            DateTimeOffset expires = clock.GetUtcNow() + policy.AttemptLifetime;
            var attempt = await dal.BeginAttemptAsync(realm, input.Identifier, sourceKey, expires, cancellationToken);
            if (!attempt.Allowed) throw new LoginProviderException("THROTTLED");
            if (attempt.AttemptId == Guid.Empty || attempt.ExpiresAt <= clock.GetUtcNow() || attempt.ExpiresAt > expires)
                throw new LoginProviderException("IDENTITY_UNAVAILABLE");
            var principal = await dal.ResolvePrincipalAsync(attempt.AttemptId, realm, input.Identifier, cancellationToken);
            if (principal is not null && (principal.PrincipalId == Guid.Empty
                || principal.SecurityVersion < 0 || principal.CredentialVersion < 0))
                throw new LoginProviderException("IDENTITY_UNAVAILABLE");
            cancellationToken.ThrowIfCancellationRequested();
            return new ResolvedLoginAttempt(dal, clock, input, realm, attempt, principal);
        }
        catch (OperationCanceledException) { input.Dispose(); throw new OperationCanceledException(cancellationToken); }
        catch (LoginProviderException error) when (error.Code is "THROTTLED" or "IDENTITY_UNAVAILABLE") { input.Dispose(); throw; }
        catch { input.Dispose(); throw new LoginProviderException("IDENTITY_UNAVAILABLE"); }
    }
}
