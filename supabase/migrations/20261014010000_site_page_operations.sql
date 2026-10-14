-- Phase 2: transactional operations for owned sites and hierarchical pages.
-- All RPC functions run as the caller and rely on RLS; never use SECURITY DEFINER.

grant select, insert, update, delete on public.sites, public.pages to authenticated;
revoke insert, update, delete on public.sites, public.pages from anon;

create unique index if not exists pages_one_home_page_per_site
  on public.pages(site_id) where is_home;

create or replace function public.create_site(p_name text)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_owner_id uuid := auth.uid();
  v_count integer;
  v_base_slug text;
  v_slug text;
  v_suffix integer := 1;
  v_site_id uuid;
begin
  if v_owner_id is null then
    raise exception 'Authentication required';
  end if;

  if p_name is null or length(btrim(p_name)) < 2 or length(btrim(p_name)) > 60 then
    raise exception 'Site name must contain between 2 and 60 characters';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_owner_id::text, 1));

  select count(*) into v_count
  from public.sites
  where owner_id = v_owner_id;

  if v_count >= 3 then
    raise exception 'Site limit reached';
  end if;

  v_base_slug := trim(both '-' from regexp_replace(
    translate(lower(btrim(p_name)), 'äöå', 'aoa'),
    '[^a-z0-9]+', '-', 'g'
  ));
  if v_base_slug = '' then
    v_base_slug := 'site';
  end if;
  v_base_slug := left(v_base_slug, 60);

  loop
    if v_suffix = 1 then
      v_slug := v_base_slug;
    else
      v_slug := left(v_base_slug, 59 - length(v_suffix::text)) || '-' || v_suffix::text;
    end if;

    begin
      insert into public.sites (owner_id, name, slug)
      values (v_owner_id, btrim(p_name), v_slug)
      returning id into v_site_id;

      return v_site_id;
    exception when unique_violation then
      v_suffix := v_suffix + 1;
    end;
  end loop;
end;
$$;

