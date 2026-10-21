# Smart Meet — Codebase Report

## 1. Project overview

Smart Meet is a meeting question-management application. Visitors submit questions by typing or using microphone dictation. The organizer selects questions in first-in, first-out (FIFO) order, manages the current speaker, marks questions as answered, publishes announcements, and ends the meeting.

The application also supports question upvotes, withdrawal of a visitor's own pending question, organizer search and status filters, and an end-of-meeting summary.

| Layer | Technology | Responsibility |
|---|---|---|
| Frontend | Angular, TypeScript, HTML, CSS | Displays pages, collects input, and calls the API |
| Backend | ASP.NET Core on .NET 10, C# | Validates requests, applies meeting rules, and accesses data |
| Database access | Entity Framework Core with Npgsql | Translates C# database operations into PostgreSQL commands |
| Database | PostgreSQL | Stores meetings, questions, votes, and announcements |
| Voice input | Browser speech recognition API | Converts speech into editable question text |

During local development, the frontend runs on port **4200**, and the API runs on port **5050**. The Angular development proxy forwards `/api` requests to the API.

## 2. Main folder structure

```text
SmartMeet/
├── SmartMeet.slnx                  .NET solution
├── README.md                       Project overview and setup information
├── START_HERE.md                    Startup and database inspection guide
├── CODEBASE_REPORT.md               This report
├── SmartMeet.API/                   Backend application
│   ├── Program.cs
│   ├── Controllers/
│   ├── Services/
│   ├── Models/
│   ├── DTOs/
│   ├── Data/
│   ├── Migrations/
│   ├── Properties/
│   ├── appsettings.json
│   └── SmartMeet.API.csproj
├── smart-meet-frontend/             Angular application
│   ├── src/
│   │   ├── app/
│   │   │   ├── components/
│   │   │   ├── services/
│   │   │   ├── models/
│   │   │   ├── app.routes.ts
│   │   │   └── app.config.ts
│   │   ├── main.ts
│   │   ├── index.html
│   │   ├── styles.css
│   │   └── features.css
│   ├── tests/
│   ├── angular.json
│   ├── package.json
│   ├── package-lock.json
│   ├── proxy.conf.json
│   ├── tsconfig.json
│   └── tsconfig.app.json
└── SmartMeet.Tests/                 Backend unit tests and API smoke tests
```

All file paths in the tables below are relative to the folder named in the section.

## 3. Backend: SmartMeet.API

The backend is divided into controllers, services, models, and database configuration. Controllers receive HTTP requests. Services perform the work. Entity Framework Core saves and reads the records in PostgreSQL.

### 3.1 Startup and configuration

| File | Contents and purpose |
|---|---|
| `Program.cs` | Starts the API; registers controllers, Swagger, PostgreSQL DbContext, and services; configures CORS; converts application and database exceptions into JSON error responses; maps controller routes. |
| `SmartMeet.API.csproj` | Declares the .NET target and dependencies, including EF Core, the Npgsql PostgreSQL provider, and Swagger. Also declares the local user-secrets identifier. |
| `appsettings.json` | Application configuration, including the database connection-string configuration and logging settings. Local configuration can be overridden through .NET configuration sources such as user secrets. |
| `Properties/launchSettings.json` | Local launch profiles, environment settings, and development URLs. |

### 3.2 Controllers: HTTP entry points

| File | Contents and purpose |
|---|---|
| `Controllers/MeetingsController.cs` | Routes for listing, retrieving, creating, and ending meetings; retrieving summaries; listing and publishing announcements. Delegates the work to `IMeetingService`. |
| `Controllers/QuestionsController.cs` | Routes for submitting and listing questions, retrieving pending/answered/speaking questions, selecting the next question, marking an answer, upvoting, and withdrawing. Delegates the work to `IQuestionService`. |

Controllers return HTTP responses such as `200 OK`, `201 Created`, and `204 No Content`. Validation attributes and service exceptions produce error responses where required.

### 3.3 Services: application rules

| File | Contents and purpose |
|---|---|
| `Services/MeetingService.cs` | Contains `IMeetingService` and `MeetingService`. Creates and reads meetings, ends meetings, publishes/reads announcements, and retrieves summary data. Also contains `MeetingLock`, which obtains a PostgreSQL meeting-row lock inside a transaction. |
| `Services/QuestionService.cs` | Contains `IQuestionService` and `QuestionService`. Saves questions, returns public question responses, selects the next pending question, marks answers, records upvotes, and validates withdrawal ownership. Uses transactions and meeting locks for mutations. |
| `Services/QueueRules.cs` | Contains reusable rules for FIFO ordering, checking whether a meeting is active, starting a speaker, and marking an answer. Also defines `ApiException`, which carries an HTTP status and a readable message. |
| `Services/SummaryCalculator.cs` | Calculates meeting duration, total questions, answered questions, pending questions, withdrawn questions, and total upvotes. |
| `Services/TokenSecrets.cs` | Creates random tokens, hashes tokens with SHA-256, validates their format, and compares withdrawal-token hashes using a fixed-time comparison. |

