(function(){
'use strict';
const URL='https://ptpqsfbbfytkmyaw kwnz.supabase.co'.replace(' ','');
const KEY='sb_publishable_bnS-JxQnl-9269SaQAuRXw_XlqrTjnc';
const DATA='reprise-foot-v1', TOKEN='rf-supabase-session-v1';
let auth=null, ready=false, busy=false, timer=null, lastUploaded='', cloudExists=false;
const el=document.createElement('section');
el.id='rf-sync';
el.style.cssText='position:fixed;right:12px;bottom:12px;z-index:9999;max-width:min(350px,calc(100vw - 24px));font:14px/1.45 system-ui,sans-serif;color:#f7fafc;background:#142235;border:1px solid #52718d;border-radius:14px;padding:12px;box-shadow:0 6px 22px #0006';
document.body.appendChild(el);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','"':'&quot;'}[c]));
function status(message,error=false){const t=document.getElementById('rf-state');if(t){t.textContent=message;t.style.color=error?'#ffb6b6':'#c9e8f3';}}
function paint(){el.innerHTML='<div style="display:flex;align-items:center;justify-content:space-between;gap:8px"><b>☁️ Sauvegarde Reprise Foot</b><button id="rf-hide" style="color:inherit;background:none;border:0;font-size:20px" aria-label="Réduire">−</button></div><div id="rf-body"></div>';
const body=el.querySelector('#rf-body');
if(auth){body.innerHTML='<p style="margin:8px 0">Connecté : '+esc(auth.user?.email||'compte privé')+'</p><p id="rf-state" role="status">Préparation…</p><div style="display:flex;flex-wrap:wrap;gap:7px"><button id="rf-backup">Sauvegarder maintenant</button><button id="rf-restore">Restaurer le cloud</button><button id="rf-logout">Déconnexion</button></div>';}
else{body.innerHTML='<p style="margin:8px 0">Connecte-toi pour enregistrer tes séances automatiquement.</p><form id="rf-login"><input type="email" name="email" placeholder="Adresse e-mail" required autocomplete="username"><input type="password" name="password" placeholder="Mot de passe" required autocomplete="current-password"><button type="submit">Connexion</button></form><p id="rf-state" role="status"></p>';}
el.querySelectorAll('button:not(#rf-hide),input').forEach(x=>x.style.cssText+=';padding:7px;border-radius:7px;margin:3px 2px;background:#f1f6fa;color:#112339;border:1px solid #8da7bb;max-width:95%');
el.querySelector('#rf-hide').onclick=()=>{const hidden=body.style.display==='none';body.style.display=hidden?'':'none';el.querySelector('#rf-hide').textContent=hidden?'−':'+';};
if(auth){document.getElementById('rf-backup').onclick=()=>backup(true);document.getElementById('rf-restore').onclick=restore;document.getElementById('rf-logout').onclick=()=>{if(!confirm('Déconnecter la sauvegarde cloud ? Les données locales restent intactes.'))return;auth=null;ready=false;localStorage.removeItem(TOKEN);paint();};}
else document.getElementById('rf-login').onsubmit=login;
}
function persist(){if(auth)localStorage.setItem(TOKEN,JSON.stringify(auth));}
async function request(path,{method='GET',body,token}={}){
 const res=await fetch(URL+path,{method,headers:{'apikey':KEY,'Content-Type':'application/json',...(token?{'Authorization':'Bearer '+token}:{})},...(body!==undefined?{body:JSON.stringify(body)}:{})});
 const str=await res.text();let obj;try{obj=str?JSON.parse(str):null;}catch{obj={message:str};}
 if(!res.ok)throw Error(obj?.msg||obj?.error_description||obj?.message||obj?.error||'Erreur HTTP '+res.status);
 return obj;
}
async function refresh(){
 if(!auth?.refresh_token)throw Error('Session expirée : reconnecte-toi.');
 const a=await request('/auth/v1/token?grant_type=refresh_token',{method:'POST',body:{refresh_token:auth.refresh_token}});
 auth={...auth,...a};persist();return auth.access_token;
}
async function api(path,opts={}){
 if(!auth)throw Error('Connexion requise');
 if(auth.expires_at && Date.now()/1000>auth.expires_at-90)await refresh();
 try{return await request(path,{...opts,token:auth.access_token});}
 catch(e){if(/JWT|token.*expir|401|unauthorized/i.test(e.message)){await refresh();return request(path,{...opts,token:auth.access_token});}throw e;}
}
function local(){const raw=localStorage.getItem(DATA);if(!raw)return null;const v=JSON.parse(raw);if(!v||typeof v!=='object'||!v.sessions||!v.weight||!v.match||!v.reports)throw Error('Données locales invalides');return v;}
async function latest(){
 const rows=await api('/rest/v1/training_backups?select=id,data,created_at&order=created_at.desc&limit=1');
 return rows?.[0]||null;
}
async function init(){
 try{const existing=await latest();cloudExists=!!existing;ready=!existing;
 if(existing){ready=false;status('Sauvegarde cloud existante. Choisis quelle version conserver.');const keep=confirm('Une sauvegarde cloud existe déjà. OK : conserver les données de CE téléphone et activer la sauvegarde automatique. Annuler : choisir de restaurer la sauvegarde cloud.');if(keep){ready=true;schedule();status('Synchronisation activée.');}else{const restoreNow=confirm('Restaurer maintenant les données du cloud sur ce téléphone ? Cela remplacera les données locales. Annuler : aucune modification.');if(restoreNow)await restore();else status('Synchronisation en pause : choisis Restaurer ou Sauvegarder.');}}
 else{status('Compte connecté. Première sauvegarde…');await backup(true);}
 }catch(e){status('Synchronisation impossible : '+e.message,true);}
}
async function login(event){event.preventDefault();const f=new FormData(event.target);status('Connexion…');
 try{const a=await request('/auth/v1/token?grant_type=password',{method:'POST',body:{email:f.get('email'),password:f.get('password')}});auth=a;persist();paint();await init();}
 catch(e){status('Connexion refusée : '+e.message,true);}
}
async function backup(manual=false){
 if(!auth)return;if(!ready&&!manual)return;
 if(busy){schedule();return;}busy=true;
 try{const data=local();if(!data)throw Error('Aucune donnée locale trouvée');const serialized=JSON.stringify(data);
 if(serialized===lastUploaded){if(manual)status('Données déjà sauvegardées.');return;}
 status('Envoi sécurisé…');
 await api('/rest/v1/training_backups',{method:'POST',body:{user_id:auth.user.id,data}});
 cloudExists=true;ready=true;lastUploaded=serialized;status('Sauvegardé dans le cloud : '+new Date().toLocaleString('fr-FR'));
 }catch(e){status('Sauvegarde en attente : '+e.message,true);}
 finally{busy=false;}
}
function schedule(){if(!ready||!auth)return;clearTimeout(timer);timer=setTimeout(()=>backup(false),8000);}
async function restore(){
 if(!auth)return;
 if(!confirm('Remplacer les données de ce téléphone par la dernière sauvegarde cloud ? Les changements locaux non sauvegardés seront perdus.'))return;
 try{status('Récupération…');const row=await latest();if(!row)throw Error('Aucune sauvegarde disponible');
 const d=row.data;if(!d||!d.sessions||!d.weight||!d.match||!d.reports)throw Error('Sauvegarde invalide');
 localStorage.setItem(DATA,JSON.stringify(d));ready=true;lastUploaded=JSON.stringify(d);status('Restauration réussie. Rechargement…');location.reload();}
 catch(e){status('Restauration impossible : '+e.message,true);}
}
window.addEventListener('rf-data-change',schedule);
window.addEventListener('online',()=>{if(auth){if(ready)schedule();else init();}});
paint();
try{const s=JSON.parse(localStorage.getItem(TOKEN)||'null');if(s?.access_token&&s?.refresh_token){auth=s;paint();init();}}catch{}
})();