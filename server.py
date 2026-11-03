"""WeWIN reference MVP. Python standard library only. See production notes in README."""
import base64, hashlib, hmac, json, os, secrets, sqlite3, threading, time, traceback
from pathlib import Path
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from http.cookies import SimpleCookie
from urllib.parse import urlparse, parse_qs
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
from contextlib import contextmanager
from content import LESSONS, DOMAINS, question_list, grade
from ai import AI, AIError

ROOT=Path(__file__).parent
# Minimal dotenv reader: literal KEY=value only; no interpolation or execution.
if (ROOT/'.env').is_file():
    for raw in (ROOT/'.env').read_text().splitlines():
        raw=raw.strip()
        if raw and not raw.startswith('#') and '=' in raw:
            k,v=raw.split('=',1)
            if k.strip().replace('_','').isalnum():os.environ.setdefault(k.strip(),v.strip().strip('"').strip("'"))
if __name__=='__main__':
    import argparse
    parser=argparse.ArgumentParser()
    parser.add_argument('--host');parser.add_argument('--port',type=int);parser.add_argument('--strictPort',action='store_true')
    opts=parser.parse_args()
    if opts.host:os.environ['HOST']=opts.host
    if opts.port:os.environ['PORT']=str(opts.port)
DATA=Path(os.getenv('DATA_DIR',str(ROOT/'data')));DATA.mkdir(parents=True,exist_ok=True)
(DATA/'audio').mkdir(exist_ok=True)
DB=DATA/'wewin.sqlite3'
TZ=ZoneInfo('Asia/Ho_Chi_Minh')
AI_CLIENT=AI();LOCK=threading.RLock();THROTTLE={}
PORT=int(os.getenv('PORT','8000'))
ORIGIN=os.getenv('APP_ORIGIN',f'http://localhost:{PORT}').rstrip('/')
SECURE=ORIGIN.startswith('https://')
HOSTS={urlparse(ORIGIN).netloc,*(h.strip() for h in os.getenv('ALLOWED_HOSTS','').split(',') if h.strip()),*(os.getenv(k) for k in ('VERCEL_URL','VERCEL_BRANCH_URL','VERCEL_PROJECT_PRODUCTION_URL') if os.getenv(k))}
TRUST_PROXY=os.getenv('TRUST_PROXY','0')=='1'

@contextmanager
def db():
    conn=sqlite3.connect(DB,timeout=20);conn.row_factory=sqlite3.Row
    conn.execute('PRAGMA foreign_keys=ON')
    try:yield conn;conn.commit()
    except:conn.rollback();raise
    finally:conn.close()

def init(recover=False):
    with db() as d:
        d.executescript('''
        PRAGMA journal_mode=WAL;
        CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,email TEXT UNIQUE NOT NULL,name TEXT NOT NULL,salt TEXT NOT NULL,password TEXT NOT NULL,profile TEXT,plan TEXT,plan_source TEXT);
        CREATE TABLE IF NOT EXISTS auth(token TEXT PRIMARY KEY,user_id TEXT REFERENCES users(id),csrf TEXT NOT NULL,expires REAL NOT NULL);
        CREATE TABLE IF NOT EXISTS attempts(id TEXT PRIMARY KEY,user_id TEXT REFERENCES users(id),day INTEGER NOT NULL,local_date TEXT NOT NULL,lesson TEXT NOT NULL,words_done INTEGER DEFAULT 0,shadow_done INTEGER DEFAULT 0,completed INTEGER DEFAULT 0,summary TEXT,UNIQUE(user_id,day));
        CREATE TABLE IF NOT EXISTS practice(id TEXT PRIMARY KEY,attempt_id TEXT UNIQUE REFERENCES attempts(id),user_id TEXT REFERENCES users(id),started REAL NOT NULL,deadline REAL NOT NULL,ended INTEGER DEFAULT 0,busy INTEGER DEFAULT 0,turns TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS usage(id INTEGER PRIMARY KEY,user_id TEXT,kind TEXT,model TEXT,usage_json TEXT,created REAL);
        CREATE TABLE IF NOT EXISTS jobs(id INTEGER PRIMARY KEY,user_id TEXT,kind TEXT,local_date TEXT,payload TEXT,status TEXT,UNIQUE(user_id,kind,local_date));
        ''')
        # An interrupted provider call is never replayed automatically at startup.
        if recover:d.execute('UPDATE practice SET busy=0')

