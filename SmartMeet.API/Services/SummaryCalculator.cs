using SmartMeet.API.DTOs;
using SmartMeet.API.Models;
namespace SmartMeet.API.Services;

public static class SummaryCalculator
{
    public static MeetingSummaryDto Calculate(Meeting meeting, IReadOnlyCollection<Question> questions, int votes) =>
        new(meeting.MeetingId, meeting.Title, meeting.Status, meeting.CreatedAt, meeting.EndedAt,
            meeting.EndedAt is DateTime end ? Math.Max(0, (end - meeting.CreatedAt).TotalSeconds) : null,
            questions.Count, questions.Count(q => q.Status == "Answered"), questions.Count(q => q.Status == "Pending"),
            questions.Count(q => q.Status == "Withdrawn"), votes);
}
