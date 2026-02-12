import type {
  StudentBracket,
  StudentPick,
  MasterResult,
  BracketMatchup,
  UUID,
} from './bracketLogic';

export interface RoundAccuracy {
  round: number;
  correct: number;
  total: number;
  accuracy: number;
}

export function computeRoundAccuracyAcrossBrackets(
  studentBrackets: StudentBracket[],
  allStudentPicks: StudentPick[],
  masterResults: MasterResult[],
  allMatchups: BracketMatchup[]
): RoundAccuracy[] {
  // 1. Filter finalized brackets
  const finalizedBracketIds = new Set<UUID>(
    studentBrackets
      .filter(bracket => bracket.finalized === true)
      .map(bracket => bracket.id)
  );

  // 2. Build master results map
  const masterResultsMap = new Map<UUID, UUID>();
  masterResults.forEach(result => {
    masterResultsMap.set(result.bracket_matchup_id, result.winner_song_id);
  });

  // 3. Build matchup → round map
  const matchupRoundMap = new Map<UUID, number>();
  allMatchups.forEach(matchup => {
    matchupRoundMap.set(matchup.id, matchup.round);
  });

  // 4. Initialize fixed 4-round structure
  const roundStats: Record<number, { correct: number; total: number }> = {
    1: { correct: 0, total: 0 },
    2: { correct: 0, total: 0 },
    3: { correct: 0, total: 0 },
    4: { correct: 0, total: 0 },
  };

  // 5. Aggregate
  allStudentPicks.forEach(pick => {
    if (!finalizedBracketIds.has(pick.student_bracket_id)) {
      return;
    }

    const round = matchupRoundMap.get(pick.bracket_matchup_id);
    if (!round || round < 1 || round > 4) {
      return;
    }

    roundStats[round].total += 1;

    const masterWinner = masterResultsMap.get(pick.bracket_matchup_id);
    if (masterWinner && pick.picked_song_id === masterWinner) {
      roundStats[round].correct += 1;
    }
  });

  // 6. Convert to output array
  return [1, 2, 3, 4].map(round => {
    const { correct, total } = roundStats[round];
    return {
      round,
      correct,
      total,
      accuracy: total > 0 ? correct / total : 0,
    };
  });
}
