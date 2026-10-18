using System.Net.Http.Json;
using System.Text.RegularExpressions;
using System.Text.Json;
using Google.Cloud.Firestore;
using HackHive.Platform;

var builder = WebApplication.CreateBuilder(args).AddHackHivePlatform();
builder.Services.AddHttpClient("gemini", client =>
    client.BaseAddress = new Uri("https://generativelanguage.googleapis.com/"));
var app = builder.Build().UseHackHivePlatform();

app.MapGet("/api/ai/learning-paths/me", async (
    System.Security.Claims.ClaimsPrincipal user,
    FirestoreDb db) =>
{
    var uid = user.RequireUserId();
    var path = await db.Collection("LearningPaths").Document($"{uid}_ai-foundations").GetSnapshotAsync();
    if (!path.Exists)
    {
        return Results.NoContent();
    }
    return Results.Ok(new
    {
        title = path.GetValue<string>("title"),
        rationale = path.GetValue<string>("rationale"),
        lessons = path.GetValue<List<Dictionary<string, object>>>("lessons")
    });
}).RequireAuthorization();

app.MapPost("/api/ai/learning-path", async (
    LearningPathRequest request,
    System.Security.Claims.ClaimsPrincipal user,
    IHttpClientFactory clients,
    IConfiguration configuration,
    FirestoreDb db) =>
{
    if (string.IsNullOrWhiteSpace(request.Goal) || request.Goal.Length > 300 || request.Skills is null ||
        request.Skills.Count > 12 || request.Skills.Any(skill => string.IsNullOrWhiteSpace(skill) || skill.Length > 60))
    {
        return Results.ValidationProblem(new Dictionary<string, string[]>
        {
            ["request"] = ["Provide a goal up to 300 characters and at most 12 short skills."]
        });
    }

    var prompt = $"Create a personalized learning path for an AI learning platform. " +
        $"Goal: {request.Goal.Trim()}. Skills to improve: {string.Join(", ", request.Skills)}. " +
        $"Recent assessment score: {Math.Clamp(request.RecentScore, 0, 100)}. " +
        "Return valid JSON with title, rationale, and 3 to 5 lessons. Each lesson has title, detail, and durationMinutes. " +
        "Use practical, inclusive, age-appropriate educational content. Do not include markdown.";
    var result = await GenerateJsonAsync<LearningPathResponse>(clients, configuration, prompt);
    if (result is null)
    {
        return Results.Problem("The learning path could not be generated.", statusCode: StatusCodes.Status502BadGateway);
    }

    var lessons = result.Lessons.Select((lesson, index) => lesson with
    {
        Id = $"{index + 1}-{Regex.Replace(lesson.Title.ToLowerInvariant(), "[^a-z0-9]+", "-").Trim('-')}"
    }).ToArray();
    var personalizedPath = result with { Lessons = lessons };
    var uid = user.RequireUserId();
    await db.Collection("LearningPaths").Document($"{uid}_ai-foundations").SetAsync(new Dictionary<string, object>
    {
        ["uid"] = uid,
        ["courseId"] = "ai-foundations",
        ["lessonIds"] = lessons.Select(lesson => lesson.Id).ToArray(),
        ["lessons"] = lessons.Select(lesson => new Dictionary<string, object>
        {
            ["id"] = lesson.Id,
            ["title"] = lesson.Title,
            ["detail"] = lesson.Detail,
            ["durationMinutes"] = (long)lesson.DurationMinutes
        }).ToArray(),
        ["title"] = personalizedPath.Title,
        ["rationale"] = personalizedPath.Rationale,
        ["createdAt"] = Timestamp.GetCurrentTimestamp()
    });
    return Results.Ok(personalizedPath);
}).RequireAuthorization().RequireRateLimiting("ai");

