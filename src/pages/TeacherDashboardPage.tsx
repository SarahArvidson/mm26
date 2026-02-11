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
  type UUID,
} from '../utils/bracketLogic';
import {
  computePerStudentScores,
  createLeaderboard,
  type StudentScore,
} from '../utils/scoring';

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

      // Fetch bracket matchups
      const { data: matchupsData, error: matchupsError } = await supabase
        .from('bracket_matchups')
        .select('*')
        .eq('season_id', activeSeason.id);

      if (matchupsError) throw matchupsError;
      const matchups = (matchupsData || []) as BracketMatchup[];

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
      const classBrackets = (classBracketsData || []) as StudentBracket[];

      // Fetch all student picks for these brackets
      const bracketIds = classBrackets.map(b => b.id);
      const { data: allPicksData, error: allPicksError } = await supabase
        .from('student_picks')
        .select('*')
        .in('student_bracket_id', bracketIds);

      if (allPicksError) throw allPicksError;
      const allPicks = (allPicksData || []) as StudentPick[];

      // Compute scores and leaderboard
      const scores = computePerStudentScores(
        classBrackets,
        allPicks,
        masterResults,
        matchups,
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

      {selectedClassId && (
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
      )}
    </div>
  );
}
