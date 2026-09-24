-- Stock: items, movements that explain every quantity, no negative stock, alerts, archive.
select set_config('t.assistant', tests.create_user('assistant@test.local', 'assistant')::text, true);
select set_config('t.doctor', tests.create_user('doctor@test.local', 'doctor')::text, true);
select tests.act_as(current_setting('t.assistant')::uuid);
select set_config('t.gloves', public.create_stock_item('Gants nitrile M (test)', 'consumable', 'boîte', 12, 5, 'Dentalmed', null)::text, true);
select set_config('t.carpules', public.create_stock_item('Articaïne 4 % (test)', 'anesthetic', 'carpule', 0, 20)::text, true);
select tests.assert_equal((select count(*) from public.stock_movements where item_id = current_setting('t.gloves')::uuid and kind = 'in' and reason = 'Stock initial'), 1::bigint, 'initial stock recorded as a movement');
select tests.assert_equal((select count(*) from public.stock_movements where item_id = current_setting('t.carpules')::uuid), 0::bigint, 'no movement for an empty initial stock');
select tests.assert_fails($$select public.create_stock_item('gants NITRILE m (test)', 'consumable', 'boîte', 1, 1)$$, '23505', 'duplicate active names rejected (case-insensitive)');
select tests.assert_fails($$select public.create_stock_item('X', 'food', 'boîte', 1, 1)$$, '22023', 'unknown category rejected');
select tests.assert_fails($$select public.create_stock_item('Y', 'other', 'boîte', -1, 1)$$, '22023', 'negative quantity rejected');
select tests.assert_fails($$select public.create_stock_item('Z', 'other', 'boîte', 1.234, 1)$$, '22023', 'more than 2 decimals rejected');

select tests.assert_equal(public.record_stock_movement(current_setting('t.gloves')::uuid, 'out', 8, 'Semaine chargée'), 4.00::numeric, 'out removes quantity');
select tests.assert_fails($$select public.record_stock_movement(current_setting('t.gloves')::uuid, 'out', 5)$$, '22023', 'stock cannot go negative');
select tests.assert_equal((select quantity from public.stock_items where id = current_setting('t.gloves')::uuid), 4.00::numeric, 'refused movement changes nothing');
select tests.assert_equal(public.record_stock_movement(current_setting('t.carpules')::uuid, 'in', 50, 'Commande reçue'), 50.00::numeric, 'in adds quantity');
select tests.assert_fails($$select public.record_stock_movement(current_setting('t.carpules')::uuid, 'adjustment', 45)$$, '22023', 'an inventory count needs a reason');
select tests.assert_equal(public.record_stock_movement(current_setting('t.carpules')::uuid, 'adjustment', 45, 'Inventaire mensuel'), 45.00::numeric, 'adjustment sets the counted total');
select tests.assert_equal((select delta from public.stock_movements where item_id = current_setting('t.carpules')::uuid and kind = 'adjustment'), -5.00::numeric, 'adjustment stores the difference');
select tests.assert_equal(public.record_stock_movement(current_setting('t.carpules')::uuid, 'adjustment', 45, 'Recomptage'), 45.00::numeric, 'identical count is a no-op');
select tests.assert_fails($$select public.record_stock_movement(current_setting('t.carpules')::uuid, 'in', 0)$$, '22023', 'zero movement rejected');
select tests.assert_equal((select sum(delta) from public.stock_movements where item_id = current_setting('t.carpules')::uuid), (select quantity from public.stock_items where id = current_setting('t.carpules')::uuid), 'history explains the quantity');

select tests.assert_equal(public.update_stock_item(current_setting('t.gloves')::uuid, 'Gants nitrile M (test)', 'consumable', 'boîte de 100', 6, 'Dentalmed', 'Taille la plus utilisée'), true, 'item updated');
select tests.assert_equal((select count(*) from public.stock_items where id = current_setting('t.gloves')::uuid and quantity <= alert_threshold), 1::bigint, 'gloves are at or below the alert threshold');
select tests.assert_fails($$select public.archive_stock_item(current_setting('t.gloves')::uuid)$$, '42501', 'assistant cannot archive');
select tests.assert_fails($$update public.stock_items set quantity = 999$$, '42501', 'direct quantity edits denied');
reset role;

select tests.assert_equal(private.digest_item_count('low_stock', now()) >= 1, true, 'low stock feeds the morning digest');

select tests.act_as(current_setting('t.doctor')::uuid);
select tests.assert_equal(public.archive_stock_item(current_setting('t.gloves')::uuid), true, 'doctor archives an item');
select tests.assert_fails($$select public.record_stock_movement(current_setting('t.gloves')::uuid, 'in', 1)$$, '22023', 'archived items accept no movement');
select public.create_stock_item('Gants nitrile M (test)', 'consumable', 'boîte', 0, 5);
reset role;

select tests.act_as(current_setting('t.doctor')::uuid, 'aal1');
select tests.assert_equal((select count(*) from public.stock_items), 0::bigint, 'aal1 doctor reads no stock');
reset role;
