namespace SmartMeet.API.Models;

public class Question
{
    public int QuestionId { get; set; }
    public int MeetingId { get; set; }
    public Meeting Meeting { get; set; } = null!;
    public string Name { get; set; } = "";
    public string Organization { get; set; } = "";
    public string QuestionText { get; set; } = "";
    public string Status { get; set; } = "Pending";
    public DateTime SubmittedAt { get; set; } = DateTime.UtcNow;
    public DateTime? SpeakingStartedAt { get; set; }
    public DateTime? AnsweredAt { get; set; }
    public string? WithdrawalTokenHash { get; set; }
    public DateTime? WithdrawnAt { get; set; }
    public List<QuestionVote> Votes { get; set; } = [];
}
