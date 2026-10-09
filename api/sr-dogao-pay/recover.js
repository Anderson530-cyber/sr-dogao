// Retrieve an existing Asaas charge without creating another one.
import { db } from './_db.js';
import { asaasRequest, environment } from './_asaas.js';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='GET')return res.status(405).json({error:'method_not_allowed'});
 if(environment()!=='production'||process.env.DOGAO_PAY_PRODUCTION_ENABLED!=='true')return res.status(503).json({error:'production_not_enabled'});
 const {orderId,token}=req.query||{};
 if(typeof orderId!=='string'||!uuid.test(orderId)||typeof token!=='string'||!uuid.test(token))return res.status(400).json({error:'invalid_credentials'});
 try{
  const orders=await db('srdogao_orders',{query:'?id=eq.'+encodeURIComponent(orderId)+'&public_token=eq.'+encodeURIComponent(token)+'&select=id,status'});
  if(!orders?.length)return res.status(404).json({error:'not_found'});
  const rows=await db('srdogao_pay_payments',{query:'?order_id=eq.'+encodeURIComponent(orderId)+'&select=id,asaas_payment_id,billing_type,status&order=created_at.desc&limit=1'});
  const p=rows?.[0];
  if(!p)return res.status(404).json({error:'no_payment'});
  if(!p.asaas_payment_id)return res.status(409).json({error:'payment_needs_reconciliation'});
  const charge=await asaasRequest('/payments/'+encodeURIComponent(p.asaas_payment_id));
  if(charge.id!==p.asaas_payment_id||charge.externalReference!==p.id)return res.status(409).json({error:'provider_mismatch'});
  if(p.billing_type==='CREDIT_CARD'){
   if(typeof charge.invoiceUrl!=='string'||!charge.invoiceUrl.startsWith('https://'))return res.status(409).json({error:'checkout_unavailable'});
   return res.status(200).json({method:'CREDIT_CARD',status:charge.status,checkout_url:charge.invoiceUrl});
  }
  if(p.billing_type==='PIX'){
   const qr=await asaasRequest('/payments/'+encodeURIComponent(p.asaas_payment_id)+'/pixQrCode');
   return res.status(200).json({method:'PIX',status:charge.status,qr_code:qr.encodedImage||null,copy_paste:qr.payload||null,expires_at:qr.expirationDate||null});
  }
  return res.status(409).json({error:'unsupported_method'});
 }catch{return res.status(503).json({error:'recovery_unavailable'});}
}
