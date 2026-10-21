import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, EMPTY, exhaustMap, firstValueFrom, forkJoin, map, startWith, Subject, switchMap, takeWhile, timer } from 'rxjs';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Announcement, Meeting, MeetingSummary } from '../models/meeting.model';
import { Question } from '../models/question.model';
import { apiError, MeetingService } from '../services/meeting.service';
import { QuestionService } from '../services/question.service';
import { NavbarComponent } from './navbar.component';
import { CreateMeetingComponent } from './create-meeting.component';
import { QuestionFormComponent } from './question-form.component';
import { QuestionListComponent } from './question-list.component';
import { SpeakingPanelComponent } from './speaking-panel.component';
import { AnnouncementsComponent } from './announcements.component';
import { MeetingSummaryComponent } from './meeting-summary.component';
import { VisitorSessionService } from '../services/visitor-session.service';
import { filterQuestions, QuestionFilter } from '../services/question-filter';
@Component({ selector: 'app-dashboard', standalone: true, imports: [FormsModule, RouterLink, NavbarComponent, CreateMeetingComponent, QuestionFormComponent, QuestionListComponent, SpeakingPanelComponent, AnnouncementsComponent, MeetingSummaryComponent], template: `
  <app-navbar [meeting]="meeting()" [role]="role" [busy]="busy()" (newMeeting)="modal.set('create')" (copy)="copyInvite()" (end)="modal.set('end')" (summary)="openSummary()" />
  <main class="dashboard-main">
    <div class="page-intro"><h1>{{ role === 'organizer' ? 'Organizer dashboard' : 'Visitor dashboard' }}</h1><span class="sync-label"><i [class.offline]="error()"></i>{{ error() ? 'Connection interrupted' : meeting()?.status === 'Ended' ? 'Meeting complete' : 'Updates every 4 seconds' }}</span></div>
    @if (error()) { <div class="notice error" role="alert">{{ error() }} <button class="text-button" (click)="refresh()">Retry</button> <a routerLink="/">Back to meetings</a></div> }
    @if (notice()) { <div class="notice" [class.error]="noticeError()" role="status">{{ notice() }}<button class="text-button" aria-label="Dismiss message" (click)="notice.set('')">×</button></div> }
    @if (meeting(); as m) {
      @if (m.status === 'Ended') { <div class="notice">This meeting has ended. Questions and answers are available for review.</div> }
      @if (visitor.storageWarning()) { <div class="notice">Browser storage is unavailable. Voting identity and withdrawal keys will only last for this page session.</div> }
      <app-announcements [meetingId]="m.meetingId" [announcements]="announcements()" [organizer]="role === 'organizer'" [active]="m.status === 'Active'" (published)="refresh()" />
      <div class="dashboard-grid" [class.visitor-grid]="role === 'visitor'">
        <section class="panel orange-panel"><div class="panel-heading"><h2><span class="section-icon">☷</span> Questions</h2><span class="count orange-count">{{ pending().length }} waiting</span></div>
          @if (role === 'visitor') { <app-question-form [meetingId]="m.meetingId" [active]="m.status === 'Active'" (submitted)="refresh()" /> }
          @if (role === 'organizer') {
            <div class="question-filters"><label for="question-search">Search questions</label><div class="search-row"><input id="question-search" type="search" placeholder="Name, organization, or question…" [ngModel]="search()" (ngModelChange)="search.set($event)"><button type="button" class="text-button" [disabled]="!search()" (click)="search.set('')">Clear</button></div>
              <label for="question-status">Question status</label><select id="question-status" [ngModel]="statusFilter()" (ngModelChange)="statusFilter.set($event)"><option>All</option><option>Pending</option><option>Speaking</option><option>Answered</option><option>Withdrawn</option></select><p class="feature-muted">{{ filtered().length }} questions shown.</p></div>
            <app-question-list [questions]="filtered()" [emptyTitle]="search().trim() || statusFilter() !== 'Pending' ? 'No matching questions found' : ''" />
          } @else {
            <div class="list-heading">Pending questions <span>First in, first out</span></div><app-question-list [questions]="pending()" [voting]="true" [active]="m.status === 'Active'" [busy]="busy()" [votedIds]="visitor.voted()" [ownedIds]="ownedIds()" (vote)="upvote($event)" (withdraw)="askWithdraw($event)" />
            @if (mine().length) { <div class="list-heading">Your submissions <span>This browser</span></div><app-question-list [questions]="mine()" [voting]="true" [active]="m.status === 'Active'" [busy]="busy()" [votedIds]="visitor.voted()" [ownedIds]="ownedIds()" (vote)="upvote($event)" (withdraw)="askWithdraw($event)" /> }
          }
        </section>
        <section class="panel blue-panel"><div class="panel-heading"><h2><span class="section-icon">◉</span> Speaking now</h2><span class="count blue-count">{{ speaker() ? 'Live' : 'On standby' }}</span></div>
          <app-speaking-panel [question]="speaker()" [organizer]="role === 'organizer'" [active]="m.status === 'Active'" [pendingCount]="pending().length" [busy]="busy()" [voted]="visitor.voted().includes(speaker()?.questionId || 0)" (vote)="upvote($event)" (next)="pickNext()" (answer)="answer()" />
          
        </section>
        @if (role === 'organizer') { <section class="panel green-panel"><div class="panel-heading"><h2><span class="section-icon">✓</span> Answered questions</h2><span class="count green-count">{{ answered().length }} answered</span></div><app-question-list [questions]="answered()" [answered]="true" /></section> }
      </div>
      
    } @else if (!error()) { <div class="loading-state" role="status">Loading your meeting…</div> }
  </main>
  @if (modal()) { <div class="modal-backdrop" (click)="modal.set(null)"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title" (click)="$event.stopPropagation()" (keydown.escape)="modal.set(null)"><button class="modal-close" aria-label="Close dialog" (click)="modal.set(null)">×</button>
    @if (modal() === 'create') { <h2 id="modal-title">Create a meeting</h2><app-create-meeting (created)="modal.set(null)" /> }
    @else if (modal() === 'summary') { <h2 id="modal-title">Meeting summary</h2>@if (summaryLoading()) { <p role="status">Loading summary…</p> } @else if (summaryError()) { <p class="notice error" role="alert">{{ summaryError() }}</p><button class="button secondary" (click)="openSummary()">Retry summary</button> } @else if (summary(); as value) { <app-meeting-summary [summary]="value" /> } }
    @else if (modal() === 'withdraw') { <h2 id="modal-title">Withdraw this question?</h2><p>{{ withdrawing()?.questionText }}</p><p>The question will leave the pending queue and remain in your history as Withdrawn.</p><div class="dialog-actions"><button class="button secondary" (click)="modal.set(null)">Keep question</button><button class="button danger" [disabled]="busy()" (click)="withdraw()">{{ busy() ? 'Withdrawing…' : 'Withdraw question' }}</button></div> }
    @else { <h2 id="modal-title">End this meeting?</h2><p>New questions will close. The current speaking question returns to Pending unless you explicitly marked it Answered. All records remain available in the summary.</p><div class="dialog-actions"><button class="button secondary" (click)="modal.set(null)">Keep meeting open</button><button class="button danger" [disabled]="busy()" (click)="endMeeting()">{{ busy() ? 'Ending…' : 'End meeting' }}</button></div> }
  </section></div> }
` })
export class DashboardComponent implements OnInit {
  private route = inject(ActivatedRoute); private meetings = inject(MeetingService); private questions = inject(QuestionService); private destroyRef = inject(DestroyRef);
  id = Number(this.route.snapshot.paramMap.get('id')); readonly role = this.route.snapshot.data['role'] as string;
  meeting = signal<Meeting | null>(null); all = signal<Question[]>([]); busy = signal(false); error = signal(''); notice = signal(''); modal = signal<'create' | 'end' | 'withdraw' | 'summary' | null>(null);
  visitor = inject(VisitorSessionService);
  announcements = signal<Announcement[]>([]); search = signal(''); statusFilter = signal<QuestionFilter>('Pending');
  filtered = computed(() => filterQuestions(this.all(),this.search(),this.statusFilter()));
  ownedIds = computed(() => Object.keys(this.visitor.ownership()).map(Number));
  mine = computed(() => this.all().filter(q => this.ownedIds().includes(q.questionId)));
  withdrawing = signal<Question | null>(null); summary = signal<MeetingSummary | null>(null); summaryLoading = signal(false); summaryError = signal('');
  noticeError = signal(false);
  pending = computed(() => this.all().filter(q => q.status === 'Pending'));
  speaker = computed(() => this.all().find(q => q.status === 'Speaking') || null);
  answered = computed(() => this.all().filter(q => q.status === 'Answered').sort((a,b) => (b.answeredAt || '').localeCompare(a.answeredAt || '') || b.questionId-a.questionId));
  private reload = new Subject<void>();
  ngOnInit() {
    this.route.paramMap.pipe(switchMap(params => {
      this.id = Number(params.get('id')); this.meeting.set(null); this.all.set([]); this.error.set(''); this.announcements.set([]);this.summary.set(null);this.modal.set(null);this.search.set('');this.statusFilter.set('Pending');this.notice.set('');
      if (!Number.isSafeInteger(this.id) || this.id < 1) { this.error.set('This meeting link is invalid.'); return EMPTY; }
      // Manual refresh restarts the timer immediately. Slow polls never overlap
      // or cancel one another, so even connection timeouts reach the error UI.
      return this.reload.pipe(startWith(void 0), switchMap(() =>
        timer(0,4000).pipe(takeWhile(tick => tick === 0 || this.meeting()?.status !== 'Ended'), exhaustMap(() =>
          this.meetings.get(this.id).pipe(
            switchMap(meeting => forkJoin({ questions:this.questions.list(this.id), announcements:this.meetings.announcements(this.id) }).pipe(map(data => ({ meeting, ...data })))),
            catchError(e => { this.error.set(apiError(e)); return EMPTY; })
          )
        ))
      ));
    }), takeUntilDestroyed(this.destroyRef))
      .subscribe(data => { this.meeting.set(data.meeting); this.all.set(data.questions); this.announcements.set(data.announcements); this.error.set(''); });
  }
  refresh() { this.reload.next(); }
  async pickNext() { await this.action(() => firstValueFrom(this.questions.next(this.id)), 'Next speaker selected.'); }
  async answer() { const q = this.speaker(); if(q) await this.action(() => firstValueFrom(this.questions.answer(q.questionId)), 'Question marked as answered.'); }
  async endMeeting() { if(await this.action(() => firstValueFrom(this.meetings.end(this.id)), 'Meeting ended.')) await this.openSummary(); }
  async openSummary(){
    if(this.summaryLoading())return; const id=this.id; this.modal.set('summary');this.summary.set(null);this.summaryError.set('');this.summaryLoading.set(true);
    try{const value=await firstValueFrom(this.meetings.summary(id));if(this.id===id)this.summary.set(value);}catch(e){if(this.id===id)this.summaryError.set(apiError(e));}finally{this.summaryLoading.set(false);}
  }
  askWithdraw(q:Question){this.withdrawing.set(q);this.modal.set('withdraw');}
  async withdraw(){
    const q=this.withdrawing();if(!q)return; const token=this.visitor.tokenFor(q.questionId);
    if(!token){this.noticeError.set(true);this.notice.set('The private withdrawal key is missing from this browser.');this.modal.set(null);return;}
    if(await this.action(()=>firstValueFrom(this.questions.withdraw(q.questionId,token)),'Question withdrawn.'))this.modal.set(null);
  }
  async upvote(q:Question){
    await this.action(async()=>{
      try{await firstValueFrom(this.questions.upvote(q.questionId,this.visitor.visitorToken()));this.visitor.rememberVote(q.questionId);}
      catch(e){if(e instanceof HttpErrorResponse && e.status===409 && e.error?.title?.includes('already voted'))this.visitor.rememberVote(q.questionId);throw e;}
    },'Upvote recorded.');
  }
  private async action(fn: () => Promise<unknown>, message: string) {
    if(this.busy()) return false; this.busy.set(true); this.notice.set(''); this.noticeError.set(false); const id=this.id;
    try { await fn(); if(this.id===id){this.notice.set(message);this.refresh();}return true; } catch(e) { if(this.id===id){this.noticeError.set(true);this.notice.set(apiError(e));this.refresh();}return false; } finally { this.busy.set(false); }
  }
  async copyInvite() {
    this.noticeError.set(false);
    const url = new URL(`/meeting/${this.id}/visitor`, location.origin).href;
    try { await navigator.clipboard.writeText(url); this.notice.set('Invite link copied. Share it with your participants.'); }
    catch { this.notice.set('Copy this visitor link: ' + url); }
  }
}
