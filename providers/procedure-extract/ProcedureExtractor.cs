using System.Data;
using ClosedXML.Excel;
using Microsoft.Data.SqlClient;

namespace SfxProviders.ProcedureExtract;

/// <summary>
/// One result set returned by a stored procedure: its name (the first
/// result_set column value when present), its columns and its rows.
/// </summary>
public sealed record ProcedureResultSet(string Name, IReadOnlyList<string> Columns, IReadOnlyList<object?[]> Rows);

/// <summary>
/// Stand-alone extraction: execute any stored procedure, capture every result
/// set, write one Excel sheet per set plus a _meta sheet.
/// </summary>
public static class ProcedureExtractor
{
    public static async Task<IReadOnlyList<ProcedureResultSet>> ExecuteAsync(
        string procedure,
        IReadOnlyDictionary<string, object?>? parameters = null,
        string? connectionString = null,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(procedure)) throw new ArgumentException("procedure is required.", nameof(procedure));
        connectionString ??= Environment.GetEnvironmentVariable("sidefx-connection-string")
            ?? throw new InvalidOperationException("No connection string: pass one or set sidefx-connection-string.");
        var firstSegment = connectionString.Split(';', 2)[0];
        if (!firstSegment.Contains('=')) connectionString = "Server=" + connectionString;

        await using var connection = new SqlConnection(connectionString);
        await connection.OpenAsync(cancellationToken);
        await using var command = connection.CreateCommand();
        command.CommandType = CommandType.StoredProcedure;
        command.CommandText = procedure;
        command.CommandTimeout = 300;
        if (parameters is not null)
            foreach (var (name, value) in parameters)
                command.Parameters.AddWithValue(name.StartsWith('@') ? name : "@" + name, value ?? DBNull.Value);

        var sets = new List<ProcedureResultSet>();
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        do
        {
            var columns = Enumerable.Range(0, reader.FieldCount).Select(reader.GetName).ToArray();
            var rows = new List<object?[]>();
            while (await reader.ReadAsync(cancellationToken))
            {
                var row = new object?[reader.FieldCount];
                reader.GetValues(row);
                rows.Add(row);
            }
            var name = "set_" + (sets.Count + 1);
            var nameIndex = Array.IndexOf(columns, "result_set");
            if (nameIndex >= 0 && rows.Count > 0 && rows[0][nameIndex] is { } label && label is not DBNull)
                name = label.ToString()!;
            sets.Add(new ProcedureResultSet(name, columns, rows));
        } while (await reader.NextResultAsync(cancellationToken));
        return sets;
    }

    public static string WriteWorkbook(
        IReadOnlyList<ProcedureResultSet> sets,
        string outputPath,
        string? procedure = null,
        string? parametersJson = null)
    {
        if (string.IsNullOrWhiteSpace(outputPath)) throw new ArgumentException("outputPath is required.", nameof(outputPath));
        var directory = Path.GetDirectoryName(Path.GetFullPath(outputPath));
        if (!string.IsNullOrEmpty(directory)) Directory.CreateDirectory(directory);

        using var workbook = new XLWorkbook();
        var meta = workbook.Worksheets.Add("_meta");
        meta.Cell(1, 1).Value = "procedure";
        meta.Cell(1, 2).Value = procedure ?? "";
        meta.Cell(2, 1).Value = "parameters";
        meta.Cell(2, 2).Value = parametersJson ?? "";
        meta.Cell(3, 1).Value = "generatedUtc";
        meta.Cell(3, 2).Value = DateTime.UtcNow.ToString("O");
        meta.Cell(5, 1).Value = "sheet";
        meta.Cell(5, 2).Value = "rows";
        meta.Cell(5, 3).Value = "columns";
        var metaRow = 6;
        var used = new HashSet<string>(StringComparer.OrdinalIgnoreCase) { "_meta" };
        foreach (var set in sets)
        {
            var sheetName = SheetName(set.Name, used);
            var sheet = workbook.Worksheets.Add(sheetName);
            for (var c = 0; c < set.Columns.Count; c++) sheet.Cell(1, c + 1).Value = set.Columns[c];
            for (var r = 0; r < set.Rows.Count; r++)
                for (var c = 0; c < set.Columns.Count; c++)
                    SetCell(sheet.Cell(r + 2, c + 1), set.Rows[r][c]);
            sheet.Row(1).Style.Font.Bold = true;
            sheet.SheetView.FreezeRows(1);
            if (set.Columns.Count > 0) sheet.Columns(1, set.Columns.Count).AdjustToContents(1, Math.Min(set.Rows.Count + 1, 200));
            meta.Cell(metaRow, 1).Value = sheetName;
            meta.Cell(metaRow, 2).Value = set.Rows.Count;
            meta.Cell(metaRow, 3).Value = set.Columns.Count;
            metaRow++;
        }
        meta.Columns(1, 3).AdjustToContents();
        workbook.SaveAs(outputPath);
        return outputPath;
    }

    private static void SetCell(IXLCell cell, object? value) => cell.Value = value switch
    {
        null or DBNull => Blank.Value,
        string text => text,
        bool flag => flag,
        DateTime moment => moment,
        DateTimeOffset moment => moment.DateTime,
        byte[] bytes => Convert.ToHexString(bytes),
        decimal number => number,
        double number => number,
        float number => (double)number,
        byte or sbyte or short or ushort or int or uint or long or ulong => Convert.ToInt64(value),
        _ => value.ToString(),
    };

    private static string SheetName(string proposed, HashSet<string> used)
    {
        var cleaned = new string((proposed ?? "set").Where(ch => ch is not ('[' or ']' or ':' or '*' or '?' or '/' or '\\')).ToArray()).Trim();
        if (cleaned.Length == 0) cleaned = "set";
        if (cleaned.Length > 31) cleaned = cleaned[..31];
        if (used.Add(cleaned)) return cleaned;
        for (var suffix = 2; ; suffix++)
        {
            var candidate = cleaned[..Math.Min(cleaned.Length, 31 - suffix.ToString().Length)] + suffix;
            if (used.Add(candidate)) return candidate;
        }
    }
}
