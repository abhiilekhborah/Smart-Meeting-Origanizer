import { Component, input, output } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Question } from '../models/question.model';
@Component({ selector: 'app-question-list', standalone: true, imports: [DatePipe], template: `
  <div class="question-list" [class.answers-list]="answered()">
    @for (q of questions(); track q.questionId; let i = $index) {
      <article class="question-card" [class.answer-card]="answered()">
        <div class="card-top"><span class="avatar" [class.green]="answered()">{{ q.name.charAt(0).toUpperCase() }}</span><div class="participant"><strong>{{ q.name }}</strong><span>{{ q.organization }}</span></div><span class="question-number">#{{ q.questionId }}</span></div>
        <p class="question-text">{{ q.questionText }}</p>
        <div class="card-bottom"><span class="small-status" [class.green-text]="q.status === 'Answered'">{{ q.status }}</span><time>{{ (q.withdrawnAt || q.answeredAt || q.submittedAt) | date:'MMM d, h:mm a' }}</time></div>
        <div class="question-actions">
          @if (voting() && q.status !== 'Withdrawn') { <button type="button" class="vote-button" [class.voted]="votedIds().includes(q.questionId)" [disabled]="!active() || busy() || votedIds().includes(q.questionId)" (click)="vote.emit(q)" [attr.aria-label]="(votedIds().includes(q.questionId) ? 'Voted for question ' : 'Upvote question ') + q.questionId">▲ {{ q.voteCount }} {{ votedIds().includes(q.questionId) ? 'Voted' : 'Upvote' }}</button> }
          @else { <span class="vote-total">▲ {{ q.voteCount }} votes</span> }
          @if (ownedIds().includes(q.questionId) && q.status === 'Pending' && active()) { <button type="button" class="withdraw-button" [disabled]="busy()" (click)="withdraw.emit(q)">Withdraw question</button> }
        </div>
      </article>
    } @empty {
      <div class="empty-state compact"><h3>{{ emptyTitle() || (answered() ? 'No answered questions.' : 'No pending questions.') }}</h3>@if (emptyTitle()) { <p>Change the search or status filter.</p> }</div>
    }
  </div>` })
export class QuestionListComponent {
  questions = input<Question[]>([]); answered = input(false); emptyTitle = input('');
  voting = input(false); active = input(true); busy = input(false); votedIds = input<number[]>([]); ownedIds = input<number[]>([]);
  vote = output<Question>(); withdraw = output<Question>();
}
