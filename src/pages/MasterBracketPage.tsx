import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import {
  resolveActiveSeason,
  getValidMasterOptionsForMatchup,
  type Season,
  type BracketMatchup,
  type Song,
  type MasterResult,
  type StudentBracket,
  type StudentPick,
  type UUID,
} from '../utils/bracketLogic';
import { computePerStudentScores } from '../utils/scoring';

export default function MasterBracketPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [activeSeason, setActiveSeason] = useState<Season | null>(null);
  const [matchups, setMatchups] = useState<BracketMatchup[]>([]);
  const [songs, setSongs] = useState<Song[]>([]);
  const [masterResults, setMasterResults] = useState<MasterResult[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    checkAdmin();
    loadData();
  }, [user]);

  const checkAdmin = async () => {
    if (!user) return;
    const { data: userData } = await supabase.supabase.auth.getUser();
    const role = userData.user?.app_metadata?.role;
    setIsAdmin(role === 'admin');
  };

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

      // Fetch master results
      const { data: resultsData, error: resultsError } = await supabase
        .from('master_results')
        .select('*')
        .eq('season_id', active.id);

      if (resultsError) throw resultsError;
      setMasterResults((resultsData || []) as MasterResult[]);
    } catch (err: any) {
      setError(err.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleMasterSelection = async (matchupId: UUID, songId: UUID) => {
    if (!activeSeason || !isAdmin || saving) return;

    try {
      setSaving(true);
      setError(null);

      // Check if result already exists
      const existingResult = masterResults.find(r => r.bracket_matchup_id === matchupId);

      if (existingResult) {
        // Update existing result
        const { error: updateError } = await supabase
          .from('master_results')
          .update({ winner_song_id: songId })
          .eq('id', existingResult.id);

        if (updateError) throw updateError;

        setMasterResults(prev =>
          prev.map(r =>
            r.id === existingResult.id ? { ...r, winner_song_id: songId } : r
          )
        );
      } else {
        // Insert new result
        const { data: newResult, error: insertError } = await supabase
          .from('master_results')
          .insert({
            season_id: activeSeason.id,
            bracket_matchup_id: matchupId,
            winner_song_id: songId,
          })
          .select()
          .single();

        if (insertError) throw insertError;
        setMasterResults(prev => [...prev, newResult as MasterResult]);
      }

      // Recalculate scores for all student brackets
      // Fetch all student brackets for the active season
      const { data: allBracketsData, error: bracketsError } = await supabase
        .from('student_brackets')
        .select('*')
        .eq('season_id', activeSeason.id);

      if (bracketsError) throw bracketsError;
      const allBrackets = (allBracketsData || []) as StudentBracket[];

      if (allBrackets.length === 0) {
        return;
      }

      // Fetch all student picks for those brackets
      const bracketIds = allBrackets.map(b => b.id);
      const { data: allPicksData, error: picksError } = await supabase
        .from('student_picks')
        .select('*')
        .in('student_bracket_id', bracketIds);

      if (picksError) throw picksError;
      const allPicks = (allPicksData || []) as StudentPick[];

      // Fetch updated master results
      const { data: updatedResultsData, error: resultsError } = await supabase
        .from('master_results')
        .select('*')
        .eq('season_id', activeSeason.id);

      if (resultsError) throw resultsError;
      const updatedMasterResults = (updatedResultsData || []) as MasterResult[];

      // Fetch students to build studentNames map
      const studentIds = allBrackets.map(b => b.student_id);
      const { data: studentsData, error: studentsError } = await supabase
        .from('students')
        .select('id, name')
        .in('id', studentIds);

      if (studentsError) throw studentsError;
      const studentNames = new Map<UUID, string>();
      (studentsData || []).forEach((s: any) => {
        studentNames.set(s.id, s.name);
      });

      // Compute scores using computePerStudentScores
      const scores = computePerStudentScores(
        allBrackets,
        allPicks,
        updatedMasterResults,
        matchups,
        studentNames
      );

      // Update each bracket with computed score
      for (const score of scores) {
        const bracket = allBrackets.find(b => b.student_id === score.student_id);
        if (bracket) {
          const { error: updateScoreError } = await supabase.supabase
            .from('student_brackets')
            .update({ points: score.total_score })
            .eq('id', bracket.id);

          if (updateScoreError) throw updateScoreError;
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to save master result');
    } finally {
      setSaving(false);
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

  if (!isAdmin) {
    return <div>Access denied. Admin only.</div>;
  }

  if (error && !activeSeason) {
    return <div>Error: {error}</div>;
  }

  if (!activeSeason) {
    return <div>No active season</div>;
  }

  const matchupsByRound = getMatchupsByRound();

  return (
    <div>
      <h1>Master Bracket - {activeSeason.name}</h1>
      {error && <div>Error: {error}</div>}

      {Array.from(matchupsByRound.entries())
        .sort(([a], [b]) => a - b)
        .map(([round, roundMatchups]) => (
          <div key={round}>
            <h2>Round {round}</h2>
            {roundMatchups.map(matchup => {
              const validOptions = getValidMasterOptionsForMatchup(matchup, matchups, masterResults);
              const masterResult = masterResults.find(r => r.bracket_matchup_id === matchup.id);
              const currentSongId = masterResult?.winner_song_id || '';
              const currentSong = songs.find(s => s.id === currentSongId);

              return (
                <div key={matchup.id}>
                  <label>
                    Matchup {matchup.matchup_number}:
                    <select
                      value={currentSongId}
                      onChange={(e) => handleMasterSelection(matchup.id, e.target.value)}
                      disabled={saving || validOptions.length === 0}
                    >
                      <option value="">-- Select --</option>
                      {validOptions.map(songId => (
                        <option key={songId} value={songId}>
                          {getSongLabel(songId)}
                        </option>
                      ))}
                    </select>
                  </label>
                  {currentSong && (
                    <div>
                      Winner: {currentSong.youtube_url ? (
                        <a href={currentSong.youtube_url} target="_blank" rel="noopener noreferrer">
                          {getSongLabel(currentSongId)}
                        </a>
                      ) : (
                        getSongLabel(currentSongId)
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
    </div>
  );
}
