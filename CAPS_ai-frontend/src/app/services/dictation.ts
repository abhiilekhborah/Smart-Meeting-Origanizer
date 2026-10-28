// Minimal Web Speech API types, including Safari/Chrome's prefixed constructor.
export interface SpeechResult { readonly isFinal: boolean; readonly [index: number]: { transcript: string }; }
export interface SpeechResultEvent { readonly resultIndex: number; readonly results: ArrayLike<SpeechResult>; }
export interface Recognition {
  lang: string; continuous: boolean; interimResults: boolean;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onresult: ((event: SpeechResultEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  start(): void; stop(): void; abort(): void;
}
export type RecognitionConstructor = new () => Recognition;
export type DictationState = 'idle' | 'starting' | 'listening' | 'stopping';
export interface DictationCallbacks {
  state(value: DictationState): void;
  finalText(text: string): void;
  interimText(text: string): void;
  message(text: string, error: boolean): void;
}

const errors: Record<string, string> = {
  'not-allowed': 'Microphone access was denied. Allow microphone access in your browser and macOS settings, then try again.',
  'service-not-allowed': 'Your browser blocked speech recognition. Try opening CAPS.ai Meetings Organizer in Google Chrome.',
  'audio-capture': 'No microphone is available. Connect a microphone and check your macOS sound settings.',
  'no-speech': 'No speech was detected. Try again and speak clearly into the microphone.',
  'network': 'Your browser could not connect to its speech-recognition service. This can happen in Brave or an embedded browser even when your internet works. Open this meeting in Google Chrome and allow microphone access. If Chrome also fails, check your internet connection.',
  'language-not-supported': 'English speech recognition is unavailable. Try Google Chrome or type your question.',
  'aborted': 'Dictation stopped. You can edit your question or try again.'
};

// Kept independent of Angular so the asynchronous browser lifecycle can be tested.
export class DictationSession {
  private recognition: Recognition | null = null;
  private stopping = false;
  private callbacks: DictationCallbacks;
  private factory: () => Recognition;
  constructor(factory: () => Recognition, callbacks: DictationCallbacks) {
    this.factory = factory; this.callbacks = callbacks;
  }
  start(language: string): void {
    if (this.recognition) return;
    let recognition: Recognition;
    try { recognition = this.factory(); }
    catch { this.callbacks.message('Speech recognition could not start. Try Google Chrome or type your question.', true); return; }
    this.recognition = recognition;
    this.stopping = false;
    const finalized = new Set<number>();
    let receivedSpeech = false;
    recognition.lang = language;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.onstart = () => {
      if (this.recognition !== recognition || this.stopping) return;
      this.callbacks.state('listening'); this.callbacks.message('Listening… Speak your question, then click Stop.', false);
    };
    recognition.onresult = event => {
      if (this.recognition !== recognition) return;
      const final: string[] = []; const interim: string[] = [];
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]; const text = result[0]?.transcript.trim();
        if (!text) continue;
        if (result.isFinal) {
          if (!finalized.has(i)) { finalized.add(i); final.push(text); }
        } else { interim.push(text); }
      }
      if (final.length) { receivedSpeech = true; this.callbacks.finalText(final.join(' ')); }
      this.callbacks.interimText(interim.join(' '));
    };
    recognition.onerror = event => {
      if (this.recognition !== recognition) return;
      this.cancel();
      this.callbacks.message(errors[event.error] || 'Speech recognition failed. Try again or type your question.', true);
    };
    recognition.onend = () => {
      if (this.recognition !== recognition) return;
      this.release(recognition);
      this.callbacks.message(receivedSpeech ? 'Dictation complete. Review your question, then submit it.' : 'No speech was captured. Try again or type your question.', !receivedSpeech);
    };
    this.callbacks.state('starting'); this.callbacks.interimText('');
    this.callbacks.message('Starting microphone… Allow access if your browser asks.', false);
    try { recognition.start(); }
    catch { this.cancel(); this.callbacks.message('The microphone could not start. Check browser permissions and try again.', true); }
  }
  stop(): void {
    if (!this.recognition) return;
    this.stopping = true;
    this.callbacks.state('stopping');
    this.callbacks.message('Finishing dictation…', false);
    try { this.recognition.stop(); }
    catch { this.cancel(); this.callbacks.message('Dictation stopped. Review your question before submitting.', false); }
  }
  cancel(): void {
    const recognition = this.recognition;
    if (!recognition) return;
    this.release(recognition);
    try { recognition.abort(); } catch { /* The browser may already have stopped. */ }
  }
  private release(recognition: Recognition): void {
    recognition.onstart = recognition.onend = recognition.onresult = recognition.onerror = null;
    this.recognition = null;
    this.stopping = false;
    this.callbacks.interimText(''); this.callbacks.state('idle');
  }
}
