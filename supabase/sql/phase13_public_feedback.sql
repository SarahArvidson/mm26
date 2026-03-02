-- Public feedback table: anonymous/authenticated users can submit messages.
-- No SELECT policy: we do not display a public feed.

create table if not exists public.public_feedback (
  id uuid primary key default gen_random_uuid(),
  message text not null,
  created_at timestamptz not null default now()
);

alter table public.public_feedback enable row level security;

-- Allow anyone (anon + authenticated) to insert. No select policy.
create policy "public_feedback_insert"
  on public.public_feedback
  for insert
  to anon, authenticated
  with check (true);
