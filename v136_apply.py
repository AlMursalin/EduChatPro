from pathlib import Path
import re
R=Path('.')

p=R/'pubspec.yaml'
s=p.read_text()
s=re.sub(r'^version:.*$', 'version: 1.3.6+35', s, flags=re.M)
p.write_text(s)

p=R/'assets/webapp/index.html'
s=p.read_text()

# Upgrade the main EduPhotos cache itself so cached avatars can render synchronously on every page.
old="return {get,clear};"
new="""
 function inlineKey(user,bucket,path){let h=2166136261,v=user+'|'+bucket+'|'+path;for(let i=0;i<v.length;i++){h^=v.charCodeAt(i);h=Math.imul(h,16777619)}return 'ecp-avatar-inline-v136:'+(h>>>0).toString(36)}
 function peek(user,bucket,path){try{return localStorage.getItem(inlineKey(user,bucket,path))||''}catch{return''}}
 function saveInline(user,bucket,path,blob){if(!blob||blob.size>260*1024)return;try{const fr=new FileReader();fr.onload=()=>{try{localStorage.setItem(inlineKey(user,bucket,path),String(fr.result||''));let total=0,keys=[];for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k?.startsWith('ecp-avatar-inline-v136:')){const val=localStorage.getItem(k)||'';keys.push([k,val.length]);total+=val.length}}while(total>3*1024*1024&&keys.length){const [k,n]=keys.shift();localStorage.removeItem(k);total-=n}}catch{}};fr.readAsDataURL(blob)}catch{}}
 return {get:async(sb,user,bucket,path)=>{const k=user+'/'+bucket+'/'+path;if(hot.has(k))return hot.get(k);if(pending.has(k))return pending.get(k);const generation=epoch;const task=(async()=>{let cache,url,blob;try{cache=await caches.open(cacheName);url=await requestKey(k);const saved=await cache.match(url);if(saved)blob=await saved.blob()}catch{}if(!blob){const result=await sb.storage.from(bucket).download(path);if(result.error)throw result.error;blob=result.data;if(cache&&url&&generation===epoch){try{await cache.put(url,new Response(blob,{headers:{'Content-Type':blob.type,'x-ecp-size':String(blob.size)}}));trimWork=trimWork.then(()=>trim(cache)).catch(()=>{})}catch{}}}if(generation!==epoch)throw new Error('Session changed');if(bucket==='avatars')saveInline(user,bucket,path,blob);const object=URL.createObjectURL(blob);hot.set(k,object);while(hot.size>200){const oldest=hot.keys().next().value;URL.revokeObjectURL(hot.get(oldest));hot.delete(oldest)}return object})().finally(()=>pending.delete(k));pending.set(k,task);return task},peek,clear};
"""
if old in s:s=s.replace(old,new,1)

# Make every avatar use the persistent cached image immediately when available.
old="W.avatar=(name,path=null,bucket='avatars',extra='')=>`<span class=\"ws-avatar ${extra}\"><span class=\"ws-avatar-fallback\">${window.EduUI.esc((name||'?').trim().slice(0,1).toUpperCase())}</span>${path?`<img alt=\"${window.EduUI.attr(name||'Profile')}\" data-photo=\"${window.EduUI.attr(path)}\" data-bucket=\"${bucket}\" decoding=\"async\" onload=\"this.previousElementSibling.style.display='none'\" onerror=\"this.remove()\">`:''}</span>`;"
new="W.avatar=(name,path=null,bucket='avatars',extra='')=>{let uid='';try{uid=typeof S!=='undefined'&&S&&S.user?S.user.id:''}catch{}const cached=path&&uid&&window.EduPhotos.peek?window.EduPhotos.peek(uid,bucket,path):'';return `<span class=\"ws-avatar ${extra}\"><span class=\"ws-avatar-fallback\" ${cached?'style=\"display:none\"':''}>${window.EduUI.esc((name||'?').trim().slice(0,1).toUpperCase())}</span>${path?`<img alt=\"${window.EduUI.attr(name||'Profile')}\" data-photo=\"${window.EduUI.attr(path)}\" data-bucket=\"${bucket}\" ${cached?`src=\"${window.EduUI.attr(cached)}\"`:''} decoding=\"async\" onload=\"this.previousElementSibling.style.display='none'\" onerror=\"this.remove();this.previousElementSibling.style.display=''\">`:''}</span>`};"
if old in s:s=s.replace(old,new,1)

# Direct profile avatars outside workspace should also show cached data instantly.
old="function avatarHtml(p,size=''){const name=p?.full_name||'User',path=p?.avatar_path||'';return `<span class=\"avatar ${U.attr(size)}\" ${path?`data-avatar-path=\"${U.attr(path)}\"`:''}>${U.esc(initials(name))}</span>`}"
new="function avatarHtml(p,size=''){const name=p?.full_name||'User',path=p?.avatar_path||'';let cached='';try{cached=path&&window.EduPhotos.peek?window.EduPhotos.peek(S.user.id,'avatars',path):''}catch{}return `<span class=\"avatar ${U.attr(size)}\" ${path?`data-avatar-path=\"${U.attr(path)}\"`:''}>${cached?`<img src=\"${U.attr(cached)}\" alt=\"Profile photo\">`:U.esc(initials(name))}</span>`}"
if old in s:s=s.replace(old,new,1)

# Fix forum share: this workspace IIFE cannot see CFG. Use the global config safely.
old="const p=posts.find(x=>x.id===b.dataset.share),url=new URL(CFG.PUBLIC_WEB_URL||location.origin);url.searchParams.set('post',b.dataset.share);"
new="const p=posts.find(x=>x.id===b.dataset.share),base=(window.EDUCHAT_CONFIG&&window.EDUCHAT_CONFIG.PUBLIC_WEB_URL)||((location.origin&&location.origin!=='null')?location.origin:'https://nextechdigitalacademy.is-best.net');const url=new URL(base);url.searchParams.set('post',b.dataset.share);"
if old in s:s=s.replace(old,new,1)

# Make share DB logging non-fatal, so OS share still works even if forum_shares write fails.
s=s.replace("W.data(await sb.from('forum_shares').upsert({post_id:b.dataset.share,user_id:S.user.id}));await load();",
            "try{const sr=await sb.from('forum_shares').upsert({post_id:b.dataset.share,user_id:S.user.id});if(sr.error)console.warn('Share log failed',sr.error.message)}catch{}await load();",1)

p.write_text(s)
print('Applied v1.3.6 persistent avatars and forum share fix')