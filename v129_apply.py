from pathlib import Path
import re

R=Path('.')

# Version
p=R/'pubspec.yaml'
s=p.read_text()
s=re.sub(r'^version:.*$', 'version: 1.2.9+28', s, flags=re.M)
p.write_text(s)

# Android 14+ MediaProjection permission + stronger WebView caching.
p=R/'android/app/src/main/AndroidManifest.xml'
s=p.read_text()
if 'android.permission.FOREGROUND_SERVICE_MEDIA_PROJECTION' not in s:
    s=s.replace(
        '<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />',
        '<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />\n<uses-permission android:name="android.permission.FOREGROUND_SERVICE_MEDIA_PROJECTION" />'
    )
p.write_text(s)

p=R/'android/app/src/main/kotlin/com/nextechdigitalacademy/educhat_pro/WebWorkspace.kt'
s=p.read_text()
# Preserve profile photos and other static web resources between app launches.
if 'WebSettings.LOAD_DEFAULT' not in s:
    s=s.replace(
        'javaScriptEnabled = true',
        'javaScriptEnabled = true\n      cacheMode = android.webkit.WebSettings.LOAD_DEFAULT\n      domStorageEnabled = true\n      databaseEnabled = true',
        1
    )
p.write_text(s)

# Final native mobile interaction layer.
p=R/'assets/webapp/native-mobile-patch.js'
s=p.read_text()
addon=r"""
// v1.2.9 final mobile UX contract.
(()=>{
  'use strict';
  if(!window.EduNative)return;
  const q=(sel,root=document)=>root.querySelector(sel);
  const qa=(sel,root=document)=>[...root.querySelectorAll(sel)];

  // Keep chat input focused after send; Android Back dismisses the IME first.
  const composer=()=>q('#message-input,#dm-text,#chat-input');
  const log=()=>q('#message-log,#dm-log,#chat-log,.ws-message-log,.chat-log');
  const settle=()=>{
    const i=composer();
    if(!i?.isConnected)return;
    try{i.focus({preventScroll:true})}catch{i.focus()}
    const l=log(); if(l)requestAnimationFrame(()=>{l.scrollTop=l.scrollHeight});
  };
  document.addEventListener('submit',e=>{
    if(!e.target?.matches?.('#ws-send,#dm-form,#chat-form'))return;
    for(const ms of [0,18,45,90])setTimeout(settle,ms);
  },true);
  document.addEventListener('pointerup',e=>{
    if(e.target.closest?.('#ws-send button[type="submit"],#dm-form button[type="submit"],#chat-form button[type="submit"],.ws-composer button[type="submit"],.composer button[type="submit"]')){
      setTimeout(settle,0);
    }
  },true);

  // Make keyboard viewport response immediate and keep newest message above keyboard.
  const vv=window.visualViewport;
  const updateViewport=()=>{
    if(!vv)return;
    document.documentElement.style.setProperty('--ecp-native-vh',vv.height+'px');
    document.documentElement.style.setProperty('--ecp-native-vtop',vv.offsetTop+'px');
    if(document.activeElement===composer()){
      const l=log(); if(l)requestAnimationFrame(()=>{l.scrollTop=l.scrollHeight});
    }
  };
  vv?.addEventListener('resize',updateViewport,{passive:true});
  vv?.addEventListener('scroll',updateViewport,{passive:true});
  updateViewport();

  // Exact Android Back contract:
  // keyboard -> current chat; conversation -> chat list;
  // alerts/saved/call -> chat; chat -> home/forum; home/forum -> exit.
  const prior=window.EduMobileBackSafe||window.EduMobileBack;
  window.EduMobileBack=()=>{
    try{
      const active=document.activeElement, input=composer();
      if(active&&input&&active===input){active.blur();return true;}

      const root=q('#page');
      const current=root?.dataset?.page||((typeof S!=='undefined'&&S.page)||'');

      // Let existing chat-detail/modal logic close the inner view first.
      if(q('dialog[open],.modal:not(.hidden)') ||
         root?.classList.contains('conversation-open') ||
         root?.classList.contains('direct-workspace') ||
         (root?.classList.contains('chat-workspace')&&q('#group-body',root))){
        if(typeof prior==='function'&&prior())return true;
      }

      const nav=window.__ECP_NAV||(window.__ECP_NAV={stack:[],ready:true,suppress:false});
      const go=target=>{
        if(!target||target===current||typeof window.navigate!=='function')return false;
        nav.suppress=true; window.navigate(target); return true;
      };

      if(current==='notifications'||current==='saved'||current==='meetings')return go('chats');
      if(current==='chats'||current==='groups'||current==='people')return go('forum');
      if(current==='forum')return false;

      // For other pages preserve actual reverse navigation where possible.
      while(nav.stack?.length){
        const target=nav.stack.pop();
        if(target&&target!==current&&go(target))return true;
      }
      if(current==='profile'||current==='admin')return go('forum');
      if(current)return go('forum');
      return false;
    }catch(err){
      console.warn('v1.2.9 back fallback',err);
      return false;
    }
  };
  window.EduMobileBackSafe=window.EduMobileBack;

  // Persistent photo behavior: decode asynchronously, rely on WebView HTTP cache/CacheStorage,
  // and only refresh when the URL/path changes in realtime.
  const tuneImages=(root=document)=>{
    qa('img',root).forEach(img=>{
      img.decoding='async';
      if(!img.hasAttribute('loading'))img.loading='lazy';
    });
  };
  tuneImages();
  new MutationObserver(muts=>{
    for(const m of muts)for(const n of m.addedNodes)if(n?.nodeType===1)tuneImages(n);
  }).observe(document.documentElement,{subtree:true,childList:true});

  // Messenger/Facebook-style typing animation hook for any existing typing status.
  const typingCss=document.createElement('style');
  typingCss.textContent=`
    .ecp-typing-dots,.typing-dots,.ws-typing-dots{display:inline-flex;align-items:center;gap:3px;height:18px}
    .ecp-typing-dots i,.typing-dots i,.ws-typing-dots i{width:5px;height:5px;border-radius:50%;background:currentColor;opacity:.35;animation:ecpTyping 1s infinite ease-in-out}
    .ecp-typing-dots i:nth-child(2),.typing-dots i:nth-child(2),.ws-typing-dots i:nth-child(2){animation-delay:.14s}
    .ecp-typing-dots i:nth-child(3),.typing-dots i:nth-child(3),.ws-typing-dots i:nth-child(3){animation-delay:.28s}
    @keyframes ecpTyping{0%,60%,100%{transform:translateY(0);opacity:.3}30%{transform:translateY(-4px);opacity:1}}
  `;
  document.head.appendChild(typingCss);
})();
"""
if 'v1.2.9 final mobile UX contract' not in s:
    s=s.rstrip()+"\n"+addon+"\n"
