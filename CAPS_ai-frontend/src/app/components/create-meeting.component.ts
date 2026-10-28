import { Component, inject, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { Router } from '@angular/router';
import { apiError, MeetingService } from '../services/meeting.service';
import { VisitorSessionService } from '../services/visitor-session.service';
export const nonBlank = Validators.pattern(/\S/);
@Component({selector:'app-create-meeting',standalone:true,imports:[ReactiveFormsModule],template:`
  <form [formGroup]="form" (ngSubmit)="create()" class="create-form">
    <label for="meeting-title">Meeting title</label><input id="meeting-title" formControlName="title" maxlength="200">
    <label for="meeting-description">Description (optional)</label><textarea id="meeting-description" formControlName="description" maxlength="5000" rows="2"></textarea>
    <label for="organizer-name">Organizer name</label><input id="organizer-name" formControlName="organizerName" maxlength="100">
    <label for="organizer-organization">Organization</label><input id="organizer-organization" formControlName="organization" maxlength="150">
    @if(form.touched&&form.invalid){<p class="field-error">Enter a title, organizer name, and organization within the field limits.</p>}
    @if(error()){<p class="notice error" role="alert">{{error()}}</p>}
    <button class="button primary wide" [disabled]="busy()">{{busy()?'Creating meeting…':'Create meeting'}} <span>→</span></button>
  </form>`})
export class CreateMeetingComponent {
  private api=inject(MeetingService);private sessions=inject(VisitorSessionService);private router=inject(Router);
  busy=signal(false);error=signal('');created=output<void>();
  form=inject(FormBuilder).nonNullable.group({title:['',[Validators.required,Validators.maxLength(200),nonBlank]],description:['',[Validators.maxLength(5000)]],organizerName:['',[Validators.required,Validators.maxLength(100),nonBlank]],organization:['',[Validators.required,Validators.maxLength(150),nonBlank]]});
  async create(){
    this.form.markAllAsTouched();if(this.form.invalid||this.busy())return;this.busy.set(true);this.error.set('');
    try{const v=this.form.getRawValue();const result=await firstValueFrom(this.api.create({...v,title:v.title.trim(),organizerName:v.organizerName.trim(),organization:v.organization.trim(),description:v.description.trim()||null}));this.sessions.save(result.session);this.created.emit();await this.router.navigate(['/meeting',result.meeting.meetingId,'organizer']);}
    catch(e){this.error.set(apiError(e));}finally{this.busy.set(false);}
  }
}
