/* EduChatPro v1.5.1 persistent avatar cache.
   Full blobs stay in CacheStorage; small avatar thumbnails also stay in localStorage
   so list/forum avatars can render synchronously on the next visit. */
window.EduPhotos=(()=>{
 const hot=new Map(),pending=new Map(),thumbPending=new Set();let epoch=0,trimWork=Promise.resolve();
 const cacheName='ecp-private-photos-v151';
 const thumbPrefix='ecp-thumb-v151:';
 const thumbIndex='ecp-thumb-v151-index';
 const keyOf=(user,bucket,path)=>user+'/'+bucket+'/'+path;
 const hash=s=>{let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return (h>>>0).toString(36)};
 const thumbKey=(bucket,path)=>thumbPrefix+hash(bucket+'|'+path);
 const peekSync=(bucket,path)=>{try{return localStorage.getItem(thumbKey(bucket,path))||''}catch{return''}};
 function touchThumb(k){
   try{
     let list=JSON.parse(localStorage.getItem(thumbIndex)||'[]').filter(x=>x!==k);list.push(k);
     while(list.length>160){const old=list.shift();localStorage.removeItem(old)}
     localStorage.setItem(thumbIndex,JSON.stringify(list));
   }catch{}
 }
 async function requestKey(key){const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(key));return new URL('/__ecp_photo__/'+[...new Uint8Array(bytes)].map(v=>v.toString(16).padStart(2,'0')).join(''),location.origin).href}
 async function trim(cache){const keys=await cache.keys();let total=0;for(let i=keys.length-1;i>=0;i--){const r=await cache.match(keys[i]);total+=Number(r?.headers.get('x-ecp-size')||0);if(total>80*1024*1024||i<keys.length-300)await cache.delete(keys[i])}}
 async function makeThumb(blob){
   try{
     let src,w,h,cleanup=()=>{};
     if('createImageBitmap'in window){src=await createImageBitmap(blob);w=src.width;h=src.height;cleanup=()=>src.close?.()}
     else{const u=URL.createObjectURL(blob);src=await new Promise((res,rej)=>{const i=new Image();i.onload=()=>res(i);i.onerror=rej;i.src=u});w=src.naturalWidth;h=src.naturalHeight;cleanup=()=>URL.revokeObjectURL(u)}
     const size=96,scale=Math.min(1,size/Math.max(w,h)),cw=Math.max(1,Math.round(w*scale)),ch=Math.max(1,Math.round(h*scale));
     const c=document.createElement('canvas');c.width=cw;c.height=ch;c.getContext('2d').drawImage(src,0,0,cw,ch);cleanup();
     return c.toDataURL('image/jpeg',.72);
   }catch{return''}
 }
 function persistThumb(bucket,path,blob){
   if(!/^(avatars|group-images)$/.test(bucket)||!path)return;
   const k=thumbKey(bucket,path);if(peekSync(bucket,path)||thumbPending.has(k))return;
   thumbPending.add(k);
   makeThumb(blob).then(data=>{if(data){try{localStorage.setItem(k,data);touchThumb(k)}catch{}}}).finally(()=>thumbPending.delete(k));
 }
 async function get(sb,user,bucket,path){
   if(!path)return'';
   const key=keyOf(user,bucket,path);
   if(hot.has(key))return hot.get(key);
   if(pending.has(key))return pending.get(key);
   const generation=epoch;
   const task=(async()=>{
     let cache,url,blob;
     try{cache=await caches.open(cacheName);url=await requestKey(key);const saved=await cache.match(url);if(saved)blob=await saved.blob()}catch{}
     if(!blob){
       const result=await sb.storage.from(bucket).download(path);if(result.error)throw result.error;blob=result.data;
       if(cache&&url&&generation===epoch){try{await cache.put(url,new Response(blob,{headers:{'Content-Type':blob.type,'x-ecp-size':String(blob.size)}}));trimWork=trimWork.then(()=>trim(cache)).catch(()=>{})}catch{}}
     }
     persistThumb(bucket,path,blob);
     if(generation!==epoch)throw new Error('Session changed');
     const object=URL.createObjectURL(blob);hot.set(key,object);
     while(hot.size>220){const oldest=hot.keys().next().value;URL.revokeObjectURL(hot.get(oldest));hot.delete(oldest)}
     return object;
   })().finally(()=>pending.delete(key));
   pending.set(key,task);return task;
 }
 async function clear(){
   epoch++;for(const url of hot.values())URL.revokeObjectURL(url);hot.clear();pending.clear();
   try{await caches.delete(cacheName)}catch{}
   try{const list=JSON.parse(localStorage.getItem(thumbIndex)||'[]');for(const k of list)localStorage.removeItem(k);localStorage.removeItem(thumbIndex)}catch{}
 }
 return {get,clear,peekSync};
})();