p.write_text(s)

# Facebook-style forum presentation: reaction list is one horizontal row per person,
# comments open as a mobile discussion sheet with replies and a sticky composer.
p=R/'assets/webapp/index.html'
s=p.read_text()
css=r"""<style id="ecp-v129-forum">
.ws-fb-reactor-list,.ws-react-list{display:block!important}
.ws-fb-reactor-row,.ws-react-row{display:grid!important;grid-template-columns:44px minmax(0,1fr) 34px!important;align-items:center!important;column-gap:11px!important;min-height:56px!important;padding:6px 2px!important;border-bottom:1px solid var(--ws-line)!important}
.ws-fb-reactor-row .ws-avatar,.ws-react-row .ws-avatar{grid-column:1!important;width:42px!important;height:42px!important;margin:0!important}
.ws-fb-reactor-row b,.ws-react-row b{grid-column:2!important;display:block!important;margin:0!important;align-self:center!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}
.ws-fb-reactor-row>span:last-child,.ws-react-row>span:last-child{grid-column:3!important;justify-self:center!important;font-size:20px!important}
.ws-comment{display:flex!important;align-items:flex-start!important;gap:8px!important;padding:5px 0!important;border:0!important}
.ws-comment>.ws-avatar{flex:0 0 36px!important;width:36px!important;height:36px!important;margin:0!important}
.ws-comment>div{min-width:0!important;max-width:calc(100% - 44px)!important}
.ws-comment>div>p{display:inline-block!important;margin:2px 0 3px!important;padding:8px 11px!important;border-radius:17px!important;background:var(--ws-soft)!important;white-space:pre-wrap!important;overflow-wrap:anywhere!important}
.ws-comment.reply{margin-left:38px!important;padding-left:0!important;border-left:0!important}
.ws-comment .text-btn{font-size:11px!important;font-weight:700!important;margin-right:8px!important}
.ws-comment-form{position:sticky!important;bottom:0!important;z-index:8!important;background:var(--ws-bg)!important;border-top:1px solid var(--ws-line)!important;padding:8px 0 max(8px,env(safe-area-inset-bottom))!important}
.ws-comment-form textarea{min-height:42px!important;max-height:110px!important;border-radius:21px!important;padding:10px 14px!important;resize:none!important}
.ws-inline-comment{display:flex!important;align-items:center!important;gap:8px!important}
.ws-inline-comment .input{min-height:40px!important}
.ws-post footer button,[data-comment],[data-like],[data-share],[data-save]{touch-action:manipulation}
@media(max-width:700px){
 dialog .modal-card,.modal .modal-card{max-height:92dvh!important}
 #ws-comments{padding-bottom:4px!important}
}
</style>"""
if 'ecp-v129-forum' not in s:
    s=s.replace('<script src="native-mobile-patch.js"></script>',css+'<script src="native-mobile-patch.js"></script>',1)
p.write_text(s)

# Make screen sharing permission path compatible with newer Android.
# The actual MediaProjection prompt still remains user-controlled.
p=R/'lib/features/meetings/meeting_room_page.dart'
s=p.read_text()
# Prevent rapid double taps from racing the permission/session transition.
if 'bool screenShareTransition=false;' not in s:
    anchor='bool controlsExpanded=false;'
    if anchor in s:
        s=s.replace(anchor,anchor+'\n  bool screenShareTransition=false;',1)
# Wrap the More-panel screen-share action with a guard when the v1.2.6 control exists.
old="callControl(Icons.desktop_windows_outlined,backend.screenEnabled?'Stop share':'Share',busy?null:()=>_run(toggleScreen),active:backend.screenEnabled)"
new="callControl(Icons.desktop_windows_outlined,backend.screenEnabled?'Stop share':'Share',(busy||screenShareTransition)?null:()=>_run(() async {screenShareTransition=true;if(mounted)setState((){});try{await toggleScreen();}finally{screenShareTransition=false;if(mounted)setState((){});}}),active:backend.screenEnabled)"
if old in s:
    s=s.replace(old,new,1)
p.write_text(s)

print('Applied EduChatPro v1.2.9 UX/navigation/forum/screen-share patch')
