from pathlib import Path
import re, shutil
R=Path('.')
web=R/'assets/webapp'

# Version/build
p=R/'pubspec.yaml'
v=p.read_text()
v=re.sub(r'^version:.*$','version: 1.5.1+51',v,flags=re.M)
p.write_text(v)

# Bundle final runtime
src=Path(__file__).resolve().parent/'v151-runtime.js'
if not src.exists(): raise SystemExit('v151-runtime.js missing')
(web/'v151-runtime.js').write_bytes(src.read_bytes())
p=web/'index.html'
s=p.read_text()

# Photo cache: persistent CacheStorage stays across logouts; expose synchronous hot peek.
s=s.replace("const hot=new Map(),pending=new Map();let epoch=0,trimWork=Promise.resolve();","const hot=new Map(),quick=new Map(),pending=new Map();let epoch=0,trimWork=Promise.resolve();",1)
s=s.replace("const object=URL.createObjectURL(blob);hot.set(key,object);while(hot.size>200){const oldest=hot.keys().next().value;URL.revokeObjectURL(hot.get(oldest));hot.delete(oldest)}return object;",
            "const object=URL.createObjectURL(blob);hot.set(key,object);quick.set(bucket+'/'+path,object);while(hot.size>200){const oldest=hot.keys().next().value,oldUrl=hot.get(oldest);URL.revokeObjectURL(oldUrl);hot.delete(oldest);for(const [qk,qv] of quick)if(qv===oldUrl)quick.delete(qk)}return object;",1)
s=s.replace("async function clear(){epoch++;for(const url of hot.values())URL.revokeObjectURL(url);hot.clear();pending.clear();try{await caches.delete(cacheName)}catch{}}\n return {get,clear};",
            "async function clear(purge=false){epoch++;for(const url of hot.values())URL.revokeObjectURL(url);hot.clear();quick.clear();pending.clear();if(purge){try{await caches.delete(cacheName)}catch{}}}\n function peek(bucket,path){return path?quick.get(bucket+'/'+path)||'':''}\n return {get,clear,peek};",1)

# Avatar HTML can reuse hot object URL immediately without a visible reload in the same session.
old="W.avatar=(name,path=null,bucket='avatars',extra='')=>`<span class=\"ws-avatar ${extra}\">${path?`<img alt=\"${window.EduUI.attr(name||'Profile')}\" data-photo=\"${window.EduUI.attr(path)}\" data-bucket=\"${bucket}\" loading=\"lazy\">`:window.EduUI.esc((name||'?').trim().slice(0,1).toUpperCase())}</span>`;"
new="W.avatar=(name,path=null,bucket='avatars',extra='')=>{const hot=path?window.EduPhotos.peek?.(bucket,path)||'':'';return `<span class=\"ws-avatar ${extra}\">${path?`<img alt=\"${window.EduUI.attr(name||'Profile')}\" data-photo=\"${window.EduUI.attr(path)}\" data-bucket=\"${bucket}\" ${hot?`src=\"${window.EduUI.attr(hot)}\"`:''} loading=\"lazy\" decoding=\"async\">`:window.EduUI.esc((name||'?').trim().slice(0,1).toUpperCase())}</span>`};"
if old not in s: raise SystemExit('W.avatar target missing')
s=s.replace(old,new,1)

# Persistent thread cache helpers in the ACTUAL W.chat implementation.
anchor="const myId=S.user.id,run=W.run;const localKey=(name)=>`ecp-${name}:${myId}`;"
if anchor not in s: raise SystemExit('chat helper anchor missing')
s=s.replace(anchor,anchor+"const threadCacheKey=()=>`ecp-thread-cache-v151:${myId}:${filter}:${view}:${search}`;const readThreadCache=()=>{try{return JSON.parse(localStorage.getItem(threadCacheKey())||'[]')}catch{return[]}};const saveThreadCache=()=>{try{localStorage.setItem(threadCacheKey(),JSON.stringify(threads.slice(0,180)))}catch{}};",1)

