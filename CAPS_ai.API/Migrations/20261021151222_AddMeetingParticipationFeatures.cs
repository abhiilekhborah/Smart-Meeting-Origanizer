using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace CAPS_ai.API.Migrations
{
    /// <inheritdoc />
    public partial class AddMeetingParticipationFeatures : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "CK_Question_Status",
                table: "Questions");

            migrationBuilder.AddColumn<string>(
                name: "WithdrawalTokenHash",
                table: "Questions",
                type: "character varying(64)",
                maxLength: 64,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "WithdrawnAt",
                table: "Questions",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "EndedAt",
                table: "Meetings",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "Announcements",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    MeetingId = table.Column<int>(type: "integer", nullable: false),
                    Message = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Announcements", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Announcements_Meetings_MeetingId",
                        column: x => x.MeetingId,
                        principalTable: "Meetings",
                        principalColumn: "MeetingId",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "QuestionVotes",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    QuestionId = table.Column<int>(type: "integer", nullable: false),
                    VisitorTokenHash = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_QuestionVotes", x => x.Id);
                    table.ForeignKey(
                        name: "FK_QuestionVotes_Questions_QuestionId",
                        column: x => x.QuestionId,
                        principalTable: "Questions",
                        principalColumn: "QuestionId",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.AddCheckConstraint(
                name: "CK_Question_Status",
                table: "Questions",
                sql: "\"Status\" IN ('Pending', 'Speaking', 'Answered', 'Withdrawn')");

            migrationBuilder.CreateIndex(
                name: "IX_Announcements_MeetingId_CreatedAt_Id",
                table: "Announcements",
                columns: new[] { "MeetingId", "CreatedAt", "Id" });

            migrationBuilder.CreateIndex(
                name: "IX_QuestionVotes_QuestionId_VisitorTokenHash",
                table: "QuestionVotes",
                columns: new[] { "QuestionId", "VisitorTokenHash" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "Announcements");

            migrationBuilder.DropTable(
                name: "QuestionVotes");

            migrationBuilder.DropCheckConstraint(
                name: "CK_Question_Status",
                table: "Questions");

            migrationBuilder.DropColumn(
                name: "WithdrawalTokenHash",
                table: "Questions");

            migrationBuilder.DropColumn(
                name: "WithdrawnAt",
                table: "Questions");

            migrationBuilder.DropColumn(
                name: "EndedAt",
                table: "Meetings");

            migrationBuilder.AddCheckConstraint(
                name: "CK_Question_Status",
                table: "Questions",
                sql: "\"Status\" IN ('Pending', 'Speaking', 'Answered')");
        }
    }
}
