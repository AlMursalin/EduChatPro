from pathlib import Path
import re
R=Path('.')
p=R/'assets/webapp/index.html'; s=p.read_text()
old="""<div class="ws-post-counts"><span>${Number(p.reactions)?'👍 ❤️ 🎉':''} ${p.reactions||0}</span><span class="spacer"></span><button data-comment="${p.id}">${p.comments||0} comments</button><span>${p.shares||0} shares</span></div>"""
new="""<div class="ws-post-counts"><button type="button" class="ws-reaction-count" data-reactors="${p.id}" ${Number(p.reactions)?'':'disabled'}>${Number(p.reactions)?'👍 ❤️ 🎉 ':''}${p.reactions||0} reactions</button><span class="spacer"></span><button data-comment="${p.id}">${p.comments||0} comments</button><span>${p.shares||0} shares</span></div>"""
if old not in s: raise SystemExit('post counts target missing')
s=s.replace(old,new,1)
marker="  function wirePosts(list){"
show=r'''  async function showReactors(postId){
   let result=await sb.from('forum_reactions').select('post_id,user_id,emoji,reaction,created_at').eq('post_id',postId).order('created_at',{ascending:false});
   if(result.error)result=await sb.from('forum_reactions').select('post_id,user_id,emoji,reaction').eq('post_id',postId);
   const rows=W.data(result)||[],people=await c.namesFor(rows.map(x=>x.user_id));
   const body=rows.length?`<div class="ws-fb-reactor-list">${rows.map(x=>{const person=people[x.user_id]||{full_name:'Member'};return `<div class="ws-fb-reactor-row">${W.avatar(person.full_name,person.avatar_path)}<b>${U.esc(person.full_name||'Member')}</b><span>${U.esc(x.emoji||({like:'👍',love:'❤️',celebrate:'🎉',laugh:'😂',pray:'🙏',wow:'😮'})[x.reaction]||'👍')}</span></div>`}).join('')}</div>`:'<p>No reactions yet.</p>';
   const modal=U.modal({title:`Reactions (${rows.length})`,body,wide:false});W.photos(modal,sb);
  }
'''
if marker not in s: raise SystemExit('wire marker missing')
s=s.replace(marker,show+marker,1)
oldwire="  function wirePosts(list){U.qa('[data-like]',list).forEach"
newwire="  function wirePosts(list){U.qa('[data-reactors]',list).forEach(b=>b.onclick=W.run(()=>showReactors(b.dataset.reactors)));U.qa('[data-like]',list).forEach"
if oldwire not in s: raise SystemExit('wire start missing')
s=s.replace(oldwire,newwire,1)
pat=re.compile(r"U\.qa\('\[data-show-reactors\]',box\)\.forEach\(b=>b\.onclick=\(\)=>\{const rows=rs\.map\(x=>\{.*?W\.photos\(modal,sb\);\}\);",re.S)
m=pat.search(s)
if m:s=s[:m.start()]+"U.qa('[data-show-reactors]',box).forEach(b=>b.onclick=W.run(()=>showReactors(b.dataset.showReactors)));"+s[m.end():]
pattern=r'(<div class="ws-social-preview" data-social-preview="\\${p\\.id}"></div>)(<footer>)'
replacement=r'''\\1<form class="ws-inline-comment" data-inline-comment="${p.id}"><input class="input" name="body" maxlength="4000" placeholder="Write a comment…" aria-label="Write a comment"><button type="submit" class="ws-inline-comment-send">Post</button></form>\\2'''
s,n=re.subn(pattern,replacement,s,count=1)
if n!=1: raise SystemExit('inline comment target missing')
oldend="U.qa('[data-post-menu]',list).forEach(b=>b.onclick=()=>postMenu(posts.find(p=>p.id===b.dataset.postMenu)));}"
newend="U.qa('[data-inline-comment]',list).forEach(form=>form.onsubmit=W.run(async e=>{e.preventDefault();const input=U.q('input[name=\"body\"]',form),body=input?.value.trim();if(!body)return;const btn=U.q('button[type=\"submit\"]',form);if(btn)btn.disabled=true;try{W.data(await sb.from('forum_comments').insert({post_id:form.dataset.inlineComment,author_id:S.user.id,body}));input.value='';await load();}finally{if(btn)btn.disabled=false;}}));U.qa('[data-post-menu]',list).forEach(b=>b.onclick=()=>postMenu(posts.find(p=>p.id===b.dataset.postMenu)));}"
if oldend not in s: raise SystemExit('wire end missing')
s=s.replace(oldend,newend,1)
style_marker=".ws-social-preview:empty{display:none}.ws-social-preview{padding:0 0 10px}"
style_add=".ws-social-preview:empty{display:none}.ws-social-preview{padding:0 0 10px}.ws-reaction-count{border:0;background:none;color:var(--ws-muted);padding:0;font:inherit;cursor:pointer}.ws-reaction-count:disabled{cursor:default}.ws-inline-comment{display:flex;gap:8px;align-items:center;padding:8px 0 2px}.ws-inline-comment .input{flex:1;border-radius:999px;padding:10px 14px}.ws-inline-comment-send{border:0;border-radius:999px;padding:9px 14px;background:var(--ws-blue);color:#fff;font-weight:700}.ws-fb-reactor-list{display:grid;gap:8px}.ws-fb-reactor-row{display:flex;align-items:center;gap:10px;padding:8px 2px;border-bottom:1px solid var(--ws-line)}.ws-fb-reactor-row .ws-avatar{width:36px;height:36px}.ws-fb-reactor-row b{flex:1}"
if style_marker in s:s=s.replace(style_marker,style_add,1)
p.write_text(s)

