import { Component, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { UserService } from '../services/user.service';
import { VisitorSessionService } from '../services/visitor-session.service';
import { apiError } from '../services/meeting.service';
import { nonBlank } from './create-meeting.component';
import { Participant } from '../models/meeting.model';
@Component({selector:'app-join-meeting',standalone:true,imports:[ReactiveFormsModule],template:`
  <section class="feature-box join-box"><h2>Join meeting</h2>
    <form class="create-form" [formGroup]="form" (ngSubmit)="join()">
      <label for="join-name">Name</label><input id="join-name" formControlName="name" maxlength="100">
      <label for="join-organization">Organization</label><input id="join-organization" formControlName="organization" maxlength="150">
      <label for="join-email">Email (optional)</label><input id="join-email" type="email" formControlName="email" maxlength="150">
      @if(form.touched && form.invalid){<p class="field-error">Enter your name, organization, and a valid email if provided.</p>}
      @if(error()){<p class="field-error" role="alert">{{error()}}</p>}
      <button class="button primary wide" [disabled]="busy()">{{busy()?'Joining…':'Join meeting'}}</button>
    </form>
  </section>`})
export class JoinMeetingComponent {
  meetingCode=input<string|null>(null); meetingId=input.required<number>(); joined=output<Participant>(); private api=inject(UserService); private sessions=inject(VisitorSessionService);
  busy=signal(false);error=signal('');
  form=inject(FormBuilder).nonNullable.group({name:['',[Validators.required,Validators.maxLength(100),nonBlank]],organization:['',[Validators.required,Validators.maxLength(150),nonBlank]],email:['',[Validators.email,Validators.maxLength(150)]]});
  async join(){
    this.form.markAllAsTouched();if(this.form.invalid||this.busy())return;this.busy.set(true);this.error.set('');
    try{const v=this.form.getRawValue();const result=await firstValueFrom(this.api.join(this.meetingId(),{name:v.name.trim(),organization:v.organization.trim(),email:v.email.trim()||null},this.meetingCode()));this.sessions.save(result);this.joined.emit(result.user);}
    catch(e){this.error.set(apiError(e));}finally{this.busy.set(false);}
  }
}
