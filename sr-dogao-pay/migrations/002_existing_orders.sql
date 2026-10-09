-- Sr. Dogão Pay migration 002: designed for 110Tech public.srdogao_orders.
-- Review and apply to project dlccdfwteekecjiwybfr after backup.
create table if not exists public.srdogao_pay_payments (
 id uuid primary key default gen_random_uuid(),
 order_id uuid not null references public.srdogao_orders(id) on delete restrict,
 asaas_payment_id text unique,
 billing_type text not null check (billing_type in ('PIX','CREDIT_CARD')),
 amount_cents bigint not null check (amount_cents > 0),
 status text not null default 'pending' check (status in ('pending','confirmed','received','overdue','cancelled','refunded')),
 idempotency_key text not null unique,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists srdogao_pay_payments_order_idx on public.srdogao_pay_payments(order_id);
create table if not exists public.srdogao_pay_webhook_events (
 event_id text primary key,
 asaas_payment_id text not null,
 event_type text not null,
 payload jsonb not null,
 received_at timestamptz not null default now(),
 processed_at timestamptz
);
alter table public.srdogao_pay_payments enable row level security;
alter table public.srdogao_pay_webhook_events enable row level security;
-- No anon/authenticated policies. Backend uses service role only.
