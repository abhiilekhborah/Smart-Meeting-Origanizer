using Microsoft.EntityFrameworkCore;
using SmartMeet.API.Data;
using SmartMeet.API.DTOs;
using SmartMeet.API.Models;
namespace SmartMeet.API.Services;

public interface IMeetingService
{
    Task<List<MeetingResponseDto>> List();
    Task<MeetingResponseDto> Get(int id);
    Task<CreatedMeetingResponseDto> Create(CreateMeetingDto dto);
    Task<MeetingResponseDto> End(int id);
    Task<MeetingSummaryDto> Summary(int id);
}
public class MeetingService(SmartMeetDbContext db, SessionService sessions) : IMeetingService
{
    private static MeetingResponseDto Map(Meeting m)
    {
        var organizer = m.Users.SingleOrDefault(u => u.Role == "Organizer");
        var visitors = m.Users.Where(u => u.Role == "Visitor" && u.SessionTokenHash != null).ToList();
        return new(m.MeetingId, m.Title, m.Description, m.MeetingCode, organizer?.UserId, organizer?.Name,
            m.CreatedAt, m.StartedAt, m.Status, m.EndedAt, visitors.Count,
            m.Status == "Active" ? visitors.Count(u => SessionService.RecentlyActive(u, DateTime.UtcNow)) : 0);
    }
    public async Task<List<MeetingResponseDto>> List() => (await db.Meetings.AsNoTracking().Include(m => m.Users)
        .OrderByDescending(m => m.CreatedAt).ToListAsync()).Select(Map).ToList();
    public async Task<MeetingResponseDto> Get(int id) => Map(await db.Meetings.AsNoTracking().Include(m => m.Users)
        .SingleOrDefaultAsync(m => m.MeetingId == id) ?? throw new ApiException(404, "Meeting not found."));
    public async Task<CreatedMeetingResponseDto> Create(CreateMeetingDto dto)
    {
        await using var tx = await db.Database.BeginTransactionAsync();
        // 64 random bits plus a unique database index; retry a code collision before insertion.
        string code;
        do { code = Convert.ToHexString(System.Security.Cryptography.RandomNumberGenerator.GetBytes(8)); }
        while (await db.Meetings.AnyAsync(m => m.MeetingCode == code));
        var now = DateTime.UtcNow;
        var meeting = new Meeting { Title = dto.Title.Trim(), Description = string.IsNullOrWhiteSpace(dto.Description) ? null : dto.Description.Trim(),
            MeetingCode = code, CreatedAt = now, StartedAt = now };
        var token = TokenSecrets.Create();
        var organizer = new User { Meeting = meeting, Name = dto.OrganizerName.Trim(), Organization = dto.Organization.Trim(),
            Role = "Organizer", SessionTokenHash = TokenSecrets.Hash(token), LastSeenAt = now, IsActive = true };
        db.Users.Add(organizer);
        await db.SaveChangesAsync(); await tx.CommitAsync();
        return new(await Get(meeting.MeetingId), new(SessionService.Map(organizer), token));
    }
    public async Task<MeetingResponseDto> End(int id)
    {
        await sessions.Require(id, "Organizer");
        await using var tx = await db.Database.BeginTransactionAsync();
        var meeting = await MeetingLock.Get(db, id);
        if (meeting.Status == "Active")
        {
            var speaking = await db.Questions.SingleOrDefaultAsync(q => q.MeetingId == id && q.Status == "Speaking");
            if (speaking != null) { speaking.Status = "Pending"; speaking.SpeakingStartedAt = null; }
            meeting.Status = "Ended"; meeting.EndedAt = DateTime.UtcNow;
            await db.Users.Where(u => u.MeetingId == id).ExecuteUpdateAsync(s => s.SetProperty(u => u.IsActive, false));
            await db.SaveChangesAsync();
        }
        await tx.CommitAsync(); return await Get(id);
    }
    public async Task<MeetingSummaryDto> Summary(int id)
    {
        var meeting = await db.Meetings.AsNoTracking().SingleOrDefaultAsync(m => m.MeetingId == id)
            ?? throw new ApiException(404, "Meeting not found.");
        if (meeting.Status != "Ended") throw new ApiException(409, "The summary is available after the meeting ends.");
        var questions = await db.Questions.AsNoTracking().Where(q => q.MeetingId == id).ToListAsync();
        var participants = await db.Users.CountAsync(u => u.MeetingId == id && u.Role == "Visitor" && u.SessionTokenHash != null);
        return SummaryCalculator.Calculate(meeting, questions, participants);
    }
}
internal static class MeetingLock
{
    public static async Task<Meeting> Get(SmartMeetDbContext db, int id) =>
        await db.Meetings.FromSqlInterpolated($"SELECT * FROM \"Meetings\" WHERE \"MeetingId\" = {id} FOR UPDATE")
            .SingleOrDefaultAsync() ?? throw new ApiException(404, "Meeting not found.");
}
