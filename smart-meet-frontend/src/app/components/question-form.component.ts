import { Component, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { Category } from '../models/question.model';
import { QuestionService } from '../services/question.service';
import { apiError } from '../services/meeting.service';
import { nonBlank } from './create-meeting.component';
import { VoiceInputComponent } from './voice-input.component';
@Component({ selector: 'app-question-form', standalone: true, imports: [ReactiveFormsModule, VoiceInputComponent], template: `
  <form [formGroup]="form" (ngSubmit)="submit()" class="question-form">
    <fieldset [disabled]="!active() || busy()">
      <label for="question-category">Category</label><select id="question-category" formControlName="category"><option>General</option><option>Technical</option><option>Feedback</option><option>Other</option></select>
      <label for="question">Your question</label><textarea id="question" formControlName="questionText" placeholder="What would you like to ask?" maxlength="10000" rows="4"></textarea>
      <app-voice-input [context]="meetingId()" [disabled]="!active() || busy() || form.controls.questionText.value.length >= 10000" (dictated)="appendDictation($event)" (capturing)="dictating.set($event)" />
      @if (form.touched && form.invalid) { <p class="field-error">Enter a question within 10,000 characters.</p> }
      <button class="button primary wide" type="submit" [disabled]="dictating()">{{ busy() ? 'Submitting…' : 'Submit question' }} <span>↗</span></button>
    </fieldset>
    @if (message()) { <p class="inline-message" [class.field-error]="failed()" role="status">{{ message() }}</p> }
    <p class="form-note">{{ active() ? 'Questions are answered in the order they arrive.' : 'This meeting has ended. Questions are closed.' }}</p>
  </form>` })
export class QuestionFormComponent {
  private api = inject(QuestionService);
  meetingId = input.required<number>(); active = input(true); submitted = output<void>();
  busy = signal(false); message = signal(''); failed = signal(false);
  dictating = signal(false);
  form = inject(FormBuilder).nonNullable.group({
    category: ['General' as Category],
    questionText: ['', [Validators.required, Validators.maxLength(10000), nonBlank]]
  });
  appendDictation(text: string) {
    const control = this.form.controls.questionText;
    const combined = [control.value.trimEnd(), text.trim()].filter(Boolean).join(' ');
    control.setValue(combined.slice(0, 10000)); control.markAsDirty();
    if (combined.length >= 10000) { this.failed.set(true); this.message.set('Your question reached the 10,000-character limit. Review or shorten it before submitting.'); }
  }
  async submit() {
    this.form.markAllAsTouched(); if (this.form.invalid || this.busy() || this.dictating() || !this.active()) return;
    this.busy.set(true); this.message.set('');
    try {
      const v = this.form.getRawValue();
      await firstValueFrom(this.api.submit({meetingId:this.meetingId(),questionText:v.questionText.trim(),category:v.category}));
      this.form.controls.questionText.reset(); this.form.markAsUntouched();
      this.failed.set(false); this.message.set('Question submitted.'); this.submitted.emit();
    } catch(e) { this.failed.set(true); this.message.set(apiError(e)); }
    finally { this.busy.set(false); }
  }
}
