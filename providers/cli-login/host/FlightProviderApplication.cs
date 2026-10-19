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
    }
}
