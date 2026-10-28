import { Injectable } from '@angular/core';
import { APP_SETTINGS } from '../app-settings';
import { invitationUrl } from './invitation';
@Injectable({providedIn:'root'})
export class InvitationService {
  url(code: string) { return invitationUrl(code, APP_SETTINGS.publicApplicationBaseUrl, location.origin); }
}
