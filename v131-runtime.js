(()=>{
'use strict';
if(!window.EduNative)return;
const q=(s,r=document)=>r.querySelector(s),qa=(s,r=document)=>[...r.querySelectorAll(s)];
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const state=()=>{try{return typeof S!=='undefined'&&S?S:null}catch{return null}};
const cacheKey=(kind,id)=>'ecp-v138:'+String(state()?.user?.id||'guest')+':'+kind+':'+(id||'main');
const read=(kind,id,max=604800000)=>{try{const x=JSON.parse(localStorage.getItem(cacheKey(kind,id))||'null');return x&&Date.now()-Number(x.t||0)<max?x:null}catch{return null}};
const write=(kind,id,data)=>{try{localStorage.setItem(cacheKey(kind,id),JSON.stringify({t:Date.now(),...data}))}catch{}};
const currentThread=()=>{const x=state();return x?.direct?['direct',x.direct]:x?.group?.id?['group',x.group.id]:null};

function restoreConversationCache(){
 const dm=q('#dm-log'),gm=q('#chat-log');
 if(dm&&!dm.children.length&&state()?.direct){const c=read('chat',state().direct);if(c?.html){dm.innerHTML=c.html;window.hydrateAvatars?.(dm);window.hydrateMedia?.(dm);requestAnimationFrame(()=>dm.scrollTop=dm.scrollHeight)}}
 if(gm&&!gm.children.length&&state()?.group?.id){const c=read('group',state().group.id);if(c?.html){gm.innerHTML=c.html;window.hydrateAvatars?.(gm);window.hydrateMedia?.(gm);requestAnimationFrame(()=>gm.scrollTop=gm.scrollHeight)}}
 const rail=q('#conversation-rows,#chat-list,.conversation-list,[data-conversation-list]');if(rail&&!rail.children.length){const c=read('rail','main',30*86400000);if(c?.html){rail.innerHTML=c.html;rail.dataset.cacheRestored='1';window.hydrateAvatars?.(rail)}}
}
function saveConversationCache(){
 const t=currentThread(),log=q('#dm-log')||q('#chat-log');
 if(t&&log?.children.length){const clone=log.cloneNode(true);qa('.typing-indicator,.sending,.chat-reactions',clone).forEach(n=>n.remove());qa('[data-avatar-path]',clone).forEach(n=>{delete n.dataset.avatarLoaded;delete n.dataset.avatarPending;const img=n.querySelector('img');if(img&&String(img.src).startsWith('blob:'))img.remove()});qa('[data-photo]',clone).forEach(img=>{if(String(img.src).startsWith('blob:'))img.removeAttribute('src')});write(t[0]==='direct'?'chat':'group',t[1],{html:clone.innerHTML.slice(-240000)})}
 const rail=q('#conversation-rows,#chat-list,.conversation-list,[data-conversation-list]');if(rail?.children.length&&!rail.querySelector('.loading'))write('rail','main',{html:rail.innerHTML.slice(0,240000)});
}

function ensureTyping(id,label='Typing…'){
 const log=q(id==='#dm-typing'?'#dm-log':'#chat-log');if(!log)return null;
 let el=q(id);if(!el){el=document.createElement('div');el.id=id.slice(1);el.className='typing-indicator';el.hidden=true;el.innerHTML='<span class="typing-dots"><i></i><i></i><i></i></span><span class="typing-label">'+esc(label)+'</span>';log.after(el)}return el;
}
let typingChannel=null,typingThread='',typingTimer;
async function bindTyping(){
 const input=q('#dm-text')||q('#chat-input');if(!input||!S?.user||!sb)return;
 const direct=!!q('#dm-text'),thread=direct?S.direct:S.group?.id;if(!thread)return;
 const key=(direct?'direct:':'group:')+thread;if(key===typingThread)return;
 typingThread=key;if(typingChannel)try{await sb.removeChannel(typingChannel)}catch{}
 const name=direct?'dm-'+[S.user.id,thread].sort().join('-'):'group-chat-'+thread;
 typingChannel=sb.channel(name,{config:{broadcast:{self:false}}}).on('broadcast',{event:'typing'},({payload})=>{
   if(payload?.user_id===S.user.id)return;
   if(direct&&payload?.user_id!==thread)return;
   const el=ensureTyping(direct?'#dm-typing':'#group-typing');
   if(!el)return;el.hidden=!payload?.typing;el.querySelector('.typing-label').textContent=direct?'Typing…':(payload?.name||'Someone')+' is typing…';
   clearTimeout(el._hide);if(payload?.typing)el._hide=setTimeout(()=>el.hidden=true,1800);
 }).subscribe();
 const sendTyping=typing=>typingChannel?.send({type:'broadcast',event:'typing',payload:{user_id:S.user.id,name:S.profile?.full_name||'Member',typing}});
 input.addEventListener('input',()=>{sendTyping(true);clearTimeout(typingTimer);typingTimer=setTimeout(()=>sendTyping(false),900)});
 input.addEventListener('blur',()=>sendTyping(false));
}
function optimisticSend(form,input,log){
 if(form.dataset.v131Optimistic)return;form.dataset.v131Optimistic='1';
 form.addEventListener('submit',()=>{
   const body=input.value.trim();if(!body)return;
   const row=document.createElement('div');row.className='message-row mine sending';row.dataset.optimistic=body;
   row.innerHTML='<span class="avatar">'+esc((S.profile?.full_name||'Y').slice(0,1))+'</span><div class="message mine"><div class="meta"><strong>You</strong> <small>Sending…</small></div><div class="bodytext">'+esc(body)+'</div></div>';
   log.append(row);requestAnimationFrame(()=>log.scrollTop=log.scrollHeight);
   for(const ms of [0,20,55,110])setTimeout(()=>{try{input.focus({preventScroll:true})}catch{input.focus()}log.scrollTop=log.scrollHeight},ms);
   setTimeout(()=>{if(row.isConnected)row.remove()},5000);
 },true);
}
function bindChatSpeed(){
 const dm=q('#dm-form'),di=q('#dm-text'),dl=q('#dm-log');if(dm&&di&&dl)optimisticSend(dm,di,dl);
 const gf=q('#chat-form'),gi=q('#chat-input'),gl=q('#chat-log');if(gf&&gi&&gl)optimisticSend(gf,gi,gl);
 bindTyping().catch(()=>{});
}

function polishComments(){
 const modal=qa('#modal-root .modal,dialog .modal-card,.modal-card').find(m=>/comments|discussion/i.test(m.querySelector('h2,h3')?.textContent||'')||q('#ws-comments',m));if(!modal)return;
 modal.classList.add('v138-comments');
 const list=q('#ws-comments',modal),form=q('#comment-form',modal),input=q('#comment-body',modal),reply=q('#reply-to',modal);
 if(list)list.classList.add('v138-comments-list');
 if(form&&!form.classList.contains('v138-comment-composer')){form.classList.add('v138-comment-composer');const x=state();const av=document.createElement('span');av.className='v138-composer-avatar';av.textContent=(x?.profile?.full_name||'Y').slice(0,1).toUpperCase();if(x?.profile?.avatar_path)av.dataset.avatarPath=x.profile.avatar_path;form.prepend(av)}
 if(reply)reply.classList.add('v138-reply-banner');
 if(input&&!input.dataset.v138){input.dataset.v138='1';input.rows=1;input.placeholder='Write a comment…';const resize=()=>{input.style.height='auto';input.style.height=Math.min(112,input.scrollHeight)+'px'};input.addEventListener('input',resize);resize()}
 qa('.ws-comment',modal).forEach(c=>c.classList.add('v138-comment'));window.hydrateAvatars?.(modal);
}

async function hydrateAllAvatars(root=document){
 try{
  const client=(typeof sb!=='undefined'&&sb)||window.sb||window.supabaseClient;
  const photos=window.EduPhotos;
  if(!client||!photos?.get)return;
  let uid='guest';
  try{const ses=await client.auth.getSession();uid=ses?.data?.session?.user?.id||'guest'}catch{}
  const nodes=qa('[data-avatar-path]',root).filter(n=>n.dataset.avatarPath&&!n.dataset.avatarPending);
  await Promise.all(nodes.map(async n=>{
   n.dataset.avatarPending='1';
   const path=n.dataset.avatarPath,bucket=n.dataset.avatarBucket||'avatars';
   try{
    const cached=photos.peek?.(uid,bucket,path);
    let url=cached||await photos.get(client,uid,bucket,path);
    if(!url)return;
    let img=n.matches('img')?n:n.querySelector('img');
    if(!img){img=document.createElement('img');img.alt='';img.loading='lazy';img.decoding='async';n.prepend(img)}
    if(img.src!==url)img.src=url;
    img.onerror=()=>{delete n.dataset.avatarLoaded;delete n.dataset.avatarPending;};
    n.dataset.avatarLoaded='1';
   }catch{}
   finally{delete n.dataset.avatarPending}
  }));
 }catch{}
}
window.hydrateAvatars=hydrateAllAvatars;
window.addEventListener('educhat-avatar-updated',e=>{const d=e.detail||{};qa('[data-avatar-path]').filter(n=>n.dataset.avatarPath===d.path).forEach(n=>{let img=n.matches('img')?n:n.querySelector('img');if(!img){img=document.createElement('img');n.prepend(img)}if(d.url&&img.src!==d.url)img.src=d.url})});

function linkifyMessages(root=document){
 const selectors='.bodytext,.message .bodytext,.ws-post-body,.ws-comment p,.chat-message-text,.message-text';
 qa(selectors,root).forEach(box=>{
   if(box.dataset.v140Links==='1')return;box.dataset.v140Links='1';
   const walker=document.createTreeWalker(box,NodeFilter.SHOW_TEXT,{acceptNode:n=>n.parentElement?.closest('a,button,code,pre')?NodeFilter.FILTER_REJECT:/((https?:\/\/|www\.)[^\s<]+)/i.test(n.nodeValue||'')?NodeFilter.FILTER_ACCEPT:NodeFilter.FILTER_REJECT});
   const nodes=[];while(walker.nextNode())nodes.push(walker.currentNode);
   for(const n of nodes){
     const text=n.nodeValue||'',frag=document.createDocumentFragment();let last=0;
     text.replace(/((?:https?:\/\/|www\.)[^\s<]+)/gi,(raw,_m,offset)=>{
       if(offset>last)frag.append(document.createTextNode(text.slice(last,offset)));
       const a=document.createElement('a');const href=/^www\./i.test(raw)?'https://'+raw:raw;
       a.href=href;a.textContent=raw;a.className='ecp-clickable-link';a.rel='noopener noreferrer';a.dataset.ecpLink='1';frag.append(a);last=offset+raw.length;return raw;
     });
     if(last<text.length)frag.append(document.createTextNode(text.slice(last)));n.replaceWith(frag);
   }
 });
}
function bindLinkNavigation(){
 if(document.documentElement.dataset.v140Links)return;document.documentElement.dataset.v140Links='1';
 document.addEventListener('click',e=>{
   const a=e.target.closest?.('a[data-ecp-link],a[href^="http://"],a[href^="https://"]');if(!a)return;
   const href=a.href;if(!href)return;
   e.preventDefault();e.stopImmediatePropagation();
   try{
     const u=new URL(href,location.href);
     if(u.origin===location.origin){
       const target=u.searchParams.get('page');
       if(target&&typeof window.navigate==='function'){window.navigate(target);return}
       location.assign(u.href);return;
     }
     location.assign(u.href);
   }catch{location.href=href}
 },true);
}
bindLinkNavigation();

function facebookShare(){
 document.addEventListener('click',async e=>{
   const b=e.target.closest?.('[data-share]');if(!b||b.closest('.meeting-shell'))return;
   if(!navigator.share)return;
   e.preventDefault();e.stopImmediatePropagation();
   const base=(window.EDUCHAT_CONFIG&&window.EDUCHAT_CONFIG.PUBLIC_WEB_URL)||location.origin;const url=new URL(base);url.searchParams.set('post',b.dataset.share);
   try{await navigator.share({title:'Edu Chat Pro post',url:url.href});try{await sb.from('forum_shares').upsert({post_id:b.dataset.share,user_id:S.user.id})}catch{}}
   catch(err){if(err?.name!=='AbortError')try{await navigator.clipboard.writeText(url.href)}catch{}}
 },true);
}


const pollEsc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let pollGroupId='',pollChannel=null,pollBusy=false;
const pollIsAdmin=()=>['super_admin','assistant_admin','admin'].includes(String(state()?.role||''));
async function loadGroupPolls(){
 const x=state(),g=x?.group,host=q('#group-body')||q('.group-info')?.parentElement;if(!g?.id||!host||typeof sb==='undefined')return;
 let panel=q('#v141-group-polls');
 if(!panel){panel=document.createElement('section');panel.id='v141-group-polls';panel.className='v141-polls';const anchor=q('.group-info')||host.firstElementChild;anchor?.parentNode?.insertBefore(panel,anchor.nextSibling)}
 if(pollBusy)return;pollBusy=true;
 try{
  const {data:polls,error}=await sb.from('group_polls').select('id,group_id,question,options,created_by,created_at,closed_at').eq('group_id',g.id).order('created_at',{ascending:false}).limit(20);
  if(error)throw error;
  const ids=(polls||[]).map(p=>p.id);
  let votes=[];if(ids.length){const r=await sb.from('group_poll_votes').select('poll_id,user_id,choice').in('poll_id',ids);if(r.error)throw r.error;votes=r.data||[]}
  const me=x?.user?.id;
  const cards=(polls||[]).map(p=>{
    const opts=Array.isArray(p.options)?p.options:[];const pv=votes.filter(v=>v.poll_id===p.id),mine=pv.find(v=>v.user_id===me)?.choice,total=pv.length;
    const rows=opts.map((o,i)=>{const n=pv.filter(v=>Number(v.choice)===i).length,pct=total?Math.round(n*100/total):0,selected=Number(mine)===i;
      return '<button type="button" class="v141-poll-option '+(selected?'selected':'')+'" data-poll-vote="'+p.id+'" data-choice="'+i+'" '+(p.closed_at?'disabled':'')+'><span class="v141-poll-radio">'+(selected?'✓':'')+'</span><span class="v141-poll-label">'+pollEsc(o)+'</span><span class="v141-poll-count">'+n+' · '+pct+'%</span><i style="width:'+pct+'%"></i></button>'}).join('');
    return '<article class="v141-poll-card"><header><b>'+pollEsc(p.question)+'</b><small>'+total+' vote'+(total===1?'':'s')+(p.closed_at?' · Closed':'')+'</small></header>'+rows+(pollIsAdmin()?'<footer><button type="button" class="text-btn" data-poll-close="'+p.id+'">'+(p.closed_at?'Reopen':'Close poll')+'</button></footer>':'')+'</article>';
  }).join('');
  panel.innerHTML='<div class="v141-polls-head"><b>Polls</b>'+(pollIsAdmin()?'<button type="button" class="btn" id="v141-create-poll">Create poll</button>':'')+'</div><div class="v141-poll-list">'+(cards||'<p class="v141-poll-empty">No polls yet.</p>')+'</div>';
  q('#v141-create-poll',panel)?.addEventListener('click',openCreateGroupPoll);
  qa('[data-poll-vote]',panel).forEach(b=>b.onclick=async()=>{try{const choice=Number(b.dataset.choice),poll_id=b.dataset.pollVote;const r=await sb.from('group_poll_votes').upsert({poll_id,user_id:state().user.id,choice},{onConflict:'poll_id,user_id'});if(r.error)throw r.error;await loadGroupPolls()}catch(e){window.EduUI?.toast?.(e.message||'Could not save vote','error')}});
  qa('[data-poll-close]',panel).forEach(b=>b.onclick=async()=>{try{const p=(polls||[]).find(v=>v.id===b.dataset.pollClose),r=await sb.from('group_polls').update({closed_at:p?.closed_at?null:new Date().toISOString()}).eq('id',b.dataset.pollClose);if(r.error)throw r.error;await loadGroupPolls()}catch(e){window.EduUI?.toast?.(e.message||'Could not update poll','error')}});
  if(pollGroupId!==g.id){
   pollGroupId=g.id;if(pollChannel)try{await sb.removeChannel(pollChannel)}catch{}
   pollChannel=sb.channel('group-polls-'+g.id)
    .on('postgres_changes',{event:'*',schema:'public',table:'group_polls',filter:'group_id=eq.'+g.id},()=>loadGroupPolls())
    .on('postgres_changes',{event:'*',schema:'public',table:'group_poll_votes'},()=>loadGroupPolls()).subscribe();
  }
 }catch(e){if(panel)panel.innerHTML='<div class="v141-polls-head"><b>Polls</b></div><p class="v141-poll-empty">Polls could not load.</p>';console.warn('group polls',e)}
 finally{pollBusy=false}
}
function openCreateGroupPoll(){
 if(!pollIsAdmin())return;
 const g=state()?.group;if(!g?.id)return;
 const root=document.createElement('div');root.className='v141-poll-create';
 root.innerHTML='<div class="v141-poll-dialog"><h3>Create poll</h3><input id="v141-poll-q" class="input" maxlength="500" placeholder="Ask a question"><div id="v141-poll-options"><input class="input" maxlength="200" placeholder="Option 1"><input class="input" maxlength="200" placeholder="Option 2"></div><div class="v141-poll-actions"><button type="button" class="btn" id="v141-add-option">Add option</button><button type="button" class="btn" id="v141-cancel-poll">Cancel</button><button type="button" class="btn primary" id="v141-save-poll">Create</button></div></div>';
 document.body.append(root);
 q('#v141-cancel-poll',root).onclick=()=>root.remove();
 q('#v141-add-option',root).onclick=()=>{const box=q('#v141-poll-options',root),n=box.children.length;if(n>=6)return;const i=document.createElement('input');i.className='input';i.maxLength=200;i.placeholder='Option '+(n+1);box.append(i);i.focus()};
 q('#v141-save-poll',root).onclick=async()=>{const question=q('#v141-poll-q',root).value.trim(),options=qa('#v141-poll-options input',root).map(i=>i.value.trim()).filter(Boolean);if(!question||options.length<2){window.EduUI?.toast?.('Add a question and at least two options.','error');return}try{const r=await sb.from('group_polls').insert({group_id:g.id,question,options,created_by:state().user.id});if(r.error)throw r.error;root.remove();await loadGroupPolls()}catch(e){window.EduUI?.toast?.(e.message||'Could not create poll','error')}};
}

function groupPermissionGuard(){
 const x=state(),g=x?.group;if(!g)return;
 const isAdmin=['super_admin','assistant_admin','admin'].includes(String(x?.role||''));
 const locked=!g.allow_member_messaging&&!isAdmin;
 const form=q('#chat-form'),input=q('#chat-input');
 if(form){
   form.classList.toggle('v139-group-locked',locked);
   let note=q('.v139-group-lock-note',form.parentElement||document);
   if(locked&&!note){note=document.createElement('div');note.className='v139-group-lock-note';note.textContent='Texting or calling is not allowed in this group. You can still read, download files, vote in polls, and join active calls or meetings.';form.parentElement?.insertBefore(note,form)}
   if(!locked&&note)note.remove();
 }
 if(input){input.readOnly=locked;if(locked)input.placeholder='Texting is not allowed in this group';}
}
function bindGroupPermissionReminder(){
 if(document.documentElement.dataset.v139GroupGuard)return;
 document.documentElement.dataset.v139GroupGuard='1';
 const blocked=()=>{const x=state(),g=x?.group,isAdmin=['super_admin','assistant_admin','admin'].includes(String(x?.role||''));return !!(g&&!g.allow_member_messaging&&!isAdmin)};
 const remind=e=>{if(!blocked())return false;e?.preventDefault?.();e?.stopImmediatePropagation?.();window.EduUI?.toast?.('Texting or calling is not allowed in this group.','error');return true};
 document.addEventListener('submit',e=>{if(e.target?.matches?.('#chat-form')&&remind(e))return},true);
 document.addEventListener('click',e=>{
   const t=e.target.closest?.('#chat-video,#chat-audio,#chat-form button[type="submit"],[data-voice],[data-record],[data-attach],[data-upload],#chat-file,#chat-voice');
   if(t)remind(e);
 },true);
 document.addEventListener('pointerdown',e=>{const t=e.target.closest?.('.v139-group-lock-note,#chat-input[readonly]');if(t)remind(e)},true);
}
bindGroupPermissionReminder();


let pollChannel=null,pollGroup='';
async function groupPolls(){
 const x=state(),g=x?.group;if(!g||!sb)return;
 const host=q('#group-body')||q('#chat-log')?.parentElement;if(!host)return;
 let box=q('#v140-group-polls',host);
 if(!box){box=document.createElement('section');box.id='v140-group-polls';box.className='v140-group-polls';const form=q('#chat-form',host)||q('#chat-form');(form?.parentElement||host).insertBefore(box,form||null)}
 const isAdmin=['super_admin','assistant_admin','admin'].includes(String(x?.role||''));
 const polls=(await sb.from('group_polls').select('*').eq('group_id',g.id).order('created_at',{ascending:false}).limit(12)).data||[];
 const ids=polls.map(p=>p.id);let votes=[];
 if(ids.length)votes=(await sb.from('group_poll_votes').select('*').in('poll_id',ids)).data||[];
 const mine=new Map(votes.filter(v=>v.user_id===x.user.id).map(v=>[v.poll_id,v.choice]));
 box.innerHTML='<div class="v140-poll-head"><div><b>Polls</b><small>Vote even when member texting is OFF</small></div>'+(isAdmin?'<button type="button" id="v140-create-poll" class="btn">Create poll</button>':'')+'</div>'+
   '<div class="v140-poll-list">'+(polls.length?polls.map(p=>{
     const opts=Array.isArray(p.options)?p.options:[];
     const total=votes.filter(v=>v.poll_id===p.id).length;
     const closed=!!p.closed_at;
     return '<article class="v140-poll-card"><h4>'+esc(p.question)+'</h4>'+opts.map((o,i)=>{
       const c=votes.filter(v=>v.poll_id===p.id&&v.choice===i).length,sel=mine.get(p.id)===i,pct=total?Math.round(c*100/total):0;
       return '<button type="button" class="v140-poll-option '+(sel?'selected':'')+'" data-poll="'+p.id+'" data-choice="'+i+'" '+(closed?'disabled':'')+'><span>'+esc(String(o))+'</span><b>'+pct+'%</b><i style="width:'+pct+'%"></i></button>';
     }).join('')+'<small>'+total+' vote'+(total===1?'':'s')+(closed?' · Closed':'')+'</small></article>';
   }).join(''):'<p class="v140-poll-empty">No polls yet.</p>')+'</div>';
 qa('[data-poll]',box).forEach(b=>b.onclick=async()=>{
   const poll_id=b.dataset.poll,choice=Number(b.dataset.choice);
   const r=await sb.from('group_poll_votes').upsert({poll_id,user_id:x.user.id,choice},{onConflict:'poll_id,user_id'});
   if(r.error){window.EduUI?.toast?.(r.error.message,'error');return} await groupPolls();
 });
 q('#v140-create-poll',box)?.addEventListener('click',async()=>{
   const question=prompt('Poll question');if(!question?.trim())return;
   const raw=prompt('Options (separate with commas)');if(!raw)return;
   const options=raw.split(',').map(v=>v.trim()).filter(Boolean).slice(0,6);
   if(options.length<2){window.EduUI?.toast?.('Add at least 2 options.','error');return}
   const r=await sb.from('group_polls').insert({group_id:g.id,created_by:x.user.id,question:question.trim(),options});
   if(r.error)window.EduUI?.toast?.(r.error.message,'error');else{window.EduUI?.toast?.('Poll created.','ok');await groupPolls()}
 });
 if(pollGroup!==g.id){
   pollGroup=g.id;if(pollChannel)try{await sb.removeChannel(pollChannel)}catch{}
   pollChannel=sb.channel('group-polls-'+g.id)
    .on('postgres_changes',{event:'*',schema:'public',table:'group_polls',filter:'group_id=eq.'+g.id},()=>groupPolls())
    .on('postgres_changes',{event:'*',schema:'public',table:'group_poll_votes'},()=>groupPolls())
    .subscribe();
 }
}

function groupToggle(){
 const info=q('.group-info');if(!info||info.querySelector('.v131-group-toggle')||!S?.group)return;
 const g=S.group,wrap=document.createElement('label');wrap.className='v131-group-toggle';
 if(S.role==='super_admin'){
   wrap.innerHTML='<span><b>Member messaging & calls</b><small>ON: text, files, voice & group calls · OFF: read/download/join only</small></span><input type="checkbox" '+(g.allow_member_messaging?'checked':'')+'><i></i>';
   wrap.querySelector('input').onchange=async e=>{const next=e.target.checked;e.target.disabled=true;const r=await sb.from('groups').update({allow_member_messaging:next}).eq('id',g.id);e.target.disabled=false;if(r.error){e.target.checked=!next;window.EduUI?.toast(r.error.message,'error')}else{g.allow_member_messaging=next;window.EduUI?.toast(next?'Members can send and start group calls':'Members are read/download/join only','ok')}};
 }else wrap.innerHTML='<span><b>'+ (g.allow_member_messaging?'Members can send and call':'Members can only read/download/join') +'</b><small>Only Super Admin can change this</small></span>';
 const p=info.querySelector('p');(p?.parentNode||info).insertBefore(wrap,p?.nextSibling||info.firstChild);
}

function backHandler(){
 const nav=window.__ECP_NAV||(window.__ECP_NAV={stack:[],ready:true,suppress:false});
 nav.stack=(nav.stack||[]).filter(Boolean).filter((x,i,a)=>i===0||x!==a[i-1]).slice(-60);
 const current=()=>q('#page')?.dataset?.page||state()?.page||'';
 const go=(p,from)=>{if(!p||p===from||typeof window.navigate!=='function')return false;nav.suppress=true;window.navigate(p);return true};
 document.addEventListener('click',e=>{const b=e.target.closest?.('[data-nav]');if(!b)return;const now=current(),target=b.dataset.nav;if(target&&now&&target!==now&&!nav.suppress){if(nav.stack[nav.stack.length-1]!==now)nav.stack.push(now);if(nav.stack.length>60)nav.stack.shift()}},true);
 window.EduMobileBack=()=>{
  try{
   const active=document.activeElement,input=q('#message-input,#dm-text,#chat-input');if(active&&input&&active===input){active.blur();return true}
   const modal=q('#modal-root .modal-backdrop,dialog[open],.modal:not(.hidden)');if(modal){window.EduUI?.closeModal?.();if(modal.tagName==='DIALOG'&&modal.open)modal.close();return true}
   const now=current(),x=state();
   if((x?.direct||x?.group)&&now!=='forum'&&now!=='chats')return go('chats',now);
   while(nav.stack.length){const p=nav.stack.pop();if(p&&p!==now&&go(p,now))return true}
   if(['notifications','saved','meetings'].includes(now))return go('chats',now);
   if(['chats','groups','people','profile','admin'].includes(now))return go('forum',now);
   return now==='forum'?false:(now?go('forum',now):false);
  }catch(err){console.warn('v1.3.8 back',err);return false}
 };
 window.EduMobileBackSafe=window.EduMobileBack;
}

const css=document.createElement('style');css.textContent=`
.v131-comments,.v138-comments{position:fixed!important;inset:auto 0 0!important;width:100%!important;max-width:none!important;height:94dvh!important;border-radius:20px 20px 0 0!important;display:flex!important;flex-direction:column!important;overflow:hidden!important;padding:0!important}
.v131-comments>h2,.v138-comments>h2,.v138-comments>h3{padding:14px 18px!important;margin:0!important;text-align:center;border-bottom:1px solid var(--ws-line)}
.v131-comments>.modal-body,.v138-comments>.modal-body{display:flex;flex-direction:column;min-height:0;overflow:hidden;padding:0!important}.v131-comments>.modal-actions{display:none!important}
.v131-comments-list,.v138-comments-list{flex:1;overflow:auto;padding:10px 12px}.v131-comment,.v138-comment,.v138-comments .ws-comment{display:flex!important;align-items:flex-start!important;gap:8px!important;padding:4px 0!important;border:0!important}.v131-comment.reply,.v138-comment.reply,.v138-comments .ws-comment.reply{margin-left:28px!important;border-left:0!important}
.v131-comment>.ws-avatar,.v138-comments .ws-avatar{width:36px!important;height:36px!important;flex:0 0 36px}.v131-comment>div>p,.v138-comments .ws-comment>div>p{display:inline-block!important;background:var(--ws-soft)!important;border-radius:18px!important;padding:8px 11px!important;margin:3px 0!important}.v131-comment .text-btn,.v138-comments .ws-comment .text-btn{font-size:11px;font-weight:700}
.v131-comment-composer,.v138-comment-composer{position:sticky!important;bottom:0;background:var(--ws-bg)!important;border-top:1px solid var(--ws-line)!important;padding:8px 10px max(8px,env(safe-area-inset-bottom))!important}.v131-comment-composer textarea,.v138-comment-composer textarea{min-height:40px!important;max-height:110px!important;border-radius:22px!important;resize:none!important}
.v138-comment-composer{display:grid!important;grid-template-columns:36px minmax(0,1fr) auto!important;gap:8px!important;align-items:end!important}.v138-composer-avatar{width:36px!important;height:36px!important;border-radius:50%!important;background:var(--ws-soft,#e4e6eb)!important;display:grid!important;place-items:center!important;font-weight:700!important;overflow:hidden!important}.v138-composer-avatar img{width:100%!important;height:100%!important;object-fit:cover!important}.v138-reply-banner{grid-column:2/4!important;font-size:12px!important;color:var(--ws-muted,#65676b)!important}.v138-comments .ws-comment>div{min-width:0!important;max-width:calc(100% - 44px)!important}.v138-comments .ws-comment>div>b{font-size:13px!important}.v138-comments .ws-comment time{font-size:11px!important;color:var(--ws-muted,#65676b)!important}.v138-comments .ws-comment>div>p{font-size:14px!important;line-height:1.32!important;width:max-content!important;max-width:100%!important}.typing-indicator{display:flex;align-items:center;gap:7px;min-height:24px;padding:2px 12px;color:var(--ws-muted);font-size:12px}.typing-indicator[hidden]{display:none!important}.typing-dots{display:inline-flex;gap:3px}.typing-dots i{width:5px;height:5px;border-radius:50%;background:currentColor;opacity:.35;animation:v131typing 1s infinite}.typing-dots i:nth-child(2){animation-delay:.13s}.typing-dots i:nth-child(3){animation-delay:.26s}@keyframes v131typing{0%,60%,100%{transform:translateY(0);opacity:.3}30%{transform:translateY(-4px);opacity:1}}.sending{opacity:.65}
.v141-polls{margin:10px 0;padding:10px;border:1px solid var(--ws-line,#ddd);border-radius:16px;background:var(--ws-bg,#fff)}.v141-polls-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:8px}.v141-poll-list{display:grid;gap:10px}.v141-poll-card{border:1px solid var(--ws-line,#ddd);border-radius:14px;padding:10px;background:var(--ws-bg,#fff)}.v141-poll-card header{display:grid;gap:3px;margin-bottom:8px}.v141-poll-card header small{color:var(--ws-muted,#65676b)}.v141-poll-option{position:relative;isolation:isolate;width:100%;display:grid;grid-template-columns:24px minmax(0,1fr) auto;align-items:center;gap:8px;text-align:left;border:1px solid var(--ws-line,#ddd);background:transparent;border-radius:12px;padding:10px;margin:6px 0;overflow:hidden}.v141-poll-option i{position:absolute;z-index:-1;inset:0 auto 0 0;background:rgba(24,119,242,.12);border-radius:11px}.v141-poll-option.selected{border-color:#1877f2}.v141-poll-radio{width:22px;height:22px;border:2px solid #a0a7b0;border-radius:50%;display:grid;place-items:center;font-size:12px}.v141-poll-option.selected .v141-poll-radio{border-color:#1877f2;background:#1877f2;color:white}.v141-poll-count{font-size:12px;color:var(--ws-muted,#65676b)}.v141-poll-empty{font-size:12px;color:var(--ws-muted,#65676b);margin:4px}.v141-poll-create{position:fixed;z-index:99999;inset:0;background:rgba(0,0,0,.45);display:grid;place-items:end center;padding:12px}.v141-poll-dialog{width:min(560px,100%);background:var(--ws-bg,#fff);border-radius:20px;padding:16px;display:grid;gap:10px}.v141-poll-dialog h3{margin:0}.v141-poll-options,#v141-poll-options{display:grid;gap:8px}.v141-poll-actions{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:8px}.ecp-clickable-link{color:#1877f2!important;text-decoration:none!important;overflow-wrap:anywhere!important;word-break:break-word!important}.ecp-clickable-link:active{text-decoration:underline!important}.v139-group-lock-note{margin:8px 10px;padding:10px 12px;border-radius:12px;background:var(--ws-soft,#f0f2f5);color:var(--ws-muted,#65676b);font-size:12px;line-height:1.35;text-align:center}.v139-group-locked{opacity:.72}.v139-group-locked button[type="submit"]{cursor:not-allowed}.v131-group-toggle{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 12px;margin:9px 0;border:1px solid var(--ws-line);border-radius:15px;background:var(--ws-soft)}.v131-group-toggle span{display:grid;gap:2px}.v131-group-toggle small{color:var(--ws-muted)}.v131-group-toggle input{display:none}.v131-group-toggle i{width:46px;height:26px;border-radius:999px;background:#9ba3ad;position:relative}.v131-group-toggle i:after{content:"";position:absolute;width:20px;height:20px;left:3px;top:3px;border-radius:50%;background:#fff;transition:.15s}.v131-group-toggle input:checked+i{background:#1877f2}.v131-group-toggle input:checked+i:after{transform:translateX(20px)}
.v140-group-polls{margin:8px 10px 10px;padding:10px;border:1px solid var(--ws-line,#ddd);border-radius:16px;background:var(--ws-bg,#fff)}.v140-poll-head{display:flex;justify-content:space-between;gap:10px;align-items:center;margin-bottom:8px}.v140-poll-head>div{display:grid;gap:2px}.v140-poll-head small,.v140-poll-card>small{color:var(--ws-muted,#65676b);font-size:11px}.v140-poll-list{display:grid;gap:10px}.v140-poll-card{padding:10px;border:1px solid var(--ws-line,#ddd);border-radius:14px}.v140-poll-card h4{margin:0 0 8px;font-size:14px}.v140-poll-option{position:relative;overflow:hidden;width:100%;display:flex;justify-content:space-between;align-items:center;gap:8px;margin:6px 0;padding:9px 11px;border:1px solid var(--ws-line,#ddd);border-radius:12px;background:transparent;text-align:left}.v140-poll-option span,.v140-poll-option b{position:relative;z-index:2}.v140-poll-option i{position:absolute;z-index:1;left:0;top:0;bottom:0;background:rgba(24,119,242,.12)}.v140-poll-option.selected{border-color:#1877f2}.v140-poll-empty{margin:6px 0;color:var(--ws-muted,#65676b);font-size:12px}html.ecp-keyboard-open .composer,html.ecp-keyboard-open .ws-composer{transition:none!important;animation:none!important}
`;document.head.appendChild(css);

facebookShare();backHandler();
let raf=0;new MutationObserver(()=>{cancelAnimationFrame(raf);raf=requestAnimationFrame(()=>{restoreConversationCache();saveConversationCache();hydrateAllAvatars();bindChatSpeed();linkifyMessages();polishComments();groupPermissionGuard();groupPolls();groupToggle();loadGroupPolls()})}).observe(document.body,{subtree:true,childList:true});
window.addEventListener('pagehide',saveConversationCache);setTimeout(()=>{restoreConversationCache();hydrateAllAvatars();bindChatSpeed();linkifyMessages();polishComments();groupPermissionGuard();groupToggle();loadGroupPolls()},0);
})();