using System.Text.Json;
using SFX.Identity.DAL.Repositories;

namespace SfxProviders.CliLogin.Hosting;

// Private flight provider transport. The caller is the admitted service
// identity; the identity DAL owns the flight reads and writes.
public static class FlightProviderApplication
{
    public static void Map(WebApplication app)
    {
        app.MapPost("/evidence/v1/flights/read-recording", async (HttpContext http) =>
        {
            if (http.Items["evidence.writer"] is not string) return Results.Unauthorized();
            using var body = await JsonDocument.ParseAsync(http.Request.Body, new JsonDocumentOptions { MaxDepth = 8 }, http.RequestAborted);
            var root = body.RootElement;
            if (root.ValueKind != JsonValueKind.Object ||
                !root.TryGetProperty("principalId", out var principalValue) ||
                !Guid.TryParse(principalValue.GetString(), out var principalId) ||
                !root.TryGetProperty("flightRecordingId", out var recordingValue) ||
                !Guid.TryParse(recordingValue.GetString(), out var flightRecordingId))
                return Results.BadRequest();

            var result = await new EvidenceReadFlightRecordingRepository().ExecuteAsync(principalId, flightRecordingId);
            var row = result.Rows.SingleOrDefault();
            if (row?.Value is null) return Results.NotFound();
            return Results.Content(row.Value, "application/json");
        });

        app.MapPost("/evidence/v1/flights/read-plan", async (HttpContext http) =>
        {
            if (http.Items["evidence.writer"] is not string) return Results.Unauthorized();
            using var body = await JsonDocument.ParseAsync(http.Request.Body, new JsonDocumentOptions { MaxDepth = 8 }, http.RequestAborted);
            var root = body.RootElement;
            if (root.ValueKind != JsonValueKind.Object ||
                !root.TryGetProperty("principalId", out var principalValue) ||
                !Guid.TryParse(principalValue.GetString(), out var principalId) ||
                !root.TryGetProperty("agentId", out var agentValue) ||
                agentValue.GetString() is not { Length: > 0 and <= 255 } agentId)
                return Results.BadRequest();

            var plan = await new FlightPlanRepository().GetByIdAsync(principalId, agentId);
            if (plan is null) return Results.NotFound();
            return Results.Json(new
            {
                principalId = plan.PrincipalId,
                agentId = plan.AgentId,
                planRevision = plan.PlanRevision,
                objective = plan.Objective,
                stepsJson = plan.StepsJson,
                planDigest = Convert.ToHexString(plan.PlanDigest).ToLowerInvariant(),
                updatedAt = plan.UpdatedAt
            });
        });

        app.MapPost("/evidence/v1/flights/record-plan", async (HttpContext http) =>
        {
            if (http.Items["evidence.writer"] is not string) return Results.Unauthorized();
            using var body = await JsonDocument.ParseAsync(http.Request.Body, new JsonDocumentOptions { MaxDepth = 16 }, http.RequestAborted);
            var root = body.RootElement;
            if (root.ValueKind != JsonValueKind.Object ||
                !root.TryGetProperty("principalId", out var principalValue) ||
                !Guid.TryParse(principalValue.GetString(), out var principalId) ||
                !root.TryGetProperty("agentId", out var agentValue) ||
                agentValue.GetString() is not { Length: > 0 and <= 255 } agentId ||
                !root.TryGetProperty("objective", out var objectiveValue) ||
                objectiveValue.GetString() is not { Length: > 0 and <= 2000 } objective ||
                !root.TryGetProperty("stepsJson", out var stepsValue) ||
                stepsValue.GetString() is not { Length: > 0 } stepsJson)
                return Results.BadRequest();

            var result = await new EvidenceUpsertFlightPlanRepository().ExecuteAsync(principalId, agentId, objective, stepsJson);
            var row = result.Rows.SingleOrDefault();
            if (row is null) return Results.StatusCode(500);
            return Results.Json(new
            {
                principalId,
                agentId,
                planRevision = row.PlanRevision,
                planDigest = Convert.ToHexString(row.PlanDigest).ToLowerInvariant(),
                updatedAt = row.UpdatedAt
            });
        });

        app.MapPost("/evidence/v1/flights/begin-recording", async (HttpContext http) =>
        {
            using var body = await Read(http);
            var root = body.RootElement;
            var result = await new EvidenceBeginFlightRecordingRepository().ExecuteAsync(
                Id(root, "principalId"), Text(root, "agentId", 255), Id(root, "flightRecordingId"));
            var row = result.Rows.Single();
            return Results.Json(new { flight_recording_id = row.FlightRecordingId });
        });
        app.MapPost("/evidence/v1/flights/attach-run", async (HttpContext http) =>
        {
            using var body = await Read(http);
            var root = body.RootElement;
            var result = await new EvidenceAttachRunToRecordingRepository().ExecuteAsync(
                Id(root, "principalId"), Text(root, "runId", 128), Id(root, "flightRecordingId"));
            var row = result.Rows.Single();
            return Results.Json(new { run_id = row.RunId, flight_recording_id = row.FlightRecordingId });
        });
        app.MapPost("/evidence/v1/flights/complete-recording", async (HttpContext http) =>
        {
            using var body = await Read(http);
            var root = body.RootElement;
            var result = await new EvidenceCompleteFlightRecordingRepository().ExecuteAsync(
                Id(root, "principalId"), Id(root, "flightRecordingId"), Text(root, "frontierResponse", 1000000));
            var row = result.Rows.Single();
            return Results.Json(new { flight_recording_id = row.FlightRecordingId, completed_at = row.CompletedAt,
                frontier_response = row.FrontierResponse, response_recorded_at = row.ResponseRecordedAt });
        });
        app.MapPost("/evidence/v1/flights/list-recordings", async (HttpContext http) =>
        {
            using var body = await Read(http);
            var root = body.RootElement;
            var records = await new FlightRecordingRepository().GetByPrincipalIdAsync(Id(root, "principalId"));
            var agent = root.TryGetProperty("agentId", out var a) && a.ValueKind == JsonValueKind.String ? a.GetString() : null;
            var offset = root.TryGetProperty("cursor", out var c) && c.ValueKind == JsonValueKind.String && int.TryParse(c.GetString(), out var n) ? Math.Max(0, n) : 0;
            var limit = root.TryGetProperty("limit", out var l) && l.TryGetInt32(out var count) ? Math.Clamp(count, 1, 100) : 30;
            var page = records.Where(r => string.IsNullOrEmpty(agent) || r.AgentId == agent).OrderByDescending(r => r.StartedAt)
                .ThenBy(r => r.FlightRecordingId).Skip(offset).Take(limit + 1).ToArray();
            return Results.Json(new { recordings = page.Take(limit).Select(r => new {
                flight_recording_id = r.FlightRecordingId, agent_id = r.AgentId, objective_snapshot = r.ObjectiveSnapshot,
                plan_revision = r.PlanRevision, started_at = r.StartedAt, completed_at = r.CompletedAt }),
                nextCursor = page.Length > limit ? (offset + limit).ToString() : null });
        });
    }

    private static Task<JsonDocument> Read(HttpContext http) =>
        JsonDocument.ParseAsync(http.Request.Body, new JsonDocumentOptions { MaxDepth = 16 }, http.RequestAborted);
    private static string Text(JsonElement root, string name, int maximum) =>
        root.ValueKind == JsonValueKind.Object && root.TryGetProperty(name, out var value) && value.ValueKind == JsonValueKind.String &&
        value.GetString() is { Length: > 0 } text && text.Length <= maximum ? text : throw new JsonException();
    private static Guid Id(JsonElement root, string name) => Guid.Parse(Text(root, name, 36));
}
