import { useState } from 'react';
import type {
  BracketMatchup,
  Song,
  MasterResult,
  UUID,
} from '../utils/bracketLogic';

interface RapidEntryPanelProps {
  matchups: BracketMatchup[];
  songs: Song[];
  masterResults: MasterResult[];
  onBatchUpdate: (updates: Array<{ matchupId: UUID; songId: UUID }>) => Promise<void>;
  getValidOptionsForMatchup: (matchup: BracketMatchup) => UUID[];
}

export default function RapidEntryPanel({
  matchups,
  songs,
  masterResults,
  onBatchUpdate,
  getValidOptionsForMatchup,
}: RapidEntryPanelProps) {
  const [rapidMode, setRapidMode] = useState(false);
  const [pendingUpdates, setPendingUpdates] = useState<Map<UUID, UUID>>(new Map());
  const [saving, setSaving] = useState(false);

  const getSongLabel = (songId: UUID): string => {
    const song = songs.find(s => s.id === songId);
    if (!song) return '';
    return `« ${song.title} » – ${song.artist}`;
  };

  const handleRapidSelection = (matchupId: UUID, songId: UUID) => {
    if (!rapidMode) return;
    setPendingUpdates(prev => new Map(prev).set(matchupId, songId));
  };

  const handleSaveBatch = async () => {
    if (pendingUpdates.size === 0) return;

    try {
      setSaving(true);
      const updates = Array.from(pendingUpdates.entries()).map(([matchupId, songId]) => ({
        matchupId,
        songId,
      }));
      await onBatchUpdate(updates);
      setPendingUpdates(new Map());
    } catch (err) {
      console.error('Batch update failed:', err);
    } finally {
      setSaving(false);
    }
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

  if (!rapidMode) {
    return (
      <div style={{ marginBottom: '20px' }}>
        <label>
          <input
            type="checkbox"
            checked={rapidMode}
            onChange={(e) => setRapidMode(e.target.checked)}
          />
          Enable Rapid Entry Mode
        </label>
      </div>
    );
  }

  const matchupsByRound = getMatchupsByRound();

  return (
    <div style={{ border: '2px solid #4CAF50', padding: '20px', marginBottom: '20px' }}>
      <div style={{ marginBottom: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <label>
          <input
            type="checkbox"
            checked={rapidMode}
            onChange={(e) => setRapidMode(e.target.checked)}
          />
          Rapid Entry Mode (Active)
        </label>
        {pendingUpdates.size > 0 && (
          <div>
            <span style={{ marginRight: '10px' }}>
              {pendingUpdates.size} update{pendingUpdates.size !== 1 ? 's' : ''} pending
            </span>
            <button onClick={handleSaveBatch} disabled={saving}>
              {saving ? 'Saving...' : `Save ${pendingUpdates.size} Update${pendingUpdates.size !== 1 ? 's' : ''}`}
            </button>
          </div>
        )}
      </div>

      {Array.from(matchupsByRound.entries())
        .sort(([a], [b]) => a - b)
        .map(([round, roundMatchups]) => (
          <div key={round}>
            <h3>Round {round}</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '10px' }}>
              {roundMatchups.map(matchup => {
                const validOptions = getValidOptionsForMatchup(matchup);
                const masterResult = masterResults.find(r => r.bracket_matchup_id === matchup.id);
                const currentSongId = masterResult?.winner_song_id;
                const pendingSongId = pendingUpdates.get(matchup.id);
                const displaySongId = pendingSongId || currentSongId;

                return (
                  <div key={matchup.id} style={{ border: '1px solid #ddd', padding: '10px' }}>
                    <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>
                      Matchup {matchup.matchup_number}
                    </div>
                    <select
                      value={displaySongId || ''}
                      onChange={(e) => handleRapidSelection(matchup.id, e.target.value)}
                      disabled={validOptions.length === 0}
                      style={{ width: '100%' }}
                    >
                      <option value="">-- Select --</option>
                      {validOptions.map(songId => (
                        <option key={songId} value={songId}>
                          {getSongLabel(songId)}
                        </option>
                      ))}
                    </select>
                    {pendingSongId && pendingSongId !== currentSongId && (
                      <div style={{ fontSize: '12px', color: '#4CAF50', marginTop: '5px' }}>
                        Pending update
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
    </div>
  );
}
