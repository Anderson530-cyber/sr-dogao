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
    const origin=String(settings.deliveryOriginAddress||'').trim();
    if(origin.length<12)return res.status(422).json({error:'Endereço de origem não configurado'});
    const route=await fetch('https://routes.googleapis.com/directions/v2:computeRoutes',{method:'POST',headers:{'Content-Type':'application/json','X-Goog-Api-Key':GOOGLE_MAPS_API_KEY,'X-Goog-FieldMask':'routes.distanceMeters'},body:JSON.stringify({origin:{address:origin},destination:{address:destination.trim()},travelMode:'DRIVE',routingPreference:'TRAFFIC_UNAWARE'})});
    if(!route.ok)return res.status(502).json({error:'Não foi possível calcular a rota'});
    const result=await route.json(),meters=result.routes?.[0]?.distanceMeters;
    if(!Number.isFinite(meters)||meters<=0)return res.status(422).json({error:'Rota indisponível para este endereço'});
    const km=meters/1000;
    const nonnegative=(x)=>{const n=Number(x);return Number.isFinite(n)&&n>=0?n:0};
    const max=nonnegative(settings.deliveryMaxKm);
    if(max>0&&km>max)return res.status(422).json({error:'Endereço fora do raio de entrega',distanceKm:Math.round(km*100)/100});
    if(amount<nonnegative(settings.deliveryMinOrder))return res.status(422).json({error:'Pedido abaixo do valor mínimo'});
    let fee=Math.max(nonnegative(settings.deliveryMinFee),nonnegative(settings.deliveryBaseFee)+km*nonnegative(settings.deliveryPerKm));
    if(nonnegative(settings.deliveryFreeOver)>0&&amount>=nonnegative(settings.deliveryFreeOver))fee=0;
    res.setHeader('Cache-Control','no-store');
    return res.status(200).json({distanceKm:Math.round(km*100)/100,deliveryFee:Math.round((fee+Number.EPSILON)*100)/100,currency:'BRL',informational:true});
  }catch(e){return res.status(500).json({error:'Não foi possível consultar a cotação de entrega'});}
}
