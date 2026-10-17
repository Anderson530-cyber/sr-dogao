export async function calculateRouteDelivery(settings,destination,subtotal){
 const key=process.env.GOOGLE_MAPS_API_KEY;
 if(!key)throw Error('Google Maps não configurado');
 const origin=String(settings.deliveryOriginAddress||'').trim();
 if(!origin||!destination)throw Error('Endereço incompleto');
 const response=await fetch('https://routes.googleapis.com/directions/v2:computeRoutes',{method:'POST',headers:{'Content-Type':'application/json','X-Goog-Api-Key':key,'X-Goog-FieldMask':'routes.distanceMeters'},body:JSON.stringify({origin:{address:origin},destination:{address:destination},travelMode:'DRIVE',routingPreference:'TRAFFIC_UNAWARE'})});
 if(!response.ok)throw Error('Serviço de rotas indisponível');
 const data=await response.json(),meters=data.routes?.[0]?.distanceMeters;
 if(!Number.isFinite(meters)||meters<=0)throw Error('Rota não encontrada');
 const km=meters/1000,n=x=>{const v=Number(x);return Number.isFinite(v)&&v>=0?v:0};
 if(n(settings.deliveryMaxKm)>0&&km>n(settings.deliveryMaxKm))throw Error('Endereço fora da área de entrega');
 if(subtotal<n(settings.deliveryMinOrder))throw Error('Pedido abaixo do mínimo');
 let fee=Math.max(n(settings.deliveryMinFee),n(settings.deliveryBaseFee)+km*n(settings.deliveryPerKm));
 if(n(settings.deliveryFreeOver)>0&&subtotal>=n(settings.deliveryFreeOver))fee=0;
 return {distanceKm:Math.round(km*100)/100,deliveryFee:Math.round((fee+Number.EPSILON)*100)/100};
}
