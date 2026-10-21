using SmartMeet.API.Models;
using SmartMeet.API.Services;
using Xunit;
namespace SmartMeet.Tests;

public class QueueRulesTests
{
    [Fact] public void FifoUsesTimeThenIdAndExcludesOtherStatuses()
    {
        var now = DateTime.UtcNow;
        var questions = new[] {
            new Question { QuestionId = 4, SubmittedAt = now.AddSeconds(1) },
            new Question { QuestionId = 3, SubmittedAt = now },
            new Question { QuestionId = 2, SubmittedAt = now },
            new Question { QuestionId = 1, SubmittedAt = now.AddDays(-1), Status = "Answered" }
        };
        Assert.Equal(new[] { 2, 3, 4 }, QueueRules.PendingInOrder(questions.AsQueryable()).Select(q => q.QuestionId));
    }
    [Fact] public void SpeakingSetsTimestampAndAnswerRetainsStart()
    {
        var question = new Question(); var start = DateTime.UtcNow;
        QueueRules.Start(question, false, start);
        Assert.Equal("Speaking", question.Status); Assert.Equal(start, question.SpeakingStartedAt);
        QueueRules.Answer(question, start.AddSeconds(12));
        Assert.Equal("Answered", question.Status); Assert.Equal(start.AddSeconds(12), question.AnsweredAt); Assert.Equal(start, question.SpeakingStartedAt);
    }
    [Theory] [InlineData("Pending")] [InlineData("Answered")]
    public void CannotAnswerQuestionThatIsNotSpeaking(string status)
    { var e = Assert.Throws<ApiException>(() => QueueRules.Answer(new Question { Status = status }, DateTime.UtcNow)); Assert.Equal(409, e.Status); }
    [Fact] public void ExistingSpeakerPreventsStartingAnother()
    { var question = new Question(); Assert.Throws<ApiException>(() => QueueRules.Start(question, true, DateTime.UtcNow)); Assert.Equal("Pending", question.Status); Assert.Null(question.SpeakingStartedAt); }
    [Fact] public void EndedMeetingRejectsMutation()
    { Assert.Throws<ApiException>(() => QueueRules.RequireActive(new Meeting { Status = "Ended" })); }
    [Theory] [InlineData("Speaking")] [InlineData("Answered")]
    public void OnlyPendingQuestionsCanStart(string status)
    { Assert.Throws<ApiException>(() => QueueRules.Start(new Question { Status = status }, false, DateTime.UtcNow)); }
}
