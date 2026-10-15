/* Ритм: сначала сеть, при отсутствии сети — сохранённая оболочка. */
const C='ritm-v4';
const SHELL=['./','index.html','backend.js','config.js','manifest.webmanifest','icons/icon-180.png'];
self.addEventListener('install',e=>{ e.waitUntil(caches.open(C).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting())); });
self.addEventListener('activate',e=>{ e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==C).map(x=>caches.delete(x)))).then(()=>self.clients.claim())); });
self.addEventListener('fetch',e=>{
  const u=new URL(e.request.url);
  if(e.request.method!=='GET'||u.origin!==location.origin) return;
  e.respondWith(fetch(e.request,{cache:'no-cache'}).then(r=>{ const cp=r.clone(); caches.open(C).then(c=>c.put(e.request,cp)); return r; }).catch(()=>caches.match(e.request).then(r=>r||caches.match('index.html'))));
});

/* пуш-напоминания */
self.addEventListener('push', e=>{
  let d={}; try{ d=e.data?e.data.json():{}; }catch(_){ d={title:'Ритм', body:e.data&&e.data.text()}; }
  e.waitUntil(self.registration.showNotification(d.title||'Ритм', { body:d.body||'', tag:d.tag||undefined, icon:'icons/icon-192.png', badge:'icons/icon-192.png', data:{url:'./'} }));
});
self.addEventListener('notificationclick', e=>{
  e.notification.close();
  e.waitUntil(clients.matchAll({type:'window', includeUncontrolled:true}).then(list=>{ for(const c of list){ if('focus' in c){ try{ c.postMessage({type:'resume'}); }catch(_){} return c.focus(); } } return clients.openWindow('./'); }));
});