p=R/'assets/webapp/native-mobile-patch.js';s=p.read_text()
s=s.replace("const openDialog=qa('dialog[open]').at(-1);","const dialogs=qa('dialog[open]');const openDialog=dialogs.length?dialogs[dialogs.length-1]:null;",1)
safe=r'''
// v1.2.7: never let an Android Back exception fall through to app exit.
window.EduMobileBackSafe=()=>{
  try{return !!(window.EduMobileBack&&window.EduMobileBack());}catch(error){
    console.warn('EduMobileBack fallback',error);
    try{
      const root=document.querySelector('#page');
      const current=root?.dataset?.page||((typeof S!=='undefined'&&S.page)||'');
      const nav=window.__ECP_NAV||(window.__ECP_NAV={stack:[],ready:true,suppress:false});
      const go=target=>{if(!target||target===current||typeof window.navigate!=='function')return false;nav.suppress=true;window.navigate(target);return true;};
      if(current==='notifications'||current==='saved')return go('chats');
      if(['chats','groups','people'].includes(current))return go('forum');
      if(current==='forum')return false;
      while(nav.stack?.length){const target=nav.stack.pop();if(target&&target!==current&&go(target))return true;}
      if(current)return go('forum');
    }catch(inner){console.warn('EduMobileBack hard fallback',inner);}
    return false;
  }
};
'''
if 'EduMobileBackSafe' not in s:s=s.rstrip()+"\n"+safe+"\n"
p.write_text(s)

p=R/'android/app/src/main/kotlin/com/nextechdigitalacademy/educhat_pro/WebWorkspace.kt';s=p.read_text()
old='web.evaluateJavascript("(function(){try{return !!(window.EduMobileBack&&window.EduMobileBack());}catch(e){return false;}})()") { value ->'
new='web.evaluateJavascript("(function(){try{if(window.EduMobileBackSafe)return !!window.EduMobileBackSafe();return !!(window.EduMobileBack&&window.EduMobileBack());}catch(e){try{var r=document.querySelector(\\\"#page\\\");var p=(r&&r.dataset&&r.dataset.page)||\\\"\\\";if((p===\\\"notifications\\\"||p===\\\"saved\\\")&&window.navigate){window.navigate(\\\"chats\\\");return true;}if((p===\\\"chats\\\"||p===\\\"groups\\\"||p===\\\"people\\\")&&window.navigate){window.navigate(\\\"forum\\\");return true;}if(p&&p!==\\\"forum\\\"&&window.navigate){window.navigate(\\\"forum\\\");return true;}}catch(_e){}return false;}})()") { value ->'
if old not in s: raise SystemExit('native back bridge target missing')
s=s.replace(old,new,1);p.write_text(s)

p=R/'pubspec.yaml';s=re.sub(r'^version:.*$','version: 1.2.7+26',p.read_text(),flags=re.M);p.write_text(s)
print('Applied EduChatPro v1.2.7')
