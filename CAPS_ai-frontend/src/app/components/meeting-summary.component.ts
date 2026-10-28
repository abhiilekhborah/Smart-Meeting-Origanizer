import { Component, computed, input, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MeetingSummary } from '../models/meeting.model';
import { Question } from '../models/question.model';
@Component({selector:'app-meeting-summary',standalone:true,imports:[DatePipe,DecimalPipe,FormsModule],template:`
  <section class="summary-overview feature-box"><div><h1>{{summary().title}}</h1>@if(summary().description){<p>{{summary().description}}</p>}<p>Organized by {{summary().organizerName||'Not recorded'}}</p><p>{{summary().startedAt|date:'d MMMM yyyy'}} · Code: <strong>{{summary().meetingCode}}</strong></p></div><span class="status light ended">Ended</span>
    <dl class="summary-times"><div><dt>Start time</dt><dd>{{summary().startedAt|date:'medium'}}</dd></div><div><dt>End time</dt><dd>{{summary().endedAt?(summary().endedAt|date:'medium'):'Not recorded'}}</dd></div><div><dt>Duration</dt><dd>{{duration(summary().durationSeconds)}}</dd></div></dl>
  </section>
  <section class="summary-grid" aria-label="Meeting statistics">
    <div><strong>{{summary().totalParticipants}}</strong><span>Registered visitors</span></div><div><strong>{{summary().totalQuestions}}</strong><span>Questions submitted</span></div>
    <div><strong>{{summary().answeredQuestions}}</strong><span>Answered</span></div><div><strong>{{summary().pendingQuestions}}</strong><span>Pending / unanswered</span></div><div><strong>{{summary().withdrawnQuestions}}</strong><span>Withdrawn</span></div>
    <div><strong>{{summary().averageSpeakingDurationSeconds===null?'—':(summary().averageSpeakingDurationSeconds|number:'1.0-1')+'s'}}</strong><span>Average completed speaking time</span></div><div><strong>{{duration(summary().totalSpeakingDurationSeconds)}}</strong><span>Total completed speaking time</span></div>
  </section>
  <section class="feature-box summary-section"><h2>Participant snapshot</h2><div class="table-scroll"><table><thead><tr><th>Name</th><th>Organization</th><th>Joined at</th><th>Questions submitted</th></tr></thead><tbody>
    @for(p of visitors();track p.userId){<tr><td>{{p.name}}</td><td>{{p.organization}}</td><td>{{p.joinedAt|date:'medium'}}</td><td>{{p.questionsSubmitted}}</td></tr>}@empty{<tr><td colspan="4">No registered visitors.</td></tr>}
  </tbody></table></div></section>
  <section class="feature-box summary-section"><div class="summary-question-heading"><h2>Question summary</h2><div><label for="summary-status">Question status</label><select id="summary-status" [ngModel]="status()" (ngModelChange)="status.set($event)"><option>All</option><option>Pending</option><option>Speaking</option><option>Answered</option><option>Withdrawn</option></select></div></div>
    <div class="table-scroll"><table class="summary-question-table"><thead><tr><th>ID</th><th>Participant</th><th>Organization</th><th>Question</th><th>Category</th><th>Submitted</th><th>Status</th><th>Speaking duration</th><th>Answered</th><th>Organizer note</th></tr></thead><tbody>
      @for(q of filtered();track q.questionId){<tr><td>#{{q.questionId}}</td><td>{{q.name}}</td><td>{{q.organization}}</td><td class="summary-text">{{q.questionText}}</td><td>{{q.category||'General'}}</td><td>{{q.submittedAt|date:'medium'}}</td><td>{{q.status}}</td><td>{{q.speakingDurationSeconds===null?'—':q.speakingDurationSeconds+'s'}}</td><td>{{q.answeredAt?(q.answeredAt|date:'medium'):'—'}}</td><td class="summary-text">{{q.organizerNote||'—'}}</td></tr>}@empty{<tr><td colspan="10">No questions match this status.</td></tr>}
    </tbody></table></div>
  </section>
  <section class="feature-box summary-section"><h2>Meeting timeline</h2><ol class="meeting-timeline">@for(event of summary().timeline;track $index){<li><time>{{event.at|date:'MMM d, h:mm:ss a'}}</time><span>{{event.description}}</span></li>}@empty{<li>No recorded events.</li>}</ol><p class="feature-muted">The timeline uses saved timestamps. Completed speaking totals include answered questions with recorded durations; missing historical times are not estimated.</p></section>
`})
export class MeetingSummaryComponent {
  summary=input.required<MeetingSummary>();status=signal<'All'|Question['status']>('All');
  visitors=computed(()=>this.summary().participants.filter(p=>p.role==='Visitor'&&!p.isLegacyParticipant));
  filtered=computed(()=>this.summary().questions.filter(q=>this.status()==='All'||q.status===this.status()));
  duration(value:number|null){if(value===null)return 'Not available';const s=Math.max(0,Math.floor(value));return `${Math.floor(s/3600)}h ${Math.floor(s%3600/60)}m ${s%60}s`;}
}
