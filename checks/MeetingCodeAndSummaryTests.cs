using CAPS_ai.API.DTOs;
using CAPS_ai.API.Models;
using CAPS_ai.API.Services;
using Xunit;
namespace CAPS_ai.Tests;
public class MeetingCodeAndSummaryTests
{
    [Fact] public void GeneratedCodesHaveReadableFormatAndDoNotRepeatInSample()
    {
        var codes=Enumerable.Range(0,10000).Select(_=>MeetingCodes.Generate()).ToList();
        Assert.All(codes,c=>Assert.Matches("^[a-z]{3}-[a-z]{4}-[a-z]{3}$",c));
        Assert.Equal(codes.Count,codes.Distinct().Count());
    }
    [Theory] [InlineData(" ABC-DEFG-HIJ ","abc-defg-hij")] [InlineData("AABBCCDDEEFF0011","aabbccddeeff0011")] [InlineData("LEGACY-2","legacy-2")]
    public void CodesNormalizeAndLegacyCodesRemainValid(string input,string expected)=>Assert.Equal(expected,MeetingCodes.Normalize(input));
    [Theory] [InlineData("")] [InlineData("abc")] [InlineData("abc-defg-hij?secret=1")] [InlineData("../invalid")]
    public void InvalidCodesAreRejected(string code)=>Assert.Equal(400,Assert.Throws<ApiException>(()=>MeetingCodes.Normalize(code)).Status);
    [Fact] public void SummaryComputesSnapshotDurationsCountsAndTimeline()
    {
        var start=new DateTime(2026,10,26,10,0,0,DateTimeKind.Utc);
        var m=new Meeting{MeetingId=1,Title="Review",MeetingCode="abc-defg-hij",Description="Description",Status="Ended",StartedAt=start,CreatedAt=start,EndedAt=start.AddMinutes(10)};
        QuestionResponseDto Q(int id,string status,int? duration)=>new(id,1,2,"Visitor","College","Question","Technical",status,start.AddSeconds(id),status=="Answered"?start.AddSeconds(10):null,status=="Answered"?start.AddSeconds(60):null,status=="Withdrawn"?start.AddSeconds(30):null,duration,"Note");
        var attendees=new[]{new SummaryParticipantDto(1,"Organizer","Team","Organizer",start,0,false),new SummaryParticipantDto(2,"Visitor","College","Visitor",start.AddSeconds(1),4,false),new SummaryParticipantDto(3,"Historical","Past","Visitor",start,0,true)};
        var result=SummaryCalculator.Calculate(m,new[]{Q(1,"Answered",20),Q(2,"Answered",40),Q(3,"Pending",null),Q(4,"Withdrawn",null)},attendees);
        Assert.Equal(4,result.TotalQuestions);Assert.Equal(2,result.AnsweredQuestions);Assert.Equal(1,result.PendingQuestions);Assert.Equal(1,result.WithdrawnQuestions);
        Assert.Equal(1,result.TotalParticipants);Assert.Equal(60,result.TotalSpeakingDurationSeconds);Assert.Equal(30,result.AverageSpeakingDurationSeconds);Assert.Equal(600,result.DurationSeconds);
        Assert.Equal("Organizer",result.OrganizerName);Assert.Equal("Description",result.Description);
        Assert.Equal(result.Timeline.OrderBy(e=>e.At).Select(e=>e.At),result.Timeline.Select(e=>e.At));Assert.Equal("ended",result.Timeline.Last().Kind);
        Assert.Contains(result.Timeline,e=>e.Kind=="speaking");Assert.DoesNotContain(result.Timeline,e=>e.Kind=="joined"&&e.Description.Contains("Historical"));
    }
    [Fact] public void EmptySummaryDoesNotInventMissingTimes()
    {
        var r=SummaryCalculator.Calculate(new Meeting{Status="Ended"},[],[]);
        Assert.Null(r.DurationSeconds);Assert.Null(r.AverageSpeakingDurationSeconds);Assert.Null(r.OrganizerName);Assert.Equal(0,r.TotalSpeakingDurationSeconds);
    }
    [Fact] public void TokensUsePrivateHashes()
    {
        var token=TokenSecrets.Create();Assert.True(TokenSecrets.Matches(token,TokenSecrets.Hash(token)));Assert.False(TokenSecrets.Matches(TokenSecrets.Create(),TokenSecrets.Hash(token)));
    }
}
