# Smart Meet — VS Code startup and PostgreSQL guide

## 1. Open the project

Open the folder containing `SmartMeet.slnx`, `SmartMeet.API` and `smart-meet-frontend` in VS Code. Run the commands below from that folder unless a different location is specified.

Install .NET 10 SDK, Node.js 24/npm, and PostgreSQL 16+. Check:

```bash
dotnet --version
node --version
npm --version
```

If this Mac still uses the temporary SDK, it is available for the current session with:

```bash
export DOTNET_ROOT=/tmp/smartmeet-dotnet
export PATH="$DOTNET_ROOT:$PATH"
```

Install the permanent SDK for long-term use; temporary files can disappear.

## 2. Start PostgreSQL

```bash
brew services start postgresql@16
export PATH="$(brew --prefix postgresql@16)/bin:$PATH"
pg_isready -h localhost -p 5432
```

The default connection uses database `SmartMeetDB` and your OS username. Set a custom connection with user secrets as described in [README.md](README.md) if required.

## 3. Back up before the restructuring update

Stop the old API with Ctrl+C before changing its schema. The new migration removes votes and announcements permanently. Meetings and questions are retained.

```bash
mkdir -p backups
pg_dump -h localhost -d SmartMeetDB -Fc -f backups/before-user-restructure.dump
pg_restore --list backups/before-user-restructure.dump
```

Read [docs/MIGRATION.md](docs/MIGRATION.md) for restore verification and the legacy identity policy. Keep backups private; they contain participant details and token hashes. `backups/` is ignored by Git.

## 4. Backend — terminal 1

```bash
dotnet restore SmartMeet.slnx
dotnet tool restore
dotnet ef database update --project SmartMeet.API
dotnet run --project SmartMeet.API
```

Keep the terminal running. Open [Swagger](http://localhost:5050/swagger) or [meetings](http://localhost:5050/api/meetings). Running migrations again checks pending changes without resetting records.

## 5. Frontend — terminal 2

From the repository root:

```bash
cd smart-meet-frontend
npm ci
npm start
```

Open [Smart Meet](http://localhost:4200). For subsequent starts, `npm start` is normally enough; `npm ci` is needed after cloning or dependency changes.

## 6. Use the application

1. Create a meeting with title, optional description, organizer name, and organization.
2. The organizer session is saved in that browser. Keep it to retain management access.
3. Copy the invitation link and open the visitor view.
4. Join with name, organization, and optional email. Refresh reuses the stored session rather than joining again.
5. Submit a question and category. Use the microphone if desired; review the text before submitting.
6. In organizer view, search/filter questions, select the next FIFO speaker, mark answers, and add notes.
7. Open Participants to see users and activity. Active means seen within 60 seconds; closing a tab may take that long to disappear from the active count.
8. End the meeting and review the summary. Joining and submissions then close.

New question ownership comes from the server-validated session. A name or UserId alone grants no permission. Older meetings remain read-only because their organizer identities were never recorded. Older private question-withdrawal keys still work for their original pending questions.

## 7. Connect to PostgreSQL — terminal 3

```bash
psql -h localhost -p 5432 -d SmartMeetDB
```

Inside the psql prompt:

```text
\conninfo
\dt
\d "Users"
\d "Meetings"
\d "Questions"
```

There should be three application tables and `__EFMigrationsHistory`.

### Meetings and organizer names

```sql
SELECT m."MeetingId", m."Title", m."Description", m."MeetingCode",
       u."UserId" AS "OrganizerId", u."Name" AS "OrganizerName",
       m."StartedAt", m."EndedAt", m."Status"
FROM "Meetings" m
LEFT JOIN "Users" u ON u."MeetingId" = m."MeetingId" AND u."Role" = 'Organizer'
ORDER BY m."MeetingId";
```

`OrganizerId` is derived from the unique Organizer user. It is not a separate Meetings column.

### Users

```sql
SELECT "UserId", "MeetingId", "Name", "Email", "Organization", "Role",
       "JoinedAt", "LastSeenAt", "IsActive",
       ("SessionTokenHash" IS NULL) AS "HistoricalParticipant"
FROM "Users" ORDER BY "MeetingId", "UserId";
```

Raw session tokens are never stored in PostgreSQL. A null hash denotes an unclaimed historical user, not an available login.

### Questions and participant details

```sql
SELECT q."QuestionId", q."MeetingId", q."UserId", u."Name", u."Organization",
       q."QuestionText", q."Category", q."Status", q."SubmittedAt",
       q."SpeakingStartedAt", q."AnsweredAt", q."WithdrawnAt",
       q."SpeakingDurationSeconds", q."OrganizerNote"
FROM "Questions" q JOIN "Users" u
  ON u."UserId" = q."UserId" AND u."MeetingId" = q."MeetingId"
ORDER BY q."SubmittedAt", q."QuestionId";
```

### Joined and active visitor counts

```sql
SELECT m."MeetingId", m."Title",
       COUNT(u."UserId") AS "JoinedVisitors",
       COUNT(u."UserId") FILTER (
           WHERE m."Status" = 'Active' AND u."IsActive"
             AND u."LastSeenAt" >= now() - interval '60 seconds'
       ) AS "ActiveVisitors"
FROM "Meetings" m
LEFT JOIN "Users" u ON u."MeetingId" = m."MeetingId"
  AND u."Role" = 'Visitor' AND u."SessionTokenHash" IS NOT NULL
GROUP BY m."MeetingId", m."Title" ORDER BY m."MeetingId";
```

Counts are calculated from joined visitor rows rather than stored in a duplicate TotalParticipants column. Historical unclaimed participants are excluded from registered counts.

### Applied migrations

```sql
SELECT * FROM "__EFMigrationsHistory" ORDER BY "MigrationId";
```

Use `\x` for expanded rows, `\pset pager off` to disable the output pager, and `\q` to exit. SQL needs a semicolon; backslash commands do not. Keep quoted mixed-case identifiers.

## 8. Sessions in Swagger

Create a meeting or join one, then copy the returned `sessionToken` into Swagger's Authorize dialog. Use the organizer token for management/participant listing and a visitor token for question submission or withdrawal. This is an opaque bearer token, not a JWT. Do not put tokens into URLs or share screenshots containing them.

## 9. Stop and troubleshoot

Stop the frontend/backend with Ctrl+C in their respective terminals. `\q` disconnects psql without stopping PostgreSQL. To check occupied application ports:

```bash
lsof -nP -iTCP:4200 -iTCP:5050 -sTCP:LISTEN
```

| Issue | Check |
|---|---|
| Missing dotnet/npm | Install the required SDK/runtime and reopen the terminal. |
| PostgreSQL unavailable | Start the service; check port, username, and connection string. |
| Missing tables/columns | Apply migrations using the same connection configuration as the API. |
| API connection errors | Start the backend on 5050 and use Retry. |
| 401 session error | Join again as a visitor; organizer access requires the original stored token. |
| 403 forbidden | The session belongs to a different meeting/role or another question owner. |
| Read-only old meeting | Legacy organizers cannot be safely reconstructed. Create a new meeting for management. |
| Voice fails in Brave | Try Chrome and check microphone permission. |
| Active count remains after tab closes | Wait up to the 60-second inactivity threshold and the next poll. |

## 10. Checks

```bash
dotnet build SmartMeet.slnx
```

In the frontend folder:

```bash
npm run build
```

Test folders are not required to run the application and have been removed. Historical verification results are recorded in [docs/VERIFICATION.md](docs/VERIFICATION.md).
