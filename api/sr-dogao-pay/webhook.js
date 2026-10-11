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
 let stage='asaas_lookup';
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
  // Asaas sends account-wide events, including static Pix from other systems.
  // Only route static Pix to Dogao's settlement RPC when the QR is registered here.
  if(typeof qrId==='string'&&qrId.length>0){
   stage='static_pix_ownership_lookup';
   const ownedQr=await db('srdogao_pay_payments',{query:'?select=id&asaas_pix_qr_id=eq.'+encodeURIComponent(qrId)+'&limit=1'});
   if(!Array.isArray(ownedQr))throw new Error('INVALID_STATIC_QR_LOOKUP');
   if(ownedQr.length===0){
    // Only recover a Dogao QR after verifying the Asaas payment itself.
    // The provider's externalReference must identify an existing, pending
    // Dogao payment with the exact amount and no conflicting provider ID.
    const ref=String(current.externalReference||'');
    const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if(!uuid.test(ref))return res.status(200).json({received:true,ignored:true});
    const matches=await db('srdogao_pay_payments',{query:'?select=id,amount_cents,billing_type,status,asaas_payment_id,asaas_pix_qr_id&id=eq.'+encodeURIComponent(ref)+'&limit=1'});
    if(!Array.isArray(matches))throw new Error('INVALID_STATIC_REFERENCE_LOOKUP');
    if(!matches.length)return res.status(200).json({received:true,ignored:true});
    const p=matches[0];
    if(p.billing_type!=='PIX'||Number(p.amount_cents)!==Math.round(amount*100)||
       (p.asaas_payment_id&&p.asaas_payment_id!==current.id)||
       (p.asaas_pix_qr_id&&p.asaas_pix_qr_id!==qrId))
     throw new Error('DOGAO_STATIC_PAYMENT_MISMATCH');
    if(!['CONFIRMED','RECEIVED'].includes(current.status))
     return res.status(503).json({error:'static_pix_payment_not_settled'});
    if(p.status!=='pending')throw new Error('DOGAO_STATIC_PAYMENT_REQUIRES_REVIEW');
    stage='static_pix_qr_reconciliation';
    const linked=await db('srdogao_pay_payments',{method:'PATCH',
     query:'?id=eq.'+encodeURIComponent(ref)+'&status=eq.pending&asaas_pix_qr_id=is.null&or=(asaas_payment_id.is.null,asaas_payment_id.eq.'+encodeURIComponent(current.id)+')',
     body:{asaas_pix_qr_id:qrId}
    });
    if(!Array.isArray(linked)||linked.length!==1)throw new Error('DOGAO_STATIC_QR_RECONCILIATION_CONFLICT');
   }
   if(!['CONFIRMED','RECEIVED'].includes(current.status))
    return res.status(503).json({error:'static_pix_payment_not_settled'});
   stage='static_pix_database_rpc';
   const result=await db('rpc/srdogao_pay_apply_static_pix_event',{method:'POST',body:{
    p_event_id:id,p_payment_id:current.id,p_qr_id:qrId,p_event_type:event,p_status:status,
    p_amount_cents:Math.round(amount*100),p_payload:req.body
   }});
   return res.status(200).json({received:true,processed:result===true});
  }
  // The Asaas account may serve other applications. Only process payments
  // explicitly linked to Sr. Dogao; acknowledge unrelated events safely.
  stage='payment_ownership_lookup';
  const matches=await db('srdogao_pay_payments',{query:'?select=id&asaas_payment_id=eq.'+encodeURIComponent(current.id)+'&limit=1'});
  if(!Array.isArray(matches)) throw new Error('INVALID_PAYMENT_LOOKUP');
  if(matches.length===0) return res.status(200).json({received:true,ignored:true});
  stage='payment_database_rpc';
  const result=await db('rpc/srdogao_pay_apply_event',{method:'POST',body:{
   p_event_id:id,p_payment_id:current.id,p_event_type:event,p_status:status,
   p_amount_cents:Math.round(amount*100),p_payload:req.body
  }});
  return res.status(200).json({received:true,processed:result===true});
 } catch(error) {
  console.error('dogao_webhook_processing_failed',{stage,code:String(error?.message||'unknown').slice(0,90),status:Number(error?.status)||null});
  // Do not acknowledge failed events: Asaas should retry.
  return res.status(503).json({error:'processing_unavailable'});
 }
}