# Replace loadList with cache-first paint + background refresh.
start=s.find("  async function loadList(append=false){")
end=s.find("\n  async function peopleSearch(query){",start)
if start<0 or end<0: raise SystemExit('loadList bounds missing')
replacement=r'''  function paintThreadList(){
   const list=U.q('#thread-list',root);if(!list)return;
   list.innerHTML=threads.length?threads.map(t=>`<div class="ws-thread-wrap"><button class="ws-thread ${selected?.id===t.id?'selected':''}" data-thread="${t.id}" data-kind="${t.kind}">${W.avatar(t.name,t.avatar_path,t.kind==='group'?'group-images':'avatars',t.kind==='group'?'group-avatar':'')}<span class="ws-thread-copy"><span class="ws-thread-title"><b>${U.esc(t.name)}${t.kind==='direct'?window.EduPresence.badge(t.peer_id):''}</b><time>${W.time(t.last_at)}</time></span><span class="ws-thread-description">${U.esc(t.description||'')}</span><span class="ws-thread-preview">${U.esc(t.preview||'Start a conversation')}<span class="spacer"></span>${Number(t.unread)?`<i class="ws-unread">${Number(t.unread)>99?'99+':t.unread}</i>`:''}</span></span></button><button class="ws-thread-pin ${t.pinned?'pinned':''}" data-pin-thread="${t.id}" data-pin-kind="${t.kind}" title="${t.pinned?'Unpin':'Pin'} conversation" aria-label="${t.pinned?'Unpin':'Pin'} conversation">${W.icon('pin')}</button></div>`).join(''):'<div class="ws-empty">No conversations match this filter.</div>';
   U.qa('[data-thread]',list).forEach(b=>b.onclick=run(()=>select(threads.find(t=>t.id===b.dataset.thread&&t.kind===b.dataset.kind))));U.qa('[data-pin-thread]',list).forEach(b=>b.onclick=run(async()=>{const t=threads.find(x=>x.id===b.dataset.pinThread&&x.kind===b.dataset.pinKind);if(!t)return;W.data(await sb.from('chat_preferences').upsert({kind:t.kind,thread_id:t.id,user_id:myId,favorite:!!t.favorite,pinned:!t.pinned}));t.pinned=!t.pinned;saveThreadCache();paintThreadList();loadList().catch(()=>{});}));W.photos(list,sb);activateTabs();
  }
  async function loadList(append=false){
   const ticket=++listGeneration,key=JSON.stringify([search,filter,view]);
   if(!append&&!threads.length){const cached=readThreadCache();if(cached.length){threads=cached;offset=cached.length;paintThreadList();}}
   const count=!append&&key===lastListQuery?Math.max(1,Math.ceil(offset/60)):1,args={search_text:search,kind_filter:filter,view_filter:view==='saved'?'all':view};let data=[];
   for(let page=0;page<count;page++){const batch=W.data(await sb.rpc('chat_inbox',{...args,page_offset:append?offset:page*60}));if(closed||ticket!==listGeneration)return;data.push(...batch);if(batch.length<60)break;}
   lastListQuery=key;if(closed||ticket!==listGeneration)return;data=data.filter(t=>!hasLocal('hidden-chats',threadKey(t)));if(!append){threads=[];offset=0;}threads.push(...data);offset+=data.length;saveThreadCache();U.q('#thread-more',root).hidden=data.length===0||data.length%60!==0;paintThreadList();
  }'''
s=s[:start]+replacement+s[end:]

# Realtime/fast optimistic send in actual source.
start=s.find("  async function send(e){")
end=s.find("\n  async function notifyMentions",start)
if start<0 or end<0: raise SystemExit('send bounds missing')
replacement=r'''  async function send(e){e.preventDefault();const input=U.q('#message-input'),button=U.q('#ws-send button[type="submit"]'),item=selected,ticket=generation;const body=input.value.trim();if(!item||button.disabled||(!body&&!attached))return;if(item.kind==='group'&&!item.allow_member_messaging&&!c.isAdmin()){U.toast('Messaging is not allowed for members in this group.','error');return;}
   const pendingFile=attached;if(!pendingFile&&body){const temp={id:'local-'+crypto.randomUUID(),body,sender_id:myId,created_at:new Date().toISOString(),_optimistic:true};messages.push(temp);input.value='';paintMessages();saveMsgCache(item);const log=U.q('#message-log');if(log)requestAnimationFrame(()=>log.scrollTop=log.scrollHeight);try{input.focus({preventScroll:true})}catch{input.focus()}
    try{const row={body,sender_id:myId};row[item.kind==='group'?'group_id':'thread_id']=item.id;const added=W.data(await sb.from(item.kind==='group'?'group_messages':'direct_messages').insert(row).select('*').single());const i=messages.findIndex(m=>m.id===temp.id);if(i>=0)messages[i]=added;if(body.includes('@'))notifyMentions(item,body,added?.id).catch(()=>{});saveMsgCache(item);paintMessages();loadList().catch(()=>{});}catch(err){messages=messages.filter(m=>m.id!==temp.id);input.value=body;paintMessages();throw err;}return;
   }
   button.disabled=true;let inserted=false;try{await c.sendAttachment(item,pendingFile,body);inserted=true;if(ticket!==generation||closed)return;input.value='';attached=null;showAttachment();await loadMessages(false,true);loadList().catch(()=>{});}finally{if(button.isConnected)button.disabled=false;}
  }'''
