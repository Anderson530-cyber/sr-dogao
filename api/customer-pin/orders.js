import {createHash} from 'node:crypto';
import {db} from '../sr-dogao-pay/_db.js';
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='GET')return res.status(405).json({error:'method_not_allowed'});
 const token=String(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('dogao_device='))?.slice(13);
 if(!token||!/^[a-f0-9]{64}$/.test(token))return res.status(401).json({error:'login_required'});
 try{
 const hash=createHash('sha256').update(token).digest('hex');
 const sessions=await db('srdogao_customer_devices',{query:'?token_hash=eq.'+hash+'&expires_at=gt.'+encodeURIComponent(new Date().toISOString())+'&select=customer_id,srdogao_customer_profiles!inner(cpf)'});
 const cpf=sessions?.[0]?.srdogao_customer_profiles?.cpf;
 if(!cpf)return res.status(401).json({error:'login_required'});
 const orders=await db('srdogao_orders',{query:'?customer_cpf=eq.'+encodeURIComponent(cpf)+'&select=id,public_token,status,created_at&order=created_at.desc&limit=20'});
 return res.json({orders:(orders||[]).map(o=>({id:o.id,token:o.public_token,status:o.status,created_at:o.created_at}))});
 }catch(e){console.error('dogao_order_history_error',String(e.message).slice(0,80));return res.status(503).json({error:'unavailable'})}
}