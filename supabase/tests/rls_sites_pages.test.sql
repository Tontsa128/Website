begin;

create extension if not exists pgtap with schema extensions;
select extensions.plan(5);

-- Stable fixture users are rolled back with this test transaction.
insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  (
    '30000000-0000-4000-8000-000000000001',
    'authenticated', 'authenticated', 'rls-owner-a@example.test', '',
    now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
  ),
  (
    '30000000-0000-4000-8000-000000000002',
    'authenticated', 'authenticated', 'rls-owner-b@example.test', '',
    now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
  )
on conflict (id) do nothing;

insert into public.sites (id, owner_id, name, slug)
values
  ('40000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', 'RLS test A', 'rls-test-a'),
  ('40000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000002', 'RLS test B', 'rls-test-b')
on conflict (id) do nothing;

insert into public.pages (id, site_id, title, slug, position, path, status, content, published_content)
values
  ('50000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000001', 'Draft A', 'draft-a', 0, 'draft-a', 'draft', '{"secret":"draft-a"}', '[]'),
  ('50000000-0000-4000-8000-000000000002', '40000000-0000-4000-8000-000000000002', 'Draft B', 'draft-b', 0, 'draft-b', 'draft', '{"secret":"draft-b"}', '[]')
on conflict (id) do nothing;

set local role authenticated;
select set_config('request.jwt.claim.sub', '30000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"30000000-0000-4000-8000-000000000001","role":"authenticated"}', true);

select extensions.is((select count(*) from public.sites), 1::bigint, 'user A sees only their own site');
select extensions.is((select count(*) from public.pages), 1::bigint, 'user A sees only their own pages');
select extensions.is((select count(*) from public.sites where id = '40000000-0000-4000-8000-000000000002'), 0::bigint, 'user A cannot read user B site');
select extensions.is((select count(*) from public.pages where id = '50000000-0000-4000-8000-000000000002'), 0::bigint, 'user A cannot read user B page');

reset role;
select extensions.ok(
  not has_column_privilege('anon', 'public.pages', 'content', 'SELECT'),
  'anonymous clients cannot select draft page content'
);

select * from extensions.finish();
rollback;
