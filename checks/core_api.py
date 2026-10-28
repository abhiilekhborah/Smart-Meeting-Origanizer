"""Session-aware integration checks. Run against an isolated migrated database/API.
Usage: python3 checks/core_api.py http://localhost:5051
Creates and retains clearly named verification records. No credentials are printed.
"""
import concurrent.futures
import datetime
import json
import secrets
import sys
import urllib.error
import urllib.request

BASE=(sys.argv[1] if len(sys.argv)>1 else 'http://localhost:5050').rstrip('/')
checks=0

def call(method,path,body=None,token=None,expected=200):
    global checks
    headers={'Content-Type':'application/json'}
    if token: headers['Authorization']='Bearer '+token
    req=urllib.request.Request(BASE+'/api'+path,data=json.dumps(body).encode() if body is not None else None,method=method,headers=headers)
    try:
        with urllib.request.urlopen(req,timeout=20) as r: status,raw=r.status,r.read()
    except urllib.error.HTTPError as e: status,raw=e.code,e.read()
    value=json.loads(raw) if raw and raw.startswith((b'{',b'[')) else None
    if expected is None:return status,value
    assert status==expected,f'{method} {path}: expected {expected}, got {status}'
    checks+=1
    return value

def public(value):
    assert 'sessionToken' not in value and 'sessionTokenHash' not in value and 'withdrawalTokenHash' not in value

