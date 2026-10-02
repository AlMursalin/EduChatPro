from pathlib import Path
import re
R=Path('.')

p=R/'pubspec.yaml'
s=p.read_text()
s=re.sub(r'^version:.*$', 'version: 1.3.4+33', s, flags=re.M)
p.write_text(s)

p=R/'assets/webapp/index.html'
s=p.read_text()

# Remove the late duplicate runtime/photo layer. The app already has a persistent CacheStorage photo system in the main bundle.
s=s.replace('<script src="v131-photos.js"></script><script src="v131-runtime.js"></script>','')

# Make workspace avatars use the main EduPhotos.get() directly. No late-loaded peek() dependency.
old="W.avatar=(name,path=null,bucket='avatars',extra='')=>{let uid='';try{uid=typeof S!=='undefined'&&S&&S.user?S.user.id:''}catch{}const cached=path&&uid?window.EduPhotos.peek(uid,bucket,path):'';return `<span class=\"ws-avatar ${extra}\">${path?`<img alt=\"${window.EduUI.attr(name||'Profile')}\" data-photo=\"${window.EduUI.attr(path)}\" data-bucket=\"${bucket}\" ${cached?`src=\"${window.EduUI.attr(cached)}\"`:''} decoding=\"async\">`:window.EduUI.esc((name||'?').trim().slice(0,1).toUpperCase())}</span>`};"
new="W.avatar=(name,path=null,bucket='avatars',extra='')=>`<span class=\"ws-avatar ${extra}\">${path?`<img alt=\"${window.EduUI.attr(name||'Profile')}\" data-photo=\"${window.EduUI.attr(path)}\" data-bucket=\"${bucket}\" decoding=\"async\">`:window.EduUI.esc((name||'?').trim().slice(0,1).toUpperCase())}</span>`;"
if old in s: s=s.replace(old,new,1)

old="W.photos=async(root,sb)=>{let user='';try{user=typeof S!=='undefined'&&S&&S.user?S.user.id:''}catch{}if(!user)return;await Promise.all([...root.querySelectorAll('[data-photo]')].map(async img=>{try{if(!img.getAttribute('src')){const hit=window.EduPhotos.peek(user,img.dataset.bucket,img.dataset.photo);if(hit)img.src=hit;}const url=await window.EduPhotos.get(sb,user,img.dataset.bucket,img.dataset.photo);if(img.isConnected&&img.src!==url)img.src=url;}catch{}}));};"
new="W.photos=async(root,sb)=>{let user='';try{user=typeof S!=='undefined'&&S&&S.user?S.user.id:''}catch{}if(!user)return;await Promise.all([...root.querySelectorAll('[data-photo]')].map(async img=>{try{const path=img.dataset.photo;if(!path)return;if(/^https?:|^data:|^blob:/.test(path)){if(img.isConnected)img.src=path;return;}const url=await window.EduPhotos.get(sb,user,img.dataset.bucket||'avatars',path);if(img.isConnected&&img.src!==url)img.src=url;}catch(e){console.warn('Photo load failed',img.dataset.photo,e?.message||e);}}));};"
if old in s: s=s.replace(old,new,1)

# Chat page must not crash when call buttons are intentionally hidden for student group members.
s=s.replace("U.q('#chat-video').onclick=run(()=>call(false));U.q('#chat-audio').onclick=run(()=>call(true));",
            "U.q('#chat-video')?.addEventListener('click',run(()=>call(false)));U.q('#chat-audio')?.addEventListener('click',run(()=>call(true)));",1)

# Facebook-like mobile comments: clean header, fixed list, sticky composer; remove duplicate footer actions.
s=s.replace("r.classList.add('ecp132-comments-sheet');const input=U.q('#comment-body',r)",
            "r.classList.add('ecp132-comments-sheet');const h=U.q('h2',r);if(h&&!U.q('.ecp132-comment-close',h)){const x=document.createElement('button');x.type='button';x.className='ecp132-comment-close';x.setAttribute('aria-label','Close comments');x.textContent='×';x.onclick=U.closeModal;h.append(x);}const input=U.q('#comment-body',r)",1)

