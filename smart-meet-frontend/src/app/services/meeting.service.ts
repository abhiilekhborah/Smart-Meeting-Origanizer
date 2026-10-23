import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { CreatedMeeting, Meeting, MeetingSummary } from '../models/meeting.model';
import { VisitorSessionService } from './visitor-session.service';
@Injectable({ providedIn: 'root' })
export class MeetingService {
  private http = inject(HttpClient);
  private sessions = inject(VisitorSessionService);
  list() { return this.http.get<Meeting[]>('/api/meetings'); }
  get(id: number) { return this.http.get<Meeting>(`/api/meetings/${id}`); }
  create(value: {title:string; description:string|null; organizerName:string; organization:string}) { return this.http.post<CreatedMeeting>('/api/meetings', value); }
  end(id:number) { return this.http.put<Meeting>(`/api/meetings/${id}/end`, {}, {headers:this.sessions.headers(id,'organizer')}); }
  summary(id:number) { return this.http.get<MeetingSummary>(`/api/meetings/${id}/summary`); }
}
export function apiError(error: unknown): string {
  if (error instanceof HttpErrorResponse) {
    if (error.status === 0 || error.status === 502 || error.status === 504) return 'Cannot reach Smart Meet. Start the API on localhost:5050 and check your connection.';
    const validation = error.error?.errors as Record<string, string[]> | undefined;
    return validation ? Object.values(validation).flat().join(' ') : error.error?.title || 'The request failed. Please try again.';
  }
  return 'Something went wrong. Please try again.';
}