def run():
    global checks
    stamp=datetime.datetime.now(datetime.timezone.utc).isoformat()
    result=call('POST','/meetings',{'title':'Session verification '+stamp,'organizerName':'Organizer test','organization':'Test team','description':'Integration test meeting'},expected=201)
    m=result['meeting'];mid=m['meetingId'];org=result['session']['sessionToken'];oid=result['session']['user']['userId']
    assert m['organizerId']==oid and m['organizerName']=='Organizer test' and m['description']=='Integration test meeting'
    assert m['totalParticipants']==0 and m['activeParticipants']==0 and len(m['meetingCode'])<=20
    public(m)
    call('GET',f'/meetings/{mid}/participants',expected=401)
    call('GET','/users/me',expected=401)
    call('GET','/users/me',token='invalid',expected=401)
    call('GET','/users/me',token=secrets.token_hex(32),expected=401)
    assert call('GET','/users/me',token=org)['userId']==oid
    call('GET',f'/meetings/{mid}/summary',token=org,expected=409)
    first=call('POST',f'/meetings/{mid}/join',{'name':'Same name','organization':'Team','email':'person@example.test'})
    second=call('POST',f'/meetings/{mid}/join',{'name':'Same name','organization':'Team'})
    a=first['sessionToken'];b=second['sessionToken'];aid=first['user']['userId'];bid=second['user']['userId']
    assert aid!=bid
    reused=call('POST',f'/meetings/{mid}/join',{'name':'Ignored replacement','organization':'Team'},a)
    assert reused['user']['userId']==aid and reused['sessionToken']==a
    assert call('GET','/users/me',token=a)['userId']==aid
    assert call('POST','/users/heartbeat',{},a)['isActive']
    detail=call('GET',f'/meetings/{mid}');assert detail['totalParticipants']==2 and detail['activeParticipants']==2
    people=call('GET',f'/meetings/{mid}/participants',token=org);assert len(people)==3
    for person in people:public(person)
    call('GET',f'/meetings/{mid}/participants',token=a,expected=403)
    call('POST',f'/meetings/{mid}/join',{'name':'Invalid','organization':'Team','email':'bad'},expected=400)
    call('POST','/questions',{'meetingId':mid,'questionText':'No session'},expected=401)
    call('POST','/questions',{'meetingId':mid,'questionText':'Organizer submission'},org,403)
    q1=call('POST','/questions',{'meetingId':mid,'questionText':'First question','category':'Technical','userId':bid},a,201)
    q2=call('POST','/questions',{'meetingId':mid,'questionText':'Second question'},b,201)
    q3=call('POST','/questions',{'meetingId':mid,'questionText':'Third question','category':'Feedback'},a,201)
    q4=call('POST','/questions',{'meetingId':mid,'questionText':'Fourth question','category':'Other'},a,201)
    assert q1['userId']==aid and q1['name']=='Same name' and q1['category']=='Technical' and q2['category']=='General'
    for q in [q1,q2,q3,q4]:public(q)
    call('POST','/questions',{'meetingId':mid,'questionText':'Bad category','category':'Invalid'},a,400)
    call('PUT',f'/questions/meeting/{mid}/next',{},a,403)
    call('PUT',f'/meetings/{mid}/end',{},a,403)
    call('POST',f'/questions/{q2["questionId"]}/withdraw',{},a,403)
    call('POST',f'/questions/{q2["questionId"]}/withdraw',{'withdrawalToken':secrets.token_hex(32)},a,403)
    call('PUT',f'/questions/{q1["questionId"]}/note',{'organizerNote':'Forbidden'},a,403)
    noted=call('PUT',f'/questions/{q1["questionId"]}/note',{'organizerNote':'Technical discussion'},org)
    assert noted['organizerNote']=='Technical discussion'
    call('PUT',f'/questions/{q1["questionId"]}/note',{'organizerNote':'x'*1001},org,400)
    withdrawn=call('POST',f'/questions/{q2["questionId"]}/withdraw',{},b);assert withdrawn['status']=='Withdrawn'
    call('POST',f'/questions/{q2["questionId"]}/withdraw',{},b,409)
    assert [q['questionId'] for q in call('GET',f'/questions/meeting/{mid}/pending')]==[q1['questionId'],q3['questionId'],q4['questionId']]
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        outcomes=list(pool.map(lambda _:call('PUT',f'/questions/meeting/{mid}/next',{},org,None),range(2)))
    assert sorted(status for status,_ in outcomes)==[200,409]
    speaking=call('GET',f'/questions/meeting/{mid}/speaking');assert speaking['questionId']==q1['questionId']
    call('POST',f'/questions/{q1["questionId"]}/withdraw',{},a,409)
    answered=call('PUT',f'/questions/{q1["questionId"]}/answer',{},org)
    assert answered['status']=='Answered' and answered['speakingDurationSeconds']>=0
    assert answered['speakingStartedAt']==speaking['speakingStartedAt']
    call('PUT',f'/questions/{q1["questionId"]}/answer',{},org,409)
    next_q=call('PUT',f'/questions/meeting/{mid}/next',{},org);assert next_q['questionId']==q3['questionId']
    other=call('POST','/meetings',{'title':'Other verification '+stamp,'organizerName':'Other organizer','organization':'Team'},expected=201)
    other_mid=other['meeting']['meetingId'];other_token=other['session']['sessionToken']
    assert other['meeting']['meetingCode']!=m['meetingCode']
    call('PUT',f'/meetings/{mid}/end',{},other_token,403)
    call('GET',f'/meetings/{mid}/participants',token=other_token,expected=403)
    call('POST','/questions',{'meetingId':other_mid,'questionText':'Cross meeting'},a,403)
    call('POST',f'/meetings/{other_mid}/join',{'name':'Cross','organization':'Team'},a,403)
    ended=call('PUT',f'/meetings/{mid}/end',{},org)
    assert ended['status']=='Ended' and ended['activeParticipants']==0
    assert call('PUT',f'/meetings/{mid}/end',{},org)['endedAt']==ended['endedAt']
    call('POST',f'/meetings/{mid}/join',{'name':'Late','organization':'Team'},expected=409)
    call('POST','/questions',{'meetingId':mid,'questionText':'Late'},a,409)
    call('POST',f'/questions/{q4["questionId"]}/withdraw',{},a,409)
    call('PUT',f'/questions/meeting/{mid}/next',{},org,409)
    summary=call('GET',f'/meetings/{mid}/summary',token=org)
    assert (summary['totalQuestions'],summary['answeredQuestions'],summary['pendingQuestions'],summary['withdrawnQuestions'],summary['totalParticipants'])==(4,1,2,1,2)
    assert 'totalUpvotes' not in summary and summary['durationSeconds']>=0
    final=call('GET',f'/questions/meeting/{mid}');assert len(final)==4
    assert next(q for q in final if q['questionId']==q3['questionId'])['status']=='Pending'
    for q in final:public(q)
    call('POST',f'/questions/{q1["questionId"]}/upvote',{},a,404)
    call('GET',f'/meetings/{mid}/announcements',expected=404)
    print(f'PASS: {checks} HTTP checks plus assertions: sessions, ownership, roles, participants, categories, notes, concurrent FIFO, duration, completion, summary, removed endpoints. Meeting #{mid} retained.')

if __name__=='__main__':run()
