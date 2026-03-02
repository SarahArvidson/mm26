import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { resolveActiveSeason, type Season } from '../utils/bracketLogic';

type SongRow = {
  id: string;
  title: string;
  artist: string;
  youtube_url: string | null;
};

const REVEAL_VIDEOS: { title: string; youtube_url: string }[] = [
  { title: 'Révélation 1', youtube_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
  { title: 'Révélation 2', youtube_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
  { title: 'Révélation 3', youtube_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
];

const LAST_YEAR_SONGS: { title: string; artist: string; youtube_url: string | null }[] = [
  { title: 'Chanson 1', artist: 'Artiste A', youtube_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
  { title: 'Chanson 2', artist: 'Artiste B', youtube_url: null },
  { title: 'Chanson 3', artist: 'Artiste C', youtube_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
  { title: 'Chanson 4', artist: 'Artiste D', youtube_url: null },
  { title: 'Chanson 5', artist: 'Artiste E', youtube_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
  { title: 'Chanson 6', artist: 'Artiste F', youtube_url: null },
];

const accordionCardStyle = {
  border: '1px solid #E5E7EB',
  borderRadius: '12px',
  backgroundColor: '#FFFFFF',
  marginBottom: '16px',
  overflow: 'hidden' as const,
};

const summaryStyle = {
  display: 'flex' as const,
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '14px 16px',
  cursor: 'pointer' as const,
  fontWeight: 600,
  fontSize: '15px',
  color: '#111827',
  listStyle: 'none' as const,
};

const contentStyle = {
  padding: '12px 16px 16px',
  borderTop: '1px solid #E5E7EB',
  display: 'flex' as const,
  flexDirection: 'column' as const,
  gap: '12px',
};

const itemCardStyle = {
  padding: '14px',
  border: '1px solid #E5E7EB',
  borderRadius: '12px',
  backgroundColor: '#FFFFFF',
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

      {!loading && (
        <>
          <details open style={accordionCardStyle}>
            <summary style={summaryStyle}>
              Chansons du tableau (cette année)
              <span style={{ fontSize: '14px', color: '#6B7280' }}>▾</span>
            </summary>
            <div style={contentStyle}>
              {songs.length === 0 ? (
                <p style={{ fontSize: '14px', color: '#6B7280', margin: 0 }}>
                  Pas de chansons pour le moment.
                </p>
              ) : (
                songs.map((song) => (
                  <div key={song.id} style={itemCardStyle}>
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
                      <div style={{ fontSize: '14px', color: '#6B7280' }}>Lien bientôt</div>
                    )}
                  </div>
                ))
              )}
            </div>
          </details>

          <details style={accordionCardStyle}>
            <summary style={summaryStyle}>
              Vidéos révélation (cette année)
              <span style={{ fontSize: '14px', color: '#6B7280' }}>▾</span>
            </summary>
            <div style={contentStyle}>
              {REVEAL_VIDEOS.map((item, i) => (
                <div key={i} style={itemCardStyle}>
                  <div style={{ fontWeight: 600, fontSize: '15px', color: '#111827', marginBottom: '4px' }}>
                    {item.title}
                  </div>
                  <a
                    href={item.youtube_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ fontSize: '14px', color: '#7C3AED' }}
                  >
                    Voir sur YouTube
                  </a>
                </div>
              ))}
            </div>
          </details>

          <details style={accordionCardStyle}>
            <summary style={summaryStyle}>
              Chansons (année dernière)
              <span style={{ fontSize: '14px', color: '#6B7280' }}>▾</span>
            </summary>
            <div style={contentStyle}>
              {LAST_YEAR_SONGS.map((item, i) => (
                <div key={i} style={itemCardStyle}>
                  <div style={{ fontWeight: 600, fontSize: '15px', color: '#111827', marginBottom: '4px' }}>
                    « {item.title} » – {item.artist}
                  </div>
                  {item.youtube_url ? (
                    <a
                      href={item.youtube_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ fontSize: '14px', color: '#7C3AED' }}
                    >
                      Voir sur YouTube
                    </a>
                  ) : (
                    <div style={{ fontSize: '14px', color: '#6B7280' }}>Lien bientôt</div>
                  )}
                </div>
              ))}
            </div>
          </details>
        </>
      )}
    </div>
  );
}
