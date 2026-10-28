using Microsoft.EntityFrameworkCore.Migrations;
#nullable disable
namespace CAPS_ai.API.Migrations;

public partial class RenameMeetingTables : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        // Rename in place: record IDs, sequences, foreign keys and existing indexes survive.
        migrationBuilder.RenameTable(name: "Users", newName: "MeetingAttendees");
        migrationBuilder.RenameTable(name: "Questions", newName: "MeetingQuestions");
        migrationBuilder.RenameTable(name: "Meetings", newName: "Meeting");
        migrationBuilder.RenameIndex(name: "IX_Users_SessionTokenHash", table: "MeetingAttendees", newName: "IX_MeetingAttendees_SessionTokenHash");
        migrationBuilder.RenameIndex(name: "IX_Users_MeetingId_Role_LastSeenAt", table: "MeetingAttendees", newName: "IX_MeetingAttendees_MeetingId_Role_LastSeenAt");
        migrationBuilder.RenameIndex(name: "IX_Questions_UserId_MeetingId", table: "MeetingQuestions", newName: "IX_MeetingQuestions_UserId_MeetingId");
        migrationBuilder.RenameIndex(name: "IX_Questions_MeetingId_Status_SubmittedAt_QuestionId", table: "MeetingQuestions", newName: "IX_MeetingQuestions_MeetingId_Status_SubmittedAt_QuestionId");
        migrationBuilder.RenameIndex(name: "IX_Meetings_MeetingCode", table: "Meeting", newName: "IX_Meeting_MeetingCode");
        migrationBuilder.Sql("""
            ALTER TABLE "MeetingAttendees" RENAME CONSTRAINT "PK_Users" TO "PK_MeetingAttendees";
            ALTER TABLE "MeetingQuestions" RENAME CONSTRAINT "PK_Questions" TO "PK_MeetingQuestions";
            ALTER TABLE "Meeting" RENAME CONSTRAINT "PK_Meetings" TO "PK_Meeting";
            ALTER TABLE "MeetingAttendees" RENAME CONSTRAINT "AK_Users_UserId_MeetingId" TO "AK_MeetingAttendees_UserId_MeetingId";
            ALTER TABLE "MeetingAttendees" RENAME CONSTRAINT "FK_Users_Meetings_MeetingId" TO "FK_MeetingAttendees_Meeting_MeetingId";
            ALTER TABLE "MeetingQuestions" RENAME CONSTRAINT "FK_Questions_Meetings_MeetingId" TO "FK_MeetingQuestions_Meeting_MeetingId";
            ALTER TABLE "MeetingQuestions" RENAME CONSTRAINT "FK_Questions_Users_UserId_MeetingId" TO "FK_MeetingQuestions_MeetingAttendees_UserId_MeetingId";
            CREATE UNIQUE INDEX "IX_Meeting_Code_CaseInsensitive" ON "Meeting" (lower("MeetingCode"));
            """);
    }
    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
            DROP INDEX "IX_Meeting_Code_CaseInsensitive";
            ALTER TABLE "MeetingQuestions" RENAME CONSTRAINT "FK_MeetingQuestions_MeetingAttendees_UserId_MeetingId" TO "FK_Questions_Users_UserId_MeetingId";
            ALTER TABLE "MeetingQuestions" RENAME CONSTRAINT "FK_MeetingQuestions_Meeting_MeetingId" TO "FK_Questions_Meetings_MeetingId";
            ALTER TABLE "MeetingAttendees" RENAME CONSTRAINT "FK_MeetingAttendees_Meeting_MeetingId" TO "FK_Users_Meetings_MeetingId";
            ALTER TABLE "MeetingAttendees" RENAME CONSTRAINT "AK_MeetingAttendees_UserId_MeetingId" TO "AK_Users_UserId_MeetingId";
            ALTER TABLE "Meeting" RENAME CONSTRAINT "PK_Meeting" TO "PK_Meetings";
            ALTER TABLE "MeetingQuestions" RENAME CONSTRAINT "PK_MeetingQuestions" TO "PK_Questions";
            ALTER TABLE "MeetingAttendees" RENAME CONSTRAINT "PK_MeetingAttendees" TO "PK_Users";
            """);
        migrationBuilder.RenameIndex(name: "IX_Meeting_MeetingCode", table: "Meeting", newName: "IX_Meetings_MeetingCode");
        migrationBuilder.RenameIndex(name: "IX_MeetingQuestions_MeetingId_Status_SubmittedAt_QuestionId", table: "MeetingQuestions", newName: "IX_Questions_MeetingId_Status_SubmittedAt_QuestionId");
        migrationBuilder.RenameIndex(name: "IX_MeetingQuestions_UserId_MeetingId", table: "MeetingQuestions", newName: "IX_Questions_UserId_MeetingId");
        migrationBuilder.RenameIndex(name: "IX_MeetingAttendees_MeetingId_Role_LastSeenAt", table: "MeetingAttendees", newName: "IX_Users_MeetingId_Role_LastSeenAt");
        migrationBuilder.RenameIndex(name: "IX_MeetingAttendees_SessionTokenHash", table: "MeetingAttendees", newName: "IX_Users_SessionTokenHash");
        migrationBuilder.RenameTable(name: "Meeting", newName: "Meetings");
        migrationBuilder.RenameTable(name: "MeetingQuestions", newName: "Questions");
        migrationBuilder.RenameTable(name: "MeetingAttendees", newName: "Users");
    }
}
