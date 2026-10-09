// Sr. Dogão Pay: sandbox PIX, restricted to existing orders and their tracking token.
// Requires ASAAS_ENV=sandbox, SRDOGAO_PAY_SANDBOX_ENABLED=true and backend secrets.
// Never accepts amounts or Asaas customer IDs from the browser.
import { db, orderAmountCents } from './_db.js';
import { asaasRequest, environment } from './_asaas.js';

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export default async function handler(req,res) {
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='POST') return res.status(405).json({error:'method_not_allowed'});
 if(environment()!=='sandbox'||process.env.SRDOGAO_PAY_SANDBOX_ENABLED!=='true')
  return res.status(503).json({error:'sandbox_disabled'});
 const {orderId,token}=req.body||{};
 if(typeof orderId!=='string'||!uuid.test(orderId)||typeof token!=='string'||!uuid.test(token))
  return res.status(400).json({error:'invalid_order_credentials'});
 try {
  const orders=await db('srdogao_orders',{query:'?select=id,public_token,total,status,customer_name&limit=1&id=eq.'+encodeURIComponent(orderId)+'&public_token=eq.'+encodeURIComponent(token)});
  const order=orders?.[0];
  if(!order) return res.status(404).json({error:'order_not_found'});
  if(order.status==='cancelled') return res.status(409).json({error:'order_cancelled'});
  const cents=orderAmountCents(order);
  const existing=await db('srdogao_pay_payments',{query:'?select=asaas_payment_id,status,amount_cents&order_id=eq.'+encodeURIComponent(orderId)+'&billing_type=eq.PIX&order=created_at.desc&limit=1'});
  if(existing?.length) return res.status(409).json({error:'payment_already_exists',status:existing[0].status});
  // Fail closed: customer identity is not yet safely mapped to an Asaas customer.
  // Creating a charge here without an atomic reservation would risk duplicate payments.
  return res.status(503).json({error:'asaas_customer_mapping_pending',validated_amount_cents:cents});
 } catch {
  return res.status(503).json({error:'payment_unavailable'});
 }
}
