import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { resolveActiveSeason, type Season } from '../utils/bracketLogic';

type SongRow = {
  id: string;
  title: string;
  artist: string;
  youtube_url: string | null;
};

export default function VideoLibraryPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [songs, setSongs] = useState<SongRow[]>([]);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError(null);

        const { data: seasonsData, error: seasonsError } = await supabase
          .from('seasons')
          .select('*');

        if (seasonsError) throw seasonsError;
        const active = resolveActiveSeason((seasonsData || []) as Season[]);
        if (!active) {
          setSongs([]);
          return;
        }

        const { data: songsData, error: songsError } = await supabase
          .from('songs')
          .select('id, title, artist, youtube_url')
          .eq('season_id', active.id)
          .order('title', { ascending: true });

        if (songsError) throw songsError;
        setSongs((songsData || []) as SongRow[]);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Erreur');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  return (
    <div style={{ maxWidth: '720px', margin: '0 auto', padding: '24px' }}>
      <h1 style={{ fontSize: '1.5rem', marginBottom: '8px' }}>Vidéos – Tableaumanie</h1>
      <p style={{ fontSize: '14px', color: '#6B7280', marginBottom: '24px' }}>
        Écoute les chansons du tableau.
      </p>

      {loading && (
        <p style={{ fontSize: '14px', color: '#6B7280' }}>
          Chargement...
        </p>
      )}

      {!loading && error && (
        <p style={{ fontSize: '14px', color: '#DC2626' }}>
          Erreur: {error}
        </p>
      )}

      {!loading && !error && songs.length === 0 && (
        <p style={{ fontSize: '14px', color: '#6B7280' }}>
          Pas de vidéos pour le moment.
        </p>
      )}

      {!loading && !error && songs.length > 0 && (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {songs.map((song) => (
            <li
              key={song.id}
              style={{
                marginBottom: '16px',
                padding: '14px',
                border: '1px solid #E5E7EB',
                borderRadius: '12px',
                backgroundColor: '#FFFFFF',
              }}
            >
              <div style={{ fontWeight: 600, fontSize: '15px', color: '#111827', marginBottom: '4px' }}>
                « {song.title} » – {song.artist}
              </div>

              {song.youtube_url ? (
                <a
                  href={song.youtube_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ fontSize: '14px', color: '#7C3AED' }}
                >
                  Voir sur YouTube
                </a>
              ) : (
                <div style={{ fontSize: '14px', color: '#6B7280' }}>
                  Lien bientôt
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
