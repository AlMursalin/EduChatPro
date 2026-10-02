from pathlib import Path
import re
R=Path('.')
p=R/'pubspec.yaml'
s=p.read_text()
s=re.sub(r'^version:.*$', 'version: 1.3.0+29', s, flags=re.M)
p.write_text(s)

for name in ['assets/webapp/index.html','assets/webapp/app-web118.js','assets/webapp/app.js','assets/webapp/educhat-r4.js']:
    p=R/name
    if not p.exists(): continue
    s=p.read_text()
    s=s.replace("item.kind==='direct'||item.allow_member_messaging||item.created_by===myId||c.can('groups.manage')",
                "item.kind==='direct'||item.allow_member_messaging||c.isAdmin()")
    old="${W.button('search','Search messages','id=\"message-search-toggle\"')}${W.button('video','Start video call','id=\"chat-video\"')}${W.button('phone','Start audio call','id=\"chat-audio\"')}"
    new="${W.button('search','Search messages','id=\"message-search-toggle\"')}${W.button('video','Start video call','id=\"chat-video\"')}${W.button('phone','Start audio call','id=\"chat-audio\"')}"
    s=s.replace(old,new)
    s=s.replace("!g.allow_member_messaging&&!can('groups.manage')&&g.created_by!==S.user.id","!g.allow_member_messaging&&!isAdmin()")
    s=s.replace("!g.allow_member_messaging&&!isAdmin()&&g.created_by!==S.user.id","!g.allow_member_messaging&&!isAdmin()")
    s=s.replace("can('files.manage')||g.allow_member_messaging||g.created_by===S.user.id","isAdmin()||g.allow_member_messaging")
    s=s.replace("if(!g.allow_member_messaging&&!isAdmin())throw new Error('Messaging is closed in this group.');",
                "if(!g.allow_member_messaging&&!isAdmin())throw new Error('Only Admin or Super Admin can post while member texting is off.');")
    s=s.replace("const box=group?U.q('#group-body'):U.q('#page'),allowed=can('meetings.create')||group?.created_by===S.user.id;",
                "const box=group?U.q('#group-body'):U.q('#page'),allowed=group?isAdmin():can('meetings.create');")
    s=s.replace("startCall:async(item,audio)=>{S.group=item.kind==='group'?item:null;S.direct=item.kind==='direct'?item.peer_id:null;let m;if(item.kind==='direct'){",
                "startCall:async(item,audio)=>{if(item.kind==='group'&&!item.allow_member_messaging&&!isAdmin())throw new Error('Group calling is disabled for members.');S.group=item.kind==='group'?item:null;S.direct=item.kind==='direct'?item.peer_id:null;let m;if(item.kind==='direct'){")
    s=s.replace("${can('groups.manage')||g.created_by===S.user.id?'':'disabled'}><span>Allow members to chat and upload permitted files</span>",
                "${isSuper()?'':'disabled'}><span>Allow member texting / files / voice</span>")
    s=s.replace("<p class=\"hint\">When off, regular members can read existing content but cannot send messages or upload files.</p>",
                "<p class=\"hint\">Only Super Admin can change this. ON: members can send text/files/voice and start group calls. OFF: members can only read, download files, listen to voice messages and join active calls/meetings; only Admin/Super Admin can send, start group calls or create meetings.</p>")
    s=s.replace("U.q('#allow-chat')?.addEventListener('change',async e=>{const {error}=await sb.from('groups').update({allow_member_messaging:e.target.checked}).eq('id',g.id);",
                "U.q('#allow-chat')?.addEventListener('change',async e=>{if(!isSuper()){e.target.checked=g.allow_member_messaging;U.toast('Only Super Admin can change member texting.','error');return;}const {error}=await sb.from('groups').update({allow_member_messaging:e.target.checked}).eq('id',g.id);")
    p.write_text(s)
print('Applied v1.3.0 client group controls')
