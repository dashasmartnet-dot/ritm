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
'.lg-box .er{color:#A5541E;font-weight:600;min-height:1.2em}';

var lg = null, step = 'in', email = '';
var esc = function(v){ return String(v||'').replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); };
var HERE = location.origin + location.pathname;
function field(id, type, ph, ac, val){ return '<label for="'+id+'" class="live">'+ph+'</label><input id="'+id+'" type="'+type+'" placeholder="'+ph+'" autocomplete="'+ac+'" required'+(type==='email'?' inputmode="email"':'')+(type==='password'?' minlength="8"':'')+(val?' value="'+esc(val)+'"':'')+'>'; }
function showLogin(msg, ok){
  if(!lg){
    document.head.appendChild(el('style', {}, css));
    lg = el('div', {'class':'lg', role:'dialog', 'aria-modal':'true', 'aria-label':'Вход в Ритм'});
    document.body.appendChild(lg);
    lg.addEventListener('submit', onSubmit);
    lg.addEventListener('click', function(e){ var t=e.target.closest('[data-lg]'); if(t){ step=t.getAttribute('data-lg'); showLogin(); } });
  }
  var body = '<img src="icons/icon-180.png" alt=""><h1>Ритм</h1>', f='';
  if(step==='in'){
    body += '<p>Умный ассистент твоего дня.</p>';
    f = field('lg-email','email','почта','email',email)+field('lg-pass','password','пароль','current-password')+'<button type="submit">Войти</button><button type="button" class="lnk" data-lg="up">Впервые здесь? Создать аккаунт</button><button type="button" class="lnk" data-lg="forgot">Забыла пароль</button>';
  } else if(step==='up'){
    body += '<p>Создай аккаунт: почта и пароль от 8 символов. Все дела и настройки сохранятся в нём.</p>';
    f = field('lg-email','email','почта','email',email)+field('lg-pass','password','придумай пароль','new-password')+'<button type="submit">Создать аккаунт</button><button type="button" class="lnk" data-lg="in">У меня уже есть аккаунт</button>';
  } else if(step==='sent'){
    body += '<p>Письмо отправлено на <b>'+esc(email)+'</b>. Нажми в нём ссылку подтверждения, потом вернись сюда и войди.</p>';
    f = '<button type="button" data-lg="in">Я подтвердила — войти</button>';
  } else if(step==='forgot'){
    body += '<p>Пришлю ссылку, чтобы задать новый пароль.</p>';
    f = field('lg-email','email','почта','email',email)+'<button type="submit">Прислать ссылку</button><button type="button" class="lnk" data-lg="in">Назад</button>';
  } else if(step==='reset'){
    body += '<p>Придумай новый пароль.</p>';
    f = field('lg-pass','password','новый пароль','new-password')+'<button type="submit">Сохранить пароль</button>';
  }
  body += '<form class="lg-box" style="gap:10px">'+f+'</form><div class="er" role="alert"'+(ok?' style="color:var(--good,#2F7A55)"':'')+'>'+esc(msg)+'</div>';
  lg.innerHTML = '<div class="lg-box">'+body+'</div>';
  var inp = lg.querySelector('input'); if(inp) setTimeout(function(){ inp.focus(); }, 50);
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
  }catch(x){ showLogin(errText(x)); }
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
    return callAi({ messages: toMessages(input), tier: opts.modelTier || 'default', stream: !!opts.onText }, opts);
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

window.claude = {
  use: async function(name){
    await ready;
    if(name==='db') return makeDb();
    if(name==='user') return { id: async function(){ return session.user.id; } };
    if(name==='sample') return makeSample();
    return null; /* mcp (Google Календарь) — следующий этап */
  }
};

function start(){
  if(!window.supabase || !CFG.supabaseUrl || !CFG.supabaseAnonKey){
    document.body.insertAdjacentHTML('afterbegin','<div style="padding:24px;font-family:sans-serif">Ритм ещё не настроен: заполни config.js.</div>');
    return;
  }
  sb = window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseAnonKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: 'ritm-auth' } });
  sb.auth.onAuthStateChange(function(ev){ if(ev==='PASSWORD_RECOVERY'){ step='reset'; showLogin(); } });
  sb.auth.getSession().then(function(r){
    if(/type=recovery/.test(location.hash)) return;
    session = r.data.session;
    if(session) readyResolve(session); else showLogin();
  });
}
if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();

if('serviceWorker' in navigator) window.addEventListener('load', function(){ navigator.serviceWorker.register('sw.js').catch(function(){}); });
})();
