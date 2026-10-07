self.addEventListener('push',event=>{
  let data={};try{data=event.data?event.data.json():{}}catch(e){}
  const title=data.title||'Sr. Dogão';
  const options={body:data.body||'Atualização do seu pedido.',icon:'/sr-dogao-logo.png',badge:'/sr-dogao-logo.png',tag:data.tag||'srdogao-order',data:{url:data.url||'/carrinho/'},vibrate:[200,100,200]};
  event.waitUntil(self.registration.showNotification(title,options));
});
self.addEventListener('notificationclick',event=>{
  event.notification.close();
  const url=event.notification?.data?.url||'/carrinho/';
  event.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(list=>{
    for(const c of list){if('focus' in c){c.navigate(url);return c.focus()}}
    if(clients.openWindow)return clients.openWindow(url);
  }));
});
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));