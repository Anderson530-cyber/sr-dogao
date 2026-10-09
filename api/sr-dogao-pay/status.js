// Sr. Dogão Pay — Vercel serverless endpoint, sandbox first.
// This endpoint deliberately does not create charges until the live order source is integrated.
export default async function handler(req, res) {
 res.setHeader('Cache-Control', 'no-store');
 if (req.method !== 'GET') return res.status(405).json({ error: 'method_not_allowed' });
 return res.status(200).json({
   service: 'sr-dogao-pay',
   status: 'integration_pending',
   sandbox: process.env.ASAAS_ENV !== 'production',
   payments_enabled: false
 });
}
