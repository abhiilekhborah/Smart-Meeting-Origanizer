# Smart Meet database diagrams

The implemented PostgreSQL tables are **Meeting**, **MeetingAttendees**, and **MeetingQuestions**. The report/display name of MeetingAttendees is **Meeting Attendees**. C# entity names remain Meeting, User, and Question.

## Standard ER diagram

```mermaid
erDiagram
    Meeting ||--o{ MeetingAttendees : "has participants (one Organizer)"
    Meeting ||--o{ MeetingQuestions : contains
    MeetingAttendees ||--o{ MeetingQuestions : submits
    Meeting {
        integer MeetingId PK
        varchar200 Title
        text Description "nullable"
        varchar20 MeetingCode UK
        timestamptz CreatedAt
        timestamptz StartedAt
        timestamptz EndedAt "nullable"
        varchar20 Status
    }
    MeetingAttendees {
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
    MeetingQuestions {
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

![Standard ER diagram](database-er.svg)

## SSMS-Style PostgreSQL Database Diagram

This table-box drawing represents PostgreSQL. It is not an authentic Microsoft SSMS export.

![SSMS-Style PostgreSQL Database Diagram](ssms-style-database.svg)

## Constraints and relationships

- MeetingAttendees.MeetingId → Meeting.MeetingId.
- MeetingQuestions.MeetingId → Meeting.MeetingId.
- (MeetingQuestions.UserId, MeetingQuestions.MeetingId) → the alternate unique key (MeetingAttendees.UserId, MeetingAttendees.MeetingId). This rejects cross-meeting ownership.
- All foreign keys use restricted deletion.
- At most one Organizer attendee per meeting; organizer ID is derived, not duplicated in Meeting.
- At most one Speaking question per meeting (partial unique index).
- MeetingCode has its existing unique index plus a unique expression index on lower(MeetingCode), preserving old codes while enforcing case-insensitive uniqueness. New codes use abc-defg-hij format and secure random letters.
- Non-null session-token hashes are unique; raw session tokens are never stored.
- Category is General, Technical, Feedback, Other, or NULL for compatibility; API defaults to General.
- WithdrawalTokenHash is retained only for legacy question withdrawal.
- Registered visitor counts are derived from session-backed Visitor attendees. Historical unclaimed attendees are not counted as registered visitors.
- __EFMigrationsHistory remains present as an EF system table and is omitted from the application diagrams.

The rename migration changes table/index/constraint names in place and adds the case-insensitive index. It does not recreate these tables or change their rows, codes, timestamps, or ownership.
