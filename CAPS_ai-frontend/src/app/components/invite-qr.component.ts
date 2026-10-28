import { Component, effect, inject, input, signal } from '@angular/core';
import { Meeting } from '../models/meeting.model';
import { InvitationService } from '../services/invitation.service';
import { isLocalInvitation } from '../services/invitation';
import { qrPng } from '../services/qr-code';
@Component({selector:'app-invite-qr',standalone:true,template:`
  <h2 id="modal-title">CAPS.ai Meetings Organizer invitation</h2><p class="qr-meeting-title">{{meeting().title}}</p><p class="meeting-code">{{meeting().meetingCode}}</p>
  @if(loading()){<p role="status">Generating QR code…</p>}
  @if(error()){<p class="notice error" role="alert">{{error()}} Use the invitation link below.</p>}
  @if(image()){<img class="invitation-qr" [src]="image()" [alt]="'QR code to join '+meeting().title" width="256" height="256">}
  <p class="invitation-link">{{url()}}</p>
  @if(local()){<p class="notice">This address works only on this computer. Use a network-accessible app address before inviting a phone.</p>}
  <div class="dialog-actions"><button class="button secondary" [disabled]="!url()" (click)="copy()">Copy link</button>@if(image()){<a class="button primary" [href]="image()" [download]="'caps-ai-'+meeting().meetingCode+'.png'">Download QR Code</a>}</div>
  @if(message()){<p role="status" class="feature-muted">{{message()}}</p>}
`})
export class InviteQrComponent {
  meeting=input.required<Meeting>();private invitations=inject(InvitationService);
  image=signal('');url=signal('');loading=signal(false);error=signal('');message=signal('');local=signal(false);
  constructor(){effect(onCleanup=>{
    const m=this.meeting();let disposed=false;onCleanup(()=>disposed=true);
    this.loading.set(true);this.error.set('');this.image.set('');this.url.set('');
    try{const url=this.invitations.url(m.meetingCode);this.url.set(url);this.local.set(isLocalInvitation(url));
      void qrPng(url).then(image=>{if(!disposed)this.image.set(image);}).catch(()=>{if(!disposed)this.error.set('QR generation failed.');}).finally(()=>{if(!disposed)this.loading.set(false);});
    }catch(e){this.error.set(e instanceof Error?e.message:'Invitation address is unavailable.');this.loading.set(false);}
  });}
  async copy(){try{await navigator.clipboard.writeText(this.url());this.message.set('Invite link copied.');}catch{this.message.set('Copy the displayed invitation link manually.');}}
}
