using System.ComponentModel.DataAnnotations;
using System.Reflection;
using CAPS_ai.API.DTOs;
using CAPS_ai.API.Models;
using CAPS_ai.API.Services;
using Xunit;
namespace CAPS_ai.Tests;

public class SessionRulesTests
{
    private static bool Valid(object dto) => dto.GetType().GetConstructors().Single().GetParameters().All(parameter => {
        var property=dto.GetType().GetProperty(parameter.Name!,BindingFlags.IgnoreCase|BindingFlags.Public|BindingFlags.Instance)!;
        return Validator.TryValidateValue(property.GetValue(dto),new ValidationContext(dto),[],parameter.GetCustomAttributes<ValidationAttribute>());
    });

    [Fact] public void ActivityExpiresAfterSixtySeconds()
    {
        var now=DateTime.UtcNow;var user=new User{IsActive=true,LastSeenAt=now.AddSeconds(-59)};
        Assert.True(SessionService.RecentlyActive(user,now));user.LastSeenAt=now.AddSeconds(-61);
        Assert.False(SessionService.RecentlyActive(user,now));user.LastSeenAt=now;user.IsActive=false;
        Assert.False(SessionService.RecentlyActive(user,now));user.IsActive=true;user.LastSeenAt=null;
        Assert.False(SessionService.RecentlyActive(user,now));
    }
    [Theory] [InlineData("General")] [InlineData("Technical")] [InlineData("Feedback")] [InlineData("Other")]
    public void CategoriesAreValidated(string category)
    {
        Assert.True(Valid(new CreateQuestionDto(1,"Question",category)));
        var invalid=new CreateQuestionDto(1,"Question","Invalid");
        Assert.False(Valid(invalid));
    }
    [Fact] public void AnswerStoresWholeCompletedSeconds()
    {
        var start=DateTime.UtcNow;var q=new Question();QueueRules.Start(q,false,start);QueueRules.Answer(q,start.AddSeconds(12.8));
        Assert.Equal(12,q.SpeakingDurationSeconds);
    }
    [Fact] public void OptionalEmailStillRequiresValidFormat()
    {
        var dto=new JoinMeetingDto("Alex","College","invalid");
        Assert.False(Valid(dto));
        dto=new JoinMeetingDto("Alex","College");Assert.True(Valid(dto));
    }
}
