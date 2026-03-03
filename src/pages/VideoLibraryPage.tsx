import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { resolveActiveSeason, type Season } from "../utils/bracketLogic";

type SongRow = {
  id: string;
  title: string;
  artist: string;
  youtube_url: string | null;
};

type BracketMatchupRow = {
  id: string;
  season_id: string;
  round: number;
  matchup_number: number;
  song1_id: string | null;
  song2_id: string | null;
};

const REVEAL_VIDEOS: { title: string; youtube_url: string }[] = [
  { title: "Révélation 1", youtube_url: "" },
  { title: "Révélation 2", youtube_url: "" },
  { title: "Révélation 3", youtube_url: "" },
];

const LAST_YEAR_SONGS: {
  title: string;
  artist: string;
  youtube_url: string | null;
}[] = [
  {
    title: "Chanson 1",
    artist: "Artiste A",
    youtube_url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  },
  { title: "Chanson 2", artist: "Artiste B", youtube_url: null },
  {
    title: "Chanson 3",
    artist: "Artiste C",
    youtube_url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  },
  { title: "Chanson 4", artist: "Artiste D", youtube_url: null },
  {
    title: "Chanson 5",
    artist: "Artiste E",
    youtube_url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  },
  { title: "Chanson 6", artist: "Artiste F", youtube_url: null },
];

const accordionCardStyle = {
  border: "1px solid #E5E7EB",
  borderRadius: "12px",
  backgroundColor: "#FFFFFF",
  marginBottom: "16px",
  overflow: "hidden" as const,
};

const summaryStyle = {
  display: "flex" as const,
  justifyContent: "space-between",
  alignItems: "center",
  padding: "14px 16px",
  cursor: "pointer" as const,
  fontWeight: 600,
  fontSize: "15px",
  color: "#111827",
  listStyle: "none" as const,
};

const contentStyle = {
  padding: "12px 16px 16px",
  borderTop: "1px solid #E5E7EB",
  display: "flex" as const,
  flexDirection: "column" as const,
  gap: "12px",
};

const itemCardStyle = {
  padding: "14px",
  border: "1px solid #E5E7EB",
  borderRadius: "12px",
  backgroundColor: "#FFFFFF",
};

