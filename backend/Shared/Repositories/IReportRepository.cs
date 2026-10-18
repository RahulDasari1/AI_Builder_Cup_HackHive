using HackHive.Shared.Models;

namespace HackHive.Shared.Repositories;

public interface IReportRepository
{
    Task<ReportSummaryRecord> GetOrCreateUserReportAsync(string uid, CancellationToken ct = default);
    Task<Dictionary<string, object>> GetCohortReportAsync(string cohortId, CancellationToken ct = default);
    Task SaveFeedbackReportAsync(string uid, string skill, int score, string summary, IEnumerable<string> strengths, IEnumerable<string> nextSteps, CancellationToken ct = default);
}
