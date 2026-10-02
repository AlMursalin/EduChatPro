from pathlib import Path
import re, shutil, json
R=Path('.')
web=R/'assets/webapp'

# Bring the v1.5.5 runtime layers into the build output first.
for name in ('v153-runtime.js','v154-runtime.js','v155-runtime.js'):
    src=Path(__file__).resolve().parent/name
    if not src.exists(): raise SystemExit(name+' missing')
    (web/name).write_bytes(src.read_bytes())

# version
p=R/'pubspec.yaml'; s=p.read_text(); s=re.sub(r'^version:.*$','version: 1.5.6+56',s,flags=re.M); p.write_text(s)

# v152: only admin/super admin can create polls, and export poll UI for a visible button.
p=web/'v152-runtime.js'; s=p.read_text()
s=s.replace("const canCreatePoll=()=>!!currentGroup()&&(isAdmin()||!!currentGroup().allow_member_messaging);","const canCreatePoll=()=>!!currentGroup()&&isAdmin();")
marker="// Only Group Chat gets the + menu. Direct-chat attachment behavior stays unchanged."
if "window.EduPollUI={open:openPollComposer,load:loadPolls};" not in s:
    s=s.replace(marker,"window.EduPollUI={open:openPollComposer,load:loadPolls};\n\n"+marker,1)
p.write_text(s)

# v153: cached avatar must be painted on every newly-rendered img, not only the first DOM node for a path.
p=web/'v153-runtime.js'; s=p.read_text()
old="""const seen=new Set();
const refreshVisiblePhotos=()=>{
  const photos=window.EduPhotos,client=window.sb;if(!photos?.get||!client)return;
  document.querySelectorAll('img[data-photo][data-bucket]').forEach(img=>{
    const key=img.dataset.bucket+'|'+img.dataset.photo;if(seen.has(key))return;seen.add(key);
    Promise.resolve(photos.peek?.(img.dataset.bucket,img.dataset.photo)).then(hit=>{if(hit&&img.isConnected&&!img.src)img.src=hit});
  });
};"""
new="""const refreshVisiblePhotos=()=>{
  const photos=window.EduPhotos,client=window.sb;if(!photos?.get||!client)return;
  document.querySelectorAll('img[data-photo][data-bucket]').forEach(img=>{
    const key=img.dataset.bucket+'|'+img.dataset.photo;
    if(img.dataset.ecpCachePath===key&&img.src)return;
    img.dataset.ecpCachePath=key;
    Promise.resolve(photos.peek?.(img.dataset.bucket,img.dataset.photo)).then(hit=>{if(hit&&img.isConnected&&img.dataset.ecpCachePath===key)img.src=hit});
  });
};"""
if old in s: s=s.replace(old,new,1)
p.write_text(s)

# Patch actual Group Settings in all bundled source copies: single per-group combined toggle for Admin/Super Admin.
files=['index.html','app.js','app-web118.js','educhat-r4.js']
old_html="""<label class=\"switch\"><input id=\"allow-chat\" type=\"checkbox\" ${g.allow_member_messaging?'checked':''} ${isSuper()?'':'disabled'}><span>Allow member texting / files / voice</span></label><p class=\"hint\">Only Super Admin can change this. ON: members can send text/files/voice and start group calls. OFF: members can only read, download files, listen to voice messages and join active calls/meetings; only Admin/Super Admin can send, start group calls or create meetings.</p>"""
new_html="""${isAdmin()?`<div class=\"ecp156-group-permission\"><div><b>Member Permissions</b><p class=\"hint\">This setting applies only to this group.</p></div><label class=\"switch\"><input id=\"allow-chat\" type=\"checkbox\" ${g.allow_member_messaging&&g.allow_member_calls!==false?'checked':''}><span>Allow member messaging and calling</span></label><p class=\"hint\">ON: members can send text/files/voice and start group calls. OFF: members can only read messages, download Admin files, open links, vote in polls, and join Admin/Super Admin calls or meetings.</p></div>`:''}"""
old_handler="""U.q('#allow-chat')?.addEventListener('change',async e=>{if(!isSuper()){e.target.checked=g.allow_member_messaging;U.toast('Only Super Admin can change member texting.','error');return;}const {error}=await sb.from('groups').update({allow_member_messaging:e.target.checked}).eq('id',g.id);if(error){e.target.checked=!e.target.checked;U.toast(U.errorText(error),'error')}else{g.allow_member_messaging=e.target.checked;U.toast('Group messaging setting updated.','ok')}});"""
new_handler="""U.q('#allow-chat')?.addEventListener('change',async e=>{if(!isAdmin()){e.target.checked=!!g.allow_member_messaging&&g.allow_member_calls!==false;U.toast('Only Admin or Super Admin can change member permissions.','error');return;}const enabled=e.target.checked;const {data,error}=await sb.rpc('set_group_member_permissions',{group_input:g.id,messaging_enabled:enabled,calls_enabled:enabled});if(error){e.target.checked=!enabled;U.toast(U.errorText(error),'error')}else{g.allow_member_messaging=enabled;g.allow_member_calls=enabled;U.toast(enabled?'Member messaging and calling enabled for this group.':'Member messaging and calling disabled for this group.','ok')}});"""
for name in files:
    p=web/name; s=p.read_text()
    if old_html in s: s=s.replace(old_html,new_html)
    if old_handler in s: s=s.replace(old_handler,new_handler)
    p.write_text(s)

