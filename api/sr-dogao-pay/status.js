// Dogão Pay — Vercel serverless endpoint, sandbox first.
// This endpoint deliberately does not create charges until the live order source is integrated.
export default async function handler(req, res) {
 res.setHeader('Cache-Control', 'no-store');
 if (req.method !== 'GET') return res.status(405).json({ error: 'method_not_allowed' });
 return res.status(200).json({
   service: 'Dogão Pay',
   status: 'integration_pending',
   environment: process.env.ASAAS_ENV === 'production' ? 'production' : 'not_configured',
   payments_enabled: process.env.ASAAS_ENV === 'production' && process.env.DOGAO_PAY_PRODUCTION_ENABLED === 'true' && Boolean(process.env.ASAAS_API_KEY && process.env.DOGAO_PAY_ASAAS_CUSTOMER_ID && process.env.SUPABASE_SERVICE_ROLE_KEY)
 });
}
