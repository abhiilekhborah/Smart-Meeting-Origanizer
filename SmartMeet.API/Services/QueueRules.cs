using SmartMeet.API.Models;
namespace SmartMeet.API.Services;

public class ApiException(int status, string message) : Exception(message)
{
    public int Status { get; } = status;
}

public static class QueueRules
{
    public static IOrderedQueryable<Question> PendingInOrder(IQueryable<Question> questions) =>
        questions.Where(q => q.Status == "Pending").OrderBy(q => q.SubmittedAt).ThenBy(q => q.QuestionId);
    public static void RequireActive(Meeting meeting)
    {
        if (meeting.Status != "Active") throw new ApiException(409, "This meeting has ended.");
    }
    public static void Start(Question question, bool hasSpeaker, DateTime now)
    {
        if (hasSpeaker) throw new ApiException(409, "A participant is already speaking.");
        if (question.Status != "Pending") throw new ApiException(409, "Only a pending question can be selected.");
        question.Status = "Speaking";
        question.SpeakingStartedAt = now;
    }
    public static void Answer(Question question, DateTime now)
    {
        if (question.Status != "Speaking") throw new ApiException(409, "Only the speaking question can be answered.");
        question.Status = "Answered";
        question.AnsweredAt = now;
        question.SpeakingDurationSeconds = question.SpeakingStartedAt is DateTime start ? (int)Math.Min(int.MaxValue, Math.Max(0, (now - start).TotalSeconds)) : null;
    }
}
