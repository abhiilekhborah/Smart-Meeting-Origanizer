import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Participant, UserSession } from '../models/meeting.model';
import { VisitorSessionService } from './visitor-session.service';
@Injectable({providedIn:'root'})
export class UserService {
  private http = inject(HttpClient); private sessions = inject(VisitorSessionService);
  me(id: number, role: string) { return this.http.get<Participant>('/api/users/me', {headers:this.sessions.headers(id,role)}); }
  heartbeat(id: number, role: string) { return this.http.post<Participant>('/api/users/heartbeat', {}, {headers:this.sessions.headers(id,role)}); }
  join(id: number, value: {name:string; organization:string; email:string|null}) {
    return this.http.post<UserSession>(`/api/meetings/${id}/join`, value, {headers:this.sessions.headers(id,'visitor')});
  }
  participants(id: number) { return this.http.get<Participant[]>(`/api/meetings/${id}/participants`, {headers:this.sessions.headers(id,'organizer')}); }
}
