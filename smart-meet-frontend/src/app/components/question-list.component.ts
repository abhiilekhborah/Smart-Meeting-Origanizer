import { Component, input, output } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Question } from '../models/question.model';
@Component({selector:'app-question-list',standalone:true,imports:[DatePipe],template:`
  <div class="question-list" [class.answers-list]="answered()">
    @for(q of questions();track q.questionId){
      <article class="question-card" [class.answer-card]="answered()">
        <div class="card-top"><span class="avatar" [class.green]="answered()">{{q.name.charAt(0).toUpperCase()}}</span><div class="participant"><strong>{{q.name}}</strong><span>{{q.organization}}</span></div><span class="question-number">#{{q.questionId}}</span></div>
        <p class="question-text">{{q.questionText}}</p>
        <div class="card-bottom"><span class="small-status" [class.green-text]="q.status==='Answered'">{{q.status}} · {{q.category||'General'}}</span><time>{{(q.withdrawnAt||q.answeredAt||q.submittedAt)|date:'MMM d, h:mm a'}}</time></div>
        @if(q.speakingDurationSeconds!==null){<p class="feature-muted">Speaking duration: {{q.speakingDurationSeconds}}s</p>}
        @if(q.organizerNote){<p class="organizer-note">Note: {{q.organizerNote}}</p>}
        <div class="question-actions">
          @if(ownedIds().includes(q.questionId)&&q.status==='Pending'&&active()){<button class="withdraw-button" [disabled]="busy()" (click)="withdraw.emit(q)">Withdraw question</button>}
          @if(manage()){<button class="text-button" (click)="editNote.emit(q)">{{q.organizerNote?'Edit note':'Add note'}}</button>}
        </div>
      </article>
    }@empty{<div class="empty-state compact"><h3>{{emptyTitle()||(answered()?'No answered questions.':'No pending questions.')}}</h3></div>}
  </div>`})
export class QuestionListComponent {
  questions=input<Question[]>([]);answered=input(false);emptyTitle=input('');active=input(true);busy=input(false);
  ownedIds=input<number[]>([]);manage=input(false);withdraw=output<Question>();editNote=output<Question>();
}