The service layer keeps application rules out of the controllers. For example, the controller does not decide which question is next; `QuestionService` uses `QueueRules.PendingInOrder()` to make that decision.

### 3.4 Models: stored records

| File | Main fields and relationships |
|---|---|
| `Models/Meeting.cs` | Meeting ID, title, creation time, status, and optional end time. A meeting has many questions and announcements. |
| `Models/Question.cs` | Question ID, meeting ID, participant name, organization, text, status, submission/speaking/answer/withdrawal timestamps, withdrawal-token hash, and related votes. |
| `Models/QuestionVote.cs` | Vote ID, question ID, visitor-token hash, and creation time. Each vote belongs to one question. |
| `Models/Announcement.cs` | Announcement ID, meeting ID, message, and creation time. Each announcement belongs to one meeting. |

### 3.5 DTOs: request and response formats

`DTOs/Requests.cs` contains the data transfer objects used by the API. Although the filename says Requests, it contains both requests and responses.

| DTO | Purpose |
|---|---|
| `CreateMeetingDto` | Receives the meeting title. |
| `CreateQuestionDto` | Receives meeting ID, participant name, organization, and question text. |
| `MeetingResponseDto` | Returns public meeting details. |
| `QuestionResponseDto` | Returns public question details and vote count. |
| `CreatedQuestionResponseDto` | Returns a newly created question and its private withdrawal token. |
| `UpvoteDto` | Receives the browser visitor token. |
| `WithdrawQuestionDto` | Receives the private withdrawal token for a question. |
| `CreateAnnouncementDto` | Receives an announcement message, limited to 300 characters. |
| `AnnouncementResponseDto` | Returns an announcement. |
| `MeetingSummaryDto` | Returns the meeting's timing and question/vote totals. |

DTO validation includes required values, maximum lengths, valid IDs, and token format. Public question-list responses do not expose private tokens or their hashes.

### 3.6 Database configuration and migrations

| File | Contents and purpose |
|---|---|
| `Data/SmartMeetDbContext.cs` | Declares the four database sets and configures primary keys, foreign keys, lengths, status constraints, indexes, and delete restrictions. |
| `Migrations/20261021102438_InitialPostgres.cs` | Initial schema: creates `Meetings` and `Questions`, their relationships, status constraints, and queue indexes. |
| `Migrations/20261021151222_AddMeetingParticipationFeatures.cs` | Adds announcements, votes, meeting end time, withdrawal fields, and the `Withdrawn` question status. |
| `Migrations/*.Designer.cs` | Generated metadata describing the EF Core model at the time of each migration. |
| `Migrations/SmartMeetDbContextModelSnapshot.cs` | Generated snapshot of the latest model; EF Core compares it with the current model when creating another migration. |

A migration filename follows `YYYYMMDDHHmmss_Description.cs`. For example, `20261021102438_InitialPostgres.cs` has the timestamp `2026-10-21 10:24:38` and the migration name `InitialPostgres`.

Each migration has an `Up()` method that applies its schema changes and a `Down()` method that reverses them. These files contain C# schema instructions; EF Core generates the PostgreSQL SQL. The application does not depend on a separate hand-written `.sql` schema file.

Migrations define table structure, not the live contents of the tables. Actual records are stored in PostgreSQL. EF Core also uses `__EFMigrationsHistory` to track applied migrations. Starting the API does not automatically apply migrations in the current `Program.cs`; database updates are a separate setup step described in `START_HERE.md`.

## 4. Frontend: smart-meet-frontend

The frontend uses standalone Angular components. Most components keep their HTML template inside the `.component.ts` file in the `template` property, so there are no separate `.component.html` files for them.

### 4.1 Entry points, routing, and configuration

