using Google.Cloud.Firestore;
using HackHive.Shared.Models;

namespace HackHive.Shared.Repositories;

public class FirestoreReportRepository : IReportRepository
{
    private readonly FirestoreDb _db;

    public FirestoreReportRepository(FirestoreDb db)
    {
        _db = db ?? throw new ArgumentNullException(nameof(db));
    }

    public async Task<ReportSummaryRecord> GetOrCreateUserReportAsync(string uid, CancellationToken ct = default)
    {
        var snapshot = await _db.Collection("Progress")
            .WhereEqualTo("uid", uid)
            .Limit(100)
            .GetSnapshotAsync(ct);

        var entries = snapshot.Documents.Select(document => document.ToDictionary()).ToArray();
        var scores = entries
            .Where(entry => entry.TryGetValue("assessmentScore", out var value) && value is long)
            .Select(entry => Convert.ToInt32(entry["assessmentScore"]))
            .ToArray();

        var completedLessons = entries.Sum(entry => entry.TryGetValue("completedLessons", out var val) ? Convert.ToInt32(val) : 0);
        var reportData = new Dictionary<string, object>
        {
            ["uid"] = uid,
            ["courseCount"] = entries.Length,
            ["completedLessons"] = completedLessons,
            ["averageAssessmentScore"] = scores.Length == 0 ? 0 : (int)Math.Round(scores.Average()),
            ["updatedAt"] = Timestamp.GetCurrentTimestamp()
        };

        await _db.Collection("Reports").Document(uid).SetAsync(reportData, SetOptions.MergeAll, ct);

        return new ReportSummaryRecord
        {
            Uid = uid,
            CourseCount = entries.Length,
            CompletedLessons = completedLessons,
            AverageAssessmentScore = scores.Length == 0 ? 0 : (int)Math.Round(scores.Average())
        };
    }

    public async Task<Dictionary<string, object>> GetCohortReportAsync(string cohortId, CancellationToken ct = default)
    {
        var members = await _db.Collection("Users")
            .WhereEqualTo("cohortId", cohortId)
            .Limit(500)
            .GetSnapshotAsync(ct);

        var memberIds = members.Documents.Select(document => document.Id).ToHashSet(StringComparer.Ordinal);
        var progress = await _db.Collection("Progress")
            .WhereEqualTo("cohortId", cohortId)
            .Limit(1000)
            .GetSnapshotAsync(ct);

        var records = progress.Documents.Select(document => document.ToDictionary()).ToArray();
        var scores = records
            .Where(record => record.TryGetValue("assessmentScore", out var score) && score is long)
            .Select(record => Convert.ToInt32(record["assessmentScore"]))
            .ToArray();

        return new Dictionary<string, object>
        {
            ["cohortId"] = cohortId,
            ["learnerCount"] = memberIds.Count,
            ["activeLearners"] = records.Select(record => record.GetValueOrDefault("uid") as string)
                .Where(memberId => memberId is not null && memberIds.Contains(memberId))
                .Distinct(StringComparer.Ordinal)
                .Count(),
            ["averageAssessmentScore"] = scores.Length == 0 ? 0 : (int)Math.Round(scores.Average()),
            ["courseProgressRecords"] = records.Length
        };
    }

    public async Task SaveFeedbackReportAsync(string uid, string skill, int score, string summary, IEnumerable<string> strengths, IEnumerable<string> nextSteps, CancellationToken ct = default)
    {
        await _db.Collection("Reports").Document($"{uid}_feedback_{Guid.NewGuid():N}").SetAsync(new Dictionary<string, object>
        {
            ["uid"] = uid,
            ["kind"] = "assessment-feedback",
            ["skill"] = skill,
            ["score"] = score,
            ["summary"] = summary,
            ["strengths"] = strengths.ToArray(),
            ["nextSteps"] = nextSteps.ToArray(),
            ["createdAt"] = Timestamp.GetCurrentTimestamp()
        }, cancellationToken: ct);
    }
}
