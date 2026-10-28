import { Component, DestroyRef, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, EMPTY, switchMap } from 'rxjs';
import { NavbarComponent } from './navbar.component';
import { MeetingSummaryComponent } from './meeting-summary.component';
import { MeetingSummary } from '../models/meeting.model';
import { apiError, MeetingService } from '../services/meeting.service';
@Component({selector:'app-summary-page',standalone:true,imports:[NavbarComponent,MeetingSummaryComponent,RouterLink],template:`
  <app-navbar [meeting]="summary()" /><main class="summary-page"><div class="summary-page-nav"><a routerLink="/">← Meetings</a><span>Meeting summary</span></div>
    @if(loading()){<p role="status">Loading summary…</p>}
    @if(error()){<div class="notice error" role="alert">{{error()}}</div><p class="feature-muted">Detailed summaries require the original organizer session in this browser. Historical meetings without an organizer session remain available through their read-only dashboard.</p><a class="button secondary" [routerLink]="['/meeting',id,'organizer']">Open dashboard</a><button class="button secondary" (click)="load()">Retry</button>}
    @if(summary();as value){<app-meeting-summary [summary]="value" />}
  </main>`})
export class SummaryPageComponent {
  private route=inject(ActivatedRoute);private api=inject(MeetingService);private destroy=inject(DestroyRef);
  id=0;summary=signal<MeetingSummary|null>(null);loading=signal(false);error=signal('');
  ngOnInit(){this.route.paramMap.pipe(switchMap(params=>{
    this.id=Number(params.get('id'));this.summary.set(null);this.error.set('');this.loading.set(true);
    if(!Number.isSafeInteger(this.id)||this.id<1){this.error.set('Invalid meeting link.');this.loading.set(false);return EMPTY;}
    return this.api.summary(this.id).pipe(catchError(e=>{this.error.set(apiError(e));this.loading.set(false);return EMPTY;}));
  }),takeUntilDestroyed(this.destroy)).subscribe(value=>{this.summary.set(value);this.loading.set(false);});}
  load(){this.summary.set(null);this.loading.set(true);this.error.set('');this.api.summary(this.id).pipe(takeUntilDestroyed(this.destroy)).subscribe({next:value=>{this.summary.set(value);this.loading.set(false);},error:e=>{this.error.set(apiError(e));this.loading.set(false);}});}
}