| File | Contents and purpose |
|---|---|
| `src/main.ts` | Defines the small root component containing the router outlet and bootstraps Angular using `appConfig`. |
| `src/index.html` | Base HTML page containing the application root element, browser title, and page metadata. |
| `src/app/app.config.ts` | Registers Angular's HTTP client and router. |
| `src/app/app.routes.ts` | Maps the home page and organizer/visitor URLs to their components. Adds a fallback redirect for unknown routes. |
| `angular.json` | Defines Angular build and development-server settings, entry files, global styles, output folder, and proxy configuration. |
| `package.json` | Lists frontend dependencies and scripts: `npm start`, `npm run build`, and `npm test`. |
| `package-lock.json` | Records resolved dependency versions for repeatable installation. |
| `proxy.conf.json` | Forwards development requests beginning with `/api` to `http://localhost:5050`. |
| `tsconfig.json`, `tsconfig.app.json` | Configure TypeScript compilation for the project and application. |

The application routes are:

| URL | Component | Purpose |
|---|---|---|
| `/` | `HomeComponent` | Create a meeting or open an existing meeting. |
| `/meeting/:id/organizer` | `DashboardComponent` | Organizer dashboard for the selected meeting. |
| `/meeting/:id/visitor` | `DashboardComponent` | Visitor dashboard for the selected meeting. |

Both dashboard routes use the same component. Route data supplies the role, and the template displays the appropriate controls.

### 4.2 Components: visible interface

All files in this table are under `src/app/components/`.

| File | Contents and purpose |
|---|---|
| `home.component.ts` | Meetings page: loads existing meetings and includes the create-meeting form. |
| `home.component.css` | Layout and spacing specific to the home page. |
| `navbar.component.ts` | Application navigation, current meeting information, organizer/visitor links, and meeting action buttons. Emits actions to the dashboard. |
| `create-meeting.component.ts` | Reactive form for a meeting title; validates it, creates a meeting through the API, and navigates to its organizer page. Defines the shared `nonBlank` validator. |
| `dashboard.component.ts` | Main coordination component. Loads meeting data, polls for updates every four seconds while active, calculates visible lists, handles search/status filtering, calls action services, displays notices, manages dialogs, copies invite links, and loads the summary. |
| `question-form.component.ts` | Visitor submission form for name, organization, and question. Validates input, appends dictated text, submits through the question service, and remembers the returned withdrawal token. This form appears only in visitor view. |
| `question-list.component.ts` | Reusable question cards and empty states. Displays participant information, text, status, timestamps, votes, and applicable upvote/withdraw controls. Emits actions to the dashboard. |
| `speaking-panel.component.ts` | Shows the current speaker and question, computes elapsed speaking time, and provides organizer next/answer controls or visitor voting. |
| `voice-input.component.ts` | Microphone button, browser support detection, recording feedback, transcript preview, and dictation lifecycle integration. Uses one fixed English recognition setting without a language dropdown. |
| `voice-input.component.css` | Styles the microphone button and recording feedback. |
| `announcements.component.ts` | Displays announcements and provides the organizer's validated publishing form. |
| `meeting-summary.component.ts` | Displays meeting times, duration, question totals, and total upvotes. |

Components communicate through Angular inputs and outputs. For example, the speaking panel emits `next`; the dashboard handles that event and calls the backend.

### 4.3 Frontend services and helpers

All files in this table are under `src/app/services/`.

| File | Contents and purpose |
|---|---|
| `meeting.service.ts` | HTTP methods for meetings, announcements, and summaries. Also defines `apiError()` to turn HTTP and validation errors into readable messages. |
| `question.service.ts` | HTTP methods for question listing, submission, next-speaker selection, answering, upvoting, and withdrawal. |
| `visitor-session.service.ts` | Creates/remembers a browser visitor token, stores private question-withdrawal tokens, remembers voted question IDs, and reports local-storage failures. Uses browser local storage with an in-memory fallback for the current page. |
| `dictation.ts` | Framework-independent speech recognition controller. Handles start/stop/cancel, interim and final results, duplicate final-result prevention, errors, and microphone-event cleanup. |
| `question-filter.ts` | Searches by participant name, organization, or question text and filters by status. Preserves the input order; votes do not reorder the queue. |

### 4.4 Frontend data types and styles

| File | Contents and purpose |
|---|---|
| `src/app/models/meeting.model.ts` | TypeScript types for meetings, announcements, and meeting summaries. |
| `src/app/models/question.model.ts` | TypeScript types for question statuses, public questions, new-question requests, and created-question responses. |
| `src/styles.css` | Shared application styling such as navigation, panels, forms, buttons, question cards, dialogs, and responsive layout. |
| `src/features.css` | Additional shared styling for features such as filters, voting, announcements, and summaries. |

Frontend types describe the JSON exchanged with the API. They do not create database tables; the backend models and migrations define the database schema.

## 5. Database tables and relationships

