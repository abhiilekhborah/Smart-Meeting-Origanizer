# Smart Meet — Codebase Report

## 1. Purpose and structure

Smart Meet manages meeting participants, questions, and FIFO speaking order. Angular provides the interface, ASP.NET Core implements the API and application rules, and EF Core/Npgsql persists data in PostgreSQL.

```text
SmartMeet/
├── SmartMeet.API/          Backend
├── smart-meet-frontend/    Angular frontend
├── docs/                  Migration guide and database diagrams
├── SmartMeet.slnx          .NET solution
├── .config/               Pinned EF CLI tool
├── README.md              Setup, features, architecture, scope
└── START_HERE.md           VS Code and database inspection guide
```

## 2. Backend files — SmartMeet.API

| File | Contents |
|---|---|
| `Program.cs` | Registers controllers, DbContext, services, HTTP context access, CORS, Swagger bearer-session documentation, and JSON exception handling. |
| `SmartMeet.API.csproj` | .NET 10 target, EF/Npgsql/Swagger dependencies, and user-secrets identifier. |
| `appsettings.json` | Password-free local PostgreSQL connection and logging configuration. |
| `Properties/launchSettings.json` | Development environment and port 5050. |
| `Controllers/MeetingsController.cs` | List/get/create/end/summary routes, visitor join, and organizer-only participant listing. |
| `Controllers/UsersController.cs` | Current session user and activity heartbeat endpoints. |
| `Controllers/QuestionsController.cs` | Submit/list/pending/speaking/answered/next/answer/withdraw/note endpoints. |
| `DTOs/Requests.cs` | Validated input records and response DTOs, including meeting creation with organizer session, user sessions, participants, categories, notes, and summaries. |
| `Models/Meeting.cs` | Title, description, unique code, creation/start/end times, status, Users and Questions relationships. |
| `Models/User.cs` | Meeting-linked participant identity, optional email, role, join/activity fields, internal session hash, and questions. |
| `Models/Question.cs` | Meeting/user ownership, text/category/status, lifecycle times, completed duration, organizer note, and legacy withdrawal hash. |
| `Data/SmartMeetDbContext.cs` | Three DbSets; explicit restricted relationships; composite user/meeting ownership FK; keys, lengths, status/category/duration constraints; unique code/session/organizer/speaker indexes. |
| `Services/SessionService.cs` | Reads bearer token, validates its hash, resolves the actual user, enforces meeting/role, joins/reuses visitors, records heartbeats, and returns participants with effective activity and a historical flag. |
| `Services/MeetingService.cs` | Transactionally creates meeting plus Organizer user, generates unique codes, derives organizer/count fields, ends meetings, and calculates summaries. Also contains MeetingLock. |
| `Services/QuestionService.cs` | Session-derived submission ownership, question projection through User, FIFO selection, answer duration, notes, session-owned withdrawal, and restricted legacy-token fallback. |
| `Services/QueueRules.cs` | FIFO ordering and allowed transitions; active-meeting checks; completed duration; ApiException. |
| `Services/TokenSecrets.cs` | Random secret creation, SHA-256 hashing, token validation, and fixed-time hash comparison. This is hashing, not encryption. |
| `Services/SummaryCalculator.cs` | Uses StartedAt and EndedAt for duration and calculates question status totals plus registered visitor count. |
| `Migrations/*InitialPostgres*` | Historical initial Meetings/Questions schema. |
| `Migrations/*AddMeetingParticipationFeatures*` | Historical schema changes; retained so existing databases and fresh installations share the same migration chain. |
| `Migrations/*RestructureUsersAndSessions*` | Creates Users, backfills historical participant identities, adds meeting/question fields, preserves legacy hashes, drops old participant columns and the two removed feature tables, and adds constraints. |
| `Migrations/*.Designer.cs` | Generated metadata for each historical migration. |
| `Migrations/SmartMeetDbContextModelSnapshot.cs` | Latest model snapshot used when scaffolding the next migration. |

Historical migrations still mention removed tables because they record past schema states. Runtime entities, controllers, DTOs, services, and UI no longer implement those features. The restructuring migration is forward-only; restore the verified backup for recovery.

## 3. Frontend configuration — smart-meet-frontend

