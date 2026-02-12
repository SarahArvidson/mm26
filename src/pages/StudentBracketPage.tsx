import { useEffect, useState } from 'react';
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

  useEffect(() => {
    if (!user) return;
    loadData();
  }, [user]);

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
      setMatchups((matchupsData || []) as BracketMatchup[]);

      // Fetch songs for active season
      const { data: songsData, error: songsError } = await supabase
        .from('songs')
        .select('*')
        .eq('season_id', active.id);

      if (songsError) throw songsError;
      setSongs((songsData || []) as Song[]);

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
        matchups,
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
        matchups
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

              return (
                <div key={matchup.id}>
                  <label>
                    Matchup {matchup.matchup_number}:
                    <select
                      value={currentSongId}
                      onChange={(e) => handlePickChange(matchup.id, e.target.value)}
                      disabled={isFinalized || saving || validOptions.length === 0}
                    >
                      <option value="">-- Select --</option>
                      {validOptions.map(songId => (
                        <option key={songId} value={songId}>
                          {getSongLabel(songId)}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              );
            })}
          </div>
        ))}

      {!isFinalized && (
        <button
          onClick={handleFinalize}
          disabled={finalizing || saving || studentPicks.length !== matchups.length}
        >
          {finalizing ? 'Finalizing...' : 'Finalize Bracket'}
        </button>
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
