// Public health check: verifies credentials with Asaas without creating a charge.
import { asaasRequest, environment } from './_asaas.js';
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='GET')return res.status(405).json({error:'method_not_allowed'});
 const configured=Boolean(process.env.ASAAS_API_KEY&&process.env.ASAAS_WEBHOOK_TOKEN&&process.env.SUPABASE_URL&&process.env.SUPABASE_SERVICE_ROLE_KEY);
 const enabled=environment()==='production'&&process.env.DOGAO_PAY_PRODUCTION_ENABLED==='true'&&configured;
 let provider='not_checked';
 if(environment()==='production'&&process.env.ASAAS_API_KEY){
  try{await asaasRequest('/myAccount');provider='reachable';}
  catch{provider='unavailable';}
 }
 return res.status(200).json({service:'Dogão Pay',environment:environment(),credentials_configured:configured,provider, payments_enabled:enabled&&provider==='reachable'});
}
