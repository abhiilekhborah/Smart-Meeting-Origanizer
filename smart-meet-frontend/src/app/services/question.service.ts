import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { CreateQuestion, CreatedQuestion, Question } from '../models/question.model';
@Injectable({ providedIn: 'root' })
export class QuestionService {
  private http = inject(HttpClient);
  list(id: number) { return this.http.get<Question[]>(`/api/questions/meeting/${id}`); }
  submit(question: CreateQuestion) { return this.http.post<CreatedQuestion>('/api/questions', question); }
  next(id: number) { return this.http.put<Question>(`/api/questions/meeting/${id}/next`, {}); }
  answer(id: number) { return this.http.put<Question>(`/api/questions/${id}/answer`, {}); }
  upvote(id: number, visitorToken: string) { return this.http.post<Question>(`/api/questions/${id}/upvote`, {visitorToken}); }
  withdraw(id: number, withdrawalToken: string) { return this.http.post<Question>(`/api/questions/${id}/withdraw`, {withdrawalToken}); }
}
