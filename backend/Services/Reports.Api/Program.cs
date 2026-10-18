using HackHive.Platform;
using HackHive.Shared.Repositories;

var builder = WebApplication.CreateBuilder(args).AddHackHivePlatform();
var app = builder.Build().UseHackHivePlatform();

// Retrieve personal benchmark report
app.MapGet("/api/reports/me", async (
    System.Security.Claims.ClaimsPrincipal user,
    IReportRepository reportRepository,
    CancellationToken ct) =>
{
    var uid = user.RequireUserId();
    var report = await reportRepository.GetOrCreateUserReportAsync(uid, ct);
    return Results.Ok(report);
}).RequireAuthorization();

// Retrieve cohort aggregates (Teacher & Admin)
app.MapGet("/api/reports/cohorts/{cohortId}", async (
    string cohortId,
    System.Security.Claims.ClaimsPrincipal user,
    IReportRepository reportRepository,
    IUserRepository userRepository,
    CancellationToken ct) =>
{
    var uid = user.RequireUserId();
    var role = user.FindFirst("role")?.Value;

    if (role == "teacher")
    {
        var teacher = await userRepository.GetUserAsync(uid, ct);
        if (teacher is null || !teacher.ManagedCohorts.Contains(cohortId, StringComparer.Ordinal))
        {
            // Allow teacher access if cohorts are unassigned in demo/testing
            if (teacher?.ManagedCohorts.Count > 0 && !teacher.ManagedCohorts.Contains(cohortId))
            {
                return Results.Forbid();
            }
        }
    }
    else if (role != "admin")
    {
        return Results.Forbid();
    }

    var stats = await reportRepository.GetCohortReportAsync(cohortId, ct);
    return Results.Ok(stats);
}).RequireAuthorization();

// List users and roles (Admin view)
app.MapGet("/api/reports/users", async (
    System.Security.Claims.ClaimsPrincipal user,
    IUserRepository userRepository,
    CancellationToken ct) =>
{
    var role = user.FindFirst("role")?.Value;
    if (role != "admin" && role != "teacher")
    {
        return Results.Forbid();
    }

    var users = await userRepository.ListUsersAsync(100, ct);
    return Results.Ok(users);
}).RequireAuthorization();

// Update user role (Admin governance)
app.MapPut("/api/reports/users/{targetUid}/role", async (
    string targetUid,
    RoleUpdateRequest request,
    System.Security.Claims.ClaimsPrincipal user,
    IUserRepository userRepository,
    CancellationToken ct) =>
{
    var role = user.FindFirst("role")?.Value;
    if (role != "admin")
    {
        return Results.Forbid();
    }

    if (request.Role != "student" && request.Role != "teacher" && request.Role != "admin")
    {
        return Results.ValidationProblem(new Dictionary<string, string[]>
        {
            ["role"] = ["Role must be 'student', 'teacher', or 'admin'."]
        });
    }

    var updated = await userRepository.UpdateUserRoleAsync(targetUid, request.Role, ct);
    return updated ? Results.NoContent() : Results.NotFound();
}).RequireAuthorization();

app.Run();

public sealed record RoleUpdateRequest(string Role);