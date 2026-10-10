// Consulta pública limitada ao pedido que possui o token secreto do cliente.
import {db} from './_db.js';
import {asaasRequest,publicPaymentStatus} from './_asaas.js';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='GET')return res.status(405).json({error:'method_not_allowed'});
 const {orderId,token}=req.query||{};
 if(typeof orderId!=='string'||!uuid.test(orderId)||typeof token!=='string'||!uuid.test(token))return res.status(400).json({error:'invalid_credentials'});
 try{
  const orders=await db('srdogao_orders',{query:'?id=eq.'+encodeURIComponent(orderId)+'&public_token=eq.'+encodeURIComponent(token)+'&select=id,status'});
  if(!orders?.length)return res.status(404).json({error:'not_found'});
  const payments=await db('srdogao_pay_payments',{query:'?order_id=eq.'+encodeURIComponent(orderId)+'&select=status,billing_type,created_at,asaas_payment_id,amount_cents&order=created_at.desc&limit=1'});
  const p=payments?.[0];let paymentStatus=p?.status||'not_created';
  if(p?.asaas_payment_id&&paymentStatus==='pending'){
   try{
    const current=await asaasRequest('/payments/'+encodeURIComponent(p.asaas_payment_id));
    if(current.id===p.asaas_payment_id&&['CONFIRMED','RECEIVED'].includes(current.status)&&Number.isInteger(p.amount_cents)&&Math.round(Number(current.value)*100)===p.amount_cents){
     const result=await db('rpc/srdogao_pay_apply_event',{method:'POST',body:{
      p_event_id:'poll-'+current.id+'-'+current.status,p_payment_id:current.id,
      p_event_type:'PAYMENT_'+current.status,p_status:publicPaymentStatus(current.status),
      p_amount_cents:p.amount_cents,p_payload:{id:'poll-'+current.id,event:'PAYMENT_'+current.status,payment:{id:current.id},source:'verified_provider_poll'}
     }});
     if(result===true){paymentStatus=publicPaymentStatus(current.status);}else{
      const updated=await db('srdogao_pay_payments',{query:'?order_id=eq.'+encodeURIComponent(orderId)+'&asaas_payment_id=eq.'+encodeURIComponent(current.id)+'&select=status&limit=1'});
      if(['confirmed','received'].includes(updated?.[0]?.status))paymentStatus=updated[0].status;
     }
    }
   }catch(error){console.error('dogao_payment_reconciliation_failed',String(error?.message||'unknown').slice(0,90));}
  }
  const verifiedOrder=paymentStatus==='confirmed'||paymentStatus==='received' ? await db('srdogao_orders',{query:'?id=eq.'+encodeURIComponent(orderId)+'&select=status'}) : null;
  return res.status(200).json({order_status:verifiedOrder?.[0]?.status||orders[0].status,payment_status:paymentStatus,method:p?.billing_type||null});
 }catch{return res.status(503).json({error:'payment_status_unavailable'});}
}
