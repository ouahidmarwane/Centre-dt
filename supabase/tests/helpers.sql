-- Helpers loaded inside each integration test transaction (everything is rolled back).
create schema tests;
grant usage on schema tests to authenticated;

create function tests.create_user(user_email text, user_role public.app_role, user_name text default 'Utilisateur Test')
returns uuid language plpgsql as $$
declare new_id uuid := gen_random_uuid();
begin
  insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at)
  values (new_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', user_email, jsonb_build_object('full_name', user_name), now(), now());
  update public.profiles set role = user_role where id = new_id;
  return new_id;
end $$;

-- Switches the transaction to the authenticated role with the given JWT claims.
create function tests.act_as(user_id uuid, assurance text default 'aal2')
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', jsonb_build_object('sub', user_id, 'role', 'authenticated', 'aal', assurance, 'session_id', gen_random_uuid())::text, true);
  perform set_config('role', 'authenticated', true);
end $$;
grant execute on function tests.act_as(uuid, text) to authenticated;

create function tests.assert_equal(actual anyelement, expected anyelement, label text)
returns void language plpgsql as $$
begin
  if actual is distinct from expected then
    raise exception 'ASSERTION FAILED (%): expected %, got %', label, expected, actual;
  end if;
end $$;
grant execute on function tests.assert_equal(anyelement, anyelement, text) to authenticated;

-- Runs a statement and asserts it fails with the given SQLSTATE.
create function tests.assert_fails(statement text, expected_state text, label text)
returns void language plpgsql as $$
begin
  execute statement;
  raise exception 'ASSERTION FAILED (%): statement succeeded but % was expected', label, expected_state;
exception
  when others then
    if sqlerrm like 'ASSERTION FAILED%' then raise; end if;
    if sqlstate <> expected_state then
      raise exception 'ASSERTION FAILED (%): expected SQLSTATE %, got % (%)', label, expected_state, sqlstate, sqlerrm;
    end if;
end $$;
grant execute on function tests.assert_fails(text, text, text) to authenticated;

create function tests.create_patient(creator uuid, first text, last text, phone_number text default '0600000000')
returns uuid language plpgsql as $$
declare new_id uuid;
begin
  insert into public.patients (first_name, last_name, phone, created_by, updated_by)
  values (first, last, phone_number, creator, creator) returning id into new_id;
  return new_id;
end $$;
grant execute on function tests.create_patient(uuid, text, text, text) to authenticated;
