namespace SmartMeet.API.Models;

public class Meeting
{
    public int MeetingId { get; set; }
    public string Title { get; set; } = "";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public string Status { get; set; } = "Active";
    public DateTime? EndedAt { get; set; }
    public List<Announcement> Announcements { get; set; } = [];
    public List<Question> Questions { get; set; } = [];
}
