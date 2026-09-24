begin;

-- Clinic supplies (consumables, anesthetics…) with an alert threshold. Every quantity
-- change goes through a movement row, so the current quantity is always explained by
-- its history and can never become negative.
create table public.stock_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null,
  unit text not null,
  quantity numeric(12,2) not null default 0,
  alert_threshold numeric(12,2) not null default 0,
  supplier text,
  notes text,
  is_active boolean not null default true,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_by uuid references auth.users(id) on delete restrict,
  archived_at timestamptz,
  constraint stock_items_name_length check (char_length(name) between 1 and 120 and name = btrim(name)),
  constraint stock_items_category check (category in ('consumable', 'anesthetic', 'hygiene', 'instrument', 'prosthesis', 'medication', 'other')),
  constraint stock_items_unit_length check (char_length(unit) between 1 and 30 and unit = btrim(unit)),
  constraint stock_items_quantity check (quantity >= 0 and quantity < 10000000),
  constraint stock_items_threshold check (alert_threshold >= 0 and alert_threshold < 10000000),
  constraint stock_items_supplier_length check (supplier is null or (char_length(supplier) between 1 and 120 and supplier = btrim(supplier))),
  constraint stock_items_notes_length check (notes is null or (char_length(notes) between 1 and 1000 and notes = btrim(notes))),
  constraint stock_items_archive check ((is_active and archived_at is null and archived_by is null) or (not is_active and archived_at is not null and archived_by is not null))
);
create unique index stock_items_active_name_idx on public.stock_items (lower(name)) where is_active;

create table public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.stock_items(id) on delete restrict,
  kind text not null,
  delta numeric(12,2) not null,
  quantity_after numeric(12,2) not null,
  reason text,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint stock_movements_kind check (kind in ('in', 'out', 'adjustment')),
  constraint stock_movements_direction check ((kind = 'in' and delta > 0) or (kind = 'out' and delta < 0) or (kind = 'adjustment' and delta <> 0)),
  constraint stock_movements_after check (quantity_after >= 0),
  constraint stock_movements_reason_length check (reason is null or (char_length(reason) between 1 and 300 and reason = btrim(reason)))
);
create index stock_movements_item_idx on public.stock_movements (item_id, created_at desc);
create index stock_movements_recent_idx on public.stock_movements (created_at desc);

alter table public.stock_items enable row level security;
alter table public.stock_movements enable row level security;
revoke all on table public.stock_items, public.stock_movements from public, anon, authenticated;
grant select on table public.stock_items, public.stock_movements to authenticated;
create policy stock_items_select_staff on public.stock_items for select to authenticated using ((select private.is_active_user()));
create policy stock_movements_select_staff on public.stock_movements for select to authenticated using ((select private.is_active_user()));

create function private.valid_stock_quantity(value numeric)
returns boolean language sql immutable set search_path = '' as $$
  select value is not null and value >= 0 and value < 10000000 and value = round(value, 2)
$$;
revoke all on function private.valid_stock_quantity(numeric) from public, anon;
grant execute on function private.valid_stock_quantity(numeric) to authenticated;

create function public.create_stock_item(
  target_name text, target_category text, target_unit text, target_quantity numeric, target_alert_threshold numeric,
  target_supplier text default null, target_notes text default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); actor_role public.app_role := private.current_user_role(); item_id uuid;
begin
  if actor is null or actor_role is null then raise exception 'Insufficient privilege' using errcode = '42501'; end if;
  if target_name is null or char_length(btrim(target_name)) not between 1 and 120
    or target_unit is null or char_length(btrim(target_unit)) not between 1 and 30
    or target_category is null or target_category not in ('consumable', 'anesthetic', 'hygiene', 'instrument', 'prosthesis', 'medication', 'other')
    or not private.valid_stock_quantity(target_quantity) or not private.valid_stock_quantity(target_alert_threshold)
    or (target_supplier is not null and char_length(btrim(target_supplier)) > 120)
    or (target_notes is not null and char_length(btrim(target_notes)) > 1000)
  then raise exception 'Invalid stock item' using errcode = '22023'; end if;
  if exists (select 1 from public.stock_items s where lower(s.name) = lower(btrim(target_name)) and s.is_active) then
    raise exception 'Stock item already exists' using errcode = '23505';
  end if;
  insert into public.stock_items (name, category, unit, quantity, alert_threshold, supplier, notes, created_by)
  values (btrim(target_name), target_category, btrim(target_unit), target_quantity, target_alert_threshold, nullif(btrim(target_supplier), ''), nullif(btrim(target_notes), ''), actor)
  returning id into item_id;
  if target_quantity > 0 then
    insert into public.stock_movements (item_id, kind, delta, quantity_after, reason, created_by) values (item_id, 'in', target_quantity, target_quantity, 'Stock initial', actor);
  end if;
  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values (actor, 'stock.item_created', 'stock_item', item_id, jsonb_build_object('name', btrim(target_name)));
  return item_id;
end $$;

