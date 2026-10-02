from pathlib import Path
import re

R=Path('.')

# Final version
p=R/'pubspec.yaml'
s=p.read_text()
s=re.sub(r'^version:.*$','version: 1.5.0+50',s,flags=re.M)
p.write_text(s)

# Bundle final runtime files.
web=R/'assets/webapp'
for name in ('v150-cache.js','v150-runtime.js'):
    src=Path(__file__).resolve().parent/name
    if not src.exists(): raise SystemExit(name+' missing')
    (web/name).write_bytes(src.read_bytes())

p=web/'index.html'
s=p.read_text()

# Use the final runtime AFTER native-mobile-patch so old Android back overrides cannot win.
old='<script src="v131-photos.js"></script><script src="v131-runtime.js"></script><script src="native-mobile-patch.js"></script>'
new='<script src="native-mobile-patch.js"></script><script src="v150-cache.js"></script><script src="v150-runtime.js"></script>'
if old in s:
    s=s.replace(old,new,1)
else:
    # idempotent cleanup for later rebuilds
    s=s.replace('<script src="v131-photos.js"></script>','').replace('<script src="v131-runtime.js"></script>','')
    if '<script src="v150-cache.js"></script>' not in s:
        s=s.replace('<script src="native-mobile-patch.js"></script>','<script src="native-mobile-patch.js"></script><script src="v150-cache.js"></script><script src="v150-runtime.js"></script>',1)

# Support www links in the actual renderer.
old="W.rich=value=>window.EduUI.esc(value||'').replace(/\\*\\*([^]+?)\\*\\*/g,'<strong>$1</strong>').replace(/==([^]+?)==/g,'<mark>$1</mark>').replace(/(https?:\\/\\/[^\\s<]+)/gi,'<a class=\"ws-link\" href=\"$1\" target=\"_blank\" rel=\"noopener noreferrer\">$1</a>');"
new="W.rich=value=>window.EduUI.esc(value||'').replace(/\\*\\*([^]+?)\\*\\*/g,'<strong>$1</strong>').replace(/==([^]+?)==/g,'<mark>$1</mark>').replace(/((?:https?:\\/\\/|www\\.)[^\\s<]+)/gi,m=>{const h=/^www\\./i.test(m)?'https://'+m:m;return '<a class=\"ws-link\" href=\"'+h+'\" target=\"_blank\" rel=\"noopener noreferrer\">'+m+'</a>'});"
if old in s: s=s.replace(old,new,1)

# Add local message cache helpers to the ACTUAL workspace chat source.
anchor="const myId=S.user.id,run=W.run;const localKey=(name)=>`ecp-${name}:${myId}`;"
if anchor in s and 'ecp-chat-v150:' not in s:
    s=s.replace(anchor,anchor+"""const msgCacheKey=item=>`ecp-chat-v150:${myId}:${item.kind}:${item.id}`;const readMsgCache=item=>{try{return JSON.parse(localStorage.getItem(msgCacheKey(item))||'null')}catch{return null}};const saveMsgCache=item=>{try{const keep=messages.slice(-100);localStorage.setItem(msgCacheKey(item),JSON.stringify({messages:keep,profiles,receipts,reactions,t:Date.now()}))}catch{}};""",1)

# Restore old messages immediately when a conversation opens.
anchor="S.group=item.kind==='group'?item:null;S.direct=item.kind==='direct'?item.peer_id:null;const blockInfo="
if anchor in s and 'const cachedChat=readMsgCache(item);' not in s:
    s=s.replace(anchor,"S.group=item.kind==='group'?item:null;S.direct=item.kind==='direct'?item.peer_id:null;const cachedChat=readMsgCache(item);if(cachedChat?.messages?.length){messages=cachedChat.messages;profiles=cachedChat.profiles||{};receipts=cachedChat.receipts||[];reactions=cachedChat.reactions||[];messageOffset=messages.length;paintMessages();requestAnimationFrame(()=>{const l=U.q('#message-log');if(l)l.scrollTop=l.scrollHeight});}const blockInfo=",1)