css='''<style id="ecp-v134-fixes">
.ecp132-comments-sheet{padding:0!important;overflow:hidden!important;display:flex!important;flex-direction:column!important;background:var(--ws-bg,#fff)!important}
.ecp132-comments-sheet>h2{position:relative!important;display:flex!important;align-items:center!important;justify-content:center!important;min-height:52px!important;margin:0!important;padding:0 52px!important;border-bottom:1px solid var(--ws-line,#e5e7eb)!important;font-size:16px!important}
.ecp132-comment-close{position:absolute;right:12px;top:9px;width:34px;height:34px;border:0;border-radius:50%;background:var(--ws-soft,#f0f2f5);color:inherit;font-size:25px;line-height:1;display:grid;place-items:center}
.ecp132-comments-sheet>.modal-body{display:flex!important;flex:1!important;min-height:0!important;flex-direction:column!important;overflow:hidden!important;padding:0!important}
.ecp132-comments-sheet>.modal-actions{display:none!important}
.ecp132-comment-post{padding:10px 14px 8px;border-bottom:1px solid var(--ws-line,#e5e7eb)}
.ecp132-comment-post h3{margin:0 0 4px;font-size:14px}.ecp132-comment-post>div{font-size:13px;color:var(--ws-muted,#65676b)}
.ecp132-comments-list{flex:1!important;min-height:0!important;overflow-y:auto!important;padding:10px 12px 84px!important;overscroll-behavior:contain}
.ecp132-comment{display:grid!important;grid-template-columns:36px minmax(0,1fr)!important;gap:8px!important;margin:8px 0!important;padding-left:calc(var(--depth)*16px)!important;align-items:start!important}
.ecp132-comment .ws-avatar{width:36px!important;height:36px!important;border-radius:50%!important;overflow:hidden!important}.ecp132-comment .ws-avatar img{width:100%!important;height:100%!important;object-fit:cover!important}
.ecp132-bubble{display:inline-block!important;max-width:min(100%,520px)!important;background:var(--ws-soft,#f0f2f5)!important;border-radius:18px!important;padding:8px 11px!important}.ecp132-bubble b{display:block;font-size:12px;margin-bottom:2px}.ecp132-bubble p{margin:0!important;font-size:14px;line-height:1.35;white-space:pre-wrap;overflow-wrap:anywhere}
.ecp132-meta{display:flex!important;align-items:center!important;gap:10px!important;padding:3px 9px!important;color:var(--ws-muted,#65676b)!important;font-size:11px!important}.ecp132-meta .text-btn{font-weight:700!important}
.ecp132-comment-composer{position:absolute!important;left:0;right:0;bottom:0;z-index:5;background:var(--ws-bg,#fff)!important;border-top:1px solid var(--ws-line,#e5e7eb)!important;padding:8px 10px max(8px,env(safe-area-inset-bottom))!important;box-shadow:0 -4px 14px rgba(0,0,0,.04)}
.ecp132-comment-composer #reply-to{margin:0 4px 6px!important;font-size:11px;color:var(--ws-muted,#65676b)}
.ecp132-compose-row{display:grid!important;grid-template-columns:34px minmax(0,1fr) 34px 36px!important;gap:6px!important;align-items:end!important}
.ecp132-compose-row textarea{width:100%!important;min-height:40px!important;max-height:110px!important;border-radius:20px!important;padding:9px 12px!important;line-height:20px!important;background:var(--ws-soft,#f0f2f5)!important;border:1px solid transparent!important;outline:0!important}
.ecp132-media,.ecp132-send{width:34px!important;height:34px!important;border:0!important;border-radius:50%!important;display:grid!important;place-items:center!important;font-size:18px!important}.ecp132-media{background:var(--ws-soft,#f0f2f5)!important}.ecp132-send{background:#1877f2!important;color:#fff!important}
@media(max-width:700px){.modal-backdrop{align-items:flex-end!important;padding:0!important}.ecp132-comments-sheet{position:relative!important;width:100%!important;max-width:none!important;height:92dvh!important;border-radius:18px 18px 0 0!important}}
</style>'''
if 'ecp-v134-fixes' not in s: s=s.replace('<script src="native-mobile-patch.js"></script>',css+'<script src="native-mobile-patch.js"></script>',1)

p.write_text(s)
print('Applied v1.3.4 avatar, chat-open and comment UI fixes')