| File | Contents |
|---|---|
| `src/main.ts` | Root router outlet and Angular bootstrap. |
| `src/index.html` | Base HTML shell, root element, title, and metadata. |
| `src/app/app.config.ts` | HTTP client and router registration. |
| `src/app/app.routes.ts` | Home, organizer dashboard, visitor dashboard, and unknown-route fallback. Role route data controls presentation, not server permissions. |
| `angular.json` | Entry points, global styles, build options, and development server. |
| `package.json`, `package-lock.json` | Dependencies, locked versions, and start/build/test commands. |
| `proxy.conf.json` | Proxies `/api` to localhost:5050. |
| `tsconfig.json`, `tsconfig.app.json` | TypeScript compiler configuration. |
| `src/styles.css` | Shared navigation, forms, panels, buttons, cards, timer, dialogs, and responsive layout. |
| `src/features.css` | Meeting details/counts, join form, participant list, filters, notes, withdrawal, and summary styling. |

## 4. Frontend components — src/app/components

Most components contain their HTML inside the TypeScript `template` property rather than separate HTML files.

| File | Contents |
|---|---|
| `home.component.ts` | Lists existing meetings and hosts the creation form. |
| `home.component.css` | Home layout and spacing. |
| `navbar.component.ts` | Meeting title/status, role navigation, and organizer controls enabled by a validated organizer session. |
| `create-meeting.component.ts` | Collects title, optional description, organizer name/organization; saves the returned organizer session and opens the dashboard. Exports the shared nonBlank validator. |
| `join-meeting.component.ts` | Name/organization/optional-email form; saves the server-issued visitor session and notifies the dashboard. |
| `dashboard.component.ts` | Coordinates polling/heartbeats, session validation, meeting metadata, counts, filters, current speaker, actions, participant modal, note editor, summaries, and errors. Preserves the three-panel organizer layout. |
| `question-form.component.ts` | Session-backed question/category form and voice-text appending; participant identity is collected at join time. |
| `question-list.component.ts` | Cards with identity/category/status/timestamps/duration/notes; emits owner withdrawal and organizer note-edit events. |
| `speaking-panel.component.ts` | Current speaker/question and elapsed timer from the persisted timestamp; emits next/answer events. |
| `voice-input.component.ts` | Microphone controls, support detection, feedback, dictation event integration, and cleanup. One English setting. |
| `voice-input.component.css` | Dictation control styling. |
| `meeting-summary.component.ts` | Start/end/duration, question status counts, and registered visitors. |

## 5. Frontend services and models — src/app

| File | Contents |
|---|---|
| `services/meeting.service.ts` | Meeting HTTP calls and apiError helper. Uses organizer header for ending. |
| `services/user.service.ts` | Join, current user, heartbeat, and organizer participant-list HTTP calls. |
| `services/question.service.ts` | Question reads, visitor submission/withdrawal, organizer next/answer/note operations, and appropriate session headers. |
| `services/visitor-session.service.ts` | Per-meeting/per-role private session storage, memory fallback, storage warning, and legacy question-key reading. Tokens are sent in Authorization headers, not URLs. |
| `services/dictation.ts` | Speech recognition state machine, interim/final text, duplicate-result prevention, errors, stop/cancel, and event cleanup. |
| `services/question-filter.ts` | Search plus status/category filters, preserving incoming FIFO order. |
| `models/meeting.model.ts` | Meeting, summary, participant, session, and created-meeting response types. |
| `models/question.model.ts` | Category, Question, and CreateQuestion types. |

## 6. Database design decisions

There are three application tables: Users, Meetings, Questions. EF also maintains `__EFMigrationsHistory`.

- Each user belongs to one meeting. A person joining another meeting gets a separate meeting-scoped session.
- The organizer is the unique Organizer user within that meeting. It is returned as OrganizerId/OrganizerName in DTOs; there is no redundant Meetings.OrganizerId column or circular FK.
- Every new meeting and organizer are saved in one transaction.
- Every question references a User and Meeting. The composite user/meeting FK prevents cross-meeting ownership even if incorrect data bypasses the API.
- Historical questions each receive an unclaimed User preserving their original name/organization. Names are not used to merge identities. Historical session hashes are null; no organizer is invented.
- Registered visitor totals exclude unclaimed historical users. Active counts require a live meeting, IsActive, and LastSeenAt within 60 seconds. Browser closure is detected through inactivity rather than an assumed disconnect event.
- Questions retain nullable WithdrawalTokenHash only for safe legacy withdrawal. New submissions rely on session ownership.
- StartedAt is copied from CreatedAt for old meetings. Existing end/answer/withdrawal times and question states remain unchanged.