# Group restriction: keep controls tappable so we can show a clear reminder instead of silently disabling everything.
old="U.q('#message-input').disabled=!canSend;U.q('#ws-send button[type=\"submit\"]').disabled=!canSend;U.q('#attach-file').disabled=U.q('#voice-record').disabled=!canSend;"
new="const groupLocked=item.kind==='group'&&!item.allow_member_messaging&&!c.isAdmin();U.q('#message-input').disabled=blocked;U.q('#message-input').readOnly=groupLocked;U.q('#ws-send button[type=\"submit\"]').disabled=blocked;U.q('#attach-file').disabled=U.q('#voice-record').disabled=blocked;"
if old in s: s=s.replace(old,new,1)

# Replace message loader with cache-first delta sync.
start=s.find("  async function loadMessages(older=false,forceBottom=false)")
end=s.find("\n  function paintMessages(){",start)
if start<0 or end<0: raise SystemExit('loadMessages source not found')
replacement=r'''  async function loadMessages(older=false,forceBottom=false){if(!selected||closed)return;const item=selected,ticket=generation,request=++messageRequest;const scroll=U.q('#message-log'),height=scroll.scrollHeight,top=scroll.scrollTop,wasBottom=height-scroll.clientHeight-top<100;
   const table=item.kind==='group'?'group_messages':'direct_messages',key=item.kind==='group'?'group_id':'thread_id';let data=[];
   if(!older&&!messageSearch&&messages.length){
     const newest=messages[messages.length-1],qnew=sb.from(table).select('*').eq(key,item.id).gte('created_at',newest.created_at).order('created_at',{ascending:true}).order('id',{ascending:true}).limit(100);
     data=W.data(await qnew);if(closed||ticket!==generation||request!==messageRequest)return;
     if(data.length){const map=new Map(messages.map(m=>[m.id,m]));for(const m of data)map.set(m.id,m);messages=[...map.values()].sort((a,b)=>new Date(a.created_at)-new Date(b.created_at)||String(a.id).localeCompare(String(b.id)));}
     messageOffset=messages.length;
   }else{
     let query=sb.from(table).select('*').eq(key,item.id);if(messageSearch)query=query.ilike('body','%'+messageSearch+'%');
     const start=older?messageOffset:0,size=older?50:Math.max(50,messages.length||0),batch=W.data(await query.order('created_at',{ascending:false}).order('id',{ascending:false}).range(start,start+size-1));if(closed||ticket!==generation||request!==messageRequest)return;
     data=batch;if(!older){messages=batch.reverse();messageOffset=batch.length;}else{messages=[...batch.reverse(),...messages];messageOffset+=batch.length;}
   }
   const ids=messages.map(m=>m.sender_id);receipts=W.data(await sb.from('chat_receipts').select('*').eq('kind',item.kind).eq('thread_id',item.id));const needed=[...new Set([...ids,...receipts.map(r=>r.user_id)])].filter(id=>!profiles[id]);if(needed.length)Object.assign(profiles,await c.namesFor(needed));
   if(closed||ticket!==generation||request!==messageRequest)return;const enriched=await c.hydrateAttachments(messages);if(closed||ticket!==generation||request!==messageRequest)return;messages=enriched;reactions=messages.length?W.data(await sb.from('chat_reactions').select('*').eq('kind',item.kind).eq('thread_id',item.id).in('message_id',messages.map(m=>m.id))):[];if(closed||ticket!==generation||request!==messageRequest)return;
   saveMsgCache(item);U.q('#older-messages').hidden=!older&&messages.length<50?true:(older?data.length<50:false);paintMessages();if(older)scroll.scrollTop=scroll.scrollHeight-height+top;else if(wasBottom||forceBottom||top===0)scroll.scrollTop=scroll.scrollHeight;await markSeen();
  }'''
s=s[:start]+replacement+s[end:]

# Add stable IDs to comments so per-comment Facebook Like/React can be attached.
old='return `<article class="ws-comment ${d?\'reply\':\'\'}" style="margin-left:${Math.min(d,3)*30}px">${W.avatar(person.full_name,person.avatar_path)}'
new='return `<article class="ws-comment ${d?\'reply\':\'\'}" data-comment-id="${x.id}" data-post-id="${post.id}" style="margin-left:${Math.min(d,3)*30}px">${W.avatar(person.full_name,person.avatar_path)}'
if old in s: s=s.replace(old,new,1)

p.write_text(s)

# Keep the existing native mobile screen-share patch from v1.4.2.
print('Applied EduChatPro v1.5.0 source-of-truth runtime/cache/navigation/forum/group patch')
