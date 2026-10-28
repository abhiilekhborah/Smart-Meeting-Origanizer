# Safe table renaming, codes, and summaries

Migration: `20261026152129_RenameMeetingTables`.

| Before | After |
|---|---|
| Meetings | Meeting |
| Users | MeetingAttendees (display: Meeting Attendees) |
| Questions | MeetingQuestions |

## Safety

This migration uses explicit RenameTable and RenameIndex operations. PostgreSQL ALTER TABLE RENAME CONSTRAINT changes PK, alternate-key and FK names without dropping their constraints. It adds a unique expression index on lower(MeetingCode). It does not drop/recreate application tables, alter rows, regenerate existing codes, or remove session/withdrawal information. Composite attendee/meeting ownership, FIFO indexes, single-speaker and single-organizer constraints survive.

Keep `__EFMigrationsHistory`. On this installation it had previously been deleted by request; before the rename it was restored from the verified history-only backup corresponding to the three already-applied migrations. Never invent applied-migration records for an unknown schema or run the initial migrations blindly against existing tables.

## Backup before applying

Stop any API using the old table mappings, then:

```bash
mkdir -p backups
pg_dump -h localhost -d SmartMeetDB -Fc -f backups/before-code-summary-rename.dump
pg_restore --list backups/before-code-summary-rename.dump
```

The backup is ignored by Git. It contains private participant data and token hashes; keep it local.

For a restored-copy trial:

```bash
createdb -h localhost CAPS_aiCodeVerify
pg_restore -h localhost -d CAPS_aiCodeVerify backups/before-code-summary-rename.dump
export ConnectionStrings__SmartMeetDB='Host=localhost;Database=CAPS_aiCodeVerify;Timeout=5'
dotnet ef database update --project CAPS_ai.API
python3 checks/verify_rename.py SmartMeetDB CAPS_aiCodeVerify
```

If the specific backup was taken while migration history was absent, restore only the separately verified history backup matching that schema before the EF update. A normal complete backup already includes history; do not restore it twice.

The comparison checks exact original rows, not just counts, and asserts the three renamed tables, retained history, and validated FKs. To exercise API checks in the copy:

```bash
dotnet run --project CAPS_ai.API --no-launch-profile --urls http://localhost:5051
```

In another terminal:

```bash
python3 checks/core_api.py http://localhost:5051
python3 checks/code_summary_api.py http://localhost:5051 CAPS_aiCodeVerify
```

The scripts create retained test records. The latter deliberately forces one insert collision through a temporary test-only trigger to verify rollback/retry, then removes that trigger/function/sequence. Never run it against the working database.

After verification, restore your normal connection configuration and apply:

```bash
unset ConnectionStrings__SmartMeetDB
dotnet ef database update --project CAPS_ai.API
dotnet run --project CAPS_ai.API
```

Use your actual normal connection instead if it is not the default. Reload Angular after both layers are updated.

## Rollback

The rename has a reversible Down migration: it removes the new case-insensitive index and renames the tables/indexes/constraints back, preserving rows. Stop the new API before downgrading, and use the previous application version afterward. A backup restored into a separate recovery database is the safest inspection route if unrelated schema drift is suspected.

## Unchanged codes and legacy access

Existing stored codes remain byte-for-byte unchanged. Normalized lowercase lookups accept old hexadecimal and LEGACY codes as well as new abc-defg-hij codes. New code generation is cryptographically secure; concurrent duplicate inserts are rejected by the database and the entire create transaction is retried up to five times.

Summary access uses the associated organizer session. Historical meetings without recoverable organizers remain readable through their existing dashboards; identity is never assigned arbitrarily. Summary visitor totals exclude organizers/unclaimed historical users, and average speaking duration covers only answered questions with a saved duration. Timeline events are derived from persisted times, not an added event-log table.
