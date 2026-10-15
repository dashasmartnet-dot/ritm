/* Ритм — свой бэкенд (Supabase). Даёт приложению те же интерфейсы db / user / sample / mcp. */
(function(){
'use strict';
var CFG = window.RITM_CONFIG || {};
window.RITM_STANDALONE = true;
var sb = null, session = null, readyResolve, ready = new Promise(function(r){ readyResolve = r; });

function el(tag, attrs, html){ var e=document.createElement(tag); for(var k in attrs||{}) e.setAttribute(k, attrs[k]); if(html!=null) e.innerHTML=html; return e; }
function err(code, msg){ var e=new Error(msg||code); e.code=code; return e; }

/* ---------- экран входа ---------- */
var css = '.lg{position:fixed;inset:0;z-index:9999;background:var(--bg,#F7EFE8);display:flex;align-items:center;justify-content:center;padding:24px}'+
'.lg-box{width:100%;max-width:380px;display:flex;flex-direction:column;gap:14px;text-align:center}'+
'.lg-box img{width:88px;height:88px;border-radius:22px;margin:0 auto 4px;box-shadow:0 10px 30px rgba(140,74,60,.25)}'+
'.lg-box h1{font-family:var(--display,serif);font-size:44px;margin:0;color:var(--ink,#2E2522)}'+
'.lg-box p{margin:0;color:var(--muted,#76665F);font-size:15px;line-height:1.45}'+
'.lg-box input{font:inherit;font-size:17px;padding:14px 16px;border-radius:14px;border:1px solid var(--ctl,#8A7B74);background:#fff;color:var(--ink,#2E2522);text-align:center}'+
'.lg-box button{font:inherit;font-weight:700;font-size:16px;min-height:52px;border-radius:14px;border:0;background:var(--accent,#8C4A3C);color:var(--accent-ink,#fff)}'+
'.lg-box .lnk{background:none;color:var(--accent,#8C4A3C);min-height:44px;font-weight:600}'+
'.lg-box .er{color:#A5541E;font-weight:600;min-height:1.2em}'+
'.lg-soc{display:flex;flex-direction:column;gap:10px}'+
'.lg-pw{position:relative;display:flex}.lg-pw input{flex:1;padding-right:52px}'+
'.lg-box .eye{position:absolute;right:4px;top:50%;transform:translateY(-50%);min-height:44px;width:44px;background:none;color:var(--muted,#76665F);display:flex;align-items:center;justify-content:center}.lg-box .eye.on{color:var(--accent,#8C4A3C)}'+
'.lg-box .soc{display:flex;align-items:center;justify-content:center;gap:10px;background:#fff;color:#1f1f1f;border:1px solid #DADCE0;font-weight:600}'+
'.lg-box .soc.a{background:#000;color:#fff;border-color:#000}'+
'.lg-box .soc.v{background:#0077FF;color:#fff;border-color:#0077FF}'+
'.lg-or{display:flex;align-items:center;gap:10px;color:var(--muted,#76665F);font-size:13px}.lg-or::before,.lg-or::after{content:"";flex:1;height:1px;background:var(--line,#EADBD1)}';

var lg = null, step = 'in', email = '';
var esc = function(v){ return String(v||'').replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); };
var HERE = location.origin + location.pathname;
var SOCIAL = []; /* включённые на сервере способы входа */
var SOC = {
  google: { label: 'Войти через Google', cls: 'g', icon: '<svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.5l6.7-6.7C35.6 2.4 30.2 0 24 0 14.6 0 6.6 5.4 2.7 13.3l7.8 6.1C12.4 13.7 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.4 5.7c4.3-4 6.9-9.9 6.9-17.1z"/><path fill="#FBBC05" d="M10.5 28.6A14.5 14.5 0 0 1 9.5 24c0-1.6.3-3.2.8-4.6l-7.8-6.1A24 24 0 0 0 0 24c0 3.9.9 7.5 2.6 10.7l7.9-6.1z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.4-5.7c-2.1 1.4-4.8 2.3-8.5 2.3-6.3 0-11.6-4.2-13.5-10l-7.9 6.1C6.6 42.6 14.6 48 24 48z"/></svg>' },
  apple: { label: 'Войти через Apple', cls: 'a', icon: '<svg width="16" height="18" viewBox="0 0 384 512" aria-hidden="true"><path fill="currentColor" d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z"/></svg>' },
  vk: { label: 'Войти через VK ID', cls: 'v', icon: '<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12.8 17.3c-5.5 0-8.6-3.8-8.7-10h2.7c.1 4.6 2.1 6.5 3.7 6.9V7.3h2.6v3.9c1.6-.2 3.2-2 3.8-3.9h2.5c-.4 2.4-2.2 4.2-3.4 4.9 1.3.6 3.3 2.1 4.1 5.1h-2.8c-.6-1.9-2.1-3.4-4.2-3.6v3.6h-.3z"/></svg>' }
};
function socialHtml(){
  if(!SOCIAL.length) return '';
  return '<div class="lg-soc">'+SOCIAL.map(function(k){ var c=SOC[k]; return '<button type="button" class="soc '+c.cls+'" data-oauth="'+k+'">'+c.icon+'<span>'+c.label+'</span></button>'; }).join('')+'</div><div class="lg-or"><span>или по почте</span></div>';
}
function field(id, type, ph, ac, val){ return '<label for="'+id+'" class="live">'+ph+'</label><input id="'+id+'" type="'+type+'" placeholder="'+ph+'" autocomplete="'+ac+'" required'+(type==='email'?' inputmode="email"':'')+(type==='password'?' minlength="8"':'')+(val?' value="'+esc(val)+'"':'')+'>'; }
function pfield(id, ph, ac){ return '<div class="lg-pw">'+field(id,'password',ph,ac)+'<button type="button" class="eye" data-eye="'+id+'" aria-label="Показать пароль" aria-pressed="false"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg></button></div>'; }
function showLogin(msg, ok){
  if(!lg){
    document.head.appendChild(el('style', {}, css));
    lg = el('div', {'class':'lg', role:'dialog', 'aria-modal':'true', 'aria-label':'Вход в Ритм'});
    document.body.appendChild(lg);
    lg.addEventListener('submit', onSubmit);
    lg.addEventListener('click', function(e){ var ey=e.target.closest('[data-eye]'); if(ey){ var i=lg.querySelector('#'+ey.getAttribute('data-eye')); var show=i.type==='password'; i.type=show?'text':'password'; ey.setAttribute('aria-pressed',show); ey.setAttribute('aria-label',show?'Скрыть пароль':'Показать пароль'); ey.classList.toggle('on',show); return; }
      var rs=e.target.closest('[data-resend]'); if(rs){ rs.disabled=true; sb.auth.resend({ type:'signup', email: email, options:{ emailRedirectTo: HERE } }).then(function(r){ showLogin(r.error?errText(r.error):'Письмо отправлено ещё раз на '+email+'. Проверь и папку «Спам».', !r.error); }); return; }
      var o=e.target.closest('[data-oauth]'); if(o){ oauth(o.getAttribute('data-oauth'), o); return; } var t=e.target.closest('[data-lg]'); if(t){ step=t.getAttribute('data-lg'); showLogin(); } });
  }
  var body = '<img src="icons/icon-180.png" alt=""><h1>Ритм</h1>', f='';
  if(step==='in'){
    body += '<p>Умный ассистент твоего дня.</p>';
    f = field('lg-email','email','почта','email',email)+pfield('lg-pass','пароль','current-password')+'<button type="submit">Войти</button><button type="button" class="lnk" data-lg="up">Впервые здесь? Создать аккаунт</button><button type="button" class="lnk" data-lg="forgot">Забыла пароль</button>';
  } else if(step==='up'){
    body += '<p>Создай аккаунт: почта и пароль от 8 символов. Все дела и настройки сохранятся в нём.</p>';
    f = field('lg-email','email','почта','email',email)+pfield('lg-pass','придумай пароль','new-password')+'<button type="submit">Создать аккаунт</button><button type="button" class="lnk" data-lg="in">У меня уже есть аккаунт</button>';
  } else if(step==='sent'){
    body += '<p>Письмо отправлено на <b>'+esc(email)+'</b>. Нажми в нём ссылку подтверждения, потом вернись сюда и войди.</p>';
    f = '<button type="button" data-lg="in">Я подтвердила — войти</button><button type="button" class="lnk" data-resend>Не пришло? Прислать ещё раз</button><button type="button" class="lnk" data-lg="up">Ошиблась в почте — исправить</button>';
  } else if(step==='unconf'){
    body += '<p>Почта <b>'+esc(email)+'</b> ещё не подтверждена. Открой письмо от Ритма и нажми ссылку. Если адрес с ошибкой — создай аккаунт заново с правильной почтой.</p>';
    f = '<button type="button" data-resend>Прислать письмо ещё раз</button><button type="button" class="lnk" data-lg="up">Создать аккаунт с другой почтой</button><button type="button" class="lnk" data-lg="in">Я подтвердила — войти</button>';
  } else if(step==='forgot'){
    body += '<p>Пришлю ссылку, чтобы задать новый пароль.</p>';
    f = field('lg-email','email','почта','email',email)+'<button type="submit">Прислать ссылку</button><button type="button" class="lnk" data-lg="in">Назад</button>';
  } else if(step==='reset'){
    body += '<p>Придумай новый пароль.</p>';
    f = pfield('lg-pass','новый пароль','new-password')+'<button type="submit">Сохранить пароль</button>';
  }
  body += ((step==='in'||step==='up')?socialHtml():'')+'<form class="lg-box" style="gap:10px">'+f+'</form><div class="er" role="alert"'+(ok?' style="color:var(--good,#2F7A55)"':'')+'>'+esc(msg)+'</div>';
  lg.innerHTML = '<div class="lg-box">'+body+'</div>';
  var inp = lg.querySelector('input'); if(inp) setTimeout(function(){ inp.focus(); }, 50);
}
async function oauth(provider, btn){
  btn.disabled = true; var sp = btn.querySelector('span'); if(sp) sp.textContent = 'Открываю…';
  var id = provider === 'vk' ? 'custom:vk' : provider;
  var r = await sb.auth.signInWithOAuth({ provider: id, options: { redirectTo: HERE, scopes: provider==='google' ? 'openid email profile' : undefined } });
  if(r.error){ btn.disabled = false; showLogin(errText(r.error)); }
}
function errText(x){
  var m = String(x && x.message || '');
  return /invalid login|invalid credentials/i.test(m) ? 'Неверная почта или пароль.' :
         /not confirmed/i.test(m) ? 'Сначала подтверди почту: ссылка в письме.' :
         /already registered|already exists/i.test(m) ? 'Такая почта уже зарегистрирована. Войди.' :
         /password should|weak|at least/i.test(m) ? 'Пароль слишком простой: от 8 символов, буквы и цифры.' :
         /rate|seconds|too many/i.test(m) ? 'Слишком много попыток. Подожди минуту.' :
         /signups not allowed|signup is disabled/i.test(m) ? 'Регистрация закрыта.' :
         /fetch|network/i.test(m) ? 'Нет связи. Проверь интернет.' : 'Не получилось: '+m;
}
async function onSubmit(e){
  e.preventDefault();
  var q = function(s){ var i=lg.querySelector(s); return i?i.value:''; };
  var btn = lg.querySelector('button[type=submit]'); if(btn){ btn.disabled = true; btn.textContent = 'Секунду…'; }
  try{
    if(q('#lg-email')) email = q('#lg-email').trim().toLowerCase();
    if(step==='in'){
      var r = await sb.auth.signInWithPassword({ email: email, password: q('#lg-pass') });
      if(r.error) throw r.error;
      session = r.data.session; hideLogin(); readyResolve(session);
    } else if(step==='up'){
      var u = await sb.auth.signUp({ email: email, password: q('#lg-pass'), options: { emailRedirectTo: HERE } });
      if(u.error) throw u.error;
      if(u.data.session){ session = u.data.session; hideLogin(); readyResolve(session); }
      else { step='sent'; showLogin(); }
    } else if(step==='forgot'){
      var f = await sb.auth.resetPasswordForEmail(email, { redirectTo: HERE });
      if(f.error) throw f.error;
      step='in'; showLogin('Ссылка отправлена. Открой письмо на этом телефоне.', true);
    } else if(step==='reset'){
      var p = await sb.auth.updateUser({ password: q('#lg-pass') });
      if(p.error) throw p.error;
      var s = await sb.auth.getSession(); session = s.data.session;
      hideLogin(); if(session) readyResolve(session);
    }
  }catch(x){ if(/not confirmed/i.test(String(x&&x.message))){ step='unconf'; showLogin(); } else showLogin(errText(x)); }
}
function hideLogin(){ if(lg){ lg.remove(); lg=null; } }

/* ---------- интерфейсы для приложения ---------- */
async function token(){
  var s = await sb.auth.getSession(); session = s.data.session;
  if(!session) throw err('session_expired');
  return session.access_token;
}
function makeDb(){
  return { doc: function(path){
    return {
      get: async function(){
        var r = await sb.from('states').select('data').eq('user_id', session.user.id).maybeSingle();
        if(r.error) throw err('db_error', r.error.message);
        return { exists: !!r.data, data: function(){ return r.data ? r.data.data : null; } };
      },
      set: async function(d){
        var r = await sb.from('states').upsert({ user_id: session.user.id, data: d, updated_at: new Date().toISOString() });
        if(r.error) throw err('db_error', r.error.message);
      }
    };
  }};
}
async function callAi(body, opts){
  try{ return await callAiOnce(body, opts); }
  catch(e){
    if(!e || (e.code!=='network' && e.code!=='ai_error') || (opts&&opts.signal&&opts.signal.aborted)) throw e;
    await new Promise(function(r){ setTimeout(r, 1500); });
    return callAiOnce(body, opts);
  }
}
async function callAiOnce(body, opts){
  opts = opts || {};
  var t = await token();
  var res;
  try{
    res = await fetch(CFG.supabaseUrl.replace(/\/$/,'') + '/functions/v1/ai', {
      method: 'POST', signal: opts.signal,
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer '+t, 'apikey': CFG.supabaseAnonKey },
      body: JSON.stringify(body)
    });
  }catch(x){ if(x && x.name==='AbortError') throw err('cancelled'); throw err('network'); }
  if(!res.ok){
    var j = {}; try{ j = await res.json(); }catch(_){}
    throw err(j.code || (res.status===401?'session_expired':res.status===429?'rate_limited':res.status===413?'prompt_too_large':'ai_error'), j.error);
  }
  if(body.stream && res.body && opts.onText){
    var reader = res.body.getReader(), dec = new TextDecoder(), text = '';
    try{
      for(;;){ var c = await reader.read(); if(c.done) break; var d = dec.decode(c.value, {stream:true}); text += d; opts.onText({ text: text, delta: d }); }
    }catch(x){ if(x && x.name==='AbortError') throw err('cancelled'); throw x; }
    if(!text.trim()) throw err('empty_completion');
    return { text: text };
  }
  var out = await res.json();
  if(!out.text) throw err('empty_completion');
  if(opts.onText) opts.onText({ text: out.text, delta: out.text });
  return { text: out.text };
}
function toMessages(input){
  if(typeof input === 'string') return [{ role:'user', content: input }];
  return (input||[]).map(function(m){ return { role: m.role==='assistant'?'assistant':'user', content: String(m.content||'') }; });
}
function parseJson(t){
  t = String(t||'').trim().replace(/^```(?:json)?/i,'').replace(/```$/,'').trim();
  try{ return JSON.parse(t); }catch(_){}
  var a = t.indexOf('{'), b = t.lastIndexOf('}');
  if(a>=0 && b>a){ try{ return JSON.parse(t.slice(a, b+1)); }catch(_){} }
  throw err('invalid_json');
}
function makeSample(){
  var sample = function(input, opts){
    opts = opts || {};
    var body = { messages: toMessages(input), tier: opts.modelTier || 'default', stream: false };
    return callAi(body, opts).catch(function(e){
      if(!body.stream || e.code==='cancelled' || e.code==='session_expired' || e.code==='rate_limited') throw e;
      body.stream = false; return callAi(body, opts);
    });
  };
  sample.json = async function(prompt, opts){
    opts = opts || {};
    var r = await callAi({ messages: toMessages(prompt), tier: opts.modelTier || 'default', json: true }, opts);
    return parseJson(r.text);
  };
  return sample;
}

/* выход */
document.addEventListener('click', async function(e){
  var b = e.target.closest && e.target.closest('[data-act=sign-out]');
  if(!b) return;
  e.stopPropagation();
  try{ localStorage.removeItem('ritm-cache'); }catch(_){}
  await sb.auth.signOut();
  location.reload();
}, true);


/* запасное распознавание записи на сервере */
window.RITM_TRANSCRIBE = async function(blob){
  var t = await token();
  var r = await fetch(CFG.supabaseUrl.replace(/\/$/,'') + '/functions/v1/transcribe', { method:'POST', headers:{ 'Authorization':'Bearer '+t, 'apikey':CFG.supabaseAnonKey, 'Content-Type': blob.type||'audio/mp4' }, body: blob });
  if(!r.ok) throw err('stt_error');
  var j = await r.json(); return j.text || '';
};

/* живой голос (Gemini TTS через функцию tts) */
window.RITM_TTS = async function(text, signal){
  var t = await token();
  var r = await fetch(CFG.supabaseUrl.replace(/\/$/,'') + '/functions/v1/tts', { method:'POST', signal: signal, headers:{ 'Authorization':'Bearer '+t, 'apikey':CFG.supabaseAnonKey, 'Content-Type':'application/json' }, body: JSON.stringify({ text: text }) });
  if(!r.ok){ var e = err(r.status===503?'no_key':'tts_error'); e.status=r.status; throw e; }
  var b = await r.blob(); if(!b.size || !/audio/.test(b.type)) throw err('tts_error');
  return URL.createObjectURL(b);
};

/* пуш-напоминания на телефон */
function b64u(s){ var p='='.repeat((4-s.length%4)%4); var b=atob((s+p).replace(/-/g,'+').replace(/_/g,'/')); var a=new Uint8Array(b.length); for(var i=0;i<b.length;i++) a[i]=b.charCodeAt(i); return a; }
var FN = function(name){ return CFG.supabaseUrl.replace(/\/$/,'')+'/functions/v1/'+name; };
window.RITM_PUSH = {
  standalone: function(){ return (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true; },
  supported: function(){ return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window; },
  state: async function(){
    if(!this.supported()) return this.standalone() ? 'unsupported' : 'need-install';
    if(Notification.permission === 'denied') return 'denied';
    try{ var reg = await navigator.serviceWorker.ready; var sub = await reg.pushManager.getSubscription(); return sub && Notification.permission==='granted' ? 'on' : 'off'; }catch(_){ return 'off'; }
  },
  enable: async function(){
    var perm = await Notification.requestPermission();
    if(perm !== 'granted') throw err('denied');
    var r = await fetch(FN('push'), { headers:{ apikey: CFG.supabaseAnonKey } }); var j = await r.json();
    var reg = await navigator.serviceWorker.ready;
    var sub = await reg.pushManager.getSubscription() || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64u(j.publicKey) });
    var js = sub.toJSON();
    var q = await sb.from('push_subs').upsert({ endpoint: js.endpoint, user_id: session.user.id, sub: js });
    if(q.error) throw err('db_error', q.error.message);
    return true;
  },
  test: async function(){
    var t = await token();
    var r = await fetch(FN('push'), { method:'POST', headers:{ 'Content-Type':'application/json', Authorization:'Bearer '+t, apikey: CFG.supabaseAnonKey }, body: JSON.stringify({ test:true }) });
    var j = await r.json(); return j.sent || 0;
  },
  scheduleBrief: async function(days){
    await sb.from('reminders').delete().like('task_id', 'brief:%').is('sent_at', null);
    await sb.from('reminders').delete().like('task_id', 'habits:%').is('sent_at', null);
    var now = new Date();
    var rows = (days||[]).map(function(d){ var k = d.kind==='habits' ? 'habits' : 'brief'; var at = new Date(d.date+'T'+d.time+':00'); return { user_id: session.user.id, task_id: k+':'+d.date, title: k==='habits' ? 'Каждый день' : 'План на день', due: d.date, at_time: d.time, fire_at: at.toISOString() }; }).filter(function(r){ return new Date(r.fire_at) > now; });
    if(!rows.length) return true;
    var q = await sb.from('reminders').insert(rows);
    if(q.error) throw err('db_error', q.error.message);
    return true;
  },
  cancel: async function(taskId){ await sb.from('reminders').delete().eq('task_id', taskId).is('sent_at', null); return true; },
  schedule: async function(task, minutes){
    if(!task.due || !task.time) return false;
    var at = new Date(task.due+'T'+task.time+':00');
    var rows = [];
    var before = new Date(at.getTime() - (Number(minutes)||0)*60000);
    if(minutes && before > new Date()) rows.push({ user_id: session.user.id, task_id: task.id, title: task.title, due: task.due, at_time: task.time, fire_at: before.toISOString() });
    if(at > new Date()) rows.push({ user_id: session.user.id, task_id: task.id, title: task.title, due: task.due, at_time: task.time, fire_at: at.toISOString() });
    if(!rows.length) return false;
    await sb.from('reminders').delete().eq('task_id', task.id).is('sent_at', null);
    var q = await sb.from('reminders').insert(rows);
    if(q.error) throw err('db_error', q.error.message);
    return true;
  }
};

