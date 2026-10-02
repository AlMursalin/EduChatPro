(()=>{
'use strict';
if(window.__ECP_V150_RUNTIME)return;window.__ECP_V150_RUNTIME=true;
const q=(s,r=document)=>r.querySelector(s),qa=(s,r=document)=>[...r.querySelectorAll(s)];
const Sx=()=>{try{return typeof S!=='undefined'?S:null}catch{return null}};
const role=()=>String(Sx()?.role||'');
const admin=()=>['super_admin','assistant_admin','admin'].includes(role());
const superAdmin=()=>role()==='super_admin';
const toast=(m,t='error')=>window.EduUI?.toast?.(m,t);
const esc=s=>window.EduUI?.esc?window.EduUI.esc(String(s??'')):String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

// Final URL renderer: http, https and www. Internal links stay in-app where possible.
if(window.EduWorkspace){
  window.EduWorkspace.rich=value=>esc(value||'')
   .replace(/\*\*([^]+?)\*\*/g,'<strong>$1</strong>')
   .replace(/==([^]+?)==/g,'<mark>$1</mark>')
   .replace(/((?:https?:\/\/|www\.)[^\s<]+)/gi,m=>{
     const href=/^www\./i.test(m)?'https://'+m:m;
     return '<a class="ecp-v150-link" href="'+href+'" target="_blank" rel="noopener noreferrer">'+m+'</a>';
   });
}
document.addEventListener('click',e=>{
  const a=e.target.closest?.('a.ecp-v150-link,a.ws-link');if(!a)return;
  let u;try{u=new URL(a.href,location.href)}catch{return}
  const base=(window.EDUCHAT_CONFIG&&window.EDUCHAT_CONFIG.PUBLIC_WEB_URL)||'';
  let internal=false;try{internal=base&&u.origin===new URL(base).origin}catch{}
  if(internal){
    const page=u.searchParams.get('page');
    const post=u.searchParams.get('post');
    if(page&&typeof window.navigate==='function'){e.preventDefault();window.navigate(page);return}
    if(post&&window.EduWorkspace){e.preventDefault();window.EduWorkspace.pendingPost=post;window.navigate?.('forum');return}
  }
},true);

// True Android back history. This loads AFTER native-mobile-patch.js so old fallbacks cannot overwrite it.
window.EduMobileBack=()=>{
  try{
    const active=document.activeElement;
    if(active&&/^(INPUT|TEXTAREA)$/.test(active.tagName)){active.blur();return true}
    const modal=q('#modal-root .modal-backdrop,dialog[open]');
    if(modal){window.EduUI?.closeModal?.();if(modal.tagName==='DIALOG'&&modal.open)modal.close();return true}
    const root=q('#page'),page=root?.dataset?.page||Sx()?.page||'';
    if(root?.classList.contains('conversation-open')){
      q('#back-chats')?.click();return true;
    }
    const nav=window.__ECP_NAV||(window.__ECP_NAV={stack:[]});
    while(nav.stack?.length){
      const prev=nav.stack.pop();
      if(prev&&prev!==page&&typeof window.navigate==='function'){nav.suppress=true;window.navigate(prev);return true}
    }
    if(page&&page!=='forum'&&typeof window.navigate==='function'){nav.suppress=true;window.navigate('forum');return true}
    return false;
  }catch(e){console.warn('ECP back',e);return false}
};
window.EduMobileBackSafe=window.EduMobileBack;

// Cache the visible inbox immediately; background RPC remains free to refresh it.
function cacheThreadList(){
  const list=q('#thread-list'),user=Sx()?.user?.id;if(!list||!user||!list.children.length)return;
  try{
    const clone=list.cloneNode(true);
    qa('img[data-photo],img[data-group-photo]',clone).forEach(img=>{
      const bucket=img.dataset.bucket||(img.dataset.groupPhoto?'group-images':'avatars');
      const path=img.dataset.photo||img.dataset.groupPhoto;
      const thumb=window.EduPhotos?.peekSync?.(bucket,path)||'';
      if(thumb)img.setAttribute('src',thumb);else img.removeAttribute('src');
    });
    localStorage.setItem('ecp-v150-thread-html:'+user,clone.innerHTML);
  }catch{}
}
function restoreThreadList(){
  const list=q('#thread-list'),user=Sx()?.user?.id;if(!list||!user||list.children.length)return;
  try{
    const html=localStorage.getItem('ecp-v150-thread-html:'+user);
    if(html){list.innerHTML=html;list.dataset.ecpCached='1';window.EduWorkspace?.photos?.(list,window.sb);window.hydrateAvatars?.(list);window.hydrateGroupImages?.(list);}
  }catch{}
}
function cacheForumFeed(){
  const list=q('#forum-posts'),user=Sx()?.user?.id;if(!list||!user||!list.children.length)return;
  try{
    const clone=list.cloneNode(true);
    qa('img[data-photo]',clone).forEach(img=>{
      const thumb=window.EduPhotos?.peekSync?.(img.dataset.bucket||'avatars',img.dataset.photo)||'';
      if(thumb)img.setAttribute('src',thumb);else img.removeAttribute('src');
    });
    localStorage.setItem('ecp-v151-forum-html:'+user,clone.innerHTML);
  }catch{}
}
function restoreForumFeed(){
  const list=q('#forum-posts'),user=Sx()?.user?.id;if(!list||!user||list.children.length)return;
  try{
    const html=localStorage.getItem('ecp-v151-forum-html:'+user);
    if(html){list.innerHTML=html;list.dataset.ecpCached='1';window.EduWorkspace?.photos?.(list,window.sb);}
  }catch{}
}

document.addEventListener('click',e=>{
  const b=e.target.closest?.('#thread-list[data-ecp-cached="1"] [data-thread]');
  if(!b)return;
  const kind=b.dataset.kind,id=b.dataset.thread;if(!kind||!id)return;
  window.EduWorkspace.pending={kind,id};window.navigate?.('chats');
},true);

// Messenger-style typing indicator on the ACTUAL workspace composer.
let typingChannel=null,typingKey='',typingTimer=null;
async function bindTyping(){
  const input=q('#message-input'),st=Sx();if(!input||!st?.user||typeof sb==='undefined'||input.dataset.ecpTyping)return;
  const kind=st.group?.id?'group':st.direct?'direct':null;if(!kind)return;
  const id=kind==='group'?st.group.id:[st.user.id,st.direct].sort().join('-');
  const key=kind+':'+id;input.dataset.ecpTyping='1';
  if(key!==typingKey){
    typingKey=key;if(typingChannel)try{await sb.removeChannel(typingChannel)}catch{}
    typingChannel=sb.channel('typing-'+key,{config:{broadcast:{self:false}}})
      .on('broadcast',{event:'typing'},({payload})=>{
        if(payload?.user_id===st.user.id)return;
        let el=q('#ecp-typing');
        if(!el){el=document.createElement('div');el.id='ecp-typing';el.className='ecp-typing';q('#ws-send')?.before(el)}
        el.innerHTML='<span><i></i><i></i><i></i></span> '+esc(payload?.name||'Someone')+' is typing…';
        el.hidden=!payload?.typing;clearTimeout(el._hide);if(payload?.typing)el._hide=setTimeout(()=>el.hidden=true,1700);
      }).subscribe();
  }
  const send=v=>typingChannel?.send({type:'broadcast',event:'typing',payload:{user_id:st.user.id,name:st.profile?.full_name||'Member',typing:v}});
  input.addEventListener('input',()=>{send(true);clearTimeout(typingTimer);typingTimer=setTimeout(()=>send(false),800)});
  input.addEventListener('blur',()=>send(false));
}

// Instant visual send on ACTUAL #ws-send; server source later reconciles it.
document.addEventListener('submit',e=>{
  if(!e.target?.matches?.('#ws-send'))return;
  const input=q('#message-input'),text=input?.value?.trim(),box=q('#message-content'),st=Sx();
  if(!text||!box)return;
  if(st?.group&&!st.group.allow_member_messaging&&!admin()){
    e.preventDefault();e.stopImmediatePropagation();toast('Texting or calling is not allowed in this group.');return;
  }
  const row=document.createElement('article');row.className='ws-message mine ecp-v150-pending';
  row.innerHTML='<div class="ws-message-stack"><div class="ws-bubble"><div class="ws-message-body">'+esc(text)+'</div><div class="ws-message-stamp"><time>Sending…</time></div></div></div>';
  box.append(row);requestAnimationFrame(()=>{const log=q('#message-log');if(log)log.scrollTop=log.scrollHeight});
  setTimeout(()=>row.remove(),6000);
  for(const ms of [0,25,70,140])setTimeout(()=>{try{input?.focus({preventScroll:true})}catch{input?.focus()}},ms);
},true);

// Group restriction reminder while keeping read/download/join/poll voting available.
document.addEventListener('click',e=>{
  const st=Sx();if(!st?.group||st.group.allow_member_messaging||admin())return;
  const blocked=e.target.closest?.('#chat-video,#chat-audio,#attach-file,#voice-record,#ws-send button[type="submit"]');
  if(!blocked)return;
  e.preventDefault();e.stopImmediatePropagation();toast('Texting or calling is not allowed in this group.');
},true);

// Visible per-group Super Admin control in the active conversation.
function installGroupToggle(){
  const st=Sx(),g=st?.group,conv=q('.ws-conversation');if(!g?.id||!conv)return;
  let bar=q('#ecp-v150-group-control',conv);
  if(!bar){bar=document.createElement('div');bar.id='ecp-v150-group-control';bar.className='ecp-group-control';const form=q('#ws-send',conv);form?.before(bar)}
  const on=!!g.allow_member_messaging;
  if(superAdmin()){
    bar.innerHTML='<div><b>Member Texting & Calling</b><small>'+(on?'Members can send and start group calls':'Members can only read, download, vote and join Admin calls')+'</small></div><label class="ecp-switch"><input type="checkbox" '+(on?'checked':'')+'><i></i></label>';
    const cb=q('input',bar);cb.onchange=async()=>{
      cb.disabled=true;const next=cb.checked;
      const r=await sb.from('groups').update({allow_member_messaging:next}).eq('id',g.id);
      cb.disabled=false;
      if(r.error){cb.checked=!next;toast(r.error.message);return}
      g.allow_member_messaging=next;toast(next?'Member texting and calling enabled.':'Member texting and calling disabled.','ok');
      installGroupToggle();
    };
  }else{
    bar.innerHTML='<div><b>'+(on?'Member messaging & calls are ON':'Member messaging & calls are OFF')+'</b><small>'+(on?'You can text and start group calls.':'You can read, download, vote and join Admin calls.')+'</small></div>';
  }
}

// Polls live INSIDE the active workspace group conversation.
let pollChannel=null,pollGroup='',pollLoading=false;
async function loadPolls(){
  const st=Sx(),g=st?.group,conv=q('.ws-conversation');if(!g?.id||!conv||typeof sb==='undefined'||pollLoading)return;
  let panel=q('#ecp-v150-polls',conv);
  if(!panel){panel=document.createElement('section');panel.id='ecp-v150-polls';panel.className='ecp-polls';q('#ws-send',conv)?.before(panel)}
  pollLoading=true;
  try{
    const pr=await sb.from('group_polls').select('*').eq('group_id',g.id).order('created_at',{ascending:false}).limit(20);
    if(pr.error)throw pr.error;const polls=pr.data||[],ids=polls.map(x=>x.id);
    let votes=[];if(ids.length){const vr=await sb.from('group_poll_votes').select('*').in('poll_id',ids);if(vr.error)throw vr.error;votes=vr.data||[]}
    panel.innerHTML='<div class="ecp-polls-head"><b>Polls</b>'+(admin()?'<button class="btn small" id="ecp-new-poll">Create Poll</button>':'')+'</div>'+
      (polls.length?polls.map(p=>{
        const opts=Array.isArray(p.options)?p.options:[],pv=votes.filter(v=>v.poll_id===p.id),mine=pv.find(v=>v.user_id===st.user.id)?.choice,total=pv.length;
        return '<article class="ecp-poll"><h4>'+esc(p.question)+'</h4>'+opts.map((o,i)=>{
          const n=pv.filter(v=>Number(v.choice)===i).length,pct=total?Math.round(n*100/total):0,sel=Number(mine)===i;
          return '<button type="button" data-poll="'+p.id+'" data-choice="'+i+'" '+(p.closed_at?'disabled':'')+' class="'+(sel?'selected':'')+'"><span>'+esc(o)+'</span><b>'+n+' · '+pct+'%</b><i style="width:'+pct+'%"></i></button>';
        }).join('')+'<small>'+total+' vote'+(total===1?'':'s')+(p.closed_at?' · Closed':'')+'</small></article>';
      }).join(''):'<p class="muted">No polls yet.</p>');
    qa('[data-poll]',panel).forEach(b=>b.onclick=async()=>{
      const r=await sb.from('group_poll_votes').upsert({poll_id:b.dataset.poll,user_id:st.user.id,choice:Number(b.dataset.choice)},{onConflict:'poll_id,user_id'});
      if(r.error)toast(r.error.message);else loadPolls();
    });
    q('#ecp-new-poll',panel)?.addEventListener('click',async()=>{
      const question=prompt('Poll question');if(!question?.trim())return;
      const raw=prompt('Poll options, separated by commas');if(!raw)return;
      const options=raw.split(',').map(x=>x.trim()).filter(Boolean).slice(0,6);if(options.length<2){toast('Add at least 2 options.');return}
      const r=await sb.from('group_polls').insert({group_id:g.id,created_by:st.user.id,question:question.trim(),options});
      if(r.error)toast(r.error.message);else loadPolls();
    });
    if(pollGroup!==g.id){
      pollGroup=g.id;if(pollChannel)try{await sb.removeChannel(pollChannel)}catch{}
      pollChannel=sb.channel('v150-polls-'+g.id)
        .on('postgres_changes',{event:'*',schema:'public',table:'group_polls',filter:'group_id=eq.'+g.id},loadPolls)
        .on('postgres_changes',{event:'*',schema:'public',table:'group_poll_votes'},loadPolls).subscribe();
    }
  }catch(e){panel.innerHTML='<p class="danger-text">Polls could not load.</p>';console.warn(e)}
  finally{pollLoading=false}
}

document.addEventListener('click',e=>{
  const b=e.target.closest?.('#group-poll-open');if(!b)return;
  e.preventDefault();e.stopImmediatePropagation();
  const open=()=>q('#ecp-new-poll')?.click();
  if(q('#ecp-new-poll'))open();else loadPolls().then(open).catch(()=>{});
},true);

// Facebook-like comment sheet and comment reactions.
let commentBusy=false;
async function enhanceComments(){
  const modal=qa('#modal-root .modal').find(m=>q('#ws-comments',m));if(!modal)return;
  modal.classList.add('ecp-facebook-comments');
  const form=q('#comment-form',modal),st=Sx();
  if(form&&!q('.ecp-comment-avatar',form)){
    const av=document.createElement('span');av.className='ws-avatar ecp-comment-avatar';
    if(st?.profile?.avatar_path){const img=document.createElement('img');img.dataset.photo=st.profile.avatar_path;img.dataset.bucket='avatars';av.append(img)}
    else av.textContent=(st?.profile?.full_name||'Y').slice(0,1).toUpperCase();
    form.prepend(av);window.EduWorkspace?.photos?.(form,sb);
  }
  if(commentBusy)return;const rows=qa('.ws-comment[data-comment-id]',modal);if(!rows.length)return;
  commentBusy=true;
  try{
    const ids=rows.map(r=>r.dataset.commentId),res=await sb.from('forum_comment_reactions').select('*').in('comment_id',ids);
    if(res.error)throw res.error;const all=res.data||[];
    for(const row of rows){
      const id=row.dataset.commentId,mine=all.find(x=>x.comment_id===id&&x.user_id===st?.user?.id),count=all.filter(x=>x.comment_id===id).length;
      let actions=q('.ecp-comment-actions',row);
      if(!actions){actions=document.createElement('span');actions.className='ecp-comment-actions';const reply=q('[data-reply]',row);reply?.parentNode?.insertBefore(actions,reply)}
      actions.innerHTML='<button type="button" data-comment-like="'+id+'" class="'+(mine?'active':'')+'">'+(mine?'👍 Liked':'Like')+'</button>'+(count?'<small>'+count+'</small>':'');
    }
    qa('[data-comment-like]',modal).forEach(b=>b.onclick=async()=>{
      const id=b.dataset.commentLike,old=all.find(x=>x.comment_id===id&&x.user_id===st.user.id);
      const r=old?await sb.from('forum_comment_reactions').delete().eq('comment_id',id).eq('user_id',st.user.id):await sb.from('forum_comment_reactions').upsert({comment_id:id,user_id:st.user.id,emoji:'👍'});
      if(r.error)toast(r.error.message);else enhanceComments();
    });
  }catch(e){console.warn('comment reactions',e)}finally{commentBusy=false}
}

// Profile cache refresh event updates every rendered photo that references the same path.
window.addEventListener('ecp-photo-cache-updated',e=>{
  const {bucket,path,url}=e.detail||{};if(!path||!url)return;
  qa('img[data-photo]').filter(img=>img.dataset.photo===path&&(img.dataset.bucket||'avatars')===bucket).forEach(img=>img.src=url);
});

let raf=0;
new MutationObserver(()=>{
  cancelAnimationFrame(raf);raf=requestAnimationFrame(()=>{
    restoreThreadList();cacheThreadList();bindTyping();installGroupToggle();loadPolls();enhanceComments();
  });
}).observe(document.body,{childList:true,subtree:true});
setTimeout(()=>{restoreThreadList();bindTyping();installGroupToggle();loadPolls();enhanceComments()},0);

const style=document.createElement('style');style.id='ecp-v150-style';style.textContent=`
.ecp-typing{padding:4px 16px 7px;color:var(--ws-muted,#65676b);font-size:12px}.ecp-typing[hidden]{display:none}.ecp-typing span{display:inline-flex;gap:3px}.ecp-typing i{width:5px;height:5px;border-radius:50%;background:currentColor;animation:ecpdot 1s infinite}.ecp-typing i:nth-child(2){animation-delay:.15s}.ecp-typing i:nth-child(3){animation-delay:.3s}@keyframes ecpdot{0%,60%,100%{transform:translateY(0);opacity:.35}30%{transform:translateY(-4px);opacity:1}}
.ecp-v150-pending{opacity:.68}
.ecp-group-control{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:8px 12px;padding:10px 12px;border:1px solid var(--ws-line,#ddd);border-radius:14px;background:var(--ws-bg,#fff)}.ecp-group-control>div{display:grid;gap:2px}.ecp-group-control small{color:var(--ws-muted,#65676b);font-size:11px}.ecp-switch input{display:none}.ecp-switch i{display:block;width:46px;height:26px;border-radius:20px;background:#a5abb2;position:relative}.ecp-switch i:after{content:"";position:absolute;left:3px;top:3px;width:20px;height:20px;background:#fff;border-radius:50%;transition:.15s}.ecp-switch input:checked+i{background:#1877f2}.ecp-switch input:checked+i:after{transform:translateX(20px)}
.ecp-polls{margin:8px 12px;padding:10px;border:1px solid var(--ws-line,#ddd);border-radius:15px;background:var(--ws-bg,#fff);max-height:34vh;overflow:auto}.ecp-polls-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px}.ecp-poll{padding:9px;border:1px solid var(--ws-line,#ddd);border-radius:13px;margin:8px 0}.ecp-poll h4{margin:0 0 8px}.ecp-poll button{position:relative;isolation:isolate;width:100%;display:flex;justify-content:space-between;gap:10px;padding:9px 10px;margin:6px 0;border:1px solid var(--ws-line,#ddd);border-radius:11px;background:transparent;color:inherit;text-align:left;overflow:hidden}.ecp-poll button i{position:absolute;z-index:-1;left:0;top:0;bottom:0;background:rgba(24,119,242,.12)}.ecp-poll button.selected{border-color:#1877f2}.ecp-poll small{color:var(--ws-muted,#65676b)}
.ecp-facebook-comments{position:fixed!important;left:0!important;right:0!important;bottom:0!important;top:auto!important;width:100%!important;max-width:none!important;height:94dvh!important;border-radius:20px 20px 0 0!important;padding:0!important;display:flex!important;flex-direction:column!important;overflow:hidden!important;background:var(--ws-bg,#fff)!important}.ecp-facebook-comments>h2{margin:0!important;padding:14px 48px!important;text-align:center!important;font-size:17px!important;border-bottom:1px solid var(--ws-line,#ddd)!important}.ecp-facebook-comments>.modal-body{flex:1!important;min-height:0!important;overflow:auto!important;padding:10px 12px 82px!important}.ecp-facebook-comments>.modal-actions{display:none!important}.ecp-facebook-comments .ws-comment{display:flex!important;gap:8px!important;align-items:flex-start!important;padding:4px 0!important;border:0!important}.ecp-facebook-comments .ws-comment.reply{margin-left:38px!important}.ecp-facebook-comments .ws-comment>.ws-avatar{width:34px!important;height:34px!important;flex:0 0 34px!important}.ecp-facebook-comments .ws-comment>div{min-width:0!important;max-width:calc(100% - 42px)!important}.ecp-facebook-comments .ws-comment>div>b{font-size:13px!important}.ecp-facebook-comments .ws-comment>div>p{display:block!important;width:max-content!important;max-width:100%!important;margin:2px 0 2px!important;padding:8px 11px!important;border-radius:18px!important;background:var(--ws-soft,#f0f2f5)!important;font-size:14px!important;line-height:1.32!important}.ecp-facebook-comments .ws-comment time{font-size:11px!important;color:var(--ws-muted,#65676b)!important;margin-left:6px!important}.ecp-comment-actions button,.ecp-facebook-comments .text-btn{border:0!important;background:transparent!important;padding:2px 4px!important;font-size:11px!important;font-weight:700!important;color:var(--ws-muted,#65676b)!important}.ecp-comment-actions button.active{color:#1877f2!important}.ecp-comment-actions small{font-size:10px;color:var(--ws-muted,#65676b)}
.ecp-facebook-comments #comment-form{position:absolute!important;left:0;right:0;bottom:0;display:grid!important;grid-template-columns:36px minmax(0,1fr) auto!important;gap:8px!important;align-items:end!important;padding:8px 10px max(8px,env(safe-area-inset-bottom))!important;background:var(--ws-bg,#fff)!important;border-top:1px solid var(--ws-line,#ddd)!important;z-index:4}.ecp-facebook-comments #comment-form .ecp-comment-avatar{grid-column:1;width:36px!important;height:36px!important}.ecp-facebook-comments #comment-form textarea{grid-column:2;min-height:40px!important;max-height:96px!important;border-radius:21px!important;padding:9px 12px!important;resize:none!important}.ecp-facebook-comments #comment-form>label{display:none!important}.ecp-facebook-comments #comment-form>button{grid-column:3;border-radius:20px!important;min-height:40px!important}.ecp-facebook-comments #reply-to{grid-column:2/4;margin:0!important;padding:0 4px!important;font-size:11px!important}
.ecp-v150-link{color:#1877f2!important;text-decoration:none!important;overflow-wrap:anywhere}
@media(max-width:800px){.ecp-group-control,.ecp-polls{margin-left:6px;margin-right:6px}.ecp-facebook-comments{height:96dvh!important}.ecp-polls{max-height:30dvh}}
`;document.head.append(style);
})();