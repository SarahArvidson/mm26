// IMPORTANT:
// Scoring is server-triggered when master_results change.
// Do NOT compute or write student_brackets.points from the UI.

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
  type UUID,
} from '../utils/bracketLogic';
import RapidEntryPanel from '../components/RapidEntryPanel';

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
    await handleBatchMasterUpdate([{ matchupId, songId }]);
  };

  const propagateMasterAdvancement = async () => {
    if (!activeSeason) return;

    // Fetch fresh bracket_matchups for active season
    const { data: allMatchupsData, error: matchupsError } = await supabase
      .from('bracket_matchups')
      .select('*')
      .eq('season_id', activeSeason.id)
      .order('round', { ascending: true })
      .order('matchup_number', { ascending: true });

    if (matchupsError) throw matchupsError;
    const allMatchups = (allMatchupsData || []) as BracketMatchup[];

    // Fetch fresh master_results for active season
    const { data: allResultsData, error: resultsError } = await supabase
      .from('master_results')
      .select('*')
      .eq('season_id', activeSeason.id);

    if (resultsError) throw resultsError;
    const allResults = (allResultsData || []) as MasterResult[];

    // Build master results map: matchupId -> winner_song_id
    const masterResultsMap = new Map<UUID, UUID>();
    allResults.forEach(result => {
      masterResultsMap.set(result.bracket_matchup_id, result.winner_song_id);
    });

    // Round start numbers
    const roundStarts: Record<number, number> = {
      1: 1,
      2: 9,
      3: 13,
      4: 15,
    };

    // Build updates for rounds 2-4
    const updates: Array<{ matchupId: UUID; song1_id: UUID | null; song2_id: UUID | null }> = [];

    // Process rounds 1-3 to propagate to rounds 2-4
    for (let round = 1; round <= 3; round++) {
      const roundStart = roundStarts[round];
      const nextRoundStart = roundStarts[round + 1];

      const roundMatchups = allMatchups.filter(m => m.round === round);
      
      for (const matchup of roundMatchups) {
        const indexInRound = matchup.matchup_number - roundStart;
        const nextMatchupNumber = nextRoundStart + Math.floor(indexInRound / 2);
        
        const nextMatchup = allMatchups.find(
          m => m.round === round + 1 && m.matchup_number === nextMatchupNumber
        );
        
        if (!nextMatchup) continue;

        const winnerSongId = masterResultsMap.get(matchup.id) || null;
        const isSong1 = indexInRound % 2 === 0;

        // Find or create update entry for this next matchup
        let updateEntry = updates.find(u => {
          const m = allMatchups.find(m => m.id === u.matchupId);
          return m && m.round === round + 1 && m.matchup_number === nextMatchupNumber;
        });

        if (!updateEntry) {
          // Initialize with current values
          const currentMatchup = allMatchups.find(m => m.id === nextMatchup.id);
          updateEntry = {
            matchupId: nextMatchup.id,
            song1_id: currentMatchup?.song1_id || null,
            song2_id: currentMatchup?.song2_id || null,
          };
          updates.push(updateEntry);
        }

        // Set the appropriate slot
        if (isSong1) {
          updateEntry.song1_id = winnerSongId;
        } else {
          updateEntry.song2_id = winnerSongId;
        }
      }
    }

    // Apply updates only if values changed
    for (const update of updates) {
      const currentMatchup = allMatchups.find(m => m.id === update.matchupId);
      if (!currentMatchup) continue;

      const needsUpdate = 
        currentMatchup.song1_id !== update.song1_id ||
        currentMatchup.song2_id !== update.song2_id;

      if (needsUpdate) {
        const { error: updateError } = await supabase
          .from('bracket_matchups')
          .update({
            song1_id: update.song1_id,
            song2_id: update.song2_id,
          })
          .eq('id', update.matchupId);

        if (updateError) throw updateError;
      }
    }

    // Refresh matchups state
    const { data: refreshedMatchups, error: refreshError } = await supabase
      .from('bracket_matchups')
      .select('*')
      .eq('season_id', activeSeason.id)
      .order('round', { ascending: true })
      .order('matchup_number', { ascending: true });

    if (refreshError) throw refreshError;
    setMatchups((refreshedMatchups || []) as BracketMatchup[]);
  };

  const handleBatchMasterUpdate = async (updates: Array<{ matchupId: UUID; songId: UUID }>) => {
    if (!activeSeason || !isAdmin || saving) return;

    try {
      setSaving(true);
      setError(null);

      // Process each update
      for (const { matchupId, songId } of updates) {
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
      }

      // Propagate advancement to rounds 2-4
      await propagateMasterAdvancement();
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

      <RapidEntryPanel
        matchups={matchups}
        songs={songs}
        masterResults={masterResults}
        onBatchUpdate={handleBatchMasterUpdate}
        getValidOptionsForMatchup={(matchup) => getValidMasterOptionsForMatchup(matchup, matchups, masterResults)}
      />

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
