// Payment creation is disabled until a trusted server-side order source is wired.
// Never accept browser-supplied amounts or create Asaas charges from raw cart data.
export default async function handler(req, res) {
 res.setHeader('Cache-Control', 'no-store');
 if (req.method !== 'POST') return res.status(405).json({ error:'method_not_allowed' });
 return res.status(503).json({
  error:'order_integration_pending',
  message:'Sr. Dogão Pay ainda não está habilitado para cobranças.'
 });
}
