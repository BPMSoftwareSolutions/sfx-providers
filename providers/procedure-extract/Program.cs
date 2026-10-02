using System.Text.Json;

namespace SfxProviders.ProcedureExtract;

/// <summary>
/// procedure-extract: pure database-to-workbook pass-through.
/// Executes any stored procedure through sfx-dal and writes one Excel sheet per
/// result set (plus a _meta sheet). Stand-alone CLI provider.
/// </summary>
internal static class Program
{
    private static async Task<int> Main(string[] args)
    {
        string? procedure = null, parametersJson = null, output = null, connection = null;
        for (var i = 0; i < args.Length; i++)
        {
            switch (args[i])
            {
                case "--help" or "-h":
                    PrintHelp();
                    return 0;
                case "--procedure" or "-p":
                    procedure = Next(args, ref i, "--procedure");
                    break;
                case "--params" or "-j":
                    parametersJson = Next(args, ref i, "--params");
                    break;
                case "--output" or "-o":
                    output = Next(args, ref i, "--output");
                    break;
                case "--connection" or "-c":
                    connection = Next(args, ref i, "--connection");
                    break;
                default:
                    Console.Error.WriteLine($"Unknown option: {args[i]}");
                    PrintHelp();
                    return 2;
            }
        }

        if (string.IsNullOrWhiteSpace(procedure))
        {
            Console.Error.WriteLine("--procedure is required.");
            PrintHelp();
            return 2;
        }

        var parameters = ParseParameters(parametersJson);
        connection = ResolveConnection(connection);
        output ??= Path.Combine("outputs", $"{procedure.Replace('.', '-')}-{DateTime.Now:yyyyMMdd-HHmmss}.xlsx");

        try
        {
            var sets = await ProcedureExtractor.ExecuteAsync(procedure, parameters, connection);
            var path = ProcedureExtractor.WriteWorkbook(sets, output, procedure, parametersJson);
            Console.WriteLine($"procedure {procedure}");
            Console.WriteLine($"result sets {sets.Count}");
            foreach (var set in sets)
                Console.WriteLine($"  {set.Name}: {set.Rows.Count} row(s) x {set.Columns.Count} column(s)");
            Console.WriteLine($"workbook {Path.GetFullPath(path)}");
            return 0;
        }
        catch (Exception error)
        {
            Console.Error.WriteLine($"procedure-extract failed: {error.Message}");
            return 1;
        }
    }

    private static string Next(string[] args, ref int i, string option)
    {
        if (i + 1 >= args.Length || args[i + 1].StartsWith("--"))
            throw new ArgumentException($"{option} needs a value.");
        return args[++i];
    }

    private static IReadOnlyDictionary<string, object?>? ParseParameters(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return null;
        var parameters = new Dictionary<string, object?>();
        using var document = JsonDocument.Parse(json);
        if (document.RootElement.ValueKind != JsonValueKind.Object)
            throw new ArgumentException("--params must be a JSON object.");
        foreach (var property in document.RootElement.EnumerateObject())
            parameters[property.Name] = property.Value.ValueKind switch
            {
                JsonValueKind.Null => null,
                JsonValueKind.True => true,
                JsonValueKind.False => false,
                JsonValueKind.Number => property.Value.TryGetInt64(out var integer) ? integer : property.Value.GetDouble(),
                JsonValueKind.String => property.Value.GetString(),
                _ => property.Value.GetRawText(),
            };
        return parameters;
    }

    private static string ResolveConnection(string? connection)
    {
        connection ??= Environment.GetEnvironmentVariable("sidefx-connection-string")
            ?? throw new InvalidOperationException("No connection string: pass --connection or set sidefx-connection-string.");
        var firstSegment = connection.Split(';', 2)[0];
        if (!firstSegment.Contains('=')) connection = "Server=" + connection;
        return connection;
    }

    private static void PrintHelp() => Console.WriteLine(
        """
        procedure-extract: execute any stored procedure and write one Excel tab per result set.

        Usage:
          procedure-extract --procedure <schema.name> [--params <json-object>] [--output <file.xlsx>] [--connection <string>]

        Options:
          -p, --procedure   Stored procedure name, e.g. analysis.read_provider_canonical_body
          -j, --params      JSON object of procedure parameters, e.g. {"provider_id":"google/gemini-select"}
          -o, --output      Workbook path (default outputs/<procedure>-<timestamp>.xlsx)
          -c, --connection  SQL Server connection string (default: sidefx-connection-string)
          -h, --help        This help

        The workbook gets one sheet per result set (named from its result_set column)
        plus a _meta sheet with the procedure, parameters, timestamp and row counts.
        """);
}

