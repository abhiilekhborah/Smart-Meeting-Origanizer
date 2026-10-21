using SmartMeet.API.Models;
using SmartMeet.API.Services;
using Xunit;
namespace SmartMeet.Tests;

public class ParticipationTests
{
    [Fact] public void TokensAreRandomAndOnlyTheirHashesMatch()
    {
        var token=TokenSecrets.Create(); var other=TokenSecrets.Create();
        Assert.Equal(64,token.Length);Assert.NotEqual(token,other);
        var hash=TokenSecrets.Hash(token);Assert.NotEqual(token.ToUpperInvariant(),hash);
        Assert.True(TokenSecrets.Matches(token,hash));Assert.True(TokenSecrets.Matches(token.ToUpperInvariant(),hash));
        Assert.False(TokenSecrets.Matches(other,hash));Assert.False(TokenSecrets.Matches(token,null));
    }
    [Theory] [InlineData("")] [InlineData("not-a-token")] [InlineData("ffffffff")]
    public void InvalidTokenFormatsAreRejected(string token)=>Assert.Equal(400,Assert.Throws<ApiException>(()=>TokenSecrets.Hash(token)).Status);
    [Fact] public void SummaryPartitionsStatusesAndCalculatesDuration()
    {
        var start=new DateTime(2026,10,21,9,0,0,DateTimeKind.Utc);
        var meeting=new Meeting{Title="Summary test",Status="Ended",CreatedAt=start,EndedAt=start.AddMinutes(45)};
        var questions=new[]{new Question{Status="Answered"},new Question{Status="Pending"},new Question{Status="Pending"},new Question{Status="Withdrawn"}};
        var summary=SummaryCalculator.Calculate(meeting,questions,7);
        Assert.Equal(4,summary.TotalQuestions);Assert.Equal(1,summary.AnsweredQuestions);Assert.Equal(2,summary.PendingQuestions);
        Assert.Equal(1,summary.WithdrawnQuestions);Assert.Equal(7,summary.TotalUpvotes);Assert.Equal(2700,summary.DurationSeconds);
    }
    [Fact] public void LegacySummariesDoNotInventAnEndTime()
    {
        var summary=SummaryCalculator.Calculate(new Meeting{Status="Ended"},[],0);
        Assert.Null(summary.EndedAt);Assert.Null(summary.DurationSeconds);Assert.Equal(0,summary.TotalQuestions);
    }
    [Fact] public void WithdrawalDoesNotChangeRemainingFifoOrder()
    {
        var now=DateTime.UtcNow;var questions=new[]{new Question{QuestionId=1,SubmittedAt=now},new Question{QuestionId=2,SubmittedAt=now,Status="Withdrawn"},new Question{QuestionId=3,SubmittedAt=now}};
        Assert.Equal(new[]{1,3},QueueRules.PendingInOrder(questions.AsQueryable()).Select(q=>q.QuestionId));
    }
}
