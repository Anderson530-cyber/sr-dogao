import {db} from './sr-dogao-pay/_db.js';
const digits=v=>String(v||'').replace(/\D/g,'');
function validCpf(v){if(!/^\d{11}$/.test(v)||/^(\d)\1{10}$/.test(v))return false;for(let n=9;n<=10;n++){let sum=0;for(let i=0;i<n;i++)sum+=Number(v[i])*(n+1-i);let d=sum*10%11;if(d===10)d=0;if(d!==Number(v[n]))return false;}return true;}
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='POST')return res.status(405).json({error:'method_not_allowed'});
 const {cpf,pin,action,phone,cep}=req.body||{};
 const id=digits(cpf),code=String(pin||''),tel=digits(phone),zip=digits(cep);
 if(!validCpf(id)||!/^\d{4}$/.test(code)||!['register','login'].includes(action))return res.status(400).json({ok:false,error:'invalid_credentials'});
 try{
 const result=await db('rpc/srdogao_pin_access',{method:'POST',body:{p_cpf:id,p_pin:code,p_action:action,p_phone:tel||null,p_cep:zip||null}});
 return res.status(result?.ok?200:result?.error==='temporarily_locked'?429:400).json(result);
 }catch(e){console.error('customer_auth_failed',e.message);return res.status(503).json({ok:false,error:'service_unavailable'});}
}