import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import {
  resolveActiveSeason,
  type Season,
  type BracketMatchup,
  type Song,
  type MasterResult,
} from '../utils/bracketLogic';
import MasterBracketDisplay from '../components/MasterBracketDisplay';

export default function EmbedBracketPage() {
  const { seasonId } = useParams<{ seasonId: string }>();
  const [searchParams] = useSearchParams();
  const hideNav = searchParams.get('nav') === '0';

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
    return <div>Chargement...</div>;
  }

  if (error) {
    return <div>Erreur : {error}</div>;
  }

  if (!season) {
    return <div>Saison introuvable</div>;
  }

  return (
    <div style={{ padding: hideNav ? '0' : '20px' }}>
      <MasterBracketDisplay
        seasonName={hideNav ? '' : season.name}
        matchups={matchups}
        songs={songs}
        masterResults={masterResults}
        showRoundHeaders={!hideNav}
      />
    </div>
  );
}
