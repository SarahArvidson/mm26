import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
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
  type MasterResult,
  type UUID,
} from '../utils/bracketLogic';
import {
  computePerRoundBreakdown,
  createLeaderboard,
  computePerStudentScores,
  getStudentRank,
  type StudentScore,
} from '../utils/scoring';
import RoundAccuracyPie from '../components/charts/RoundAccuracyPie';

export default function StudentBracketPage() {
  const { studentSession } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeSeason, setActiveSeason] = useState<Season | null>(null);
  const [matchups, setMatchups] = useState<BracketMatchup[]>([]);
  const [songs, setSongs] = useState<Song[]>([]);
  const [studentBracket, setStudentBracket] = useState<StudentBracket | null>(null);
  const [studentPicks, setStudentPicks] = useState<StudentPick[]>([]);
  const [saving, setSaving] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [leaderboard, setLeaderboard] = useState<StudentScore[]>([]);
  const [roundBreakdown, setRoundBreakdown] = useState<Array<{ round: number; score: number }>>([]);
  const [studentRank, setStudentRank] = useState(0);
  const [classBrackets, setClassBrackets] = useState<StudentBracket[]>([]);
  const [allPicks, setAllPicks] = useState<StudentPick[]>([]);
  const [masterResults, setMasterResults] = useState<MasterResult[]>([]);
  const [recentlySelected, setRecentlySelected] = useState<{ id: string; key: number } | null>(null);
  const [confirmingFinalize, setConfirmingFinalize] = useState(false);
  const [viewMode, setViewMode] = useState<'lobby' | 'bracket'>('lobby');
  const [messageIndex, setMessageIndex] = useState(0);
  const [perfPop, setPerfPop] = useState(false);
  const [perfBurstKey, setPerfBurstKey] = useState(0);
  const [perfBump, setPerfBump] = useState(false);
  const [displayRank, setDisplayRank] = useState(0);
  const [isCounting, setIsCounting] = useState(false);
  const [isStatementActive, setIsStatementActive] = useState(false);
  const popTimerRef = useRef<number | null>(null);
  const countIntervalRef = useRef<number | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (popTimerRef.current !== null) {
        clearTimeout(popTimerRef.current);
      }
      if (countIntervalRef.current !== null) {
        clearInterval(countIntervalRef.current);
      }
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  // Compute performance messages for cycling
  const totalStudents = leaderboard.length;
  const percentile = totalStudents > 0 && studentRank > 0
    ? Math.round((1 - (studentRank - 1) / totalStudents) * 100)
    : 0;
  const performanceMessages: string[] = [];
  if (studentRank === 1 && totalStudents > 0) {
    performanceMessages.push(
      `Tu es 1er sur ${totalStudents} élèves`,
      "Tu domines le classement",
      "Tout le monde te poursuit"
    );
  } else if (percentile >= 75) {
    performanceMessages.push(
      `Tu es dans le top ${100 - percentile}% de la classe`,
      "Encore quelques points pour atteindre la première place",
      "Très proche du sommet"
    );
  } else if (percentile >= 50) {
    performanceMessages.push(
      "Tu es dans la première moitié de la classe",
      "Continue comme ça",
      "Tu progresses"
    );
  } else {
    performanceMessages.push(
      "La compétition continue",
      "Chaque tour peut tout changer",
      "Rien n'est joué"
    );
  }


  useEffect(() => {
    // Redirect to login if no student session
    if (!studentSession) {
      navigate('/login');
      return;
    }
    
    loadData();
  }, [studentSession, navigate]);

  const loadData = async () => {
    if (!studentSession) return;

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
      const matchupsTyped = (matchupsData || []) as BracketMatchup[];
      setMatchups(matchupsTyped);

      // Fetch songs for active season
      const { data: songsData, error: songsError } = await supabase
        .from('songs')
        .select('*')
        .eq('season_id', active.id);

      if (songsError) throw songsError;
      const songsTyped = (songsData || []) as Song[];
      setSongs(songsTyped);

      // Fetch or create student bracket using non-destructive upsert
      const { data: bracketData, error: bracketError } = await supabase
        .from('student_brackets')
        .upsert(
          {
            student_id: studentSession.student_id,
            season_id: active.id,
          },
          {
            onConflict: 'student_id,season_id'
          }
        )
        .select()
        .single();

      if (bracketError) throw bracketError;
      const bracket = bracketData as StudentBracket;
      setStudentBracket(bracket);

      // Fetch student picks
      const { data: picksData, error: picksError } = await supabase
        .from('student_picks')
        .select('*')
        .eq('student_bracket_id', bracket.id);

      if (picksError) throw picksError;
      const studentPicksDataTyped = (picksData || []) as StudentPick[];
      setStudentPicks(studentPicksDataTyped);

      // Fetch master results for scoring
      const { data: masterResultsData, error: masterResultsError } = await supabase
        .from('master_results')
        .select('*')
        .eq('season_id', active.id);

      if (masterResultsError) throw masterResultsError;
      const masterResultsDataTyped = (masterResultsData || []) as MasterResult[];
      setMasterResults(masterResultsDataTyped);

      // Fetch all students in the class
      const { data: classStudentsData, error: classStudentsError } = await supabase
        .from('students')
        .select('id, username')
        .eq('class_id', studentSession.class_id);

      if (classStudentsError) throw classStudentsError;
      const studentNames = new Map<UUID, string>();
      (classStudentsData || []).forEach((s: any) => {
        studentNames.set(s.id, s.username);
      });

      // Fetch all student brackets for the class
      const { data: classBracketsData, error: classBracketsError } = await supabase
        .from('student_brackets')
        .select('*')
        .eq('season_id', active.id)
        .in('student_id', Array.from(studentNames.keys()));

      if (classBracketsError) throw classBracketsError;
      const classBracketsDataTyped = (classBracketsData || []) as StudentBracket[];
      setClassBrackets(classBracketsDataTyped);

      // Fetch all student picks for these brackets
      const bracketIds = classBracketsDataTyped.map(b => b.id);
      const { data: allPicksData, error: allPicksError } = await supabase
        .from('student_picks')
        .select('*')
        .in('student_bracket_id', bracketIds);

      if (allPicksError) throw allPicksError;
      const allPicksDataTyped = (allPicksData || []) as StudentPick[];
      setAllPicks(allPicksDataTyped);

      // Compute scores and leaderboard
      const scores = computePerStudentScores(
        classBracketsDataTyped,
        allPicksDataTyped,
        masterResultsDataTyped,
        matchupsTyped,
        studentNames
      );
      const sortedLeaderboard = createLeaderboard(scores);
      setLeaderboard(sortedLeaderboard);

      // Compute current student's rank and breakdown
      const rank = getStudentRank(studentSession.student_id, sortedLeaderboard);
      setStudentRank(rank);

      // Calculate per-round scores from picks and master results
      const breakdown = computePerRoundBreakdown(
        studentPicksDataTyped,
        masterResultsDataTyped,
        matchupsTyped
      );
      setRoundBreakdown(breakdown);
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
   const { data: authData } = await supabase.supabase.auth.getUser()

console.log("AUTH USER ID:", authData.user?.id)
    if (!studentBracket || studentBracket.finalized || finalizing) return;

    try {
      setFinalizing(true);
      setError(null);

      const { error: updateError } = await supabase.supabase
        .from('student_brackets')
        .update({ finalized: true })
        .eq('id', studentBracket.id);

      if (updateError) throw updateError;

      setStudentBracket(prev => prev ? { ...prev, finalized: true } : null);
      setConfirmingFinalize(false);
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

  // Handle performance card click to cycle messages
  const handlePerformanceClick = () => {
    setMessageIndex(prev =>
      (prev + 1) % performanceMessages.length
    );

    // Trigger burst remount for reliable replay
    setPerfBurstKey(prev => prev + 1);
    setPerfPop(true);

    // Card jump animation
    setPerfBump(true);
    setTimeout(() => {
      setPerfBump(false);
    }, 160);

    // Highlight contextual statement
    setIsStatementActive(true);
    setTimeout(() => {
      setIsStatementActive(false);
    }, 2000);

    // Clear any existing count interval
    if (countIntervalRef.current !== null) {
      clearInterval(countIntervalRef.current);
    }

    // Start rank count-down animation (100 → studentRank)
    if (studentRank > 0) {
      setIsCounting(true);
      setDisplayRank(100);

      const startTime = Date.now();
      const duration = 1000; // 1000ms
      const startValue = 100;
      const endValue = studentRank;

      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Smooth easing function (ease-out)
        const eased = 1 - Math.pow(1 - progress, 3);
        
        const current = Math.round(startValue - (startValue - endValue) * eased);
        setDisplayRank(current);

        if (progress < 1) {
          animationFrameRef.current = requestAnimationFrame(animate) as unknown as number;
        } else {
          setDisplayRank(endValue);
          setIsCounting(false);
          animationFrameRef.current = null;
        }
      };

      animationFrameRef.current = requestAnimationFrame(animate) as unknown as number;
    }

    setTimeout(() => {
      setPerfPop(false);
    }, 1200);
  };

  // Compute performance tier (using values computed above)
  let tierLabel = "🎶 Toujours en jeu";
  if (studentRank === 1) {
    tierLabel = "👑 Grande star";
  } else if (percentile >= 75) {
    tierLabel = "🎤 Sur scène";
  } else if (percentile >= 50) {
    tierLabel = "🎼 Bon rythme";
  } else {
    tierLabel = "🎵 Bonne oreille";
  }

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '20px' }}>
      <h1 style={{
        fontSize: '40px',
        fontWeight: 700,
        marginBottom: '32px'
      }}>
        🎵 Tableaumanie 2026
      </h1>
      <p style={{
        fontSize: '16px',
        color: '#6B7280',
        marginTop: '-16px',
        marginBottom: '40px'
      }}>
        Ton tableau et ta performance
      </p>
      {error && <div style={{ color: '#DC2626', marginBottom: '16px' }}>Error: {error}</div>}
      
      {viewMode === 'lobby' && (
        <>
          {/* Top Row: Bracket Action Card + Performance Snapshot */}
          <div style={{ display: 'flex', gap: '24px', alignItems: 'stretch', marginBottom: '48px', flexWrap: 'wrap' }}>
            {/* Bracket Action Card */}
            <div
              role={isFinalized ? "button" : undefined}
              tabIndex={isFinalized ? 0 : undefined}
              aria-label={isFinalized ? "Voir ton tableau" : undefined}
              style={{
                flex: 1,
                minWidth: '300px',
                padding: '32px',
                borderRadius: '20px',
                boxShadow: '0 6px 20px rgba(0,0,0,0.06)',
                border: '1px solid #E5E7EB',
                backgroundColor: '#FFFFFF',
                cursor: isFinalized ? 'pointer' : 'default',
                transition: 'all 200ms ease',
                outline: 'none'
              }}
              onMouseEnter={(e) => {
                if (isFinalized) {
                  e.currentTarget.style.transform = 'scale(1.02)';
                  e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.1)';
                }
              }}
              onMouseLeave={(e) => {
                if (isFinalized) {
                  e.currentTarget.style.transform = 'scale(1)';
                  e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,0.06)';
                }
              }}
              onFocus={(e) => {
                if (isFinalized) {
                  e.currentTarget.style.outline = '2px solid #7C3AED';
                  e.currentTarget.style.outlineOffset = '2px';
                }
              }}
              onBlur={(e) => {
                if (isFinalized) {
                  e.currentTarget.style.outline = 'none';
                }
              }}
              onKeyDown={(e) => {
                if (isFinalized && (e.key === 'Enter' || e.key === ' ')) {
                  e.preventDefault();
                  setViewMode('bracket');
                }
              }}
              onClick={() => setViewMode('bracket')}
            >
              <h2 style={{ marginTop: 0, marginBottom: '12px', color: '#7C3AED', fontSize: '20px', textAlign: 'center' }}>
                {isFinalized 
                  ? '🎼 Ton tableau'
                  : '🎧 Crée ton tableau'}
              </h2>
              <p style={{ color: '#6B7280', marginBottom: '16px', fontSize: '14px', textAlign: 'center' }}>
                {isFinalized 
                  ? 'Tes choix sont enregistrés'
                  : 'Choisis les gagnants pour chaque match'}
              </p>
              {isFinalized && (
                <div style={{
                  textAlign: 'left',
                  marginTop: '16px'
                }}>
                  <div style={{
                    marginBottom: '16px',
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: '8px',
                    fontSize: '13px',
                    color: '#374151'
                  }}>
                    {matchups
                      .filter(m => m.matchup_number <= 15)
                      .sort((a, b) => a.matchup_number - b.matchup_number)
                      .map(matchup => {
                        const pick = studentPicks.find(p => p.bracket_matchup_id === matchup.id);
                        const songLabel = pick ? getSongLabel(pick.picked_song_id) : '';
                        const isWinner = matchup.matchup_number === 15;
                        return (
                          <div
                            key={matchup.id}
                            style={{
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            {isWinner ? (
                              <span style={{ fontWeight: '600', color: '#6D28D9' }}>
                                ⭐ Le gagnant – {songLabel}
                              </span>
                            ) : (
                              <span>
                                {matchup.matchup_number} – {songLabel}
                              </span>
                            )}
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}
              {!isFinalized && (
                <button
                  style={{
                    backgroundColor: '#7C3AED',
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '12px 24px',
                    fontSize: '16px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    width: '100%'
                  }}
                >
                  Commencer
                </button>
              )}
              {isFinalized && (
                <p style={{
                  fontSize: '13px',
                  color: '#6B7280',
                  marginTop: '12px',
                  marginBottom: 0
                }}>
                  Clique pour voir ton tableau complet
                </p>
              )}
            </div>

            {/* Performance Snapshot Card */}
            <div
              role="button"
              tabIndex={0}
              className="perf-card"
              style={{
                flex: 1,
                minWidth: '300px',
                padding: '32px',
                borderRadius: '20px',
                boxShadow: perfPop ? '0 8px 24px rgba(0,0,0,0.1)' : '0 6px 20px rgba(0,0,0,0.06)',
                backgroundColor: '#FFFFFF',
                border: '1px solid #E5E7EB',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center',
                cursor: 'pointer',
                transform: perfBump ? 'translateY(-6px) scale(1.02)' : 'scale(1)',
                transition: 'all 200ms ease'
              }}
              onMouseEnter={(e) => {
                if (!perfBump) {
                  e.currentTarget.style.transform = 'scale(1.02)';
                  e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.1)';
                }
              }}
              onMouseLeave={(e) => {
                if (!perfBump) {
                  e.currentTarget.style.transform = 'scale(1)';
                  e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,0.06)';
                }
              }}
              onClick={handlePerformanceClick}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handlePerformanceClick();
                }
              }}
            >
              {perfPop && (
                <div key={perfBurstKey} className="perf-burst" aria-hidden="true">
                  <div className="perf-notes-layer">
                    {["♪","♫","♬","♪","♫","♬"].map((note, i) => {
                      const colors = ["#7C3AED","#10B981","#3B82F6","#EF4444","#8B5CF6","#22D3EE"];
                      const leftPositions = [18, 30, 42, 54, 66, 78];
                      return (
                        <span
                          key={i}
                          className="perf-note"
                          style={{
                            left: `${leftPositions[i]}%`,
                            '--noteColor': colors[i % colors.length],
                            '--driftX': `${(i % 3 - 1) * 8}px`,
                            animationDelay: `${i * 70}ms`
                          } as React.CSSProperties}
                        >
                          {note}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}
              <div className="perf-content">
                <h2 style={{ marginTop: 0, marginBottom: '24px', fontSize: '18px', color: '#111827' }}>
                  🎯 Ta performance
                </h2>
              <div style={{ marginBottom: '16px' }}>
                <div style={{ fontSize: '48px', fontWeight: 700, color: '#111827' }}>
                  {studentRank > 0 ? `#${isCounting ? displayRank : studentRank}` : '—'}
                </div>
                {studentRank > 0 && (
                  <div style={{
                    marginTop: '12px',
                    padding: '8px 12px',
                    backgroundColor: '#F5F3FF',
                    borderRadius: '8px',
                    display: 'inline-block'
                  }}>
                    <p style={{
                      margin: 0,
                      fontSize: '16px',
                      fontWeight: '700',
                      color: '#7C3AED',
                      letterSpacing: '0.5px'
                    }}>
                      {tierLabel}
                    </p>
                  </div>
                )}
                {performanceMessages.length > 0 && (
                  <>
                    <p style={{
                      marginTop: '12px',
                      marginBottom: '0px',
                      fontWeight: isStatementActive ? 700 : 500,
                      fontSize: '14px',
                      color: isStatementActive ? '#2563EB' : '#6B7280',
                      transform: isStatementActive ? 'scale(1.04)' : 'scale(1)',
                      transition: 'color 200ms ease, transform 200ms ease, font-weight 200ms ease',
                      minHeight: '20px'
                    }}>
                      {performanceMessages[messageIndex]}
                    </p>
                  </>
                )}
                {(() => {
                  // Compute total points from per-round scores
                  const computedTotalPoints = roundBreakdown.reduce((sum, { score }) => sum + score, 0);
                  return (
                    <>
                      <div style={{ fontSize: '20px', marginTop: '16px', color: '#111827' }}>
                        {computedTotalPoints} points
                      </div>
                      <div>
                        <p style={{ margin: '4px 0 8px 0', fontSize: '14px', color: '#6B7280' }}>Par tour</p>
                        {roundBreakdown.map(({ round, score }) => {
                          const roundLabel = round === 1 ? '1er tour' : round === 2 ? '2e tour' : round === 3 ? '3e tour' : 'Championnat';
                          return (
                            <div key={round} style={{ marginBottom: '8px' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                <span style={{ fontSize: '12px', color: '#374151' }}>{roundLabel}</span>
                                <span style={{ fontSize: '12px', fontWeight: '600', color: '#111827' }}>{score}</span>
                              </div>
                              <div style={{
                                height: '6px',
                                backgroundColor: '#E5E7EB',
                                borderRadius: '3px',
                                overflow: 'hidden'
                              }}>
                                <div style={{
                                  height: '100%',
                                  width: `${Math.min((score / Math.max(computedTotalPoints, 1)) * 100, 100)}%`,
                                  backgroundColor: '#7C3AED',
                                  transition: 'width 300ms ease'
                                }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  );
                })()}
              </div>
              </div>
            </div>
          </div>

          {/* Class Leaderboard + Accuracy Section */}
          <div style={{
            background: '#FFFFFF',
            borderRadius: '16px',
            padding: '32px',
            boxShadow: '0 10px 30px rgba(0,0,0,0.04)',
            marginTop: '32px'
          }}>
            <h2 style={{ marginBottom: '16px', fontSize: '20px', color: '#111827' }}>📊 Classement de la classe</h2>
            <div style={{
              border: '1px solid #E5E7EB',
              borderRadius: '12px',
              overflow: 'hidden',
              backgroundColor: '#FFFFFF'
            }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ backgroundColor: '#F9FAFB', borderBottom: '2px solid #E5E7EB' }}>
                    <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: '600', color: '#374151', fontSize: '14px' }}>Rang</th>
                    <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: '600', color: '#374151', fontSize: '14px' }}>Nom d'utilisateur</th>
                    <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: '600', color: '#374151', fontSize: '14px' }}>Points</th>
                  </tr>
                </thead>
                <tbody>
                  {leaderboard.map((score, index) => {
                    const isCurrentStudent = score.student_id === studentSession?.student_id;
                    const isTopThree = index < 3;
                    return (
                      <tr
                        key={score.student_id}
                        style={{
                          backgroundColor: isCurrentStudent 
                            ? '#F5F3FF' 
                            : isTopThree 
                              ? '#F9FAFB' 
                              : '#FFFFFF',
                          borderBottom: index < leaderboard.length - 1 ? '1px solid #E5E7EB' : 'none',
                          fontWeight: isCurrentStudent ? '600' : '400'
                        }}
                      >
                        <td style={{ padding: '12px 16px', textAlign: 'center', color: '#111827', fontSize: '14px' }}>{score.rank}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'center', color: '#111827', fontSize: '14px' }}>{score.student_name}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'center', color: '#111827', fontSize: '14px' }}>{score.total_score}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Class Accuracy by Round Section */}
            {classBrackets.length > 0 && allPicks.length > 0 && masterResults.length > 0 && (
              <div style={{ marginTop: '48px' }}>
                <h2 style={{ fontSize: '24px', marginBottom: '8px', color: '#111827', textAlign: 'center' }}>📊 Réussite de la classe</h2>
                <p style={{
                  fontSize: '14px',
                  opacity: 0.7,
                  marginBottom: '16px',
                  textAlign: 'center',
                  color: '#6B7280'
                }}>
                  Pourcentage d'élèves ayant deviné correctement à chaque tour
                </p>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                gap: '24px'
              }}>
                {Array.from(new Set(matchups.map(m => m.round)))
                  .sort((a, b) => a - b)
                  .map(round => {
                    const isWinner = round === 4;
                    return (
                      <div
                        key={round}
                        style={{
                          marginBottom: '24px',
                          gridColumn: isWinner ? '1 / -1' : 'auto'
                        }}
                      >
                        {isWinner ? (
                          <div style={{
                            border: '2px solid #FACC15',
                            borderRadius: '16px',
                            padding: '24px',
                            marginTop: '24px',
                            background: 'linear-gradient(to bottom, #FFFBEB, #FFFFFF)',
                            animation: 'championGlow 4s ease-in-out infinite'
                          }}>
                            <RoundAccuracyPie
                              round={round}
                              classStudentBrackets={classBrackets}
                              allStudentPicks={allPicks}
                              masterResults={masterResults}
                              allMatchups={matchups}
                            />
                          </div>
                        ) : (
                          <RoundAccuracyPie
                            round={round}
                            classStudentBrackets={classBrackets}
                            allStudentPicks={allPicks}
                            masterResults={masterResults}
                            allMatchups={matchups}
                          />
                        )}
                      </div>
                    );
                  })}
              </div>
            </div>
            )}
          </div>
        </>
      )}

      {viewMode === 'bracket' && (
        <>
          <button
            onClick={() => setViewMode('lobby')}
            style={{
              backgroundColor: '#F3F4F6',
              color: '#111827',
              border: '1px solid #D1D5DB',
              borderRadius: '8px',
              padding: '10px 16px',
              fontSize: '14px',
              fontWeight: '500',
              cursor: 'pointer',
              marginBottom: '24px'
            }}
          >
            ⬅ Retour
          </button>
          {isFinalized && <div style={{ marginBottom: '16px', padding: '12px', backgroundColor: '#FEF3C7', border: '1px solid #FCD34D', borderRadius: '8px', color: '#92400E' }}>This bracket has been finalized and cannot be edited.</div>}

          {Array.from(matchupsByRound.entries())
        .sort(([a], [b]) => a - b)
        .map(([round, roundMatchups]) => (
          <div key={round}>
            <h2>Round {round}</h2>
            {roundMatchups.map(matchup => {
              const validOptions = getValidOptionsForMatchup(matchup, matchups, studentPicks);
              const currentPick = studentPicks.find(p => p.bracket_matchup_id === matchup.id);
              const currentSongId = currentPick?.picked_song_id || '';
              const isDisabled = isFinalized || saving || validOptions.length === 0;

              const handleCardClick = (songId: UUID) => {
                if (!isDisabled) {
                  // Clear any existing timeout
                  if (popTimerRef.current !== null) {
                    clearTimeout(popTimerRef.current);
                  }
                  setRecentlySelected({
                    id: songId,
                    key: Date.now()
                  });
                  handlePickChange(matchup.id, songId);
                  // Clear after animation completes
                  popTimerRef.current = window.setTimeout(() => {
                    setRecentlySelected(null);
                    popTimerRef.current = null;
                  }, 900000);
                }
              };

              const handleKeyDown = (e: React.KeyboardEvent, songId: UUID) => {
                if (!isDisabled && (e.key === 'Enter' || e.key === ' ')) {
                  e.preventDefault();
                  // Clear any existing timeout
                  if (popTimerRef.current !== null) {
                    clearTimeout(popTimerRef.current);
                  }
                  setRecentlySelected({
                    id: songId,
                    key: Date.now()
                  });
                  handlePickChange(matchup.id, songId);
                  // Clear after animation completes
                  popTimerRef.current = window.setTimeout(() => {
                    setRecentlySelected(null);
                    popTimerRef.current = null;
                  }, 900000);
                }
              };

              return (
                <div key={matchup.id} style={{ marginBottom: '24px' }}>
                  <label style={{
                    display: 'block',
                    marginBottom: '12px',
                    fontSize: '14px',
                    fontWeight: '600',
                    color: '#374151'
                  }}>
                    Matchup {matchup.matchup_number}
                  </label>
                  <div style={{
                    display: 'flex',
                    gap: '16px',
                    maxWidth: '700px',
                    margin: '0 auto',
                    justifyContent: 'center',
                    alignItems: 'stretch'
                  }}>
                    {validOptions.map(songId => {
                      const isSelected = songId === currentSongId;
                      const isEliminated =
                        !!currentSongId && songId !== currentSongId;
                      const isRecentlySelected =
                        recentlySelected?.id === songId && !isDisabled && !isFinalized && !isEliminated;
                      return (
                        <button
                          key={songId}
                          type="button"
                          disabled={isDisabled}
                          onClick={() => handleCardClick(songId)}
                          onKeyDown={(e) => handleKeyDown(e, songId)}
                          aria-pressed={isSelected}
                          style={{
                            flex: 1,
                            minHeight: '56px',
                            padding: '16px',
                            borderRadius: '8px',
                            textAlign: 'center',
                            wordWrap: 'break-word',
                            whiteSpace: 'normal',
                            fontSize: '14px',
                            border: isEliminated 
                              ? '1px solid #E5E7EB'
                              : isSelected 
                                ? '2px solid #7C3AED' 
                                : '1px solid #D1D5DB',
                            backgroundColor: isEliminated 
                              ? '#F3F4F6'
                              : isSelected 
                                ? '#F5F3FF' 
                                : '#FFFFFF',
                            color: '#111827',
                            cursor: isEliminated || isDisabled ? 'default' : 'pointer',
                            opacity: isEliminated 
                              ? 0.7
                              : isDisabled 
                                ? 0.6 
                                : 1,
                            boxShadow: isEliminated
                              ? 'none'
                              : isSelected && !isDisabled
                                ? '0 0 0 2px #7C3AED, 0 0 20px rgba(124, 58, 237, 0.45)'
                                : isRecentlySelected 
                                  ? '0 0 0 4px rgba(124, 58, 237, 0.3)' 
                                  : 'none',
                            fontWeight: isEliminated 
                              ? '400'
                              : isSelected 
                                ? '600' 
                                : '400',
                            transform: isRecentlySelected ? 'scale(1.15)' : 'scale(1)',
                            transition: isRecentlySelected
                              ? 'transform 120ms cubic-bezier(.34,1.56,.64,1)'
                              : 'transform 150ms ease, box-shadow 200ms ease',
                            position: 'relative',
                            overflow: 'visible',
                            zIndex: isSelected || isRecentlySelected ? 10 : 1,
                            isolation: 'isolate',
                            animation:
                              isEliminated
                                ? undefined
                                : isRecentlySelected
                                  ? undefined
                                  : isSelected && !isDisabled
                                    ? 'winnerPulse 2.5s ease-in-out infinite'
                                    : undefined
                          }}
                          onMouseEnter={(e) => {
                            if (!isDisabled && !isSelected && !isEliminated) {
                              e.currentTarget.style.borderColor = '#7C3AED';
                              e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)';
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (!isSelected && !isEliminated) {
                              e.currentTarget.style.borderColor = '#D1D5DB';
                              e.currentTarget.style.boxShadow = 'none';
                            }
                          }}
                        >
                          {isRecentlySelected && (
                            <div className="arcade-burst">
                              {/* Edge sparkles – doubled, smaller */}
                              {[
                                { top: "0%", left: "10%", dx: "0px", dy: "-35px" },
                                { top: "0%", left: "30%", dx: "0px", dy: "-35px" },
                                { top: "0%", left: "70%", dx: "0px", dy: "-35px" },
                                { top: "0%", left: "90%", dx: "0px", dy: "-35px" },

                                { top: "100%", left: "20%", dx: "0px", dy: "35px" },
                                { top: "100%", left: "80%", dx: "0px", dy: "35px" },

                                { top: "50%", left: "0%", dx: "-35px", dy: "0px" },
                                { top: "50%", left: "100%", dx: "35px", dy: "0px" }
                              ].map((pos, index) => (
                                <span
                                  key={index}
                                  className="sparkle-shard"
                                  style={
                                    {
                                      top: pos.top,
                                      left: pos.left,
                                      "--dx": pos.dx,
                                      "--dy": pos.dy
                                    } as React.CSSProperties
                                  }
                                >
                                  ✨
                                </span>
                              ))}

                              {/* 4 floating music notes – FFS palette with stagger */}
                              {[
                                { left: "25%", color: "#2563EB", symbol: "♪", delay: "0ms" },
                                { left: "40%", color: "#10B981", symbol: "♫", delay: "60ms" },
                                { left: "60%", color: "#7C3AED", symbol: "♪", delay: "120ms" },
                                { left: "75%", color: "#EF4444", symbol: "♫", delay: "180ms" }
                              ].map((note, index) => (
                                <span
                                  key={index}
                                  className="music-note"
                                  style={{
                                    left: note.left,
                                    color: note.color,
                                    animationDelay: note.delay
                                  }}
                                >
                                  {note.symbol}
                                </span>
                              ))}
                            </div>
                          )}
                          {getSongLabel(songId)}
                          {isEliminated && (
                            <span
                              style={{
                                position: 'absolute',
                                top: '6px',
                                right: '8px',
                                fontSize: '10px',
                                backgroundColor: '#E5E7EB',
                                color: '#374151',
                                padding: '2px 6px',
                                borderRadius: '9999px'
                              }}
                            >
                              Elimininée
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        ))}

      {!isFinalized && !confirmingFinalize && (
        <div style={{ textAlign: 'center', marginTop: '24px' }}>
          <button
            onClick={() => setConfirmingFinalize(true)}
            disabled={finalizing || saving || studentPicks.length !== matchups.length}
            style={{
              backgroundColor: '#DC2626',
              color: '#FFFFFF',
              fontWeight: '700',
              padding: '14px 28px',
              borderRadius: '10px',
              border: 'none',
              fontSize: '16px',
              boxShadow: '0 6px 20px rgba(220, 38, 38, 0.35)',
              transition: 'transform 120ms ease, box-shadow 200ms ease',
              cursor: finalizing || saving || studentPicks.length !== matchups.length ? 'default' : 'pointer',
              opacity: finalizing || saving || studentPicks.length !== matchups.length ? 0.6 : 1,
              animation: 'finalizePulse 3s ease-in-out infinite'
            }}
            onMouseEnter={(e) => {
              if (!finalizing && !saving && studentPicks.length === matchups.length) {
                e.currentTarget.style.transform = 'scale(1.03)';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
            }}
          >
            Finalize Bracket
          </button>
        </div>
      )}

      {!isFinalized && confirmingFinalize && (
        <div style={{ textAlign: 'center', marginTop: '24px' }}>
          <div
            style={{
              marginTop: '16px',
              padding: '16px',
              border: '2px solid #DC2626',
              backgroundColor: '#FEF2F2',
              borderRadius: '10px',
              maxWidth: '500px',
              marginLeft: 'auto',
              marginRight: 'auto'
            }}
          >
            <p style={{ fontWeight: '700', color: '#DC2626', marginBottom: '16px' }}>
              Finalizing locks all selections. This cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button
                onClick={() => setConfirmingFinalize(false)}
                disabled={finalizing || saving || studentPicks.length !== matchups.length}
                style={{
                  backgroundColor: '#E5E7EB',
                  color: '#111827',
                  borderRadius: '8px',
                  padding: '10px 16px',
                  border: 'none',
                  cursor: finalizing || saving || studentPicks.length !== matchups.length ? 'default' : 'pointer',
                  opacity: finalizing || saving || studentPicks.length !== matchups.length ? 0.6 : 1
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleFinalize}
                disabled={finalizing || saving || studentPicks.length !== matchups.length}
                style={{
                  backgroundColor: '#DC2626',
                  color: '#FFFFFF',
                  borderRadius: '8px',
                  padding: '10px 16px',
                  border: 'none',
                  fontWeight: '700',
                  boxShadow: '0 4px 12px rgba(220, 38, 38, 0.4)',
                  cursor: finalizing || saving || studentPicks.length !== matchups.length ? 'default' : 'pointer',
                  opacity: finalizing || saving || studentPicks.length !== matchups.length ? 0.6 : 1
                }}
              >
                {finalizing ? 'Finalizing...' : 'Confirm Finalize'}
              </button>
            </div>
          </div>
        </div>
      )}

      {isFinalized && (
        <div
          style={{
            backgroundColor: '#ECFDF5',
            border: '2px solid #10B981',
            padding: '16px',
            borderRadius: '10px',
            maxWidth: '500px',
            margin: '24px auto 0',
            textAlign: 'center',
            color: '#065F46',
            fontWeight: '500'
          }}
        >
          Bracket finalized successfully. Your picks are locked.
        </div>
      )}
        </>
      )}
    </div>
  );
}
