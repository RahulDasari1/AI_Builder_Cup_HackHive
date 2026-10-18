using Google.Cloud.Firestore;
using HackHive.Shared.Models;

namespace HackHive.Shared.Repositories;

public class FirestoreAssessmentRepository : IAssessmentRepository
{
    private readonly FirestoreDb _db;

    public FirestoreAssessmentRepository(FirestoreDb db)
    {
        _db = db ?? throw new ArgumentNullException(nameof(db));
    }

    public async Task<string> CreateAssessmentAsync(string uid, string courseId, string topic, List<Dictionary<string, object>> questions, List<long> answerKey, List<string> explanations, CancellationToken ct = default)
    {
        var assessment = await _db.Collection("Assessments").AddAsync(new Dictionary<string, object>
        {
            ["uid"] = uid,
            ["courseId"] = courseId,
            ["topic"] = topic,
            ["questions"] = questions,
            ["answerKey"] = answerKey,
            ["explanations"] = explanations,
            ["createdAt"] = Timestamp.GetCurrentTimestamp()
        }, ct);

        return assessment.Id;
    }

    public async Task<AssessmentRecord?> GetAssessmentAsync(string assessmentId, CancellationToken ct = default)
    {
        var doc = await _db.Collection("Assessments").Document(assessmentId).GetSnapshotAsync(ct);
        if (!doc.Exists) return null;

        var data = doc.ToDictionary();
        return new AssessmentRecord
        {
            Id = doc.Id,
            Uid = data.TryGetValue("uid", out var u) ? u?.ToString() ?? string.Empty : string.Empty,
            CourseId = data.TryGetValue("courseId", out var c) ? c?.ToString() ?? string.Empty : string.Empty,
            Topic = data.TryGetValue("topic", out var t) ? t?.ToString() ?? string.Empty : string.Empty,
            Questions = doc.ContainsField("questions") ? doc.GetValue<List<Dictionary<string, object>>>("questions") : [],
            AnswerKey = doc.ContainsField("answerKey") ? doc.GetValue<List<long>>("answerKey") : [],
            Explanations = doc.ContainsField("explanations") ? doc.GetValue<List<string>>("explanations") : [],
            Score = data.TryGetValue("score", out var sc) ? Convert.ToInt64(sc) : null,
            SubmittedAt = data.TryGetValue("submittedAt", out var sub) && sub is Timestamp ts ? ts : null
        };
    }

    public async Task<bool> SubmitAssessmentAsync(string assessmentId, int score, CancellationToken ct = default)
    {
        var docRef = _db.Collection("Assessments").Document(assessmentId);
        await docRef.UpdateAsync(new Dictionary<string, object>
        {
            ["score"] = (long)score,
            ["submittedAt"] = Timestamp.GetCurrentTimestamp()
        }, cancellationToken: ct);
        return true;
    }

    public async Task<IReadOnlyList<AssessmentRecord>> GetUserAssessmentsAsync(string uid, int limit = 20, CancellationToken ct = default)
    {
        var snapshot = await _db.Collection("Assessments")
            .WhereEqualTo("uid", uid)
            .Limit(limit)
            .GetSnapshotAsync(ct);

        return snapshot.Documents.Select(doc =>
        {
            var data = doc.ToDictionary();
            return new AssessmentRecord
            {
                Id = doc.Id,
                Uid = uid,
                CourseId = data.TryGetValue("courseId", out var c) ? c?.ToString() ?? string.Empty : string.Empty,
                Topic = data.TryGetValue("topic", out var t) ? t?.ToString() ?? string.Empty : string.Empty,
                Score = data.TryGetValue("score", out var sc) ? Convert.ToInt64(sc) : null
            };
        }).ToList();
    }
}
