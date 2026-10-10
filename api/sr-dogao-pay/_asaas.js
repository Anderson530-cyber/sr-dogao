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
  headers: { 'access_token': key, 'Content-Type': 'application/json', 'User-Agent': 'DogaoPay/0.1' },
  ...(body === undefined ? {} : { body: JSON.stringify(body) })
 });
 const data = await response.json().catch(() => ({}));
 if (!response.ok) {
  const err = new Error('ASAAS_PROVIDER_ERROR');
  err.status = response.status;
  // Keep only provider error codes and a bounded, redacted diagnostic in server logs.
  const issues = Array.isArray(data?.errors) ? data.errors : [];
  const codes = issues.map(item => typeof item?.code === 'string' ? item.code.slice(0, 60) : '').filter(Boolean).slice(0, 4);
  const descriptions = issues.map(item => typeof item?.description === 'string' ? item.description : '').filter(Boolean).slice(0, 2);
  const sanitize = value => String(value).replace(/\b\d{11,14}\b/g, '[redacted-number]').replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, '[redacted-email]').replace(/(?:access_token|api[_-]?key|authorization)\s*[:=]\s*\S+/gi, '[redacted-secret]').slice(0, 240);
  console.error('Dogao Pay Asaas rejection', JSON.stringify({ path, method, status: response.status, codes, descriptions: descriptions.map(sanitize) }));
  err.providerCodes = codes;
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
