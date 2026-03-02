-- Stage 13 Chunk I: Per-class results release gate (manual approval, no CLI)

create table if not exists public.class_results_release (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  is_released boolean not null default false,
  released_at timestamptz null,
  released_by uuid null references public.teachers(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (season_id, class_id)
);

alter table public.class_results_release enable row level security;

-- Teachers: can read for classes they own
create policy "Teacher can select release for own classes"
on public.class_results_release
for select
to authenticated
using (
  exists (
    select 1 from public.classes c
    where c.id = class_results_release.class_id
      and c.teacher_id = auth.uid()
  )
);

-- Teachers: can create row for classes they own (publishing)
create policy "Teacher can insert release row for own classes"
on public.class_results_release
for insert
to authenticated
with check (
  exists (
    select 1 from public.classes c
    where c.id = class_results_release.class_id
      and c.teacher_id = auth.uid()
  )
);

-- Teachers: can update row for classes they own (re-publish not needed, but safe)
create policy "Teacher can update release for own classes"
on public.class_results_release
for update
to authenticated
using (
  exists (
    select 1 from public.classes c
    where c.id = class_results_release.class_id
      and c.teacher_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.classes c
    where c.id = class_results_release.class_id
      and c.teacher_id = auth.uid()
  )
);

-- Students: can read release state for their own class
create policy "Student can select release for own class"
on public.class_results_release
for select
to authenticated
using (
  exists (
    select 1 from public.students s
    where s.id = auth.uid()
      and s.class_id = class_results_release.class_id
  )
);

-- Admin: can read/update all
create policy "Admin can select all release"
on public.class_results_release
for select
to authenticated
using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create policy "Admin can update all release"
on public.class_results_release
for update
to authenticated
using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
