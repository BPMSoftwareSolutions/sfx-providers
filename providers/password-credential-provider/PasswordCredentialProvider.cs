using System.Security.Cryptography;
namespace SfxProviders.CliLogin;

public sealed class PasswordCredentialProvider(IIdentityDal dal, Argon2PasswordVerifier verifier)
{
    public const string ProviderId = "password-credential-provider";
    private readonly IIdentityDal dal = dal ?? throw new ArgumentNullException(nameof(dal));
    private readonly Argon2PasswordVerifier verifier = verifier ?? throw new ArgumentNullException(nameof(verifier));

    public async Task<VerifiedLoginAttempt> VerifyAsync(ResolvedLoginAttempt attempt,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(attempt);
        if (!ReferenceEquals(attempt.Dal, dal)) throw new LoginProviderException("LOGIN_CONTEXT_INVALID");
        if (Interlocked.CompareExchange(ref attempt.VerificationStarted, 1, 0) != 0)
            throw new LoginProviderException("LOGIN_ATTEMPT_ALREADY_USED");
        byte[]? password = null;
        try
        {
            cancellationToken.ThrowIfCancellationRequested();
            if (attempt.ExpiresAt <= attempt.Clock.GetUtcNow()) throw new LoginProviderException("LOGIN_ATTEMPT_EXPIRED");
            var principal = attempt.Principal;
            PasswordVerifier? stored = principal is null ? null : await dal.ReadVerifierAsync(
                attempt.AttemptId, principal.PrincipalId, principal.CredentialVersion, cancellationToken);
            password = attempt.Input.CopyPassword();
            bool matched = await verifier.VerifyAsync(password, stored, cancellationToken);
            matched &= principal is { Active: true };
            if (attempt.ExpiresAt <= attempt.Clock.GetUtcNow()) throw new LoginProviderException("LOGIN_ATTEMPT_EXPIRED");
            bool recorded = await dal.CompleteVerificationAsync(attempt.AttemptId, principal?.PrincipalId,
                principal?.SecurityVersion, principal?.CredentialVersion, matched, cancellationToken);
            cancellationToken.ThrowIfCancellationRequested();
            return new VerifiedLoginAttempt(attempt, matched && recorded);
        }
        catch (OperationCanceledException) { throw new OperationCanceledException(cancellationToken); }
        catch (LoginProviderException error) when (error.Code is "LOGIN_ATTEMPT_EXPIRED" or "IDENTITY_UNAVAILABLE") { throw; }
        catch { throw new LoginProviderException("IDENTITY_UNAVAILABLE"); }
        finally
        {
            if (password is not null) CryptographicOperations.ZeroMemory(password);
            attempt.Input.Dispose();
        }
    }
}
