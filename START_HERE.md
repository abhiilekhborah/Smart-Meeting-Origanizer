# Smart Meet — VS Code startup and PostgreSQL guide

This guide explains how to run the project in VS Code on macOS and inspect its PostgreSQL tables.

## 1. Open the correct folder in VS Code

Clone the repository into your home folder, then choose **File → Open Folder** and open the cloned folder (adjust the path if you cloned elsewhere):

```text
~/Smart-Meeting-Origanizer
```

You should see `SmartMeet.API`, `SmartMeet.Tests`, `smart-meet-frontend`, and `SmartMeet.slnx` in the Explorer.

Open **Terminal → New Terminal**. Use the **+** button in the terminal panel to create additional terminals. Keep one terminal running the backend and another running the frontend. You can use a third terminal for database queries.

## 2. Start PostgreSQL

In a terminal, run:

```bash
brew services start postgresql@16
pg_isready -h localhost -p 5432
```

Expected result:

```text
localhost:5432 - accepting connections
```

PostgreSQL runs as a background service. Closing this terminal does not stop it.

If `pg_isready` or `psql` is not found, add the installed PostgreSQL tools to this terminal's PATH:

```bash
export PATH="/opt/homebrew/opt/postgresql@16/bin:$PATH"
```

Then retry the command. This PATH change applies to the current terminal only.

## 3. Start the backend — terminal 1

### Make .NET available

