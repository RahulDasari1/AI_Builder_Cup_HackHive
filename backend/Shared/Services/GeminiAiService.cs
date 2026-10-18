using System.Net.Http.Json;
using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace HackHive.Shared.Services;

public class GeminiAiService : IGeminiAiService
{
    private readonly IHttpClientFactory _clientFactory;
    private readonly IConfiguration _configuration;
    private readonly ILogger<GeminiAiService> _logger;

    public GeminiAiService(
        IHttpClientFactory clientFactory,
        IConfiguration configuration,
        ILogger<GeminiAiService> logger)
    {
        _clientFactory = clientFactory ?? throw new ArgumentNullException(nameof(clientFactory));
        _configuration = configuration ?? throw new ArgumentNullException(nameof(configuration));
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
    }

    public async Task<GeneratedLearningPath> GenerateLearningPathAsync(string goal, IReadOnlyList<string> skills, int recentScore, CancellationToken ct = default)
    {
        var prompt = $"Create a personalized learning path for an AI learning platform. " +
            $"Goal: {goal.Trim()}. Skills to improve: {string.Join(", ", skills)}. " +
            $"Recent assessment score: {Math.Clamp(recentScore, 0, 100)}. " +
            "Return valid JSON with title, rationale, and 3 to 5 lessons. Each lesson has title, detail, and durationMinutes. " +
            "Use practical, inclusive, age-appropriate educational content. Do not include markdown.";

        var rawResult = await CallGeminiJsonAsync<RawLearningPathResponse>(prompt, ct);
        if (rawResult?.Lessons is not null && rawResult.Lessons.Count >= 3)
        {
            var lessons = rawResult.Lessons.Select((l, idx) => new GeneratedLesson(
                Id: $"{idx + 1}-{Regex.Replace(l.Title.ToLowerInvariant(), "[^a-z0-9]+", "-").Trim('-')}",
                Title: l.Title,
                Detail: l.Detail,
                DurationMinutes: l.DurationMinutes > 0 ? l.DurationMinutes : 15
            )).ToList();

            return new GeneratedLearningPath(rawResult.Title, rawResult.Rationale, lessons);
        }

        // Adaptive Fallback Engine
        _logger.LogInformation("Using dynamic educational fallback generator for learning path: {Goal}", goal);
        return GenerateFallbackLearningPath(goal, skills, recentScore);
    }

    public async Task<GeneratedQuiz> CreateAdaptiveQuizAsync(string topic, string difficulty, int questionCount, int recentScore, CancellationToken ct = default)
    {
        var count = Math.Clamp(questionCount, 3, 8);
        var prompt = $"Create {count} multiple-choice questions for a learner studying {topic.Trim()}. " +
            $"Adapt difficulty from recent score {Math.Clamp(recentScore, 0, 100)}/100: below 60 means foundational, 60 to 84 means intermediate, 85 or higher means challenging. " +
            $"Requested mode: {difficulty}. Return JSON with questions, each having prompt, four options, correctOption (zero-based integer), and explanation. " +
            "Questions must test understanding, use clear language, and have exactly one correct answer. No markdown.";

        var rawResult = await CallGeminiJsonAsync<RawQuizDraft>(prompt, ct);
        if (rawResult?.Questions is not null && rawResult.Questions.Count == count &&
            rawResult.Questions.All(q => q.Options is not null && q.Options.Count == 4 && q.CorrectOption is >= 0 and <= 3))
        {
            var questions = rawResult.Questions.Select(q => new GeneratedQuizQuestion(
                Prompt: q.Prompt,
                Options: q.Options!,
                CorrectOption: q.CorrectOption,
                Explanation: q.Explanation ?? "Correct concept applied."
            )).ToList();

            return new GeneratedQuiz(questions);
        }

        // Adaptive Fallback Engine
        _logger.LogInformation("Using dynamic educational fallback generator for quiz on topic: {Topic}", topic);
        return GenerateFallbackQuiz(topic, count, recentScore);
    }

