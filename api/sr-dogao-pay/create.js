// Sr. Dogão Pay — payment preparation for PIX and CREDIT_CARD (sandbox only).
// Credit card details are never collected by this endpoint: use Asaas hosted checkout.
import { db, orderAmountCents } from './_db.js';
import { environment } from './_asaas.js';

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export default async function handler(req,res) {
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='POST') return res.status(405).json({error:'method_not_allowed'});
 if(environment()!=='sandbox'||process.env.SRDOGAO_PAY_SANDBOX_ENABLED!=='true')
  return res.status(503).json({error:'sandbox_disabled'});
 const {orderId,token,method}=req.body||{};
 if(!['PIX','CREDIT_CARD'].includes(method))
  return res.status(400).json({error:'invalid_payment_method'});
 if(typeof orderId!=='string'||!uuid.test(orderId)||typeof token!=='string'||!uuid.test(token))
  return res.status(400).json({error:'invalid_order_credentials'});
 try {
  const orders=await db('srdogao_orders',{query:'?select=id,total,status&limit=1&id=eq.'+encodeURIComponent(orderId)+'&public_token=eq.'+encodeURIComponent(token)});
  const order=orders?.[0];
  if(!order) return res.status(404).json({error:'order_not_found'});
  if(order.status==='cancelled') return res.status(409).json({error:'order_cancelled'});
  const cents=orderAmountCents(order);
  // A single active payment per order must be reserved atomically before
  // creating an Asaas charge or hosted checkout session.
  const existing=await db('srdogao_pay_payments',{query:'?select=status,billing_type&order_id=eq.'+encodeURIComponent(orderId)+'&order=created_at.desc&limit=1'});
  if(existing?.length) return res.status(409).json({error:'payment_already_exists',status:existing[0].status});
  // Fail closed until Asaas customer mapping, atomic reservation and hosted
  // checkout callback verification are implemented and tested.
  return res.status(503).json({
   error:method==='CREDIT_CARD'?'card_checkout_integration_pending':'pix_integration_pending',
   method,validated_amount_cents:cents
  });
 } catch {
  return res.status(503).json({error:'payment_unavailable'});
 }
}
