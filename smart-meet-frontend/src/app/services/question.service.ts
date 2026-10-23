import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { CreateQuestion, Question } from '../models/question.model';
import { VisitorSessionService } from './visitor-session.service';
@Injectable({ providedIn: 'root' })
export class QuestionService {
  private http = inject(HttpClient); private sessions = inject(VisitorSessionService);
  list(id: number) { return this.http.get<Question[]>(`/api/questions/meeting/${id}`); }
  submit(q: CreateQuestion) { return this.http.post<Question>('/api/questions', q, {headers:this.sessions.headers(q.meetingId,'visitor')}); }
  next(id: number) { return this.http.put<Question>(`/api/questions/meeting/${id}/next`, {}, {headers:this.sessions.headers(id,'organizer')}); }
  answer(id: number, meetingId: number) { return this.http.put<Question>(`/api/questions/${id}/answer`, {}, {headers:this.sessions.headers(meetingId,'organizer')}); }
  withdraw(id: number, meetingId: number, withdrawalToken?: string) {
    return this.http.post<Question>(`/api/questions/${id}/withdraw`, {withdrawalToken}, {headers:this.sessions.headers(meetingId,'visitor')});
  }
  note(id: number, meetingId: number, organizerNote: string) {
    return this.http.put<Question>(`/api/questions/${id}/note`, {organizerNote}, {headers:this.sessions.headers(meetingId,'organizer')});
  }
}
