using System.Text.Json;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;

namespace SfxProviders.ProcedureExtract;

/// <summary>
/// HTTP surface for the same pass-through as the CLI. Both endpoints take
/// {"procedure": "schema.name", "parameters": {...}}: POST /excel returns the
/// workbook, POST /json returns the result sets as JSON.
/// </summary>
internal static class ProcedureExtractApi
{
    private sealed record ExtractRequest(string Procedure, JsonElement? Parameters);

    public static Task RunAsync(string url, string connection)
    {
        var app = WebApplication.Create();

        // Deployment policy is host data. The generated DAL remains the only
        // procedure dispatcher; public hosting never enables arbitrary writers.
        var allowed = Environment.GetEnvironmentVariable("PROCEDURE_EXTRACT_ALLOWED_PROCEDURES")?
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .ToHashSet(StringComparer.OrdinalIgnoreCase);
        app.Use(async (context, next) =>
        {
            if (context.Request.Path == "/health") { await next(context); return; }
            if (allowed is not null)
            {
                context.Request.EnableBuffering();
                try
                {
                    var request = await JsonSerializer.DeserializeAsync<ExtractRequest>(context.Request.Body,
                        new JsonSerializerOptions(JsonSerializerDefaults.Web), context.RequestAborted);
                    if (request is null || !allowed.Contains(request.Procedure))
                    {
                        context.Response.StatusCode = StatusCodes.Status403Forbidden;
                        await context.Response.WriteAsJsonAsync(new { error = "PROCEDURE_NOT_ALLOWED" });
                        return;
                    }
                }
                catch (JsonException)
                {
                    context.Response.StatusCode = StatusCodes.Status400BadRequest;
                    await context.Response.WriteAsJsonAsync(new { error = "INVALID_PROCEDURE_REQUEST" });
                    return;
                }
                finally { context.Request.Body.Position = 0; }
            }
            await next(context);
        });
        app.MapGet("/health", () => Results.Json(new { ready = true }));

        app.MapPost("/excel", (ExtractRequest request) => ExtractAsync(request, connection, sets =>
        {
            using var stream = new MemoryStream();
            ProcedureExtractor.WriteWorkbook(sets, stream, request.Procedure, request.Parameters?.GetRawText());
            return Results.File(stream.ToArray(),
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                $"{request.Procedure.Replace('.', '-')}-{DateTime.Now:yyyyMMdd-HHmmss}.xlsx");
        }));

        app.MapPost("/json", (ExtractRequest request) => ExtractAsync(request, connection, sets =>
            Results.Json(sets.Select(set => new
            {
                name = set.Name,
                columns = set.Columns,
                rows = set.Rows.Select(row => set.Columns
                    .Select((column, index) => (column, value: row[index] is DBNull ? null : row[index]))
                    .ToDictionary(cell => cell.column, cell => cell.value)),
            }))));

        return app.RunAsync(url);
    }

    private static async Task<IResult> ExtractAsync(
        ExtractRequest request, string connection, Func<IReadOnlyList<ProcedureResultSet>, IResult> project)
    {
        try
        {
            var parameters = Program.ParseParameters(request.Parameters?.GetRawText());
            return project(await ProcedureExtractor.ExecuteAsync(request.Procedure, parameters, connection));
        }
        catch (Exception error)
        {
            return Results.Problem(error.Message);
        }
    }
}
