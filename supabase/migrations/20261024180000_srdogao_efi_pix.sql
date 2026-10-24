-- Efí Pix support for Sr. Dogão; keep Asaas identifiers separate.
alter table public.srdogao_pay_payments
  add column if not exists provider text not null default 'asaas',
  add column if not exists efi_txid text;
alter table public.srdogao_pay_payments
  add constraint srdogao_pay_provider_check check (provider in ('asaas','efi'));
create unique index if not exists srdogao_pay_efi_txid_unique
  on public.srdogao_pay_payments(efi_txid) where efi_txid is not null;
create table if not exists public.srdogao_efi_webhook_events (
  event_id text primary key,
  txid text not null,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  received_at timestamptz not null default now(),
  processed_at timestamptz
);
alter table public.srdogao_efi_webhook_events enable row level security;
revoke all on public.srdogao_efi_webhook_events from anon, authenticated;
grant all on public.srdogao_efi_webhook_events to service_role;

create or replace function public.srdogao_efi_settle_pix(
  p_event_id text, p_txid text, p_amount_cents bigint, p_payload jsonb
) returns boolean
language plpgsql security definer set search_path to 'public', 'pg_temp'
as $function$
declare v_payment public.srdogao_pay_payments%rowtype; v_inserted integer;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'forbidden'; end if;
 if p_event_id is null or length(p_event_id) not between 1 and 180
   or p_txid is null or length(p_txid) not between 26 and 35
   or p_amount_cents is null or p_amount_cents<=0 then raise exception 'invalid_event';
 select * into v_payment from public.srdogao_pay_payments
  where efi_txid=p_txid and provider='efi' for update;
 if not found then raise exception 'unknown_efi_txid'; end if;
 if v_payment.billing_type<>'PIX' or v_payment.amount_cents<>p_amount_cents
   then raise exception 'payment_mismatch'; end if;
 insert into public.srdogao_efi_webhook_events(event_id,txid,event_type,payload,processed_at)
 values(p_event_id,p_txid,'PIX_RECEIVED',coalesce(p_payload,'{}'::jsonb),now())
 on conflict(event_id) do nothing;
 get diagnostics v_inserted = row_count;
 if v_inserted=0 then return false; end if;
 if v_payment.status in ('refunded','cancelled','confirmed','received') then return true; end if;
 if v_payment.status<>'pending' then raise exception 'payment_not_pending'; end if;
 update public.srdogao_pay_payments set status='received',updated_at=now() where id=v_payment.id;
 return true;
end $function$;
revoke all on function public.srdogao_efi_settle_pix(text,text,bigint,jsonb) from public, anon, authenticated;
grant execute on function public.srdogao_efi_settle_pix(text,text,bigint,jsonb) to service_role;
