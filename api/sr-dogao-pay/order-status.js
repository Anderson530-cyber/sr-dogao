// Order payment status. Requires both order ID and private tracking token.
import { db } from './_db.js';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export default async function handler(req,res) {
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='GET') return res.status(405).json({error:'method_not_allowed'});
 const {orderId,token}=req.query||{};
 if(typeof orderId!=='string'||!uuid.test(orderId)||typeof token!=='string'||!uuid.test(token))
  return res.status(400).json({error:'invalid_credentials'});
 try {
  const orders=await db('srdogao_orders',{query:'?select=id,status&limit=1&id=eq.'+encodeURIComponent(orderId)+'&public_token=eq.'+encodeURIComponent(token)});
  if(!Array.isArray(orders)||orders.length!==1) return res.status(404).json({error:'order_not_found'});
  const payments=await db('srdogao_pay_payments',{query:'?select=status,billing_type&order_id=eq.'+encodeURIComponent(orderId)+'&order=created_at.desc&limit=1'});
  const payment=payments?.[0];
  return res.status(200).json({
   order_status:orders[0].status,
   payment_status:payment?.status||'not_started',
   payment_method:payment?.billing_type||null
  });
 } catch {
  return res.status(503).json({error:'status_unavailable'});
 }
}
