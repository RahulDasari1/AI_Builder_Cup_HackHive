using HackHive.Shared.Models;

namespace HackHive.Shared.Repositories;

public interface ILearningRepository
{
    Task<IReadOnlyList<CourseRecord>> GetPublishedCoursesAsync(int limit = 50, CancellationToken ct = default);
    Task<CourseRecord?> GetCourseByIdAsync(string courseId, CancellationToken ct = default);
    Task<CourseRecord> CreateOrUpdateCourseAsync(CourseRecord course, CancellationToken ct = default);
    Task<bool> DeleteCourseAsync(string courseId, CancellationToken ct = default);

    Task<IReadOnlyList<ProgressRecord>> GetUserProgressAsync(string uid, int limit = 100, CancellationToken ct = default);
    Task<ProgressRecord?> GetCourseProgressAsync(string uid, string courseId, CancellationToken ct = default);
    Task<bool> RecordLessonCompletionAsync(string uid, string courseId, string lessonId, CancellationToken ct = default);

    Task<Dictionary<string, object>?> GetLearningPathAsync(string uid, string courseId, CancellationToken ct = default);
    Task SaveLearningPathAsync(string uid, string courseId, Dictionary<string, object> pathData, CancellationToken ct = default);
}