def today():return datetime.now(TZ).strftime('%Y-%m-%d')
def tokenhash(s):return hashlib.sha256(s.encode()).hexdigest()
# With SESSION_SECRET set (serverless, many instances), session cookies are self-verifying instead of DB rows.
SESSION_SECRET=os.getenv('SESSION_SECRET','')
def sign(s):return hmac.new(SESSION_SECRET.encode(),s.encode(),hashlib.sha256).hexdigest()
def new_token(uid,age):
    if not SESSION_SECRET:return secrets.token_urlsafe(32)
    body=f'{uid}.{int(time.time()+age)}.{secrets.token_hex(8)}';return body+'.'+sign(body)
def token_csrf(token):return sign('csrf:'+token)[:32] if SESSION_SECRET else secrets.token_urlsafe(24)
def password(p,salt):return hashlib.pbkdf2_hmac('sha256',p.encode(),bytes.fromhex(salt),310000).hex()
def usage(uid,kind,u,model=None):
    with db() as d:d.execute('INSERT INTO usage(user_id,kind,model,usage_json,created) VALUES(?,?,?,?,?)',(uid,kind,model or AI_CLIENT.model,json.dumps(u),time.time()))

def provider_budget(uid,kind):
    """Reserve BEFORE network I/O. Failures count too, limiting costly retries."""
    if AI_CLIENT.mode=='demo':return
    start=datetime.now(TZ).replace(hour=0,minute=0,second=0,microsecond=0).timestamp()
    with LOCK,db() as d:
        count=d.execute("SELECT COUNT(*) FROM usage WHERE user_id=? AND kind LIKE 'reserve_%' AND created>=?",(uid,start)).fetchone()[0]
        if count>=int(os.getenv('MAX_PROVIDER_CALLS_PER_USER_DAY','90')):raise Problem('Đã đạt hạn mức yêu cầu AI trong ngày.',429)
        if kind=='plan' and d.execute("SELECT COUNT(*) FROM usage WHERE user_id=? AND kind='reserve_plan' AND created>=?",(uid,start)).fetchone()[0]>=3:raise Problem('Đã đạt giới hạn thử tạo kế hoạch hôm nay.',429)
        d.execute('INSERT INTO usage(user_id,kind,model,usage_json,created) VALUES(?,?,?,?,?)',(uid,'reserve_'+kind,AI_CLIENT.model,'{}',time.time()))

class Problem(Exception):
    def __init__(self,msg,status=400):self.msg=msg;self.status=status

def profile_validate(p):
    if not isinstance(p,dict):raise Problem('Thiếu hồ sơ học tập.')
    def field(k,limit,required=True):
        v=p.get(k,'')
        if not isinstance(v,str) or len(v)>limit or (required and not v.strip()):raise Problem('Thông tin chưa hợp lệ: '+k)
        return v.strip()
    domain=field('domain',20)
    if domain not in DOMAINS:raise Problem('Lĩnh vực chưa được hỗ trợ.')
    slot=field('study_time',5)
    try:datetime.strptime(slot,'%H:%M')
    except ValueError:raise Problem('Giờ học không hợp lệ.')
    if len(slot)!=5:raise Problem('Giờ học dùng định dạng HH:MM.')
    g=grade(p.get('answers'))
    return dict(domain=domain,role=field('role',150),goal=field('goal',500),difficulty=field('difficulty',300,False),study_time=slot,timezone='Asia/Ho_Chi_Minh',reminders=p.get('reminders') is True,level=g['level'],assessment=g)

def owned_attempt(uid,aid):
    with db() as d:r=d.execute('SELECT * FROM attempts WHERE id=? AND user_id=?',(aid,uid)).fetchone()
    if not r:raise Problem('Không tìm thấy buổi học.',404)
    return dict(r)