| Table | Purpose | Main columns |
|---|---|---|
| `Meetings` | Meeting records | `MeetingId`, `Title`, `CreatedAt`, `Status`, `EndedAt` |
| `Questions` | Participant questions and their lifecycle | `QuestionId`, `MeetingId`, `Name`, `Organization`, `QuestionText`, `Status`, `SubmittedAt`, `SpeakingStartedAt`, `AnsweredAt`, `WithdrawnAt`, `WithdrawalTokenHash` |
| `QuestionVotes` | Individual browser-token votes | `Id`, `QuestionId`, `VisitorTokenHash`, `CreatedAt` |
| `Announcements` | Organizer messages | `Id`, `MeetingId`, `Message`, `CreatedAt` |
| `__EFMigrationsHistory` | EF Core migration tracking | `MigrationId`, `ProductVersion` |

```text
Meetings (1) ──── (many) Questions (1) ──── (many) QuestionVotes
    │
    └─────────── (many) Announcements
```

Important database rules:

- A question must belong to an existing meeting.
- A vote must belong to an existing question.
- An announcement must belong to an existing meeting.
- A filtered unique index allows at most one `Speaking` question per meeting.
- A unique index on question ID and visitor-token hash prevents duplicate votes from the same token.
- Check constraints restrict meeting and question status values.
- Foreign keys use restricted deletion rather than automatic cascading deletion.

## 6. Main API endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/meetings` | List meetings. |
| GET | `/api/meetings/{id}` | Get one meeting. |
| POST | `/api/meetings` | Create a meeting. |
| PUT | `/api/meetings/{id}/end` | End a meeting. |
| GET | `/api/meetings/{id}/summary` | Get an ended meeting's summary. |
| GET / POST | `/api/meetings/{id}/announcements` | List or publish announcements. |
| POST | `/api/questions` | Submit a question. |
| GET | `/api/questions/meeting/{id}` | List a meeting's questions. |
| GET | `/api/questions/meeting/{id}/pending` | List pending questions. |
| GET | `/api/questions/meeting/{id}/answered` | List answered questions. |
| GET | `/api/questions/meeting/{id}/speaking` | Get the current speaker, or return no content. |
| PUT | `/api/questions/meeting/{id}/next` | Select the next pending question. |
| PUT | `/api/questions/{id}/answer` | Mark the speaking question as answered. |
| POST | `/api/questions/{id}/upvote` | Add a vote using a visitor token. |
| POST | `/api/questions/{id}/withdraw` | Withdraw a pending question using its private token. |

Swagger documents the API in the development environment.

## 7. How the code works together

### 7.1 Submitting a question

1. The visitor enters their name, organization, and question in `question-form.component.ts`.
2. The component validates the form and calls `QuestionService.submit()` in the frontend service.
3. The frontend sends `POST /api/questions` with a JSON body.
4. `QuestionsController.Create()` accepts `CreateQuestionDto` and calls the backend `QuestionService.Create()`.
5. The backend starts a transaction, locks the meeting row, and checks that the meeting is active.
6. It creates a random withdrawal token and stores its hash with the new `Pending` question.
7. `SmartMeetDbContext` saves the record to PostgreSQL through EF Core.
8. The API returns the public question and its private withdrawal token.
9. The frontend remembers the token in browser storage, clears the question text, and requests a refresh.

```text
Question form → Angular question service → QuestionsController
             → Backend QuestionService → SmartMeetDbContext → PostgreSQL
```

### 7.2 Selecting and answering the next question

1. The organizer clicks **Pick next question** in `speaking-panel.component.ts`.
2. The panel emits an event to `DashboardComponent.pickNext()`.
3. The frontend service sends the next-question API request.
4. The backend checks that the meeting is active and no participant is already speaking.
5. `QueueRules.PendingInOrder()` orders pending questions by `SubmittedAt`, then `QuestionId` to break ties.
6. The earliest question becomes `Speaking`, and its start timestamp is saved.
7. The speaking panel calculates elapsed time from that saved timestamp, so a page reload does not reset the start time.
8. **Mark as answered** changes the question to `Answered` and records `AnsweredAt`.

Upvotes are displayed as feedback and do not change FIFO order.

### 7.3 Voice input

1. The visitor clicks **Speak question** in `voice-input.component.ts`.
2. `DictationSession` in `dictation.ts` starts the browser's speech recognizer.
3. Interim speech appears as a preview; finalized text is appended to the question field.
4. The visitor stops dictation, reviews or edits the text, and submits the normal form.

The application stores the submitted text, not audio recordings. Recognition depends on browser support, microphone permission, and possibly an online browser speech service. The current setting is English (`en-IN`), with no language-selection interface.

