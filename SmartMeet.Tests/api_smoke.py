"""Real API + PostgreSQL smoke test. Creates two meetings; retains records for review.
Run: python3 SmartMeet.Tests/api_smoke.py [http://localhost:5050]
"""
import json
import sys
import urllib.request
import urllib.error
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone

BASE = (sys.argv[1] if len(sys.argv) > 1 else "http://localhost:5050").rstrip("/")


def request(method, path, body=None, expected=200):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(BASE + "/api" + path, data=data, method=method,
                                 headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=20) as response:
            status, payload = response.status, response.read()
    except urllib.error.HTTPError as error:
        status, payload = error.code, error.read()
    assert status == expected, f"{method} {path}: expected {expected}, got {status}: {payload.decode()}"
    return json.loads(payload) if payload else None


def run():
    request("POST", "/meetings", {"title": "  "}, 400)
    meeting = request("POST", "/meetings", {"title": "Smoke test " + datetime.now(timezone.utc).isoformat()}, 201)
    mid = meeting["meetingId"]
    assert request("GET", f"/meetings/{mid}")["status"] == "Active"
    assert any(m["meetingId"] == mid for m in request("GET", "/meetings"))
    assert request("GET", f"/questions/meeting/{mid}/speaking", expected=204) is None
    request("POST", "/questions", {"meetingId": mid, "name": "", "organization": "Team", "questionText": "?"}, 400)
    questions = [request("POST", "/questions", {"meetingId": mid, "name": name,
                 "organization": "Demo team", "questionText": f"Question from {name}?"}, 201)
                 for name in ["Rahul", "Priya", "Amit"]]
    assert [q["questionId"] for q in request("GET", f"/questions/meeting/{mid}/pending")] == [q["questionId"] for q in questions]
    request("PUT", f'/questions/{questions[1]["questionId"]}/answer', {}, 409)

    # Both requests race against the actual database and separate HTTP scopes.
    def next_request(_):
        req = urllib.request.Request(BASE + f"/api/questions/meeting/{mid}/next", data=b"{}", method="PUT",
                                     headers={"Content-Type": "application/json"})
        try:
            with urllib.request.urlopen(req, timeout=20) as response:
                return response.status
        except urllib.error.HTTPError as error:
            return error.code

    with ThreadPoolExecutor(max_workers=2) as pool:
        assert sorted(pool.map(next_request, range(2))) == [200, 409]
    all_questions = request("GET", f"/questions/meeting/{mid}")
    assert sum(q["status"] == "Speaking" for q in all_questions) == 1
    speaker = request("GET", f"/questions/meeting/{mid}/speaking")
    assert speaker["questionId"] == questions[0]["questionId"] and speaker["speakingStartedAt"].endswith("Z")
    answered = request("PUT", f'/questions/{speaker["questionId"]}/answer', {})
    assert answered["status"] == "Answered" and answered["answeredAt"]
    request("PUT", f'/questions/{speaker["questionId"]}/answer', {}, 409)
    assert len(request("GET", f"/questions/meeting/{mid}/answered")) == 1
    second = request("PUT", f"/questions/meeting/{mid}/next", {})
    assert second["questionId"] == questions[1]["questionId"]
    assert request("GET", f"/questions/meeting/{mid}/speaking")["speakingStartedAt"] == second["speakingStartedAt"]

    other = request("POST", "/meetings", {"title": "Isolation check"}, 201)
    assert request("GET", f'/questions/meeting/{other["meetingId"]}') == []
    request("PUT", f'/meetings/{other["meetingId"]}/end', {})
    assert request("PUT", f"/meetings/{mid}/end", {})["status"] == "Ended"
    request("PUT", f"/meetings/{mid}/end", {})  # Idempotent completion.
    request("POST", "/questions", {"meetingId": mid, "name": "Late", "organization": "Team", "questionText": "Too late?"}, 409)
    request("PUT", f"/questions/meeting/{mid}/next", {}, 409)
    final = request("GET", f"/questions/meeting/{mid}")
    assert len(final) == 3 and not any(q["status"] == "Speaking" for q in final)
    # Ending returns the current speaker to Pending; only explicit answers count.
    assert sum(q["status"] == "Answered" for q in final) == 1
    assert sum(q["status"] == "Pending" for q in final) == 2
    print(f"PASS: API workflows, FIFO, concurrent selection, persistence reads, isolation, completion. Meeting #{mid} retained.")


if __name__ == "__main__":
    try:
        run()
    except (AssertionError, urllib.error.URLError) as error:
        print(f"FAIL: {error}", file=sys.stderr)
        sys.exit(1)
