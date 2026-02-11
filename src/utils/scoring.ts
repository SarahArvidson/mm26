import {
  type UUID,
  type StudentPick,
  type MasterResult,
  type BracketMatchup,
  type StudentBracket,
  computeStudentBracketScore,
} from './bracketLogic';

export interface StudentScore {
  student_id: UUID;
  student_name: string;
  total_score: number;
  round_scores: Record<number, number>;
  rank: number;
}

export interface RoundBreakdown {
  round: number;
  score: number;
}

/**
 * Computes per-student total score for a given class and season
 */
export function computePerStudentScores(
  studentBrackets: StudentBracket[],
  allStudentPicks: StudentPick[],
  masterResults: MasterResult[],
  allMatchups: BracketMatchup[],
  studentNames: Map<UUID, string>
): StudentScore[] {
  const scores: StudentScore[] = [];

  studentBrackets.forEach(bracket => {
    const picks = allStudentPicks.filter(p => p.student_bracket_id === bracket.id);
    const totalScore = computeStudentBracketScore(picks, masterResults, allMatchups);
    
    // Calculate per-round breakdown
    const roundScores: Record<number, number> = {};
    const roundWeights: Record<number, number> = { 1: 1, 2: 3, 3: 5, 4: 8 };
    
    const masterResultsMap = new Map<UUID, UUID>();
    masterResults.forEach(result => {
      masterResultsMap.set(result.bracket_matchup_id, result.winner_song_id);
    });

    const matchupRoundMap = new Map<UUID, number>();
    allMatchups.forEach(matchup => {
      matchupRoundMap.set(matchup.id, matchup.round);
    });

    picks.forEach(pick => {
      const masterWinner = masterResultsMap.get(pick.bracket_matchup_id);
      if (masterWinner && pick.picked_song_id === masterWinner) {
        const round = matchupRoundMap.get(pick.bracket_matchup_id) || 1;
        const weight = roundWeights[round] || 0;
        roundScores[round] = (roundScores[round] || 0) + weight;
      }
    });

    scores.push({
      student_id: bracket.student_id,
      student_name: studentNames.get(bracket.student_id) || 'Unknown',
      total_score: totalScore,
      round_scores: roundScores,
      rank: 0, // Will be set after sorting
    });
  });

  return scores;
}

/**
 * Computes per-round breakdown for a student
 */
export function computePerRoundBreakdown(
  studentPicks: StudentPick[],
  masterResults: MasterResult[],
  allMatchups: BracketMatchup[]
): RoundBreakdown[] {
  const roundScores: Record<number, number> = {};
  const roundWeights: Record<number, number> = { 1: 1, 2: 3, 3: 5, 4: 8 };

  const masterResultsMap = new Map<UUID, UUID>();
  masterResults.forEach(result => {
    masterResultsMap.set(result.bracket_matchup_id, result.winner_song_id);
  });

  const matchupRoundMap = new Map<UUID, number>();
  allMatchups.forEach(matchup => {
    matchupRoundMap.set(matchup.id, matchup.round);
  });

  studentPicks.forEach(pick => {
    const masterWinner = masterResultsMap.get(pick.bracket_matchup_id);
    if (masterWinner && pick.picked_song_id === masterWinner) {
      const round = matchupRoundMap.get(pick.bracket_matchup_id) || 1;
      const weight = roundWeights[round] || 0;
      roundScores[round] = (roundScores[round] || 0) + weight;
    }
  });

  return Object.entries(roundScores)
    .map(([round, score]) => ({ round: parseInt(round), score }))
    .sort((a, b) => a.round - b.round);
}

/**
 * Creates a sorted leaderboard from student scores
 */
export function createLeaderboard(scores: StudentScore[]): StudentScore[] {
  const sorted = [...scores].sort((a, b) => {
    if (b.total_score !== a.total_score) {
      return b.total_score - a.total_score;
    }
    return a.student_name.localeCompare(b.student_name);
  });

  sorted.forEach((score, index) => {
    score.rank = index + 1;
  });

  return sorted;
}

/**
 * Gets rank position for a specific student
 */
export function getStudentRank(
  studentId: UUID,
  leaderboard: StudentScore[]
): number {
  const student = leaderboard.find(s => s.student_id === studentId);
  return student?.rank || 0;
}
