-- Reserve one active payment for a verified order, atomically.
-- Applied to Supabase project dlccdfwteekecjiwybfr.
create or replace function public.srdogao_pay_reserve(p_order_id uuid,p_token uuid,p_method text)
returns table(payment_id uuid,amount_cents bigint)
language plpgsql security definer set search_path=public as $$
declare v_order public.srdogao_orders%rowtype; v_amount bigint; v_id uuid;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'forbidden'; end if;
 if p_method not in ('PIX','CREDIT_CARD') then raise exception 'invalid method'; end if;
 select * into v_order from public.srdogao_orders where id=p_order_id and public_token=p_token for update;
 if not found then raise exception 'order not found'; end if;
 if v_order.status='cancelled' then raise exception 'order cancelled'; end if;
 if v_order.total is null or v_order.total<=0 or v_order.total*100<>trunc(v_order.total*100) then raise exception 'invalid total'; end if;
 v_amount=(v_order.total*100)::bigint;
 if exists(select 1 from public.srdogao_pay_payments where order_id=p_order_id and status in ('pending','confirmed','received')) then raise exception 'active payment exists'; end if;
 insert into public.srdogao_pay_payments(order_id,billing_type,amount_cents,idempotency_key)
 values(p_order_id,p_method,v_amount,gen_random_uuid()::text) returning id into v_id;
 return query select v_id,v_amount;
end $$;
revoke all on function public.srdogao_pay_reserve(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.srdogao_pay_reserve(uuid,uuid,text) to service_role;
