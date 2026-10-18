namespace HackHive.Shared.Services;

public record GeneratedLearningPath(string Title, string Rationale, IReadOnlyList<GeneratedLesson> Lessons);
public record GeneratedLesson(string Id, string Title, string Detail, int DurationMinutes);

public record GeneratedQuizQuestion(string Prompt, IReadOnlyList<string> Options, int CorrectOption, string Explanation);
public record GeneratedQuiz(IReadOnlyList<GeneratedQuizQuestion> Questions);

public record GeneratedFeedback(string Summary, IReadOnlyList<string> Strengths, IReadOnlyList<string> NextSteps);

public interface IGeminiAiService
{
    Task<GeneratedLearningPath> GenerateLearningPathAsync(string goal, IReadOnlyList<string> skills, int recentScore, CancellationToken ct = default);
    Task<GeneratedQuiz> CreateAdaptiveQuizAsync(string topic, string difficulty, int questionCount, int recentScore, CancellationToken ct = default);
    Task<GeneratedFeedback> GenerateFeedbackAsync(string skill, int score, CancellationToken ct = default);
}
