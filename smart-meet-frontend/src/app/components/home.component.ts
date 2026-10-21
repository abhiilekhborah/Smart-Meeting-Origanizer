import { Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { NavbarComponent } from './navbar.component';
import { CreateMeetingComponent } from './create-meeting.component';
import { apiError, MeetingService } from '../services/meeting.service';
import { Meeting } from '../models/meeting.model';
@Component({ selector:'app-home', standalone:true, imports:[NavbarComponent, CreateMeetingComponent, RouterLink, DatePipe], styleUrl:'./home.component.css', template:`
  <app-navbar /><main class="home-main"><h1>Meetings</h1><section class="create-card"><h2>Create meeting</h2><app-create-meeting /></section>
  <section class="recent-meetings"><div class="recent-heading"><h2>Existing meetings</h2><button class="button secondary" (click)="load()" [disabled]="loading()">↻ Refresh</button></div>
    @if(error()) { <p class="notice error" role="alert">{{ error() }}</p> }
    @if(loading()) { <p class="form-note" role="status">Loading meetings…</p> }
    @for(m of meetings(); track m.meetingId) { <article class="meeting-row"><div><h3>{{ m.title }}</h3><span>{{ m.createdAt | date:'MMM d, y · h:mm a' }} · #{{ m.meetingId }}</span></div><span class="status light" [class.ended]="m.status === 'Ended'"><i></i>{{ m.status }}</span><a class="button secondary" [routerLink]="['/meeting',m.meetingId,'organizer']">Open meeting →</a></article> }
    @if(!loading() && !error() && !meetings().length) { <div class="home-empty">No meetings.</div> }
  </section></main>` })
export class HomeComponent {
  private api = inject(MeetingService); meetings = signal<Meeting[]>([]); error = signal(''); loading = signal(false);
  constructor() { void this.load(); }
  async load() { this.loading.set(true); this.error.set(''); try { this.meetings.set(await firstValueFrom(this.api.list())); } catch(e) { this.error.set(apiError(e)); } finally { this.loading.set(false); } }
}
