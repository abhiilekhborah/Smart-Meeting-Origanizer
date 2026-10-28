using Microsoft.EntityFrameworkCore;
using CAPS_ai.API.Data;
using CAPS_ai.API.DTOs;
using CAPS_ai.API.Models;
using System.Linq.Expressions;
namespace CAPS_ai.API.Services;

public interface IQuestionService
{
    Task<List<QuestionResponseDto>> List(int meetingId, string? status = null);
    Task<QuestionResponseDto> Create(CreateQuestionDto dto);
    Task<QuestionResponseDto> Next(int meetingId);
    Task<QuestionResponseDto> Answer(int id);
    Task<QuestionResponseDto> Withdraw(int id, WithdrawQuestionDto dto);
    Task<QuestionResponseDto> Note(int id, OrganizerNoteDto dto);
}
public class QuestionService(CAPS_aiDbContext db, IMeetingService meetings, SessionService sessions) : IQuestionService
{
    private static readonly Expression<Func<Question, QuestionResponseDto>> Response = q => new(q.QuestionId, q.MeetingId, q.UserId,
        q.User.Name, q.User.Organization, q.QuestionText, q.Category, q.Status, q.SubmittedAt, q.SpeakingStartedAt,
        q.AnsweredAt, q.WithdrawnAt, q.SpeakingDurationSeconds, q.OrganizerNote);
    private Task<QuestionResponseDto> GetResponse(int id) => db.Questions.AsNoTracking().Where(q => q.QuestionId == id).Select(Response).SingleAsync();
    private async Task<int> FindMeeting(int id) => await db.Questions.Where(q => q.QuestionId == id).Select(q => (int?)q.MeetingId)
        .SingleOrDefaultAsync() ?? throw new ApiException(404, "Question not found.");
    public async Task<List<QuestionResponseDto>> List(int meetingId, string? status = null)
    {
        await meetings.Get(meetingId);
        var query = db.Questions.AsNoTracking().Where(q => q.MeetingId == meetingId);
        if (status != null) query = query.Where(q => q.Status == status);
        var ordered = status == "Answered" ? query.OrderByDescending(q => q.AnsweredAt).ThenByDescending(q => q.QuestionId)
            : query.OrderBy(q => q.SubmittedAt).ThenBy(q => q.QuestionId);
        return await ordered.Select(Response).ToListAsync();
    }
    public async Task<QuestionResponseDto> Create(CreateQuestionDto dto)
    {
        var user = await sessions.Require(dto.MeetingId, "Visitor");
        await using var tx = await db.Database.BeginTransactionAsync();
        QueueRules.RequireActive(await MeetingLock.Get(db, dto.MeetingId));
        var question = new Question { MeetingId = dto.MeetingId, UserId = user.UserId, QuestionText = dto.QuestionText.Trim(), Category = dto.Category ?? "General" };
        user.LastSeenAt = DateTime.UtcNow; user.IsActive = true;
        db.Questions.Add(question); await db.SaveChangesAsync(); await tx.CommitAsync();
        return await GetResponse(question.QuestionId);
    }
    public async Task<QuestionResponseDto> Next(int meetingId)
    {
        await sessions.Require(meetingId, "Organizer");
        await using var tx = await db.Database.BeginTransactionAsync();
        QueueRules.RequireActive(await MeetingLock.Get(db, meetingId));
        var hasSpeaker = await db.Questions.AnyAsync(q => q.MeetingId == meetingId && q.Status == "Speaking");
        if (hasSpeaker) throw new ApiException(409, "A participant is already speaking.");
        var question = await QueueRules.PendingInOrder(db.Questions.Where(q => q.MeetingId == meetingId)).FirstOrDefaultAsync()
            ?? throw new ApiException(409, "There are no pending questions.");
        QueueRules.Start(question, hasSpeaker, DateTime.UtcNow);
        await db.SaveChangesAsync(); await tx.CommitAsync(); return await GetResponse(question.QuestionId);
    }
    public async Task<QuestionResponseDto> Answer(int id)
    {
        var meetingId = await FindMeeting(id); await sessions.Require(meetingId, "Organizer");
        await using var tx = await db.Database.BeginTransactionAsync();
        QueueRules.RequireActive(await MeetingLock.Get(db, meetingId));
        var question = await db.Questions.SingleAsync(q => q.QuestionId == id);
        QueueRules.Answer(question, DateTime.UtcNow);
        await db.SaveChangesAsync(); await tx.CommitAsync(); return await GetResponse(id);
    }
    public async Task<QuestionResponseDto> Withdraw(int id, WithdrawQuestionDto dto)
    {
        var meetingId = await FindMeeting(id);
        await using var tx = await db.Database.BeginTransactionAsync();
        QueueRules.RequireActive(await MeetingLock.Get(db, meetingId));
        var question = await db.Questions.Include(q => q.User).SingleAsync(q => q.QuestionId == id);
        var user = await sessions.Optional();
        var owned = user?.Role == "Visitor" && user.MeetingId == meetingId && user.UserId == question.UserId;
        // A legacy withdrawal secret authorizes only its original question, never the migrated user.
        var legacy = question.User.SessionTokenHash == null && dto.WithdrawalToken != null
            && TokenSecrets.Matches(dto.WithdrawalToken, question.WithdrawalTokenHash);
        if (!owned && !legacy) throw new ApiException(user == null && dto.WithdrawalToken == null ? 401 : 403, "You can withdraw only your own pending question.");
        if (question.Status != "Pending") throw new ApiException(409, "Only pending questions can be withdrawn.");
        question.Status = "Withdrawn"; question.WithdrawnAt = DateTime.UtcNow;
        await db.SaveChangesAsync(); await tx.CommitAsync(); return await GetResponse(id);
    }
    public async Task<QuestionResponseDto> Note(int id, OrganizerNoteDto dto)
    {
        var meetingId = await FindMeeting(id); await sessions.Require(meetingId, "Organizer");
        await using var tx = await db.Database.BeginTransactionAsync();
        await MeetingLock.Get(db, meetingId);
        var question = await db.Questions.SingleAsync(q => q.QuestionId == id);
        question.OrganizerNote = string.IsNullOrWhiteSpace(dto.OrganizerNote) ? null : dto.OrganizerNote.Trim();
        await db.SaveChangesAsync(); await tx.CommitAsync(); return await GetResponse(id);
    }
}
