import {db} from './_db.js';
import {efiRequest,createTxid,efiEnabled} from './_efi.js';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');if(req.method!=='POST')return res.status(405).json({error:'method_not_allowed'});
 if(process.env.DOGAO_PAY_PRODUCTION_ENABLED!=='true'||!efiEnabled())return res.status(503).json({error:'efi_pix_not_enabled'});
 const {orderId,token}=req.body||{};if(typeof orderId!=='string'||!uuid.test(orderId)||typeof token!=='string'||!uuid.test(token))return res.status(400).json({error:'invalid_credentials'});
 let p;try{const rows=await db('rpc/srdogao_pay_reserve',{method:'POST',body:{p_order_id:orderId,p_token:token,p_method:'PIX'}});p=rows?.[0];if(!p?.payment_id||!Number.isSafeInteger(Number(p.amount_cents)))throw new Error('RESERVATION_INVALID')}catch{return res.status(409).json({error:'order_unavailable_or_payment_exists'})}
 try{
  const txid=createTxid(),amount=(Number(p.amount_cents)/100).toFixed(2);
  const marked=await db('srdogao_pay_payments',{method:'PATCH',query:'?id=eq.'+encodeURIComponent(p.payment_id)+'&status=eq.pending&provider=eq.asaas',body:{provider:'efi',efi_txid:txid}});
  if(!Array.isArray(marked)||marked.length!==1)throw new Error('PAYMENT_PROVIDER_BIND_FAILED');
  const charge=await efiRequest('/v2/cob/'+txid,{method:'PUT',body:{calendario:{expiracao:1800},valor:{original:amount},chave:process.env.EFI_PIX_KEY,solicitacaoPagador:'Pagamento do pedido Sr. Dogão',infoAdicionais:[{nome:'Pedido',valor:orderId}]}});
  if(charge.txid!==txid||!charge.loc?.id)throw new Error('EFI_CHARGE_INVALID');
  const qr=await efiRequest('/v2/loc/'+encodeURIComponent(charge.loc.id)+'/qrcode');if(typeof qr.qrcode!=='string'||!qr.qrcode)throw new Error('EFI_QR_MISSING');
  const image=typeof qr.imagemQrcode==='string'?qr.imagemQrcode.replace(/^data:image\/[^;]+;base64,/,''):null;
  await db('srdogao_pay_payments',{method:'PATCH',query:'?id=eq.'+encodeURIComponent(p.payment_id)+'&provider=eq.efi&efi_txid=eq.'+encodeURIComponent(txid),body:{pix_payload:qr.qrcode,pix_encoded_image:image,pix_qr_expires_at:new Date(Date.now()+1800000).toISOString()}});
  return res.status(200).json({payment_id:p.payment_id,status:'pending',method:'PIX',provider:'efi',copy_paste:qr.qrcode,qr_code:image,expires_at:new Date(Date.now()+1800000).toISOString()});
 }catch(e){console.error('Dogao Efi create failed',String(e?.message||'unknown').slice(0,80),Number(e?.status)||'');return res.status(503).json({error:'efi_payment_creation_failed',payment_id:p.payment_id})}
}