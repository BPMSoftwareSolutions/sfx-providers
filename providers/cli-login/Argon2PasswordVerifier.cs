using System.Security.Cryptography;
using System.Text;
using Konscious.Security.Cryptography;

namespace SfxProviders.CliLogin;

// One versioned work factor for initial credentials, including the dummy path.
// Bounded PHC parsing refuses unapproved cost/algorithm parameters rather than
// allocating memory from untrusted verifier metadata.
public sealed class Argon2PasswordVerifier : IDisposable
{
    public const int MemoryKiB = 19456;
    public const int Iterations = 2;
    public const int Parallelism = 1;
    private readonly byte[] dummySalt = RandomNumberGenerator.GetBytes(16);
    private readonly byte[] dummyHash = RandomNumberGenerator.GetBytes(32);
    private readonly SemaphoreSlim capacity;
    public Argon2PasswordVerifier(int maxConcurrentVerifications = 2)
    {
        if (maxConcurrentVerifications is < 1 or > 32) throw new ArgumentOutOfRangeException(nameof(maxConcurrentVerifications));
        capacity = new(maxConcurrentVerifications, maxConcurrentVerifications);
    }
    public async Task<bool> VerifyAsync(byte[] password, PasswordVerifier? verifier, CancellationToken cancellationToken)
    {
        byte[] salt = dummySalt, expected = dummyHash;
        bool valid = false;
        if (password.Length is < 1 or > 4096) throw new LoginProviderException("LOGIN_INPUT_INVALID");
        if (verifier is not null && verifier.Encoded.Length <= 256)
        {
            var parts = verifier.Encoded.Split('$');
            if (parts.Length == 6 && parts[0] == "" && parts[1] == "argon2id" && parts[2] == "v=19"
                && parts[3] == $"m={MemoryKiB},t={Iterations},p={Parallelism}")
            {
                try
                {
                    var parsedSalt = Convert.FromBase64String(Pad(parts[4]));
                    var parsedHash = Convert.FromBase64String(Pad(parts[5]));
                    if (parsedSalt.Length == 16 && parsedHash.Length == 32)
                    { salt = parsedSalt; expected = parsedHash; valid = true; }
                }
                catch (FormatException) { }
            }
        }
        await capacity.WaitAsync(cancellationToken);
        byte[]? computed = null;
        try
        {
            cancellationToken.ThrowIfCancellationRequested();
            using var argon = new Argon2id(password)
            { Salt = salt, MemorySize = MemoryKiB, Iterations = Iterations, DegreeOfParallelism = Parallelism };
            // The library's KDF has no cancellation overload. Keep the semaphore
            // until it actually finishes, then honor cancellation before persistence.
            computed = await argon.GetBytesAsync(32);
            cancellationToken.ThrowIfCancellationRequested();
            return CryptographicOperations.FixedTimeEquals(computed, expected) & valid;
        }
        finally
        {
            if (computed is not null) CryptographicOperations.ZeroMemory(computed);
            if (valid) { CryptographicOperations.ZeroMemory(salt); CryptographicOperations.ZeroMemory(expected); }
            capacity.Release();
        }
    }
    // Operator enrollment utility; never expose this as an anonymous HTTP route.
    public async Task<PasswordVerifier> CreateForEnrollmentAsync(ReadOnlyMemory<byte> password, CancellationToken cancellationToken = default)
    {
        if (password.Length is < 1 or > 4096) throw new LoginProviderException("LOGIN_INPUT_INVALID");
        byte[] bytes = password.ToArray(), salt = RandomNumberGenerator.GetBytes(16);
        byte[]? hash = null;
        try
        {
            await capacity.WaitAsync(cancellationToken);
            try
            {
                using var argon = new Argon2id(bytes)
                { Salt = salt, MemorySize = MemoryKiB, Iterations = Iterations, DegreeOfParallelism = Parallelism };
                hash = await argon.GetBytesAsync(32);
                cancellationToken.ThrowIfCancellationRequested();
                return new PasswordVerifier($"$argon2id$v=19$m={MemoryKiB},t={Iterations},p={Parallelism}$"
                    + Convert.ToBase64String(salt).TrimEnd('=') + "$" + Convert.ToBase64String(hash).TrimEnd('='));
            }
            finally { capacity.Release(); }
        }
        finally
        {
            CryptographicOperations.ZeroMemory(bytes);
            CryptographicOperations.ZeroMemory(salt);
            if (hash is not null) CryptographicOperations.ZeroMemory(hash);
        }
    }
    private static string Pad(string value) => value.PadRight((value.Length + 3) / 4 * 4, '=');
    public void Dispose()
    {
        CryptographicOperations.ZeroMemory(dummySalt);
        CryptographicOperations.ZeroMemory(dummyHash);
        capacity.Dispose();
    }
}
