import { Component, input } from '@angular/core';
import { DatePipe } from '@angular/common';
import { MeetingSummary } from '../models/meeting.model';
@Component({selector:'app-meeting-summary',standalone:true,imports:[DatePipe],template:`
  <div class="summary-details"><h3>{{ summary().title }}</h3><p>Started: {{ summary().startedAt | date:'medium' }}</p><p>Ended: {{ summary().endedAt ? (summary().endedAt | date:'medium') : 'Not recorded for this legacy meeting' }}</p><p>Duration: {{ duration() }}</p><span class="status light ended">Ended</span></div>
  <div class="summary-grid">
    <div><strong>{{ summary().totalQuestions }}</strong><span>Total questions</span></div>
    <div><strong>{{ summary().answeredQuestions }}</strong><span>Answered</span></div>
    <div><strong>{{ summary().pendingQuestions }}</strong><span>Pending / unanswered</span></div>
    <div><strong>{{ summary().withdrawnQuestions }}</strong><span>Withdrawn</span></div>
    <div><strong>{{ summary().totalUpvotes }}</strong><span>Total upvotes</span></div>
  </div><p class="feature-muted">Speaking questions return to Pending when a meeting ends. Only explicit answers count as Answered.</p>
`})
export class MeetingSummaryComponent{
  summary=input.required<MeetingSummary>();
  duration(){const value=this.summary().durationSeconds;if(value===null)return 'Not available';const s=Math.floor(value);return `${Math.floor(s/3600)}h ${Math.floor(s%3600/60)}m ${s%60}s`;}
}
