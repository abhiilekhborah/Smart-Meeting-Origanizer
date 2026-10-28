using Microsoft.EntityFrameworkCore;
using Npgsql;
using CAPS_ai.API.Data;
using CAPS_ai.API.DTOs;
using CAPS_ai.API.Models;
namespace CAPS_ai.API.Services;

public interface IMeetingService
{
    Task<List<MeetingResponseDto>> List();
    Task<MeetingResponseDto> Get(int id);
    Task<MeetingResponseDto> ByCode(string code);
    Task<CreatedMeetingResponseDto> Create(CreateMeetingDto dto);
    Task<MeetingResponseDto> End(int id);
    Task<MeetingSummaryDto> Summary(int id);
}
public class MeetingService(CAPS_aiDbContext db, SessionService sessions) : IMeetingService
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
    public async Task<MeetingResponseDto> ByCode(string code)
    {
        var normalized = MeetingCodes.Normalize(code);
        var meeting = await db.Meetings.AsNoTracking().Include(m => m.Users)
            .SingleOrDefaultAsync(m => m.MeetingCode.ToLower() == normalized)
            ?? throw new ApiException(404, "Meeting not found.");
        QueueRules.RequireActive(meeting);
        return Map(meeting);
    }
    public async Task<CreatedMeetingResponseDto> Create(CreateMeetingDto dto)
    {
        // Retry the database-enforced collision, including races between API instances.
        for (var attempt = 0; attempt < 5; attempt++)
        {
            await using var tx = await db.Database.BeginTransactionAsync();
            var now = DateTime.UtcNow;
            var meeting = new Meeting {
                Title = dto.Title.Trim(), Description = string.IsNullOrWhiteSpace(dto.Description) ? null : dto.Description.Trim(),
                MeetingCode = MeetingCodes.Generate(), CreatedAt = now, StartedAt = now };
            var token = TokenSecrets.Create();
            var organizer = new User { Meeting = meeting, Name = dto.OrganizerName.Trim(), Organization = dto.Organization.Trim(),
                Role = "Organizer", SessionTokenHash = TokenSecrets.Hash(token), LastSeenAt = now, IsActive = true };
            db.Users.Add(organizer);
            try
            {
                await db.SaveChangesAsync(); await tx.CommitAsync();
                return new(await Get(meeting.MeetingId), new(SessionService.Map(organizer), token));
            }
            catch (DbUpdateException ex) when (ex.InnerException is PostgresException {
                SqlState: PostgresErrorCodes.UniqueViolation, ConstraintName: "IX_Meetings_MeetingCode" or "IX_Meeting_Code_CaseInsensitive" or "IX_Meeting_MeetingCode" })
            {
                await tx.RollbackAsync(); db.ChangeTracker.Clear();
            }
        }
        throw new ApiException(503, "Could not allocate a unique meeting code. Try creating the meeting again.");
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
        await sessions.Require(id, "Organizer");
        // Ended meetings are stable; repeatable-read also keeps concurrent note edits consistent.
        await using var tx = await db.Database.BeginTransactionAsync(System.Data.IsolationLevel.RepeatableRead);
        var meeting = await db.Meetings.AsNoTracking().SingleOrDefaultAsync(m => m.MeetingId == id)
            ?? throw new ApiException(404, "Meeting not found.");
        if (meeting.Status != "Ended") throw new ApiException(409, "The summary is available after the meeting ends.");
        var attendees = await db.Users.AsNoTracking().Where(u => u.MeetingId == id).OrderBy(u => u.JoinedAt)
            .Select(u => new SummaryParticipantDto(u.UserId, u.Name, u.Organization, u.Role, u.JoinedAt,
                u.Questions.Count, u.SessionTokenHash == null)).ToListAsync();
        var questions = await db.Questions.AsNoTracking().Where(q => q.MeetingId == id)
            .OrderBy(q => q.SubmittedAt).ThenBy(q => q.QuestionId)
            .Select(q => new QuestionResponseDto(q.QuestionId, q.MeetingId, q.UserId, q.User.Name, q.User.Organization,
                q.QuestionText, q.Category, q.Status, q.SubmittedAt, q.SpeakingStartedAt, q.AnsweredAt,
                q.WithdrawnAt, q.SpeakingDurationSeconds, q.OrganizerNote)).ToListAsync();
        await tx.CommitAsync();
        return SummaryCalculator.Calculate(meeting, questions, attendees);
    }

}
internal static class MeetingLock
{
    public static async Task<Meeting> Get(CAPS_aiDbContext db, int id) =>
        await db.Meetings.FromSqlInterpolated($"SELECT * FROM \"Meeting\" WHERE \"MeetingId\" = {id} FOR UPDATE")
            .SingleOrDefaultAsync() ?? throw new ApiException(404, "Meeting not found.");
}
