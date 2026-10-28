import { Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { NavbarComponent } from './navbar.component';
import { CreateMeetingComponent } from './create-meeting.component';
import { apiError, MeetingService } from '../services/meeting.service';
import { Meeting } from '../models/meeting.model';
@Component({ selector:'app-home', standalone:true, imports:[NavbarComponent, CreateMeetingComponent, RouterLink, DatePipe, FormsModule], styleUrl:'./home.component.css', template:`
  <app-navbar /><main class="home-main"><h1>Meetings</h1><div class="home-actions"><section class="create-card"><h2>Create meeting</h2><app-create-meeting /></section><section class="create-card code-join-card"><h2>Join a meeting</h2><form class="create-form" (ngSubmit)="joinCode()"><label for="join-code">Enter meeting code</label><input id="join-code" name="code" [ngModel]="code()" (ngModelChange)="code.set($event)" placeholder="abc-defg-hij" maxlength="20" autocapitalize="none" autocomplete="off" required><button class="button primary wide" [disabled]="joining()">{{joining()?'Finding meeting…':'Join meeting'}}</button>@if(joinError()){<p class="field-error" role="alert">{{joinError()}}</p>}</form></section></div>
  <section class="recent-meetings"><div class="recent-heading"><h2>Existing meetings</h2><button class="button secondary" (click)="load()" [disabled]="loading()">↻ Refresh</button></div>
    @if(error()) { <p class="notice error" role="alert">{{ error() }}</p> }
    @if(loading()) { <p class="form-note" role="status">Loading meetings…</p> }
    @for(m of meetings(); track m.meetingId) { <article class="meeting-row" role="link" tabindex="0" [attr.aria-label]="(m.status==='Ended'?'View summary for ':'Open meeting ')+m.title" [routerLink]="['/meeting',m.meetingId,m.status==='Ended'?'summary':'organizer']" (keydown.enter)="openMeeting(m)"><div><h3>{{ m.title }}</h3><span>{{ m.createdAt | date:'MMM d, y · h:mm a' }} · #{{ m.meetingId }}</span></div><span class="status light" [class.ended]="m.status === 'Ended'"><i></i>{{ m.status }}</span><a class="button secondary" [routerLink]="['/meeting',m.meetingId,m.status==='Ended'?'summary':'organizer']">{{m.status==='Ended'?'View Summary':'Open meeting →'}}</a></article> }
    @if(!loading() && !error() && !meetings().length) { <div class="home-empty">No meetings.</div> }
  </section></main>` })
export class HomeComponent {
  openMeeting(m:Meeting){return this.router.navigate(['/meeting',m.meetingId,m.status==='Ended'?'summary':'organizer']);}
  private router=inject(Router);code=signal('');joining=signal(false);joinError=signal('');
  async joinCode(){if(this.joining())return;if(!this.code().trim()){this.joinError.set('Enter a valid meeting code.');return;}this.joinError.set('');this.joining.set(true);try{const m=await firstValueFrom(this.api.byCode(this.code()));await this.router.navigate(['/join',m.meetingCode]);}catch(e){this.joinError.set(apiError(e));}finally{this.joining.set(false);}}
  private api = inject(MeetingService); meetings = signal<Meeting[]>([]); error = signal(''); loading = signal(false);
  constructor() { void this.load(); }
  async load() { this.loading.set(true); this.error.set(''); try { this.meetings.set(await firstValueFrom(this.api.list())); } catch(e) { this.error.set(apiError(e)); } finally { this.loading.set(false); } }
}
