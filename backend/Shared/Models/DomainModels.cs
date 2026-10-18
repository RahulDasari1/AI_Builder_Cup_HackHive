using Google.Cloud.Firestore;

namespace HackHive.Shared.Models;

[FirestoreData]
public class CourseRecord
{
    [FirestoreDocumentId]
    public string Id { get; set; } = string.Empty;

    [FirestoreProperty("title")]
    public string Title { get; set; } = string.Empty;

    [FirestoreProperty("description")]
    public string Description { get; set; } = string.Empty;

    [FirestoreProperty("category")]
    public string Category { get; set; } = "AI & Machine Learning";

    [FirestoreProperty("published")]
    public bool Published { get; set; } = true;

    [FirestoreProperty("durationHours")]
    public int DurationHours { get; set; } = 4;

    [FirestoreProperty("difficulty")]
    public string Difficulty { get; set; } = "Beginner";

    [FirestoreProperty("lessons")]
    public List<LessonItem> Lessons { get; set; } = [];

    [FirestoreProperty("createdAt")]
    public Timestamp CreatedAt { get; set; } = Timestamp.GetCurrentTimestamp();
}

[FirestoreData]
public class LessonItem
{
    [FirestoreProperty("id")]
    public string Id { get; set; } = string.Empty;

    [FirestoreProperty("title")]
    public string Title { get; set; } = string.Empty;

    [FirestoreProperty("detail")]
    public string Detail { get; set; } = string.Empty;

    [FirestoreProperty("durationMinutes")]
    public int DurationMinutes { get; set; } = 15;
}

[FirestoreData]
public class UserProfileRecord
{
    [FirestoreDocumentId]
    public string Uid { get; set; } = string.Empty;

    [FirestoreProperty("email")]
    public string? Email { get; set; }

    [FirestoreProperty("displayName")]
    public string? DisplayName { get; set; }

    [FirestoreProperty("role")]
    public string Role { get; set; } = "student";

    [FirestoreProperty("cohortId")]
    public string? CohortId { get; set; } = "cohort-2026-japac";

    [FirestoreProperty("managedCohorts")]
    public List<string> ManagedCohorts { get; set; } = [];

    [FirestoreProperty("createdAt")]
    public Timestamp CreatedAt { get; set; } = Timestamp.GetCurrentTimestamp();

    [FirestoreProperty("updatedAt")]
    public Timestamp UpdatedAt { get; set; } = Timestamp.GetCurrentTimestamp();
}

[FirestoreData]
public class ProgressRecord
{
    [FirestoreDocumentId]
    public string Id { get; set; } = string.Empty;

    [FirestoreProperty("uid")]
    public string Uid { get; set; } = string.Empty;

    [FirestoreProperty("courseId")]
    public string CourseId { get; set; } = string.Empty;

    [FirestoreProperty("completedLessonIds")]
    public List<string> CompletedLessonIds { get; set; } = [];

    [FirestoreProperty("completedLessons")]
    public long CompletedLessons { get; set; } = 0;

    [FirestoreProperty("assessmentScore")]
    public long AssessmentScore { get; set; } = 0;

    [FirestoreProperty("cohortId")]
    public string? CohortId { get; set; }

    [FirestoreProperty("updatedAt")]
    public Timestamp UpdatedAt { get; set; } = Timestamp.GetCurrentTimestamp();
}

[FirestoreData]
public class AssessmentRecord
{
    [FirestoreDocumentId]
    public string Id { get; set; } = string.Empty;

    [FirestoreProperty("uid")]
    public string Uid { get; set; } = string.Empty;

    [FirestoreProperty("courseId")]
    public string CourseId { get; set; } = string.Empty;

    [FirestoreProperty("topic")]
    public string Topic { get; set; } = string.Empty;

    [FirestoreProperty("questions")]
    public List<Dictionary<string, object>> Questions { get; set; } = [];

    [FirestoreProperty("answerKey")]
    public List<long> AnswerKey { get; set; } = [];

    [FirestoreProperty("explanations")]
    public List<string> Explanations { get; set; } = [];

    [FirestoreProperty("score")]
    public long? Score { get; set; }

    [FirestoreProperty("createdAt")]
    public Timestamp CreatedAt { get; set; } = Timestamp.GetCurrentTimestamp();

    [FirestoreProperty("submittedAt")]
    public Timestamp? SubmittedAt { get; set; }
}

[FirestoreData]
public class ReportSummaryRecord
{
    [FirestoreDocumentId]
    public string Uid { get; set; } = string.Empty;

    [FirestoreProperty("courseCount")]
    public int CourseCount { get; set; }

    [FirestoreProperty("completedLessons")]
    public int CompletedLessons { get; set; }

    [FirestoreProperty("averageAssessmentScore")]
    public int AverageAssessmentScore { get; set; }

    [FirestoreProperty("updatedAt")]
    public Timestamp UpdatedAt { get; set; } = Timestamp.GetCurrentTimestamp();
}
