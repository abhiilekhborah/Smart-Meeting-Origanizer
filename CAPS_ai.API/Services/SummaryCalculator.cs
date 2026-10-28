using CAPS_ai.API.DTOs;
using CAPS_ai.API.Models;
namespace CAPS_ai.API.Services;

public static class SummaryCalculator
{
    public static MeetingSummaryDto Calculate(Meeting m, IReadOnlyList<QuestionResponseDto> questions,
        IReadOnlyList<SummaryParticipantDto> attendees)
    {
        var visitors = attendees.Where(u => u.Role == "Visitor" && !u.IsLegacyParticipant).ToList();
        var durations = questions.Where(q => q.Status == "Answered" && q.SpeakingDurationSeconds.HasValue)
            .Select(q => q.SpeakingDurationSeconds!.Value).ToList();
        var timeline = new List<TimelineEventDto> { new(m.StartedAt, "started", "Meeting started") };
        foreach (var u in attendees.Where(u => !u.IsLegacyParticipant))
            timeline.Add(new(u.JoinedAt, "joined", $"{u.Name} joined ({u.Role})"));
        foreach (var q in questions)
        {
            timeline.Add(new(q.SubmittedAt, "submitted", $"{q.Name} submitted question #{q.QuestionId}", q.QuestionId));
            if (q.SpeakingStartedAt is DateTime start) timeline.Add(new(start, "speaking", $"{q.Name} selected to speak", q.QuestionId));
            if (q.AnsweredAt is DateTime answered) timeline.Add(new(answered, "answered", $"Question #{q.QuestionId} answered", q.QuestionId));
            if (q.WithdrawnAt is DateTime withdrawn) timeline.Add(new(withdrawn, "withdrawn", $"Question #{q.QuestionId} withdrawn", q.QuestionId));
        }
        if (m.EndedAt is DateTime end) timeline.Add(new(end, "ended", "Meeting ended"));
        return new(m.MeetingId, m.Title, m.Description, m.MeetingCode, attendees.SingleOrDefault(u => u.Role == "Organizer")?.Name,
            m.Status, m.CreatedAt, m.StartedAt, m.EndedAt,
            m.EndedAt is DateTime e ? Math.Max(0, (e - m.StartedAt).TotalSeconds) : null,
            questions.Count, questions.Count(q => q.Status == "Answered"), questions.Count(q => q.Status == "Pending"),
            questions.Count(q => q.Status == "Withdrawn"), visitors.Count, durations.Sum(),
            durations.Count == 0 ? null : durations.Average(), attendees, questions,
            timeline.OrderBy(t => t.At).ThenBy(t => t.Kind, StringComparer.Ordinal).ThenBy(t => t.QuestionId).ToList());
    }
}
