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
  const { user } = useAuth();
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
  const popTimerRef = useRef<number | null>(null);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (popTimerRef.current !== null) {
        clearTimeout(popTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!user) return;
    
    // Check if user is a teacher and redirect
    const checkRole = async () => {
      const { data: teacherData } = await supabase
        .from('teachers')
        .select('id')
        .eq('id', user.id)
        .maybeSingle();
      
      if (teacherData) {
        navigate('/teacher-dashboard');
        return;
      }
      
      loadData();
    };
    
    checkRole();
  }, [user, navigate]);

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

      // Fetch or create student bracket
      const { data: bracketData, error: bracketError } = await supabase
        .from('student_brackets')
        .select('*')
        .eq('student_id', user.id)
        .eq('season_id', active.id)
        .maybeSingle();

      if (bracketError) throw bracketError;

      let bracket: StudentBracket;
      if (bracketData) {
        bracket = bracketData as StudentBracket;
        setStudentBracket(bracket);
      } else {
        // Create new student bracket
        const { data: newBracketData, error: createError } = await supabase
          .from('student_brackets')
          .insert({
            student_id: user.id,
            season_id: active.id,
            finalized: false,
            points: 0,
          })
          .select()
          .single();

        if (createError) throw createError;
        bracket = newBracketData as StudentBracket;
        setStudentBracket(bracket);
      }

      // Fetch student picks
      const { data: picksData, error: picksError } = await supabase
        .from('student_picks')
        .select('*')
        .eq('student_bracket_id', bracket.id);

      if (picksError) throw picksError;
      setStudentPicks((picksData || []) as StudentPick[]);

      // Fetch student's class_id
      const { data: studentData, error: studentError } = await supabase
        .from('students')
        .select('class_id')
        .eq('id', user.id)
        .single();

      if (studentError) throw studentError;
      if (!studentData) throw new Error('Student not found');

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
        .select('id, name')
        .eq('class_id', studentData.class_id);

      if (classStudentsError) throw classStudentsError;
      const studentNames = new Map<UUID, string>();
      (classStudentsData || []).forEach((s: any) => {
        studentNames.set(s.id, s.name);
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
      const rank = getStudentRank(user.id, sortedLeaderboard);
      setStudentRank(rank);

      const breakdown = computePerRoundBreakdown(
        studentPicks,
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

  return (
    <div>
      <h1>Student Bracket - {activeSeason.name}</h1>
      {error && <div>Error: {error}</div>}
      {isFinalized && <div>This bracket has been finalized and cannot be edited.</div>}

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
                              Eliminated
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

      <div>
        <h2>Your Ranking</h2>
        <p>Rank: {studentRank > 0 ? `#${studentRank}` : 'Not ranked'}</p>
       <p>Total Score: {studentBracket?.points ?? 0}</p>
        
        <h3>Per-Round Breakdown</h3>
        <table>
          <thead>
            <tr>
              <th>Round</th>
              <th>Score</th>
            </tr>
          </thead>
          <tbody>
            {roundBreakdown.map(({ round, score }) => (
              <tr key={round}>
                <td>Round {round}</td>
                <td>{score}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div>
        <h2>Class Leaderboard</h2>
        <table>
          <thead>
            <tr>
              <th>Rank</th>
              <th>Name</th>
              <th>Total Score</th>
            </tr>
          </thead>
          <tbody>
            {leaderboard.map((score) => (
              <tr key={score.student_id}>
                <td>{score.rank}</td>
                <td>{score.student_name}</td>
                <td>{score.total_score}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {classBrackets.length > 0 && allPicks.length > 0 && masterResults.length > 0 && (
        <div>
          <h2>Class Accuracy by Round</h2>
          {Array.from(new Set(matchups.map(m => m.round)))
            .sort((a, b) => a - b)
            .map(round => (
              <RoundAccuracyPie
                key={round}
                round={round}
                classStudentBrackets={classBrackets}
                allStudentPicks={allPicks}
                masterResults={masterResults}
                allMatchups={matchups}
              />
            ))}
        </div>
      )}
    </div>
  );
}
