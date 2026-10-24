import {db} from './_db.js';
import {efiRequest} from './_efi.js';
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');if(req.method!=='POST')return res.status(405).json({error:'method_not_allowed'});
 const pix=Array.isArray(req.body?.pix)?req.body.pix:[];if(!pix.length||pix.length>50)return res.status(400).json({error:'invalid_notification'});
 try{let processed=0;for(const item of pix){const txid=String(item?.txid||'');if(!/^[A-Z0-9]{26,35}$/.test(txid))continue;
 const rows=await db('srdogao_pay_payments',{query:'?select=id,amount_cents,status&provider=eq.efi&efi_txid=eq.'+encodeURIComponent(txid)+'&limit=1'});if(!rows?.length)continue;
 const charge=await efiRequest('/v2/cob/'+encodeURIComponent(txid));if(charge.txid!==txid||charge.status!=='CONCLUIDA')continue;
 const amount=Number(charge.valor?.original);if(!Number.isFinite(amount)||Math.round(amount*100)!==Number(rows[0].amount_cents))throw new Error('EFI_AMOUNT_MISMATCH');
 const paid=Array.isArray(charge.pix)?charge.pix.find(x=>x.txid===txid):null;const eventId=String(paid?.endToEndId||item?.endToEndId||'');if(!eventId)throw new Error('EFI_END_TO_END_MISSING');
 const result=await db('rpc/srdogao_efi_settle_pix',{method:'POST',body:{p_event_id:eventId,p_txid:txid,p_amount_cents:Math.round(amount*100),p_payload:{txid,status:charge.status,endToEndId:eventId,horario:paid?.horario||item?.horario||null}}});if(result===true)processed++}
 return res.status(200).json({received:true,processed})
 }catch(e){console.error('Dogao Efi webhook failed',String(e?.message||'unknown').slice(0,80));return res.status(503).json({error:'processing_unavailable'})}
}