See [the diagrams](docs/DATABASE_DIAGRAMS.md) for all columns, types, nullability, and relationships.

## 7. Request flows

### Create meeting

CreateMeetingComponent → frontend MeetingService → MeetingsController → backend MeetingService → transaction inserts Meeting and Organizer User → PostgreSQL. The response includes the public meeting and private organizer session. Browser storage remembers the session.

### Join / refresh

JoinMeetingComponent → UserService → SessionService.Join → active-meeting lock → insert Visitor and hash token. With a valid visitor token, joining returns the same user. On refresh, the dashboard uses the stored token for heartbeat and reuses that identity; it does not create a new User.

### Submit question

QuestionFormComponent → frontend QuestionService → QuestionsController → backend QuestionService → validates visitor session/meeting → derives UserId on the server → stores text/category as Pending. Client-supplied names, roles, or UserId cannot override session identity.

### Select and answer

SpeakingPanel event → Dashboard → API → organizer/session check → meeting-row lock → PendingInOrder → Speaking. Answering sets AnsweredAt and completed seconds. The timer uses SpeakingStartedAt, so reloading preserves elapsed time. Only one speaker is permitted by both logic and a PostgreSQL partial unique index.

### Withdraw

Visitor session must own the Pending question in the same active meeting. A legacy token may instead withdraw only its original unclaimed historical question; it never claims the historical user's other capabilities.

### End

Associated organizer session → lock meeting → return current speaker to Pending → set EndedAt once → mark users inactive → summary. Joining, submissions, selection, answering, and withdrawal are then closed. Organizer notes can still be edited for retained history.

### Voice

Browser SpeechRecognition → DictationSession → finalized text event → editable form field → normal explicit submission. No audio is stored in the API or database.

## 8. API map

| Method | Endpoint | Session requirement |
|---|---|---|
| GET | `/api/meetings`, `/api/meetings/{id}` | Public |
| POST | `/api/meetings` | Public; issues organizer session |
| POST | `/api/meetings/{id}/join` | Public for new visitor; reuses supplied valid visitor session |
| GET | `/api/meetings/{id}/participants` | Associated organizer |
| GET | `/api/users/me` | Valid session |
| POST | `/api/users/heartbeat` | Valid session |
| PUT | `/api/meetings/{id}/end` | Associated organizer |
| GET | `/api/meetings/{id}/summary` | Public, ended meetings only |
| POST | `/api/questions` | Visitor in the same meeting |
| GET | `/api/questions/meeting/{id}` and `/pending`, `/speaking`, `/answered` | Public |
| PUT | `/api/questions/meeting/{id}/next` | Associated organizer |
| PUT | `/api/questions/{id}/answer`, `/api/questions/{id}/note` | Associated organizer |
| POST | `/api/questions/{id}/withdraw` | Owning visitor, or original legacy question key |

Swagger includes the anonymous bearer-token scheme. It is an opaque random token, not a JWT.

## 9. Supporting documents

Test source folders and their project/script references have been removed because they are not runtime dependencies. Their removal does not change the frontend, API, or database code. Historical verification results remain in `docs/VERIFICATION.md`.

| File | Responsibility |
|---|---|
| `docs/MIGRATION.md` | Backup/restore procedure, transitional identity design, and migration recovery. |
| `docs/DATABASE_DIAGRAMS.md`, `docs/*.svg`, `docs/database-er.mmd` | Current ER and SSMS-style PostgreSQL diagrams and editable source. |
| `docs/VERIFICATION.md` | Results recorded before test source removal. |

## 10. Presentation order

Demonstrate creating a meeting, joining, submitting a categorized question, selecting/answering it, notes, participant activity, and ending. Then trace the form → HTTP client → controller → service → DbContext path. Explain the three tables, anonymous session ownership, preserving legacy migration, FIFO locking, and tests.
