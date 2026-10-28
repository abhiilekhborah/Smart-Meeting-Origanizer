using Microsoft.EntityFrameworkCore;
using CAPS_ai.API.Models;
namespace CAPS_ai.API.Data;

public class CAPS_aiDbContext(DbContextOptions<CAPS_aiDbContext> options) : DbContext(options)
{
    public DbSet<Meeting> Meetings => Set<Meeting>();
    public DbSet<User> Users => Set<User>();
    public DbSet<Question> Questions => Set<Question>();
    protected override void OnModelCreating(ModelBuilder model)
    {
        var m = model.Entity<Meeting>();
        m.HasKey(x => x.MeetingId);
        m.Property(x => x.Title).HasMaxLength(200).IsRequired();
        m.Property(x => x.MeetingCode).HasMaxLength(20).IsRequired();
        m.HasIndex(x => x.MeetingCode).IsUnique();
        m.Property(x => x.Status).HasMaxLength(20).IsRequired();
        m.ToTable("Meeting", t => t.HasCheckConstraint("CK_Meeting_Status", "\"Status\" IN ('Active', 'Ended')"));

        var u = model.Entity<User>();
        u.HasKey(x => x.UserId);
        u.HasAlternateKey(x => new { x.UserId, x.MeetingId });
        u.Property(x => x.Name).HasMaxLength(100).IsRequired();
        u.Property(x => x.Organization).HasMaxLength(150).IsRequired();
        u.Property(x => x.Email).HasMaxLength(150);
        u.Property(x => x.Role).HasMaxLength(20).IsRequired();
        u.Property(x => x.SessionTokenHash).HasMaxLength(64);
        u.HasIndex(x => x.SessionTokenHash).IsUnique().HasFilter("\"SessionTokenHash\" IS NOT NULL");
        u.HasIndex(x => x.MeetingId).IsUnique().HasFilter("\"Role\" = 'Organizer'").HasDatabaseName("IX_OneOrganizerPerMeeting");
        u.HasIndex(x => new { x.MeetingId, x.Role, x.LastSeenAt });
        u.HasOne(x => x.Meeting).WithMany(x => x.Users).HasForeignKey(x => x.MeetingId).OnDelete(DeleteBehavior.Restrict);
        u.ToTable("MeetingAttendees", t => t.HasCheckConstraint("CK_User_Role", "\"Role\" IN ('Organizer', 'Visitor')"));

        var q = model.Entity<Question>();
        q.HasKey(x => x.QuestionId);
        q.Property(x => x.QuestionText).IsRequired();
        q.Property(x => x.Category).HasMaxLength(50);
        q.Property(x => x.Status).HasMaxLength(20).IsRequired();
        q.Property(x => x.WithdrawalTokenHash).HasMaxLength(64);
        q.HasOne(x => x.Meeting).WithMany(x => x.Questions).HasForeignKey(x => x.MeetingId).OnDelete(DeleteBehavior.Restrict);
        // Composite FK also enforces that question and user belong to the same meeting.
        q.HasOne(x => x.User).WithMany(x => x.Questions).HasForeignKey(x => new { x.UserId, x.MeetingId })
            .HasPrincipalKey(x => new { x.UserId, x.MeetingId }).OnDelete(DeleteBehavior.Restrict);
        q.HasIndex(x => new { x.MeetingId, x.Status, x.SubmittedAt, x.QuestionId });
        q.HasIndex(x => x.MeetingId).IsUnique().HasFilter("\"Status\" = 'Speaking'").HasDatabaseName("IX_OneSpeakerPerMeeting");
        q.ToTable("MeetingQuestions", t => {
            t.HasCheckConstraint("CK_Question_Status", "\"Status\" IN ('Pending', 'Speaking', 'Answered', 'Withdrawn')");
            t.HasCheckConstraint("CK_Question_Category", "\"Category\" IS NULL OR \"Category\" IN ('General', 'Technical', 'Feedback', 'Other')");
            t.HasCheckConstraint("CK_Question_Duration", "\"SpeakingDurationSeconds\" IS NULL OR \"SpeakingDurationSeconds\" >= 0");
        });
    }
}
