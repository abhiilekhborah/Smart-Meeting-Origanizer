using Microsoft.EntityFrameworkCore;
using SmartMeet.API.Data;
using SmartMeet.API.DTOs;
using SmartMeet.API.Models;
using System.Linq.Expressions;
namespace SmartMeet.API.Services;

public interface IQuestionService
{
    Task<List<QuestionResponseDto>> List(int meetingId, string? status = null);
    Task<CreatedQuestionResponseDto> Create(CreateQuestionDto dto);
    Task<QuestionResponseDto> Next(int meetingId);
    Task<QuestionResponseDto> Answer(int id);
    Task<QuestionResponseDto> Upvote(int id, UpvoteDto dto);
    Task<QuestionResponseDto> Withdraw(int id, WithdrawQuestionDto dto);
}
public class QuestionService(SmartMeetDbContext db, IMeetingService meetings) : IQuestionService
{
    private static readonly Expression<Func<Question, QuestionResponseDto>> Response = q => new(q.QuestionId, q.MeetingId, q.Name, q.Organization,
        q.QuestionText, q.Status, q.SubmittedAt, q.SpeakingStartedAt, q.AnsweredAt, q.WithdrawnAt, q.Votes.Count);
    private Task<QuestionResponseDto> GetResponse(int id) => db.Questions.AsNoTracking().Where(q => q.QuestionId == id).Select(Response).SingleAsync();
    public async Task<List<QuestionResponseDto>> List(int meetingId, string? status = null)
    {
        await meetings.Get(meetingId);
        var query = db.Questions.AsNoTracking().Where(q => q.MeetingId == meetingId);
        if (status != null) query = query.Where(q => q.Status == status);
        var ordered = status == "Answered" ? query.OrderByDescending(q => q.AnsweredAt).ThenByDescending(q => q.QuestionId)
            : query.OrderBy(q => q.SubmittedAt).ThenBy(q => q.QuestionId);
        return await ordered.Select(Response).ToListAsync();
    }
    public async Task<CreatedQuestionResponseDto> Create(CreateQuestionDto dto)
    {
        await using var tx = await db.Database.BeginTransactionAsync();
        QueueRules.RequireActive(await MeetingLock.Get(db, dto.MeetingId));
        var token = TokenSecrets.Create();
        var question = new Question { MeetingId = dto.MeetingId, Name = dto.Name.Trim(), Organization = dto.Organization.Trim(), QuestionText = dto.QuestionText.Trim(), WithdrawalTokenHash = TokenSecrets.Hash(token) };
        db.Questions.Add(question);
        await db.SaveChangesAsync();
        await tx.CommitAsync();
        return new(await GetResponse(question.QuestionId), token);
    }
    public async Task<QuestionResponseDto> Next(int meetingId)
    {
        await using var tx = await db.Database.BeginTransactionAsync();
        QueueRules.RequireActive(await MeetingLock.Get(db, meetingId));
        var hasSpeaker = await db.Questions.AnyAsync(q => q.MeetingId == meetingId && q.Status == "Speaking");
        if (hasSpeaker) throw new ApiException(409, "A participant is already speaking.");
        var question = await QueueRules.PendingInOrder(db.Questions.Where(q => q.MeetingId == meetingId)).FirstOrDefaultAsync()
            ?? throw new ApiException(409, "There are no pending questions.");
        QueueRules.Start(question, hasSpeaker, DateTime.UtcNow);
        await db.SaveChangesAsync();
        await tx.CommitAsync();
        return await GetResponse(question.QuestionId);
    }
    public async Task<QuestionResponseDto> Answer(int id)
    {
        var meetingId = await db.Questions.Where(q => q.QuestionId == id).Select(q => (int?)q.MeetingId).SingleOrDefaultAsync()
            ?? throw new ApiException(404, "Question not found.");
        await using var tx = await db.Database.BeginTransactionAsync();
        QueueRules.RequireActive(await MeetingLock.Get(db, meetingId));
        var question = await db.Questions.SingleAsync(q => q.QuestionId == id);
        QueueRules.Answer(question, DateTime.UtcNow);
        await db.SaveChangesAsync();
        await tx.CommitAsync();
        return await GetResponse(question.QuestionId);
    }
    private async Task<int> FindMeeting(int id) => await db.Questions.Where(q => q.QuestionId == id)
        .Select(q => (int?)q.MeetingId).SingleOrDefaultAsync() ?? throw new ApiException(404, "Question not found.");
    public async Task<QuestionResponseDto> Upvote(int id, UpvoteDto dto)
    {
        var hash = TokenSecrets.Hash(dto.VisitorToken);
        var meetingId = await FindMeeting(id);
        await using var tx = await db.Database.BeginTransactionAsync();
        QueueRules.RequireActive(await MeetingLock.Get(db, meetingId));
        var question = await db.Questions.SingleAsync(q => q.QuestionId == id);
        if (question.Status == "Withdrawn") throw new ApiException(409, "Withdrawn questions cannot receive votes.");
        if (await db.QuestionVotes.AnyAsync(v => v.QuestionId == id && v.VisitorTokenHash == hash))
            throw new ApiException(409, "You have already voted for this question.");
        db.QuestionVotes.Add(new QuestionVote { QuestionId = id, VisitorTokenHash = hash });
        await db.SaveChangesAsync(); await tx.CommitAsync();
        return await GetResponse(id);
    }
    public async Task<QuestionResponseDto> Withdraw(int id, WithdrawQuestionDto dto)
    {
        var meetingId = await FindMeeting(id);
        await using var tx = await db.Database.BeginTransactionAsync();
        QueueRules.RequireActive(await MeetingLock.Get(db, meetingId));
        var question = await db.Questions.SingleAsync(q => q.QuestionId == id);
        if (!TokenSecrets.Matches(dto.WithdrawalToken, question.WithdrawalTokenHash))
            throw new ApiException(403, "This withdrawal token does not belong to the question.");
        if (question.Status != "Pending") throw new ApiException(409, "Only pending questions can be withdrawn.");
        question.Status = "Withdrawn"; question.WithdrawnAt = DateTime.UtcNow;
        await db.SaveChangesAsync(); await tx.CommitAsync();
        return await GetResponse(id);
    }
}
