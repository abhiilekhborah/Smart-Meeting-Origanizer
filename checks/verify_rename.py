"""Compare the original three-table database with a renamed copy. Never prints record contents.
Usage: python3 checks/verify_rename.py OriginalDatabase RenamedDatabase
"""
import json,os,subprocess,sys
PSQL=os.environ.get('PSQL','/opt/homebrew/opt/postgresql@16/bin/psql')
def query(db,sql):return json.loads(subprocess.check_output([PSQL,'-h','localhost','-d',db,'-At','-v','ON_ERROR_STOP=1','-c',sql],text=True))
old,new=sys.argv[1:3]
for source,target,key in [('Meetings','Meeting','MeetingId'),('Users','MeetingAttendees','UserId'),('Questions','MeetingQuestions','QuestionId')]:
 before=query(old,f"SELECT COALESCE(json_agg(t ORDER BY \"{key}\"),'[]') FROM \"{source}\" t")
 after=query(new,f"SELECT COALESCE(json_agg(t ORDER BY \"{key}\"),'[]') FROM \"{target}\" t")
 indexed={row[key]:row for row in after}
 assert all(indexed.get(row[key])==row for row in before),f'{source}: original row changed'
 print(f'PASS: {len(before)} original {source} records exactly preserved in {target}.')
assert query(new,"SELECT json_agg(tablename ORDER BY tablename) FROM pg_tables WHERE schemaname='public'")==['Meeting','MeetingAttendees','MeetingQuestions','__EFMigrationsHistory']
assert query(new,"SELECT count(*) FROM pg_constraint WHERE connamespace='public'::regnamespace AND contype='f' AND convalidated")==3
print('PASS: exactly three application tables, migration history, and three validated foreign keys.')