app.MapPost("/api/ai/quizzes", async (
    QuizRequest request,
    System.Security.Claims.ClaimsPrincipal user,
    IHttpClientFactory clients,
    IConfiguration configuration,
    FirestoreDb db) =>
{
    if (string.IsNullOrWhiteSpace(request.Topic) || request.Topic.Length > 160 || request.QuestionCount is < 3 or > 8 ||
        !Regex.IsMatch(request.CourseId, "^[a-zA-Z0-9_-]{1,80}$"))
    {
        return Results.ValidationProblem(new Dictionary<string, string[]>
        {
            ["request"] = ["Provide a topic up to 160 characters and request 3 to 8 questions."]
        });
    }

    var prompt = $"Create {request.QuestionCount} multiple-choice questions for a learner studying {request.Topic.Trim()}. " +
        $"Adapt difficulty from recent score {Math.Clamp(request.RecentScore, 0, 100)}/100: below 60 means foundational, 60 to 84 means intermediate, 85 or higher means challenging. " +
        $"Requested mode: {request.Difficulty}. Return JSON with questions, each having prompt, four options, correctOption (zero-based), and explanation. " +
        "Questions must test understanding, use clear language, and have exactly one correct answer. No markdown.";
    var draft = await GenerateJsonAsync<QuizDraft>(clients, configuration, prompt);
    if (draft?.Questions is null || draft.Questions.Count != request.QuestionCount ||
        draft.Questions.Any(question => question.Options is null || question.Options.Count != 4 || question.CorrectOption is < 0 or > 3))
    {
        return Results.Problem("A valid quiz could not be generated.", statusCode: StatusCodes.Status502BadGateway);
    }

    var uid = user.RequireUserId();
    var questionData = draft.Questions.Select(question => new Dictionary<string, object>
    {
        ["prompt"] = question.Prompt,
        ["options"] = question.Options!.ToArray()
    }).ToArray();
    var answerKey = draft.Questions.Select(question => (long)question.CorrectOption).ToArray();
    var assessment = await db.Collection("Assessments").AddAsync(new Dictionary<string, object>
    {
        ["uid"] = uid,
        ["courseId"] = request.CourseId,
        ["topic"] = request.Topic.Trim(),
        ["questions"] = questionData,
        ["answerKey"] = answerKey,
        ["explanations"] = draft.Questions.Select(question => question.Explanation).ToArray(),
        ["createdAt"] = Timestamp.GetCurrentTimestamp()
    });

    return Results.Ok(new
    {
        quizId = assessment.Id,
        topic = request.Topic.Trim(),
        questions = draft.Questions.Select((question, index) => new
        {
            id = index,
            question.Prompt,
            options = question.Options!
        })
    });
}).RequireAuthorization().RequireRateLimiting("ai");

app.MapPost("/api/ai/quizzes/{quizId}/submit", async (
    string quizId,
    QuizSubmission request,
    System.Security.Claims.ClaimsPrincipal user,
    FirestoreDb db) =>
{
    var assessmentRef = db.Collection("Assessments").Document(quizId);
    var assessment = await assessmentRef.GetSnapshotAsync();
    if (!assessment.Exists || assessment.GetValue<string>("uid") != user.RequireUserId())
    {
        return Results.NotFound();
    }
    if (assessment.ContainsField("submittedAt"))
    {
        return Results.Conflict("This assessment has already been submitted.");
    }

    var answerKey = assessment.GetValue<List<long>>("answerKey");
    if (request.Answers is null || request.Answers.Length != answerKey.Count || request.Answers.Any(answer => answer is < 0 or > 3))
    {
        return Results.ValidationProblem(new Dictionary<string, string[]>
        {
            ["answers"] = ["Submit one valid option for each question."]
        });
    }

    var correct = request.Answers.Select((answer, index) => answer == answerKey[index]).ToArray();
    var score = (int)Math.Round(correct.Count(value => value) * 100d / correct.Length);
    await assessmentRef.UpdateAsync(new Dictionary<string, object>
    {
        ["score"] = score,
        ["submittedAt"] = Timestamp.GetCurrentTimestamp()
    });
    var courseId = assessment.GetValue<string>("courseId");
    var uid = user.RequireUserId();
    var progressRef = db.Collection("Progress").Document($"{uid}_{courseId}");
    var previousProgress = await progressRef.GetSnapshotAsync();
    var progressUpdate = new Dictionary<string, object>
    {
        ["uid"] = uid,
        ["courseId"] = courseId,
        ["completedLessonIds"] = previousProgress.Exists && previousProgress.ContainsField("completedLessonIds")
            ? previousProgress.GetValue<List<string>>("completedLessonIds")
            : Array.Empty<string>(),
        ["completedLessons"] = previousProgress.Exists && previousProgress.ContainsField("completedLessonIds")
            ? previousProgress.GetValue<List<string>>("completedLessonIds").Count
            : 0L,
        ["assessmentScore"] = (long)score,
        ["updatedAt"] = Timestamp.GetCurrentTimestamp()
    };
    var userProfile = await db.Collection("Users").Document(uid).GetSnapshotAsync();
    if (userProfile.Exists && userProfile.TryGetValue<string>("cohortId", out var cohortId))
    {
        progressUpdate["cohortId"] = cohortId;
    }
    await progressRef.SetAsync(progressUpdate, SetOptions.MergeAll);
    return Results.Ok(new { score, correct, explanations = assessment.GetValue<List<string>>("explanations") });
}).RequireAuthorization().RequireRateLimiting("ai");

