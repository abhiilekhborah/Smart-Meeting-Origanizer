namespace CAPS_ai.API.Models;

public class Question
{
    public int QuestionId { get; set; }
    public int MeetingId { get; set; }
    public Meeting Meeting { get; set; } = null!;
    public int UserId { get; set; }
    public User User { get; set; } = null!;
    public string QuestionText { get; set; } = "";
    public string? Category { get; set; } = "General";
    public string Status { get; set; } = "Pending";
    public DateTime SubmittedAt { get; set; } = DateTime.UtcNow;
    public DateTime? SpeakingStartedAt { get; set; }
    public DateTime? AnsweredAt { get; set; }
    public DateTime? WithdrawnAt { get; set; }
    public int? SpeakingDurationSeconds { get; set; }
    public string? OrganizerNote { get; set; }
    // Preserved for legacy submissions only; new questions use session ownership.
    public string? WithdrawalTokenHash { get; set; }
}
