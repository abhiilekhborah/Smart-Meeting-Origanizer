# Three-table restructuring migration

## Data changes and approval

`20261023040905_RestructureUsersAndSessions` removes QuestionVotes and Announcements permanently, including their existing data. Their removal was explicitly approved for this working installation. Meetings and questions must not be reset or recreated.

A backup is required before applying this migration to any other existing installation. Stop the old API so it cannot write while the schema changes.

## Backup and verify restore

From the repository root with PostgreSQL tools available:

```bash
mkdir -p backups
pg_dump -h localhost -d SmartMeetDB -Fc -f backups/before-user-restructure.dump
pg_restore --list backups/before-user-restructure.dump
createdb -h localhost SmartMeetRestructureVerify
pg_restore -h localhost -d SmartMeetRestructureVerify backups/before-user-restructure.dump
```

`backups/` is ignored by Git. Keep the dump private. Restore into a new empty database; do not overwrite another database during verification. Use a distinct name if the verification database already exists.

## Backfill policy

1. Add Users and new meeting/question fields.
2. Create one historical Visitor per old question, copying its exact name, organization, meeting, and submission time. Do not merge people by name or infer that repeated names prove identity.
3. Set Question.UserId to the backfilled User. Retain the question ID, text, status, all existing timestamps, and WithdrawalTokenHash unchanged.
4. Give historical users no session token and mark them inactive. Matching a name cannot claim these identities.
5. Copy Meeting.CreatedAt to StartedAt. Give historical meetings deterministic unique codes `LEGACY-{MeetingId}`. Do not invent organizer users; these meetings remain readable without management access.
6. Default historical categories to General and backfill answered speaking duration only when both original timestamps exist.
7. Drop duplicate Name/Organization columns from Questions after their values are in Users.
8. Add restricted and composite ownership FKs and indexes. Existing FIFO/single-speaker indexes remain intact.
9. Remove the two discarded feature tables in the same migration transaction.

The designated organizer is the unique Users row with Role=Organizer for that meeting. A partial unique index and transactional creation provide organizer identification without a circular Meetings.OrganizerId foreign key. DTOs return the derived organizer ID/name; historical meetings return null. Counts are calculated from session-backed Visitor rows and are not duplicated in Meetings.

## Apply first to the restored copy

Use an environment connection override so your normal database remains untouched:

```bash
export ASPNETCORE_ENVIRONMENT=Development
export ConnectionStrings__SmartMeetDB='Host=localhost;Port=5432;Database=SmartMeetRestructureVerify;Timeout=5'
dotnet tool restore
dotnet ef database update --project SmartMeet.API
dotnet run --project SmartMeet.API --no-launch-profile --urls http://localhost:5051
```

Inspect the restored copy with `psql` before using it. Confirm original meeting/question IDs, texts, timestamps, statuses, and participant names are preserved through the Users relationship. Confirm that Users, Meetings, Questions, and EF migration history are the only tables after migration.

The automated verification scripts used during implementation have since been removed from this assignment copy. Their actual results remain in [VERIFICATION.md](VERIFICATION.md).

## Apply to the working database

After backup verification, testing, and approval to discard votes/announcements:

```bash
unset ConnectionStrings__SmartMeetDB
dotnet ef database update --project SmartMeet.API
dotnet run --project SmartMeet.API
```

If you use a custom normal connection, set that connection instead of simply unsetting the override. Restart the API and reload the frontend so both use the new contracts.

## Recovery

This migration's Down method intentionally refuses a destructive schema downgrade that would lose new users, sessions, notes, and categories while failing to recover deleted feature data. A backup restore is the recovery path.

First stop application writes. Restore the pre-migration backup into a separate recovery database, then verify it:

```bash
createdb -h localhost SmartMeetRecovery
pg_restore -h localhost -d SmartMeetRecovery backups/before-user-restructure.dump
psql -h localhost -d SmartMeetRecovery -c '\dt'
```

Use the pre-restructuring application version with that database. Switching back also discards post-backup application changes unless you separately reconcile them; do not overwrite the working database casually. The dump restores the original feature tables and records.

## Legacy withdrawal and session safety

Existing browser `smartMeet.withdrawalTokens` keys are retained and accepted only for the corresponding unclaimed historical question. They cannot authorize organizer actions or claim an entire historical participant. New question ownership is determined exclusively through a server-issued visitor session. Session/withdrawal hashes never appear in public DTOs. Organizer tokens have no password-recovery workflow in this assignment.