# Forum cache: render last feed immediately, then refresh in background.
p=web/'index.html'; s=p.read_text()
anchor="""  const panelsButton=document.createElement('button');panelsButton.className='ws-secondary ws-panels-toggle';"""
if "ecp-forum-cache:" not in s and anchor in s:
    inject="""  const forumCacheKey=`ecp-forum-cache:${S.user.id}`;try{const cached=JSON.parse(localStorage.getItem(forumCacheKey)||'null');if(cached?.posts?.length){posts=cached.posts;offset=posts.length;const cachedList=U.q('#forum-posts');cachedList.innerHTML=posts.map(postCard).join('');wirePosts(cachedList);W.photos(root,sb);W.files(cachedList,sb);}}catch{}\n"""
    s=s.replace(anchor,inject+anchor,1)
needle="""const list=U.q('#forum-posts');list.innerHTML=posts.length?posts.map(postCard).join(''):'<div class=\"ws-card ws-empty\">No discussions match this filter. Start a new post or change the search.</div>';wirePosts(list);W.photos(root,sb);W.files(list,sb);}"""
repl="""const list=U.q('#forum-posts');list.innerHTML=posts.length?posts.map(postCard).join(''):'<div class=\"ws-card ws-empty\">No discussions match this filter. Start a new post or change the search.</div>';wirePosts(list);W.photos(root,sb);W.files(list,sb);try{localStorage.setItem(forumCacheKey,JSON.stringify({posts:posts.slice(0,40),t:Date.now()}))}catch{}}"""
if needle in s: s=s.replace(needle,repl,1)
# remove top level loading flash if any
s=s.replace("box.innerHTML='<div class=\"loading\">Loading…</div>';","box.innerHTML='';")
p.write_text(s)

# Make message reactions optimistic in actual index source.
p=web/'index.html'; s=p.read_text()
old="""  async function react(id,emoji){const mine=reactions.find(r=>r.message_id===id&&r.user_id===myId);if(mine?.emoji===emoji)W.data(await sb.from('chat_reactions').delete().eq('kind',selected.kind).eq('message_id',id).eq('user_id',myId));else W.data(await sb.from('chat_reactions').upsert({kind:selected.kind,thread_id:selected.id,message_id:id,user_id:myId,emoji}));await loadMessages(false);}"""
new="""  async function react(id,emoji){const before=reactions.map(r=>({...r})),mine=reactions.find(r=>r.message_id===id&&r.user_id===myId);if(mine?.emoji===emoji)reactions=reactions.filter(r=>!(r.message_id===id&&r.user_id===myId));else{reactions=reactions.filter(r=>!(r.message_id===id&&r.user_id===myId));reactions.push({kind:selected.kind,thread_id:selected.id,message_id:id,user_id:myId,emoji});}paintMessages();try{if(mine?.emoji===emoji)W.data(await sb.from('chat_reactions').delete().eq('kind',selected.kind).eq('message_id',id).eq('user_id',myId));else W.data(await sb.from('chat_reactions').upsert({kind:selected.kind,thread_id:selected.id,message_id:id,user_id:myId,emoji}));saveMsgCache(selected);}catch(error){reactions=before;paintMessages();throw error;}}"""
if old in s: s=s.replace(old,new,1)
p.write_text(s)

# Final runtime is copied from repository root below.
src=Path(__file__).resolve().parent/'v156-runtime.js'
if not src.exists(): raise SystemExit('v156-runtime.js missing')
(web/'v156-runtime.js').write_bytes(src.read_bytes())

# Inject final runtime last.
p=web/'index.html'; s=p.read_text(); marker='<script src="v155-runtime.js"></script>'
if marker in s and '<script src="v156-runtime.js"></script>' not in s:s=s.replace(marker,marker+'<script src="v156-runtime.js"></script>',1)
p.write_text(s)

print('Applied EduChatPro v1.5.6 requested fixes to actual bundled source')
