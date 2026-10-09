// Consulta pública limitada ao pedido que possui o token secreto do cliente.
import {db} from './_db.js';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='GET')return res.status(405).json({error:'method_not_allowed'});
 const {orderId,token}=req.query||{};
 if(typeof orderId!=='string'||!uuid.test(orderId)||typeof token!=='string'||!uuid.test(token))return res.status(400).json({error:'invalid_credentials'});
 try{
  const orders=await db('srdogao_orders',{query:'?id=eq.'+encodeURIComponent(orderId)+'&public_token=eq.'+encodeURIComponent(token)+'&select=id,status'});
  if(!orders?.length)return res.status(404).json({error:'not_found'});
  const payments=await db('srdogao_pay_payments',{query:'?order_id=eq.'+encodeURIComponent(orderId)+'&select=status,billing_type,created_at&order=created_at.desc&limit=1'});
  return res.status(200).json({order_status:orders[0].status,payment_status:payments?.[0]?.status||'not_created',method:payments?.[0]?.billing_type||null});
 }catch{return res.status(503).json({error:'payment_status_unavailable'});}
}
