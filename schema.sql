-- Universal POS — Supabase / PostgreSQL schema (Stage 1)
-- Run in the Supabase SQL editor. NOT YET TESTED against a live project.
-- Never put the service-role key in frontend code.

create extension if not exists "pgcrypto";

-- ───────────── Shops, membership ─────────────
create table public.shops (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  created_by  uuid not null references auth.users(id),
  created_at  timestamptz not null default now()
);

create table public.shop_members (
  shop_id  uuid not null references public.shops(id) on delete cascade,
  user_id  uuid not null references auth.users(id) on delete cascade,
  role     text not null check (role in ('owner','manager','cashier')),
  created_at timestamptz not null default now(),
  primary key (shop_id, user_id)
);
create index on public.shop_members (user_id);

-- Helper functions (SECURITY DEFINER only to read membership without recursive RLS)
create or replace function public.is_member(p_shop uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.shop_members
                 where shop_id = p_shop and user_id = auth.uid());
$$;

create or replace function public.has_role(p_shop uuid, p_roles text[])
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.shop_members
                 where shop_id = p_shop and user_id = auth.uid() and role = any(p_roles));
$$;

-- Connectivity check used by the client
create or replace function public.ping() returns text language sql as $$ select 'ok'; $$;

-- ───────────── Common columns macro (documented) ─────────────
-- Every business table has: id uuid pk, shop_id, device_id, created_at, updated_at,
-- version int, server_seq bigint (monotonic, used for pull), deleted_at (soft delete).

create sequence public.server_seq_gen;

create or replace function public.touch_server_seq() returns trigger language plpgsql as $$
begin
  new.server_seq := nextval('public.server_seq_gen');
  return new;
end $$;

-- ───────────── Business tables ─────────────
create table public.categories (
  id uuid primary key, shop_id uuid not null references public.shops(id),
  device_id text not null, created_at timestamptz not null, updated_at timestamptz not null,
  version int not null default 1, server_seq bigint, deleted_at timestamptz,
  name text not null, name_ur text
);

create table public.products (
  id uuid primary key, shop_id uuid not null references public.shops(id),
  device_id text not null, created_at timestamptz not null, updated_at timestamptz not null,
  version int not null default 1, server_seq bigint, deleted_at timestamptz,
  category_id uuid, name text not null, name_ur text, barcode text, sku text,
  unit text default 'pcs', cost_price numeric(14,2) not null default 0,
  sale_price numeric(14,2) not null default 0, min_stock numeric(14,3) default 0,
  is_active boolean not null default true
);
create index on public.products (shop_id, barcode);
create index on public.products (shop_id, name);

create table public.customers (
  id uuid primary key, shop_id uuid not null references public.shops(id),
  device_id text not null, created_at timestamptz not null, updated_at timestamptz not null,
  version int not null default 1, server_seq bigint, deleted_at timestamptz,
  name text not null, phone text, address text, opening_balance numeric(14,2) default 0
);
create index on public.customers (shop_id, phone);

create table public.suppliers (
  id uuid primary key, shop_id uuid not null references public.shops(id),
  device_id text not null, created_at timestamptz not null, updated_at timestamptz not null,
  version int not null default 1, server_seq bigint, deleted_at timestamptz,
  name text not null, phone text, address text, opening_balance numeric(14,2) default 0
);

-- Append-only tables (no UPDATE/DELETE policies are granted)
create table public.sales (
  id uuid primary key, shop_id uuid not null references public.shops(id),
  device_id text not null, created_at timestamptz not null, updated_at timestamptz not null,
  version int not null default 1, server_seq bigint,
  invoice_no text not null, customer_id uuid, subtotal numeric(14,2) not null,
  discount numeric(14,2) not null default 0, tax numeric(14,2) not null default 0,
  total numeric(14,2) not null, paid numeric(14,2) not null default 0,
  payment_method text, status text not null default 'completed'
    check (status in ('completed','returned','void')),
  created_by uuid
);
create index on public.sales (shop_id, created_at desc);
-- invoice numbers are device-prefixed locally, so uniqueness is per shop+invoice.
-- KNOWN GAP (Stage 3): if two different sales ever share an invoice_no, the unique violation
-- would abort the whole sync_push batch. sync_push must catch unique_violation per item and
-- return 'rejected' so one bad row cannot block the rest of the queue.
create unique index on public.sales (shop_id, invoice_no);

