using Microsoft.EntityFrameworkCore;
using SmartMeet.API.Data;
using SmartMeet.API.DTOs;
using SmartMeet.API.Models;
namespace SmartMeet.API.Services;

public interface IMeetingService
{
    Task<List<MeetingResponseDto>> List();
    Task<MeetingResponseDto> Get(int id);
    Task<MeetingResponseDto> Create(CreateMeetingDto dto);
    Task<MeetingResponseDto> End(int id);
    Task<MeetingSummaryDto> Summary(int id);
    Task<List<AnnouncementResponseDto>> Announcements(int id);
    Task<AnnouncementResponseDto> Publish(int id, CreateAnnouncementDto dto);
}
public class MeetingService(SmartMeetDbContext db) : IMeetingService
{
    public static MeetingResponseDto Map(Meeting m) => new(m.MeetingId, m.Title, m.CreatedAt, m.Status, m.EndedAt);
    public async Task<List<MeetingResponseDto>> List() => (await db.Meetings.AsNoTracking().OrderByDescending(m => m.CreatedAt).ToListAsync()).Select(Map).ToList();
    public async Task<MeetingResponseDto> Get(int id) => Map(await db.Meetings.AsNoTracking().SingleOrDefaultAsync(m => m.MeetingId == id) ?? throw new ApiException(404, "Meeting not found."));
    public async Task<MeetingResponseDto> Create(CreateMeetingDto dto)
    {
        var meeting = new Meeting { Title = dto.Title.Trim() };
        db.Meetings.Add(meeting);
        await db.SaveChangesAsync();
        return Map(meeting);
    }
    public async Task<MeetingResponseDto> End(int id)
    {
        await using var tx = await db.Database.BeginTransactionAsync();
        var meeting = await MeetingLock.Get(db, id);
        if (meeting.Status == "Active")
        {
            var speaking = await db.Questions.SingleOrDefaultAsync(q => q.MeetingId == id && q.Status == "Speaking");
            if (speaking != null) { speaking.Status = "Pending"; speaking.SpeakingStartedAt = null; }
            meeting.Status = "Ended";
            meeting.EndedAt = DateTime.UtcNow;
            await db.SaveChangesAsync();
        }
        await tx.CommitAsync();
        return Map(meeting);
    }
    public async Task<MeetingSummaryDto> Summary(int id)
    {
        var meeting = await db.Meetings.AsNoTracking().SingleOrDefaultAsync(m => m.MeetingId == id)
            ?? throw new ApiException(404, "Meeting not found.");
        if (meeting.Status != "Ended") throw new ApiException(409, "The summary is available after the meeting ends.");
        var questions = await db.Questions.AsNoTracking().Where(q => q.MeetingId == id).ToListAsync();
        var votes = await db.QuestionVotes.CountAsync(v => v.Question.MeetingId == id);
        return SummaryCalculator.Calculate(meeting, questions, votes);
    }
    public async Task<List<AnnouncementResponseDto>> Announcements(int id)
    {
        await Get(id);
        return await db.Announcements.AsNoTracking().Where(a => a.MeetingId == id)
            .OrderByDescending(a => a.CreatedAt).ThenByDescending(a => a.Id)
            .Select(a => new AnnouncementResponseDto(a.Id, a.MeetingId, a.Message, a.CreatedAt)).ToListAsync();
    }
    public async Task<AnnouncementResponseDto> Publish(int id, CreateAnnouncementDto dto)
    {
        await using var tx = await db.Database.BeginTransactionAsync();
        QueueRules.RequireActive(await MeetingLock.Get(db, id));
        var announcement = new Announcement { MeetingId = id, Message = dto.Message.Trim() };
        db.Announcements.Add(announcement);
        await db.SaveChangesAsync(); await tx.CommitAsync();
        return new(announcement.Id, announcement.MeetingId, announcement.Message, announcement.CreatedAt);
    }
}

internal static class MeetingLock
{
    // All mutations acquire the same meeting row lock within a transaction.
    // This serializes next/answer/submit/end across API instances, not just threads.
    public static async Task<Meeting> Get(SmartMeetDbContext db, int id) =>
        await db.Meetings.FromSqlInterpolated($"SELECT * FROM \"Meetings\" WHERE \"MeetingId\" = {id} FOR UPDATE")
            .SingleOrDefaultAsync() ?? throw new ApiException(404, "Meeting not found.");
}
