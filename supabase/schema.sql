create table public.activities (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null,
  color text not null,
  sort_order integer not null default 0,
  archived boolean not null default false,
  deleted boolean not null default false,
  updated_at timestamptz not null default now()
);

create table public.entries (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  activity_id uuid not null,
  started_at timestamptz not null,
  ended_at timestamptz,
  note text not null default '',
  deleted boolean not null default false,
  updated_at timestamptz not null default now()
);

create table public.settings (
  user_id uuid primary key default auth.uid() references auth.users on delete cascade,
  data jsonb not null default '{}',
  updated_at timestamptz not null default now()
);

create index activities_sync on public.activities (user_id, updated_at);
create index entries_sync on public.entries (user_id, updated_at);

alter table public.activities enable row level security;
alter table public.entries enable row level security;
alter table public.settings enable row level security;

create policy "own rows" on public.activities for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows" on public.entries for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows" on public.settings for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Server-side change stamp, used as the pull cursor for sync. It is set by
-- the database on every write, so devices with skewed clocks or late pushes
-- are never skipped.
alter table public.activities add column server_at timestamptz not null default clock_timestamp();
alter table public.entries add column server_at timestamptz not null default clock_timestamp();

create function public.touch_server_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.server_at = clock_timestamp();
  return new;
end $$;

create trigger touch_server_at before insert or update on public.activities
  for each row execute function public.touch_server_at();
create trigger touch_server_at before insert or update on public.entries
  for each row execute function public.touch_server_at();

drop index public.activities_sync;
drop index public.entries_sync;
create index activities_sync on public.activities (user_id, server_at);
create index entries_sync on public.entries (user_id, server_at);