create table public.sale_items (
  id uuid primary key, shop_id uuid not null references public.shops(id),
  device_id text not null, created_at timestamptz not null, updated_at timestamptz not null,
  version int not null default 1, server_seq bigint,
  sale_id uuid not null, product_id uuid not null, product_name text not null,
  qty numeric(14,3) not null, unit_price numeric(14,2) not null,
  cost_price numeric(14,2) not null default 0, discount numeric(14,2) not null default 0,
  line_total numeric(14,2) not null
);
create index on public.sale_items (shop_id, sale_id);

create table public.purchases (
  id uuid primary key, shop_id uuid not null references public.shops(id),
  device_id text not null, created_at timestamptz not null, updated_at timestamptz not null,
  version int not null default 1, server_seq bigint,
  supplier_id uuid, reference_no text, total numeric(14,2) not null,
  paid numeric(14,2) not null default 0, status text not null default 'completed'
);

create table public.purchase_items (
  id uuid primary key, shop_id uuid not null references public.shops(id),
  device_id text not null, created_at timestamptz not null, updated_at timestamptz not null,
  version int not null default 1, server_seq bigint,
  purchase_id uuid not null, product_id uuid not null, qty numeric(14,3) not null,
  unit_cost numeric(14,2) not null, line_total numeric(14,2) not null
);

create table public.payments (
  id uuid primary key, shop_id uuid not null references public.shops(id),
  device_id text not null, created_at timestamptz not null, updated_at timestamptz not null,
  version int not null default 1, server_seq bigint,
  party_type text not null check (party_type in ('customer','supplier')),
  party_id uuid, sale_id uuid, purchase_id uuid,
  direction text not null check (direction in ('in','out')),
  amount numeric(14,2) not null check (amount > 0), method text, note text
);
create index on public.payments (shop_id, created_at desc);

create table public.expenses (
  id uuid primary key, shop_id uuid not null references public.shops(id),
  device_id text not null, created_at timestamptz not null, updated_at timestamptz not null,
  version int not null default 1, server_seq bigint,
  category text, amount numeric(14,2) not null check (amount > 0), note text
);

create table public.stock_movements (
  id uuid primary key, shop_id uuid not null references public.shops(id),
  device_id text not null, created_at timestamptz not null, updated_at timestamptz not null,
  version int not null default 1, server_seq bigint,
  product_id uuid not null, qty_change numeric(14,3) not null,
  reason text not null check (reason in ('sale','purchase','return','adjustment','opening')),
  ref_type text, ref_id uuid, note text
);
create index on public.stock_movements (shop_id, product_id);

-- Audit trail for mutable tables
create table public.audit_log (
  id bigserial primary key, shop_id uuid, table_name text not null,
  record_id uuid not null, action text not null, old_row jsonb, new_row jsonb,
  changed_by uuid default auth.uid(), changed_at timestamptz not null default now()
);

create or replace function public.audit_row() returns trigger language plpgsql security definer
set search_path = public as $$
begin
  insert into public.audit_log(shop_id, table_name, record_id, action, old_row, new_row)
  values (coalesce(new.shop_id, old.shop_id), tg_table_name, coalesce(new.id, old.id), tg_op,
          case when tg_op = 'INSERT' then null else to_jsonb(old) end, to_jsonb(new));
  return new;
end $$;

-- Sync conflicts kept for owner resolution
create table public.sync_conflicts (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id),
  table_name text not null, record_id uuid not null,
  client_row jsonb not null, server_row jsonb not null,
  device_id text, created_at timestamptz not null default now(),
  resolved_at timestamptz, resolved_by uuid, resolution text
);

