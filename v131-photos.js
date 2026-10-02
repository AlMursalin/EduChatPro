(()=>{
'use strict';
const P=window.EduPhotos;if(!P||P.__v131)return;P.__v131=true;
const prefix='ecp-photo-v131:';
const key=(user,bucket,path)=>{let h=2166136261,s=user+'|'+bucket+'|'+path;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return prefix+(h>>>0).toString(36)};
const peek=(user,bucket,path)=>{try{return localStorage.getItem(key(user,bucket,path))||''}catch{return''}};
const trim=()=>{try{const all=[];let total=0;for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k?.startsWith(prefix)){const v=localStorage.getItem(k)||'';all.push([k,v.length]);total+=v.length}}while(total>12*1024*1024&&all.length){const [k,n]=all.shift();localStorage.removeItem(k);total-=n}}catch{}};
const save=(user,bucket,path,url)=>{fetch(url).then(r=>r.blob()).then(blob=>{if(!blob||blob.size>220*1024)return;const fr=new FileReader();fr.onload=()=>{try{localStorage.setItem(key(user,bucket,path),String(fr.result||''));trim()}catch{}};fr.readAsDataURL(blob)}).catch(()=>{})};
const original=P.get.bind(P);
P.peek=peek;
P.get=async(sb,user,bucket,path)=>{
 const cached=peek(user,bucket,path);if(cached)return cached;
 const url=await original(sb,user,bucket,path);save(user,bucket,path,url);return url;
};
const oldClear=P.clear?.bind(P);P.clear=async()=>{try{for(let i=localStorage.length-1;i>=0;i--){const k=localStorage.key(i);if(k?.startsWith(prefix))localStorage.removeItem(k)}}catch{};return oldClear?oldClear():undefined};
})();