### 7.4 Ending a meeting

1. The organizer confirms the end action in the dashboard dialog.
2. `MeetingService.End()` sets the meeting to `Ended` and records `EndedAt`.
3. Any current speaking question returns to `Pending`, and its speaking start time is cleared. It is not automatically counted as answered.
4. The API rejects further question submissions, selections, answers, votes, withdrawals, and announcements for that ended meeting.
5. `SummaryCalculator` provides the final totals, which `meeting-summary.component.ts` displays.

## 8. State and update mechanism

The frontend uses Angular signals for values such as the meeting, question list, busy state, errors, and selected filters. Computed values derive the pending questions, current speaker, answered questions, and filtered results.

`DashboardComponent` polls the API every four seconds while the meeting is active. User actions also trigger a refresh. Updates use HTTP polling, not WebSockets or SignalR. The polling subscription is cleaned up when the component is destroyed, and automatic polling stops after the meeting ends.

## 9. Tests

| File | What it checks |
|---|---|
| `SmartMeet.Tests/SmartMeet.Tests.csproj` | Backend test project and its dependencies. |
| `SmartMeet.Tests/QueueRulesTests.cs` | FIFO ordering, valid status transitions, speaker timestamps, single-speaker rules, and rejection of changes to ended meetings. |
| `SmartMeet.Tests/ParticipationTests.cs` | Token generation/matching, invalid tokens, summary calculations, legacy missing end times, and FIFO after withdrawal. |
| `SmartMeet.Tests/api_smoke.py` | Runs HTTP checks against the actual API and PostgreSQL, covering the basic workflow, concurrent next-speaker selection, meeting isolation, and ending. |
| `SmartMeet.Tests/feature_smoke.py` | Runs integration checks for votes, duplicate-vote concurrency, token privacy, withdrawal ownership, announcements, summaries, and ended-meeting restrictions. |
| `smart-meet-frontend/tests/dictation.test.mjs` | Uses a fake recognizer to test dictation start/stop, final-result handling, errors, cancellation, and cleanup. |
| `smart-meet-frontend/tests/question-filter.test.mjs` | Tests searches, status filters, combined filters, missing results, and FIFO preservation. |

The Python smoke tests create and retain test records in the connected database. Unit tests and smoke tests serve different purposes: unit tests check individual rules, while smoke tests exercise the running API and real database together.

## 10. Where to make common changes

| Desired change | Main files to inspect |
|---|---|
| Change wording or controls on a page | Relevant file in frontend `src/app/components/` |
| Change overall appearance | `src/styles.css`, `src/features.css`, and component CSS files |
| Add or change an application URL | `src/app/app.routes.ts` |
| Change API calls from the frontend | Frontend `meeting.service.ts` or `question.service.ts` |
| Change FIFO or status rules | Backend `Services/QueueRules.cs` and `Services/QuestionService.cs` |
| Change meeting ending or announcement behavior | Backend `Services/MeetingService.cs` |
| Add a database field or table | Backend `Models/`, `Data/SmartMeetDbContext.cs`, a new EF Core migration, relevant DTOs, and frontend types |
| Change request validation | `DTOs/Requests.cs` and the relevant frontend form |
| Change voice behavior or errors | `voice-input.component.ts` and `services/dictation.ts` |
| Change summary totals | `SummaryCalculator.cs`, summary DTO/type, and `meeting-summary.component.ts` |
| Find startup and database inspection instructions | `START_HERE.md` |

## 11. Current scope and limitations

- Organizer and visitor views are selected by URL. There is no login-based role authorization protecting organizer API actions.
- Visitor identity is browser-token based, not tied to an authenticated person. A different browser or cleared storage can produce a different voting identity.
- Withdrawal requires the private token returned when the question was submitted. Losing browser storage can remove access to that token.
- Answered questions record a status and timestamp; the application does not store a separate written answer or audio response.
- The speaking panel manages a question queue and timer. It does not provide a live audio/video meeting connection.
- Dictation relies on the browser speech service and is separate from the backend and database.

## 12. Suggested order for explaining the project

1. Start with the organizer and visitor screens and describe the meeting workflow.
2. Show `app.routes.ts` and `dashboard.component.ts` to explain navigation and page coordination.
3. Follow a question from the form through the frontend service and API controller to the backend service.
4. Show `QueueRules.cs` to explain FIFO and question status changes.
5. Show the models, `SmartMeetDbContext.cs`, and migrations to explain how the database is defined.
6. Explain microphone dictation, browser tokens, announcements, and summaries.
7. Finish with the tests and current limitations.
