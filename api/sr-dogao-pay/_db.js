// Trusted Supabase REST helper. Service role must never reach browser.
export async function db(table, { method='GET', query='', body } = {}) {
 const url=process.env.SUPABASE_URL, key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if (!url || !key) throw new Error('DATABASE_NOT_CONFIGURED');
 const response=await fetch(url.replace(/\/$/,'')+'/rest/v1/'+table+query,{
  method,headers:{ apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json',Prefer:'return=representation' },
  ...(body===undefined?{}:{body:JSON.stringify(body)})
 });
 if(!response.ok) throw new Error('DATABASE_HTTP_'+response.status);
 const raw=await response.text();
 if(!raw) return null;
 try { return JSON.parse(raw); } catch { throw new Error('DATABASE_INVALID_RESPONSE'); }
}
export function orderAmountCents(order) {
 const amount=Number(order?.total);
 if(!Number.isFinite(amount)||amount<=0) throw new Error('INVALID_ORDER_TOTAL');
 const cents=Math.round(amount*100);
 if(Math.abs(cents/100-amount)>0.00001) throw new Error('INVALID_ORDER_PRECISION');
 return cents;
}
