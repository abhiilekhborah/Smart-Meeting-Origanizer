import { Component, DestroyRef, effect, inject, input, output, signal } from '@angular/core';
import { DictationSession, DictationState, RecognitionConstructor } from '../services/dictation';

@Component({ selector: 'app-voice-input', standalone: true, styleUrl: './voice-input.component.css', template: `
  <div class="voice-input">
    <div class="voice-controls">
      <button type="button" class="button voice-button" [class.recording]="state() !== 'idle'"
        [disabled]="disabled() || !supported || state() === 'stopping'" [attr.aria-pressed]="state() !== 'idle'" (click)="toggle()">
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="9" y="2" width="6" height="12" rx="3" stroke="currentColor" stroke-width="1.7"/><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M9 22h6" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>
        {{ state() === 'idle' ? 'Speak question' : state() === 'stopping' ? 'Finishing…' : 'Stop dictation' }}
      </button>
    </div>
    @if (!supported) { <p class="voice-help">Voice input is unavailable in this browser. Open Smart Meet in Google Chrome, or type your question.</p> }
    @else {
      <p class="voice-help">Your browser may use an online speech service. Smart Meet saves only the submitted text.</p>
      @if (feedback()) { <p class="voice-feedback" [class.field-error]="failed()" role="status">{{ feedback() }}</p> }
      @if (interim()) { <p class="voice-interim">Hearing: {{ interim() }}</p> }
    }
  </div>` })
export class VoiceInputComponent {
  disabled = input(false); context = input.required<number>();
  dictated = output<string>(); capturing = output<boolean>();
  state = signal<DictationState>('idle'); interim = signal(''); feedback = signal(''); failed = signal(false);
  private readonly constructorType = typeof window === 'undefined' ? undefined :
    (window as unknown as { SpeechRecognition?: RecognitionConstructor; webkitSpeechRecognition?: RecognitionConstructor }).SpeechRecognition ||
    (window as unknown as { webkitSpeechRecognition?: RecognitionConstructor }).webkitSpeechRecognition;
  readonly supported = !!this.constructorType && window.isSecureContext;
  private destroyed = false;
  private session = new DictationSession(() => new this.constructorType!(), {
    state: state => { this.state.set(state); if (!this.destroyed) this.capturing.emit(state !== 'idle'); },
    finalText: text => { if (!this.destroyed) this.dictated.emit(text); }, interimText: text => this.interim.set(text),
    message: (text, error) => { this.feedback.set(text); this.failed.set(error); }
  });
  constructor() {
    effect(() => { this.context(); this.session.cancel(); this.feedback.set(''); });
    effect(() => { if (this.disabled()) { this.session.cancel(); this.feedback.set(''); } });
    inject(DestroyRef).onDestroy(() => { this.destroyed = true; this.session.cancel(); });
  }
  toggle() {
    if (!this.supported || this.disabled()) return;
    if (this.state() === 'idle') this.session.start('en-IN'); else this.session.stop();
  }
}
