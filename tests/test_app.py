"""Integration checks; never calls a paid provider."""
import http.cookiejar, json, os, sys, tempfile, threading, unittest, urllib.request, urllib.error
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
os.environ['AI_MODE']='demo'
import server
from ai import AI,AIError
from content import grade,default_plan

class Client:
    def __init__(self,base):
        self.base=base;self.csrf='';self.opener=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
    def call(self,path,data=None,csrf=True):
        headers={'Content-Type':'application/json','Origin':self.base}
        if csrf:headers['X-CSRF-Token']=self.csrf
        req=urllib.request.Request(self.base+path,data=json.dumps(data).encode() if data is not None else None,headers=headers)
        try:
            with self.opener.open(req) as r:return r.status,json.loads(r.read())
        except urllib.error.HTTPError as e:return e.code,json.loads(e.read())
    def register(self,email='a@example.test'):
        status,_=self.call('/api/register',dict(name='Linh',email=email,password='test-pass-123'));assert status==200
        self.csrf=self.call('/api/me')[1]['csrf']
    def onboard(self):return self.call('/api/onboard',dict(domain='office',role='Sales',goal='Arrange meetings',study_time='20:30',answers=[1,0,2,1,0,2,0,1],reminders=True))
    def attempt(self):return self.call('/api/today')[1]

class AppTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp=tempfile.TemporaryDirectory();server.DATA=Path(cls.tmp.name);(server.DATA/'audio').mkdir();server.DB=server.DATA/'test.sqlite3';server.init()
        cls.http=server.ThreadingHTTPServer(('127.0.0.1',0),server.Handler);server.PORT=cls.http.server_port;server.ORIGIN=f'http://127.0.0.1:{server.PORT}'
        cls.base=server.ORIGIN;cls.thread=threading.Thread(target=cls.http.serve_forever,daemon=True);cls.thread.start()
    @classmethod
    def tearDownClass(cls):cls.http.shutdown();cls.http.server_close();cls.tmp.cleanup()
    def setUp(self):
        server.AI_CLIENT=AI();server.THROTTLE.clear()
        with server.db() as d:
            for table in ('practice','attempts','auth','users','usage','jobs'):d.execute('DELETE FROM '+table)
        self.c=Client(self.base);self.c.register()
    def ready(self):
        self.assertEqual(self.c.onboard()[0],200);a=self.c.attempt()
        for stage in ('words','shadow'):self.assertEqual(self.c.call('/api/checkpoint',dict(attempt_id=a['id'],stage=stage))[0],200)
        s=self.c.call('/api/practice/start',dict(attempt_id=a['id']))[1]
        return a,s
    def test_full_journey_and_idempotent_summary(self):
        a,s=self.ready()
        for txt in ('My name is Linh.','I work in sales.','Could we meet tomorrow?'):
            self.assertEqual(self.c.call('/api/practice/turn',dict(session_id=s['id'],text=txt))[0],200)
        status,summary=self.c.call('/api/complete',dict(attempt_id=a['id']))
        self.assertEqual(status,200);self.assertEqual(summary['turn_count'],3);self.assertEqual(summary['voice_turns'],0)
        self.assertEqual(summary['mode'],'demo');self.assertEqual(self.c.call('/api/complete',dict(attempt_id=a['id']))[1],summary)
        self.assertTrue(self.c.attempt()['completed']);self.assertEqual(self.c.attempt()['day'],1)
    def test_answers_graded_on_server_and_invalid_rejected(self):
        p=dict(domain='daily',role='Teacher',goal='Talk',study_time='20:30',answers=[0]*8,level='advanced',score=8)
        self.assertEqual(self.c.call('/api/onboard',p)[0],200)
        profile=self.c.call('/api/me')[1]['profile'];self.assertEqual(profile['assessment']['score'],3)
        self.assertEqual(profile['level'],'foundation')
        with self.assertRaises(ValueError):grade([True]*8)
    def test_cross_account_cannot_access_attempt_or_session(self):
        a,s=self.ready();b=Client(self.base);b.register('b@example.test')
        self.assertEqual(b.call('/api/checkpoint',dict(attempt_id=a['id'],stage='words'))[0],404)
        self.assertEqual(b.call('/api/practice/turn',dict(session_id=s['id'],text='hello'))[0],404)
        self.assertEqual(b.call('/api/complete',dict(attempt_id=a['id']))[0],404)
    def test_csrf_and_origin(self):
        self.assertEqual(self.c.call('/api/settings',{},csrf=False)[0],403)
        request=urllib.request.Request(self.base+'/api/login',data=b'{}',headers={'Origin':'https://evil.example','Content-Type':'application/json'})
        with self.assertRaises(urllib.error.HTTPError) as e:self.c.opener.open(request)
        self.assertEqual(e.exception.code,403)
    def test_expired_session_rejected_and_cannot_restart(self):
        a,s=self.ready()
        with server.db() as d:d.execute('UPDATE practice SET deadline=1 WHERE id=?',(s['id'],))
        self.assertEqual(self.c.call('/api/practice/turn',dict(session_id=s['id'],text='hello'))[0],409)
        again=self.c.call('/api/practice/start',dict(attempt_id=a['id']))[1]
        self.assertEqual(again['id'],s['id']);self.assertEqual(again['deadline'],1)
        self.assertEqual(self.c.call('/api/reply-audio',dict(session_id=s['id']))[0],409)
    def test_no_double_processing_busy_session(self):
        a,s=self.ready()
        with server.db() as d:d.execute('UPDATE practice SET busy=1 WHERE id=?',(s['id'],))
        self.assertEqual(self.c.call('/api/practice/turn',dict(session_id=s['id'],text='hello'))[0],409)
        self.assertEqual(self.c.call('/api/complete',dict(attempt_id=a['id']))[0],409)
    def test_completion_requires_checkpoints(self):
        self.c.onboard();a=self.c.attempt();self.c.call('/api/practice/start',dict(attempt_id=a['id']))
        self.assertEqual(self.c.call('/api/complete',dict(attempt_id=a['id']))[0],400)
    def test_new_day_and_review_plan(self):
        a,s=self.ready();self.c.call('/api/complete',dict(attempt_id=a['id']))
        with server.db() as d:
            d.execute("UPDATE attempts SET local_date='2000-01-01'");d.execute('UPDATE practice SET started=1,deadline=301')
        nxt=self.c.attempt();self.assertEqual(nxt['day'],2)
        self.assertEqual(self.c.call('/api/practice/start',dict(attempt_id=nxt['id']))[0],200)
        plan=self.c.call('/api/me')[1]['plan'];self.assertEqual(len(plan['days']),30)
        self.assertLess(len({d['lesson_id'] for d in plan['days']}),30)
    def test_plan_cannot_be_overwritten(self):
        self.assertEqual(self.c.onboard()[0],200);self.assertEqual(self.c.onboard()[0],409)
    def test_shared_audio_cache_is_reused(self):
        self.c.onboard();aid=self.c.attempt()['lesson']['id'];calls=[]
        server.AI_CLIENT.mode='openai';server.AI_CLIENT.tts='fake-test'
        server.AI_CLIENT.speech=lambda txt:(calls.append(txt) or b'fake-mp3')
        for _ in range(2):
            with self.c.opener.open(self.base+'/api/audio?lesson='+aid+'&line=all') as r:self.assertEqual(r.read(),b'fake-mp3')
        self.assertEqual(len(calls),1)
    def test_ai_plan_invalid_catalog_is_rejected(self):
        ai=AI();ai.mode='openai';ai.text=lambda *args,**kwargs:({'goal':'Test','days':[dict(day=i+1,lesson_id='NOT_REAL',focus='Test') for i in range(30)]},{})
        with self.assertRaises(AIError):ai.plan(dict(domain='office'))
    def test_auth_session_cookie_is_http_only(self):
        req=urllib.request.Request(self.base+'/api/login',data=json.dumps(dict(email='a@example.test',password='test-pass-123')).encode(),headers={'Content-Type':'application/json'})
        with self.c.opener.open(req) as r:
            cookie=r.headers['Set-Cookie'];self.assertIn('HttpOnly',cookie);self.assertIn('SameSite=Strict',cookie)
    def test_demo_login_disabled_in_live_mode(self):
        server.AI_CLIENT.mode='openai'
        self.assertEqual(self.c.call('/api/demo',{})[0],404)
    def test_daily_provider_budget_blocks_before_call(self):
        server.AI_CLIENT.mode='openai';os.environ['MAX_PROVIDER_CALLS_PER_USER_DAY']='1'
        try:
            uid=self.c.call('/api/me')[1]['user']['id']
            server.provider_budget(uid,'conversation')
            with self.assertRaises(server.Problem) as caught:server.provider_budget(uid,'transcribe')
            self.assertEqual(caught.exception.status,429)
        finally:os.environ.pop('MAX_PROVIDER_CALLS_PER_USER_DAY',None)

if __name__=='__main__':unittest.main(verbosity=2)