def owned_session(uid,sid):
    with db() as d:r=d.execute('SELECT * FROM practice WHERE id=? AND user_id=?',(sid,uid)).fetchone()
    if not r:raise Problem('Không tìm thấy phiên luyện tập.',404)
    return dict(r)

@contextmanager
def reserve(uid,sid):
    with LOCK:
        s=owned_session(uid,sid)
        if s['ended'] or time.time()>=s['deadline']:raise Problem('Đã hết 5 phút hội thoại. Hãy xem tổng kết.',409)
        if s['busy']:raise Problem('AI đang xử lý lượt trước. Vui lòng chờ.',409)
        with db() as d:d.execute('UPDATE practice SET busy=1 WHERE id=?',(sid,))
    try:yield s
    finally:
        with db() as d:d.execute('UPDATE practice SET busy=0 WHERE id=?',(sid,))

class Handler(BaseHTTPRequestHandler):
    server_version='WeWIN/1.0'
    def log_message(self,fmt,*args):
        # No request URL, token, transcript, or email in logs.
        print(f'{self.command} status={args[1] if len(args)>1 else "-"}')
    def send(self,status,payload,ctype='application/json; charset=utf-8',cookie=None):
        body=json.dumps(payload,ensure_ascii=False).encode() if ctype.startswith('application/json') else payload
        self.send_response(status);self.send_header('Content-Type',ctype);self.send_header('Content-Length',str(len(body)))
        self.send_header('X-Content-Type-Options','nosniff');self.send_header('Referrer-Policy','same-origin');self.send_header('Cache-Control','no-store' if not ctype.startswith('audio/') else 'private, max-age=86400')
        self.send_header('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; media-src 'self' blob:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'")
        self.send_header('Permissions-Policy','microphone=(self)')
        if cookie:self.send_header('Set-Cookie',cookie)
        self.end_headers();self.wfile.write(body)
    def cookie(self,token,age=604800):return f'ww_session={token}; Path=/; HttpOnly; SameSite=Strict; Max-Age={age}'+('; Secure' if SECURE else '')
    def session(self):
        try:c=SimpleCookie(self.headers.get('Cookie',''));token=c.get('ww_session').value if c.get('ww_session') else ''
        except:token=''
        if SESSION_SECRET:
            parts=token.split('.')
            if len(parts)==4 and hmac.compare_digest(sign('.'.join(parts[:3])),parts[3]) and parts[1].isdigit() and int(parts[1])>time.time():
                with db() as d:r=d.execute('SELECT * FROM users WHERE id=?',(parts[0],)).fetchone()
                if r:return dict(r,csrf=token_csrf(token),token=tokenhash(token))
            raise Problem('Vui lòng đăng nhập.',401)
        with db() as d:r=d.execute('SELECT a.csrf,a.token,u.* FROM auth a JOIN users u ON u.id=a.user_id WHERE a.token=? AND a.expires>?',(tokenhash(token),time.time())).fetchone()
        if not r:raise Problem('Vui lòng đăng nhập.',401)
        return dict(r)
    def body(self):
        try:n=int(self.headers.get('Content-Length','0'))
        except ValueError:raise Problem('Nội dung không hợp lệ.')
        if n<0 or n>4_000_000:raise Problem('Bản ghi tối đa 4 MB.',413)
        raw=self.rfile.read(n);self._drained=True
        if self.path=='/api/transcribe':return raw
        try:p=json.loads(raw or b'{}')
        except (ValueError,UnicodeDecodeError):raise Problem('JSON không hợp lệ.')
        if not isinstance(p,dict):raise Problem('JSON phải là object.')
        return p
    def gate(self):
        host=self.headers.get('Host','')
        allowed=set(HOSTS)
        if not SECURE:allowed|={f'127.0.0.1:{PORT}',f'localhost:{PORT}'}
        if host not in allowed:raise Problem('Host chưa được cho phép. Cấu hình APP_ORIGIN.',403)
        origin=self.headers.get('Origin')
        if self.command=='POST' and origin and origin not in {ORIGIN,*(('https://' if SECURE else 'http://')+h for h in allowed)}:raise Problem('Origin không hợp lệ.',403)
    def do_GET(self):self.dispatch()
    def do_POST(self):self.dispatch()
    def dispatch(self):
        try:
            self.gate()
            if self.command=='GET':return self.get()
            return self.post()
        except Problem as e:
            # Unread request bodies make some TCP stacks reset the connection before the error reaches the client.
            if self.command=='POST' and not getattr(self,'_drained',False):
                try:
                    n=int(self.headers.get('Content-Length','0'))
                    if 0<n<=4_000_000:self.rfile.read(n)
                except (ValueError,OSError):pass
            self.send(e.status,dict(error=e.msg))
        except (AIError,ValueError) as e:self.send(422,dict(error=str(e)))
        except (BrokenPipeError,ConnectionResetError):pass
        except Exception:
            traceback.print_exc(limit=2)
            self.send(500,dict(error='Có lỗi máy chủ. Dữ liệu đã lưu vẫn được giữ.'))
    def get(self):
        parsed=urlparse(self.path);path=parsed.path;q=parse_qs(parsed.query)
        if path=='/api/config':return self.send(200,dict(mode=AI_CLIENT.mode,domains=DOMAINS,questions=question_list(),daily_seconds=300,catalog=[dict(id=k,title=v['title']) for k,v in LESSONS.items()]))
        if path=='/api/me':
            try:u=self.session()
            except Problem:return self.send(200,dict(user=None))
            return self.send(200,dict(user=dict(id=u['id'],name=u['name'],email=u['email']),csrf=u['csrf'],profile=json.loads(u['profile']) if u['profile'] else None,plan=json.loads(u['plan']) if u['plan'] else None,plan_source=u['plan_source']))
        if path.startswith('/api/'):
            u=self.session();uid=u['id']
            if path=='/api/today':
                if not u['plan']:raise Problem('Hãy hoàn thành khảo sát trước.')
                with LOCK,db() as d:
                    last=d.execute('SELECT * FROM attempts WHERE user_id=? ORDER BY day DESC LIMIT 1',(uid,)).fetchone()
                    if last and (not last['completed'] or last['local_date']==today() or last['day']>=30):a=dict(last)
                    else:
                        day=last['day']+1 if last else 1;plan=json.loads(u['plan']);lesson=LESSONS[plan['days'][day-1]['lesson_id']]
                        aid=tokenhash(f'{uid}:{day}')[:24];d.execute('INSERT INTO attempts(id,user_id,day,local_date,lesson) VALUES(?,?,?,?,?)',(aid,uid,day,today(),json.dumps(lesson)))
                        a=dict(d.execute('SELECT * FROM attempts WHERE id=?',(aid,)).fetchone())
                    ss=d.execute('SELECT * FROM practice WHERE attempt_id=?',(a['id'],)).fetchone()
                a['lesson']=json.loads(a['lesson']);a['summary']=json.loads(a['summary']) if a['summary'] else None
                a['session']=dict(ss) if ss else None
                if a['session']:a['session']['turns']=json.loads(a['session']['turns'])
                a['server_time']=time.time()
                return self.send(200,a)
            if path=='/api/history':
                with db() as d:rows=d.execute('SELECT day,local_date,lesson,summary,completed FROM attempts WHERE user_id=? ORDER BY day DESC',(uid,)).fetchall()
                return self.send(200,dict(items=[dict(day=r['day'],date=r['local_date'],title=json.loads(r['lesson'])['title'],completed=bool(r['completed']),summary=json.loads(r['summary']) if r['summary'] else None) for r in rows]))
            if path=='/api/audio':
                lesson=LESSONS.get(q.get('lesson',[''])[0])
                if not lesson:raise Problem('Không tìm thấy bài.',404)
                if not u['plan'] or lesson['id'] not in {x['lesson_id'] for x in json.loads(u['plan'])['days']}:raise Problem('Bài không thuộc kế hoạch.',403)
                if AI_CLIENT.mode!='openai':raise Problem('Demo dùng giọng đọc trình duyệt.')
                idx=q.get('line',['all'])[0]
                if idx=='all':txt=' '.join(lesson['dialogue'])
                else:
                    try:txt=lesson['dialogue'][int(idx)]
                    except (ValueError,IndexError):raise Problem('Câu không hợp lệ.')
                key=tokenhash(json.dumps([AI_CLIENT.tts,AI_CLIENT.voice,txt]))
                f=DATA/'audio'/(key+'.mp3')
                # Serialize initial creation so simultaneous learners reuse one audio.
                with LOCK:
                    if not f.exists():
                        provider_budget(uid,'shared_audio');audio=AI_CLIENT.speech(txt);tmp=f.with_suffix('.tmp');tmp.write_bytes(audio);tmp.replace(f)
                        usage(uid,'shared_audio',{'characters':len(txt)},AI_CLIENT.tts)
                return self.send(200,f.read_bytes(),'audio/mpeg')
            raise Problem('Không tìm thấy API.',404)
        files={'/':'index.html','/app.js':'app.js','/style.css':'style.css'}
        if path not in files:raise Problem('Không tìm thấy trang.',404)
        ext=Path(files[path]).suffix;mime={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8'}[ext]
        return self.send(200,(ROOT/'web'/files[path]).read_bytes(),mime)
    def post(self):
        p=self.body();path=urlparse(self.path).path
        if path=='/api/demo':
            if AI_CLIENT.mode!='demo':raise Problem('Chức năng demo đã tắt.',404)
            uid=secrets.token_hex(12);token=new_token(uid,86400);csrf=token_csrf(token);salt=secrets.token_hex(16)
            with db() as d:
                d.execute('INSERT INTO users(id,email,name,salt,password) VALUES(?,?,?,?,?)',(uid,uid+'@demo.invalid','Học viên Demo',salt,password(secrets.token_urlsafe(32),salt)))
                d.execute('INSERT INTO auth VALUES(?,?,?,?)',(tokenhash(token),uid,csrf,time.time()+86400))
            return self.send(200,dict(ok=True),cookie=self.cookie(token,86400))
        if path in ('/api/register','/api/login'):
            with LOCK:
                ip=self.client_address[0]
                if TRUST_PROXY and self.headers.get('X-Forwarded-For'):ip=self.headers['X-Forwarded-For'].split(',')[-1].strip()
                now=time.time();THROTTLE[ip]=[t for t in THROTTLE.get(ip,[]) if now-t<60]
                if len(THROTTLE[ip])>=15:raise Problem('Thử lại sau một phút.',429)
                THROTTLE[ip].append(now)
            email=p.get('email','');pw=p.get('password','');name=p.get('name','')
            if not isinstance(email,str) or not isinstance(pw,str) or not (8 if path.endswith('register') else 1)<=len(pw)<=128 or len(email)>200 or '@' not in email:raise Problem('Email hợp lệ và mật khẩu từ 8 đến 128 ký tự.')
            email=email.strip().lower()
            with db() as d:
                if path.endswith('register'):
                    if not isinstance(name,str) or not 1<=len(name.strip())<=80:raise Problem('Vui lòng nhập tên, tối đa 80 ký tự.')
                    salt=secrets.token_hex(16);uid=secrets.token_hex(12)
                    try:d.execute('INSERT INTO users(id,email,name,salt,password) VALUES(?,?,?,?,?)',(uid,email,name.strip(),salt,password(pw,salt)))
                    except sqlite3.IntegrityError:raise Problem('Không thể đăng ký email này. Hãy đăng nhập hoặc dùng email khác.')
                else:
                    row=d.execute('SELECT * FROM users WHERE email=?',(email,)).fetchone()
                    # Run a comparable KDF even when email is unknown.
                    check=password(pw,row['salt'] if row else '00'*16)
                    if not row or not hmac.compare_digest(check,row['password']):raise Problem('Email hoặc mật khẩu chưa đúng.',401)
                    uid=row['id']
                token=new_token(uid,604800);csrf=token_csrf(token)
                d.execute('INSERT INTO auth VALUES(?,?,?,?)',(tokenhash(token),uid,csrf,time.time()+604800))
            return self.send(200,dict(ok=True),cookie=self.cookie(token))
        u=self.session();uid=u['id']
        if not hmac.compare_digest(self.headers.get('X-CSRF-Token',''),u['csrf']):raise Problem('Phiên không hợp lệ. Hãy tải lại trang.',403)
        if path=='/api/logout':
            with db() as d:d.execute('DELETE FROM auth WHERE token=?',(u['token'],))
            return self.send(200,dict(ok=True),cookie=self.cookie('',0))
        if path=='/api/onboard':
            if u['plan']:raise Problem('Đã có lộ trình. MVP giữ lộ trình hiện tại để bảo toàn tiến độ.',409)
            profile=profile_validate(p)
            provider_budget(uid,'plan')
            plan,used,source=AI_CLIENT.plan(profile)
            with LOCK,db() as d:
                if d.execute('SELECT plan FROM users WHERE id=?',(uid,)).fetchone()['plan']:raise Problem('Lộ trình đã được tạo.',409)
                d.execute('UPDATE users SET profile=?,plan=?,plan_source=? WHERE id=?',(json.dumps(profile),json.dumps(plan),source,uid))
            usage(uid,'plan',used)
            return self.send(200,dict(ok=True))
        if path=='/api/settings':
            profile=json.loads(u['profile'] or '{}')
            if not profile:raise Problem('Chưa có hồ sơ.')
            slot=p.get('study_time','')
            try:datetime.strptime(slot,'%H:%M')
            except (ValueError,TypeError):raise Problem('Giờ học chưa hợp lệ.')
            if len(slot)!=5:raise Problem('Giờ học dùng HH:MM.')
            profile.update(study_time=slot,reminders=p.get('reminders') is True)
            with db() as d:d.execute('UPDATE users SET profile=? WHERE id=?',(json.dumps(profile),uid))
            return self.send(200,dict(ok=True))
        if path=='/api/checkpoint':
            a=owned_attempt(uid,p.get('attempt_id',''));stage=p.get('stage')
            if stage not in ('words','shadow'):raise Problem('Bước học không hợp lệ.')
            with db() as d:d.execute('UPDATE attempts SET '+('words_done' if stage=='words' else 'shadow_done')+'=1 WHERE id=?',(a['id'],))
            return self.send(200,dict(ok=True))
        if path=='/api/practice/start':
            a=owned_attempt(uid,p.get('attempt_id',''))
            if a['completed']:raise Problem('Buổi học đã hoàn thành.',409)
            with LOCK,db() as d:
                s=d.execute('SELECT * FROM practice WHERE attempt_id=?',(a['id'],)).fetchone()
                if not s:
                    # One quota allocation per learner per calendar day, even on stale attempts.
                    day_start=datetime.now(TZ).replace(hour=0,minute=0,second=0,microsecond=0).timestamp()
                    if d.execute('SELECT 1 FROM practice WHERE user_id=? AND started>=?',(uid,day_start)).fetchone():raise Problem('Hôm nay đã cấp phiên 5 phút.',409)
                    now=time.time();sid=tokenhash('p:'+a['id'])[:24];lesson=json.loads(a['lesson'])
                    midnight=(datetime.now(TZ)+timedelta(days=1)).replace(hour=0,minute=0,second=0,microsecond=0).timestamp()
                    first=[dict(role='assistant',text=lesson['dialogue'][0])]
                    d.execute('INSERT INTO practice(id,attempt_id,user_id,started,deadline,turns) VALUES(?,?,?,?,?,?)',(sid,a['id'],uid,now,min(now+300,midnight),json.dumps(first)))
                    s=d.execute('SELECT * FROM practice WHERE id=?',(sid,)).fetchone()
            result=dict(s);result['turns']=json.loads(result['turns']);result['server_time']=time.time()
            return self.send(200,result)
        if path=='/api/transcribe':
            sid=self.headers.get('X-Practice-Id','');mime=self.headers.get('Content-Type','').split(';')[0]
            if mime not in ('audio/webm','audio/mp4','audio/wav','audio/ogg'):raise Problem('Định dạng ghi âm chưa hỗ trợ.')
            if len(p)<100:raise Problem('Bản ghi quá ngắn.')
            with reserve(uid,sid):
                provider_budget(uid,'transcribe')
                txt=AI_CLIENT.transcribe(p,mime)
                usage(uid,'transcribe',{'bytes':len(p)},AI_CLIENT.stt)
            return self.send(200,dict(text=txt))
        if path=='/api/practice/turn':
            txt=p.get('text','')
            if not isinstance(txt,str) or not 1<=len(txt.strip())<=1000:raise Problem('Câu trả lời từ 1 đến 1.000 ký tự.')
            with reserve(uid,p.get('session_id','')) as s:
                turns=json.loads(s['turns'])
                if len(turns)>=41:raise Problem('Đã đạt giới hạn 20 lượt cho phiên này.',409)
                turns.append(dict(role='user',text=txt.strip(),input_mode='voice' if p.get('input_mode')=='voice' else 'text'))
                lesson=json.loads(owned_attempt(uid,s['attempt_id'])['lesson'])
                provider_budget(uid,'conversation')
                reply,used=AI_CLIENT.reply(json.loads(u['profile']),lesson,turns)
                turns.append(dict(role='assistant',text=reply))
                with db() as d:d.execute('UPDATE practice SET turns=? WHERE id=?',(json.dumps(turns),s['id']))
                usage(uid,'conversation',used)
            return self.send(200,dict(turns=turns,server_time=time.time()))
        if path=='/api/reply-audio':
            sid=p.get('session_id','')
            with reserve(uid,sid) as s:
                last=json.loads(s['turns'])[-1]
                if last['role']!='assistant':raise Problem('Chưa có câu trả lời.')
                txt=last['text'];key=tokenhash(json.dumps([sid,len(json.loads(s['turns'])),AI_CLIENT.tts,AI_CLIENT.voice]))
                f=DATA/'audio'/(key+'.mp3')
                if not f.exists():
                    provider_budget(uid,'reply_audio');f.write_bytes(AI_CLIENT.speech(txt));usage(uid,'reply_audio',{'characters':len(txt)},AI_CLIENT.tts)
            return self.send(200,f.read_bytes(),'audio/mpeg')
        if path=='/api/complete':
            with LOCK:
                a=owned_attempt(uid,p.get('attempt_id',''))
                if a['summary']:return self.send(200,json.loads(a['summary']))
                if not (a['words_done'] and a['shadow_done']):raise Problem('Hãy hoàn thành phần từ vựng và shadowing trước.')
                with db() as d:s=d.execute('SELECT * FROM practice WHERE attempt_id=?',(a['id'],)).fetchone()
                if not s:raise Problem('Hãy bắt đầu phần thực hành trước.')
                if s['busy']:raise Problem('Đang xử lý lượt nói. Hãy thử lại sau.',409)
                with db() as d:d.execute('UPDATE practice SET busy=1,ended=1 WHERE id=?',(s['id'],))
            try:
                turns=json.loads(s['turns']);provider_budget(uid,'summary');summary,used=AI_CLIENT.summary(json.loads(u['profile']),json.loads(a['lesson']),turns)
                summary.update(mode=AI_CLIENT.mode,turn_count=sum(t['role']=='user' for t in turns),voice_turns=sum(t.get('input_mode')=='voice' for t in turns),pronunciation_note='Không chấm phát âm từ transcript. Số lượt nhập chữ không phải số lượt nói.')
                with db() as d:d.execute('UPDATE attempts SET completed=1,summary=?,local_date=? WHERE id=?',(json.dumps(summary),today(),a['id']))
                usage(uid,'summary',used)
            finally:
                with db() as d:d.execute('UPDATE practice SET busy=0 WHERE id=?',(s['id'],))
            return self.send(200,summary)
        raise Problem('Không tìm thấy API.',404)

if __name__=='__main__':
    init(recover=True);host=os.getenv('HOST','127.0.0.1')
    print(f'WeWIN: {ORIGIN} | mode={AI_CLIENT.mode} | data={DATA}')
    # Windows resolves "localhost" to ::1 first; without an IPv6 listener every request waits ~2s before falling back.
    if host=='127.0.0.1':
        import socket
        class V6Server(ThreadingHTTPServer):address_family=socket.AF_INET6
        try:threading.Thread(target=V6Server(('::1',PORT),Handler).serve_forever,daemon=True).start()
        except OSError:pass
    ThreadingHTTPServer((host,PORT),Handler).serve_forever()
