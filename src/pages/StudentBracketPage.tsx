import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import {
  resolveActiveSeason,
  getValidOptionsForMatchup,
  type Season,
  type BracketMatchup,
  type Song,
  type StudentPick,
  type StudentBracket,
  type UUID,
} from '../utils/bracketLogic';

export default function StudentBracketPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeSeason, setActiveSeason] = useState<Season | null>(null);
  const [matchups, setMatchups] = useState<BracketMatchup[]>([]);
  const [songs, setSongs] = useState<Song[]>([]);
  const [studentBracket, setStudentBracket] = useState<StudentBracket | null>(null);
  const [studentPicks, setStudentPicks] = useState<StudentPick[]>([]);
  const [saving, setSaving] = useState(false);
  const [finalizing, setFinalizing] = useState(false);

  useEffect(() => {
    if (!user) return;
    loadData();
  }, [user]);

  const loadData = async () => {
    if (!user) return;

    try {
      setLoading(true);
      setError(null);

      // Fetch all seasons
      const { data: seasonsData, error: seasonsError } = await supabase
        .from('seasons')
        .select('*');

      if (seasonsError) throw seasonsError;
      if (!seasonsData) throw new Error('No seasons found');

      const active = resolveActiveSeason(seasonsData as Season[]);
      if (!active) {
        setError('No active season found');
        setLoading(false);
        return;
      }

      setActiveSeason(active);

      // Fetch bracket matchups for active season
      const { data: matchupsData, error: matchupsError } = await supabase
        .from('bracket_matchups')
        .select('*')
        .eq('season_id', active.id)
        .order('round', { ascending: true })
        .order('matchup_number', { ascending: true });

      if (matchupsError) throw matchupsError;
      setMatchups((matchupsData || []) as BracketMatchup[]);

      // Fetch songs for active season
      const { data: songsData, error: songsError } = await supabase
        .from('songs')
        .select('*')
        .eq('season_id', active.id);

      if (songsError) throw songsError;
      setSongs((songsData || []) as Song[]);

      // Fetch or create student bracket
      const { data: bracketData, error: bracketError } = await supabase
        .from('student_brackets')
        .select('*')
        .eq('student_id', user.id)
        .eq('season_id', active.id)
        .single();

      if (bracketError && bracketError.code !== 'PGRST116') {
        throw bracketError;
      }

      let bracket: StudentBracket;
      if (bracketData) {
        bracket = bracketData as StudentBracket;
        setStudentBracket(bracket);
      } else {
        // Create new student bracket
        const { data: newBracketData, error: createError } = await supabase
          .from('student_brackets')
          .insert({
            student_id: user.id,
            season_id: active.id,
            finalized: false,
            points: 0,
          })
          .select()
          .single();

        if (createError) throw createError;
        bracket = newBracketData as StudentBracket;
        setStudentBracket(bracket);
      }

      // Fetch student picks
      const { data: picksData, error: picksError } = await supabase
        .from('student_picks')
        .select('*')
        .eq('student_bracket_id', bracket.id);

      if (picksError) throw picksError;
      setStudentPicks((picksData || []) as StudentPick[]);
    } catch (err: any) {
      setError(err.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handlePickChange = async (matchupId: UUID, songId: UUID) => {
    if (!studentBracket || studentBracket.finalized || saving) return;

    try {
      setSaving(true);

      // Check if pick already exists
      const existingPick = studentPicks.find(p => p.bracket_matchup_id === matchupId);

      if (existingPick) {
        // Update existing pick
        const { error: updateError } = await supabase
          .from('student_picks')
          .update({ picked_song_id: songId })
          .eq('id', existingPick.id);

        if (updateError) throw updateError;

        setStudentPicks(prev =>
          prev.map(p =>
            p.id === existingPick.id ? { ...p, picked_song_id: songId } : p
          )
        );
      } else {
        // Insert new pick
        const { data: newPick, error: insertError } = await supabase
          .from('student_picks')
          .insert({
            student_bracket_id: studentBracket.id,
            bracket_matchup_id: matchupId,
            picked_song_id: songId,
          })
          .select()
          .single();

        if (insertError) throw insertError;
        setStudentPicks(prev => [...prev, newPick as StudentPick]);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to save pick');
    } finally {
      setSaving(false);
    }
  };

  const handleFinalize = async () => {
    if (!studentBracket || studentBracket.finalized || finalizing) return;

    try {
      setFinalizing(true);
      setError(null);

      const { error: updateError } = await supabase
        .from('student_brackets')
        .update({ finalized: true })
        .eq('id', studentBracket.id);

      if (updateError) throw updateError;

      setStudentBracket(prev => prev ? { ...prev, finalized: true } : null);
    } catch (err: any) {
      setError(err.message || 'Failed to finalize bracket');
    } finally {
      setFinalizing(false);
    }
  };

  const getSongLabel = (songId: UUID): string => {
    const song = songs.find(s => s.id === songId);
    if (!song) return '';
    return `« ${song.title} » – ${song.artist}`;
  };

  const getMatchupsByRound = (): Map<number, BracketMatchup[]> => {
    const grouped = new Map<number, BracketMatchup[]>();
    matchups.forEach(matchup => {
      const round = matchup.round;
      if (!grouped.has(round)) {
        grouped.set(round, []);
      }
      grouped.get(round)!.push(matchup);
    });
    return grouped;
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  if (error && !activeSeason) {
    return <div>Error: {error}</div>;
  }

  if (!activeSeason) {
    return <div>No active season</div>;
  }

  const matchupsByRound = getMatchupsByRound();
  const isFinalized = studentBracket?.finalized || false;

  return (
    <div>
      <h1>Student Bracket - {activeSeason.name}</h1>
      {error && <div>Error: {error}</div>}
      {isFinalized && <div>This bracket has been finalized and cannot be edited.</div>}

      {Array.from(matchupsByRound.entries())
        .sort(([a], [b]) => a - b)
        .map(([round, roundMatchups]) => (
          <div key={round}>
            <h2>Round {round}</h2>
            {roundMatchups.map(matchup => {
              const validOptions = getValidOptionsForMatchup(matchup, matchups, studentPicks);
              const currentPick = studentPicks.find(p => p.bracket_matchup_id === matchup.id);
              const currentSongId = currentPick?.picked_song_id || '';

              return (
                <div key={matchup.id}>
                  <label>
                    Matchup {matchup.matchup_number}:
                    <select
                      value={currentSongId}
                      onChange={(e) => handlePickChange(matchup.id, e.target.value)}
                      disabled={isFinalized || saving || validOptions.length === 0}
                    >
                      <option value="">-- Select --</option>
                      {validOptions.map(songId => (
                        <option key={songId} value={songId}>
                          {getSongLabel(songId)}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              );
            })}
          </div>
        ))}

      {!isFinalized && (
        <button
          onClick={handleFinalize}
          disabled={finalizing || saving || studentPicks.length !== matchups.length}
        >
          {finalizing ? 'Finalizing...' : 'Finalize Bracket'}
        </button>
      )}
    </div>
  );
}
