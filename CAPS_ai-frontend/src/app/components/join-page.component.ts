import { Component, DestroyRef, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, EMPTY, from, switchMap } from 'rxjs';
import { firstValueFrom } from 'rxjs';
import { NavbarComponent } from './navbar.component';
import { JoinMeetingComponent } from './join-meeting.component';
import { apiError, MeetingService } from '../services/meeting.service';
import { UserService } from '../services/user.service';
import { VisitorSessionService } from '../services/visitor-session.service';
import { Meeting } from '../models/meeting.model';
@Component({selector:'app-join-page',standalone:true,imports:[NavbarComponent,JoinMeetingComponent,RouterLink,DatePipe],template:`
  <app-navbar /><main class="join-page">
    @if(loading()){<p role="status">Finding meeting…</p>}
    @if(error()){<div class="notice error" role="alert">{{error()}}</div><a routerLink="/" class="button secondary">Back to meetings</a>}
    @if(meeting();as m){<section class="join-meeting-info"><h1>{{m.title}}</h1><p>Organized by {{m.organizerName||'Organizer not recorded'}}</p><p>{{m.startedAt|date:'d MMMM yyyy'}} · {{m.meetingCode}}</p>@if(m.description){<p>{{m.description}}</p>}</section>
      <app-join-meeting [meetingId]="m.meetingId" [meetingCode]="m.meetingCode" (joined)="enter(m.meetingId)" />}
  </main>`})
export class JoinPageComponent {
  private route=inject(ActivatedRoute);private router=inject(Router);private api=inject(MeetingService);private users=inject(UserService);private sessions=inject(VisitorSessionService);private destroy=inject(DestroyRef);
  meeting=signal<Meeting|null>(null);loading=signal(true);error=signal('');
  ngOnInit(){this.route.paramMap.pipe(switchMap(params=>{
    this.meeting.set(null);this.error.set('');this.loading.set(true);
    return this.api.byCode(params.get('code')||'').pipe(switchMap(m=>from(this.restore(m))),catchError(e=>{this.error.set(apiError(e));this.loading.set(false);return EMPTY;}));
  }),takeUntilDestroyed(this.destroy)).subscribe(m=>{if(m)this.meeting.set(m);this.loading.set(false);});}
  private async restore(m:Meeting):Promise<Meeting|null>{
    if(this.sessions.get(m.meetingId,'visitor')){
      try{const user=await firstValueFrom(this.users.me(m.meetingId,'visitor'));if(user.meetingId!==m.meetingId||user.role!=='Visitor')throw new Error('This session cannot join this meeting.');await this.enter(m.meetingId);return null;}
      catch(e){if(e instanceof HttpErrorResponse&&(e.status===401||e.status===403))this.sessions.clear(m.meetingId,'visitor');else throw e;}
    }
    return m;
  }
  enter(id:number){return this.router.navigate(['/meeting',id,'visitor']);}
}
