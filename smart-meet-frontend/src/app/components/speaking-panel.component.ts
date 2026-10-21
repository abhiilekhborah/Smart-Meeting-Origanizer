import { Component, computed, effect, input, output, signal } from '@angular/core';
import { Question } from '../models/question.model';
@Component({ selector: 'app-speaking-panel', standalone: true, template: `
  <div class="speaker-body">
    @if (question(); as q) {
      <div class="live-label"><i></i> Speaking</div><div class="speaker-avatar">{{ q.name.charAt(0).toUpperCase() }}</div>
      <h2>{{ q.name }}</h2><p class="speaker-org">{{ q.organization }}</p>
      <div class="speaker-votes">@if (!organizer()) { <button type="button" class="vote-button" [class.voted]="voted()" [disabled]="!active() || busy() || voted()" (click)="vote.emit(q)">▲ {{ q.voteCount }} {{ voted() ? 'Voted' : 'Upvote' }}</button> } @else { <span class="vote-total">▲ {{ q.voteCount }} votes</span> }</div>
      <div class="speaker-question"><span>QUESTION #{{ q.questionId }}</span><p>{{ q.questionText }}</p></div>
      <div class="speaking-timer">{{ elapsed() }}</div><span class="timer-caption">SPEAKING TIME</span>
      @if (organizer()) { <button class="button success wide" [disabled]="busy() || !active()" (click)="answer.emit()">✓ &nbsp; Mark as answered</button> }
    } @else {
      <div class="empty-state speaker-empty"><h2>{{ active() ? 'No current speaker' : 'Meeting ended' }}</h2><p>{{ active() ? (organizer() ? 'Select the next pending question.' : 'Waiting for the organizer to select a question.') : 'Questions and answers are available for review.' }}</p>
        @if (organizer()) { <button class="button primary" [disabled]="!active() || !pendingCount() || busy()" (click)="next.emit()">▶ &nbsp; Pick next question <span class="fifo">FIFO</span></button> }
      </div>
    }
  </div>` })
export class SpeakingPanelComponent {
  question = input<Question | null>(null); organizer = input(true); active = input(true); pendingCount = input(0); busy = input(false);
  next = output<void>(); answer = output<void>(); now = signal(Date.now());
  voted = input(false); vote = output<Question>();
  elapsed = computed(() => { const start = this.question()?.speakingStartedAt; const secs = start ? Math.max(0, Math.floor((this.now() - Date.parse(start)) / 1000)) : 0; return String(Math.floor(secs / 60)).padStart(2, '0') + ':' + String(secs % 60).padStart(2, '0'); });
  constructor() { effect(onCleanup => {
    if (!this.question()?.speakingStartedAt) return;
    this.now.set(Date.now());
    const timer = setInterval(() => this.now.set(Date.now()), 1000);
    onCleanup(() => clearInterval(timer));
  }); }
}
