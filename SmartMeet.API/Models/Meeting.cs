namespace SmartMeet.API.Models;

public class Meeting
{
    public int MeetingId { get; set; }
    public string Title { get; set; } = "";
    public string? Description { get; set; }
    public string MeetingCode { get; set; } = "";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime StartedAt { get; set; } = DateTime.UtcNow;
    public string Status { get; set; } = "Active";
    public DateTime? EndedAt { get; set; }
    // Organizer is the single Users row with Role=Organizer for this meeting.
    public List<User> Users { get; set; } = [];
    public List<Question> Questions { get; set; } = [];
}
