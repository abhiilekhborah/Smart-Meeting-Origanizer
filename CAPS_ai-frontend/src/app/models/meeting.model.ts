export interface Meeting {
  meetingId: number; title: string; description: string | null; meetingCode: string;
  organizerId: number | null; organizerName: string | null; createdAt: string; startedAt: string;
  status: 'Active' | 'Ended'; endedAt: string | null; totalParticipants: number; activeParticipants: number;
}
export interface SummaryParticipant {
  userId:number;name:string;organization:string;role:'Organizer'|'Visitor';joinedAt:string;questionsSubmitted:number;isLegacyParticipant:boolean;
}
export interface TimelineEvent {at:string;kind:string;description:string;questionId:number|null;}
export interface MeetingSummary {
  meetingId:number;title:string;description:string|null;meetingCode:string;organizerName:string|null;status:'Ended';createdAt:string;
  startedAt:string;endedAt:string|null;durationSeconds:number|null;totalQuestions:number;answeredQuestions:number;
  pendingQuestions:number;withdrawnQuestions:number;totalParticipants:number;totalSpeakingDurationSeconds:number;
  averageSpeakingDurationSeconds:number|null;participants:SummaryParticipant[];questions:import('./question.model').Question[];timeline:TimelineEvent[];
}
export interface Participant {
  userId: number; meetingId: number; name: string; organization: string; email: string | null;
  role: 'Organizer' | 'Visitor'; joinedAt: string; lastSeenAt: string | null; isActive: boolean; isLegacyParticipant: boolean;
}
export interface UserSession { user: Participant; sessionToken: string; }
export interface CreatedMeeting { meeting: Meeting; session: UserSession; }
