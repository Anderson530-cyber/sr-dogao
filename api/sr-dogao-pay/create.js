// Asaas sandbox PIX payment creation. Card remains disabled until hosted checkout
// contract is integrated. All charges require server-side atomic order reservation.
import { db } from './_db.js';
import { asaasRequest, environment } from './_asaas.js';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export default async function handler(req,res) {
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='POST') return res.status(405).json({error:'method_not_allowed'});
 if(environment()!=='sandbox'||process.env.SRDOGAO_PAY_SANDBOX_ENABLED!=='true')
  return res.status(503).json({error:'sandbox_disabled'});
 const {orderId,token,method}=req.body||{};
 if(!['PIX','CREDIT_CARD'].includes(method)) return res.status(400).json({error:'invalid_method'});
 if(typeof orderId!=='string'||!uuid.test(orderId)||typeof token!=='string'||!uuid.test(token))
  return res.status(400).json({error:'invalid_credentials'});
 if(method==='CREDIT_CARD') return res.status(503).json({error:'hosted_card_checkout_pending'});
 // Customer mapping must be a trusted server-side Asaas customer ID.
 const customer=process.env.ASAAS_SANDBOX_CUSTOMER_ID;
 if(!customer||!process.env.ASAAS_API_KEY) return res.status(503).json({error:'asaas_sandbox_not_configured'});
 let reservation;
 try {
  const rows=await db('rpc/srdogao_pay_reserve',{method:'POST',body:{
   p_order_id:orderId,p_token:token,p_method:'PIX'
  }});
  reservation=rows?.[0];
  if(!reservation?.payment_id||!Number.isSafeInteger(Number(reservation.amount_cents)))
   return res.status(503).json({error:'reservation_failed'});
 } catch {
  return res.status(409).json({error:'order_unavailable_or_payment_exists'});
 }
 try {
  const payment=await asaasRequest('/payments',{method:'POST',body:{
   customer,billingType:'PIX',value:Number(reservation.amount_cents)/100,
   dueDate:new Date(Date.now()+86400000).toISOString().slice(0,10),
   externalReference:reservation.payment_id,
   description:'Sr. Dogão pedido '+orderId
  }});
  if(typeof payment.id!=='string') throw new Error('missing_payment_id');
  await db('srdogao_pay_payments',{method:'PATCH',
   query:'?id=eq.'+encodeURIComponent(reservation.payment_id),
   body:{asaas_payment_id:payment.id}
  });
  const qr=await asaasRequest('/payments/'+encodeURIComponent(payment.id)+'/pixQrCode');
  return res.status(200).json({
   payment_id:reservation.payment_id,
   status:'pending',method:'PIX',
   qr_code:qr.encodedImage||null,
   copy_paste:qr.payload||null,
   expires_at:qr.expirationDate||null
  });
 } catch {
  // A reservation may already have generated a provider charge.
  // Do not release it or retry automatically: reconciliation is required.
  return res.status(503).json({error:'payment_creation_or_sync_failed',payment_id:reservation.payment_id});
 }
}
