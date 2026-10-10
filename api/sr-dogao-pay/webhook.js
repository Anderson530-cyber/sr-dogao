// Asaas webhook: authenticated, provider-verified, atomically persisted.
// The database releases orders only after a verified, matching payment.
import { asaasRequest, publicPaymentStatus } from './_asaas.js';
import { db } from './_db.js';
import { timingSafeEqual } from 'node:crypto';
const acceptedEvents=new Set(['PAYMENT_CONFIRMED','PAYMENT_RECEIVED','PAYMENT_DELETED','PAYMENT_REFUNDED','PAYMENT_OVERDUE','PAYMENT_CREATED','PAYMENT_UPDATED','PAYMENT_CHARGEBACK_REQUESTED','PAYMENT_CHARGEBACK_DISPUTE']);
export default async function handler(req,res) {
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='POST') return res.status(405).json({error:'method_not_allowed'});
 const secret=process.env.ASAAS_WEBHOOK_TOKEN;
 if(!secret) return res.status(503).json({error:'webhook_not_configured'});
 const supplied=req.headers['asaas-access-token'];
 if(typeof supplied!=='string'||Buffer.byteLength(supplied)!==Buffer.byteLength(secret)||!timingSafeEqual(Buffer.from(supplied),Buffer.from(secret)))
  return res.status(401).json({error:'unauthorized'});
 const {id,event,payment}=req.body||{};
 if(typeof id!=='string'||id.length>180||!id||!acceptedEvents.has(event)||typeof payment?.id!=='string'||!payment.id||payment.id.length>180)
  return res.status(400).json({error:'invalid_event'});
 try {
  const current=await asaasRequest('/payments/'+encodeURIComponent(payment.id));
  if(current.id!==payment.id) return res.status(422).json({error:'payment_mismatch'});
  // Reject unknown provider states rather than interpreting them as unpaid and acknowledging them.
  const recognized=new Set(['PENDING','CONFIRMED','RECEIVED','OVERDUE','REFUNDED','DELETED','REFUND_REQUESTED']);
  if(!recognized.has(current.status)) return res.status(503).json({error:'unsupported_provider_status'});
  const amount=Number(current.value);
  if(!Number.isFinite(amount)||amount<=0||Math.abs(amount*100-Math.round(amount*100))>0.00001)
   return res.status(422).json({error:'invalid_provider_amount'});
  const status=publicPaymentStatus(current.status);
  // For static Pix, Asaas creates the payment after receipt. Verify it with Asaas,
  // match its QR identifier and settle atomically; never trust webhook body alone.
  const qrId=current.pixQrCodeId;
  if(typeof qrId==='string'&&qrId.length>0){
   if(!['CONFIRMED','RECEIVED'].includes(current.status))
    return res.status(503).json({error:'static_pix_payment_not_settled'});
   const result=await db('rpc/srdogao_pay_apply_static_pix_event',{method:'POST',body:{
    p_event_id:id,p_payment_id:current.id,p_qr_id:qrId,p_event_type:event,p_status:status,
    p_amount_cents:Math.round(amount*100),p_payload:req.body
   }});
   return res.status(200).json({received:true,processed:result===true});
  }
  const result=await db('rpc/srdogao_pay_apply_event',{method:'POST',body:{
   p_event_id:id,p_payment_id:current.id,p_event_type:event,p_status:status,
   p_amount_cents:Math.round(amount*100),p_payload:req.body
  }});
  return res.status(200).json({received:true,processed:result===true});
 } catch {
  // Do not acknowledge failed events: Asaas should retry.
  return res.status(503).json({error:'processing_unavailable'});
 }
}
