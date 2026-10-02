(()=>{
'use strict';
const P=window.EduPhotos;if(!P||P.__v138)return;P.__v138=true;
const prefix='ecp-photo-v138:';
const key=(user,bucket,path)=>{let h=2166136261,s=user+'|'+bucket+'|'+path;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return prefix+(h>>>0).toString(36)};
const unpack=v=>{try{const x=JSON.parse(v||'null');return x&&x.data?x:null}catch{return v?{data:v,t:0}:null}};
const peek=(user,bucket,path)=>{try{return unpack(localStorage.getItem(key(user,bucket,path)))?.data||''}catch{return''}};
const trim=()=>{try{const all=[];let total=0;for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k?.startsWith(prefix)){const v=localStorage.getItem(k)||'';all.push([k,v.length,unpack(v)?.t||0]);total+=v.length}}all.sort((a,b)=>a[2]-b[2]);while(total>18*1024*1024&&all.length){const [k,n]=all.shift();localStorage.removeItem(k);total-=n}}catch{}};
const toData=async url=>{const r=await fetch(url,{cache:'force-cache'});if(!r.ok)throw new Error('avatar '+r.status);const blob=await r.blob();if(!blob||blob.size>350*1024)return'';return await new Promise(res=>{const fr=new FileReader();fr.onload=()=>res(String(fr.result||''));fr.onerror=()=>res('');fr.readAsDataURL(blob)})};
const store=(user,bucket,path,data)=>{if(!data)return;try{localStorage.setItem(key(user,bucket,path),JSON.stringify({t:Date.now(),data}));trim()}catch{}};
const original=P.get.bind(P),refreshing=new Map();
async function refresh(sb,user,bucket,path,cached){const k=key(user,bucket,path);if(refreshing.has(k))return refreshing.get(k);const task=(async()=>{try{const url=await original(sb,user,bucket,path);const data=await toData(url);if(data&&data!==cached){store(user,bucket,path,data);window.dispatchEvent(new CustomEvent('educhat-avatar-updated',{detail:{user,bucket,path,url:data}}))}}catch{}finally{refreshing.delete(k)}})();refreshing.set(k,task);return task}
P.peek=peek;
P.get=async(sb,user,bucket,path)=>{const cached=peek(user,bucket,path);if(cached){refresh(sb,user,bucket,path,cached);return cached}const url=await original(sb,user,bucket,path);try{const data=await toData(url);if(data){store(user,bucket,path,data);return data}}catch{}return url};
const oldClear=P.clear?.bind(P);P.clear=async()=>{try{for(let i=localStorage.length-1;i>=0;i--){const k=localStorage.key(i);if(k?.startsWith(prefix))localStorage.removeItem(k)}}catch{};return oldClear?oldClear():undefined};
})();