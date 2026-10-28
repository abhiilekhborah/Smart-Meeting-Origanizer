import { Component, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Meeting } from '../models/meeting.model';
@Component({ selector: 'app-navbar', standalone: true, imports: [RouterLink], template: `
  <header class="navbar">
    <a class="brand" routerLink="/" aria-label="CAPS.ai Meetings Organizer home"><span class="brand-name">CAPS<span class="brand-ai">.ai</span></span><span class="brand-description">Meetings Organizer</span></a>
    @if (meeting(); as current) { <div class="nav-divider"></div><div class="meeting-label"><strong>{{ current.title }}</strong><span>Meeting #{{ current.meetingId }}</span></div> }
    <div class="nav-actions">
      <span class="status" [class.ended]="meeting()?.status === 'Ended'"><i></i>{{ meeting()?.status || 'No meeting selected' }}</span>
      @if (meeting(); as m) {
        <nav class="role-switch" aria-label="Dashboard view"><a [routerLink]="['/meeting',m.meetingId,'organizer']" [class.selected]="role() === 'organizer'">Organizer</a><a [routerLink]="['/meeting',m.meetingId,'visitor']" [class.selected]="role() === 'visitor'">Visitor</a></nav>
        @if (role() === 'organizer' && manage()) {
          <button class="button primary" (click)="newMeeting.emit()"><span>＋</span> New Meeting</button>
          @if (m.status === 'Ended') { <button class="button dark" (click)="summary.emit()">View summary</button> }
          @else { <button class="button end" [disabled]="busy()" (click)="end.emit()">End meeting</button> }
        }
      }
    </div>
  </header>` })
export class NavbarComponent {
  manage = input(false); meeting = input<Pick<Meeting, 'meetingId' | 'title' | 'status'> | null>(null); role = input('organizer'); busy = input(false);
  newMeeting = output<void>(); copy = output<void>(); end = output<void>();
  summary = output<void>();
}
