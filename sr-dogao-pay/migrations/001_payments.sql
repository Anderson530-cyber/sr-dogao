-- Sr. Dogão Pay: execute only in the Sr. Dogão database after reviewing existing orders schema.
create table if not exists public.sr_dogao_payments (
 id uuid primary key default gen_random_uuid(),
 order_id text not null,
 provider text not null default 'asaas' check (provider = 'asaas'),
 provider_payment_id text unique,
 method text not null check (method in ('PIX','CREDIT_CARD')),
 amount_cents integer not null check (amount_cents > 0),
 status text not null default 'pending' check (status in ('pending','confirmed','received','overdue','refunded','cancelled')),
 checkout_url text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists sr_dogao_payments_order_id_idx on public.sr_dogao_payments(order_id);
create table if not exists public.sr_dogao_payment_events (
 id uuid primary key default gen_random_uuid(),
 provider_event_id text not null unique,
 provider_payment_id text,
 event_type text not null,
 received_at timestamptz not null default now(),
 payload jsonb not null
);
alter table public.sr_dogao_payments enable row level security;
alter table public.sr_dogao_payment_events enable row level security;
-- No public RLS policies: access via trusted backend only.
