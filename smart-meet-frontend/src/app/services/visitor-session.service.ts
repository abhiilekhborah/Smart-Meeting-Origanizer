import { Injectable, signal } from '@angular/core';

const tokenPattern = /^[a-f0-9]{64}$/i;
@Injectable({ providedIn: 'root' })
export class VisitorSessionService {
  private readonly ownershipKey = 'smartMeet.withdrawalTokens';
  private readonly votesKey = 'smartMeet.votedQuestions';
  private memoryToken = '';
  readonly ownership = signal<Record<number, string>>(this.readOwnership());
  readonly voted = signal<number[]>(this.readVotes());
  readonly storageWarning = signal(false);
  private read(key: string): string | null { try { return localStorage.getItem(key); } catch { return null; } }
  private write(key: string, value: string): boolean {
    try { localStorage.setItem(key, value); return true; } catch { this.storageWarning.set(true); return false; }
  }
  private readOwnership(): Record<number, string> {
    try {
      const raw = JSON.parse(this.read(this.ownershipKey) || '{}');
      const result: Record<number,string> = {};
      for (const [id, token] of Object.entries(raw)) {
        if (Number.isSafeInteger(Number(id)) && Number(id)>0 && typeof token==='string' && tokenPattern.test(token)) result[Number(id)]=token;
      }
      return result;
    } catch { return {}; }
  }
  private readVotes(): number[] {
    try { const raw = JSON.parse(this.read(this.votesKey) || '[]'); return Array.isArray(raw) ? raw.filter(id => Number.isSafeInteger(id) && id > 0) : []; }
    catch { return []; }
  }
  visitorToken(): string {
    const stored = this.read('smartMeet.visitorToken');
    if (stored && tokenPattern.test(stored)) return stored;
    if (!this.memoryToken) this.memoryToken = Array.from(crypto.getRandomValues(new Uint8Array(32)), byte => byte.toString(16).padStart(2,'0')).join('');
    this.write('smartMeet.visitorToken', this.memoryToken); return this.memoryToken;
  }
  rememberQuestion(id: number, token: string): boolean {
    const ownership = { ...this.ownership(), [id]: token };
    this.ownership.set(ownership); return this.write(this.ownershipKey, JSON.stringify(ownership));
  }
  rememberVote(id: number) {
    if (!this.voted().includes(id)) this.voted.update(ids => [...ids, id]);
    this.write(this.votesKey, JSON.stringify(this.voted()));
  }
  tokenFor(id: number): string | undefined { return this.ownership()[id]; }
}