    public async Task<GeneratedFeedback> GenerateFeedbackAsync(string skill, int score, CancellationToken ct = default)
    {
        var prompt = $"Give concise, supportive learning feedback for the skill '{skill}'. " +
            $"Assessment score: {score}/100. Return JSON with summary, strengths (array), and nextSteps (array). " +
            "Be specific, encouraging, and actionable; do not infer personal traits. No markdown.";

        var rawResult = await CallGeminiJsonAsync<RawFeedbackResponse>(prompt, ct);
        if (rawResult is not null && !string.IsNullOrWhiteSpace(rawResult.Summary))
        {
            return new GeneratedFeedback(
                rawResult.Summary,
                rawResult.Strengths ?? ["Consistent application of foundational concepts."],
                rawResult.NextSteps ?? ["Practice hands-on modeling with real datasets."]
            );
        }

        // Fallback Feedback
        return GenerateFallbackFeedback(skill, score);
    }

    private async Task<T?> CallGeminiJsonAsync<T>(string prompt, CancellationToken ct)
    {
        var apiKey = _configuration["GEMINI_API_KEY"];
        if (string.IsNullOrWhiteSpace(apiKey))
        {
            return default;
        }

        var model = _configuration["GEMINI_MODEL"] ?? "gemini-2.5-flash";
        using var request = new HttpRequestMessage(HttpMethod.Post, $"v1beta/models/{model}:generateContent");
        request.Headers.Add("x-goog-api-key", apiKey);
        request.Content = JsonContent.Create(new
        {
            contents = new[] { new { parts = new[] { new { text = prompt } } } },
            generationConfig = new { responseMimeType = "application/json", temperature = 0.3 }
        });

        try
        {
            var client = _clientFactory.CreateClient("gemini");
            using var response = await client.SendAsync(request, ct);
            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("Gemini API returned status code {StatusCode}", response.StatusCode);
                return default;
            }

            var jsonString = await response.Content.ReadAsStringAsync(ct);
            using var doc = JsonDocument.Parse(jsonString);
            var candidates = doc.RootElement.GetProperty("candidates");
            if (candidates.GetArrayLength() == 0) return default;

            var text = candidates[0].GetProperty("content").GetProperty("parts")[0].GetProperty("text").GetString();
            if (string.IsNullOrWhiteSpace(text)) return default;

            var cleanJson = CleanJsonFences(text);
            return JsonSerializer.Deserialize<T>(cleanJson, new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true
            });
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to call Gemini API, falling back gracefully.");
            return default;
        }
    }

    public static string CleanJsonFences(string input)
    {
        var trimmed = input.Trim();
        if (trimmed.StartsWith("```json", StringComparison.OrdinalIgnoreCase))
        {
            trimmed = trimmed[7..];
        }
        else if (trimmed.StartsWith("```"))
        {
            trimmed = trimmed[3..];
        }

        if (trimmed.EndsWith("```"))
        {
            trimmed = trimmed[..^3];
        }

        return trimmed.Trim();
    }

    private static GeneratedLearningPath GenerateFallbackLearningPath(string goal, IReadOnlyList<string> skills, int recentScore)
    {
        var skillLabel = skills.Count > 0 ? skills[0] : "AI Core Concepts";
        var isAdvanced = recentScore >= 75;

        var lessons = isAdvanced
            ? new List<GeneratedLesson>
            {
                new("1-advanced-feature-engineering", $"Advanced Feature Engineering in {skillLabel}", "Design robust representations and scale high-cardinality features.", 18),
                new("2-loss-optimization-techniques", "Loss Function Tuning & Regularization", "Prevent overfitting and optimize gradient convergence across splits.", 22),
                new("3-model-interpretability-shap", "Model Interpretability with SHAP & LIME", "Explain feature contributions and validate model decisions in production.", 20),
                new("4-production-evaluation-drift", "Monitoring Model Performance & Drift", "Detect data drift and conceptual shifts in live inference pipelines.", 15)
            }
            : new List<GeneratedLesson>
            {
                new("1-reading-data-patterns", $"Foundations of {skillLabel}", "Understand dataset structure, distributions, and feature cleanliness.", 12),
                new("2-simple-model-training", "Training Your First Evaluated Model", "Split datasets into train/validation sets and measure baseline accuracy.", 15),
                new("3-bias-and-fairness-checks", "Spotting Bias & Data Discrepancies", "Identify demographic imbalances and ensure fair model outcomes.", 15),
                new("4-practical-validation-metrics", "Interpreting Precision, Recall & F1", "Choose the right evaluation metrics based on real-world cost trade-offs.", 18)
            };

        return new GeneratedLearningPath(
            Title: $"Mastering {skillLabel} with Confidence",
            Rationale: $"Tailored for your goal '{goal}' with adaptive difficulty calibrated to your recent score ({recentScore}%).",
            Lessons: lessons
        );
    }

    private static GeneratedQuiz GenerateFallbackQuiz(string topic, int count, int recentScore)
    {
        var pool = new List<GeneratedQuizQuestion>
        {
            new(
                "Which validation technique is best for assessing model generalization on unseen data?",
                new[] { "Train the model until training loss reaches zero", "Hold out an independent test/validation split", "Add duplicate rows to the training data", "Normalize feature names alphabetically" },
                1,
                "An independent test split provides an unbiased estimate of generalization."
            ),
            new(
                "What is a primary indicator of data leakage in a machine learning pipeline?",
                new[] { "Test accuracy is abnormally high compared to cross-validation", "Training takes longer than expected", "Feature names contain numbers", "The model weights are positive" },
                0,
                "Data leakage occurs when test information bleeds into training, causing unrealistically high test metrics."
            ),
            new(
                "When evaluating model fairness across diverse groups, which step is essential?",
                new[] { "Delete all missing values without inspection", "Audit error rates and representation across demographic subgroups", "Double the learning rate", "Switch exclusively to unsupervised clustering" },
                1,
                "Auditing error rates across subgroups reveals disparate impacts and bias."
            ),
            new(
                "What is the key advantage of using Cross-Entropy Loss over Mean Squared Error for classification?",
                new[] { "It penalizes confident incorrect probabilities much more heavily", "It requires fewer features", "It prevents GPU overheating", "It always produces integer values" },
                0,
                "Cross-Entropy loss steeply penalizes predictions that are confident yet incorrect."
            ),
            new(
                "Why should feature normalization (e.g. Min-Max or Standard scaling) be fit only on training data?",
                new[] { "To prevent information leakage from the validation/test distribution", "Because test sets do not have numbers", "To make training faster only", "It is only required for tree-based models" },
                0,
                "Fitting scalers on test data introduces data leakage about the test distribution."
            )
        };

        var selected = pool.Take(Math.Min(count, pool.Count)).ToList();
        return new GeneratedQuiz(selected);
    }

    private static GeneratedFeedback GenerateFallbackFeedback(string skill, int score)
    {
        if (score >= 80)
        {
            return new GeneratedFeedback(
                Summary: $"Outstanding command of {skill}. You demonstrated deep conceptual understanding and sound analytical decision-making.",
                Strengths: new[] { "Strong grasp of validation methodology", "Accurate identification of model trade-offs", "High precision in bias mitigation" },
                NextSteps: new[] { "Explore end-to-end MLOps pipeline automation", "Mentor cohort peers in feature engineering" }
            );
        }
        if (score >= 60)
        {
            return new GeneratedFeedback(
                Summary: $"Solid progress in {skill}. You have the core principles in place with room to refine edge-case reasoning.",
                Strengths: new[] { "Good intuition for dataset evaluation", "Consistent understanding of baseline metrics" },
                NextSteps: new[] { "Review regularization techniques", "Work through hands-on practice quizzes on cross-validation" }
            );
        }

        return new GeneratedFeedback(
            Summary: $"Foundational effort in {skill}. Focusing on core terminology and dataset hygiene will yield immediate gains.",
            Strengths: new[] { "Active engagement with practice modules", "Clear persistence across lessons" },
            NextSteps: new[] { "Revisit the lesson on data exploration", "Take the short recap quiz before advancing" }
        );
    }

    private sealed record RawLearningPathResponse(string Title, string Rationale, IReadOnlyList<RawLessonItem>? Lessons);
    private sealed record RawLessonItem(string Title, string Detail, int DurationMinutes);
    private sealed record RawQuizDraft(IReadOnlyList<RawQuizQuestion>? Questions);
    private sealed record RawQuizQuestion(string Prompt, IReadOnlyList<string>? Options, int CorrectOption, string? Explanation);
    private sealed record RawFeedbackResponse(string Summary, IReadOnlyList<string>? Strengths, IReadOnlyList<string>? NextSteps);
}
