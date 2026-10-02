from pathlib import Path
import re
R=Path('.')

p=R/'pubspec.yaml'
s=p.read_text()
s=re.sub(r'^version:.*$', 'version: 1.3.5+34', s, flags=re.M)
p.write_text(s)

safe = r'''<script id="ecp-v135-cache-helpers">
(function(){
  function uid(){try{return (typeof S!=='undefined'&&S&&S.user&&S.user.id)?S.user.id:'guest'}catch(e){return 'guest'}}
  window.ecp132Key=function(kind,id){return 'ecp132:'+uid()+':'+kind+':'+(id||'main')};
  window.ecp132Read=function(kind,id,maxAge){try{var x=JSON.parse(localStorage.getItem(window.ecp132Key(kind,id))||'null');var age=maxAge||604800000;return x&&Date.now()-Number(x.t||0)<age?x:null}catch(e){return null}};
  window.ecp132Write=function(kind,id,data){try{localStorage.setItem(window.ecp132Key(kind,id),JSON.stringify(Object.assign({t:Date.now()},data||{})))}catch(e){}};
  window.ecp132Typing=function(id,label){label=label||'Typing…';return '<div id="'+id+'" class="ecp132-typing" hidden><span><i></i><i></i><i></i></span><b>'+label+'</b></div>';};
  window.ecp132SafeReady=true;
})();
var ecp132Key=window.ecp132Key, ecp132Read=window.ecp132Read, ecp132Write=window.ecp132Write, ecp132Typing=window.ecp132Typing;
</script>'''

p=R/'assets/webapp/index.html'
s=p.read_text()
if 'ecp-v135-cache-helpers' not in s:
    if '</head>' in s:
        s=s.replace('</head>',safe+'\n</head>',1)
    else:
        s=safe+'\n'+s

# Ensure any direct cache call can never prevent Chat/Home from opening.
s=s.replace("const cachedInbox=ecp132Read('inbox','main');", "const cachedInbox=(typeof ecp132Read==='function'?ecp132Read('inbox','main'):null);")
s=s.replace("const cachedThread=ecp132Read('thread',item.kind+':'+item.id);", "const cachedThread=(typeof ecp132Read==='function'?ecp132Read('thread',item.kind+':'+item.id):null);")
s=s.replace("ecp132Write('inbox','main',{html:list.innerHTML});", "if(typeof ecp132Write==='function')ecp132Write('inbox','main',{html:list.innerHTML});")
s=s.replace("ecp132Write('thread',selected.kind+':'+selected.id,{html:box.innerHTML.slice(-260000)});", "if(typeof ecp132Write==='function')ecp132Write('thread',selected.kind+':'+selected.id,{html:box.innerHTML.slice(-260000)});")

# Harden photo rendering: if one photo fails, render keeps going and initials remain visible.
s=s.replace("<span class=\"ws-avatar ${extra}\">${path?`<img alt=\"${window.EduUI.attr(name||'Profile')}\" data-photo=\"${window.EduUI.attr(path)}\" data-bucket=\"${bucket}\" decoding=\"async\">`:window.EduUI.esc((name||'?').trim().slice(0,1).toUpperCase())}</span>`;",
            "<span class=\"ws-avatar ${extra}\"><span class=\"ws-avatar-fallback\">${window.EduUI.esc((name||'?').trim().slice(0,1).toUpperCase())}</span>${path?`<img alt=\"${window.EduUI.attr(name||'Profile')}\" data-photo=\"${window.EduUI.attr(path)}\" data-bucket=\"${bucket}\" decoding=\"async\" onload=\"this.previousElementSibling.style.display='none'\" onerror=\"this.remove()\">`:''}</span>`;")

css=r'''<style id="ecp-v135-fixes">
.ws-avatar{position:relative;display:grid;place-items:center;overflow:hidden}.ws-avatar-fallback{position:absolute;inset:0;display:grid;place-items:center;font-weight:700}.ws-avatar img{position:relative;z-index:1;width:100%;height:100%;object-fit:cover}
#page[data-page="chats"] .loading{min-height:120px;display:grid;place-items:center}
.ecp132-comments-sheet .ecp132-comment-post{flex:0 0 auto}.ecp132-comments-sheet #comments-more{margin:4px 12px 8px}.ecp132-comments-sheet .ecp132-comments-list{background:var(--ws-bg,#fff)}
</style>'''
if 'ecp-v135-fixes' not in s:
    s=s.replace('<script src="native-mobile-patch.js"></script>',css+'<script src="native-mobile-patch.js"></script>',1)
p.write_text(s)

print('Applied v1.3.5 global cache helpers and chat-open safety')