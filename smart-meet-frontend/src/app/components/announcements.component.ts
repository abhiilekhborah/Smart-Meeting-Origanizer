import { Component, effect, inject, input, output, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { Announcement } from '../models/meeting.model';
import { apiError, MeetingService } from '../services/meeting.service';
import { nonBlank } from './create-meeting.component';

@Component({ selector:'app-announcements', standalone:true, imports:[DatePipe,ReactiveFormsModule], template:`
  @if (organizer() || announcements().length) {
    <section class="announcements feature-box" aria-label="Organizer announcements">
      <div class="feature-heading"><h2>Announcements</h2><span>{{ announcements().length }} published</span></div>
      @if (organizer()) { <form [formGroup]="form" (ngSubmit)="publish()" class="announcement-form">
        <div><label for="announcement-message">Announcement (up to 300 characters)</label><textarea id="announcement-message" rows="2" maxlength="300" formControlName="message" placeholder="Enter announcement" [readOnly]="!active() || busy()"></textarea></div>
        <button class="button primary" type="submit" [disabled]="!active() || busy()">{{ busy() ? 'Publishing…' : 'Publish announcement' }}</button>
      </form>
      @if (form.touched && form.invalid) { <p class="field-error">Enter a non-empty announcement of at most 300 characters.</p> }
      @if (message()) { <p class="inline-message" [class.field-error]="failed()" role="status">{{ message() }}</p> }
      @if (!active()) { <p class="feature-muted">This meeting has ended. Publishing is closed.</p> } }
      @if (announcements()[0]; as latest) { <article class="latest-announcement"><p>{{ latest.message }}</p><time>{{ latest.createdAt | date:'MMM d, h:mm a' }}</time></article> }
      @else { <p class="feature-muted">No announcements.</p> }
      @if (announcements().length > 1) { <details class="announcement-history"><summary>Previous announcements ({{ announcements().length - 1 }})</summary>
        @for (a of announcements().slice(1); track a.id) { <article><p>{{ a.message }}</p><time>{{ a.createdAt | date:'MMM d, h:mm a' }}</time></article> }
      </details> }
    </section>
  }
` })
export class AnnouncementsComponent {
  private api=inject(MeetingService);
  meetingId=input.required<number>(); announcements=input<Announcement[]>([]); organizer=input(false); active=input(true); published=output<void>();
  busy=signal(false); message=signal(''); failed=signal(false);
  form=inject(FormBuilder).nonNullable.group({message:['',[Validators.required,Validators.maxLength(300),nonBlank]]});
  constructor(){effect(()=>{this.meetingId();this.form.reset();this.message.set('');});}
  async publish(){
    this.form.markAllAsTouched(); if(this.form.invalid || !this.active() || this.busy())return;
    this.busy.set(true); this.message.set(''); const id=this.meetingId();
    try{await firstValueFrom(this.api.publish(id,this.form.getRawValue().message.trim()));
      if(this.meetingId()===id){this.form.reset();this.failed.set(false);this.message.set('Announcement published.');this.published.emit();}
    }catch(e){this.failed.set(true);this.message.set(apiError(e));}finally{this.busy.set(false);}
  }
}
