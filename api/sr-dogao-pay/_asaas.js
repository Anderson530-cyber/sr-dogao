// Internal Asaas adapter. Never import this module into browser code.
const BASE = {
 sandbox: 'https://api-sandbox.asaas.com/v3',
 production: 'https://api.asaas.com/v3'
};
export function environment() {
 return process.env.ASAAS_ENV === 'production' ? 'production' : 'sandbox';
}
export async function asaasRequest(path, { method = 'GET', body } = {}) {
 const key = process.env.ASAAS_API_KEY;
 if (!key) throw new Error('ASAAS_NOT_CONFIGURED');
 if (!path.startsWith('/') || path.startsWith('//')) throw new Error('INVALID_PATH');
 const response = await fetch(BASE[environment()] + path, {
  method,
  headers: { 'access_token': key, 'Content-Type': 'application/json', 'User-Agent': 'SrDogaoPay/0.1' },
  ...(body === undefined ? {} : { body: JSON.stringify(body) })
 });
 const data = await response.json().catch(() => ({}));
 if (!response.ok) {
  const err = new Error('ASAAS_PROVIDER_ERROR');
  err.status = response.status;
  throw err;
 }
 return data;
}
export function publicPaymentStatus(status) {
 const map = {
  PENDING:'pending', CONFIRMED:'confirmed', RECEIVED:'received',
  OVERDUE:'overdue', REFUNDED:'refunded', REFUND_REQUESTED:'pending',
  DELETED:'cancelled'
 };
 return map[status] || 'pending';
}
