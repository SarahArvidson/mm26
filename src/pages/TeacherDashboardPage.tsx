import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import {
  resolveActiveSeason,
  type Season,
  type BracketMatchup,
  type StudentBracket,
  type StudentPick,
  type MasterResult,
  type Song,
  type UUID,
} from '../utils/bracketLogic';
import {
  computePerStudentScores,
  createLeaderboard,
  type StudentScore,
} from '../utils/scoring';
import RoundAccuracyPie from '../components/charts/RoundAccuracyPie';
import PredictionDistributionPie from '../components/charts/PredictionDistributionPie';
import EmbedGeneratorPanel from '../components/EmbedGeneratorPanel';
import { exportVotesToCSV, downloadCSV } from '../utils/exportVotesToCSV';

interface Class {
  id: UUID;
  name: string;
  teacher_id: UUID;
}

export default function TeacherDashboardPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeSeason, setActiveSeason] = useState<Season | null>(null);
  const [classes, setClasses] = useState<Class[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<UUID | null>(null);
  const [leaderboard, setLeaderboard] = useState<StudentScore[]>([]);
  const [matchups, setMatchups] = useState<BracketMatchup[]>([]);
  const [songs, setSongs] = useState<Song[]>([]);
  const [classBrackets, setClassBrackets] = useState<StudentBracket[]>([]);
  const [allPicks, setAllPicks] = useState<StudentPick[]>([]);
  const [masterResults, setMasterResults] = useState<MasterResult[]>([]);
  const [teacherBrackets, setTeacherBrackets] = useState<StudentBracket[]>([]);
  const [teacherPicks, setTeacherPicks] = useState<StudentPick[]>([]);

  useEffect(() => {
    if (!user) return;
    loadData();
  }, [user]);

  useEffect(() => {
    if (selectedClassId && activeSeason) {
      loadClassLeaderboard();
    }
  }, [selectedClassId, activeSeason]);

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

      // Fetch teacher's classes
      const { data: classesData, error: classesError } = await supabase
        .from('classes')
        .select('*')
        .eq('teacher_id', user.id);

      if (classesError) throw classesError;
      setClasses((classesData || []) as Class[]);

      if (classesData && classesData.length > 0) {
        setSelectedClassId(classesData[0].id);
      }

      // Fetch all students across all teacher classes
      const classIds = (classesData || []).map((c: Class) => c.id);
      if (classIds.length > 0) {
        const { data: allStudentsData, error: allStudentsError } = await supabase
          .from('students')
          .select('id')
          .in('class_id', classIds);

        if (allStudentsError) throw allStudentsError;
        const allStudentIds = (allStudentsData || []).map((s: any) => s.id);

        // Fetch all student brackets for those students for active season
        if (allStudentIds.length > 0) {
          const { data: teacherBracketsData, error: teacherBracketsError } = await supabase
            .from('student_brackets')
            .select('*')
            .eq('season_id', active.id)
            .in('student_id', allStudentIds);

          if (teacherBracketsError) throw teacherBracketsError;
          setTeacherBrackets((teacherBracketsData || []) as StudentBracket[]);

          // Fetch all student picks for those brackets
          const teacherBracketIds = (teacherBracketsData || []).map((b: any) => b.id);
          if (teacherBracketIds.length > 0) {
            const { data: teacherPicksData, error: teacherPicksError } = await supabase
              .from('student_picks')
              .select('*')
              .in('student_bracket_id', teacherBracketIds);

            if (teacherPicksError) throw teacherPicksError;
            setTeacherPicks((teacherPicksData || []) as StudentPick[]);
          }
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const loadClassLeaderboard = async () => {
    if (!selectedClassId || !activeSeason) return;

    try {
      setError(null);

      // Fetch master results
      const { data: masterResultsData, error: masterResultsError } = await supabase
        .from('master_results')
        .select('*')
        .eq('season_id', activeSeason.id);

      if (masterResultsError) throw masterResultsError;
      const masterResults = (masterResultsData || []) as MasterResult[];
      setMasterResults(masterResults);

      // Fetch bracket matchups
      const { data: matchupsData, error: matchupsError } = await supabase
        .from('bracket_matchups')
        .select('*')
        .eq('season_id', activeSeason.id);

      if (matchupsError) throw matchupsError;
      const matchupsDataTyped = (matchupsData || []) as BracketMatchup[];
      setMatchups(matchupsDataTyped);

      // Fetch songs for active season
      const { data: songsData, error: songsError } = await supabase
        .from('songs')
        .select('*')
        .eq('season_id', activeSeason.id);

      if (songsError) throw songsError;
      setSongs((songsData || []) as Song[]);

      // Fetch all students in the class
      const { data: classStudentsData, error: classStudentsError } = await supabase
        .from('students')
        .select('id, name')
        .eq('class_id', selectedClassId);

      if (classStudentsError) throw classStudentsError;
      const studentNames = new Map<UUID, string>();
      (classStudentsData || []).forEach((s: any) => {
        studentNames.set(s.id, s.name);
      });

      // Fetch all student brackets for the class
      const { data: classBracketsData, error: classBracketsError } = await supabase
        .from('student_brackets')
        .select('*')
        .eq('season_id', activeSeason.id)
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
        masterResults,
        matchupsDataTyped,
        studentNames
      );
      const sortedLeaderboard = createLeaderboard(scores);
      setLeaderboard(sortedLeaderboard);
    } catch (err: any) {
      setError(err.message || 'Failed to load leaderboard');
    }
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

  return (
    <div>
      <h1>Teacher Dashboard - {activeSeason.name}</h1>
      {error && <div>Error: {error}</div>}

      <div style={{
        marginBottom: '24px',
        padding: '20px',
        border: '1px solid #E5E7EB',
        borderRadius: '8px',
        backgroundColor: '#FFFFFF',
        maxWidth: '400px'
      }}>
        <label style={{
          display: 'block',
          fontWeight: '600',
          color: '#374151',
          marginBottom: '8px',
          fontSize: '14px'
        }}>
          Select Class
        </label>
        <select
          value={selectedClassId || ''}
          onChange={(e) => setSelectedClassId(e.target.value as UUID)}
          style={{
            width: '100%',
            padding: '10px',
            border: '1px solid #D1D5DB',
            borderRadius: '6px',
            backgroundColor: '#FFFFFF',
            color: '#111827',
            fontSize: '14px',
            cursor: 'pointer'
          }}
          onFocus={(e) => {
            e.target.style.borderColor = '#7C3AED';
            e.target.style.boxShadow = '0 0 0 3px rgba(124, 58, 237, 0.1)';
          }}
          onBlur={(e) => {
            e.target.style.borderColor = '#D1D5DB';
            e.target.style.boxShadow = 'none';
          }}
        >
          <option value="">-- Select Class --</option>
          {classes.map((cls) => (
            <option key={cls.id} value={cls.id}>
              {cls.name}
            </option>
          ))}
        </select>
      </div>

      {selectedClassId && activeSeason && (
        <>
          {/* Section 1: Class Leaderboard */}
          <div style={{
            marginBottom: '32px',
            padding: '20px',
            border: '1px solid #E5E7EB',
            borderRadius: '8px',
            backgroundColor: '#FFFFFF'
          }}>
            <div style={{
              maxWidth: '900px',
              margin: '0 auto',
              textAlign: 'center'
            }}>
              <h2 style={{
                color: '#7C3AED',
                marginTop: '0',
                marginBottom: '16px',
                fontSize: '24px',
                fontWeight: '600'
              }}>
                Class Leaderboard
              </h2>
              <button
                onClick={loadClassLeaderboard}
                style={{
                  marginBottom: '16px',
                  padding: '8px 16px',
                  backgroundColor: '#7C3AED',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500',
                  display: 'inline-block'
                }}
              >
                Refresh Leaderboard
              </button>
              {leaderboard.length > 0 ? (
                <div style={{ overflowX: 'auto', textAlign: 'left' }}>
                  <table style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    backgroundColor: '#FFFFFF',
                    margin: '0 auto'
                  }}>
                  <thead>
                    <tr style={{ backgroundColor: '#374151' }}>
                      <th style={{
                        padding: '12px',
                        textAlign: 'left',
                        color: '#FFFFFF',
                        fontWeight: '600',
                        fontSize: '14px'
                      }}>
                        Rank
                      </th>
                      <th style={{
                        padding: '12px',
                        textAlign: 'left',
                        color: '#FFFFFF',
                        fontWeight: '600',
                        fontSize: '14px'
                      }}>
                        Name
                      </th>
                      <th style={{
                        padding: '12px',
                        textAlign: 'left',
                        color: '#FFFFFF',
                        fontWeight: '600',
                        fontSize: '14px'
                      }}>
                        Total Score
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaderboard.map((score) => (
                      <tr key={score.student_id} style={{
                        borderBottom: '1px solid #E5E7EB'
                      }}>
                        <td style={{
                          padding: '12px',
                          color: '#111827',
                          fontSize: '14px'
                        }}>
                          {score.rank}
                        </td>
                        <td style={{
                          padding: '12px',
                          color: '#111827',
                          fontSize: '14px'
                        }}>
                          {score.student_name}
                        </td>
                        <td style={{
                          padding: '12px',
                          color: '#111827',
                          fontSize: '14px',
                          fontWeight: '600'
                        }}>
                          {score.total_score}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{
                padding: '16px',
                backgroundColor: '#F9FAFB',
                border: '1px solid #E5E7EB',
                borderRadius: '6px',
                color: '#6B7280',
                fontSize: '14px'
              }}>
                No students have finalized their brackets yet.
              </div>
            )}
            </div>
          </div>

          {/* Section 2: Analytics */}
          <div style={{
            marginBottom: '32px'
          }}>
            <h2 style={{
              color: '#7C3AED',
              marginTop: '0',
              marginBottom: '24px',
              fontSize: '24px',
              fontWeight: '600'
            }}>
              Analytics
            </h2>
            
            {masterResults.length === 0 ? (
              <div style={{
                padding: '20px',
                backgroundColor: '#F9FAFB',
                border: '2px solid #E5E7EB',
                borderRadius: '6px',
                color: '#374151',
                fontSize: '14px',
                lineHeight: '1.5'
              }}>
                No master results available yet. Master bracket winners must be set before analytics can be displayed.
              </div>
            ) : (
              <>
                {/* Card A: All Classes Combined */}
                {activeSeason && matchups.length > 0 && (
                  <div style={{
                    marginBottom: '24px',
                    padding: '20px',
                    border: '1px solid #E5E7EB',
                    borderRadius: '8px',
                    backgroundColor: '#FFFFFF'
                  }}>
                    <div style={{
                      maxWidth: '900px',
                      margin: '0 auto',
                      textAlign: 'center'
                    }}>
                      <h3 style={{
                        color: '#7C3AED',
                        marginTop: '0',
                        marginBottom: '20px',
                        fontSize: '18px',
                        fontWeight: '600'
                      }}>
                        All Classes Combined
                      </h3>
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                        gap: '20px'
                      }}>
                      {[1, 2, 3, 4].map(round => (
                        <RoundAccuracyPie
                          key={round}
                          round={round}
                          classStudentBrackets={teacherBrackets}
                          allStudentPicks={teacherPicks}
                          masterResults={masterResults}
                          allMatchups={matchups}
                        />
                      ))}
                    </div>
                    </div>
                  </div>
                )}

                {/* Card B: Selected Class */}
                {selectedClassId && (
                  <div style={{
                    padding: '20px',
                    border: '1px solid #E5E7EB',
                    borderRadius: '8px',
                    backgroundColor: '#FFFFFF'
                  }}>
                    <h3 style={{
                      color: '#7C3AED',
                      marginTop: '0',
                      marginBottom: '20px',
                      fontSize: '18px',
                      fontWeight: '600'
                    }}>
                      Class: {classes.find(c => c.id === selectedClassId)?.name || 'Selected Class'}
                    </h3>
                    
                    {/* Round Accuracy Charts */}
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                      gap: '20px',
                      marginBottom: '32px'
                    }}>
                      {Array.from(
                        new Set(matchups.map(m => m.round))
                      )
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

                      {/* Divider */}
                      <div style={{
                        borderTop: '1px solid #E5E7EB',
                        marginBottom: '24px'
                      }} />

                      {/* Prediction Distribution Subsection */}
                      <div>
                        <h4 style={{
                          color: '#374151',
                          marginTop: '0',
                          marginBottom: '20px',
                          fontSize: '16px',
                          fontWeight: '600'
                        }}>
                          Prediction Distribution by Matchup
                        </h4>
                      {Array.from(
                        new Set(matchups.map(m => m.round))
                      )
                        .sort((a, b) => a - b)
                        .map(round => {
                          const roundMatchups = matchups.filter(m => m.round === round);
                          return (
                            <div key={round} style={{ marginBottom: '24px' }}>
                              {roundMatchups.map(matchup => (
                                <div key={matchup.id} style={{ marginBottom: '20px' }}>
                                  <h5 style={{
                                    color: '#374151',
                                    marginBottom: '12px',
                                    fontSize: '14px',
                                    fontWeight: '600'
                                  }}>
                                    Matchup {matchup.matchup_number}
                                  </h5>
                                  <PredictionDistributionPie
                                    matchupId={matchup.id}
                                    classStudentBrackets={classBrackets}
                                    allStudentPicks={allPicks}
                                    songs={songs}
                                  />
                                </div>
                              ))}
                            </div>
                          );
                        })}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Section 3: Export Data */}
          <div style={{
            marginBottom: '32px',
            padding: '20px',
            border: '1px solid #E5E7EB',
            borderRadius: '8px',
            backgroundColor: '#FFFFFF'
          }}>
            <div style={{
              maxWidth: '900px',
              margin: '0 auto',
              textAlign: 'center'
            }}>
              <h3 style={{
                color: '#7C3AED',
                marginTop: '0',
                marginBottom: '16px',
                fontSize: '18px',
                fontWeight: '600'
              }}>
                Export Data
              </h3>
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
              <button
                onClick={() => {
                  if (activeSeason && selectedClassId) {
                    const csv = exportVotesToCSV(
                      classBrackets,
                      allPicks,
                      matchups,
                      songs,
                      classes.find(c => c.id === selectedClassId)?.name
                    );
                    downloadCSV(csv, `bracket-votes-${classes.find(c => c.id === selectedClassId)?.name || 'class'}-${activeSeason.name}.csv`);
                  }
                }}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#7C3AED',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500'
                }}
              >
                Export Class Votes (CSV)
              </button>
              <button
                onClick={() => {
                  if (activeSeason) {
                    const csv = exportVotesToCSV(
                      teacherBrackets,
                      teacherPicks,
                      matchups,
                      songs,
                      'All Classes'
                    );
                    downloadCSV(csv, `bracket-votes-all-classes-${activeSeason.name}.csv`);
                  }
                }}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#7C3AED',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500'
                }}
              >
                Export All Classes Votes (CSV)
              </button>
            </div>

            <div style={{
              height: '1px',
              backgroundColor: '#E5E7EB',
              margin: '20px 0'
            }} />

            <div>
              <h4 style={{
                marginBottom: '12px',
                color: '#374151',
                fontWeight: 600,
                fontSize: '16px'
              }}>
                Printable Resources
              </h4>
              <a
                href="/manie-musicale-2026-bracket.pdf"
                target="_blank"
                rel="noopener noreferrer"
                style={{ textDecoration: 'none' }}
              >
                <button
                  style={{
                    backgroundColor: '#FFFFFF',
                    color: '#7C3AED',
                    border: '1px solid #7C3AED',
                    borderRadius: '6px',
                    padding: '10px 16px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '500'
                  }}
                >
                  Open Blank Bracket (PDF)
                </button>
              </a>
              </div>
            </div>
          </div>

          {/* Section 4: Embed Generator */}
          {activeSeason && (
            <div style={{
              padding: '20px',
              border: '1px solid #E5E7EB',
              borderRadius: '8px',
              backgroundColor: '#F9FAFB'
            }}>
              <h3 style={{
                color: '#6B7280',
                marginTop: '0',
                marginBottom: '12px',
                fontSize: '16px',
                fontWeight: '500'
              }}>
                Embed Generator (Optional)
              </h3>
              <EmbedGeneratorPanel seasonId={activeSeason.id} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
