create extension if not exists pgcrypto;

create type public.site_status as enum ('draft', 'published');
create type public.page_status as enum ('draft', 'published');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  plan text not null default 'free',
  locale text not null default 'fi-FI',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.sites (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  slug text not null unique,
  theme jsonb not null default '{}'::jsonb,
  settings jsonb not null default '{}'::jsonb,
  status public.site_status not null default 'draft',
  published_at timestamptz,
  custom_domain text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.pages (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites(id) on delete cascade,
  parent_id uuid references public.pages(id) on delete cascade,
  title text not null,
  slug text not null,
  position integer not null default 0,
  path text not null,
  show_in_nav boolean not null default true,
  is_home boolean not null default false,
  status public.page_status not null default 'draft',
  seo jsonb not null default '{}'::jsonb,
  content jsonb not null default '[]'::jsonb,
  published_content jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pages_path_not_empty check (length(trim(path)) > 0),
  constraint pages_slug_not_empty check (length(trim(slug)) > 0),
  constraint pages_position_non_negative check (position >= 0)
);

create unique index pages_site_path_unique on public.pages(site_id, path);
create unique index pages_site_root_slug_unique on public.pages(site_id, slug) where parent_id is null;
create unique index pages_site_parent_slug_unique on public.pages(site_id, parent_id, slug) where parent_id is not null;

create table public.media_folders (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites(id) on delete cascade,
  parent_id uuid references public.media_folders(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.media (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  storage_path text not null,
  filename text not null,
  mime text not null,
  size_bytes bigint not null,
  width integer,
  height integer,
  alt_text text,
  folder_id uuid references public.media_folders(id) on delete set null,
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint media_size_non_negative check (size_bytes >= 0)
);

create table public.forms_submissions (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites(id) on delete cascade,
  page_id uuid references public.pages(id) on delete set null,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.ai_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  site_id uuid references public.sites(id) on delete cascade,
  kind text not null,
  tokens_in integer not null default 0,
  tokens_out integer not null default 0,
  credits numeric(12, 4) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ai_usage_tokens_in_non_negative check (tokens_in >= 0),
  constraint ai_usage_tokens_out_non_negative check (tokens_out >= 0),
  constraint ai_usage_credits_non_negative check (credits >= 0)
);

create table public.redirects (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites(id) on delete cascade,
  from_path text not null,
  to_page_id uuid not null references public.pages(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (site_id, from_path)
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger sites_set_updated_at before update on public.sites for each row execute function public.set_updated_at();
create trigger pages_set_updated_at before update on public.pages for each row execute function public.set_updated_at();
create trigger media_folders_set_updated_at before update on public.media_folders for each row execute function public.set_updated_at();
create trigger media_set_updated_at before update on public.media for each row execute function public.set_updated_at();
create trigger forms_submissions_set_updated_at before update on public.forms_submissions for each row execute function public.set_updated_at();
create trigger ai_usage_set_updated_at before update on public.ai_usage for each row execute function public.set_updated_at();
create trigger redirects_set_updated_at before update on public.redirects for each row execute function public.set_updated_at();

create or replace function public.prevent_page_cycle()
returns trigger
language plpgsql
as $$
declare
  current_id uuid;
  parent_site_id uuid;
begin
  if new.parent_id is null then
    return new;
  end if;

  if new.parent_id = new.id then
    raise exception 'A page cannot be its own parent';
  end if;

  select site_id into parent_site_id
  from public.pages
  where id = new.parent_id;

  if parent_site_id is null then
    raise exception 'Parent page does not exist';
  end if;

  if parent_site_id <> new.site_id then
    raise exception 'Parent page must belong to the same site';
  end if;

  current_id := new.parent_id;
  while current_id is not null loop
    if current_id = new.id then
      raise exception 'A page cannot be moved below one of its descendants';
    end if;
    select parent_id into current_id from public.pages where id = current_id;
  end loop;

  return new;
end;
$$;

create trigger pages_prevent_cycle before insert or update of parent_id, site_id on public.pages
for each row execute function public.prevent_page_cycle();

create or replace function public.validate_media_ownership()
returns trigger
language plpgsql
as $$
begin
  if not exists (
    select 1 from public.sites
    where id = new.site_id and owner_id = new.owner_id
  ) then
    raise exception 'Media owner must own the associated site';
  end if;

  if new.folder_id is not null and not exists (
    select 1 from public.media_folders
    where id = new.folder_id and site_id = new.site_id
  ) then
    raise exception 'Media folder must belong to the same site';
  end if;

  return new;
end;
$$;

create trigger media_validate_ownership before insert or update of site_id, owner_id, folder_id on public.media
for each row execute function public.validate_media_ownership();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.sites enable row level security;
alter table public.pages enable row level security;
alter table public.media_folders enable row level security;
alter table public.media enable row level security;
alter table public.forms_submissions enable row level security;
alter table public.ai_usage enable row level security;
alter table public.redirects enable row level security;

create policy "profiles_select_own" on public.profiles for select using (auth.uid() = id);
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

create policy "sites_select_own" on public.sites for select using (auth.uid() = owner_id);
create policy "sites_insert_own" on public.sites for insert with check (auth.uid() = owner_id);
create policy "sites_update_own" on public.sites for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy "sites_delete_own" on public.sites for delete using (auth.uid() = owner_id);
create policy "sites_select_published_public" on public.sites for select using (status = 'published');

create policy "pages_select_own" on public.pages for select using (
  exists (select 1 from public.sites where sites.id = pages.site_id and sites.owner_id = auth.uid())
);
create policy "pages_insert_own" on public.pages for insert with check (
  exists (select 1 from public.sites where sites.id = pages.site_id and sites.owner_id = auth.uid())
);
create policy "pages_update_own" on public.pages for update using (
  exists (select 1 from public.sites where sites.id = pages.site_id and sites.owner_id = auth.uid())
) with check (
  exists (select 1 from public.sites where sites.id = pages.site_id and sites.owner_id = auth.uid())
);
create policy "pages_delete_own" on public.pages for delete using (
  exists (select 1 from public.sites where sites.id = pages.site_id and sites.owner_id = auth.uid())
);
create policy "pages_select_published_public" on public.pages for select using (
  status = 'published' and exists (select 1 from public.sites where sites.id = pages.site_id and sites.status = 'published')
);

create policy "media_folders_manage_own" on public.media_folders for all using (
  exists (select 1 from public.sites where sites.id = media_folders.site_id and sites.owner_id = auth.uid())
) with check (
  exists (select 1 from public.sites where sites.id = media_folders.site_id and sites.owner_id = auth.uid())
);

create policy "media_manage_own" on public.media for all using (
  exists (select 1 from public.sites where sites.id = media.site_id and sites.owner_id = auth.uid())
) with check (
  exists (select 1 from public.sites where sites.id = media.site_id and sites.owner_id = auth.uid())
);

create policy "forms_submissions_owner_read" on public.forms_submissions for select using (
  exists (select 1 from public.sites where sites.id = forms_submissions.site_id and sites.owner_id = auth.uid())
);
create policy "forms_submissions_public_insert" on public.forms_submissions for insert with check (
  exists (select 1 from public.sites where sites.id = forms_submissions.site_id and sites.status = 'published')
);

create policy "ai_usage_owner_read" on public.ai_usage for select using (auth.uid() = user_id);
create policy "ai_usage_owner_insert" on public.ai_usage for insert with check (auth.uid() = user_id);

create policy "redirects_owner_manage" on public.redirects for all using (
  exists (select 1 from public.sites where sites.id = redirects.site_id and sites.owner_id = auth.uid())
) with check (
  exists (select 1 from public.sites where sites.id = redirects.site_id and sites.owner_id = auth.uid())
);

-- Public rendering may only read published fields. RLS filters rows, while
-- column grants prevent anonymous clients from reading draft content or owners.
revoke select on public.sites from anon;
grant select (id, name, slug, theme, status, published_at) on public.sites to anon;

revoke select on public.pages from anon;
grant select (
  id, site_id, parent_id, title, slug, position, path, show_in_nav, is_home,
  status, seo, published_content, created_at, updated_at
) on public.pages to anon;

-- The plan is managed by the application, not editable by the account holder.
revoke update on public.profiles from authenticated;
grant update (display_name, avatar_url, locale) on public.profiles to authenticated;
