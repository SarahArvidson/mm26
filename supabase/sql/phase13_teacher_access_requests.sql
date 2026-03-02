-- Stage 13 Chunk H: Teacher access requests + allowlist (manual approval, no CLI)

create table if not exists public.teacher_access_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  full_name text not null,
  school_name text not null,
  school_email text not null,
  levels text not null,
  class_count int null,
  student_count int null,
  message text null,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

create index if not exists teacher_access_requests_user_created
  on public.teacher_access_requests (user_id, created_at desc);

create index if not exists teacher_access_requests_status_created
  on public.teacher_access_requests (status, created_at desc);

alter table public.teacher_access_requests enable row level security;

create policy "Authenticated can insert own teacher access request"
on public.teacher_access_requests
for insert
to authenticated
with check (user_id = auth.uid());

create policy "Admin can select teacher access requests"
on public.teacher_access_requests
for select
to authenticated
using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create policy "Admin can update teacher access requests"
on public.teacher_access_requests
for update
to authenticated
using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create table if not exists public.teacher_allowlist (
  user_id uuid primary key,
  note text null,
  created_at timestamptz not null default now()
);

alter table public.teacher_allowlist enable row level security;

create policy "Admin can select teacher allowlist"
on public.teacher_allowlist
for select
to authenticated
using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create policy "Admin can insert teacher allowlist"
on public.teacher_allowlist
for insert
to authenticated
with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create policy "Admin can delete teacher allowlist"
on public.teacher_allowlist
for delete
to authenticated
using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
