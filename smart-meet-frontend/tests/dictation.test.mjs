import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DictationSession } from '../src/app/services/dictation.ts';

class FakeRecognition {
  lang = ''; continuous = false; interimResults = false;
  onstart = null; onend = null; onresult = null; onerror = null;
  starts = 0; stops = 0; aborts = 0;
  start() { this.starts++; }
  stop() { this.stops++; }
  abort() { this.aborts++; }
}
function setup() {
  const engine = new FakeRecognition(); const states = []; const final = []; const interim = []; const messages = [];
  const session = new DictationSession(() => engine, {
    state: value => states.push(value), finalText: value => final.push(value),
    interimText: value => interim.push(value), message: (text, error) => messages.push({text,error})
  });
  return { engine, session, states, final, interim, messages };
}
const result = (text, isFinal) => ({0:{transcript:text},isFinal});

test('starts only once and stays capturing until the browser starts', () => {
  const {session,engine,states} = setup(); session.start('en-IN'); session.start('hi-IN');
  assert.equal(engine.starts,1); assert.equal(engine.lang,'en-IN');
  assert.equal(engine.continuous,true); assert.equal(engine.interimResults,true);
  assert.deepEqual(states,['starting']); engine.onstart(); assert.equal(states.at(-1),'listening');
});
test('interim text is previewed; revised and repeated final results are appended once', () => {
  const {session,engine,final,interim} = setup(); session.start('en-IN');
  engine.onresult({resultIndex:0,results:[result('How',false)]});
  assert.deepEqual(final,[]); assert.equal(interim.at(-1),'How');
  engine.onresult({resultIndex:0,results:[result('How does FIFO work?',true)]});
  engine.onresult({resultIndex:0,results:[result('How does FIFO work?',true),result('Can you explain?',false)]});
  engine.onresult({resultIndex:1,results:[result('How does FIFO work?',true),result('Can you explain?',true)]});
  assert.deepEqual(final,['How does FIFO work?','Can you explain?']); assert.equal(interim.at(-1),'');
});
test('stop waits for the final result before returning to idle', () => {
  const {session,engine,final,states,messages} = setup(); session.start('en-IN'); engine.onstart(); session.stop();
  assert.equal(engine.stops,1); assert.equal(states.at(-1),'stopping');
  engine.onresult({resultIndex:0,results:[result('My question',true)]}); engine.onend();
  assert.deepEqual(final,['My question']); assert.equal(states.at(-1),'idle');
  assert.match(messages.at(-1).text,/Review/); assert.equal(messages.at(-1).error,false);
});
test('permission denial aborts capture and gives an actionable error', () => {
  const {session,engine,states,messages} = setup(); session.start('en-IN'); engine.onerror({error:'not-allowed'});
  assert.equal(states.at(-1),'idle'); assert.equal(engine.aborts,1);
  assert.equal(messages.at(-1).error,true); assert.match(messages.at(-1).text,/Microphone access was denied/);
});
test('cancel releases microphone handlers and ignores late results after navigation', () => {
  const {session,engine,final,states} = setup(); session.start('en-IN'); const lateResult = engine.onresult;
  session.cancel(); lateResult({resultIndex:0,results:[result('Must not be added',true)]});
  assert.deepEqual(final,[]); assert.equal(engine.onresult,null); assert.equal(engine.onend,null);
  assert.equal(engine.aborts,1); assert.equal(states.at(-1),'idle');
});
test('a new dictation session can recognize the same result index again', () => {
  const {session,engine,final} = setup();
  for (const text of ['First question','Second question']) {
    session.start('en-IN'); engine.onresult({resultIndex:0,results:[result(text,true)]}); engine.onend();
  }
  assert.deepEqual(final,['First question','Second question']);
});
test('silent end reports no captured speech without creating question text', () => {
  const {session,engine,final,messages} = setup(); session.start('en-IN'); engine.onend();
  assert.deepEqual(final,[]); assert.equal(messages.at(-1).error,true); assert.match(messages.at(-1).text,/No speech/);
});
test('synchronous startup errors release capture so typing/submitting can continue', () => {
  const {session,engine,states,messages} = setup(); engine.start = () => { throw new Error('blocked'); };
  session.start('en-IN'); assert.equal(states.at(-1),'idle'); assert.equal(engine.aborts,1);
  assert.match(messages.at(-1).text,/permissions/);
});
test('stopping during microphone startup cannot return to the listening state', () => {
  const {session,engine,states} = setup(); session.start('en-IN'); session.stop(); engine.onstart();
  assert.equal(states.at(-1),'stopping'); engine.onend(); assert.equal(states.at(-1),'idle');
});
test('network failures explain Brave compatibility and release capture without adding text', () => {
  const {session,engine,states,final,messages} = setup(); session.start('en-IN'); engine.onerror({error:'network'});
  assert.equal(states.at(-1),'idle'); assert.equal(engine.aborts,1); assert.deepEqual(final,[]);
  assert.equal(messages.at(-1).error,true); assert.match(messages.at(-1).text,/Brave/);
  assert.match(messages.at(-1).text,/Google Chrome/); assert.match(messages.at(-1).text,/even when your internet works/);
});
