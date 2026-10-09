// Receives verified Asaas notifications. No order status is mutated until
// the production order database is wired and event deduplication is durable.
import { asaasRequest, publicPaymentStatus } from './_asaas.js';
export default async function handler(req, res) {
 res.setHeader('Cache-Control', 'no-store');
 if (req.method !== 'POST') return res.status(405).json({ error:'method_not_allowed' });
 const secret = process.env.ASAAS_WEBHOOK_TOKEN;
 if (!secret) return res.status(503).json({ error:'webhook_not_configured' });
 const token = req.headers['asaas-access-token'];
 if (typeof token !== 'string' || token !== secret) return res.status(401).json({ error:'unauthorized' });
 const { id, event, payment } = req.body || {};
 if (typeof id !== 'string' || typeof event !== 'string' || typeof payment?.id !== 'string') {
  return res.status(400).json({ error:'invalid_event' });
 }
 try {
  const current = await asaasRequest('/payments/' + encodeURIComponent(payment.id));
  if (current.id !== payment.id) return res.status(422).json({ error:'payment_mismatch' });
  // Fail closed: until order persistence and idempotency are connected, don't
  // acknowledge events as processed; Asaas can retry later.
  console.info('SrDogaoPay webhook verified', { eventId:id, event, paymentId:current.id, status:publicPaymentStatus(current.status) });
  return res.status(503).json({ error:'order_integration_pending' });
 } catch (err) {
  return res.status(502).json({ error:'provider_verification_failed' });
 }
}
