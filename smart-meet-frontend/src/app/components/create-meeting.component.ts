import { Component, inject, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { Router } from '@angular/router';
import { apiError, MeetingService } from '../services/meeting.service';
export const nonBlank = Validators.pattern(/\S/);
@Component({ selector: 'app-create-meeting', standalone: true, imports: [ReactiveFormsModule], template: `
  <form [formGroup]="form" (ngSubmit)="create()" class="create-form">
    <label for="meeting-title">Meeting title</label>
    <input id="meeting-title" formControlName="title" placeholder="Enter meeting title" maxlength="200" autofocus>
    @if (form.controls.title.touched && form.invalid) { <p class="field-error">Enter a meeting title (up to 200 characters).</p> }
    @if (error()) { <p class="notice error" role="alert">{{ error() }}</p> }
    <button class="button primary wide" type="submit" [disabled]="busy()">{{ busy() ? 'Creating meeting…' : 'Create meeting' }} <span>→</span></button>
  </form>` })
export class CreateMeetingComponent {
  private api = inject(MeetingService); private router = inject(Router);
  form = inject(FormBuilder).nonNullable.group({ title: ['', [Validators.required, Validators.maxLength(200), nonBlank]] });
  busy = signal(false); error = signal(''); created = output<void>();
  async create() {
    this.form.markAllAsTouched(); if (this.form.invalid || this.busy()) return;
    this.busy.set(true); this.error.set('');
    try { const m = await firstValueFrom(this.api.create(this.form.getRawValue().title.trim())); this.created.emit(); await this.router.navigate(['/meeting', m.meetingId, 'organizer']); }
    catch (e) { this.error.set(apiError(e)); } finally { this.busy.set(false); }
  }
}
