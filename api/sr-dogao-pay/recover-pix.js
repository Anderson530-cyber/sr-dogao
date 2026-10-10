import {db} from './_db.js';
import {asaasRequest} from './_asaas.js';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='POST')return res.status(405).json({error:'method_not_allowed'});
 const {orderId,token}=req.body||{};
 if(typeof orderId!=='string'||!uuid.test(orderId)||typeof token!=='string'||!uuid.test(token))return res.status(400).json({error:'invalid_credentials'});
 try{
  const orders=await db('srdogao_orders',{query:'?id=eq.'+encodeURIComponent(orderId)+'&public_token=eq.'+encodeURIComponent(token)+'&select=id'});
  if(!orders?.length)return res.status(404).json({error:'not_found'});
  const rows=await db('srdogao_pay_payments',{query:'?order_id=eq.'+encodeURIComponent(orderId)+'&select=asaas_payment_id,status,amount_cents,billing_type&order=created_at.desc&limit=1'});
  const p=rows?.[0];
  if(!p?.asaas_payment_id)return res.status(409).json({error:'pix_not_available'});
  if(p.billing_type!=='PIX')return res.status(409).json({error:'not_pix'});
  const payment=await asaasRequest('/payments/'+encodeURIComponent(p.asaas_payment_id));
  if(payment.id!==p.asaas_payment_id||Math.round(Number(payment.value)*100)!==p.amount_cents)return res.status(409).json({error:'payment_mismatch'});
  if(['RECEIVED','CONFIRMED'].includes(payment.status))return res.json({status:'paid'});
  if(payment.status!=='PENDING')return res.status(409).json({error:'payment_not_pending'});
  const qr=await asaasRequest('/payments/'+encodeURIComponent(payment.id)+'/pixQrCode');
  if(!qr?.payload)return res.status(503).json({error:'qr_unavailable'});
  return res.json({status:'pending',copy_paste:qr.payload,qr_code:qr.encodedImage||null,expires_at:qr.expirationDate||null});
 }catch(error){console.error('dogao_existing_pix_lookup_failed',String(error?.message||'unknown').slice(0,90));return res.status(503).json({error:'lookup_unavailable'});}
}