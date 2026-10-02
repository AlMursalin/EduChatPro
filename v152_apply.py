from pathlib import Path
import re

R=Path('.')
web=R/'assets/webapp'

# This patch is intentionally based on the v1.5.0 output and changes only:
# 1) group Poll attachment/permission UI
# 2) Android Back destinations / call return behavior
p=R/'pubspec.yaml'
s=p.read_text()
s=re.sub(r'^version:.*$','version: 1.5.2+52',s,flags=re.M)
p.write_text(s)

# Bundle the final targeted runtime.
src=Path(__file__).resolve().parent/'v152-runtime.js'
if not src.exists(): raise SystemExit('v152-runtime.js missing')
(web/'v152-runtime.js').write_bytes(src.read_bytes())

# Disable the old v1.5.0 standalone Poll panel so Poll is only exposed through the Group attachment (+) menu.
p=web/'v150-runtime.js'
s=p.read_text()
old1="    restoreThreadList();cacheThreadList();bindTyping();installGroupToggle();loadPolls();enhanceComments();"
new1="    restoreThreadList();cacheThreadList();bindTyping();installGroupToggle();enhanceComments();"
old2="setTimeout(()=>{restoreThreadList();bindTyping();installGroupToggle();loadPolls();enhanceComments()},0);"
new2="setTimeout(()=>{restoreThreadList();bindTyping();installGroupToggle();enhanceComments()},0);"
if old1 not in s or old2 not in s:
    raise SystemExit('v1.5.0 poll bootstrap markers missing')
s=s.replace(old1,new1,1).replace(old2,new2,1)
p.write_text(s)

p=web/'index.html'
s=p.read_text()

# Load v1.5.2 after the complete v1.5.0 runtime so the final Back contract wins.
marker='<script src="v150-runtime.js"></script>'
if marker not in s: raise SystemExit('v150 runtime marker missing')
if '<script src="v152-runtime.js"></script>' not in s:
    s=s.replace(marker,marker+'<script src="v152-runtime.js"></script>',1)

# When a native call/meeting is launched from a conversation, move the underlying page to Chat List.
# After the native call screen closes, Android therefore lands on Chat List instead of exiting or returning to the conversation.
old="""async function openMeeting(m,opts={}){

  if(m.ended_at){U.toast('This meeting has ended.','error');return}

  if(m.starts_at&&Date.parse(m.starts_at)>Date.now()){U.toast('This meeting starts '+U.fmtDate(m.starts_at),'error');return}

  await window.EduNative.call('meeting',{id:m.id,autoJoin:!!opts.autoJoin,video:!!opts.video});

}"""
new="""async function openMeeting(m,opts={}){

  if(m.ended_at){U.toast('This meeting has ended.','error');return}

  if(m.starts_at&&Date.parse(m.starts_at)>Date.now()){U.toast('This meeting starts '+U.fmtDate(m.starts_at),'error');return}

  const returnToChats=!!(S.group||S.direct);

  await window.EduNative.call('meeting',{id:m.id,autoJoin:!!opts.autoJoin,video:!!opts.video});

  if(returnToChats&&typeof navigate==='function')navigate('chats');

}"""
if old not in s: raise SystemExit('openMeeting v1.5.0 target missing')
s=s.replace(old,new,1)

p.write_text(s)
print('Applied EduChatPro v1.5.2 targeted Poll + Android Back patch on v1.5.0 base')
