'use strict';
const $=s=>document.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const icons={home:'◈',plan:'▦',history:'◷',settings:'⚙'};
const S={config:null,user:null,csrf:'',profile:null,plan:null,attempt:null,history:[],page:'home',step:0,auth:'login',busy:false,offset:0,session:null};
let currentAudio=null,recording=null,localURL=null,recordStop=null,voiceDraft=false,clock=null,lastView='',recognizer=null;
const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
const vnDate=d=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh'}).format(d);
const vnWeekday=d=>({Sun:'CN',Mon:'T2',Tue:'T3',Wed:'T4',Thu:'T5',Fri:'T6',Sat:'T7'})[new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Ho_Chi_Minh',weekday:'short'}).format(d)];
const fmtDate=s=>s.split('-').reverse().join('/');
const doneDates=()=>new Set(S.history.filter(h=>h.completed).map(h=>h.date));
function streak(){const done=doneDates();let d=new Date(),n=0;if(!done.has(vnDate(d)))d=new Date(d-864e5);while(done.has(vnDate(d))){n++;d=new Date(d-864e5)}return n}
function week(){const done=doneDates();return [...Array(7)].map((_,i)=>{const d=new Date(Date.now()-(6-i)*864e5);return {label:vnWeekday(d),done:done.has(vnDate(d)),today:i===6}})}
const totalTurns=()=>S.history.reduce((n,h)=>n+(h.summary?.turn_count||0),0);
const initials=n=>n.trim().split(/\s+/).slice(-2).map(w=>w[0]).join('').toUpperCase();
const callName=n=>{const w=n.trim().split(/\s+/);return w.slice(w.length>2?-2:-1).join(' ')};
const canVoice=()=>S.config.mode!=='demo'||Boolean(SR);
async function api(path,body,extra={}){
 const options={credentials:'same-origin',...extra};
 if(body!==undefined){options.method='POST';options.headers={'Content-Type':'application/json','X-CSRF-Token':S.csrf,...extra.headers};options.body=body instanceof Blob?body:JSON.stringify(body)}
 const r=await fetch(path,options);
 if(!r.ok){let e;try{e=await r.json()}catch{e={error:'Không kết nối được máy chủ.'}}if(r.status===401){S.user=null;stopMedia();render()}throw Error(e.error||'Yêu cầu thất bại.')}
 return r.headers.get('content-type').includes('application/json')?r.json():r.blob();
}
function toast(t){$('#toast').textContent=t;$('#toast').classList.add('show');setTimeout(()=>$('#toast').classList.remove('show'),5000)}
function errorAt(id,e){const target=$(id);if(target)target.textContent=e.message;else toast(e.message)}
function stopSound(){if(currentAudio){currentAudio.pause();currentAudio=null}if('speechSynthesis' in window)speechSynthesis.cancel()}
function stopMedia(){stopSound();if(recognizer){recognizer.abort();recognizer=null}if(recording?.state==='recording'){recordStop?.();recordStop=null;recording.stop()}if(localURL){URL.revokeObjectURL(localURL);localURL=null}}
function remaining(){if(S.session?.ended)return 0;return S.session?Math.max(0,Math.ceil(S.session.deadline-(Date.now()/1000+S.offset))):300}
function setSession(ss,serverTime){S.session=ss;S.offset=(serverTime||Date.now()/1000)-Date.now()/1000}
async function refresh(){
 const me=await api('/api/me');Object.assign(S,me);
 if(S.user&&S.plan){const [a,h]=await Promise.all([api('/api/today'),api('/api/history')]);S.attempt=a;S.history=h.items;setSession(a.session,a.server_time)}
 render();
}
function bind(){
 $('#app').addEventListener('click',async e=>{
  const b=e.target.closest('[data-action]');if(!b||b.disabled)return;const action=b.dataset.action;
  try{
   if(action==='demo'){b.disabled=true;await api('/api/demo',{});await refresh();return}
   if(action==='auth-switch'){S.auth=S.auth==='register'?'login':'register';render();return}
   if(action==='logout'){await api('/api/logout',{});Object.assign(S,{user:null,profile:null,plan:null,session:null,attempt:null});stopMedia();render();return}
   if(action==='page'){stopMedia();S.page=b.dataset.page;render();return}
   if(action==='lesson'){S.page='lesson';S.step=S.attempt.completed?3:0;render();return}
   if(action==='step'){stopMedia();S.step=Number(b.dataset.step);render();return}
   if(action==='next'){
    b.disabled=true;await api('/api/checkpoint',{attempt_id:S.attempt.id,stage:S.step===0?'words':'shadow'});
    S.attempt[S.step===0?'words_done':'shadow_done']=1;stopMedia();S.step++;render();return;
   }
   if(action==='play'){await playShadow(b.dataset.line);return}
   if(action==='shadow-record'){await toggleRecord('shadow');return}
   if(action==='practice-start'){
    b.disabled=true;const ss=await api('/api/practice/start',{attempt_id:S.attempt.id});setSession(ss,ss.server_time);render();return;
   }
   if(action==='voice-record'){await toggleRecord('voice');return}
   if(action==='listen-ai'){await playReply();return}
   if(action==='finish'){
    b.disabled=true;stopMedia();b.textContent='Đang tổng kết…';
    const sum=await api('/api/complete',{attempt_id:S.attempt.id});S.attempt.summary=sum;S.attempt.completed=1;S.session.ended=1;S.step=3;await refresh();return;
   }
   if(action==='back-home'){stopMedia();S.page='home';await refresh();return}
  }catch(err){b.disabled=false;toast(err.message)}
 });
 $('#app').addEventListener('submit',async e=>{
  e.preventDefault();const f=e.target;const b=f.querySelector('button[type=submit]');b.disabled=true;
  try{
   if(f.id==='auth-form'){
    const fd=new FormData(f);await api('/api/'+S.auth,Object.fromEntries(fd));await refresh();
   }
   if(f.id==='onboard-form'){
    const fd=new FormData(f);b.textContent='Đang tạo kế hoạch 30 ngày…';
    await api('/api/onboard',{...Object.fromEntries(fd),answers:S.config.questions.map(q=>Number(fd.get('q'+q.id))),reminders:fd.get('reminders')==='on'});await refresh();
   }
   if(f.id==='chat-form'){
    const text=f.querySelector('input').value.trim();if(!text)throw Error('Hãy nhập hoặc ghi âm một câu.');
    if(remaining()<=0||S.session.ended)throw Error('Phiên đã kết thúc. Hãy xem tổng kết.');
    const r=await api('/api/practice/turn',{session_id:S.session.id,text,input_mode:voiceDraft?'voice':'text'});
    S.session.turns=r.turns;S.offset=r.server_time-Date.now()/1000;voiceDraft=false;render();
   }
   if(f.id==='settings-form'){
    const fd=new FormData(f);await api('/api/settings',{study_time:fd.get('study_time'),reminders:fd.get('reminders')==='on'});await refresh();toast('Đã lưu giờ học.');
   }
  }catch(err){errorAt(f.id==='auth-form'?'#auth-error':f.id==='onboard-form'?'#form-error':f.id==='chat-form'?'#chat-error':'#settings-error',err);b.disabled=false;b.textContent=f.id==='onboard-form'?'Tạo kế hoạch của tôi →':f.id==='auth-form'?(S.auth==='register'?'Tạo tài khoản':'Đăng nhập'):f.id==='chat-form'?'Gửi câu trả lời':'Lưu thay đổi'}
 });
 $('#app').addEventListener('input',e=>{if(e.target.id==='chat-text')voiceDraft=false});
}
function shell(content){
 return `<div class="shell"><aside class="sidebar"><div class="brand">We<span>WIN</span><span aria-hidden="true">.</span></div><div class="brand-sub">DAILY SPEAKING</div><nav class="nav" aria-label="Điều hướng">${[['home','Hôm nay'],['plan','Lộ trình của tôi'],['history','Nhật ký học tập'],['settings','Giờ học & tài khoản']].map(([p,t])=>`<button data-action="page" data-page="${p}" class="${S.page===p||S.page==='lesson'&&p==='home'?'active':''}"><span class="nav-icon">${icons[p]}</span>${t}</button>`).join('')}</nav><div class="side-foot"><b>Đạo Đức · Trí Tuệ · Bản Lĩnh</b>Một chút mỗi ngày.<br>Tự tin hơn mỗi lần nói.<p class="gap">WeWIN Education</p></div></aside><main class="main"><header class="topbar"><div class="crumb">Không gian học tập / ${esc(({home:'Hôm nay',plan:'Lộ trình',history:'Nhật ký',settings:'Cài đặt',lesson:'Buổi học'})[S.page]||'Khảo sát')}</div><div class="user">${S.plan?`<span class="badge gold streak">● Chuỗi ${streak()} ngày</span>`:''}<span class="avatar">${esc(initials(S.user.name))}</span><div class="user-name">${esc(S.user.name)}<small>Học viên WeWIN</small></div><button class="btn text" data-action="logout">Thoát</button></div></header>${content}</main></div>`;
}
function auth(){
 const reg=S.auth==='register';return `<div class="auth"><section class="auth-story"><div class="brand">We<span>WIN</span>.</div><div class="eyebrow gap">DAILY SPEAKING</div><h1>15 phút mỗi ngày.<br>Mở lời tự tin hơn.</h1><p>Học từ và mẫu câu. Nghe, nói theo. Thực hành tình huống cùng AI và nhận phản hồi sau mỗi buổi.</p><div class="auth-circles" aria-hidden="true"><span>Aa</span><span>♪</span><span>↔</span><span>✓</span></div><small>Đạo Đức · Trí Tuệ · Bản Lĩnh</small></section><section class="auth-form"><span class="badge">WEWIN DAILY SPEAKING</span><h2 class="gap">${reg?'Bắt đầu hành trình của bạn':'Chào mừng bạn trở lại'}</h2><p>${reg?'Tạo tài khoản, chọn mục tiêu và thiết kế nhịp học của riêng bạn.':'Đăng nhập để tiếp tục buổi học.'}</p><form id="auth-form">${reg?'<div class="field"><label for="name">Tên học viên</label><input id="name" name="name" autocomplete="name" required maxlength="80" placeholder="Bạn muốn được gọi là gì?"></div>':''}<div class="field"><label for="email">Email</label><input id="email" type="email" name="email" autocomplete="email" required maxlength="200" placeholder="you@example.com"></div><div class="field"><label for="password">Mật khẩu</label><input id="password" type="password" name="password" autocomplete="${reg?'new-password':'current-password'}" required ${reg?'minlength="8"':''} maxlength="128" placeholder="${reg?'Ít nhất 8 ký tự':'Mật khẩu của bạn'}"></div><button type="submit" class="btn full">${reg?'Tạo tài khoản':'Đăng nhập'} →</button><div id="auth-error" class="error" role="alert"></div></form><div class="switch">${reg?'Đã có tài khoản?':'Bạn chưa có tài khoản?'} <button data-action="auth-switch">${reg?'Đăng nhập':'Đăng ký'}</button></div><p class="legal gap">Bằng việc tiếp tục, bạn đồng ý với Điều khoản sử dụng và Chính sách bảo mật của WeWIN Education.</p></section></div>`;
}
function onboard(){
 return `<section class="page-width"><div class="onboard-hero"><div class="eyebrow">BƯỚC ĐẦU TIÊN · KHOẢNG 5–8 PHÚT</div><h1>Hiểu bạn trước khi bắt đầu.</h1><p>Chọn lĩnh vực, mục tiêu và giờ học. Bài kiểm tra ngắn giúp chọn mức hỗ trợ ban đầu.</p></div><form id="onboard-form" class="card"><h2>01. Nhu cầu của bạn</h2><div class="two"><div class="field"><label for="domain">Bạn muốn học để làm gì?</label><select id="domain" name="domain">${Object.entries(S.config.domains).map(([id,n])=>`<option value="${id}">${esc(n)}</option>`).join('')}</select></div><div class="field"><label for="role">Nghề nghiệp / vai trò</label><input id="role" name="role" required maxlength="150" placeholder="Ví dụ: nhân viên kinh doanh"></div></div><div class="field"><label for="goal">Sau 30 ngày, bạn muốn nói được điều gì?</label><textarea id="goal" name="goal" required maxlength="500" placeholder="Ví dụ: giới thiệu dịch vụ và đặt lịch với khách hàng."></textarea></div><div class="field"><label for="difficulty">Khó khăn hiện tại</label><input id="difficulty" name="difficulty" maxlength="300" placeholder="Thiếu từ, ngại nói, chưa biết ghép câu…"></div><h2 class="gap">02. Một cuộc hẹn với chính mình</h2><div class="field"><label for="study_time">Giờ học hằng ngày (giờ Việt Nam)</label><input id="study_time" type="time" name="study_time" value="20:30" required></div><label class="check"><input type="checkbox" name="reminders" checked>Nhắc tôi trước giờ học mỗi ngày.</label><div class="quiz"><h2>03. Kiểm tra nền tảng</h2><p class="note">8 câu ngắn giúp WeWIN chọn mức độ phù hợp để bạn bắt đầu. Hãy chọn câu trả lời bạn thấy đúng nhất.</p>${S.config.questions.map((q,i)=>`<div class="question"><fieldset><legend>${i+1}. ${esc(q.text)}</legend><div class="options">${q.options.map((o,j)=>`<label><input type="radio" name="q${q.id}" value="${j}" required>${String.fromCharCode(65+j)}. ${esc(o)}</label>`).join('')}</div></fieldset></div>`).join('')}</div><label class="check"><input type="checkbox" required>Tôi đồng ý để WeWIN lưu hồ sơ và kết quả học tập nhằm cá nhân hóa lộ trình của tôi.</label><button type="submit" class="btn gap">Tạo kế hoạch của tôi →</button><div id="form-error" class="error" role="alert"></div></form></section>`;
}
function home(){
 const a=S.attempt,l=a.lesson,done=S.history.filter(h=>h.completed).length;
 return `<section><div class="greeting"><div><div class="eyebrow">MỖI NGÀY MỘT BƯỚC TIẾN</div><h1>Chào ${esc(callName(S.user.name))}, cùng học nhé.</h1><p>Không cần nói hoàn hảo. Hôm nay, hãy bắt đầu bằng một câu.</p></div><span class="badge gold">◷ ${esc(S.profile.study_time)} · giờ Việt Nam</span></div><div class="grid"><div><article class="card hero"><div class="hero-top"><span class="badge">BUỔI ${a.day.toString().padStart(2,'0')} / 30</span><small>15 phút học tập</small></div><h2>${esc(l.title)}</h2><p>${esc(l.goal)}</p><div class="hero-footer"><button class="btn gold" data-action="lesson">${a.completed?'Xem lại kết quả':a.words_done||S.session?'Tiếp tục buổi học':'Bắt đầu buổi học'} <span>↗</span></button><small>${esc(S.config.domains[S.profile.domain])}</small></div><div class="hero-art" aria-hidden="true"></div></article><div class="stats"><div class="stat"><strong>${done}<small> / 30</small></strong><span>Buổi đã hoàn thành</span></div><div class="stat"><strong>${streak()}<small> ngày</small></strong><span>Chuỗi học liên tiếp</span></div><div class="stat"><strong>${totalTurns()}<small> lượt</small></strong><span>Đã luyện nói cùng AI</span></div></div><article class="card"><div class="section-head"><h3>15 phút hôm nay gồm những gì?</h3><span class="badge">4 BƯỚC</span></div><div class="flow">${[['01','Từ vựng & cấu trúc','Hiểu từ, học câu để dùng ngay.','3 phút'],['02','Nghe & shadowing','Nghe từng câu, nói theo, nghe lại mình.','5 phút'],['03','Hội thoại theo tình huống','Thực hành một nhiệm vụ cùng AI.','5 phút'],['04','Tổng kết & đánh giá','Nhìn lại điều làm được và điều cần ôn.','2 phút']].map(([n,t,d,m])=>`<div class="flow-item"><div class="flow-number">${n}</div><div><b>${t}</b><p>${d}</p></div><span class="flow-min">${m}</span></div>`).join('')}</div></article></div><aside class="stack"><article class="card"><div class="eyebrow">MỤC TIÊU CỦA BẠN</div><p class="goal">${esc(S.profile.goal)}</p><span class="badge">${esc(S.profile.role)}</span><p class="legal gap">${esc(S.plan.goal)}</p><progress value="${done}" max="30" aria-label="Số buổi hoàn thành"></progress><small>${done} buổi trên hành trình 30 buổi</small></article><article class="card"><div class="eyebrow">LỜI NHẮC NHỎ</div><h3>Nghe. Nói theo.<br>Rồi nói theo cách của bạn.</h3><p>Mỗi ngày một tình huống thực tế. AI Coach giúp bạn ứng dụng mẫu câu vào chính công việc của mình.</p></article><article class="card"><div class="section-head"><div class="eyebrow">7 NGÀY GẦN NHẤT</div><small>${week().filter(d=>d.done).length}/7 buổi</small></div><div class="week">${week().map(d=>`<div class="week-day ${d.done?'done':''} ${d.today?'today':''}"><span class="dot">${d.done?'✓':''}</span><small>${d.label}</small></div>`).join('')}</div></article></aside></div></section>`;
}
function plan(){return `<div class="greeting"><div><div class="eyebrow">THEO MỤC TIÊU CỦA BẠN</div><h1>Lộ trình 30 buổi.</h1><p class="plan-goal">${esc(S.plan.goal)}</p></div><span class="badge">LỘ TRÌNH CÁ NHÂN HÓA</span></div><p class="note">Mỗi ngày mở khóa một buổi mới sau khi bạn hoàn thành buổi trước. Các buổi ôn tập được sắp xếp xen kẽ để bạn ghi nhớ lâu và phản xạ nhanh hơn.</p><div class="days">${S.plan.days.map(d=>{const h=S.history.find(x=>x.day===d.day),meta=S.config.catalog.find(x=>x.id===d.lesson_id);return `<article class="day ${h?.completed?'done':''} ${d.day===S.attempt.day?'current':''}"><span class="day-num">BUỔI ${d.day} ${h?.completed?'✓':''}</span><b>${esc(meta?.title||d.lesson_id)}</b><small>${esc(d.focus)}</small></article>`}).join('')}</div>`}
function history(){return `<div class="eyebrow">NHÌN LẠI ĐỂ TIẾN BỘ</div><h1>Nhật ký học tập.</h1><div class="card">${S.history.length?S.history.map(h=>`<article class="history-item"><span class="badge ${h.completed?'':'gold'}">BUỔI ${h.day} · ${h.completed?'ĐÃ HOÀN THÀNH':'ĐANG HỌC'}</span><h3>${esc(h.title)}</h3><small>${esc(fmtDate(h.date))}</small>${h.summary?`<p class="gap">${esc(h.summary.overview)}</p><p><b>Lần tới:</b> ${esc(h.summary.next_step)}</p><small>${h.summary.turn_count} lượt phản hồi · ${h.summary.voice_turns} lượt nói · ${h.summary.goal_status==='achieved'?'Đạt mục tiêu':'Cần ôn thêm'}</small>`:''}</article>`).join(''):'<div class="empty">Chưa có buổi học. Bắt đầu từ trang Hôm nay nhé.</div>'}</div>`}
function settings(){return `<div class="page-width"><div class="eyebrow">DUY TRÌ MỘT NHỊP HỌC PHÙ HỢP</div><h1>Giờ học & tài khoản.</h1><form class="card" id="settings-form"><h3>${esc(S.user.name)}</h3><p>${esc(S.user.email)}</p><div class="field"><label for="new-time">Giờ học mỗi ngày</label><input type="time" id="new-time" name="study_time" required value="${esc(S.profile.study_time)}"></div><label class="check"><input type="checkbox" name="reminders" ${S.profile.reminders?'checked':''}>Nhắc tôi trước giờ học mỗi ngày.</label><p class="note gap">Múi giờ: Giờ Việt Nam (GMT+7).</p><button type="submit" class="btn">Lưu thay đổi</button><div id="settings-error" class="error" role="alert"></div></form></div>`}
function lesson(){
 const a=S.attempt,l=a.lesson;const remainingText=`${Math.floor(remaining()/60)}:${String(remaining()%60).padStart(2,'0')}`;
 return `<section><div class="lesson-header"><div><div class="eyebrow">BUỔI ${a.day} · ${esc(S.config.domains[S.profile.domain])}</div><h1>${esc(l.title)}</h1><p>${esc(l.goal)}</p></div><div class="timer"><strong id="timer">${S.session?.ended?'Đã xong':remainingText}</strong><small>PHIÊN HỘI THOẠI<br>TỐI ĐA 5 PHÚT</small></div></div><div class="steps" role="navigation" aria-label="Các phần bài học">${['Từ & mẫu câu','Shadowing','Hội thoại AI','Tổng kết'].map((t,i)=>`<button class="${S.step===i?'active':''} ${i===0&&a.words_done||i===1&&a.shadow_done||i===3&&a.completed?'done':''}" data-action="step" data-step="${i}">${i+1}. ${t}</button>`).join('')}</div><div class="card">${[words,shadow,practice,summary][S.step]()}</div></section>`;
}
function words(){const l=S.attempt.lesson;return `<div class="section-head"><h2>Những từ bạn sẽ dùng hôm nay</h2><span class="badge">3 PHÚT</span></div><div class="word-grid">${l.vocabulary.map(v=>`<article class="word"><h3>${esc(v.word)}</h3><p>${esc(v.meaning)}</p></article>`).join('')}</div><div class="pattern"><span class="eyebrow">CẤU TRÚC TRỌNG TÂM</span><b>${esc(l.frame)}</b><p>Thay phần “…” bằng thông tin của bạn. Đọc thành tiếng một câu trước khi chuyển bước.</p></div><p class="note">Ví dụ trong bài: “${esc(l.dialogue[1])}”</p><button class="btn" data-action="next">Tôi đã luyện từ và mẫu câu →</button>`}
function shadow(){const l=S.attempt.lesson;return `<div class="section-head"><h2>Nghe. Nói theo. Nghe lại.</h2><span class="badge">5 PHÚT</span></div><p>Nghe một lượt, luyện từng câu, rồi thử nói liền mạch. Chữ A/B thể hiện hai vai trong hội thoại.</p><div class="controls"><button class="btn" data-action="play" data-line="all">▶ Nghe cả đoạn</button><label for="speed" class="label">Tốc độ</label><select id="speed"><option value="0.8">Chậm · 0.8×</option><option value="1" selected>Bình thường · 1×</option></select><small>Giọng đọc tiếng Anh chuẩn</small></div><div class="dialogue">${l.dialogue.map((t,i)=>`<div class="line"><span class="speaker">${i%2?'B':'A'}</span><p>${esc(t)}</p><button class="btn secondary" aria-label="Nghe câu ${i+1}" data-action="play" data-line="${i}">▶</button></div>`).join('')}</div><div class="recorder"><div class="row between"><div><b>Nghe lại giọng của mình</b><p class="legal">Ghi âm giọng của bạn và so sánh với câu mẫu.</p></div><button class="btn outline" data-action="shadow-record" id="shadow-record">● Ghi âm thử</button></div><div id="local-recording"></div><div id="record-status" role="status" class="legal"></div></div><button class="btn" data-action="next">Tôi đã nghe và luyện shadowing →</button>`}
function practice(){
 const l=S.attempt.lesson,s=S.session,expired=s&&(remaining()<=0||s.ended);const turns=s?.turns||[];
 return `<div class="section-head"><h2>Đến lượt bạn mở lời.</h2><span class="badge gold">TỐI ĐA 5 PHÚT</span></div><p>AI đóng vai <b>${esc(l.role)}</b>. Mục tiêu: ${esc(l.goal)}</p><div class="note">Trả lời bằng tiếng Anh: bấm Ghi âm để nói hoặc nhập câu trả lời. AI Coach sẽ phản hồi và gợi ý ngay trong hội thoại.</div>${!s?`<div class="empty"><h3>Sẵn sàng cho tình huống hôm nay?</h3><p>Chuẩn bị micro hoặc bàn phím trước khi bắt đầu.</p><button class="btn" data-action="practice-start">Bắt đầu phiên 5 phút →</button></div>`:`<div class="chat" id="chat" aria-live="polite">${turns.map(t=>`<div class="bubble ${t.role==='user'?'user':''}"><small>${t.role==='user'?'BẠN'+(t.input_mode==='voice'?' · GIỌNG NÓI':''):'AI COACH'}</small>${esc(t.text)}</div>`).join('')}</div><div class="controls"><button class="btn secondary" data-action="listen-ai" ${expired?'disabled':''}>▶ Nghe câu AI</button></div><form id="chat-form" class="gap"><div class="chat-input"><input id="chat-text" name="text" aria-label="Câu trả lời của bạn" placeholder="Nói hoặc nhập câu trả lời bằng tiếng Anh…" maxlength="1000" required ${expired?'disabled':''}>${canVoice()?`<button class="btn outline" type="button" id="voice-record" data-action="voice-record" ${expired?'disabled':''}>● Ghi âm</button>`:''}<button type="submit" class="btn" ${expired?'disabled':''}>Gửi câu trả lời</button></div><div id="voice-status" class="legal" role="status"></div><div id="chat-error" class="error" role="alert"></div></form><div id="expired-note" class="note gap" ${expired?'':'hidden'}>Phiên hội thoại đã kết thúc. Bấm “Kết thúc & xem tổng kết” để nhận phản hồi.</div><div class="finish"><button class="btn" data-action="finish">Kết thúc & xem tổng kết →</button><p class="legal gap">Hoàn thành phần từ vựng và shadowing trước khi xem tổng kết.</p></div>`}`;
}
function summary(){const r=S.attempt.summary;return !r?`<div class="empty"><h2>Hoàn thành buổi học để xem tổng kết.</h2><p>Học từ, luyện shadowing rồi bắt đầu hội thoại.</p><button class="btn" data-action="step" data-step="0">Quay lại bài học</button></div>`:`<span class="badge">BUỔI HỌC ĐÃ ĐƯỢC LƯU</span><h2 class="gap">Mỗi lần thực hành là một bước tiến.</h2><p>${esc(r.overview)}</p><div class="stats"><div class="stat"><strong>${r.turn_count}</strong><span>Lượt phản hồi</span></div><div class="stat"><strong>${r.voice_turns}</strong><span>Lượt nói bằng giọng</span></div><div class="stat"><strong>${r.goal_status==='achieved'?'Đạt':'Ôn thêm'}</strong><span>${r.goal_status==='insufficient_evidence'?'Cần thêm lượt nói':'Mục tiêu tình huống'}</span></div></div><div class="rubric"><div><h3>Điều bạn làm được</h3><ul>${r.strengths.map(t=>`<li>${esc(t)}</li>`).join('')||'<li>Hãy thực hành thêm để nhận nhận xét chi tiết.</li>'}</ul></div><div><h3>Điều cần luyện tiếp</h3><ul>${r.improvements.map(t=>`<li>${esc(t)}</li>`).join('')}</ul></div></div>${r.evidence.map(t=>`<blockquote class="evidence">“${esc(t)}”</blockquote>`).join('')}<div class="pattern"><span class="eyebrow">BƯỚC NHỎ TIẾP THEO</span><p class="goal">${esc(r.next_step)}</p></div><button class="btn" data-action="back-home">Về trang Hôm nay →</button>`}
function render(){
 clearInterval(clock);$('#app').innerHTML=!S.user?auth():shell(!S.plan?onboard():S.page==='home'?home():S.page==='plan'?plan():S.page==='history'?history():S.page==='settings'?settings():lesson());
 const viewKey=[S.user?.id,S.page,S.step,Boolean(S.plan)].join(':');if(viewKey!==lastView){window.scrollTo(0,0);lastView=viewKey}
 if($('#chat'))$('#chat').scrollTop=$('#chat').scrollHeight;
 if(S.page==='lesson'&&S.session&&!S.session.ended)clock=setInterval(()=>{
  const t=remaining();if($('#timer'))$('#timer').textContent=`${Math.floor(t/60)}:${String(t%60).padStart(2,'0')}`;
  if(!t){clearInterval(clock);stopMedia();if($('#expired-note'))$('#expired-note').hidden=false;$('#chat-form')?.querySelectorAll('input,button').forEach(x=>x.disabled=true);const b=$('[data-action="listen-ai"]');if(b)b.disabled=true;}
 },500);
}
async function playShadow(line){
 stopSound();const l=S.attempt.lesson,txt=line==='all'?l.dialogue.join(' '):l.dialogue[Number(line)],rate=Number($('#speed')?.value||1);
 if(S.config.mode==='demo'){speakBrowser(txt,rate);return}
 toast('Đang chuẩn bị audio…');const blob=await api(`/api/audio?lesson=${encodeURIComponent(l.id)}&line=${encodeURIComponent(line)}`);await playBlob(blob,rate);
}
async function playReply(){
 stopSound();if(remaining()<=0)return;
 if(S.config.mode==='demo'){speakBrowser(S.session.turns.filter(t=>t.role==='assistant').slice(-1)[0].text,1);return}
 const blob=await api('/api/reply-audio',{session_id:S.session.id});if(remaining()>0)await playBlob(blob,1);
}
function speakBrowser(txt,rate){
 if(!('speechSynthesis'in window)){toast('Thiết bị chưa hỗ trợ phát âm thanh.');return}
 const utterance=new SpeechSynthesisUtterance(txt);utterance.lang='en-US';utterance.rate=rate;const voice=speechSynthesis.getVoices().find(v=>v.lang.startsWith('en'));if(voice)utterance.voice=voice;speechSynthesis.speak(utterance);
}
async function playBlob(blob,rate){
 const url=URL.createObjectURL(blob);currentAudio=new Audio(url);currentAudio.playbackRate=rate;currentAudio.onended=()=>URL.revokeObjectURL(url);currentAudio.onerror=()=>{URL.revokeObjectURL(url);toast('Không phát được audio trên trình duyệt này.')};await currentAudio.play();
}
async function toggleRecord(kind){
 const btn=$(kind==='shadow'?'#shadow-record':'#voice-record'),status=$(kind==='shadow'?'#record-status':'#voice-status');
 if(kind==='voice'&&S.config.mode==='demo'){browserRecognize(btn,status);return}
 if(recording?.state==='recording'){recording.stop();return}
 if(!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder)throw Error('Ghi âm cần HTTPS hoặc localhost và trình duyệt hỗ trợ micro. Thử mở bằng Safari/Chrome ngoài Zalo.');
 stopSound();const stream=await navigator.mediaDevices.getUserMedia({audio:true});
 const preferred=['audio/webm;codecs=opus','audio/mp4','audio/webm'].find(m=>MediaRecorder.isTypeSupported(m));recording=preferred?new MediaRecorder(stream,{mimeType:preferred}):new MediaRecorder(stream);
 const rec=recording,chunks=[];let bytes=0;btn.textContent='■ Dừng ghi âm';status.textContent='Đang ghi âm · tối đa 45 giây. Chạm Dừng khi nói xong.';
 const stop=()=>stream.getTracks().forEach(t=>t.stop());recordStop=stop;
 const limit=setTimeout(()=>{if(rec.state==='recording')rec.stop()},45000);
 rec.ondataavailable=e=>{if(e.data.size){chunks.push(e.data);bytes+=e.data.size;if(bytes>3_800_000&&rec.state==='recording')rec.stop()}};
 rec.onerror=()=>{clearTimeout(limit);stop();toast('Không ghi âm được. Hãy thử lại.');btn.textContent='● Ghi âm';};
 rec.onstop=async()=>{
  clearTimeout(limit);stop();recordStop=null;btn.textContent=kind==='shadow'?'● Ghi âm thử':'● Ghi âm';
  if(!document.contains(btn))return;
  const blob=new Blob(chunks,{type:rec.mimeType||'audio/webm'});
  if(kind==='shadow'){
   if(localURL)URL.revokeObjectURL(localURL);localURL=URL.createObjectURL(blob);const audio=document.createElement('audio');audio.controls=true;audio.src=localURL;$('#local-recording').replaceChildren(audio);status.textContent='Bản ghi ở trên thiết bị. Nghe lại và so sánh với câu mẫu.';
  }else{
   if(remaining()<=0){status.textContent='Phiên đã hết giờ; bản ghi chưa được gửi.';return}
   btn.disabled=true;status.textContent='Đang nhận dạng. Kiểm tra câu trước khi gửi cho AI.';
   try{const r=await api('/api/transcribe',blob,{headers:{'Content-Type':blob.type.split(';')[0],'X-Practice-Id':S.session.id}});if($('#chat-text')){$('#chat-text').value=r.text;voiceDraft=true;status.textContent='Đã nhận dạng. Kiểm tra hoặc sửa, rồi bấm Gửi câu trả lời.'}}
   catch(e){status.textContent=e.message}finally{if(remaining()>0)btn.disabled=false}
  }
 };rec.start(1000);
}
function browserRecognize(btn,status){
 if(recognizer){recognizer.stop();return}
 if(remaining()<=0)return;
 stopSound();recognizer=new SR();recognizer.lang='en-US';recognizer.interimResults=true;
 btn.textContent='■ Dừng ghi âm';status.textContent='Đang nghe… hãy nói câu trả lời bằng tiếng Anh.';
 recognizer.onresult=e=>{const t=[...e.results].map(r=>r[0].transcript).join(' ').trim();if($('#chat-text')&&t){$('#chat-text').value=t;voiceDraft=true}};
 recognizer.onerror=e=>{status.textContent=e.error==='not-allowed'?'Hãy cho phép truy cập micro rồi thử lại.':'Chưa nghe rõ. Hãy thử lại.'};
 recognizer.onend=()=>{recognizer=null;if(!document.contains(btn))return;btn.textContent='● Ghi âm';if(voiceDraft)status.textContent='Đã nhận dạng. Kiểm tra hoặc sửa, rồi bấm Gửi câu trả lời.'};
 recognizer.start();
}
async function boot(){try{S.config=await api('/api/config');bind();await refresh()}catch(e){$('#app').textContent='Không mở được ứng dụng: '+e.message}}
boot();
