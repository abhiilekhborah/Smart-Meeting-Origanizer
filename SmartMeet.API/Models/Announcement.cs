namespace SmartMeet.API.Models;

public class Announcement
{
    public int Id { get; set; }
    public int MeetingId { get; set; }
    public Meeting Meeting { get; set; } = null!;
    public string Message { get; set; } = "";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