create or replace function public.create_page(
  p_site_id uuid,
  p_parent_id uuid,
  p_title text
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_owner_id uuid := auth.uid();
  v_parent_path text;
  v_base_slug text;
  v_slug text;
  v_path text;
  v_position integer;
  v_suffix integer := 1;
  v_page_id uuid;
begin
  if v_owner_id is null then
    raise exception 'Authentication required';
  end if;

  if p_title is null or length(btrim(p_title)) < 1 or length(btrim(p_title)) > 80 then
    raise exception 'Page title must contain between 1 and 80 characters';
  end if;

  if not exists (
    select 1 from public.sites
    where id = p_site_id and owner_id = v_owner_id
  ) then
    raise exception 'Site not found';
  end if;

  if p_parent_id is null then
    v_parent_path := null;
  else
    select path into v_parent_path
    from public.pages
    where id = p_parent_id and site_id = p_site_id;
    if not found then
      raise exception 'Parent page not found in this site';
    end if;
  end if;

  v_base_slug := trim(both '-' from regexp_replace(
    translate(lower(btrim(p_title)), 'äöå', 'aoa'),
    '[^a-z0-9]+', '-', 'g'
  ));
  if v_base_slug = '' then
    v_base_slug := 'page';
  end if;
  v_base_slug := left(v_base_slug, 70);

  select coalesce(max(position), -1) + 1 into v_position
  from public.pages
  where site_id = p_site_id and parent_id is not distinct from p_parent_id;

  loop
    if v_suffix = 1 then
      v_slug := v_base_slug;
    else
      v_slug := left(v_base_slug, 79 - length(v_suffix::text)) || '-' || v_suffix::text;
    end if;

    v_path := case when v_parent_path is null then v_slug else v_parent_path || '/' || v_slug end;

    begin
      insert into public.pages (site_id, parent_id, title, slug, position, path)
      values (p_site_id, p_parent_id, btrim(p_title), v_slug, v_position, v_path)
      returning id into v_page_id;

      return v_page_id;
    exception when unique_violation then
      v_suffix := v_suffix + 1;
    end;
  end loop;
end;
$$;

create or replace function public.rename_page(
  p_page_id uuid,
  p_title text
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_page public.pages%rowtype;
  v_parent_path text;
  v_base_slug text;
  v_slug text;
  v_old_path text;
  v_new_path text;
  v_suffix integer := 1;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  if p_title is null or length(btrim(p_title)) < 1 or length(btrim(p_title)) > 80 then
    raise exception 'Page title must contain between 1 and 80 characters';
  end if;

  select pages.* into v_page
  from public.pages pages
  join public.sites sites on sites.id = pages.site_id
  where pages.id = p_page_id and sites.owner_id = auth.uid();

  if not found then
    raise exception 'Page not found';
  end if;

  if v_page.parent_id is null then
    v_parent_path := null;
  else
    select path into v_parent_path from public.pages where id = v_page.parent_id;
  end if;

  v_base_slug := trim(both '-' from regexp_replace(
    translate(lower(btrim(p_title)), 'äöå', 'aoa'),
    '[^a-z0-9]+', '-', 'g'
  ));
  if v_base_slug = '' then
    v_base_slug := 'page';
  end if;
  v_base_slug := left(v_base_slug, 70);

  loop
    if v_suffix = 1 then
      v_slug := v_base_slug;
    else
      v_slug := left(v_base_slug, 79 - length(v_suffix::text)) || '-' || v_suffix::text;
    end if;

    exit when not exists (
      select 1
      from public.pages siblings
      where siblings.site_id = v_page.site_id
        and siblings.parent_id is not distinct from v_page.parent_id
        and siblings.slug = v_slug
        and siblings.id <> v_page.id
    );

    v_suffix := v_suffix + 1;
  end loop;

  v_old_path := v_page.path;
  v_new_path := case when v_parent_path is null then v_slug else v_parent_path || '/' || v_slug end;

  update public.pages
  set title = btrim(p_title), slug = v_slug, path = v_new_path
  where id = v_page.id;

  if v_old_path <> v_new_path then
    update public.pages
    set path = v_new_path || substr(path, length(v_old_path) + 1)
    where site_id = v_page.site_id and path like v_old_path || '/%';
  end if;
end;
$$;

create or replace function public.move_page(
  p_page_id uuid,
  p_parent_id uuid,
  p_position integer
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_page public.pages%rowtype;
  v_parent_path text;
  v_old_path text;
  v_new_path text;
  v_old_parent_id uuid;
  v_dest_count integer;
  v_position integer;
  v_would_cycle boolean := false;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select pages.* into v_page
  from public.pages pages
  join public.sites sites on sites.id = pages.site_id
  where pages.id = p_page_id and sites.owner_id = auth.uid();

  if not found then
    raise exception 'Page not found';
  end if;

  if p_parent_id = p_page_id then
    raise exception 'A page cannot be its own parent';
  end if;

  if p_parent_id is null then
    v_parent_path := null;
  else
    select path into v_parent_path
    from public.pages
    where id = p_parent_id and site_id = v_page.site_id;

    if not found then
      raise exception 'Parent page not found in this site';
    end if;

    with recursive descendants(id) as (
      select v_page.id
      union
      select child.id
      from public.pages child
      join descendants d on child.parent_id = d.id
      where child.site_id = v_page.site_id
    )
    select exists(select 1 from descendants where id = p_parent_id)
    into v_would_cycle;

    if v_would_cycle then
      raise exception 'A page cannot be moved below one of its descendants';
    end if;
  end if;

  if exists (
    select 1 from public.pages siblings
    where siblings.site_id = v_page.site_id
      and siblings.parent_id is not distinct from p_parent_id
      and siblings.slug = v_page.slug
      and siblings.id <> v_page.id
  ) then
    raise exception 'A page with this slug already exists at the destination';
  end if;

  select count(*) into v_dest_count
  from public.pages
  where site_id = v_page.site_id
    and parent_id is not distinct from p_parent_id
    and id <> v_page.id;

  v_position := least(greatest(coalesce(p_position, 0), 0), v_dest_count);
  v_old_path := v_page.path;
  v_new_path := case when v_parent_path is null then v_page.slug else v_parent_path || '/' || v_page.slug end;
  v_old_parent_id := v_page.parent_id;

  update public.pages
  set parent_id = p_parent_id, position = v_position, path = v_new_path
  where id = v_page.id;

  if v_old_path <> v_new_path then
    update public.pages
    set path = v_new_path || substr(path, length(v_old_path) + 1)
    where site_id = v_page.site_id and path like v_old_path || '/%';
  end if;

  if v_old_parent_id is distinct from p_parent_id then
    with ordered as (
      select id, row_number() over (order by position, id) - 1 as next_position
      from public.pages
      where site_id = v_page.site_id and parent_id is not distinct from v_old_parent_id
    )
    update public.pages page
    set position = ordered.next_position
    from ordered
    where page.id = ordered.id;
  end if;

  with other_siblings as (
    select
      id,
      row_number() over (order by position, id) - 1 as sibling_index
    from public.pages
    where site_id = v_page.site_id
      and parent_id is not distinct from p_parent_id
      and id <> p_page_id
  ),
  assignments as (
    select
      id,
      sibling_index + case when sibling_index >= v_position then 1 else 0 end as next_position
    from other_siblings
    union all
    select p_page_id, v_position
  )
  update public.pages page
  set position = assignments.next_position
  from assignments
  where page.id = assignments.id;
end;
$;

create or replace function public.copy_page_subtree(p_page_id uuid)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_root public.pages%rowtype;
  v_node record;
  v_parent_id uuid;
  v_parent_path text;
  v_slug text;
  v_path text;
  v_title text;
  v_position integer;
  v_suffix integer := 1;
  v_new_id uuid;
  v_result_id uuid;
  v_old_ids uuid[] := array[]::uuid[];
  v_new_ids uuid[] := array[]::uuid[];
  v_parent_index integer;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select pages.* into v_root
  from public.pages pages
  join public.sites sites on sites.id = pages.site_id
  where pages.id = p_page_id and sites.owner_id = auth.uid();

  if not found then
    raise exception 'Page not found';
  end if;

  for v_node in
    with recursive subtree as (
      select pages.*, 0 as depth
      from public.pages pages
      where pages.id = p_page_id and pages.site_id = v_root.site_id
      union all
      select child.*, parent.depth + 1
      from public.pages child
      join subtree parent on child.parent_id = parent.id
      where child.site_id = v_root.site_id
    )
    select * from subtree order by depth, position, id
  loop
    if v_node.id = v_root.id then
      v_parent_id := v_root.parent_id;
      v_title := left(v_root.title || ' (kopio)', 80);
      v_slug := left(v_root.slug, 55) || '-copy';

      while exists (
        select 1 from public.pages existing
        where existing.site_id = v_root.site_id
          and existing.parent_id is not distinct from v_root.parent_id
          and existing.slug = v_slug
      ) loop
        v_suffix := v_suffix + 1;
        v_slug := left(v_root.slug, 55 - length(v_suffix::text)) || '-copy-' || v_suffix::text;
      end loop;

      select coalesce(max(position), -1) + 1 into v_position
      from public.pages
      where site_id = v_root.site_id and parent_id is not distinct from v_root.parent_id;

      if v_parent_id is null then
        v_parent_path := null;
      else
        select path into v_parent_path from public.pages where id = v_parent_id;
      end if;
    else
      v_parent_index := array_position(v_old_ids, v_node.parent_id);
      if v_parent_index is null then
        raise exception 'Copy could not resolve a parent page';
      end if;
      v_parent_id := v_new_ids[v_parent_index];
      select path into v_parent_path from public.pages where id = v_parent_id;
      v_title := v_node.title;
      v_slug := v_node.slug;
      v_position := v_node.position;
    end if;

    v_path := case when v_parent_path is null then v_slug else v_parent_path || '/' || v_slug end;

    insert into public.pages (
      site_id, parent_id, title, slug, position, path,
      show_in_nav, is_home, status, seo, content, published_content
    )
    values (
      v_root.site_id, v_parent_id, v_title, v_slug, v_position, v_path,
      v_node.show_in_nav, false, 'draft', v_node.seo, v_node.content, '[]'::jsonb
    )
    returning id into v_new_id;

    v_old_ids := array_append(v_old_ids, v_node.id);
    v_new_ids := array_append(v_new_ids, v_new_id);

    if v_node.id = v_root.id then
      v_result_id := v_new_id;
    end if;
  end loop;

  return v_result_id;
end;
$$;


create or replace function public.set_home_page(p_page_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $
declare
  v_site_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select pages.site_id into v_site_id
  from public.pages pages
  join public.sites sites on sites.id = pages.site_id
  where pages.id = p_page_id and sites.owner_id = auth.uid();

  if not found then
    raise exception 'Page not found';
  end if;

  update public.pages
  set is_home = false
  where site_id = v_site_id and is_home and id <> p_page_id;

  update public.pages
  set is_home = true
  where id = p_page_id;
end;
$;

revoke all on function public.create_site(text) from public, anon;
revoke all on function public.create_page(uuid, uuid, text) from public, anon;
revoke all on function public.rename_page(uuid, text) from public, anon;
revoke all on function public.move_page(uuid, uuid, integer) from public, anon;
revoke all on function public.copy_page_subtree(uuid) from public, anon;
revoke all on function public.set_home_page(uuid) from public, anon;

grant execute on function public.create_site(text) to authenticated;
grant execute on function public.create_page(uuid, uuid, text) to authenticated;
grant execute on function public.rename_page(uuid, text) to authenticated;
grant execute on function public.move_page(uuid, uuid, integer) to authenticated;
grant execute on function public.copy_page_subtree(uuid) to authenticated;
grant execute on function public.set_home_page(uuid) to authenticated;
