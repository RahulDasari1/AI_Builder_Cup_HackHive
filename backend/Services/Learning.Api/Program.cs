using System.Text.RegularExpressions;
using HackHive.Platform;
using HackHive.Shared.Models;
using HackHive.Shared.Repositories;

var builder = WebApplication.CreateBuilder(args).AddHackHivePlatform();
var app = builder.Build().UseHackHivePlatform();

// Retrieve published courses
app.MapGet("/api/learning/courses", async (ILearningRepository repository, CancellationToken ct) =>
{
    var courses = await repository.GetPublishedCoursesAsync(50, ct);
    return Results.Ok(courses);
}).RequireAuthorization();

// Create or update course (Admin role)
app.MapPost("/api/learning/courses", async (
    CourseRecord course,
    System.Security.Claims.ClaimsPrincipal user,
    ILearningRepository repository,
    CancellationToken ct) =>
{
    var role = user.FindFirst("role")?.Value;
    if (role != "admin" && role != "teacher")
    {
        return Results.Forbid();
    }

    if (string.IsNullOrWhiteSpace(course.Title) || course.Title.Length > 200)
    {
        return Results.ValidationProblem(new Dictionary<string, string[]>
        {
            ["title"] = ["Course title must be between 1 and 200 characters."]
        });
    }

    var saved = await repository.CreateOrUpdateCourseAsync(course, ct);
    return Results.Created($"/api/learning/courses/{saved.Id}", saved);
}).RequireAuthorization();

// Delete a course (Admin only)
app.MapDelete("/api/learning/courses/{courseId}", async (
    string courseId,
    System.Security.Claims.ClaimsPrincipal user,
    ILearningRepository repository,
    CancellationToken ct) =>
{
    var role = user.FindFirst("role")?.Value;
    if (role != "admin")
    {
        return Results.Forbid();
    }

    var deleted = await repository.DeleteCourseAsync(courseId, ct);
    return deleted ? Results.NoContent() : Results.NotFound();
}).RequireAuthorization();

// Retrieve current user progress
app.MapGet("/api/learning/progress", async (
    System.Security.Claims.ClaimsPrincipal user,
    ILearningRepository repository,
    CancellationToken ct) =>
{
    var uid = user.RequireUserId();
    var progress = await repository.GetUserProgressAsync(uid, 100, ct);
    return Results.Ok(progress);
}).RequireAuthorization();

// Record lesson progress
app.MapPut("/api/learning/progress/{courseId}/lessons/{lessonId}", async (
    string courseId,
    string lessonId,
    System.Security.Claims.ClaimsPrincipal user,
    ILearningRepository repository,
    CancellationToken ct) =>
{
    if (!Regex.IsMatch(courseId, "^[a-zA-Z0-9_-]{1,80}$") || !Regex.IsMatch(lessonId, "^[a-zA-Z0-9_-]{1,120}$"))
    {
        return Results.ValidationProblem(new Dictionary<string, string[]>
        {
            ["lesson"] = ["Course or lesson ID is invalid."]
        });
    }

    var uid = user.RequireUserId();
    var path = await repository.GetLearningPathAsync(uid, courseId, ct);
    if (path is null)
    {
        // Auto-initialize path if learner begins lesson
        await repository.RecordLessonCompletionAsync(uid, courseId, lessonId, ct);
        return Results.NoContent();
    }

    await repository.RecordLessonCompletionAsync(uid, courseId, lessonId, ct);
    return Results.NoContent();
}).RequireAuthorization();

app.Run();