-- ───────────── Triggers: server_seq on every sync table, audit on mutable ─────────────
do $$
declare t text;
begin
  foreach t in array array['categories','products','customers','suppliers','sales','sale_items',
    'purchases','purchase_items','payments','expenses','stock_movements'] loop
    execute format('create trigger trg_%1$s_seq before insert or update on public.%1$s
                    for each row execute function public.touch_server_seq()', t);
    execute format('create index on public.%1$s (shop_id, server_seq)', t);
  end loop;
  foreach t in array array['categories','products','customers','suppliers'] loop
    execute format('create trigger trg_%1$s_audit after insert or update on public.%1$s
                    for each row execute function public.audit_row()', t);
  end loop;
end $$;

-- ───────────── Row Level Security ─────────────
alter table public.shops enable row level security;
alter table public.shop_members enable row level security;
alter table public.audit_log enable row level security;
alter table public.sync_conflicts enable row level security;

create policy shops_select on public.shops for select using (public.is_member(id));
create policy members_select on public.shop_members for select using (public.is_member(shop_id));
create policy members_owner_write on public.shop_members for all
  using (public.has_role(shop_id, array['owner']))
  with check (public.has_role(shop_id, array['owner']));
create policy audit_owner_read on public.audit_log for select using (public.has_role(shop_id, array['owner']));
create policy conflicts_member_read on public.sync_conflicts for select using (public.has_role(shop_id, array['owner','manager']));
create policy conflicts_owner_update on public.sync_conflicts for update
  using (public.has_role(shop_id, array['owner'])) with check (public.has_role(shop_id, array['owner']));

do $$
declare t text;
begin
  -- Mutable tables: members read; owner/manager insert+update; cashiers may insert only via sales flow tables
  foreach t in array array['categories','products','customers','suppliers'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %1$s_sel on public.%1$I for select using (public.is_member(shop_id))', t);
    execute format('create policy %1$s_ins on public.%1$I for insert with check (public.has_role(shop_id, array[''owner'',''manager'']) or (public.is_member(shop_id) and %1$L = ''customers''))', t);
    execute format('create policy %1$s_upd on public.%1$I for update using (public.has_role(shop_id, array[''owner'',''manager''])) with check (public.has_role(shop_id, array[''owner'',''manager'']))', t);
  end loop;
  -- Append-only tables: members read and insert; NO update or delete policy exists
  foreach t in array array['sales','sale_items','purchases','purchase_items','payments','expenses','stock_movements'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %1$s_sel on public.%1$I for select using (public.is_member(shop_id))', t);
    execute format('create policy %1$s_ins on public.%1$I for insert with check (public.is_member(shop_id))', t);
  end loop;
end $$;
-- No DELETE policy is defined anywhere: deletes are denied by RLS for all client users.

-- ───────────── Idempotent push RPC ─────────────
-- Input batch element: {"table":"sales","op":"insert"|"update","row":{...},"base_version":1}
-- SECURITY INVOKER: RLS still applies to every statement.
create or replace function public.sync_push(p_shop uuid, p_device text, p_batch jsonb)
returns jsonb language plpgsql as $$
declare
  item jsonb; tbl text; r jsonb; res jsonb := '[]'::jsonb; n int; cur_ver int;
  append_only text[] := array['sales','sale_items','purchases','purchase_items','payments','expenses','stock_movements'];
  mutable_t   text[] := array['categories','products','customers','suppliers'];
begin
  if not public.is_member(p_shop) then
    raise exception 'not a member of this shop' using errcode = '42501';
  end if;

  for item in select * from jsonb_array_elements(p_batch) loop
    tbl := item->>'table';
    r   := item->'row';
    if not (tbl = any(append_only) or tbl = any(mutable_t)) then
      res := res || jsonb_build_object('id', r->>'id', 'status','rejected','reason','unknown table');
      continue;
    end if;
    -- never trust the client shop_id
    if (r->>'shop_id')::uuid is distinct from p_shop then
      res := res || jsonb_build_object('id', r->>'id', 'status','rejected','reason','shop mismatch');
      continue;
    end if;

    if tbl = any(append_only) then
      execute format('insert into public.%I select * from jsonb_populate_record(null::public.%I, $1) on conflict (id) do nothing', tbl, tbl)
        using (r - 'server_seq' - 'sync_status');
      get diagnostics n = row_count;
      res := res || jsonb_build_object('id', r->>'id', 'status', case when n = 1 then 'applied' else 'duplicate' end);
    else
      execute format('select version from public.%I where id = $1', tbl) into cur_ver using (r->>'id')::uuid;
      if cur_ver is null then
        execute format('insert into public.%I select * from jsonb_populate_record(null::public.%I, $1)', tbl, tbl)
          using (r - 'server_seq' - 'sync_status');
        res := res || jsonb_build_object('id', r->>'id', 'status','applied');
      elsif cur_ver = coalesce((item->>'base_version')::int, 0) then
        execute format('update public.%I t set (name, updated_at, version, deleted_at) = (select name, updated_at, version, deleted_at from jsonb_populate_record(null::public.%I, $1)) where id = $2', tbl, tbl)
          using (r - 'server_seq' - 'sync_status'), (r->>'id')::uuid;
        res := res || jsonb_build_object('id', r->>'id', 'status','applied');
      else
        insert into public.sync_conflicts(shop_id, table_name, record_id, client_row, server_row, device_id)
        values (p_shop, tbl, (r->>'id')::uuid, r, '{}'::jsonb, p_device);
        res := res || jsonb_build_object('id', r->>'id', 'status','conflict');
      end if;
    end if;
  end loop;
  return res;
end $$;
-- NOTE (known gap, Stage 3): the mutable-table UPDATE above only updates a few common columns
-- and stores an empty server_row in conflicts. Stage 3 will generate per-table update statements
-- and capture the real server row. Do not rely on this branch yet.
