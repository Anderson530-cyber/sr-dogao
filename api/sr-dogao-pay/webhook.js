// Asaas webhook: authenticated, provider-verified, atomically persisted.
// Never updates restaurant order fulfillment state.
import { asaasRequest, publicPaymentStatus } from './_asaas.js';
import { db } from './_db.js';
export default async function handler(req,res) {
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='POST') return res.status(405).json({error:'method_not_allowed'});
 const secret=process.env.ASAAS_WEBHOOK_TOKEN;
 if(!secret) return res.status(503).json({error:'webhook_not_configured'});
 if(typeof req.headers['asaas-access-token']!=='string'||req.headers['asaas-access-token']!==secret)
  return res.status(401).json({error:'unauthorized'});
 const {id,event,payment}=req.body||{};
 if(typeof id!=='string'||!id||typeof event!=='string'||!event||typeof payment?.id!=='string'||!payment.id)
  return res.status(400).json({error:'invalid_event'});
 try {
  const current=await asaasRequest('/payments/'+encodeURIComponent(payment.id));
  if(current.id!==payment.id) return res.status(422).json({error:'payment_mismatch'});
  const amount=Number(current.value);
  if(!Number.isFinite(amount)||amount<=0||Math.abs(amount*100-Math.round(amount*100))>0.00001)
   return res.status(422).json({error:'invalid_provider_amount'});
  const status=publicPaymentStatus(current.status);
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
