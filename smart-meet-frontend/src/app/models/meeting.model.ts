export interface Meeting { meetingId: number; title: string; createdAt: string; status: 'Active' | 'Ended'; endedAt: string | null; }
export interface Announcement { id: number; meetingId: number; message: string; createdAt: string; }
export interface MeetingSummary {
  meetingId: number; title: string; status: 'Ended'; startedAt: string; endedAt: string | null; durationSeconds: number | null;
  totalQuestions: number; answeredQuestions: number; pendingQuestions: number; withdrawnQuestions: number; totalUpvotes: number;
}
