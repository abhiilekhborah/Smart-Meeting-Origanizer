using Microsoft.EntityFrameworkCore;
using CAPS_ai.API.Data;
using CAPS_ai.API.DTOs;
using CAPS_ai.API.Models;
namespace CAPS_ai.API.Services;

public class SessionService(CAPS_aiDbContext db, IHttpContextAccessor accessor)
{
    public const int ActivitySeconds = 60;
    public static bool RecentlyActive(User u, DateTime now) => u.IsActive && u.LastSeenAt >= now.AddSeconds(-ActivitySeconds);
    public static UserResponseDto Map(User u) => new(u.UserId, u.MeetingId, u.Name, u.Organization, u.Email,
        u.Role, u.JoinedAt, u.LastSeenAt, RecentlyActive(u, DateTime.UtcNow), u.SessionTokenHash == null);
    public string? Token()
    {
        var header = accessor.HttpContext?.Request.Headers.Authorization.ToString();
        return header?.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase) == true ? header[7..] : null;
    }
    public async Task<User?> Optional()
    {
        var token = Token();
        if (token is null) return null;
        if (token.Length != 64 || !token.All(char.IsAsciiHexDigit)) throw new ApiException(401, "Invalid session. Join the meeting again.");
        var hash = TokenSecrets.Hash(token);
        return await db.Users.SingleOrDefaultAsync(u => u.SessionTokenHash == hash)
            ?? throw new ApiException(401, "Session not found. Join the meeting again.");
    }
    public async Task<User> Require(int? meetingId = null, string? role = null)
    {
        var user = await Optional() ?? throw new ApiException(401, "A meeting session is required.");
        if (meetingId is int id && user.MeetingId != id || role != null && user.Role != role)
            throw new ApiException(403, "This session cannot perform this meeting action.");
        return user;
    }
    public async Task<UserResponseDto> Me() => Map(await Require());
    public async Task<UserResponseDto> Heartbeat()
    {
        var user = await Require();
        var active = await db.Meetings.AnyAsync(m => m.MeetingId == user.MeetingId && m.Status == "Active");
        user.LastSeenAt = DateTime.UtcNow; user.IsActive = active;
        await db.SaveChangesAsync();
        return Map(user);
    }
    public async Task<SessionResponseDto> Join(int meetingId, JoinMeetingDto dto)
    {
        await using var tx = await db.Database.BeginTransactionAsync();
        QueueRules.RequireActive(await MeetingLock.Get(db, meetingId));
        var existing = await Optional();
        if (existing != null)
        {
            if (existing.MeetingId != meetingId || existing.Role != "Visitor") throw new ApiException(403, "Use a visitor session for this meeting.");
            existing.LastSeenAt = DateTime.UtcNow; existing.IsActive = true;
            await db.SaveChangesAsync(); await tx.CommitAsync();
            return new(Map(existing), Token()!);
        }
        var token = TokenSecrets.Create();
        var user = new User { MeetingId = meetingId, Name = dto.Name.Trim(), Organization = dto.Organization.Trim(),
            Email = string.IsNullOrWhiteSpace(dto.Email) ? null : dto.Email.Trim(), SessionTokenHash = TokenSecrets.Hash(token),
            LastSeenAt = DateTime.UtcNow, IsActive = true };
        db.Users.Add(user); await db.SaveChangesAsync(); await tx.CommitAsync();
        return new(Map(user), token);
    }
    public async Task<List<UserResponseDto>> Participants(int id)
    {
        await Require(id, "Organizer");
        var users = await db.Users.AsNoTracking().Where(u => u.MeetingId == id).OrderBy(u => u.JoinedAt).ToListAsync();
        return users.Select(Map).ToList();
    }
}
