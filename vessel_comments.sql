-- vessel_comments: threaded messages per vessel_name
--
-- NEW database: run **section A**, then **section B** (B is quick backfill).
-- EXISTING vessel_comments without parent_id/thread_root_id: run **section B only**.
-- If `create policy` errors because policies exist, drop those policies first or skip section A.

-- ═══════════════════════════════════════════════════════════════════════════
-- A) Initial create (skipped if table already exists)
-- ═══════════════════════════════════════════════════════════════════════════
create table if not exists vessel_comments (
  id uuid default gen_random_uuid() primary key,
  vessel_name text not null,
  message text not null,
  author_email text not null,
  author_role text not null,
  resolved boolean default false,
  created_at timestamptz default now(),
  parent_id uuid references vessel_comments (id) on delete cascade,
  thread_root_id uuid,
  title text,
  issue_level text
);

alter table vessel_comments enable row level security;

create policy "authenticated read" on vessel_comments
  for select using (auth.role() = 'authenticated');

create policy "authenticated insert" on vessel_comments
  for insert with check (auth.role() = 'authenticated');

create policy "authenticated update" on vessel_comments
  for update using (auth.role() = 'authenticated');

create policy "authenticated delete" on vessel_comments
  for delete using (auth.role() = 'authenticated');

-- ═══════════════════════════════════════════════════════════════════════════
-- B) Migration — add threading columns to an older table (safe to re-run)
-- ═══════════════════════════════════════════════════════════════════════════
alter table vessel_comments
  add column if not exists parent_id uuid references vessel_comments (id) on delete cascade;

alter table vessel_comments
  add column if not exists thread_root_id uuid;

update vessel_comments
set thread_root_id = id
where thread_root_id is null;

alter table vessel_comments add column if not exists title text default null;

alter table vessel_comments add column if not exists issue_level text default null;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'vessel_comments' and policyname = 'authenticated delete'
  ) then
    create policy "authenticated delete" on vessel_comments
      for delete using (auth.role() = 'authenticated');
  end if;
end $$;

-- Enable Realtime (Dashboard → Database → Replication), or:
-- alter publication supabase_realtime add table vessel_comments;
