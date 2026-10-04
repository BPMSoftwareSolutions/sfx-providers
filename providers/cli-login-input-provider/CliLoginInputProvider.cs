using SfxProviders.CliLogin;
namespace SfxProviders.CliLogin;

public interface ILoginTerminal
{
    bool IsInteractive { get; }
    bool TreatControlCAsInput { get; set; }
    bool KeyAvailable { get; }
    ConsoleKeyInfo ReadKey();
    void Write(string text);
}
public sealed class ConsoleLoginTerminal : ILoginTerminal
{
    public bool IsInteractive => !Console.IsInputRedirected && !Console.IsErrorRedirected;
    public bool TreatControlCAsInput { get => Console.TreatControlCAsInput; set => Console.TreatControlCAsInput = value; }
    public bool KeyAvailable => Console.KeyAvailable;
    public ConsoleKeyInfo ReadKey() => Console.ReadKey(intercept: true);
    public void Write(string text) => Console.Error.Write(text);
}

public sealed class CliLoginInputProvider(ILoginTerminal? terminal = null)
{
    public const string ProviderId = "cli-login-input-provider";
    private readonly ILoginTerminal terminal = terminal ?? new ConsoleLoginTerminal();
    private static readonly SemaphoreSlim ConsoleOwner = new(1, 1);

    public Task<LoginInput> AcquireAsync(CancellationToken cancellationToken = default)
        => AcquireAsync(null, cancellationToken);
    public async Task<LoginInput> AcquireAsync(string? username, CancellationToken cancellationToken = default)
        => await AcquireCoreAsync(username, false, cancellationToken);
    public async Task<LoginInput> AcquireEnrollmentAsync(string? username, CancellationToken cancellationToken = default)
        => await AcquireCoreAsync(username, true, cancellationToken);
    private async Task<LoginInput> AcquireCoreAsync(string? username, bool confirm, CancellationToken cancellationToken)
    {
        if (!terminal.IsInteractive) throw new LoginProviderException("INTERACTIVE_LOGIN_REQUIRED");
        await ConsoleOwner.WaitAsync(cancellationToken);
        bool prior = false, restore = false;
        try
        {
            prior = terminal.TreatControlCAsInput;
            terminal.TreatControlCAsInput = true;
            restore = true;
            if (username is not null && (string.IsNullOrWhiteSpace(username) || username.Length > 254 || username.Any(char.IsControl)))
                throw new LoginProviderException("LOGIN_INPUT_INVALID");
            if (username is null) terminal.Write("Username: ");
            char[] identifier = username?.ToCharArray() ?? await ReadLineAsync(254, echo: true, cancellationToken);
            try
            {
                terminal.Write("Password: ");
                char[] password = await ReadLineAsync(1024, echo: false, cancellationToken);
                try
                {
                    if (confirm)
                    {
                        terminal.Write("Confirm password: ");
                        char[] confirmation = await ReadLineAsync(1024, echo: false, cancellationToken);
                        try
                        {
                            if (!password.AsSpan().SequenceEqual(confirmation))
                                throw new LoginProviderException("ENROLLMENT_PASSWORD_MISMATCH");
                        }
                        finally { Array.Clear(confirmation); }
                    }
                    return LoginInput.FromPrivateRequest(new string(identifier), password);
                }
                finally { Array.Clear(password); }
            }
            finally { Array.Clear(identifier); }
        }
        finally
        {
            try { if (restore) terminal.TreatControlCAsInput = prior; }
            finally { ConsoleOwner.Release(); }
        }
    }
    private async Task<char[]> ReadLineAsync(int limit, bool echo, CancellationToken cancellationToken)
    {
        char[] buffer = new char[limit];
        int count = 0;
        try
        {
            while (true)
            {
                cancellationToken.ThrowIfCancellationRequested();
                if (!terminal.KeyAvailable) { await Task.Delay(20, cancellationToken); continue; }
                ConsoleKeyInfo key = terminal.ReadKey();
                if (key.Key == ConsoleKey.C && key.Modifiers.HasFlag(ConsoleModifiers.Control))
                    throw new OperationCanceledException(cancellationToken);
                if (key.Key == ConsoleKey.Enter)
                {
                    terminal.Write(Environment.NewLine);
                    return buffer.AsSpan(0, count).ToArray();
                }
                if (key.Key == ConsoleKey.Backspace)
                {
                    if (count > 0) { buffer[--count] = '\0'; if (echo) terminal.Write("\b \b"); }
                    continue;
                }
                if (char.IsControl(key.KeyChar)) continue;
                // Refuse overflow; silently truncating a password changes its meaning.
                if (count == limit) throw new LoginProviderException("LOGIN_INPUT_TOO_LONG");
                buffer[count++] = key.KeyChar;
                if (echo) terminal.Write(key.KeyChar.ToString());
            }
        }
        finally { Array.Clear(buffer); }
    }
}
