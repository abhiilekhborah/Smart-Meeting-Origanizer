using System.ComponentModel.DataAnnotations;
namespace SmartMeet.API.DTOs;

public record CreateMeetingDto([Required, StringLength(200)] string Title);
public record CreateQuestionDto(
    [Range(1, int.MaxValue)] int MeetingId,
    [Required, StringLength(100)] string Name,
    [Required, StringLength(150)] string Organization,
    [Required, StringLength(10000)] string QuestionText);

public record MeetingResponseDto(int MeetingId, string Title, DateTime CreatedAt, string Status, DateTime? EndedAt);
public record QuestionResponseDto(int QuestionId, int MeetingId, string Name, string Organization,
    string QuestionText, string Status, DateTime SubmittedAt, DateTime? SpeakingStartedAt, DateTime? AnsweredAt,
    DateTime? WithdrawnAt, int VoteCount);

// The private token is returned only by POST /api/questions, never by public reads.
public record CreatedQuestionResponseDto : QuestionResponseDto
{
    public string WithdrawalToken { get; init; }
    public CreatedQuestionResponseDto(QuestionResponseDto question, string withdrawalToken) : base(question)
        => WithdrawalToken = withdrawalToken;
}
public record UpvoteDto([Required, RegularExpression("^[a-fA-F0-9]{64}$")] string VisitorToken);
public record WithdrawQuestionDto([Required, RegularExpression("^[a-fA-F0-9]{64}$")] string WithdrawalToken);
public record CreateAnnouncementDto([Required, StringLength(300)] string Message);
public record AnnouncementResponseDto(int Id, int MeetingId, string Message, DateTime CreatedAt);
public record MeetingSummaryDto(int MeetingId, string Title, string Status, DateTime StartedAt,
    DateTime? EndedAt, double? DurationSeconds, int TotalQuestions, int AnsweredQuestions,
    int PendingQuestions, int WithdrawnQuestions, int TotalUpvotes);
