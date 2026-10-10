import {randomBytes,createHash} from 'node:crypto';
import {db} from './sr-dogao-pay/_db.js';
const hash=v=>createHash('sha256').update(v).digest('hex');
const cookieToken=req=>String(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('dogao_device='))?.slice(13)||'';
const clearCookie='dogao_device=; HttpOnly; Secure; SameSite=Lax; Path=/api/customer-pin; Max-Age=0';
const digits=v=>String(v||'').replace(/\D/g,'');
function validCpf(v){if(!/^\d{11}$/.test(v)||/^(\d)\1{10}$/.test(v))return false;for(let n=9;n<=10;n++){let sum=0;for(let i=0;i<n;i++)sum+=Number(v[i])*(n+1-i);let d=sum*10%11;if(d===10)d=0;if(d!==Number(v[n]))return false;}return true;}
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='POST')return res.status(405).json({error:'method_not_allowed'});
 const {cpf,pin,action,phone,cep}=req.body||{};
 const id=digits(cpf),code=String(pin||''),tel=digits(phone),zip=digits(cep);
 if(!validCpf(id)||(!['session','logout'].includes(action)&&!/^\d{4}$/.test(code) )||!['register','login','session','logout'].includes(action))return res.status(400).json({ok:false,error:'invalid_credentials'});
 try{
 if(action==='logout'){const token=cookieToken(req);if(token)await db('srdogao_customer_devices',{method:'DELETE',query:'?token_hash=eq.'+hash(token)});res.setHeader('Set-Cookie',clearCookie);return res.json({ok:true});}
 if(action==='session'){
  const token=cookieToken(req);if(!token)return res.status(401).json({ok:false,error:'session_missing'});
  const rows=await db('srdogao_customer_devices',{query:'?token_hash=eq.'+hash(token)+'&expires_at=gt.'+encodeURIComponent(new Date().toISOString())+'&select=customer_id,srdogao_customer_profiles!inner(cpf,phone,cep,street,district,city,state,address_number,address_reference)'});
  const row=rows?.[0];if(!row||row.srdogao_customer_profiles?.cpf!==id)return res.status(401).json({ok:false,error:'session_expired'});
  const p=row.srdogao_customer_profiles;return res.json({ok:true,phone:p.phone,cep:p.cep,street:p.street,district:p.district,city:p.city,state:p.state,address_number:p.address_number,address_reference:p.address_reference});
 }
 const result=await db('rpc/srdogao_pin_access',{method:'POST',body:{p_cpf:id,p_pin:code,p_action:action,p_phone:tel||null,p_cep:zip||null}});
 if(result?.ok){
  const profiles=await db('srdogao_customer_profiles',{query:'?cpf=eq.'+id+'&select=id'});
  if(!profiles?.[0]?.id)throw Error('PROFILE_MISSING');
  const token=randomBytes(32).toString('hex');
  await db('srdogao_customer_devices',{method:'POST',body:{customer_id:profiles[0].id,token_hash:hash(token),expires_at:new Date(Date.now()+30*86400000).toISOString()}});
  res.setHeader('Set-Cookie','dogao_device='+token+'; HttpOnly; Secure; SameSite=Lax; Path=/api/customer-pin; Max-Age=2592000');
 }
 return res.status(result?.ok?200:result?.error==='temporarily_locked'?429:400).json(result);
 }catch(e){console.error('customer_auth_failed',e.message);return res.status(503).json({ok:false,error:'service_unavailable'});}
}