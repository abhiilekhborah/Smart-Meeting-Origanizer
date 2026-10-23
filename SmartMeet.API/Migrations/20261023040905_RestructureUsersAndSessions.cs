using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace SmartMeet.API.Migrations
{
    /// <inheritdoc />
    public partial class RestructureUsersAndSessions : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "Announcements");

            migrationBuilder.DropTable(
                name: "QuestionVotes");

            migrationBuilder.AddColumn<string>(
                name: "Category",
                table: "Questions",
                type: "character varying(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "OrganizerNote",
                table: "Questions",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "SpeakingDurationSeconds",
                table: "Questions",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "UserId",
                table: "Questions",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "Description",
                table: "Meetings",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "MeetingCode",
                table: "Meetings",
                type: "character varying(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<DateTime>(
                name: "StartedAt",
                table: "Meetings",
                type: "timestamp with time zone",
                nullable: false,
                defaultValue: new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified));

            migrationBuilder.CreateTable(
                name: "Users",
                columns: table => new
                {
                    UserId = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    MeetingId = table.Column<int>(type: "integer", nullable: false),
                    Name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Email = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: true),
                    Organization = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    Role = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    JoinedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    LastSeenAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    SessionTokenHash = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Users", x => x.UserId);
                    table.UniqueConstraint("AK_Users_UserId_MeetingId", x => new { x.UserId, x.MeetingId });
                    table.CheckConstraint("CK_User_Role", "\"Role\" IN ('Organizer', 'Visitor')");
                    table.ForeignKey(
                        name: "FK_Users_Meetings_MeetingId",
                        column: x => x.MeetingId,
                        principalTable: "Meetings",
                        principalColumn: "MeetingId",
                        onDelete: ReferentialAction.Restrict);
                });

            // Never merge by name: one unclaimed historical visitor per question.
            // Existing withdrawal hashes remain attached to their original questions.
            migrationBuilder.Sql("""
                INSERT INTO "Users" ("UserId", "MeetingId", "Name", "Organization", "Role", "JoinedAt", "IsActive")
                SELECT "QuestionId", "MeetingId", "Name", "Organization", 'Visitor', "SubmittedAt", false FROM "Questions";
                SELECT setval(pg_get_serial_sequence('"Users"', 'UserId'), COALESCE(MAX("UserId"), 1), COUNT(*) > 0) FROM "Users";
                UPDATE "Questions" SET "UserId" = "QuestionId", "Category" = 'General',
                    "SpeakingDurationSeconds" = CASE WHEN "AnsweredAt" IS NOT NULL AND "SpeakingStartedAt" IS NOT NULL
                        THEN LEAST(2147483647, GREATEST(0, FLOOR(EXTRACT(EPOCH FROM ("AnsweredAt" - "SpeakingStartedAt")))))::integer ELSE NULL END;
                UPDATE "Meetings" SET "StartedAt" = "CreatedAt", "MeetingCode" = 'LEGACY-' || "MeetingId"::text;
                ALTER TABLE "Questions" ALTER COLUMN "UserId" DROP DEFAULT;
                ALTER TABLE "Meetings" ALTER COLUMN "StartedAt" DROP DEFAULT;
                ALTER TABLE "Meetings" ALTER COLUMN "MeetingCode" DROP DEFAULT;
                """);

            migrationBuilder.DropColumn(
                name: "Name",
                table: "Questions");

            migrationBuilder.DropColumn(
                name: "Organization",
                table: "Questions");

            migrationBuilder.CreateIndex(
                name: "IX_Questions_UserId_MeetingId",
                table: "Questions",
                columns: new[] { "UserId", "MeetingId" });

            migrationBuilder.AddCheckConstraint(
                name: "CK_Question_Category",
                table: "Questions",
                sql: "\"Category\" IS NULL OR \"Category\" IN ('General', 'Technical', 'Feedback', 'Other')");

            migrationBuilder.AddCheckConstraint(
                name: "CK_Question_Duration",
                table: "Questions",
                sql: "\"SpeakingDurationSeconds\" IS NULL OR \"SpeakingDurationSeconds\" >= 0");

            migrationBuilder.CreateIndex(
                name: "IX_Meetings_MeetingCode",
                table: "Meetings",
                column: "MeetingCode",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_OneOrganizerPerMeeting",
                table: "Users",
                column: "MeetingId",
                unique: true,
                filter: "\"Role\" = 'Organizer'");

            migrationBuilder.CreateIndex(
                name: "IX_Users_MeetingId_Role_LastSeenAt",
                table: "Users",
                columns: new[] { "MeetingId", "Role", "LastSeenAt" });

            migrationBuilder.CreateIndex(
                name: "IX_Users_SessionTokenHash",
                table: "Users",
                column: "SessionTokenHash",
                unique: true,
                filter: "\"SessionTokenHash\" IS NOT NULL");

            migrationBuilder.AddForeignKey(
                name: "FK_Questions_Users_UserId_MeetingId",
                table: "Questions",
                columns: new[] { "UserId", "MeetingId" },
                principalTable: "Users",
                principalColumns: new[] { "UserId", "MeetingId" },
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            throw new NotSupportedException("This data restructuring is forward-only. Restore the pre-migration PostgreSQL backup to recover removed votes/announcements and the original schema.");
        }
    }
}