create function public.update_stock_item(
  target_item_id uuid, target_name text, target_category text, target_unit text, target_alert_threshold numeric,
  target_supplier text default null, target_notes text default null
) returns boolean language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); actor_role public.app_role := private.current_user_role(); affected integer;
begin
  if actor is null or actor_role is null then raise exception 'Insufficient privilege' using errcode = '42501'; end if;
  if target_name is null or char_length(btrim(target_name)) not between 1 and 120
    or target_unit is null or char_length(btrim(target_unit)) not between 1 and 30
    or target_category is null or target_category not in ('consumable', 'anesthetic', 'hygiene', 'instrument', 'prosthesis', 'medication', 'other')
    or not private.valid_stock_quantity(target_alert_threshold)
    or (target_supplier is not null and char_length(btrim(target_supplier)) > 120)
    or (target_notes is not null and char_length(btrim(target_notes)) > 1000)
  then raise exception 'Invalid stock item' using errcode = '22023'; end if;
  if exists (select 1 from public.stock_items s where lower(s.name) = lower(btrim(target_name)) and s.is_active and s.id <> target_item_id) then
    raise exception 'Stock item already exists' using errcode = '23505';
  end if;
  update public.stock_items set name = btrim(target_name), category = target_category, unit = btrim(target_unit), alert_threshold = target_alert_threshold,
    supplier = nullif(btrim(target_supplier), ''), notes = nullif(btrim(target_notes), ''), updated_at = now()
  where id = target_item_id and is_active;
  get diagnostics affected = row_count;
  if affected = 1 then
    insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata) values (actor, 'stock.item_updated', 'stock_item', target_item_id, '{}'::jsonb);
  end if;
  return affected = 1;
end $$;

-- in / out add or remove a quantity; adjustment records a physical count (the new total).
create function public.record_stock_movement(target_item_id uuid, target_kind text, target_quantity numeric, target_reason text default null)
returns numeric language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); actor_role public.app_role := private.current_user_role(); current_quantity numeric; change numeric; new_quantity numeric; normalized_reason text := nullif(btrim(target_reason), '');
begin
  if actor is null or actor_role is null then raise exception 'Insufficient privilege' using errcode = '42501'; end if;
  if target_kind is null or target_kind not in ('in', 'out', 'adjustment') or not private.valid_stock_quantity(target_quantity)
    or (normalized_reason is not null and char_length(normalized_reason) > 300)
    or (target_kind in ('in', 'out') and target_quantity = 0)
    or (target_kind = 'adjustment' and normalized_reason is null)
  then raise exception 'Invalid stock movement' using errcode = '22023'; end if;
  select quantity into current_quantity from public.stock_items where id = target_item_id and is_active for update;
  if not found then raise exception 'Stock item unavailable' using errcode = '22023'; end if;
  change := case target_kind when 'in' then target_quantity when 'out' then -target_quantity else target_quantity - current_quantity end;
  new_quantity := current_quantity + change;
  if new_quantity < 0 then raise exception 'Insufficient stock' using errcode = '22023'; end if;
  if change = 0 then return current_quantity; end if;
  update public.stock_items set quantity = new_quantity, updated_at = now() where id = target_item_id;
  insert into public.stock_movements (item_id, kind, delta, quantity_after, reason, created_by) values (target_item_id, target_kind, change, new_quantity, normalized_reason, actor);
  return new_quantity;
end $$;

create function public.archive_stock_item(target_item_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); actor_role public.app_role := private.current_user_role(); affected integer;
begin
  if actor is null or actor_role is distinct from 'doctor' then raise exception 'Insufficient privilege' using errcode = '42501'; end if;
  update public.stock_items set is_active = false, archived_by = actor, archived_at = now(), updated_at = now() where id = target_item_id and is_active;
  get diagnostics affected = row_count;
  if affected = 1 then
    insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata) values (actor, 'stock.item_archived', 'stock_item', target_item_id, '{}'::jsonb);
  end if;
  return affected = 1;
end $$;

revoke all on function public.create_stock_item(text, text, text, numeric, numeric, text, text), public.update_stock_item(uuid, text, text, text, numeric, text, text), public.record_stock_movement(uuid, text, numeric, text), public.archive_stock_item(uuid) from public, anon;
grant execute on function public.create_stock_item(text, text, text, numeric, numeric, text, text), public.update_stock_item(uuid, text, text, text, numeric, text, text), public.record_stock_movement(uuid, text, numeric, text), public.archive_stock_item(uuid) to authenticated;

-- The morning Telegram digest now also counts supplies at or below their threshold.
create or replace function private.digest_item_count(digest_kind text, reference_time timestamptz)
returns integer language plpgsql stable security definer set search_path = '' as $$
begin
  if digest_kind = 'unpaid_payments' then
    return (select count(*) from private.patient_balances(reference_time) b where b.is_due);
  elsif digest_kind = 'low_stock' then
    return (select count(*) from public.stock_items s where s.is_active and s.quantity <= s.alert_threshold);
  end if;
  return 0;
end $$;
revoke all on function private.digest_item_count(text, timestamptz) from public, anon, authenticated;

commit;
