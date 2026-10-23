using System.ComponentModel.DataAnnotations;
namespace SmartMeet.API.DTOs;

public record CreateMeetingDto(
    [Required, StringLength(200)] string Title,
    [Required, StringLength(100)] string OrganizerName,
    [Required, StringLength(150)] string Organization,
    [StringLength(5000)] string? Description = null);
public record JoinMeetingDto([Required, StringLength(100)] string Name,
    [Required, StringLength(150)] string Organization,
    [EmailAddress, StringLength(150)] string? Email = null);
public record CreateQuestionDto([Range(1, int.MaxValue)] int MeetingId,
    [Required, StringLength(10000)] string QuestionText,
    [RegularExpression("^(General|Technical|Feedback|Other)$")] string? Category = "General");
public record OrganizerNoteDto([StringLength(1000)] string? OrganizerNote);
public record WithdrawQuestionDto([RegularExpression("^[a-fA-F0-9]{64}$")] string? WithdrawalToken = null);
public record UserResponseDto(int UserId, int MeetingId, string Name, string Organization, string? Email,
    string Role, DateTime JoinedAt, DateTime? LastSeenAt, bool IsActive, bool IsLegacyParticipant);
public record SessionResponseDto(UserResponseDto User, string SessionToken);
public record MeetingResponseDto(int MeetingId, string Title, string? Description, string MeetingCode,
    int? OrganizerId, string? OrganizerName, DateTime CreatedAt, DateTime StartedAt, string Status,
    DateTime? EndedAt, int TotalParticipants, int ActiveParticipants);
public record CreatedMeetingResponseDto(MeetingResponseDto Meeting, SessionResponseDto Session);
public record QuestionResponseDto(int QuestionId, int MeetingId, int UserId, string Name, string Organization,
    string QuestionText, string? Category, string Status, DateTime SubmittedAt, DateTime? SpeakingStartedAt,
    DateTime? AnsweredAt, DateTime? WithdrawnAt, int? SpeakingDurationSeconds, string? OrganizerNote);
public record MeetingSummaryDto(int MeetingId, string Title, string Status, DateTime StartedAt,
    DateTime? EndedAt, double? DurationSeconds, int TotalQuestions, int AnsweredQuestions,
    int PendingQuestions, int WithdrawnQuestions, int TotalParticipants);
