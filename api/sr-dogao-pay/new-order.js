import {db} from './_db.js';
const money=n=>Math.round(Number(n)*100);
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='POST')return res.status(405).json({error:'method_not_allowed'});
 if(process.env.DOGAO_PAY_PRODUCTION_ENABLED!=='true')return res.status(503).json({error:'payments_disabled'});
 try{
  const {customer,items,address}=req.body||{};
  const name=String(customer?.name||'').trim(),phone=String(customer?.phone||'').replace(/\D/g,'');
  if(name.length<2||name.length>120||phone.length<10||phone.length>11||!Array.isArray(items)||!items.length||items.length>40||!address||typeof address!=='object')
   return res.status(400).json({error:'invalid_order'});
  const normalized=items.map(x=>({id:Number(x.id),qty:Number(x.qty)}));
  if(normalized.some(x=>!Number.isSafeInteger(x.id)||!Number.isSafeInteger(x.qty)||x.qty<1||x.qty>30))
   return res.status(400).json({error:'invalid_items'});
  const ids=[...new Set(normalized.map(x=>x.id))];
  const products=await db('srdogao_products',{query:'?id=in.('+ids.join(',')+')&available=eq.true&select=id,name,price,promo,promo_price'});
  if(!Array.isArray(products)||products.length!==ids.length)return res.status(409).json({error:'products_unavailable'});
  const byId=new Map(products.map(p=>[Number(p.id),p]));
  const orderItems=normalized.map(x=>{
   const p=byId.get(x.id),price=Number(p.promo&&p.promo_price!=null?p.promo_price:p.price);
   if(!p||!Number.isFinite(price)||price<=0)throw Error('INVALID_PRICE');
   return {id:x.id,name:p.name,price:money(price)/100,qty:x.qty,quantity:x.qty,total:money(price)*x.qty/100};
  });
  const subtotalCents=orderItems.reduce((sum,x)=>sum+money(x.price)*x.qty,0);
  const settings=await db('srdogao_settings',{query:'?key=eq.site&select=value'});
  const fee=Number(settings?.[0]?.value?.deliveryFee||0);
  if(!Number.isFinite(fee)||fee<0)throw Error('INVALID_FEE');
  const totalCents=subtotalCents+money(fee);
  if(totalCents<=0||totalCents>10000000)return res.status(400).json({error:'invalid_total'});
  const created=await db('rpc/srdogao_create_order',{method:'POST',body:{
   p_customer_name:name,p_customer_phone:phone,p_address:address,p_delivery_type:'delivery',
   p_payment:'PIX',p_items:orderItems,p_subtotal:subtotalCents/100,p_discount:0,
   p_total:totalCents/100,p_order_timing:'now'
  }});
  if(!created?.id||!created?.public_token)throw Error('CREATE_FAILED');
  return res.status(201).json({order_id:created.id,token:created.public_token,total:totalCents/100,status:'pending_payment'});
 }catch(e){console.error('Dogao order creation',e.message);return res.status(503).json({error:'order_creation_failed'});}
}
