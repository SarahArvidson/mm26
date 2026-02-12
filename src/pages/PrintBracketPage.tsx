import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import {
  resolveActiveSeason,
  type Season,
  type BracketMatchup,
  type Song,
  type MasterResult,
} from '../utils/bracketLogic';
import MasterBracketDisplay from '../components/MasterBracketDisplay';

export default function PrintBracketPage() {
  const { seasonId } = useParams<{ seasonId: string }>();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [season, setSeason] = useState<Season | null>(null);
  const [matchups, setMatchups] = useState<BracketMatchup[]>([]);
  const [songs, setSongs] = useState<Song[]>([]);
  const [masterResults, setMasterResults] = useState<MasterResult[]>([]);

  useEffect(() => {
    if (!seasonId) return;
    loadData();
  }, [seasonId]);

  const loadData = async () => {
    if (!seasonId) return;

    try {
      setLoading(true);
      setError(null);

      // Fetch season
      const { data: seasonData, error: seasonError } = await supabase
        .from('seasons')
        .select('*')
        .eq('id', seasonId)
        .single();

      if (seasonError) throw seasonError;
      if (!seasonData) throw new Error('Season not found');
      setSeason(seasonData as Season);

      // Fetch bracket matchups
      const { data: matchupsData, error: matchupsError } = await supabase
        .from('bracket_matchups')
        .select('*')
        .eq('season_id', seasonId)
        .order('round', { ascending: true })
        .order('matchup_number', { ascending: true });

      if (matchupsError) throw matchupsError;
      setMatchups((matchupsData || []) as BracketMatchup[]);

      // Fetch songs
      const { data: songsData, error: songsError } = await supabase
        .from('songs')
        .select('*')
        .eq('season_id', seasonId);

      if (songsError) throw songsError;
      setSongs((songsData || []) as Song[]);

      // Fetch master results
      const { data: resultsData, error: resultsError } = await supabase
        .from('master_results')
        .select('*')
        .eq('season_id', seasonId);

      if (resultsError) throw resultsError;
      setMasterResults((resultsData || []) as MasterResult[]);
    } catch (err: any) {
      setError(err.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return <div>Error: {error}</div>;
  }

  if (!season) {
    return <div>Season not found</div>;
  }

  return (
    <>
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .print-bracket, .print-bracket * {
            visibility: visible;
          }
          .print-bracket {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          .no-print {
            display: none;
          }
        }
      `}</style>
      <div className="print-bracket">
        <MasterBracketDisplay
          seasonName={season.name}
          matchups={matchups}
          songs={songs}
          masterResults={masterResults}
          showRoundHeaders={true}
        />
      </div>
      <div className="no-print" style={{ padding: '20px' }}>
        <button onClick={() => window.print()}>Print Bracket</button>
      </div>
    </>
  );
}