Install the [.NET 10 SDK](https://dotnet.microsoft.com/download/dotnet/10.0), reopen VS Code, and verify it is available:

```bash
dotnet --version
```

### Restore packages and apply pending migrations

```bash
cd ~/Smart-Meeting-Origanizer
dotnet restore SmartMeet.slnx
dotnet tool restore
dotnet ef database update --project SmartMeet.API
```

On a fresh installation, this creates the database/schema when the PostgreSQL role has the required permissions. Running `database update` again checks for pending migrations; it does not reset existing records.

Do not generate another initial migration or recreate the database just to start the app.

### Run the API

```bash
dotnet run --project SmartMeet.API
```

Expected output includes:

```text
Now listening on: http://localhost:5050
```

Keep this terminal running. Open:

- [Swagger API documentation](http://localhost:5050/swagger)
- [Meetings API](http://localhost:5050/api/meetings)

### Subsequent backend starts

With the .NET SDK installed, you normally only need:

```bash
cd ~/Smart-Meeting-Origanizer
dotnet run --project SmartMeet.API
```

Run `dotnet ef database update --project SmartMeet.API` whenever new migrations have been added.

## 4. Start the frontend — terminal 2

Open another VS Code terminal:

```bash
cd ~/Smart-Meeting-Origanizer/smart-meet-frontend
```

Install dependencies on a fresh copy, or after dependency changes:

```bash
npm ci
```

Then start Angular:

```bash
npm start
```

Keep this terminal running. Open [Smart Meet](http://localhost:4200).

The frontend forwards `/api` requests to the backend on port 5050. You need both servers running to use the app.

## 5. Use the application

1. Open the home page and create a meeting, or open an existing one.
2. The **Organizer** view manages questions, speakers, announcements, and summaries. It has no question-submission form.
3. Click **Copy invite link** and open the visitor URL in another tab.
4. The **Visitor** view submits questions by typing or voice, upvotes questions, and withdraws its own pending questions.
5. As organizer, use **Pick next question** and **Mark as answered**.
6. Use search and status filters to review questions. Neither filters nor votes change FIFO selection.
7. End the meeting to see its summary. An unanswered current speaker returns to Pending.

For voice input, try Google Chrome and allow microphone access. Brave can expose the speech API but fail to connect to its speech service. Live speech depends on browser support and the browser's recognition service.

Use the same browser and address consistently for visitor ownership: `localhost:4200` and `127.0.0.1:4200` have separate browser storage. Clearing storage can remove withdrawal keys and voting identity.

## 6. Connect to the database — terminal 3

In a new terminal, run:

```bash
psql -h localhost -p 5432 -d SmartMeetDB
```

You should now see a PostgreSQL prompt such as:

```text
SmartMeetDB=#
```

**The following table and SQL commands go inside this PostgreSQL prompt.** Do not type the prompt itself. Do not run shell commands such as `npm start` inside psql; exit with `\q` first or use another terminal.

### Basic database commands

| Command | What it does |
|---|---|
| `\conninfo` | Show the connected database, role, host, and port |
| `\l` | List databases |
| `\dt` | List tables in the current database |
| `\d "Meetings"` | Show meeting columns, types, indexes, and constraints |
| `\d "Questions"` | Show question columns, types, indexes, and constraints |
| `\d "QuestionVotes"` | Show vote columns and the duplicate-vote unique index |
| `\d "Announcements"` | Show announcement columns and relationships |
| `\q` | Exit psql and return to the normal terminal |

Backslash commands do not need a semicolon. SQL queries below **do** need a semicolon. Table and column names are case-sensitive here, so keep their double quotes.

## 7. View the tables' data

### Meetings

```sql
SELECT * FROM "Meetings" ORDER BY "MeetingId";
```

Important columns: `MeetingId`, `Title`, `CreatedAt`, `Status`, and `EndedAt`. Meetings ended before the summary feature was added can have an unknown (`NULL`) end time.

### Questions

```sql
SELECT * FROM "Questions" ORDER BY "QuestionId";
```

For a narrower, easier-to-read result:

```sql
SELECT "QuestionId", "MeetingId", "Name", "Organization",
       "QuestionText", "Status", "SubmittedAt",
       "SpeakingStartedAt", "AnsweredAt", "WithdrawnAt"
FROM "Questions"
ORDER BY "QuestionId" DESC;
```

Statuses are `Pending`, `Speaking`, `Answered`, or `Withdrawn`. Withdrawn questions remain stored for history and summaries.

### Votes

```sql
SELECT * FROM "QuestionVotes" ORDER BY "Id";
```

Each row is one vote. `VisitorTokenHash` contains a hash, not the raw anonymous browser token.

To view the vote total for every question, including zero-vote questions:

```sql
SELECT q."QuestionId", q."Name", q."QuestionText",
       COUNT(v."Id") AS "VoteCount"
FROM "Questions" q
LEFT JOIN "QuestionVotes" v ON v."QuestionId" = q."QuestionId"
GROUP BY q."QuestionId", q."Name", q."QuestionText"
ORDER BY q."QuestionId";
```

### Announcements

```sql
SELECT * FROM "Announcements"
ORDER BY "CreatedAt" DESC, "Id" DESC;
```

### Applied migrations

```sql
SELECT * FROM "__EFMigrationsHistory" ORDER BY "MigrationId";
```

The current project has the `InitialPostgres` and `AddMeetingParticipationFeatures` migrations. This history table is maintained by EF Core.

## 8. Inspect one meeting

First find its ID in the Meetings table. This example uses meeting **4**; replace `4` with your meeting's ID:

```text
\set meeting_id 4
```

Then run:

```sql
SELECT * FROM "Meetings" WHERE "MeetingId" = :meeting_id;

SELECT "QuestionId", "Name", "QuestionText", "Status"
FROM "Questions"
WHERE "MeetingId" = :meeting_id
ORDER BY "SubmittedAt", "QuestionId";

SELECT "Status", COUNT(*) AS "QuestionCount"
FROM "Questions"
WHERE "MeetingId" = :meeting_id
GROUP BY "Status"
ORDER BY "Status";

SELECT "Id", "Message", "CreatedAt"
FROM "Announcements"
WHERE "MeetingId" = :meeting_id
ORDER BY "CreatedAt" DESC, "Id" DESC;
```

The variable syntax `:meeting_id` works inside psql. In another SQL client, replace it with the actual numeric ID.

## 9. Make database output easier to read

For wide tables, toggle vertical/expanded output:

```text
\x
```

Rerun your query. Each record will appear vertically. Run `\x` again to switch back.

If output opens a scrolling viewer, press **q** to return to the database prompt. To disable that viewer for this session:

```text
\pset pager off
```

If the prompt changes to `SmartMeetDB-#`, PostgreSQL is usually waiting for the rest of an unfinished statement. Add the missing semicolon, or press **Ctrl+C** to cancel the unfinished input.

## 10. Confirm that application changes are saved

1. Create a new meeting in the app.
2. Query `"Meetings"` and find its ID.
3. Submit a visitor question, then query `"Questions"` for that meeting.
4. Upvote it and check `"QuestionVotes"` or the vote-count query.
5. Publish an announcement and query `"Announcements"`.
6. Mark a speaking question answered or withdraw an owned pending question, then rerun the question query.
7. End the meeting and check `"Meetings"."EndedAt"` and the saved question statuses.

Records remain after refreshing the browser or restarting the API. Raw withdrawal tokens are returned only when a question is created and kept in that browser; the database contains only `WithdrawalTokenHash`. Old questions without that hash cannot be withdrawn through the app.

## 11. Stop and restart safely

- In the backend terminal, press **Ctrl+C** to stop the API.
- In the frontend terminal, press **Ctrl+C** to stop Angular.
- Use `\q` to disconnect from psql; this does not stop PostgreSQL.
- PostgreSQL can remain running between development sessions. To stop the service intentionally:

```bash
brew services stop postgresql@16
```

Start the service again before the next app session. Stopping services does not delete database records.

### Port already in use

Only run one server on each port. Check existing listeners:

```bash
lsof -nP -iTCP:4200 -iTCP:5050 -sTCP:LISTEN
```

`4200` belongs to Angular and `5050` to the API. Stop the previous instance with **Ctrl+C** in its terminal. If that terminal is unavailable, identify its process ID from `lsof` and use `kill -TERM PID`, replacing `PID` with the verified process ID. Then restart the affected server. Do not stop PostgreSQL just to resolve an Angular/API port conflict.

## 12. Common problems

| Problem | What to check |
|---|---|
| `dotnet: command not found` | Install the .NET 10 SDK and reopen the terminal. |
| `psql: command not found` | Add `/opt/homebrew/opt/postgresql@16/bin` to PATH. |
| PostgreSQL connection refused | Start `postgresql@16` and run `pg_isready`. |
| PostgreSQL role/password error | Set your actual role/credentials in the connection string; see the README. |
| `SmartMeetDB` or a table does not exist | Run the EF database-update command using the same connection string as the API. |
| `relation meetings does not exist` | Use the exact quoted name `"Meetings"`, not unquoted `meetings`. |
| API startup stack trace | Read the first error above the trace; check whether port 5050 is already in use. |
| Frontend displays connection errors | Confirm PostgreSQL and the API are running, then use Retry/Refresh. |
| Many `Executed DbCommand` logs | Normal successful SQL logging; active dashboards poll every four seconds. |
| Voice input fails in Brave | Try the same meeting URL in Google Chrome and allow microphone access. |

The configured development connection is `Host=localhost;Port=5432;Database=SmartMeetDB;Timeout=5`. It uses your current operating-system username unless overridden. For custom roles/passwords, use environment configuration or .NET user secrets as explained in [README.md](README.md); do not put credentials in committed files.

## 13. Optional builds and tests

From the SmartMeet folder, with the SDK available:

```bash
dotnet build SmartMeet.slnx
dotnet test SmartMeet.Tests/SmartMeet.Tests.csproj
```

From the frontend folder:

```bash
npm run build
npm test
```

With the API and PostgreSQL running, from SmartMeet:

```bash
python3 SmartMeet.Tests/api_smoke.py
python3 SmartMeet.Tests/feature_smoke.py
```

The API smoke tests create clearly named test meetings and retain them for inspection. They are optional and are not needed just to start the app.
