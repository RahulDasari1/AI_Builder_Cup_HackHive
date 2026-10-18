using HackHive.Shared.Models;
using Xunit;

namespace HackHive.Tests;

public class DomainModelTests
{
    [Fact]
    public void CourseRecord_DefaultValues_AreValid()
    {
        var course = new CourseRecord
        {
            Title = "AI Foundations",
            Description = "Learn the basics of AI"
        };

        Assert.True(course.Published);
        Assert.Equal("AI & Machine Learning", course.Category);
        Assert.Equal("Beginner", course.Difficulty);
        Assert.Equal(4, course.DurationHours);
        Assert.Empty(course.Lessons);
    }

    [Fact]
    public void UserProfileRecord_DefaultRole_IsStudent()
    {
        var user = new UserProfileRecord
        {
            Uid = "user-123",
            Email = "student@hackhive.edu",
            DisplayName = "Student One"
        };

        Assert.Equal("student", user.Role);
        Assert.Equal("cohort-2026-japac", user.CohortId);
        Assert.Empty(user.ManagedCohorts);
    }

    [Fact]
    public void ProgressRecord_CalculatesCompletedLessonsCorrectly()
    {
        var progress = new ProgressRecord
        {
            Uid = "user-123",
            CourseId = "ai-foundations",
            CompletedLessonIds = ["lesson-1", "lesson-2"],
            CompletedLessons = 2,
            AssessmentScore = 85
        };

        Assert.Equal(2, progress.CompletedLessons);
        Assert.Equal(85, progress.AssessmentScore);
    }

    [Fact]
    public void AssessmentRecord_StoresQuestionsAndPrivateAnswerKeys()
    {
        var assessment = new AssessmentRecord
        {
            Uid = "user-123",
            CourseId = "ai-foundations",
            Topic = "Fairness in AI",
            Questions =
            [
                new Dictionary<string, object>
                {
                    ["prompt"] = "What is data bias?",
                    ["options"] = new[] { "A", "B", "C", "D" }
                }
            ],
            AnswerKey = [1],
            Explanations = ["Correct because of B"]
        };

        Assert.Single(assessment.Questions);
        Assert.Single(assessment.AnswerKey);
        Assert.Equal(1, assessment.AnswerKey[0]);
    }
}
