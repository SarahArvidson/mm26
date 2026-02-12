import type {
  BracketMatchup,
  Song,
  MasterResult,
  UUID,
} from '../utils/bracketLogic';

interface MasterBracketDisplayProps {
  seasonName: string;
  matchups: BracketMatchup[];
  songs: Song[];
  masterResults: MasterResult[];
  showRoundHeaders?: boolean;
}

export default function MasterBracketDisplay({
  seasonName,
  matchups,
  songs,
  masterResults,
  showRoundHeaders = true,
}: MasterBracketDisplayProps) {
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

  const matchupsByRound = getMatchupsByRound();

  return (
    <>
      {seasonName && <h1>{seasonName}</h1>}
      
      {Array.from(matchupsByRound.entries())
        .sort(([a], [b]) => a - b)
        .map(([round, roundMatchups]) => (
          <div key={round}>
            {showRoundHeaders && <h2>Round {round}</h2>}
            {roundMatchups.map(matchup => {
              const masterResult = masterResults.find(r => r.bracket_matchup_id === matchup.id);
              const winnerSongId = masterResult?.winner_song_id;
              const song1 = songs.find(s => s.id === matchup.song1_id);
              const song2 = songs.find(s => s.id === matchup.song2_id);

              return (
                <div key={matchup.id} style={{ marginBottom: '10px' }}>
                  <div>
                    <strong>Matchup {matchup.matchup_number}:</strong>
                  </div>
                  <div>
                    {song1 && (
                      <div style={{ 
                        padding: '5px',
                        backgroundColor: winnerSongId === song1.id ? '#90EE90' : '#f0f0f0'
                      }}>
                        {getSongLabel(song1.id)}
                      </div>
                    )}
                    {song2 && (
                      <div style={{ 
                        padding: '5px',
                        backgroundColor: winnerSongId === song2.id ? '#90EE90' : '#f0f0f0'
                      }}>
                        {getSongLabel(song2.id)}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
    </>
  );
}
