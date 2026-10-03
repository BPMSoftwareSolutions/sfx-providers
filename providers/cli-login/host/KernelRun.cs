using System.Diagnostics;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;

namespace SfxProviders.CliLogin.Hosting;

public sealed record HostSettings(string Estate, string Capability, string InputContract, string OutcomeContract,
    string Realm, string ProviderOrigin, string Observer, bool LocalGateway)
{
    public static HostSettings Load()
    {
        static string Required(string key) => Environment.GetEnvironmentVariable(key) is { Length: > 0 } value ? value : throw new InvalidOperationException(key + "_REQUIRED");
        var origin = new Uri(Required("SFX_IDENTITY_PROVIDER_ORIGIN"));
        if (origin.Scheme != "https" || origin.AbsolutePath != "/" || origin.Query != "" || origin.UserInfo != "") throw new InvalidOperationException("PROVIDER_ORIGIN_INVALID");
        return new(Required("SDA_ESTATE_DIR"), Required("SFX_IDENTITY_CAPABILITY"), Required("SFX_IDENTITY_INPUT_CONTRACT"),
            Required("SFX_IDENTITY_OUTCOME_CONTRACT"), Required("SFX_IDENTITY_REALM"), origin.GetLeftPart(UriPartial.Authority),
            Required("SFX_OBSERVER_ENDPOINT"), Environment.GetEnvironmentVariable("SFX_IDENTITY_LOCAL_GATEWAY") == "1");
    }
}

public static class KernelRun
{
    public static async Task<string> ExecuteAsync(HostSettings settings, LoginExecution execution, HttpClient telemetry, CancellationToken cancellation)
    {
        using var timeout = CancellationTokenSource.CreateLinkedTokenSource(cancellation);
        timeout.CancelAfter(TimeSpan.FromSeconds(100));
        using var config = JsonDocument.Parse(await File.ReadAllTextAsync(Path.Combine(settings.Estate, "sfx.config.json"), timeout.Token));
        var delivery = config.RootElement.GetProperty("deliveries").GetProperty("database-memory");
        var start = new ProcessStartInfo(delivery.GetProperty("command").GetString()!)
        {
            WorkingDirectory = delivery.GetProperty("cwd").GetString()!,
            UseShellExecute = false,
            CreateNoWindow = true,
            RedirectStandardOutput = true,
            RedirectStandardError = true
        };
        foreach (var argument in delivery.GetProperty("args").EnumerateArray())
            if (argument.GetString() != "--stdin-envelope") start.ArgumentList.Add(argument.GetString()!);
        foreach (var argument in new[] { "capability", "observe", settings.Capability, "--input", JsonSerializer.Serialize(new {
            contractId = settings.InputContract, payload = new { correlationId = execution.Correlation, providerOrigin = settings.ProviderOrigin }
        }), "--input-type", "json", "--json", "--trace" }) start.ArgumentList.Add(argument);
        foreach (var key in start.Environment.Keys.ToArray())
            if (key is "SDA_API_TOKEN" or "SFX_IDENTITY_CONNECTION_STRING" or "SFX_VAULT_UNLOCK" or "IDENTITY_HEADER" or "MSI_SECRET") start.Environment.Remove(key);
        start.Environment.Remove("SFX_IDENTITY_SERVICE_KEY");
        start.Environment["SIDEFX_OBSERVE"] = "1";
        using var process = Process.Start(start) ?? throw new InvalidOperationException("KERNEL_START_FAILED");
        using var stop = timeout.Token.Register(() => { try { process.Kill(true); } catch (InvalidOperationException) { } });
        try
        {
            await Publish(new { kind = "run-start", at = DateTimeOffset.UtcNow, pid = process.Id });
            var output = ReadOutput();
            var observations = ReadObservations();
            await Task.WhenAll(process.WaitForExitAsync(timeout.Token), observations, output);
            if (process.ExitCode != 0) throw new InvalidOperationException("LOGIN_EXECUTION_FAILED");
            using var result = JsonDocument.Parse(await output);
            if (result.RootElement.GetProperty("contractId").GetString() != settings.OutcomeContract)
                throw new InvalidOperationException("LOGIN_RESULT_CONTRACT_INVALID");
            return result.RootElement.GetProperty("disposition").GetString()!;
        }
        finally
        {
            if (!process.HasExited) { process.Kill(true); await process.WaitForExitAsync(CancellationToken.None); }
            await Publish(new { kind = "run-end", at = DateTimeOffset.UtcNow, pid = process.Id, exitCode = process.ExitCode });
        }
        async Task Publish(object value)
        {
            try
            {
                using var response = await telemetry.PostAsJsonAsync(settings.Observer, value, CancellationToken.None);
                response.EnsureSuccessStatusCode();
            }
            catch { timeout.Cancel(); throw; }
        }
        async Task<string> ReadOutput()
        {
            var text = new StringBuilder(); var buffer = new char[4096]; int read;
            while ((read = await process.StandardOutput.ReadAsync(buffer, timeout.Token)) > 0)
            {
                if (text.Length + read > 1024 * 1024) { timeout.Cancel(); throw new InvalidOperationException("LOGIN_OUTPUT_BOUND"); }
                text.Append(buffer, 0, read);
            }
            return text.ToString();
        }
        async Task ReadObservations()
        {
            string? line; long bytes = 0;
            while ((line = await process.StandardError.ReadLineAsync(timeout.Token)) is not null)
            {
                bytes += line.Length;
                if (bytes > 64 * 1024 * 1024 || line.Contains(Environment.GetEnvironmentVariable("SFX_IDENTITY_SERVICE_KEY")!, StringComparison.Ordinal))
                { timeout.Cancel(); throw new InvalidOperationException("LOGIN_OBSERVATION_REFUSED"); }
                if (!line.StartsWith("SFX_OBSERVATION ", StringComparison.Ordinal)) continue;
                using var observation = JsonDocument.Parse(line[16..]);
                await Publish(new { kind = "observation", payload = observation.RootElement });
            }
        }
    }
}
