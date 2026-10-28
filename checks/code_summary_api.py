"""Code joining, collision retries, complete summary and PostgreSQL persistence checks.
Usage: python3 checks/code_summary_api.py http://localhost:5051 CAPS_aiCodeVerify
Only run against an isolated verification database. Creates retained test fixtures.
"""
import json,os,re,secrets,subprocess,sys
from core_api import call
DB=sys.argv[2];assert DB!='SmartMeetDB','Use a separate verification database.'
PSQL=os.environ.get('PSQL','/opt/homebrew/opt/postgresql@16/bin/psql')
def sql(statement,fail=False):
 r=subprocess.run([PSQL,'-h','localhost','-d',DB,'-At','-v','ON_ERROR_STOP=1','-c',statement],text=True,capture_output=True)
 if fail:assert r.returncode!=0,'Constraint did not reject invalid data';return
 assert r.returncode==0,r.stderr
 return r.stdout.strip()
def public(value):assert not any(k in json.dumps(value) for k in ['sessionTokenHash','withdrawalTokenHash','sessionToken'])
def run():
 result=call('POST','/meetings',{'title':'Code and summary verification','organizerName':'Organizer','organization':'Checks','description':'Detailed meeting snapshot'},expected=201)
 mid=result['meeting']['meetingId'];code=result['meeting']['meetingCode'];org=result['session']['sessionToken']
 assert re.fullmatch('[a-z]{3}-[a-z]{4}-[a-z]{3}',code)
 assert call('GET',f'/meetings/by-code/{code.upper()}')['meetingId']==mid
 call('GET','/meetings/by-code/invalid',expected=400)
 call('GET','/meetings/by-code/zzz-zzzz-zzz',expected=404)
 a=call('POST',f'/meetings/by-code/{code}/join',{'name':'Alex','organization':'College','email':'alex@example.test'})
 token=a['sessionToken'];uid=a['user']['userId']
 b=call('POST',f'/meetings/by-code/{code.upper()}/join',{'name':'Alex','organization':'College'})
 assert b['user']['userId']!=uid
 assert call('POST',f'/meetings/by-code/{code}/join',{'name':'Reuse','organization':'College'},token)['user']['userId']==uid
 for _ in range(3):assert call('GET','/users/me',token=token)['userId']==uid
 assert call('GET',f'/meetings/{mid}')['totalParticipants']==2
 call('GET',f'/meetings/{mid}/summary',expected=401)
 call('GET',f'/meetings/{mid}/summary',token=token,expected=403)
 call('GET',f'/meetings/{mid}/summary',token=org,expected=409)
 qs=[call('POST','/questions',{'meetingId':mid,'questionText':text,'category':category},token,201) for text,category in [('Answered question','Technical'),('Pending question','General'),('Withdrawn question','Other')]]
 call('PUT',f'/questions/meeting/{mid}/next',{},org)
 # Set a known actual speaking start; test exact persisted duration and average.
 sql(f"UPDATE \"MeetingQuestions\" SET \"SpeakingStartedAt\"=now()-interval '30 seconds' WHERE \"QuestionId\"={qs[0]['questionId']}")
 answered=call('PUT',f'/questions/{qs[0]["questionId"]}/answer',{},org)
 call('PUT',f'/questions/{qs[0]["questionId"]}/note',{'organizerNote':'Answered during technical discussion.'},org)
 call('POST',f'/questions/{qs[2]["questionId"]}/withdraw',{},token)
 call('PUT',f'/meetings/{mid}/end',{},org)
 call('GET',f'/meetings/by-code/{code}',expected=409)
 call('POST',f'/meetings/by-code/{code}/join',{'name':'Late','organization':'College'},expected=409)
 summary=call('GET',f'/meetings/{mid}/summary',token=org)
 public(summary)
 assert (summary['totalQuestions'],summary['answeredQuestions'],summary['pendingQuestions'],summary['withdrawnQuestions'],summary['totalParticipants'])==(3,1,1,1,2)
 assert summary['totalSpeakingDurationSeconds']==answered['speakingDurationSeconds']
 assert summary['averageSpeakingDurationSeconds']==answered['speakingDurationSeconds']
 assert summary['description']=='Detailed meeting snapshot' and summary['organizerName']=='Organizer' and summary['meetingCode']==code and summary['status']=='Ended'
 assert len(summary['questions'])==3 and summary['questions'][0]['organizerNote']=='Answered during technical discussion.'
 assert next(p for p in summary['participants'] if p['userId']==uid)['questionsSubmitted']==3
 times=[event['at'] for event in summary['timeline']];assert times==sorted(times)
 assert {'started','joined','submitted','speaking','answered','withdrawn','ended'}.issubset({e['kind'] for e in summary['timeline']})
 assert call('GET',f'/meetings/{mid}/summary',token=org)==summary
 # Case-insensitive uniqueness is enforced by PostgreSQL, not only by lookup normalization.
 other=call('POST','/meetings',{'title':'Other code verification','organizerName':'Other','organization':'Checks'},expected=201)
 other_id=other['meeting']['meetingId'];other_org=other['session']['sessionToken']
 call('GET',f'/meetings/{mid}/summary',token=other_org,expected=403)
 sql(f"UPDATE \"Meeting\" SET \"MeetingCode\"='{code.upper()}' WHERE \"MeetingId\"={other_id}",True)
 # Force one real code collision with a test-only trigger. Sequences advance outside rollback.
 sql(f"""CREATE SEQUENCE code_collision_probe;
 CREATE FUNCTION force_code_collision() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF NEW."Title"='Forced collision check' AND nextval('code_collision_probe')=1 THEN NEW."MeetingCode":='{code}'; END IF;
 RETURN NEW; END $$;
 CREATE TRIGGER force_code_collision BEFORE INSERT ON "Meeting" FOR EACH ROW EXECUTE FUNCTION force_code_collision();""")
 try:
  collided=call('POST','/meetings',{'title':'Forced collision check','organizerName':'Retry organizer','organization':'Checks'},expected=201)
  assert collided['meeting']['meetingCode']!=code
  assert sql("SELECT count(*) FROM \"Meeting\" WHERE \"Title\"='Forced collision check'")=='1'
  assert sql(f'SELECT count(*) FROM "MeetingAttendees" WHERE "MeetingId"={collided["meeting"]["meetingId"]}')=='1'
 finally:sql('DROP TRIGGER force_code_collision ON "Meeting"; DROP FUNCTION force_code_collision(); DROP SEQUENCE code_collision_probe;')
 print('PASS: normalized code lookup, invalid/ended rejection, shared session reuse, original numeric workflow, organizer-only summary, snapshot statistics/timeline/history, persistence, case-insensitive uniqueness and actual collision retry.')
if __name__=='__main__':run()
