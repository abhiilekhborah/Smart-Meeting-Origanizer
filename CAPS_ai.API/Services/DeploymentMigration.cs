using Microsoft.EntityFrameworkCore;
using CAPS_ai.API.Data;
namespace CAPS_ai.API.Services;

public static class DeploymentMigration
{
    public static async Task ApplyAsync(CAPS_aiDbContext db)
    {
        // A deliberately removed history table must never make us replay initial
        // migrations against an existing user's tables. Fresh Render databases are empty.
        var applied = await db.Database.GetAppliedMigrationsAsync();
        if (!applied.Any() && await db.Database.CanConnectAsync())
        {
            var tables = await db.Database.SqlQuery<int>($"""
                SELECT COUNT(*)::integer AS "Value" FROM information_schema.tables
                WHERE table_schema = 'public' AND table_name IN
                    ('Meeting','MeetingAttendees','MeetingQuestions','Meetings','Users','Questions')
                """).SingleAsync();
            if (tables > 0) throw new InvalidOperationException("Existing application tables have no EF migration history. Restore the matching history before applying migrations.");
        }
        await db.Database.MigrateAsync();
    }
}
