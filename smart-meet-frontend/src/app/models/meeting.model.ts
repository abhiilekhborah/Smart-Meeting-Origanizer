export interface Meeting {
  meetingId: number; title: string; description: string | null; meetingCode: string;
  organizerId: number | null; organizerName: string | null; createdAt: string; startedAt: string;
  status: 'Active' | 'Ended'; endedAt: string | null; totalParticipants: number; activeParticipants: number;
}
export interface MeetingSummary {
  meetingId: number; title: string; status: 'Ended'; startedAt: string; endedAt: string | null;
  durationSeconds: number | null; totalQuestions: number; answeredQuestions: number;
  pendingQuestions: number; withdrawnQuestions: number; totalParticipants: number;
}
export interface Participant {
  userId: number; meetingId: number; name: string; organization: string; email: string | null;
  role: 'Organizer' | 'Visitor'; joinedAt: string; lastSeenAt: string | null; isActive: boolean; isLegacyParticipant: boolean;
}
export interface UserSession { user: Participant; sessionToken: string; }
export interface CreatedMeeting { meeting: Meeting; session: UserSession; }