s=s[:start]+replacement+s[end:]

# Optimistic reactions without re-downloading the conversation.
old="  async function react(id,emoji){const mine=reactions.find(r=>r.message_id===id&&r.user_id===myId);if(mine?.emoji===emoji)W.data(await sb.from('chat_reactions').delete().eq('kind',selected.kind).eq('message_id',id).eq('user_id',myId));else W.data(await sb.from('chat_reactions').upsert({kind:selected.kind,thread_id:selected.id,message_id:id,user_id:myId,emoji}));await loadMessages(false);}"
new="  async function react(id,emoji){const before=reactions.slice(),mine=reactions.find(r=>r.message_id===id&&r.user_id===myId);reactions=reactions.filter(r=>!(r.message_id===id&&r.user_id===myId));if(mine?.emoji!==emoji)reactions.push({kind:selected.kind,thread_id:selected.id,message_id:id,user_id:myId,emoji});paintMessages();saveMsgCache(selected);try{if(mine?.emoji===emoji)W.data(await sb.from('chat_reactions').delete().eq('kind',selected.kind).eq('message_id',id).eq('user_id',myId));else W.data(await sb.from('chat_reactions').upsert({kind:selected.kind,thread_id:selected.id,message_id:id,user_id:myId,emoji}));}catch(e){reactions=before;paintMessages();saveMsgCache(selected);throw e;}}"
if old not in s: raise SystemExit('react target missing')
s=s.replace(old,new,1)

# Group Settings: put the per-group permission toggle directly in Chat > Details > Settings.
old="if(name==='Settings'){out.innerHTML=`<label class=\"ws-setting\"><input id=\"favorite-chat\" type=\"checkbox\" ${selected.favorite?'checked':''}>Favorite conversation</label><label class=\"ws-setting\"><input id=\"pin-chat\" type=\"checkbox\" ${selected.pinned?'checked':''}>Pin conversation</label>`;for(const [id,key]of[['favorite-chat','favorite'],['pin-chat','pinned']])U.q('#'+id,out).onchange=run(async e=>{const value=e.target.checked;W.data(await sb.from('chat_preferences').upsert({kind:selected.kind,thread_id:selected.id,user_id:myId,favorite:!!selected.favorite,pinned:!!selected.pinned,[key]:value}));selected[key]=value;await loadList();});if(selected.kind==='group'){out.insertAdjacentHTML('beforeend','<button class=\"btn\" id=\"group-settings-open\">Group settings</button>');U.q('#group-settings-open').onclick=run(()=>legacyPanel('settings'));}}"
new="if(name==='Settings'){out.innerHTML=`<label class=\"ws-setting\"><input id=\"favorite-chat\" type=\"checkbox\" ${selected.favorite?'checked':''}>Favorite conversation</label><label class=\"ws-setting\"><input id=\"pin-chat\" type=\"checkbox\" ${selected.pinned?'checked':''}>Pin conversation</label>`;for(const [id,key]of[['favorite-chat','favorite'],['pin-chat','pinned']])U.q('#'+id,out).onchange=run(async e=>{const value=e.target.checked;W.data(await sb.from('chat_preferences').upsert({kind:selected.kind,thread_id:selected.id,user_id:myId,favorite:!!selected.favorite,pinned:!!selected.pinned,[key]:value}));selected[key]=value;saveThreadCache();paintThreadList();loadList().catch(()=>{});});if(selected.kind==='group'){out.insertAdjacentHTML('beforeend',`<section class=\"ws-group-permission\"><h3>Member Permissions</h3><label class=\"switch\"><input id=\"settings-allow-chat\" type=\"checkbox\" ${selected.allow_member_messaging?'checked':''} ${c.isSuper()?'':'disabled'}><span>Allow members to send messages</span></label><p class=\"hint\">This setting applies only to this group. When OFF, members can read messages but cannot send new messages.</p></section><button class=\"btn\" id=\"group-settings-open\">More group settings</button>`);const toggle=U.q('#settings-allow-chat',out);toggle?.addEventListener('change',run(async e=>{if(!c.isSuper()){e.target.checked=selected.allow_member_messaging;U.toast('Only Super Admin can change member messaging.','error');return;}const next=e.target.checked;const r=await sb.from('groups').update({allow_member_messaging:next}).eq('id',selected.id).select('id,allow_member_messaging').single();if(r.error){e.target.checked=!next;throw r.error;}selected.allow_member_messaging=next;S.group=selected;U.q('#message-input').readOnly=!next&&!c.isAdmin();U.toast(next?'Member messaging enabled for this group.':'Member messaging disabled for this group.','ok');}));U.q('#group-settings-open').onclick=run(()=>legacyPanel('settings'));}}"
if old not in s: raise SystemExit('settings panel target missing')
s=s.replace(old,new,1)

