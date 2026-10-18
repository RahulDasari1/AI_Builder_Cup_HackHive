using Google.Cloud.Firestore;
using HackHive.Platform;

var builder = WebApplication.CreateBuilder(args).AddHackHivePlatform();
var app = builder.Build().UseHackHivePlatform();

app.MapGet("/api/reports/me", async (System.Security.Claims.ClaimsPrincipal user, FirestoreDb db) =>
{
    var uid = user.RequireUserId();
    var snapshot = await db.Collection("Progress")
        .WhereEqualTo("uid", uid)
        .Limit(100)
        .GetSnapshotAsync();
    var entries = snapshot.Documents.Select(document => document.ToDictionary()).ToArray();
    var scores = entries
        .Where(entry => entry.TryGetValue("assessmentScore", out var value) && value is long)
        .Select(entry => Convert.ToInt32(entry["assessmentScore"]))
        .ToArray();
    var completedLessons = entries.Sum(entry => ReadInt(entry, "completedLessons"));
    var report = new Dictionary<string, object>
    {
        ["uid"] = uid,
        ["courseCount"] = entries.Length,
        ["completedLessons"] = completedLessons,
        ["averageAssessmentScore"] = scores.Length == 0 ? 0 : (int)Math.Round(scores.Average()),
        ["updatedAt"] = Timestamp.GetCurrentTimestamp()
    };
    await db.Collection("Reports").Document(uid).SetAsync(report, SetOptions.MergeAll);
    return Results.Ok(report);
}).RequireAuthorization();

app.MapGet("/api/reports/cohorts/{cohortId}", async (
    string cohortId,
    System.Security.Claims.ClaimsPrincipal user,
    FirestoreDb db) =>
{
    var uid = user.RequireUserId();
    var role = user.FindFirst("role")?.Value;
    if (role == "teacher")
    {
        var teacher = await db.Collection("Users").Document(uid).GetSnapshotAsync();
        var managedCohorts = teacher.Exists && teacher.ContainsField("managedCohorts")
            ? teacher.GetValue<List<string>>("managedCohorts")
            : [];
        if (!managedCohorts.Contains(cohortId, StringComparer.Ordinal))
        {
            return Results.Forbid();
        }
    }
    else if (role != "admin")
    {
        return Results.Forbid();
    }

    var members = await db.Collection("Users")
        .WhereEqualTo("cohortId", cohortId)
        .Limit(500)
        .GetSnapshotAsync();
    var memberIds = members.Documents.Select(document => document.Id).ToHashSet(StringComparer.Ordinal);
    var progress = await db.Collection("Progress")
        .WhereEqualTo("cohortId", cohortId)
        .Limit(1000)
        .GetSnapshotAsync();
    var records = progress.Documents.Select(document => document.ToDictionary()).ToArray();
    var scores = records
        .Where(record => record.TryGetValue("assessmentScore", out var score) && score is long)
        .Select(record => Convert.ToInt32(record["assessmentScore"]))
        .ToArray();
    return Results.Ok(new
    {
        cohortId,
        learnerCount = memberIds.Count,
        activeLearners = records.Select(record => record.GetValueOrDefault("uid") as string)
            .Where(memberId => memberId is not null && memberIds.Contains(memberId))
            .Distinct(StringComparer.Ordinal)
            .Count(),
        averageAssessmentScore = scores.Length == 0 ? 0 : (int)Math.Round(scores.Average()),
        courseProgressRecords = records.Length
    });
}).RequireAuthorization();

app.Run();

static int ReadInt(IReadOnlyDictionary<string, object> values, string key) =>
    values.TryGetValue(key, out var value) ? Convert.ToInt32(value) : 0;