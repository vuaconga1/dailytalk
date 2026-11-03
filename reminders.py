"""Dry-run reminder outbox. No Zalo messages are sent by this script."""
import argparse,json
from datetime import datetime
from zoneinfo import ZoneInfo
import server

def due(now):
    local=now.astimezone(ZoneInfo('Asia/Ho_Chi_Minh'));date=local.strftime('%Y-%m-%d');clock=local.strftime('%H:%M')
    with server.db() as d:
        users=d.execute('SELECT id,profile FROM users WHERE plan IS NOT NULL').fetchall()
        out=[]
        for u in users:
            p=json.loads(u['profile'])
            if not p.get('reminders') or p['study_time']!=clock:continue
            if d.execute('SELECT 1 FROM attempts WHERE user_id=? AND local_date=? AND completed=1',(u['id'],date)).fetchone():continue
            if d.execute('SELECT 1 FROM jobs WHERE user_id=? AND kind=? AND local_date=?',(u['id'],'study',date)).fetchone():continue
            out.append(dict(user_id=u['id'],local_date=date,study_time=clock,lesson_url=server.ORIGIN+'/',template='study_reminder',status='dry_run_only'))
        return out

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--at',help='ISO date/time with timezone; default now');args=parser.parse_args()
    server.init();now=datetime.fromisoformat(args.at) if args.at else datetime.now(ZoneInfo('Asia/Ho_Chi_Minh'))
    if now.tzinfo is None:parser.error('--at must include timezone, e.g. 2026-10-30T20:30:00+07:00')
    print(json.dumps(dict(mode='dry_run',items=due(now),note='No sends. Add approved provider, verified recipient binding, consent/eligibility checks, entitlement checks and idempotent delivery before enabling.'),ensure_ascii=False,indent=2))
