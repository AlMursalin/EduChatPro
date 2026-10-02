(()=>{
'use strict';
if(window.EduPersistentCache?.version>=150)return;
const DB='educhatpro-device-cache-v150',VER=1;
let dbp;
function db(){
  if(dbp)return dbp;
  dbp=new Promise((resolve,reject)=>{
    const r=indexedDB.open(DB,VER);
    r.onupgradeneeded=()=>{
      const d=r.result;
      if(!d.objectStoreNames.contains('photos'))d.createObjectStore('photos',{keyPath:'key'});
      if(!d.objectStoreNames.contains('chat'))d.createObjectStore('chat',{keyPath:'key'});
    };
    r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);
  });
  return dbp;
}
async function get(store,key){try{const d=await db();return await new Promise((res,rej)=>{const r=d.transaction(store,'readonly').objectStore(store).get(key);r.onsuccess=()=>res(r.result||null);r.onerror=()=>rej(r.error)})}catch{return null}}
async function put(store,value){try{const d=await db();return await new Promise((res,rej)=>{const r=d.transaction(store,'readwrite').objectStore(store).put(value);r.onsuccess=()=>res(value);r.onerror=()=>rej(r.error)})}catch{return null}}
async function del(store,key){try{const d=await db();return await new Promise((res,rej)=>{const r=d.transaction(store,'readwrite').objectStore(store).delete(key);r.onsuccess=()=>res();r.onerror=()=>rej(r.error)})}catch{}}
const photoUrls=new Map();
const pkey=(bucket,path)=>bucket+'|'+path;
function blobUrl(key,blob){
  const hit=photoUrls.get(key);if(hit)return hit;
  const u=URL.createObjectURL(blob);photoUrls.set(key,u);return u;
}
async function fetchBlob(url){const r=await fetch(url,{cache:'force-cache'});if(!r.ok)throw new Error('Photo '+r.status);return await r.blob()}
async function installPhotoCache(){
  const P=window.EduPhotos;if(!P?.get||P.__persistentV150)return;
  P.__persistentV150=true;
  const orig=P.get.bind(P);
  P.get=async(sb,user,bucket,path)=>{
    if(!path)return orig(sb,user,bucket,path);
    const key=pkey(bucket,path),cached=await get('photos',key);
    if(cached?.blob)return blobUrl(key,cached.blob);
    const signed=await orig(sb,user,bucket,path);
    try{
      const blob=await fetchBlob(signed);
      await put('photos',{key,bucket,path,blob,size:blob.size,type:blob.type,checkedAt:Date.now()});
      return blobUrl(key,blob);
    }catch{return signed}
  };
  P.peek=async(bucket,path)=>{const c=await get('photos',pkey(bucket,path));return c?.blob?blobUrl(pkey(bucket,path),c.blob):''};
  P.invalidate=async(bucket,path)=>{const key=pkey(bucket,path),u=photoUrls.get(key);if(u){URL.revokeObjectURL(u);photoUrls.delete(key)}await del('photos',key)};
}
window.EduPersistentCache={version:151,get,put,del,installPhotoCache};
installPhotoCache();
const timer=setInterval(()=>installPhotoCache(),1000);setTimeout(()=>clearInterval(timer),30000);
})();