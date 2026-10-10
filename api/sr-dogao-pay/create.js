// Dogão Pay: real Asaas charges remain disabled until end-to-end payment verification is deployed.
import { db } from './_db.js';
import { asaasRequest, environment } from './_asaas.js';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export default async function handler(req,res) {
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='POST') return res.status(405).json({error:'method_not_allowed'});
 if(environment()!=='production'||process.env.DOGAO_PAY_PRODUCTION_ENABLED!=='true')
  return res.status(503).json({error:'production_not_enabled'});
 const {orderId,token,method}=req.body||{};
 if(!['PIX','CREDIT_CARD'].includes(method)) return res.status(400).json({error:'invalid_method'});
 if(typeof orderId!=='string'||!uuid.test(orderId)||typeof token!=='string'||!uuid.test(token))
  return res.status(400).json({error:'invalid_credentials'});
 
 if(!process.env.ASAAS_API_KEY) return res.status(503).json({error:'asaas_production_not_configured'});
  let reservation;
 try {
  const rows=await db('rpc/srdogao_pay_reserve',{method:'POST',body:{
   p_order_id:orderId,p_token:token,p_method:method
  }});
  reservation=rows?.[0];
  if(!reservation?.payment_id||!Number.isSafeInteger(Number(reservation.amount_cents)))
   return res.status(503).json({error:'reservation_failed'});
 } catch {
  return res.status(409).json({error:'order_unavailable_or_payment_exists'});
 }
 let stage='order_lookup';
 try {
  const orders=await db('srdogao_orders',{query:'?id=eq.'+encodeURIComponent(orderId)+'&select=id,customer_name,customer_phone,customer_cpf'});
  const order=orders?.[0];
  if(!order?.customer_name||!order?.customer_phone||!/^\d{11}$/.test(order.customer_cpf||'')) throw new Error('missing_customer');
  stage='asaas_customer_creation';
  const customerResponse=await asaasRequest('/customers',{method:'POST',body:{
   name:order.customer_name,cpfCnpj:order.customer_cpf,mobilePhone:String(order.customer_phone).replace(/\D/g,''),
   externalReference:'dogao-order-'+orderId
  }});
  if(!customerResponse?.id)throw new Error('missing_customer_id');
  stage='asaas_charge_creation';
  const payment=await asaasRequest('/payments',{method:'POST',body:{
   customer:customerResponse.id,billingType:method,value:Number(reservation.amount_cents)/100,
   dueDate:new Date(Date.now()+86400000).toISOString().slice(0,10),
   externalReference:reservation.payment_id,
   description:'Dogão Pay - pedido '+orderId
  }});
  if(typeof payment.id!=='string') throw new Error('missing_payment_id');
  stage='payment_id_sync';
  const synced=await db('srdogao_pay_payments',{method:'PATCH',
   query:'?id=eq.'+encodeURIComponent(reservation.payment_id)+'&asaas_payment_id=is.null',
   body:{asaas_payment_id:payment.id}
  });
  if(!Array.isArray(synced)||synced.length!==1) throw new Error('PAYMENT_SYNC_FAILED');
  if(method==='CREDIT_CARD') {
   if(typeof payment.invoiceUrl!=='string'||!payment.invoiceUrl.startsWith('https://'))
    throw new Error('missing_secure_invoice');
   return res.status(200).json({payment_id:reservation.payment_id,status:'pending',method,checkout_url:payment.invoiceUrl});
  }
  stage='pix_qr_creation';
  const qr=await asaasRequest('/payments/'+encodeURIComponent(payment.id)+'/pixQrCode');
  if(typeof qr.payload!=='string'||!qr.payload) throw new Error('PIX_PAYLOAD_MISSING');
  return res.status(200).json({payment_id:reservation.payment_id,status:'pending',method,
   qr_code:qr.encodedImage||null,copy_paste:qr.payload,expires_at:qr.expirationDate||null});
 } catch(error) {
  console.error('Dogao Pay charge failed',stage,error?.message,error?.status||'');
  // A reservation may already have generated a provider charge.
  // Do not release it or retry automatically: reconciliation is required.
  return res.status(503).json({error:'payment_creation_or_sync_failed',payment_id:reservation.payment_id,stage,provider_status:Number.isInteger(error?.status)?error.status:null,diagnostic_code:typeof error?.message==='string' && /^(ASAAS_[A-Z_]+|PIX_[A-Z_]+)$/.test(error.message)?error.message:null});
 }
}
