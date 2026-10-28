# Verification — 26 October 2026

## Builds and automated checks

- ASP.NET Core build passed with zero warnings/errors using the installed .NET 10 SDK.
- Backend checks: **26 passed** (code format/normalization, 10,000-code uniqueness sample, invalid/legacy codes, summary statistics/timeline, token hashes, restored FIFO/session rules).
- Frontend checks: **23 passed** (ten unchanged dictation checks, eight search/filter checks, five invitation/configuration/QR checks).
- Angular production build passed: approximately **429 kB** initial raw bundle, with the QR browser implementation lazy-loaded separately (approximately 25 kB raw).
- Session/FIFO/ownership HTTP regression: **53 HTTP checks plus assertions passed** against isolated PostgreSQL.
- Code/summary integration passed: normalized lookup, invalid/ended codes, shared visitor reuse, numeric-link workflow, organizer-only detailed summary, participant/question totals, saved durations/notes/timeline, repeated reads, cross-meeting rejection, case-insensitive uniqueness, and a real forced insert collision with successful transaction rollback/retry.
- EF Core model snapshot check passed: no pending model changes.
- Markdown links, SVG syntax, and the rename migration's absence of DropTable/CreateTable operations were checked.

## Database preservation

- Actual starting tables and columns were inspected; there were 7 meetings, 11 attendees, and 6 questions.
- A fresh full backup and private exact-record snapshot were saved under ignored `backups/`.
- The previously deleted EF history table was restored from its verified history-only backup, matching the three existing migrations.
- The current backup was restored into SmartMeetCodeVerify, and the rename migration was applied there first.
- Exact comparisons confirmed all original 7 meetings, 11 attendees, and 6 questions were preserved, including IDs, existing codes, session/withdrawal hashes, notes, timestamps, and speaking history.
- The same migration was then applied to SmartMeetDB. Every working row matched the pre-migration snapshot exactly afterward.
- Working tables: Meeting, MeetingAttendees, MeetingQuestions, __EFMigrationsHistory. All three foreign keys remain validated; the composite ownership relationship is intact.
- Complete migration chain was applied to a separate empty SmartMeetCodeFresh database; the three expected tables and all four history rows were verified.
- Test fixtures were created only in the isolated copy, not in SmartMeetDB.

## Browser verification

A temporary frontend on 4201 proxied only to the isolated API/database on 5051.

Verified meeting creation, actual title/organizer/date/status, readable code, QR modal, PNG download link and filename, direct uppercase-code invitation, registration, valid-session redirect without duplicate attendees, categorized submission, note/answer controls, meeting completion, summary filtering, ended-card navigation, and persisted summary after a real backend restart plus browser reload.

The generated QR PNG was decoded using macOS Core Image. It contained exactly the public `/join/{code}` URL and no token.

The 1280-pixel desktop layout showed three aligned panels, no page-width overflow, a roughly 102-pixel meeting header, and `overflow-y: auto` on the question queue. A real 390-pixel iframe preview showed responsive wrapping without overlapping controls. The renamed SSMS-style diagram was also visually inspected.

No physical phone scan or live microphone recording was performed. The actual PNG decoding, browser QR generation/download, and existing dictation lifecycle checks passed. Phone access still requires a reachable configured public base URL; voice-service availability depends on browser permissions/support and a suitable secure context.

Temporary verification servers are stopped after the checks. Application ports 4200/5050 remain free so the owner can run the app. Test databases are retained separately for inspection. Backups/private snapshots are excluded from Git.

## Project rename verification — 27 October 2026

- Renamed the local source root to CAPS_ai; API project/assembly/namespaces to CAPS_ai.API; DbContext to CAPS_aiDbContext; solution to CAPS_ai.slnx; frontend folder to CAPS_ai-frontend; checks project to CAPS_ai.Checks. npm/Angular use caps-ai-compatible names.
- Updated documentation paths, launch profile, project references, snapshot metadata, and QR download filename prefix. External report filenames were renamed to CAPS_ai prefixes; their existing historical PDF/image contents were not regenerated.
- Clean backend and frontend builds passed. Backend checks: 26 passed. Frontend checks: 23 passed.
- HTTP session/FIFO/ownership regression: 53 checks plus assertions passed; code/summary/collision integration passed against CAPS_aiProjectVerify, a copy of the working database.
- Original-record comparisons passed for 9 meetings, 15 attendees, and 9 questions. The working database was not migrated or changed; its deliberately removed EF history table remains absent.
- EF Core reports no pending model changes after namespace/context/snapshot renaming.
- Normal renamed launch profile, Swagger (CAPS_ai.API), Angular dev-server startup, frontend API proxy, and deep-link serving were verified.
- Persisted database/connection keys, browser-session/legacy withdrawal keys, and the local user-secrets ID remain compatible. Source and database verification backups are private under ignored backups/.
- Temporary test servers are stopped afterward; normal application ports remain free.
