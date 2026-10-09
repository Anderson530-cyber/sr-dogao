// Read-only backend readiness probe; never discloses credentials.
import { environment } from './_asaas.js';
export default async function handler(req,res) {
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='GET') return res.status(405).json({error:'method_not_allowed'});
 const sandbox=environment()==='sandbox';
 const config={
  database:Boolean(process.env.SUPABASE_URL&&process.env.SUPABASE_SERVICE_ROLE_KEY),
  asaas_api:Boolean(process.env.ASAAS_API_KEY),
  asaas_sandbox_customer:Boolean(process.env.ASAAS_SANDBOX_CUSTOMER_ID),
  webhook_token:Boolean(process.env.ASAAS_WEBHOOK_TOKEN),
  sandbox_enabled:process.env.SRDOGAO_PAY_SANDBOX_ENABLED==='true'
 };
 return res.status(200).json({
  service:'sr-dogao-pay',environment:sandbox?'sandbox':'production',
  pix_sandbox_ready:sandbox&&Object.values(config).every(Boolean),
  card_checkout_ready:false,
  checks:config
 });
}
