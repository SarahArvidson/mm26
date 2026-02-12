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

      <div>
        <label>
          Select Class:
          <select
            value={selectedClassId || ''}
            onChange={(e) => setSelectedClassId(e.target.value as UUID)}
          >
            <option value="">-- Select Class --</option>
            {classes.map((cls) => (
              <option key={cls.id} value={cls.id}>
                {cls.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {selectedClassId && activeSeason && leaderboard.length > 0 && (
        <>
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

          <div>
            <h2>Analytics</h2>
            
            {activeSeason && matchups.length > 0 && masterResults.length > 0 && (
              <div>
                <h3>All Classes Combined</h3>
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
            )}

            {Array.from(
              new Set(matchups.map(m => m.round))
            )
              .sort((a, b) => a - b)
              .map(round => {
                const roundMatchups = matchups.filter(m => m.round === round);
                return (
                  <div key={round}>
                    <RoundAccuracyPie
                      round={round}
                      classStudentBrackets={classBrackets}
                      allStudentPicks={allPicks}
                      masterResults={masterResults}
                      allMatchups={matchups}
                    />
                    {roundMatchups.map(matchup => (
                      <div key={matchup.id}>
                        <h4>Matchup {matchup.matchup_number}</h4>
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
        </>
      )}
    </div>
  );
}
