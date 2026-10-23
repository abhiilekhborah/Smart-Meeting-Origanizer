# Verification — 23 October 2026

Historical results recorded before the test source folders were removed. These are not commands or tests available in the current assignment copy.

## Builds and automated tests

- ASP.NET Core build: passed with zero warnings/errors.
- Backend unit tests: 22 passed.
- Angular production build: passed (approximately 401 kB initial raw bundle).
- Frontend unit tests: 18 passed, including the existing ten dictation lifecycle tests.
- Session-aware API integration: 53 HTTP checks plus assertions passed against an isolated restored PostgreSQL database.
- Additional real-database checks passed for token hashing, session reuse, inactivity expiry/heartbeat, composite ownership FK, unique meeting code, single organizer, single speaker, and safe legacy withdrawal.
- Swagger verified on the working API: current user/join routes and session scheme present; removed feature routes absent.
- EF Core pending-model check: passed; no model changes since the latest migration.

## Database migration

- Created private backups before the change and a final backup with the old API stopped.
- Verified archive contents and restored the original backup into SmartMeetRestructureVerify.
- Applied the migration to that copy and compared all original meeting/question fields, including names, timestamps, statuses, and withdrawal hashes.
- Applied the approved migration to SmartMeetDB, then compared its two original meetings and two original questions against a private pre-migration snapshot: unchanged.
- Working database has Users, Meetings, Questions, and __EFMigrationsHistory only.
- Confirmed the full migration chain also succeeds against a fresh SmartMeetFreshVerify database.
- The removed data consisted of zero votes and one announcement in the original working database. Those discarded records remain recoverable in the private backup.

## Browser verification

Used a separate frontend preview connected only to the verification database, keeping test fixtures out of SmartMeetDB. Verified:

1. Meeting creation with organizer identity and description.
2. Visitor join with server-issued session.
3. Refresh retains the same visitor and keeps the joined visitor count at one.
4. Question submission with the microphone control retained and category available.
5. Note editing and display.
6. FIFO speaker selection and answer completion with saved speaking duration.
7. Participant modal showing organizer/visitor activity.
8. Original three-column organizer layout and existing colors.
9. Current working home page and read-only historical meeting access.
10. SSMS-style SVG diagram layout and table/column labels.

Browser microphone recording itself was not exercised; its unchanged controller is covered by automated tests. The speech service still depends on browser support and permissions.

The temporary verification servers are stopped after testing. The working frontend/API retain ports 4200/5050. Test databases remain separate for inspection. Backups and private snapshots are ignored by Git.
