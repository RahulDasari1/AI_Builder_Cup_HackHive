using HackHive.Shared.Models;

namespace HackHive.Shared.Repositories;

public interface IAssessmentRepository
{
    Task<string> CreateAssessmentAsync(string uid, string courseId, string topic, List<Dictionary<string, object>> questions, List<long> answerKey, List<string> explanations, CancellationToken ct = default);
    Task<AssessmentRecord?> GetAssessmentAsync(string assessmentId, CancellationToken ct = default);
    Task<bool> SubmitAssessmentAsync(string assessmentId, int score, CancellationToken ct = default);
    Task<IReadOnlyList<AssessmentRecord>> GetUserAssessmentsAsync(string uid, int limit = 20, CancellationToken ct = default);
}
