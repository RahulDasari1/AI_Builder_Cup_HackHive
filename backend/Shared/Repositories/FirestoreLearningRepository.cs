using Google.Cloud.Firestore;
using HackHive.Shared.Models;

namespace HackHive.Shared.Repositories;

public class FirestoreLearningRepository : ILearningRepository
{
    private readonly FirestoreDb _db;

    public FirestoreLearningRepository(FirestoreDb db)
    {
        _db = db ?? throw new ArgumentNullException(nameof(db));
    }

    public async Task<IReadOnlyList<CourseRecord>> GetPublishedCoursesAsync(int limit = 50, CancellationToken ct = default)
    {
        var snapshot = await _db.Collection("Courses")
            .WhereEqualTo("published", true)
            .Limit(limit)
            .GetSnapshotAsync(ct);

        return snapshot.Documents.Select(d =>
        {
            var data = d.ToDictionary();
            return new CourseRecord
            {
                Id = d.Id,
                Title = data.TryGetValue("title", out var t) ? t?.ToString() ?? string.Empty : string.Empty,
                Description = data.TryGetValue("description", out var desc) ? desc?.ToString() ?? string.Empty : string.Empty,
                Category = data.TryGetValue("category", out var cat) ? cat?.ToString() ?? "AI & Machine Learning" : "AI & Machine Learning",
                Published = !data.TryGetValue("published", out var p) || (p is bool b && b),
                DurationHours = data.TryGetValue("durationHours", out var dur) ? Convert.ToInt32(dur) : 4,
                Difficulty = data.TryGetValue("difficulty", out var diff) ? diff?.ToString() ?? "Beginner" : "Beginner"
            };
        }).ToList();
    }

    public async Task<CourseRecord?> GetCourseByIdAsync(string courseId, CancellationToken ct = default)
    {
        var doc = await _db.Collection("Courses").Document(courseId).GetSnapshotAsync(ct);
        if (!doc.Exists) return null;

        var data = doc.ToDictionary();
        return new CourseRecord
        {
            Id = doc.Id,
            Title = data.TryGetValue("title", out var t) ? t?.ToString() ?? string.Empty : string.Empty,
            Description = data.TryGetValue("description", out var desc) ? desc?.ToString() ?? string.Empty : string.Empty,
            Category = data.TryGetValue("category", out var cat) ? cat?.ToString() ?? "AI & Machine Learning" : "AI & Machine Learning",
            Published = !data.TryGetValue("published", out var p) || (p is bool b && b),
            DurationHours = data.TryGetValue("durationHours", out var dur) ? Convert.ToInt32(dur) : 4,
            Difficulty = data.TryGetValue("difficulty", out var diff) ? diff?.ToString() ?? "Beginner" : "Beginner"
        };
    }

    public async Task<CourseRecord> CreateOrUpdateCourseAsync(CourseRecord course, CancellationToken ct = default)
    {
        var docId = string.IsNullOrWhiteSpace(course.Id) ? Guid.NewGuid().ToString("N") : course.Id;
        var docRef = _db.Collection("Courses").Document(docId);
        var data = new Dictionary<string, object>
        {
            ["title"] = course.Title,
            ["description"] = course.Description,
            ["category"] = course.Category,
            ["published"] = course.Published,
            ["durationHours"] = course.DurationHours,
            ["difficulty"] = course.Difficulty,
            ["updatedAt"] = Timestamp.GetCurrentTimestamp()
        };
        await docRef.SetAsync(data, SetOptions.MergeAll, ct);
        course.Id = docId;
        return course;
    }

    public async Task<bool> DeleteCourseAsync(string courseId, CancellationToken ct = default)
    {
        var docRef = _db.Collection("Courses").Document(courseId);
        var doc = await docRef.GetSnapshotAsync(ct);
        if (!doc.Exists) return false;
        await docRef.DeleteAsync(cancellationToken: ct);
        return true;
    }

    public async Task<IReadOnlyList<ProgressRecord>> GetUserProgressAsync(string uid, int limit = 100, CancellationToken ct = default)
    {
        var snapshot = await _db.Collection("Progress")
            .WhereEqualTo("uid", uid)
            .Limit(limit)
            .GetSnapshotAsync(ct);

        return snapshot.Documents.Select(d =>
        {
            var data = d.ToDictionary();
            return new ProgressRecord
            {
                Id = d.Id,
                Uid = uid,
                CourseId = data.TryGetValue("courseId", out var c) ? c?.ToString() ?? string.Empty : string.Empty,
                CompletedLessons = data.TryGetValue("completedLessons", out var cl) ? Convert.ToInt64(cl) : 0,
                AssessmentScore = data.TryGetValue("assessmentScore", out var sc) ? Convert.ToInt64(sc) : 0,
                CohortId = data.TryGetValue("cohortId", out var co) ? co?.ToString() : null
            };
        }).ToList();
    }

    public async Task<ProgressRecord?> GetCourseProgressAsync(string uid, string courseId, CancellationToken ct = default)
    {
        var doc = await _db.Collection("Progress").Document($"{uid}_{courseId}").GetSnapshotAsync(ct);
        if (!doc.Exists) return null;
        var data = doc.ToDictionary();
        return new ProgressRecord
        {
            Id = doc.Id,
            Uid = uid,
            CourseId = courseId,
            CompletedLessons = data.TryGetValue("completedLessons", out var cl) ? Convert.ToInt64(cl) : 0,
            AssessmentScore = data.TryGetValue("assessmentScore", out var sc) ? Convert.ToInt64(sc) : 0,
            CohortId = data.TryGetValue("cohortId", out var co) ? co?.ToString() : null
        };
    }

    public async Task<bool> RecordLessonCompletionAsync(string uid, string courseId, string lessonId, CancellationToken ct = default)
    {
        var progressRef = _db.Collection("Progress").Document($"{uid}_{courseId}");
        var userProfile = await _db.Collection("Users").Document(uid).GetSnapshotAsync(ct);

        await _db.RunTransactionAsync(async transaction =>
        {
            var existingProgress = await transaction.GetSnapshotAsync(progressRef, ct);
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
        }, cancellationToken: ct);

        return true;
    }

    public async Task<Dictionary<string, object>?> GetLearningPathAsync(string uid, string courseId, CancellationToken ct = default)
    {
        var path = await _db.Collection("LearningPaths").Document($"{uid}_{courseId}").GetSnapshotAsync(ct);
        if (!path.Exists) return null;
        return path.ToDictionary();
    }

    public async Task SaveLearningPathAsync(string uid, string courseId, Dictionary<string, object> pathData, CancellationToken ct = default)
    {
        var pathRef = _db.Collection("LearningPaths").Document($"{uid}_{courseId}");
        await pathRef.SetAsync(pathData, SetOptions.MergeAll, ct);
    }
}