export default function VideoLibraryPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [songs, setSongs] = useState<SongRow[]>([]);
  const [matchups, setMatchups] = useState<BracketMatchupRow[]>([]);
  void LAST_YEAR_SONGS; // keep for re-enable of "Chansons (année dernière)" section

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError(null);

        const { data: seasonsData, error: seasonsError } = await supabase
          .from("seasons")
          .select("*");

        if (seasonsError) throw seasonsError;
        const active = resolveActiveSeason((seasonsData || []) as Season[]);
        if (!active) {
          setSongs([]);
          setMatchups([]);
          return;
        }

        const { data: songsData, error: songsError } = await supabase
          .from("songs")
          .select("id, title, artist, youtube_url")
          .eq("season_id", active.id)
          .order("title", { ascending: true });

        if (songsError) throw songsError;
        setSongs((songsData || []) as SongRow[]);

        const { data: matchupsData, error: matchupsError } = await supabase
          .from("bracket_matchups")
          .select("id, season_id, round, matchup_number, song1_id, song2_id")
          .eq("season_id", active.id)
          .order("round", { ascending: true })
          .order("matchup_number", { ascending: true });

        if (matchupsError) throw matchupsError;
        setMatchups((matchupsData || []) as BracketMatchupRow[]);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Erreur");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  return (
    <div style={{ maxWidth: "720px", margin: "0 auto", padding: "24px" }}>
      <h1 style={{ fontSize: "1.5rem", marginBottom: "8px" }}>
        Vidéos – Tableaumanie
      </h1>
      <p style={{ fontSize: "14px", color: "#6B7280", marginBottom: "24px" }}>
        Écoute les chansons du tableau.
      </p>

      {loading && (
        <div
          style={{
            minHeight: "50vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            color: "#6B7280",
            fontSize: "14px",
          }}
        >
          Chargement...
        </div>
      )}

      {!loading && error && (
        <div
          style={{
            minHeight: "50vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            fontSize: "14px",
          }}
        >
          <p style={{ margin: 0, color: "#DC2626" }}>Erreur: {error}</p>
        </div>
      )}

      {!loading && (
        <>
          <details open style={accordionCardStyle}>
            <summary style={summaryStyle}>
              Chansons du tableau (cette année)
              <span style={{ fontSize: "14px", color: "#6B7280" }}>▾</span>
            </summary>
            <div style={{ ...contentStyle, gap: "16px" }}>
              {(() => {
                const songById = new Map(songs.map((s) => [s.id, s]));
                const round1Matchups = matchups.filter(
                  (m) =>
                    m.round === 1 &&
                    m.matchup_number >= 1 &&
                    m.matchup_number <= 8,
                );
                if (round1Matchups.length === 0) {
                  return (
                    <p
                      style={{ fontSize: "14px", color: "#6B7280", margin: 0 }}
                    >
                      Pas de matchs pour le moment.
                    </p>
                  );
                }
                return round1Matchups.map((matchup) => {
                  const leftSong = matchup.song1_id
                    ? songById.get(matchup.song1_id)
                    : null;
                  const rightSong = matchup.song2_id
                    ? songById.get(matchup.song2_id)
                    : null;
                  const tileBase = {
                    minWidth: "240px",
                    flex: 1,
                    borderRadius: "12px",
                    padding: "16px",
                    border: "2px solid #D1D5DB",
                    backgroundColor: "#FFFFFF",
                    textAlign: "center" as const,
                    fontSize: "14px",
                    fontWeight: 600,
                  };
                  const renderTile = (song: SongRow | null) => {
                    if (!song) {
                      return (
                        <div
                          style={{
                            ...tileBase,
                            opacity: 0.6,
                            color: "#6B7280",
                          }}
                        >
                          —
                        </div>
                      );
                    }
                    const label = `« ${song.title} » – ${song.artist}`;
                    if (song.youtube_url) {
                      return (
                        <a
                          href={song.youtube_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            ...tileBase,
                            color: "#7C3AED",
                            textDecoration: "none",
                            cursor: "pointer",
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.borderColor = "#7C3AED";
                            e.currentTarget.style.boxShadow =
                              "0 2px 8px rgba(124, 58, 237, 0.2)";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.borderColor = "#D1D5DB";
                            e.currentTarget.style.boxShadow = "none";
                          }}
                        >
                          {label}
                        </a>
                      );
                    }
                    return (
                      <div
                        style={{ ...tileBase, opacity: 0.7, cursor: "default" }}
                      >
                        <div style={{ color: "#111827" }}>{label}</div>
                        <div
                          style={{
                            fontSize: "13px",
                            color: "#6B7280",
                            marginTop: "4px",
                          }}
                        >
                          Lien bientôt
                        </div>
                      </div>
                    );
                  };
                  return (
                    <div
                      key={matchup.id}
                      style={{
                        border: "1px solid #E5E7EB",
                        borderRadius: "16px",
                        padding: "18px",
                        backgroundColor: "#FFFFFF",
                        marginBottom: "16px",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          marginBottom: "12px",
                          fontSize: "13px",
                          color: "#374151",
                        }}
                      >
                        <span>Match {matchup.matchup_number}</span>
                        <span style={{ color: "#6B7280" }}>Tour 1</span>
                      </div>
                      <div
                        style={{
                          display: "flex",
                          gap: "16px",
                          alignItems: "stretch",
                          justifyContent: "center",
                          flexWrap: "wrap",
                        }}
                      >
                        {renderTile(leftSong ?? null)}
                        {renderTile(rightSong ?? null)}
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </details>

          <details style={accordionCardStyle}>
            <summary style={summaryStyle}>
              Vidéos révélation (cette année)
              <span style={{ fontSize: "14px", color: "#6B7280" }}>▾</span>
            </summary>
            <div style={contentStyle}>
              {REVEAL_VIDEOS.map((item, i) => (
                <div key={i} style={itemCardStyle}>
                  <div
                    style={{
                      fontWeight: 600,
                      fontSize: "15px",
                      color: "#111827",
                      marginBottom: "4px",
                    }}
                  >
                    {item.title}
                  </div>
                  <a
                    href={item.youtube_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ fontSize: "14px", color: "#7C3AED" }}
                  >
                    Voir sur YouTube
                  </a>
                </div>
              ))}
            </div>
          </details>

          {/* TODO: Re-enable once last year's songs + URLs are added
          <details style={accordionCardStyle}>
            <summary style={summaryStyle}>
              Chansons (année dernière)
              <span style={{ fontSize: "14px", color: "#6B7280" }}>▾</span>
            </summary>
            <div style={contentStyle}>
              {LAST_YEAR_SONGS.map((item, i) => (
                <div key={i} style={itemCardStyle}>
                  <div
                    style={{
                      fontWeight: 600,
                      fontSize: "15px",
                      color: "#111827",
                      marginBottom: "4px",
                    }}
                  >
                    « {item.title} » – {item.artist}
                  </div>
                  {item.youtube_url ? (
                    <a
                      href={item.youtube_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ fontSize: "14px", color: "#7C3AED" }}
                    >
                      Voir sur YouTube
                    </a>
                  ) : (
                    <div style={{ fontSize: "14px", color: "#6B7280" }}>
                      Lien bientôt
                    </div>
                  )}
                </div>
              ))}
            </div>
          </details>
          */}
        </>
      )}
    </div>
  );
}
