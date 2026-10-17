import {calculateRouteDelivery} from './delivery-route.js';
// Calcula uma cotação informativa de entrega no servidor.
// Necessário configurar GOOGLE_MAPS_API_KEY, SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.
// Ainda não altera o checkout nem autoriza cobrança: o pedido deve ser validado novamente no servidor.
export default async function handler(req,res){
  if(req.method!=='POST'){res.setHeader('Allow','POST');return res.status(405).json({error:'Método não permitido'});}
  try{
    const {destination,subtotal}=req.body||{};
    const amount=Number(subtotal);
    if(typeof destination!=='string'||destination.length<12||destination.length>300||!Number.isFinite(amount)||amount<0)return res.status(400).json({error:'Endereço ou subtotal inválido'});
    const {GOOGLE_MAPS_API_KEY,SUPABASE_URL,SUPABASE_SERVICE_ROLE_KEY}=process.env;
    if(!GOOGLE_MAPS_API_KEY||!SUPABASE_URL||!SUPABASE_SERVICE_ROLE_KEY)return res.status(503).json({error:'Serviço de rotas ainda não configurado'});
    const db=await fetch(SUPABASE_URL+'/rest/v1/srdogao_settings?key=eq.site&select=value',{headers:{apikey:SUPABASE_SERVICE_ROLE_KEY,Authorization:'Bearer '+SUPABASE_SERVICE_ROLE_KEY}});
    if(!db.ok)throw Error('Falha ao consultar configurações');
    const records=await db.json(),settings=records?.[0]?.value||{};
    if(settings.deliveryMode!=='km')return res.status(422).json({error:'Modalidade por quilômetro não está ativa'});
    let quote;
    try{quote=await calculateRouteDelivery(settings,destination.trim(),amount)}
    catch(e){return res.status(422).json({error:'delivery_quote_failed',message:e.message})}
    res.setHeader('Cache-Control','no-store');
    return res.status(200).json({...quote,currency:'BRL',informational:true});
  }catch(e){return res.status(500).json({error:'Não foi possível consultar a cotação de entrega'});}
}