# Legacy Group Settings wording: explicit independent per-group setting.
s=s.replace('<span>Allow member texting / files / voice</span>','<span>Allow members to send messages</span>',1)
s=s.replace('Only Super Admin can change this. ON: members can send text/files/voice and start group calls. OFF: members can only read, download files, listen to voice messages and join active calls/meetings; only Admin/Super Admin can send, start group calls or create meetings.','This permission is saved separately for this group. Only Super Admin can change it. OFF blocks ordinary member messages while Admin/Super Admin messaging remains available.',1)

# Forum cache-first structured post cache.
forum_anchor="const {sb,S,U}=c,root=U.q('#page');let filter=startFilter,search='',sort='latest',offset=0,posts=[],closed=false,version=0,lastQuery='';"
if forum_anchor not in s: raise SystemExit('forum anchor missing')
s=s.replace(forum_anchor,forum_anchor+"const forumCacheKey=()=>`ecp-forum-v151:${S.user.id}:${filter}:${sort}:${search}`;const readForumCache=()=>{try{return JSON.parse(localStorage.getItem(forumCacheKey())||'[]')}catch{return[]}};const saveForumCache=()=>{try{localStorage.setItem(forumCacheKey(),JSON.stringify(posts.slice(0,80)))}catch{}};",1)

# Replace forum load with cached paint helper.
start=s.find("  async function load(append=false){", s.find("W.forum=async"))
end=s.find("\n  function postCard(p){",start)
if start<0 or end<0: raise SystemExit('forum load bounds missing')
replacement=r'''  function paintForum(){U.q('#forum-more').hidden=posts.length===0||posts.length%20!==0;U.qa('[data-forum-filter]').forEach(b=>b.classList.toggle('active',b.dataset.forumFilter===filter));const list=U.q('#forum-posts');if(!list)return;list.innerHTML=posts.length?posts.map(postCard).join(''):'<div class="ws-card ws-empty">No discussions match this filter. Start a new post or change the search.</div>';wirePosts(list);W.photos(root,sb);W.files(list,sb);}
  async function load(append=false){const ticket=++version,key=JSON.stringify([search,filter,sort]);if(!append&&!posts.length){const cached=readForumCache();if(cached.length){posts=cached;offset=cached.length;paintForum();}}const count=!append&&key===lastQuery?Math.max(1,Math.ceil(offset/20)):1,args={search_text:search,filter_name:filter,sort_name:sort};let data=[];for(let page=0;page<count;page++){const batch=W.data(await sb.rpc('forum_feed',{...args,page_offset:append?offset:page*20}));if(closed||ticket!==version)return;data.push(...batch);if(batch.length<20)break;}if(data.length){const status=await sb.from('forum_posts').select('id,approval_status').in('id',data.map(x=>x.id));if(!status.error){const sm=Object.fromEntries((status.data||[]).map(x=>[x.id,x.approval_status||'approved']));data=data.map(x=>({...x,approval_status:sm[x.id]||'approved'})).filter(x=>c.isAdmin()||x.approval_status!=='pending');}}lastQuery=key;if(closed||ticket!==version)return;if(!append){posts=[];offset=0;}posts.push(...data);offset+=data.length;saveForumCache();paintForum();}'''
s=s[:start]+replacement+s[end:]

# Version marker and runtime load at the end of native patch chain.
marker='<script src="v150-runtime.js"></script>'
if marker not in s: raise SystemExit('v150 runtime marker missing')
if 'v151-runtime.js' not in s:s=s.replace(marker,marker+'<script src="v151-runtime.js"></script>',1)

p.write_text(s)
print('Applied EduChatPro v1.5.1 cache/realtime/back/group-settings patch')
