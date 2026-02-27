-- supabase/sql/rpc_class_metrics.sql

create or replace function public.get_class_leaderboard(p_season_id uuid)
returns table (
  student_id uuid,
  student_name text,
  total_score int,
  rank int
)
language sql
security definer
set search_path = public
as $$
with caller as (
  select s.class_id
  from public.students s
  where s.id = auth.uid()
),
class_students as (
  select s.id as student_id, s.username as student_name
  from public.students s
  join caller c on c.class_id = s.class_id
),
class_brackets as (
  select sb.id as student_bracket_id, sb.student_id
  from public.student_brackets sb
  join class_students cs on cs.student_id = sb.student_id
  where sb.season_id = p_season_id
),
scored_picks as (
  select
    cb.student_id,
    cs.student_name,
    sum(
      case
        when mr.winner_song_id is not null and sp.picked_song_id = mr.winner_song_id then
          case bm.round
            when 1 then 1
            when 2 then 3
            when 3 then 5
            when 4 then 8
            else 0
          end
        else 0
      end
    )::int as total_score
  from class_brackets cb
  join class_students cs on cs.student_id = cb.student_id
  left join public.student_picks sp on sp.student_bracket_id = cb.student_bracket_id
  left join public.master_results mr
    on mr.season_id = p_season_id
   and mr.bracket_matchup_id = sp.bracket_matchup_id
  left join public.bracket_matchups bm
    on bm.season_id = p_season_id
   and bm.id = sp.bracket_matchup_id
  group by cb.student_id, cs.student_name
),
ranked as (
  select
    student_id,
    student_name,
    coalesce(total_score, 0) as total_score,
    dense_rank() over (order by coalesce(total_score, 0) desc, student_name asc) as rank
  from scored_picks
)
select student_id, student_name, total_score, rank
from ranked
order by rank asc, student_name asc;
$$;

create or replace function public.get_class_round_accuracy(p_season_id uuid)
returns table (
  round int,
  correct_count int,
  total_count int,
  percent numeric
)
language sql
security definer
set search_path = public
as $$
with caller as (
  select s.class_id
  from public.students s
  where s.id = auth.uid()
),
class_students as (
  select s.id as student_id
  from public.students s
  join caller c on c.class_id = s.class_id
),
class_brackets as (
  select sb.id as student_bracket_id, sb.student_id
  from public.student_brackets sb
  join class_students cs on cs.student_id = sb.student_id
  where sb.season_id = p_season_id
),
pick_rows as (
  select
    bm.round,
    case
      when mr.winner_song_id is not null and sp.picked_song_id = mr.winner_song_id then 1
      else 0
    end as is_correct
  from class_brackets cb
  join public.student_picks sp on sp.student_bracket_id = cb.student_bracket_id
  join public.bracket_matchups bm
    on bm.season_id = p_season_id
   and bm.id = sp.bracket_matchup_id
  left join public.master_results mr
    on mr.season_id = p_season_id
   and mr.bracket_matchup_id = sp.bracket_matchup_id
  where mr.winner_song_id is not null
)
select
  pr.round::int as round,
  sum(pr.is_correct)::int as correct_count,
  count(*)::int as total_count,
  round((sum(pr.is_correct)::numeric / nullif(count(*)::numeric, 0)) * 100, 1) as percent
from pick_rows pr
group by pr.round
order by pr.round asc;
$$;

grant execute on function public.get_class_leaderboard(uuid) to authenticated;
grant execute on function public.get_class_round_accuracy(uuid) to authenticated;