window.claude = {
  use: async function(name){
    await ready;
    if(name==='db') return makeDb();
    if(name==='user') return { id: async function(){ return session.user.id; }, profile: function(){ var m=(session.user&&session.user.user_metadata)||{}; return { name: String(m.given_name||m.full_name||m.name||'').split(' ')[0], email: session.user.email||'', avatar: m.avatar_url||m.picture||'' }; } };
    if(name==='sample') return makeSample();
    return null; /* mcp (Google Календарь) — следующий этап */
  }
};

var FROM_LINK = /access_token=|[?&]code=|type=signup|type=email/.test(location.href);
var STANDALONE = (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
function confirmedScreen(){
  step = 'done';
  if(!lg){ showLogin(); }
  lg.innerHTML = '<div class="lg-box"><img src="icons/icon-180.png" alt=""><h1>Ритм</h1><p><b>Почта подтверждена ✓</b></p><p>Теперь открой Ритм с иконки на экране «Домой» и войди с почтой и паролем. Если иконки ещё нет: «Поделиться» → «На экран Домой».</p><button type="button" data-lg-continue>Продолжить в браузере</button></div>';
  lg.querySelector('[data-lg-continue]').onclick = function(){ hideLogin(); readyResolve(session); };
}
function start(){
  if(!window.supabase || !CFG.supabaseUrl || !CFG.supabaseAnonKey){
    document.body.insertAdjacentHTML('afterbegin','<div style="padding:24px;font-family:sans-serif">Ритм ещё не настроен: заполни config.js.</div>');
    return;
  }
  sb = window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseAnonKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce', storageKey: 'ritm-auth' } });
  sb.auth.onAuthStateChange(function(ev){ if(ev==='PASSWORD_RECOVERY'){ step='reset'; showLogin(); } });
  sb.auth.getSession().then(function(r){
    if(/type=recovery/.test(location.hash)) return;
    session = r.data.session;
    if(session){ if(FROM_LINK && !STANDALONE){ confirmedScreen(); return; } readyResolve(session); return; }
    fetch(CFG.supabaseUrl.replace(/\/$/,'')+'/auth/v1/settings',{ headers:{ apikey: CFG.supabaseAnonKey } }).then(function(x){ return x.json(); }).then(function(st){
      var ex = (st && st.external) || {};
      SOCIAL = ['apple','google','vk'].filter(function(k){ return k==='vk' ? !!(ex['custom:vk'] || ex.vk) : !!ex[k]; });
      if(lg) showLogin();
    }).catch(function(){});
    showLogin();
  });
}
if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();

/* обновления: новая версия подхватывается сама */
var RITM_VERSION = window.RITM_BUILD || '';
async function checkVersion(){
  try{
    var r = await fetch('version.txt?t='+Date.now(), { cache:'no-store' }); if(!r.ok) return;
    var v = (await r.text()).trim();
    if(v && RITM_VERSION && v !== RITM_VERSION){
      var k = 'ritm-reloaded-'+v; if(sessionStorage.getItem(k)) return; sessionStorage.setItem(k,'1');
      if('serviceWorker' in navigator){ var reg = await navigator.serviceWorker.getRegistration(); if(reg) try{ await reg.update(); }catch(_){} }
      location.reload();
    }
  }catch(_){}
}
/* v2: без service worker */
window.addEventListener('load', checkVersion);
document.addEventListener('visibilitychange', function(){ if(document.visibilityState==='visible') checkVersion(); });
})();
