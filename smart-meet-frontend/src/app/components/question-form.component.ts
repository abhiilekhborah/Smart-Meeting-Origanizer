import { Component, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { QuestionService } from '../services/question.service';
import { apiError } from '../services/meeting.service';
import { nonBlank } from './create-meeting.component';
import { VoiceInputComponent } from './voice-input.component';
import { VisitorSessionService } from '../services/visitor-session.service';
@Component({ selector: 'app-question-form', standalone: true, imports: [ReactiveFormsModule, VoiceInputComponent], template: `
  <form [formGroup]="form" (ngSubmit)="submit()" class="question-form">
    <fieldset [disabled]="!active() || busy()">
      <div class="input-row"><div><label for="participant-name">Your name</label><input id="participant-name" formControlName="name" placeholder="Full name" maxlength="100"></div><div><label for="organization">Organization</label><input id="organization" formControlName="organization" placeholder="Company or team" maxlength="150"></div></div>
      <label for="question">Your question</label><textarea id="question" formControlName="questionText" placeholder="What would you like to ask?" maxlength="10000" rows="4"></textarea>
      <app-voice-input [context]="meetingId()" [disabled]="!active() || busy() || form.controls.questionText.value.length >= 10000" (dictated)="appendDictation($event)" (capturing)="dictating.set($event)" />
      @if (form.touched && form.invalid) { <p class="field-error">Please fill in your name, organization, and question.</p> }
      <button class="button primary wide" type="submit" [disabled]="dictating()">{{ busy() ? 'Submitting…' : 'Submit question' }} <span>↗</span></button>
    </fieldset>
    @if (message()) { <p class="inline-message" [class.field-error]="failed()" role="status">{{ message() }}</p> }
    <p class="form-note">{{ active() ? 'Questions are answered in the order they arrive.' : 'This meeting has ended. Questions are closed.' }}</p>
  </form>` })
export class QuestionFormComponent {
  private api = inject(QuestionService);
  private visitor = inject(VisitorSessionService);
  meetingId = input.required<number>(); active = input(true); submitted = output<void>();
  busy = signal(false); message = signal(''); failed = signal(false);
  dictating = signal(false);
  form = inject(FormBuilder).nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(100), nonBlank]],
    organization: ['', [Validators.required, Validators.maxLength(150), nonBlank]],
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
      const question = await firstValueFrom(this.api.submit({ meetingId: this.meetingId(), name: v.name.trim(), organization: v.organization.trim(), questionText: v.questionText.trim() }));
      const savedToken = this.visitor.rememberQuestion(question.questionId, question.withdrawalToken);
      this.form.controls.questionText.reset(); this.form.markAsUntouched();
      this.failed.set(false); this.message.set(savedToken ? 'Question submitted.' : 'Question saved. Browser storage is unavailable, so its withdrawal key will be lost when you reload.'); this.submitted.emit();
    } catch(e) { this.failed.set(true); this.message.set(apiError(e)); }
    finally { this.busy.set(false); }
  }
}
