# Database diagrams

## Standard ER diagram

```mermaid
erDiagram
    Meetings ||--o{ Users : "has participants (one Organizer)"
    Meetings ||--o{ Questions : contains
    Users ||--o{ Questions : submits
    Meetings {
        integer MeetingId PK
        varchar200 Title
        text Description "nullable"
        varchar20 MeetingCode UK
        timestamptz CreatedAt
        timestamptz StartedAt
        timestamptz EndedAt "nullable"
        varchar20 Status
    }
    Users {
        integer UserId PK
        integer MeetingId FK "part of alternate key with UserId"
        varchar100 Name
        varchar150 Email "nullable"
        varchar150 Organization
        varchar20 Role
        timestamptz JoinedAt
        timestamptz LastSeenAt "nullable"
        boolean IsActive
        varchar64 SessionTokenHash UK "nullable; internal"
    }
    Questions {
        integer QuestionId PK
        integer MeetingId FK "also part of composite user FK"
        integer UserId FK "composite FK: UserId + MeetingId"
        text QuestionText
        varchar50 Category "nullable"
        varchar20 Status
        timestamptz SubmittedAt
        timestamptz SpeakingStartedAt "nullable"
        timestamptz AnsweredAt "nullable"
        timestamptz WithdrawnAt "nullable"
        integer SpeakingDurationSeconds "nullable"
        text OrganizerNote "nullable"
        varchar64 WithdrawalTokenHash "nullable; legacy only"
    }
```

![Standard ER Diagram](database-er.svg)

## SSMS-Style Database Diagram

This is a PostgreSQL schema drawn in an SSMS-style table-box layout, not an actual SSMS export.

![SSMS-Style Database Diagram](ssms-style-database.svg)

## Relationship and legacy decisions

- `Users.MeetingId` references `Meetings.MeetingId` with restricted deletion.
- `Questions.MeetingId` references `Meetings.MeetingId` with restricted deletion.
- `(Questions.UserId, Questions.MeetingId)` references the alternate key `(Users.UserId, Users.MeetingId)`. This prevents cross-meeting ownership at database level.
- The organizer is the single user with `Role = 'Organizer'` in that meeting. A partial unique index enforces at most one. Meeting creation transactionally inserts both records. `OrganizerId` is returned in API responses, not duplicated as a stored column; this avoids a circular foreign key.
- Historical meetings have no invented organizer. Every historical question has its own unclaimed Visitor record; identical names are not merged.
- `SessionTokenHash` is null only for unclaimed historical users. Their question-specific withdrawal hashes are retained. New questions use session ownership and leave `WithdrawalTokenHash` null.
- Registered/active visitor counts are derived from session-backed Visitor rows. Historical unclaimed rows appear separately in participant listings and do not inflate joined visitor counts.
- `TotalParticipants` is calculated, not stored. `IsActive` is effective only when the meeting is active and `LastSeenAt` is within 60 seconds; a stale stored flag alone does not count as active.
- Question states: Pending, Speaking, Answered, Withdrawn. Categories: General, Technical, Feedback, Other; API defaults to General.
- `IX_OneSpeakerPerMeeting` permits at most one Speaking question per meeting.
- `__EFMigrationsHistory` is the only additional system table and is omitted here.
