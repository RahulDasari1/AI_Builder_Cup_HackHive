using System.Text.RegularExpressions;
using Google.Cloud.Firestore;
using HackHive.Platform;

var builder = WebApplication.CreateBuilder(args).AddHackHivePlatform();
var app = builder.Build().UseHackHivePlatform();

app.MapGet("/api/learning/courses", async (FirestoreDb db) =>
{
    var snapshot = await db.Collection("Courses")
        .WhereEqualTo("published", true)
        .Limit(50)
        .GetSnapshotAsync();
    return Results.Ok(snapshot.Documents.Select(document => new
    {
        id = document.Id,
        data = document.ToDictionary()
    }));
}).RequireAuthorization();

app.MapGet("/api/learning/progress", async (System.Security.Claims.ClaimsPrincipal user, FirestoreDb db) =>
{
    var snapshot = await db.Collection("Progress")
        .WhereEqualTo("uid", user.RequireUserId())
        .Limit(100)
        .GetSnapshotAsync();
    return Results.Ok(snapshot.Documents.Select(document => new
    {
        id = document.Id,
        data = document.ToDictionary()
    }));
}).RequireAuthorization();

app.MapPut("/api/learning/progress/{courseId}/lessons/{lessonId}", async (
    string courseId,
    string lessonId,
    System.Security.Claims.ClaimsPrincipal user,
    FirestoreDb db) =>
{
    if (!Regex.IsMatch(courseId, "^[a-zA-Z0-9_-]{1,80}$") || !Regex.IsMatch(lessonId, "^[a-zA-Z0-9_-]{1,120}$"))
    {
        return Results.ValidationProblem(new Dictionary<string, string[]>
        {
            ["lesson"] = ["Course or lesson ID is invalid."]
        });
    }

    var uid = user.RequireUserId();
    var path = await db.Collection("LearningPaths").Document($"{uid}_{courseId}").GetSnapshotAsync();
    if (!path.Exists || !path.GetValue<List<string>>("lessonIds").Contains(lessonId, StringComparer.Ordinal))
    {
        return Results.NotFound();
    }

    var progressRef = db.Collection("Progress").Document($"{uid}_{courseId}");
    var userProfile = await db.Collection("Users").Document(uid).GetSnapshotAsync();
    await db.RunTransactionAsync(async transaction =>
    {
        var existingProgress = await transaction.GetSnapshotAsync(progressRef);
        var completedLessonIds = existingProgress.Exists && existingProgress.ContainsField("completedLessonIds")
            ? existingProgress.GetValue<List<string>>("completedLessonIds")
            : [];
        if (!completedLessonIds.Contains(lessonId, StringComparer.Ordinal))
        {
            completedLessonIds.Add(lessonId);
        }
        var progress = new Dictionary<string, object>
        {
            ["uid"] = uid,
            ["courseId"] = courseId,
            ["completedLessonIds"] = completedLessonIds,
            ["completedLessons"] = (long)completedLessonIds.Count,
            ["updatedAt"] = Timestamp.GetCurrentTimestamp()
        };
        if (userProfile.Exists && userProfile.TryGetValue<string>("cohortId", out var cohortId))
        {
            progress["cohortId"] = cohortId;
        }
        transaction.Set(progressRef, progress, SetOptions.MergeAll);
        return true;
    });
    return Results.NoContent();
}).RequireAuthorization();

app.Run();
