import { Injectable, signal } from '@angular/core';
import { HttpHeaders } from '@angular/common/http';
import { UserSession } from '../models/meeting.model';

@Injectable({ providedIn: 'root' })
export class VisitorSessionService {
  private readonly memory = new Map<string, UserSession>();
  readonly storageWarning = signal(false);
  // Retain old keys only to withdraw the exact legacy question they belong to.
  readonly ownership = signal<Record<number, string>>(this.readLegacy());
  private key(id: number, role: string) { return `smartMeet.session.${id}.${role}`; }
  private readLegacy(): Record<number, string> {
    try {
      const value = JSON.parse(localStorage.getItem('smartMeet.withdrawalTokens') || '{}');
      return Object.fromEntries(Object.entries(value).filter(([id, token]) => Number(id)>0 && typeof token==='string' && /^[a-f0-9]{64}$/i.test(token))) as Record<number,string>;
    } catch { return {}; }
  }
  get(id: number, role: string): UserSession | null {
    const key = this.key(id, role);
    if (this.memory.has(key)) return this.memory.get(key)!;
    try {
      const value = JSON.parse(localStorage.getItem(key) || 'null') as UserSession | null;
      if (value && /^[a-f0-9]{64}$/i.test(value.sessionToken) && value.user.meetingId === id && value.user.role.toLowerCase() === role.toLowerCase()) {
        this.memory.set(key, value); return value;
      }
    } catch { /* Invalid or unavailable browser storage. */ }
    return null;
  }
  save(value: UserSession) {
    const key = this.key(value.user.meetingId, value.user.role.toLowerCase()); this.memory.set(key, value);
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { this.storageWarning.set(true); }
  }
  clear(id: number, role: string) {
    const key = this.key(id, role); this.memory.delete(key);
    try { localStorage.removeItem(key); } catch { this.storageWarning.set(true); }
  }
  headers(id: number, role: string): HttpHeaders {
    const value = this.get(id, role);
    return value ? new HttpHeaders({ Authorization: `Bearer ${value.sessionToken}` }) : new HttpHeaders();
  }
  tokenFor(id: number) { return this.ownership()[id]; }
}
