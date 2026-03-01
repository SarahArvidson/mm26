-- Stage 13: Teacher feedback table

create table if not exists public.teacher_feedback (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.teachers(id) on delete cascade,
  season_id uuid references public.seasons(id) on delete set null,
  message text not null,
  created_at timestamptz not null default now()
);

create index if not exists teacher_feedback_teacher_created
  on public.teacher_feedback (teacher_id, created_at desc);

alter table public.teacher_feedback enable row level security;

-- Teachers can insert their own
create policy "Teachers can insert own feedback"
on public.teacher_feedback for insert to authenticated
with check (teacher_id = auth.uid());

-- Teachers can select only their own
create policy "Teachers can select own feedback"
on public.teacher_feedback for select to authenticated
using (teacher_id = auth.uid());

-- Admin can select all
create policy "Admin can select all feedback"
on public.teacher_feedback for select to authenticated
using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
