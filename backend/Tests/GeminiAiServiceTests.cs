using HackHive.Shared.Services;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;

namespace HackHive.Tests;

public class GeminiAiServiceTests
{
    private readonly Mock<IHttpClientFactory> _mockHttpClientFactory = new();
    private readonly Mock<ILogger<GeminiAiService>> _mockLogger = new();

    private GeminiAiService CreateService(Dictionary<string, string?> configValues)
    {
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(configValues)
            .Build();

        return new GeminiAiService(_mockHttpClientFactory.Object, configuration, _mockLogger.Object);
    }

    [Theory]
    [InlineData("```json\n{\"test\": 123}\n```", "{\"test\": 123}")]
    [InlineData("```\n{\"test\": 456}\n```", "{\"test\": 456}")]
    [InlineData("  {\"test\": 789}  ", "{\"test\": 789}")]
    public void CleanJsonFences_StripsMarkdownTagsCorrectly(string input, string expected)
    {
        var result = GeminiAiService.CleanJsonFences(input);
        Assert.Equal(expected, result);
    }

    [Fact]
    public async Task GenerateLearningPathAsync_WithoutApiKey_ReturnsDynamicEducationalPath()
    {
        var service = CreateService(new Dictionary<string, string?>
        {
            ["GEMINI_API_KEY"] = ""
        });

        var result = await service.GenerateLearningPathAsync("Build real-world ML skills", ["Classification", "Feature Engineering"], 70);

        Assert.NotNull(result);
        Assert.False(string.IsNullOrWhiteSpace(result.Title));
        Assert.False(string.IsNullOrWhiteSpace(result.Rationale));
        Assert.NotEmpty(result.Lessons);
        Assert.All(result.Lessons, lesson =>
        {
            Assert.False(string.IsNullOrWhiteSpace(lesson.Id));
            Assert.False(string.IsNullOrWhiteSpace(lesson.Title));
            Assert.True(lesson.DurationMinutes > 0);
        });
    }

    [Theory]
    [InlineData(40, 4)]
    [InlineData(85, 4)]
    public async Task GenerateLearningPathAsync_AdaptsToLearnerScore(int score, int expectedLessonCount)
    {
        var service = CreateService(new Dictionary<string, string?>
        {
            ["GEMINI_API_KEY"] = ""
        });

        var result = await service.GenerateLearningPathAsync("Deep Learning Basics", ["PyTorch"], score);

        Assert.NotNull(result);
        Assert.Equal(expectedLessonCount, result.Lessons.Count);
        if (score >= 75)
        {
            Assert.Contains(result.Lessons, l => l.Title.Contains("Advanced") || l.Title.Contains("Optimization"));
        }
        else
        {
            Assert.Contains(result.Lessons, l => l.Title.Contains("Foundations") || l.Title.Contains("First"));
        }
    }

    [Fact]
    public async Task CreateAdaptiveQuizAsync_GeneratesRequestedQuestionCountWithValidOptions()
    {
        var service = CreateService(new Dictionary<string, string?>
        {
            ["GEMINI_API_KEY"] = ""
        });

        var result = await service.CreateAdaptiveQuizAsync("Data Literacy", "adaptive", 3, 65);

        Assert.NotNull(result);
        Assert.Equal(3, result.Questions.Count);
        Assert.All(result.Questions, q =>
        {
            Assert.False(string.IsNullOrWhiteSpace(q.Prompt));
            Assert.Equal(4, q.Options.Count);
            Assert.InRange(q.CorrectOption, 0, 3);
            Assert.False(string.IsNullOrWhiteSpace(q.Explanation));
        });
    }

    [Theory]
    [InlineData(90, "Outstanding")]
    [InlineData(70, "Solid")]
    [InlineData(45, "Foundational")]
    public async Task GenerateFeedbackAsync_ProvidesEncouragingActionableFeedback(int score, string keyword)
    {
        var service = CreateService(new Dictionary<string, string?>
        {
            ["GEMINI_API_KEY"] = ""
        });

        var result = await service.GenerateFeedbackAsync("Responsible AI", score);

        Assert.NotNull(result);
        Assert.Contains(keyword, result.Summary);
        Assert.NotEmpty(result.Strengths);
        Assert.NotEmpty(result.NextSteps);
    }
}
