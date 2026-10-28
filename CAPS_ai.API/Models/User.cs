namespace CAPS_ai.API.Models;

public class User
{
    public int UserId { get; set; }
    public int MeetingId { get; set; }
    public Meeting Meeting { get; set; } = null!;
    public string Name { get; set; } = "";
    public string? Email { get; set; }
    public string Organization { get; set; } = "";
    public string Role { get; set; } = "Visitor";
    public DateTime JoinedAt { get; set; } = DateTime.UtcNow;
    public DateTime? LastSeenAt { get; set; }
    public bool IsActive { get; set; }
    // NULL only for migrated participants whose identity cannot be reclaimed.
    public string? SessionTokenHash { get; set; }
    public List<Question> Questions { get; set; } = [];
}
