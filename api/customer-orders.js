import {createHash} from 'node:crypto';
import {db} from './sr-dogao-pay/_db.js';
const digits=v=>String(v||'').replace(/\D/g,'');
const hash=v=>createHash('sha256').update(v).digest('hex');
function deviceToken(req){return String(req.headers.cookie||'').split(';').map(v=>v.trim()).find(v=>v.startsWith('dogao_device='))?.slice(13)||''}
export default async function handler(req,res){
 res.setHeader('Cache-Control','private, no-store');
 if(req.method!=='GET')return res.status(405).json({error:'method_not_allowed'});
 const cpf=digits(req.query?.cpf),token=deviceToken(req);
 if(!/^\d{11}$/.test(cpf)||!token)return res.status(401).json({error:'authentication_required'});
 try{
  const rows=await db('srdogao_customer_devices',{query:'?token_hash=eq.'+hash(token)+'&expires_at=gt.'+encodeURIComponent(new Date().toISOString())+'&select=customer_id,srdogao_customer_profiles!inner(cpf)'});
  if(!rows?.[0]||rows[0].srdogao_customer_profiles?.cpf!==cpf)return res.status(401).json({error:'session_expired'});
  const orders=await db('srdogao_orders',{query:'?customer_cpf=eq.'+cpf+'&select=id,created_at,status,total,items,public_token&order=created_at.desc&limit=30'});
  return res.status(200).json({ok:true,orders:Array.isArray(orders)?orders:[]});
 }catch(e){console.error('customer_orders_failed',e.message);return res.status(503).json({error:'service_unavailable'})}
}