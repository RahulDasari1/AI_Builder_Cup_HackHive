using System.Text.RegularExpressions;
using Google.Cloud.Firestore;
using HackHive.Platform;
using HackHive.Shared.Repositories;
using HackHive.Shared.Services;

var builder = WebApplication.CreateBuilder(args).AddHackHivePlatform();
var app = builder.Build().UseHackHivePlatform();

// Retrieve personal learning path
app.MapGet("/api/ai/learning-paths/me", async (
    System.Security.Claims.ClaimsPrincipal user,
    ILearningRepository learningRepo,
    CancellationToken ct) =>
{
    var uid = user.RequireUserId();
    var path = await learningRepo.GetLearningPathAsync(uid, "ai-foundations", ct);
    if (path is null)
    {
        return Results.NoContent();
    }
    return Results.Ok(new
    {
        title = path.TryGetValue("title", out var t) ? t?.ToString() : "Personalized AI Path",
        rationale = path.TryGetValue("rationale", out var r) ? r?.ToString() : "Generated based on your goals and assessment score.",
        lessons = path.TryGetValue("lessons", out var l) ? l : new List<object>()
    });
}).RequireAuthorization();

// Generate dynamic AI learning path with Gemini
app.MapPost("/api/ai/learning-path", async (
    LearningPathRequest request,
    System.Security.Claims.ClaimsPrincipal user,
    IGeminiAiService geminiService,
    ILearningRepository learningRepo,
    CancellationToken ct) =>
{
    if (string.IsNullOrWhiteSpace(request.Goal) || request.Goal.Length > 300 || request.Skills is null ||
        request.Skills.Count > 12 || request.Skills.Any(skill => string.IsNullOrWhiteSpace(skill) || skill.Length > 60))
    {
        return Results.ValidationProblem(new Dictionary<string, string[]>
        {
            ["request"] = ["Provide a goal up to 300 characters and at most 12 short skills."]
        });
    }

    var uid = user.RequireUserId();
    var generated = await geminiService.GenerateLearningPathAsync(request.Goal, request.Skills, request.RecentScore, ct);

    var pathData = new Dictionary<string, object>
    {
        ["uid"] = uid,
        ["courseId"] = "ai-foundations",
        ["lessonIds"] = generated.Lessons.Select(lesson => lesson.Id).ToArray(),
        ["lessons"] = generated.Lessons.Select(lesson => new Dictionary<string, object>
        {
            ["id"] = lesson.Id,
            ["title"] = lesson.Title,
            ["detail"] = lesson.Detail,
            ["durationMinutes"] = (long)lesson.DurationMinutes
        }).ToArray(),
        ["title"] = generated.Title,
        ["rationale"] = generated.Rationale,
        ["createdAt"] = Timestamp.GetCurrentTimestamp()
    };

    await learningRepo.SaveLearningPathAsync(uid, "ai-foundations", pathData, ct);
    return Results.Ok(generated);
}).RequireAuthorization().RequireRateLimiting("ai");

// Generate adaptive quiz with server-held private answer keys
app.MapPost("/api/ai/quizzes", async (
    QuizRequest request,
    System.Security.Claims.ClaimsPrincipal user,
    IGeminiAiService geminiService,
    IAssessmentRepository assessmentRepo,
    CancellationToken ct) =>
{
    if (string.IsNullOrWhiteSpace(request.Topic) || request.Topic.Length > 160 || request.QuestionCount is < 3 or > 8 ||
        !Regex.IsMatch(request.CourseId, "^[a-zA-Z0-9_-]{1,80}$"))
    {
        return Results.ValidationProblem(new Dictionary<string, string[]>
        {
            ["request"] = ["Provide a topic up to 160 characters and request 3 to 8 questions."]
        });
    }

    var uid = user.RequireUserId();
    var generatedQuiz = await geminiService.CreateAdaptiveQuizAsync(request.Topic, request.Difficulty, request.QuestionCount, request.RecentScore, ct);

    var questionsData = generatedQuiz.Questions.Select(q => new Dictionary<string, object>
    {
        ["prompt"] = q.Prompt,
        ["options"] = q.Options.ToArray()
    }).ToList();

    var answerKey = generatedQuiz.Questions.Select(q => (long)q.CorrectOption).ToList();
    var explanations = generatedQuiz.Questions.Select(q => q.Explanation).ToList();

    var quizId = await assessmentRepo.CreateAssessmentAsync(uid, request.CourseId, request.Topic.Trim(), questionsData, answerKey, explanations, ct);

    return Results.Ok(new
    {
        quizId,
        topic = request.Topic.Trim(),
        questions = generatedQuiz.Questions.Select((q, index) => new
        {
            id = index,
            prompt = q.Prompt,
            options = q.Options
        })
    });
}).RequireAuthorization().RequireRateLimiting("ai");

