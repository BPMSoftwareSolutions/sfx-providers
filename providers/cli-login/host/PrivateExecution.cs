using System.Collections.Concurrent;
using System.Net;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using SfxProviders.CliLogin;
using SfxProviders.CliLogin.Hosting;


namespace SfxProviders.CliLogin.Hosting
{
    public sealed class LoginExecution(LoginInput input) : IDisposable
    {
        public string Correlation { get; } = Guid.NewGuid().ToString("N");
        public DateTimeOffset ExpiresAt { get; } = DateTimeOffset.UtcNow.AddMinutes(2);
        public LoginInput Input { get; } = input;
        public string Source { get; set; } = "";
        public string Disposition { get; set; } = "CONTINUE";
        public int Stage { get; set; }
        public bool Delivered { get; set; }
        public bool Closed { get; set; }
        public ResolvedLoginAttempt? Attempt { get; set; }
        public VerifiedLoginAttempt? Verification { get; set; }
        public AuthenticatedSession? Session { get; set; }
        public SemaphoreSlim Gate { get; } = new(1);
        public void Dispose() { Session?.Dispose(); Attempt?.Dispose(); Input.Dispose(); }
    }
    public static class PrivateSession
    {
        public static async Task WriteResponseAsync(AuthenticatedSession session, Stream destination, CancellationToken cancellation)
        {
            // Utf8JsonWriter disposal can flush synchronously. Serialize into a
            // private bounded buffer, then use only asynchronous Kestrel writes.
            using var buffer = new MemoryStream();
            try
            {
                await session.WritePrivateResponseAsync(buffer, cancellation);
                await destination.WriteAsync(buffer.GetBuffer().AsMemory(0, (int)buffer.Length), cancellation);
            }
            finally { CryptographicOperations.ZeroMemory(buffer.GetBuffer()); }
        }
        public static string? Bearer(HttpContext http)
        {
            string value = http.Request.Headers.Authorization.ToString();
            return value.StartsWith("Bearer ", StringComparison.Ordinal) && value.Length == 51 ? value[7..] : null;
        }
        public static async Task RevokeAsync(IdeSessionProvider provider, AuthenticatedSession session)
        {
            using var stream = new MemoryStream();
            try
            {
                await session.WritePrivateResponseAsync(stream);
                using var json = JsonDocument.Parse(stream.GetBuffer().AsMemory(0, (int)stream.Length));
                await provider.RevokeAsync(json.RootElement.GetProperty("token").GetString()!);
            }
            finally { CryptographicOperations.ZeroMemory(stream.GetBuffer()); }
        }
    }
}
