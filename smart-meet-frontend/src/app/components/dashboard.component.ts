import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, EMPTY, exhaustMap, firstValueFrom, forkJoin, from, map, startWith, Subject, switchMap, takeWhile, timer } from 'rxjs';
import { Meeting, MeetingSummary, Participant } from '../models/meeting.model';
import { Category, Question } from '../models/question.model';
import { apiError, MeetingService } from '../services/meeting.service';
import { QuestionService } from '../services/question.service';
import { UserService } from '../services/user.service';
import { VisitorSessionService } from '../services/visitor-session.service';
import { filterQuestions, QuestionFilter } from '../services/question-filter';
import { NavbarComponent } from './navbar.component';
import { CreateMeetingComponent } from './create-meeting.component';
import { JoinMeetingComponent } from './join-meeting.component';
import { QuestionFormComponent } from './question-form.component';
import { QuestionListComponent } from './question-list.component';
import { SpeakingPanelComponent } from './speaking-panel.component';
import { MeetingSummaryComponent } from './meeting-summary.component';

@Component({selector:'app-dashboard',standalone:true,imports:[FormsModule,RouterLink,DatePipe,NavbarComponent,CreateMeetingComponent,JoinMeetingComponent,QuestionFormComponent,QuestionListComponent,SpeakingPanelComponent,MeetingSummaryComponent],template:`
  <app-navbar [meeting]="meeting()" [role]="role" [manage]="canManage()" [busy]="busy()" (newMeeting)="modal.set('create')" (copy)="copyInvite()" (end)="modal.set('end')" (summary)="openSummary()" />
  <main class="dashboard-main">
    <div class="page-intro"><h1>{{role==='organizer'?'Organizer dashboard':'Visitor dashboard'}}</h1><span class="sync-label"><i [class.offline]="error()"></i>{{error()?'Connection interrupted':meeting()?.status==='Ended'?'Meeting complete':'Updates every 4 seconds'}}</span></div>
    @if(error()){<div class="notice error" role="alert">{{error()}} <button class="text-button" (click)="refresh()">Retry</button><a routerLink="/">Back to meetings</a></div>}
    @if(notice()){<div class="notice" [class.error]="noticeError()" role="status">{{notice()}}<button class="text-button" aria-label="Dismiss message" (click)="notice.set('')">×</button></div>}
    @if(meeting();as m){
      <section class="meeting-details feature-box">
        <div><h2>{{m.title}}</h2>@if(m.description){<p>{{m.description}}</p>}<p>Organizer: {{m.organizerName||'Not recorded (legacy meeting)'}}</p><p>Code: <strong>{{m.meetingCode}}</strong> · Started {{m.startedAt|date:'medium'}} · Duration: {{duration()}}</p></div>
        <div class="participant-stats"><span>{{m.totalParticipants}} joined visitors</span><span>{{m.activeParticipants}} active visitors</span>
          @if(canManage()){<button class="button secondary" (click)="showParticipants()">Participants</button>}
          @if(m.status==='Ended'){<button class="button secondary" (click)="openSummary()">Meeting summary</button>}
        </div>
      </section>
      @if(m.status==='Ended'){<div class="notice">This meeting has ended. Joining and question submission are closed.</div>}
      @if(visitor.storageWarning()){<div class="notice">Browser storage is unavailable. Keep this page open to retain your session.</div>}
      @if(role==='organizer'&&!canManage()){<div class="notice">Read-only view. Open this meeting in the browser where it was created to use organizer controls. Legacy meetings have no recoverable organizer session.</div>}
      @if(role==='visitor'&&!currentUser()&&m.status==='Active'){
        @if(sessionChecking()){<p role="status">Checking meeting session…</p>}
        @else{<app-join-meeting [meetingId]="id" (joined)="joined($event)" />}
      }@else{
        @if(currentUser();as u){<p class="session-label">{{u.name}} · {{u.organization}} · {{u.role}}</p>}
        <div class="dashboard-grid" [class.visitor-grid]="role==='visitor'">
          <section class="panel orange-panel"><div class="panel-heading"><h2>Questions</h2><span class="count orange-count">{{pending().length}} waiting</span></div>
            @if(role==='visitor'&&currentUser()){<app-question-form [meetingId]="id" [active]="m.status==='Active'" (submitted)="refresh()" />}
            @if(role==='organizer'){
              <div class="question-filters"><label for="question-search">Search questions</label><div class="search-row"><input id="question-search" type="search" placeholder="Name, organization, or question" [ngModel]="search()" (ngModelChange)="search.set($event)"><button class="text-button" [disabled]="!search()" (click)="search.set('')">Clear</button></div>
                <label for="question-status">Status</label><select id="question-status" [ngModel]="statusFilter()" (ngModelChange)="statusFilter.set($event)"><option>All</option><option>Pending</option><option>Speaking</option><option>Answered</option><option>Withdrawn</option></select>
                <label for="category-filter">Category</label><select id="category-filter" [ngModel]="categoryFilter()" (ngModelChange)="categoryFilter.set($event)"><option>All</option><option>General</option><option>Technical</option><option>Feedback</option><option>Other</option></select><p class="feature-muted">{{filtered().length}} questions shown.</p>
              </div><app-question-list [questions]="filtered()" [manage]="canManage()" [emptyTitle]="'No matching questions.'" (editNote)="editNote($event)" />
            }@else{
              <div class="list-heading">Pending questions <span>First in, first out</span></div><app-question-list [questions]="pending()" [ownedIds]="ownedIds()" [active]="m.status==='Active'" [busy]="busy()" (withdraw)="askWithdraw($event)" />
              @if(mine().length){<div class="list-heading">Your submissions</div><app-question-list [questions]="mine()" [ownedIds]="ownedIds()" [active]="m.status==='Active'" [busy]="busy()" (withdraw)="askWithdraw($event)" />}
            }
          </section>
          <section class="panel blue-panel"><div class="panel-heading"><h2>Speaking now</h2><span class="count blue-count">{{speaker()?'Live':'On standby'}}</span></div><app-speaking-panel [question]="speaker()" [organizer]="canManage()" [active]="m.status==='Active'" [pendingCount]="pending().length" [busy]="busy()" (next)="pickNext()" (answer)="answer()" /></section>
          @if(role==='organizer'){<section class="panel green-panel"><div class="panel-heading"><h2>Answered questions</h2><span class="count green-count">{{answered().length}} answered</span></div><app-question-list [questions]="answered()" [answered]="true" [manage]="canManage()" (editNote)="editNote($event)" /></section>}
        </div>
      }
    }@else if(!error()){<p role="status">Loading meeting…</p>}
  </main>
  @if(modal()){<div class="modal-backdrop" (click)="modal.set(null)"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title" (click)="$event.stopPropagation()" (keydown.escape)="modal.set(null)"><button class="modal-close" aria-label="Close dialog" (click)="modal.set(null)">×</button>
    @if(modal()==='create'){<h2 id="modal-title">Create meeting</h2><app-create-meeting (created)="modal.set(null)" />}
    @else if(modal()==='participants'){<h2 id="modal-title">Participants</h2><p class="feature-muted">Active means seen within the last 60 seconds. Historical migrated participants are marked separately.</p>
      @if(participantsLoading()){<p role="status">Loading participants…</p>}
      @if(participantsError()){<p class="field-error">{{participantsError()}}</p>}
      @for(u of participants();track u.userId){<article class="participant-row"><strong>{{u.name}}</strong><span>{{u.organization}} · {{u.role}}</span>@if(u.email){<span>{{u.email}}</span>}<span>{{u.isLegacyParticipant?'Historical participant':u.isActive?'Active':'Inactive'}} · Joined {{u.joinedAt|date:'short'}}</span></article>}
    }
    @else if(modal()==='summary'){<h2 id="modal-title">Meeting summary</h2>@if(summaryLoading()){<p role="status">Loading summary…</p>}@else if(summaryError()){<p class="field-error">{{summaryError()}}</p><button class="button secondary" (click)="openSummary()">Retry</button>}@else if(summary();as s){<app-meeting-summary [summary]="s" />}}
    @else if(modal()==='note'){<h2 id="modal-title">Organizer note</h2><p>{{selectedQuestion()?.questionText}}</p><label for="organizer-note">Note (optional, up to 1,000 characters)</label><textarea id="organizer-note" maxlength="1000" rows="4" [ngModel]="noteText()" (ngModelChange)="noteText.set($event)"></textarea>@if(actionError()){<p class="field-error">{{actionError()}}</p>}<button class="button primary" [disabled]="busy()" (click)="saveNote()">Save note</button>}
    @else if(modal()==='withdraw'){<h2 id="modal-title">Withdraw question?</h2><p>{{selectedQuestion()?.questionText}}</p><p>The question remains in your history as Withdrawn.</p>@if(actionError()){<p class="field-error">{{actionError()}}</p>}<div class="dialog-actions"><button class="button secondary" (click)="modal.set(null)">Keep question</button><button class="button danger" [disabled]="busy()" (click)="withdraw()">Withdraw question</button></div>}
    @else{<h2 id="modal-title">End meeting?</h2><p>Joining and submissions will close. Any current speaking question returns to Pending.</p>@if(actionError()){<p class="field-error">{{actionError()}}</p>}<div class="dialog-actions"><button class="button secondary" (click)="modal.set(null)">Keep open</button><button class="button danger" [disabled]="busy()" (click)="endMeeting()">End meeting</button></div>}
  </section></div>}
`})
export class DashboardComponent {
  private route=inject(ActivatedRoute);private meetings=inject(MeetingService);private questions=inject(QuestionService);private users=inject(UserService);private destroyRef=inject(DestroyRef);
  visitor=inject(VisitorSessionService);id=Number(this.route.snapshot.paramMap.get('id'));readonly role=this.route.snapshot.data['role'] as string;
  meeting=signal<Meeting|null>(null);all=signal<Question[]>([]);currentUser=signal<Participant|null>(null);sessionChecking=signal(true);
  busy=signal(false);error=signal('');notice=signal('');noticeError=signal(false);actionError=signal('');
  modal=signal<'create'|'end'|'withdraw'|'summary'|'participants'|'note'|null>(null);
  search=signal('');statusFilter=signal<QuestionFilter>('Pending');categoryFilter=signal<'All'|Category>('All');
  filtered=computed(()=>filterQuestions(this.all(),this.search(),this.statusFilter(),this.categoryFilter()));
  canManage=computed(()=>this.role==='organizer'&&this.currentUser()?.role==='Organizer'&&this.currentUser()?.meetingId===this.id);
  ownedIds=computed(()=>this.all().filter(q=>q.userId===this.currentUser()?.userId&&this.currentUser()?.role==='Visitor'||!!this.visitor.tokenFor(q.questionId)).map(q=>q.questionId));
  mine=computed(()=>this.all().filter(q=>this.ownedIds().includes(q.questionId)));
  pending=computed(()=>this.all().filter(q=>q.status==='Pending'));
  speaker=computed(()=>this.all().find(q=>q.status==='Speaking')||null);
  answered=computed(()=>this.all().filter(q=>q.status==='Answered').sort((a,b)=>(b.answeredAt||'').localeCompare(a.answeredAt||'')||b.questionId-a.questionId));
  selectedQuestion=signal<Question|null>(null);noteText=signal('');participants=signal<Participant[]>([]);participantsLoading=signal(false);participantsError=signal('');
  summary=signal<MeetingSummary|null>(null);summaryLoading=signal(false);summaryError=signal('');now=signal(Date.now());private reload=new Subject<void>();
  duration=computed(()=>{const m=this.meeting();if(!m)return '';const seconds=Math.max(0,Math.floor(((m.endedAt?Date.parse(m.endedAt):this.now())-Date.parse(m.startedAt))/1000));return `${Math.floor(seconds/3600)}h ${Math.floor(seconds%3600/60)}m ${seconds%60}s`;});
  ngOnInit(){
    timer(0,1000).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(()=>this.now.set(Date.now()));
    this.route.paramMap.pipe(switchMap(params=>{
      this.id=Number(params.get('id'));this.meeting.set(null);this.all.set([]);this.currentUser.set(null);this.error.set('');this.modal.set(null);this.search.set('');this.statusFilter.set('Pending');this.categoryFilter.set('All');this.sessionChecking.set(true);
      if(!Number.isSafeInteger(this.id)||this.id<1){this.error.set('This meeting link is invalid.');return EMPTY;}
      return this.reload.pipe(startWith(void 0),switchMap(()=>timer(0,4000).pipe(takeWhile(tick=>tick===0||this.meeting()?.status!=='Ended'),exhaustMap(()=>from(this.touchSession()).pipe(
        switchMap(()=>forkJoin({meeting:this.meetings.get(this.id),questions:this.questions.list(this.id)})),catchError(e=>{this.error.set(apiError(e));return EMPTY;})
      )))));
    }),takeUntilDestroyed(this.destroyRef)).subscribe(data=>{this.meeting.set(data.meeting);this.all.set(data.questions);this.error.set('');if(this.modal()==='participants')void this.loadParticipants();});
  }
  private async touchSession(){
    const id=this.id;const stored=this.visitor.get(id,this.role);
    if(!stored){this.currentUser.set(null);this.sessionChecking.set(false);return;}
    try{const user=await firstValueFrom(this.users.heartbeat(id,this.role));if(this.id===id){this.currentUser.set(user);this.visitor.save({...stored,user});}}
    catch(e){if(e instanceof HttpErrorResponse&&(e.status===401||e.status===403)){this.visitor.clear(id,this.role);if(this.id===id)this.currentUser.set(null);}else throw e;}
    finally{if(this.id===id)this.sessionChecking.set(false);}
  }
  joined(user:Participant){this.currentUser.set(user);this.refresh();}
  refresh(){this.reload.next();}
  async pickNext(){await this.action(()=>firstValueFrom(this.questions.next(this.id)),'Next speaker selected.');}
  async answer(){const q=this.speaker();if(q)await this.action(()=>firstValueFrom(this.questions.answer(q.questionId,this.id)),'Question marked as answered.');}
  async endMeeting(){if(await this.action(()=>firstValueFrom(this.meetings.end(this.id)),'Meeting ended.'))await this.openSummary();}
  askWithdraw(q:Question){this.selectedQuestion.set(q);this.actionError.set('');this.modal.set('withdraw');}
  async withdraw(){const q=this.selectedQuestion();if(q&&await this.action(()=>firstValueFrom(this.questions.withdraw(q.questionId,this.id,this.visitor.tokenFor(q.questionId))),'Question withdrawn.'))this.modal.set(null);}
  editNote(q:Question){this.selectedQuestion.set(q);this.noteText.set(q.organizerNote||'');this.actionError.set('');this.modal.set('note');}
  async saveNote(){const q=this.selectedQuestion();if(q&&await this.action(()=>firstValueFrom(this.questions.note(q.questionId,this.id,this.noteText())),'Note saved.'))this.modal.set(null);}
  async showParticipants(){this.modal.set('participants');await this.loadParticipants();}
  private async loadParticipants(){if(this.participantsLoading())return;this.participantsLoading.set(true);this.participantsError.set('');try{this.participants.set(await firstValueFrom(this.users.participants(this.id)));}catch(e){this.participantsError.set(apiError(e));}finally{this.participantsLoading.set(false);}}
  async openSummary(){if(this.summaryLoading())return;this.modal.set('summary');this.summary.set(null);this.summaryLoading.set(true);this.summaryError.set('');try{this.summary.set(await firstValueFrom(this.meetings.summary(this.id)));}catch(e){this.summaryError.set(apiError(e));}finally{this.summaryLoading.set(false);}}
  private async action(fn:()=>Promise<unknown>,message:string){
    if(this.busy())return false;this.busy.set(true);this.notice.set('');this.noticeError.set(false);this.actionError.set('');const id=this.id;
    try{await fn();if(this.id===id){this.notice.set(message);this.refresh();}return true;}catch(e){if(this.id===id){this.noticeError.set(true);this.notice.set(apiError(e));this.actionError.set(apiError(e));this.refresh();}return false;}finally{this.busy.set(false);}
  }
  async copyInvite(){const url=new URL(`/meeting/${this.id}/visitor`,location.origin).href;try{await navigator.clipboard.writeText(url);this.notice.set('Invite link copied.');}catch{this.notice.set('Visitor link: '+url);}}
}