// Submit quiz answers and calculate verified score
app.MapPost("/api/ai/quizzes/{quizId}/submit", async (
    string quizId,
    QuizSubmission request,
    System.Security.Claims.ClaimsPrincipal user,
    IAssessmentRepository assessmentRepo,
    ILearningRepository learningRepo,
    FirestoreDb db,
    CancellationToken ct) =>
{
    var assessment = await assessmentRepo.GetAssessmentAsync(quizId, ct);
    if (assessment is null || assessment.Uid != user.RequireUserId())
    {
        return Results.NotFound();
    }
    if (assessment.SubmittedAt is not null)
    {
        return Results.Conflict("This assessment has already been submitted.");
    }

    if (request.Answers is null || request.Answers.Length != assessment.AnswerKey.Count || request.Answers.Any(a => a is < 0 or > 3))
    {
        return Results.ValidationProblem(new Dictionary<string, string[]>
        {
            ["answers"] = ["Submit one valid option for each question."]
        });
    }

    var correct = request.Answers.Select((a, idx) => a == assessment.AnswerKey[idx]).ToArray();
    var score = (int)Math.Round(correct.Count(v => v) * 100d / correct.Length);

    await assessmentRepo.SubmitAssessmentAsync(quizId, score, ct);

    // Save updated score to user progress
    var uid = user.RequireUserId();
    var progressRef = db.Collection("Progress").Document($"{uid}_{assessment.CourseId}");
    await progressRef.SetAsync(new Dictionary<string, object>
    {
        ["uid"] = uid,
        ["courseId"] = assessment.CourseId,
        ["assessmentScore"] = (long)score,
        ["updatedAt"] = Timestamp.GetCurrentTimestamp()
    }, SetOptions.MergeAll, ct);

    return Results.Ok(new
    {
        score,
        correct,
        explanations = assessment.Explanations
    });
}).RequireAuthorization().RequireRateLimiting("ai");

// Get personalized AI feedback for an assessment
app.MapPost("/api/ai/feedback", async (
    FeedbackRequest request,
    System.Security.Claims.ClaimsPrincipal user,
    IGeminiAiService geminiService,
    IAssessmentRepository assessmentRepo,
    IReportRepository reportRepo,
    CancellationToken ct) =>
{
    if (string.IsNullOrWhiteSpace(request.Skill) || request.Skill.Length > 100 || string.IsNullOrWhiteSpace(request.QuizId))
    {
        return Results.ValidationProblem(new Dictionary<string, string[]>
        {
            ["request"] = ["Provide a skill name and a submitted quiz ID."]
        });
    }

    var uid = user.RequireUserId();
    var assessment = await assessmentRepo.GetAssessmentAsync(request.QuizId, ct);
    if (assessment is null || assessment.Uid != uid || assessment.Score is null)
    {
        return Results.NotFound();
    }

    var score = (int)assessment.Score.Value;
    var feedback = await geminiService.GenerateFeedbackAsync(request.Skill, score, ct);

    await reportRepo.SaveFeedbackReportAsync(uid, request.Skill, score, feedback.Summary, feedback.Strengths, feedback.NextSteps, ct);
    return Results.Ok(feedback);
}).RequireAuthorization().RequireRateLimiting("ai");

app.Run();

public sealed record LearningPathRequest(string Goal, IReadOnlyList<string>? Skills, int RecentScore);
public sealed record QuizRequest(string Topic, string Difficulty, int QuestionCount = 5, string CourseId = "ai-foundations", int RecentScore = 0);
public sealed record QuizSubmission(int[] Answers);
public sealed record FeedbackRequest(string Skill, string QuizId);