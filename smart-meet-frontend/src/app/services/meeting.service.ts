import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Announcement, Meeting, MeetingSummary } from '../models/meeting.model';
@Injectable({ providedIn: 'root' })
export class MeetingService {
  private http = inject(HttpClient);
  list() { return this.http.get<Meeting[]>('/api/meetings'); }
  get(id: number) { return this.http.get<Meeting>(`/api/meetings/${id}`); }
  create(title: string) { return this.http.post<Meeting>('/api/meetings', { title }); }
  end(id: number) { return this.http.put<Meeting>(`/api/meetings/${id}/end`, {}); }
  summary(id: number) { return this.http.get<MeetingSummary>(`/api/meetings/${id}/summary`); }
  announcements(id: number) { return this.http.get<Announcement[]>(`/api/meetings/${id}/announcements`); }
  publish(id: number, message: string) { return this.http.post<Announcement>(`/api/meetings/${id}/announcements`, {message}); }
}
export function apiError(error: unknown): string {
  if (error instanceof HttpErrorResponse) {
    if (error.status === 0 || error.status === 502 || error.status === 504) return 'Cannot reach Smart Meet. Start the API on localhost:5050 and check your connection.';
    const validation = error.error?.errors as Record<string, string[]> | undefined;
    return validation ? Object.values(validation).flat().join(' ') : error.error?.title || 'The request failed. Please try again.';
  }
  return 'Something went wrong. Please try again.';
}
