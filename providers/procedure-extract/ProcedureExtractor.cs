using System.Collections;
using System.Data;
using System.Globalization;
using System.Reflection;
using System.Text;
using ClosedXML.Excel;

namespace SfxProviders.ProcedureExtract;

/// <summary>
/// One result set returned by a stored procedure: its name (the first
/// result_set column value when present), its columns and its rows.
/// </summary>
public sealed record ProcedureResultSet(string Name, IReadOnlyList<string> Columns, IReadOnlyList<object?[]> Rows);

/// <summary>
/// Extraction through sfx-dal: resolves the generated typed repository for the
/// procedure, executes it, and writes one Excel sheet per result set plus a
/// _meta sheet. No raw ADO; every call goes through the generated wrappers.
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

        if (string.IsNullOrWhiteSpace(connectionString) == false)
        {
            var firstSegment = connectionString!.Split(';', 2)[0];
            if (firstSegment.Contains('=') == false) connectionString = "Server=" + connectionString;
            Environment.SetEnvironmentVariable("sidefx-connection-string", connectionString);
        }

        Type repositoryType = ResolveRepositoryType(procedure);
        MethodInfo method = repositoryType
            .GetMethods(BindingFlags.Public | BindingFlags.Instance)
            .Where(candidate => candidate.Name is "ExecuteAsync" or "Execute")
            .OrderByDescending(candidate => candidate.Name == "ExecuteAsync")
            .FirstOrDefault()
            ?? throw new InvalidOperationException($"Repository for '{procedure}' exposes no Execute method.");

        ParameterInfo[] methodParameters = method.GetParameters();
        var arguments = new object?[methodParameters.Length];
        for (var index = 0; index < methodParameters.Length; index++)
        {
            object? value = FindParameter(parameters, methodParameters[index].Name);
            arguments[index] = ConvertValue(value, methodParameters[index].ParameterType);
        }

        object repository = Activator.CreateInstance(repositoryType)
            ?? throw new InvalidOperationException($"Could not create '{repositoryType.FullName}'.");

        object? result;
        if (method.ReturnType.IsGenericType && method.ReturnType.GetGenericTypeDefinition() == typeof(Task<>))
        {
            var task = (Task)method.Invoke(repository, arguments)!;
            await task.WaitAsync(cancellationToken);
            result = task.GetType().GetProperty("Result")!.GetValue(task);
        }
        else
        {
            result = method.Invoke(repository, arguments);
        }

        if (result?.GetType().GetProperty("ResultSets")?.GetValue(result) is not IEnumerable tables)
            throw new InvalidOperationException($"Procedure '{procedure}' did not return a result-set collection.");

        var sets = new List<ProcedureResultSet>();
        foreach (DataTable table in tables)
        {
            string[] columns = table.Columns.Cast<DataColumn>().Select(column => column.ColumnName).ToArray();
            List<object?[]> rows = table.Rows.Cast<DataRow>().Select(row => row.ItemArray).ToList();
            var name = "set_" + (sets.Count + 1);
            var nameIndex = Array.IndexOf(columns, "result_set");
            if (nameIndex >= 0 && rows.Count > 0 && rows[0][nameIndex] is { } label && label is not DBNull)
                name = label.ToString()!;
            sets.Add(new ProcedureResultSet(name, columns, rows));
        }

        return sets;
    }

    private static Type ResolveRepositoryType(string procedure)
    {
        string className = ToClassName(procedure) + "Repository";
        Type? type = typeof(SFX.DAL.Helpers.DatabaseHelper).Assembly.GetType($"SFX.DAL.Repositories.{className}");
        return type ?? throw new InvalidOperationException(
            $"Procedure '{procedure}' is not declared in SFX.DAL. Add it to SFX.DAL.Config.json and regenerate the DAL.");
    }

    private static string ToClassName(string procedure)
    {
        var builder = new StringBuilder();
        foreach (string token in procedure.Split(new[] { '.', '_', '-', ' ' }, StringSplitOptions.RemoveEmptyEntries))
        {
            builder.Append(char.ToUpperInvariant(token[0]));
            if (token.Length > 1) builder.Append(token.AsSpan(1));
        }
        return builder.ToString();
    }

    private static object? FindParameter(IReadOnlyDictionary<string, object?>? parameters, string? methodParameterName)
    {
        if (parameters is null || methodParameterName is null) return null;
        foreach ((string key, object? value) in parameters)
        {
            if (Normalize(key) == Normalize(methodParameterName)) return value;
        }
        return null;
    }

    private static string Normalize(string? name)
        => new string((name ?? string.Empty).Where(char.IsLetterOrDigit).ToArray()).ToLowerInvariant();

    private static object? ConvertValue(object? value, Type targetType)
    {
        Type type = Nullable.GetUnderlyingType(targetType) ?? targetType;
        if (value is null)
            return targetType.IsValueType && Nullable.GetUnderlyingType(targetType) is null
                ? Activator.CreateInstance(targetType)
                : null;
        if (type == typeof(string)) return value.ToString();
        if (type == typeof(bool)) return value is bool flag ? flag : Convert.ToBoolean(value, CultureInfo.InvariantCulture);
        if (type == typeof(byte[])) return value is byte[] bytes ? bytes : Convert.FromBase64String(value.ToString()!);
        if (type == typeof(Guid)) return value is Guid guid ? guid : Guid.Parse(value.ToString()!);
        if (type == typeof(DateTime)) return value is DateTime moment ? moment : DateTime.Parse(value.ToString()!, CultureInfo.InvariantCulture);
        if (type.IsEnum) return Enum.Parse(type, value.ToString()!, ignoreCase: true);
        try
        {
            return Convert.ChangeType(value, type, CultureInfo.InvariantCulture);
        }
        catch (Exception)
        {
            throw new InvalidOperationException($"Cannot convert value '{value}' to {type.Name}.");
        }
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
