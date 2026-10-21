using Microsoft.EntityFrameworkCore;
using SmartMeet.API.Models;
namespace SmartMeet.API.Data;

public class SmartMeetDbContext(DbContextOptions<SmartMeetDbContext> options) : DbContext(options)
{
    public DbSet<Meeting> Meetings => Set<Meeting>();
    public DbSet<Question> Questions => Set<Question>();
    public DbSet<QuestionVote> QuestionVotes => Set<QuestionVote>();
    public DbSet<Announcement> Announcements => Set<Announcement>();
    protected override void OnModelCreating(ModelBuilder model)
    {
        var m = model.Entity<Meeting>();
        m.HasKey(x => x.MeetingId);
        m.Property(x => x.Title).HasMaxLength(200).IsRequired();
        m.Property(x => x.Status).HasMaxLength(20).IsRequired();
        m.ToTable(t => t.HasCheckConstraint("CK_Meeting_Status", "\"Status\" IN ('Active', 'Ended')"));
        var q = model.Entity<Question>();
        q.HasKey(x => x.QuestionId);
        q.Property(x => x.Name).HasMaxLength(100).IsRequired();
        q.Property(x => x.Organization).HasMaxLength(150).IsRequired();
        q.Property(x => x.QuestionText).IsRequired();
        q.Property(x => x.Status).HasMaxLength(20).IsRequired();
        q.HasOne(x => x.Meeting).WithMany(x => x.Questions).HasForeignKey(x => x.MeetingId).OnDelete(DeleteBehavior.Restrict);
        q.HasIndex(x => new { x.MeetingId, x.Status, x.SubmittedAt, x.QuestionId });
        q.HasIndex(x => x.MeetingId).IsUnique().HasFilter("\"Status\" = 'Speaking'").HasDatabaseName("IX_OneSpeakerPerMeeting");
        q.Property(x => x.WithdrawalTokenHash).HasMaxLength(64);
        q.ToTable(t => t.HasCheckConstraint("CK_Question_Status", "\"Status\" IN ('Pending', 'Speaking', 'Answered', 'Withdrawn')"));
        var vote = model.Entity<QuestionVote>();
        vote.Property(x => x.VisitorTokenHash).HasMaxLength(64).IsRequired();
        vote.HasOne(x => x.Question).WithMany(x => x.Votes).HasForeignKey(x => x.QuestionId).OnDelete(DeleteBehavior.Restrict);
        vote.HasIndex(x => new { x.QuestionId, x.VisitorTokenHash }).IsUnique();
        var announcement = model.Entity<Announcement>();
        announcement.Property(x => x.Message).HasMaxLength(300).IsRequired();
        announcement.HasOne(x => x.Meeting).WithMany(x => x.Announcements).HasForeignKey(x => x.MeetingId).OnDelete(DeleteBehavior.Restrict);
        announcement.HasIndex(x => new { x.MeetingId, x.CreatedAt, x.Id });
        // Npgsql maps UTC DateTime values to PostgreSQL timestamp with time zone.
    }
}
