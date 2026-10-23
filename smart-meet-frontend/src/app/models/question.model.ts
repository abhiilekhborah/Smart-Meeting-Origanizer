export type Category = 'General' | 'Technical' | 'Feedback' | 'Other';
export interface Question {
  questionId: number; meetingId: number; userId: number; name: string; organization: string; questionText: string;
  category: Category | null; status: 'Pending' | 'Speaking' | 'Answered' | 'Withdrawn';
  submittedAt: string; speakingStartedAt: string | null; answeredAt: string | null; withdrawnAt: string | null;
  speakingDurationSeconds: number | null; organizerNote: string | null;
}
export interface CreateQuestion { meetingId: number; questionText: string; category: Category; }
