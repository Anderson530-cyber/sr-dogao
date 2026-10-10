// Server-only Asaas static Pix QR code adapter.
// Production checkout integration; keep feature flag off until payment verification passes.
import { asaasRequest } from './_asaas.js';

export async function createOrderPixQrCode({ addressKey, orderId, paymentId, amountCents }) {
 if (typeof addressKey !== 'string' || !addressKey.trim()) throw new Error('PIX_KEY_NOT_CONFIGURED');
 if (typeof orderId !== 'string' || !/^[0-9a-f-]{36}$/i.test(orderId)) throw new Error('INVALID_ORDER_ID');
 if (typeof paymentId !== 'string' || !/^[0-9a-f-]{36}$/i.test(paymentId)) throw new Error('INVALID_PAYMENT_ID');
 if (!Number.isSafeInteger(amountCents) || amountCents <= 0) throw new Error('INVALID_PAYMENT_AMOUNT');
 const qr = await asaasRequest('/pix/qrCodes/static', { method: 'POST', body: {
  addressKey: addressKey.trim(),
  description: 'Sr. Dogão - pedido ' + orderId,
  value: amountCents / 100,
  format: 'ALL',
  allowsMultiplePayments: false,
  expirationSeconds: 1800,
  externalReference: paymentId
 }});
 if (typeof qr?.id !== 'string' || !qr.id) throw new Error('ASAAS_QR_ID_MISSING');
 if (typeof qr?.payload !== 'string' || !qr.payload) throw new Error('ASAAS_QR_PAYLOAD_MISSING');
 return { qrId: qr.id, copyPaste: qr.payload, encodedImage: qr.encodedImage || null, expiresAt: qr.expirationDate || null };
}
