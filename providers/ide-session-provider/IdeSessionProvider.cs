using System.Security.Cryptography;
namespace SfxProviders.CliLogin;

public sealed class IdeSessionProvider
{
    public const string ProviderId = "ide-session-provider";
    private readonly IIdentityDal dal;
    private readonly LoginPolicy policy;
    private readonly TimeProvider clock;
    public IdeSessionProvider(IIdentityDal dal, LoginPolicy policy, TimeProvider? clock = null)
    {
        this.dal = dal ?? throw new ArgumentNullException(nameof(dal));
        policy.Validate(); this.policy = policy; this.clock = clock ?? TimeProvider.System;
    }
    public async Task<AuthenticatedSession> EstablishAsync(VerifiedLoginAttempt verification,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(verification);
        var attempt = verification.Attempt;
        if (!ReferenceEquals(attempt.Dal, dal)) throw new LoginProviderException("LOGIN_CONTEXT_INVALID");
        if (!verification.Accepted || attempt.Principal is not { Active: true } principal)
            throw new LoginProviderException("AUTHENTICATION_REJECTED");
        if (Interlocked.CompareExchange(ref verification.SessionStarted, 1, 0) != 0)
            throw new LoginProviderException("LOGIN_ATTEMPT_ALREADY_USED");
        byte[] token = RandomNumberGenerator.GetBytes(32);
        byte[] hash = SHA256.HashData(token);
        bool delivered = false;
        try
        {
            cancellationToken.ThrowIfCancellationRequested();
            if (attempt.ExpiresAt <= clock.GetUtcNow()) throw new LoginProviderException("LOGIN_ATTEMPT_EXPIRED");
            var expires = clock.GetUtcNow() + policy.SessionLifetime;
            var result = await dal.EstablishSessionAsync(attempt.AttemptId, principal.PrincipalId,
                principal.SecurityVersion, principal.CredentialVersion, hash, expires, cancellationToken);
            if (!result.Established) throw new LoginProviderException("AUTHENTICATION_REJECTED");
            if (result.Session is not { } session || session.SessionId == Guid.Empty
                || session.PrincipalId != principal.PrincipalId
                || session.ExpiresAt <= clock.GetUtcNow() || session.ExpiresAt > expires)
                throw new LoginProviderException("IDENTITY_UNAVAILABLE");
            cancellationToken.ThrowIfCancellationRequested();
            delivered = true;
            return new AuthenticatedSession(session, token, attempt.AttemptId);
        }
        catch (OperationCanceledException) { throw new OperationCanceledException(cancellationToken); }
        catch (LoginProviderException error) when (error.Code is "LOGIN_ATTEMPT_EXPIRED" or "AUTHENTICATION_REJECTED" or "IDENTITY_UNAVAILABLE") { throw; }
        catch { throw new LoginProviderException("IDENTITY_UNAVAILABLE"); }
        finally
        {
            CryptographicOperations.ZeroMemory(hash);
            if (!delivered) CryptographicOperations.ZeroMemory(token);
        }
    }

    // The caller supplies the token through its private Authorization boundary.
    public async Task<SessionMetadata?> ValidateAsync(string bearer, CancellationToken cancellationToken = default)
    {
        byte[]? hash = HashBearer(bearer);
        if (hash is null) return null;
        try
        {
            var session = await dal.ValidateSessionAsync(hash, cancellationToken);
            return session is { SessionId: var id, PrincipalId: var principal } && id != Guid.Empty
                && principal != Guid.Empty && session.ExpiresAt > clock.GetUtcNow() ? session : null;
        }
        catch (OperationCanceledException) { throw new OperationCanceledException(cancellationToken); }
        catch { throw new LoginProviderException("IDENTITY_UNAVAILABLE"); }
        finally { CryptographicOperations.ZeroMemory(hash); }
    }
    public async Task RevokeAsync(string bearer, CancellationToken cancellationToken = default)
    {
        byte[]? hash = HashBearer(bearer);
        if (hash is null) return;
        try { await dal.RevokeSessionAsync(hash, cancellationToken); }
        catch (OperationCanceledException) { throw new OperationCanceledException(cancellationToken); }
        catch { throw new LoginProviderException("IDENTITY_UNAVAILABLE"); }
        finally { CryptographicOperations.ZeroMemory(hash); }
    }
    private static byte[]? HashBearer(string bearer)
    {
        if (bearer is null || bearer.Length != 44) return null;
        byte[] bytes;
        try { bytes = Convert.FromBase64String(bearer); }
        catch (FormatException) { return null; }
        try
        {
            return bytes.Length == 32 && Convert.ToBase64String(bytes) == bearer ? SHA256.HashData(bytes) : null;
        }
        finally { CryptographicOperations.ZeroMemory(bytes); }
    }
}
