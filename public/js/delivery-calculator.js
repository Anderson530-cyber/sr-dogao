/* Sr. Dogão — motor de cálculo de entrega (não conectado ao checkout).
 * Valores e distâncias devem ser calculados/validados novamente no servidor antes de cobrar.
 */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.SrDogaoDelivery=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const clean=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase();
  function number(v){
    const n=Number(typeof v==='string'?v.trim().replace(',','.'):v);
    return Number.isFinite(n)&&n>=0?n:null;
  }
  const round=n=>Math.round((n+Number.EPSILON)*100)/100;
  function regions(text){
    return String(text||'').split(/\r?\n/).filter(x=>x.trim()).map((line,i)=>{
      const parts=line.split('|').map(x=>x.trim());
      if(parts.length!==3||!parts[0]||!parts[1]||number(parts[2])===null)throw Error('Região inválida na linha '+(i+1));
      return {city:clean(parts[0]),district:clean(parts[1]),fee:number(parts[2])};
    });
  }
  function calculate(settings,request){
    const mode=settings.deliveryMode||'fixa',subtotal=number(request.subtotal);
    if(subtotal===null)return {ok:false,reason:'Subtotal inválido'};
    const minOrder=number(settings.deliveryMinOrder)||0;
    if(subtotal<minOrder)return {ok:false,reason:'Pedido abaixo do mínimo'};
    if(request.pickup)return {ok:true,fee:0,source:'pickup'};
    const freeOver=number(settings.deliveryFreeOver)||0;
    const km=number(request.routeKm),maxKm=number(settings.deliveryMaxKm)||0;
    if(maxKm>0&&km!==null&&km>maxKm)return {ok:false,reason:'Fora da área de entrega'};
    let fee=null,source=mode;
    if(mode==='km'){
      if(km===null)return {ok:false,reason:'Distância da rota ainda não calculada'};
      fee=Math.max(number(settings.deliveryMinFee)||0,(number(settings.deliveryBaseFee)||0)+km*(number(settings.deliveryPerKm)||0));
    }else if(mode==='bairro'||mode==='cidade'){
      const city=clean(request.city),district=clean(request.district);
      if(!city||(mode==='bairro'&&!district))return {ok:false,reason:'Endereço incompleto'};
      let rules;
      try{rules=regions(settings.deliveryRegionRules)}catch(e){return {ok:false,reason:e.message}}
      const match=mode==='bairro'?rules.find(r=>r.city===city&&r.district===district)||rules.find(r=>r.city===city&&r.district==='*'):rules.find(r=>r.city===city&&r.district==='*');
      if(!match)return {ok:false,reason:'Região sem taxa cadastrada'};
      fee=match.fee;
    }else if(mode==='fixa'){
      fee=number(settings.deliveryFee);
      if(fee===null)return {ok:false,reason:'Taxa fixa não configurada'};
    }else return {ok:false,reason:'Modalidade desconhecida'};
    if(freeOver>0&&subtotal>=freeOver)fee=0;
    return {ok:true,fee:round(fee),source};
  }
  return {calculate,regions};
});
