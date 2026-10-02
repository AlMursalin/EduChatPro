(()=>{
'use strict';
if(window.__ECP_V155_RUNTIME)return;window.__ECP_V155_RUNTIME=true;
const q=(s,r=document)=>r.querySelector(s),qa=(s,r=document)=>[...r.querySelectorAll(s)];
const state=()=>{try{return typeof S!=='undefined'?S:null}catch{return null}};
const photos=window.EduPhotos;
if(photos?.clear){photos.clear=async()=>{};}
if(window.EduWorkspace?.photos&&photos?.peek){
  const originalPhotos=window.EduWorkspace.photos.bind(window.EduWorkspace);
  window.EduWorkspace.photos=async(root,sb)=>{
    const session=await sb.auth.getSession(),user=session.data.session?.user?.id;
    if(!user)return;
    const images=qa('[data-photo]',root);
    await Promise.all(images.map(async img=>{
      const cached=await photos.peek(img.dataset.bucket,img.dataset.photo);
      if(cached&&img.isConnected)img.src=cached;
    }));
    return originalPhotos(root,sb);
  };
}
window.EduGroupPollsRemainAvailable=true;
})();