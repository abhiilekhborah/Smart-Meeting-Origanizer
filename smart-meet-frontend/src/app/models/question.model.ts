export interface Question {
  questionId: number; meetingId: number; name: string; organization: string; questionText: string;
  status: 'Pending' | 'Speaking' | 'Answered' | 'Withdrawn'; submittedAt: string; speakingStartedAt: string | null; answeredAt: string | null;
  withdrawnAt: string | null; voteCount: number;
}
export interface CreateQuestion { meetingId: number; name: string; organization: string; questionText: string; }
export interface CreatedQuestion extends Question { withdrawalToken: string; }