app.MapPost("/api/ai/feedback", async (
    FeedbackRequest request,
    System.Security.Claims.ClaimsPrincipal user,
    IHttpClientFactory clients,
    IConfiguration configuration,
    FirestoreDb db) =>
{
    if (string.IsNullOrWhiteSpace(request.Skill) || request.Skill.Length > 100 || string.IsNullOrWhiteSpace(request.QuizId))
    {
        return Results.ValidationProblem(new Dictionary<string, string[]>
        {
            ["request"] = ["Provide a skill name and a submitted quiz ID."]
        });
    }

    var assessment = await db.Collection("Assessments").Document(request.QuizId).GetSnapshotAsync();
    if (!assessment.Exists || assessment.GetValue<string>("uid") != user.RequireUserId() || !assessment.ContainsField("score"))
    {
        return Results.NotFound();
    }
    var score = (int)assessment.GetValue<long>("score");

    var prompt = $"Give concise, supportive learning feedback for the skill '{request.Skill}'. " +
        $"Assessment score: {score}/100. Return JSON with summary, strengths (array), and nextSteps (array). " +
        "Be specific, encouraging, and actionable; do not infer personal traits. No markdown.";
    var feedback = await GenerateJsonAsync<FeedbackResponse>(clients, configuration, prompt);
    if (feedback is null)
    {
        return Results.Problem("Feedback could not be generated.", statusCode: StatusCodes.Status502BadGateway);
    }

    var uid = user.RequireUserId();
    await db.Collection("Reports").Document($"{uid}_feedback_{Guid.NewGuid():N}").SetAsync(new Dictionary<string, object>
    {
        ["uid"] = uid,
        ["kind"] = "assessment-feedback",
        ["skill"] = request.Skill,
        ["score"] = score,
        ["summary"] = feedback.Summary,
        ["strengths"] = feedback.Strengths.ToArray(),
        ["nextSteps"] = feedback.NextSteps.ToArray(),
        ["createdAt"] = Timestamp.GetCurrentTimestamp()
    });
    return Results.Ok(feedback);
}).RequireAuthorization().RequireRateLimiting("ai");

app.Run();

static async Task<T?> GenerateJsonAsync<T>(IHttpClientFactory clients, IConfiguration configuration, string prompt)
{
    var apiKey = configuration["GEMINI_API_KEY"];
    if (string.IsNullOrWhiteSpace(apiKey))
    {
        return default;
    }

    var model = configuration["GEMINI_MODEL"] ?? "gemini-2.5-flash";
    using var request = new HttpRequestMessage(HttpMethod.Post, $"v1beta/models/{model}:generateContent");
    request.Headers.Add("x-goog-api-key", apiKey);
    request.Content = JsonContent.Create(new
    {
        contents = new[] { new { parts = new[] { new { text = prompt } } } },
        generationConfig = new { responseMimeType = "application/json", temperature = 0.3 }
    });

    try
    {
        using var response = await clients.CreateClient("gemini").SendAsync(request);
        if (!response.IsSuccessStatusCode)
        {
            return default;
        }
        using var payload = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        var text = payload.RootElement.GetProperty("candidates")[0]
            .GetProperty("content").GetProperty("parts")[0].GetProperty("text").GetString();
        return text is null
            ? default
            : JsonSerializer.Deserialize<T>(text, new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
    }
    catch (Exception exception) when (exception is HttpRequestException or JsonException or KeyNotFoundException or IndexOutOfRangeException)
    {
        return default;
    }
}

public sealed record LearningPathRequest(string Goal, IReadOnlyList<string>? Skills, int RecentScore);
public sealed record LearningPathResponse(string Title, string Rationale, IReadOnlyList<LearningLesson> Lessons);
public sealed record LearningLesson(string Id, string Title, string Detail, int DurationMinutes);
public sealed record QuizRequest(string Topic, string Difficulty, int QuestionCount = 5, string CourseId = "ai-foundations", int RecentScore = 0);
public sealed record QuizDraft(IReadOnlyList<QuizQuestion>? Questions);
public sealed record QuizQuestion(string Prompt, IReadOnlyList<string>? Options, int CorrectOption, string Explanation);
public sealed record QuizSubmission(int[] Answers);
public sealed record FeedbackRequest(string Skill, string QuizId);
public sealed record FeedbackResponse(string Summary, IReadOnlyList<string> Strengths, IReadOnlyList<string> NextSteps);