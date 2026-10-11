import {createHash} from 'node:crypto';
import {db} from '../sr-dogao-pay/_db.js';
export default async function handler(req,res){
 res.setHeader('Cache-Control','private, no-store');
 if(req.method!=='GET')return res.status(405).json({error:'method_not_allowed'});
 const token=String(req.headers.cookie||'').split(';').map(v=>v.trim()).find(v=>v.startsWith('dogao_device='))?.slice(13);
 if(!token||!/^[a-f0-9]{64}$/.test(token))return res.status(401).json({error:'login_required'});
 try{
  const hash=createHash('sha256').update(token).digest('hex');
  const sessions=await db('srdogao_customer_devices',{query:'?token_hash=eq.'+hash+'&expires_at=gt.'+encodeURIComponent(new Date().toISOString())+'&select=customer_id,srdogao_customer_profiles!inner(cpf)'});
  const session=sessions?.[0];
  if(!session?.customer_id)return res.status(401).json({error:'login_required'});
  const entries=await db('srdogao_customer_points',{query:'?customer_id=eq.'+encodeURIComponent(session.customer_id)+'&select=points_delta,reason,created_at,order_id&order=created_at.desc&limit=100'});
  const balance=(entries||[]).reduce((sum,item)=>sum+Number(item.points_delta||0),0);
  return res.status(200).json({points:Math.max(0,balance),history:entries||[]});
 }catch(e){console.error('dogao_points_error',String(e.message).slice(0,90));return res.status(503).json({error:'unavailable'})}
}