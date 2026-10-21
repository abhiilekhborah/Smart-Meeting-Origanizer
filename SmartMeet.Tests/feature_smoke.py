"""Expansion integration checks against the real API and migrated PostgreSQL.
Run from SmartMeet/: python3 SmartMeet.Tests/feature_smoke.py [http://localhost:5050]
Creates one clearly named test meeting and retains its records.
"""
import concurrent.futures
import datetime
import json
import re
import secrets
import sys
import tempfile
import threading
import urllib.error
import urllib.request
from pathlib import Path

BASE = (sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:5050').rstrip('/')
checks = 0


def call(method, path, body=None, expected=200):
    global checks
    request = urllib.request.Request(BASE + '/api' + path,
        data=json.dumps(body).encode() if body is not None else None,
        headers={'Content-Type': 'application/json'}, method=method)
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            status, raw = response.status, response.read()
    except urllib.error.HTTPError as error:
        status, raw = error.code, error.read()
    if expected is not None:
        assert status == expected, f'{method} {path}: expected {expected}, got {status}: {raw.decode()}'
        checks += 1
    value = json.loads(raw) if raw else None
    return (status, value) if expected is None else value


def public(question):
    assert not {'withdrawalToken', 'withdrawalTokenHash', 'visitorToken', 'visitorTokenHash'}.intersection(question)


def run():
    meeting = call('POST', '/meetings', {'title': 'Expansion verification ' + datetime.datetime.now(datetime.timezone.utc).isoformat()}, 201)
    mid = meeting['meetingId']
    call('GET', f'/meetings/{mid}/summary', expected=409)
    for message in ['', '   ', 'x' * 301]:
        call('POST', f'/meetings/{mid}/announcements', {'message': message}, 400)
    older = call('POST', f'/meetings/{mid}/announcements', {'message': 'Welcome to the test meeting.'}, 201)
    newer = call('POST', f'/meetings/{mid}/announcements', {'message': 'Please keep questions brief.'}, 201)
    assert [a['id'] for a in call('GET', f'/meetings/{mid}/announcements')] == [newer['id'], older['id']]

    questions = [call('POST', '/questions', {'meetingId': mid, 'name': name, 'organization': 'Verification team', 'questionText': text}, 201)
        for name, text in [('Rahul', 'First in FIFO?'), ('Priya', 'I will withdraw this.'), ('Amit', 'More votes do not change my place.'), ('Neha', 'Keep this pending.')]]
    ids = [q['questionId'] for q in questions]
    for q in questions:
        assert re.fullmatch('[a-f0-9]{64}', q['withdrawalToken']) and 'withdrawalTokenHash' not in q
    assert len({q['withdrawalToken'] for q in questions}) == 4
    for q in call('GET', f'/questions/meeting/{mid}'):
        public(q)

    visitor = secrets.token_hex(32)
    call('POST', f'/questions/{ids[0]}/upvote', {'visitorToken': 'invalid'}, 400)
    # Two HTTP scopes race with the same visitor identity.
    barrier = threading.Barrier(2)
    def concurrent_vote(_):
        barrier.wait()
        return call('POST', f'/questions/{ids[0]}/upvote', {'visitorToken': visitor}, expected=None)[0]
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        assert sorted(pool.map(concurrent_vote, range(2))) == [200, 409]
    call('POST', f'/questions/{ids[0]}/upvote', {'visitorToken': visitor.upper()}, 409)
    for _ in range(3):
        voted = call('POST', f'/questions/{ids[2]}/upvote', {'visitorToken': secrets.token_hex(32)})
        public(voted)
    assert voted['voteCount'] == 3
    call('POST', f'/questions/{ids[1]}/upvote', {'visitorToken': visitor})
    assert [q['questionId'] for q in call('GET', f'/questions/meeting/{mid}/pending')] == ids
    first = call('PUT', f'/questions/meeting/{mid}/next', {})
    public(first)
    assert first['questionId'] == ids[0] and first['voteCount'] == 1
    call('POST', f'/questions/{ids[0]}/withdraw', {'withdrawalToken': questions[0]['withdrawalToken']}, 409)
    answered = call('PUT', f'/questions/{ids[0]}/answer', {})
    public(answered)
    call('POST', f'/questions/{ids[0]}/withdraw', {'withdrawalToken': questions[0]['withdrawalToken']}, 409)
    call('POST', f'/questions/{ids[1]}/withdraw', {'withdrawalToken': 'invalid'}, 400)
    call('POST', f'/questions/{ids[1]}/withdraw', {'withdrawalToken': questions[3]['withdrawalToken']}, 403)
    withdrawn = call('POST', f'/questions/{ids[1]}/withdraw', {'withdrawalToken': questions[1]['withdrawalToken']})
    public(withdrawn)
    assert withdrawn['status'] == 'Withdrawn' and withdrawn['withdrawnAt'] and withdrawn['voteCount'] == 1
    call('POST', f'/questions/{ids[1]}/withdraw', {'withdrawalToken': questions[1]['withdrawalToken']}, 409)
    call('POST', f'/questions/{ids[1]}/upvote', {'visitorToken': secrets.token_hex(32)}, 409)
    assert [q['questionId'] for q in call('GET', f'/questions/meeting/{mid}/pending')] == ids[2:]
    next_speaker = call('PUT', f'/questions/meeting/{mid}/next', {})
    assert next_speaker['questionId'] == ids[2]
    public(call('GET', f'/questions/meeting/{mid}/speaking'))
    assert call('GET', f'/questions/meeting/{mid}/answered')[0]['voteCount'] == 1

    ended = call('PUT', f'/meetings/{mid}/end', {})
    assert ended['status'] == 'Ended' and ended['endedAt']
    assert call('PUT', f'/meetings/{mid}/end', {})['endedAt'] == ended['endedAt']
    summary = call('GET', f'/meetings/{mid}/summary')
    assert (summary['totalQuestions'], summary['answeredQuestions'], summary['pendingQuestions'], summary['withdrawnQuestions'], summary['totalUpvotes']) == (4, 1, 2, 1, 5)
    start = datetime.datetime.fromisoformat(summary['startedAt'].replace('Z', '+00:00'))
    end = datetime.datetime.fromisoformat(summary['endedAt'].replace('Z', '+00:00'))
    assert abs((end - start).total_seconds() - summary['durationSeconds']) < .001
    assert call('GET', f'/meetings/{mid}/summary') == summary
    final = call('GET', f'/questions/meeting/{mid}')
    returned = next(q for q in final if q['questionId'] == ids[2])
    assert returned['status'] == 'Pending' and returned['speakingStartedAt'] is None
    assert sum(q['voteCount'] for q in final) == 5 and len(final) == 4
    for q in final:
        public(q)
    call('POST', f'/questions/{ids[3]}/withdraw', {'withdrawalToken': questions[3]['withdrawalToken']}, 409)
    call('POST', f'/questions/{ids[3]}/upvote', {'visitorToken': visitor}, 409)
    call('POST', f'/meetings/{mid}/announcements', {'message': 'Too late'}, 409)
    assert len(call('GET', f'/meetings/{mid}/announcements')) == 2
    call('POST', f'/questions/{2147483647}/withdraw', {'withdrawalToken': secrets.token_hex(32)}, 404)
    Path(tempfile.gettempdir(), 'smartmeet-expansion-summary.json').write_text(json.dumps(summary))
    print(f'PASS: {checks} HTTP checks plus assertions for votes/concurrency, private ownership, withdrawals, FIFO, announcements, summary counts/duration, end transitions. Meeting #{mid} retained.')


if __name__ == '__main__':
    try:
        run()
    except (AssertionError, urllib.error.URLError) as error:
        print(f'FAIL: {error}', file=sys.stderr)
        sys.exit(1)
