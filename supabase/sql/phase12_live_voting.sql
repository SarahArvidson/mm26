-- Phase 12: Live Voting – class_matchup_voting (gate) and student_votes

-- 1) Gate table
create table if not exists public.class_matchup_voting (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  bracket_matchup_id uuid not null references public.bracket_matchups(id) on delete cascade,

  is_open boolean not null default false,

  opened_by uuid references public.teachers(id) on delete set null,
  opened_at timestamptz,
  closed_at timestamptz,
  closes_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists class_matchup_voting_unique
  on public.class_matchup_voting (season_id, class_id, bracket_matchup_id);

create index if not exists class_matchup_voting_lookup
  on public.class_matchup_voting (class_id, season_id, bracket_matchup_id);

-- 2) Votes table
create table if not exists public.student_votes (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  bracket_matchup_id uuid not null references public.bracket_matchups(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  picked_song_id uuid not null references public.songs(id) on delete restrict,
  created_at timestamptz not null default now()
);

create unique index if not exists student_votes_one_per_matchup
  on public.student_votes (student_id, season_id, bracket_matchup_id);

create index if not exists student_votes_lookup
  on public.student_votes (class_id, season_id, bracket_matchup_id);

create index if not exists student_votes_song
  on public.student_votes (picked_song_id);

-- 3) RLS
alter table public.class_matchup_voting enable row level security;
alter table public.student_votes enable row level security;

-- Gate table policies
create policy "Teachers can read voting gates for own classes"
on public.class_matchup_voting for select to authenticated
using (
  exists (
    select 1 from public.teachers t
    join public.classes c on c.teacher_id = t.id
    where t.id = auth.uid() and c.id = class_matchup_voting.class_id
  )
);

create policy "Teachers can create voting gates for own classes"
on public.class_matchup_voting for insert to authenticated
with check (
  exists (
    select 1 from public.teachers t
    join public.classes c on c.teacher_id = t.id
    where t.id = auth.uid() and c.id = class_matchup_voting.class_id
  )
);

create policy "Teachers can update voting gates for own classes"
on public.class_matchup_voting for update to authenticated
using (
  exists (
    select 1 from public.teachers t
    join public.classes c on c.teacher_id = t.id
    where t.id = auth.uid() and c.id = class_matchup_voting.class_id
  )
)
with check (
  exists (
    select 1 from public.teachers t
    join public.classes c on c.teacher_id = t.id
    where t.id = auth.uid() and c.id = class_matchup_voting.class_id
  )
);

create policy "Students can read voting gates for their class"
on public.class_matchup_voting for select to authenticated
using (
  exists (
    select 1 from public.students s
    where s.id = auth.uid() and s.class_id = class_matchup_voting.class_id
  )
);

-- Votes table policies
create policy "Students can read own votes"
on public.student_votes for select to authenticated
using (student_votes.student_id = auth.uid());

create policy "Students can vote when gate is open"
on public.student_votes for insert to authenticated
with check (
  student_votes.student_id = auth.uid()
  and exists (
    select 1 from public.students s
    where s.id = auth.uid() and s.class_id = student_votes.class_id
  )
  and exists (
    select 1 from public.class_matchup_voting g
    where g.class_id = student_votes.class_id
      and g.season_id = student_votes.season_id
      and g.bracket_matchup_id = student_votes.bracket_matchup_id
      and g.is_open = true
  )
);

create policy "Teachers can read class votes"
on public.student_votes for select to authenticated
using (
  exists (
    select 1 from public.teachers t
    join public.classes c on c.teacher_id = t.id
    where t.id = auth.uid() and c.id = student_votes.class_id
  )
);

create policy "Teachers can delete class votes"
on public.student_votes for delete to authenticated
using (
  exists (
    select 1 from public.teachers t
    join public.classes c on c.teacher_id = t.id
    where t.id = auth.uid() and c.id = student_votes.class_id
  )
);
