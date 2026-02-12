// Type definitions
export type UUID = string;

export interface Season {
  id: UUID;
  name: string;
  archived: boolean;
  is_active: boolean;
  created_at: string;
}

export interface BracketMatchup {
  id: UUID;
  season_id: UUID;
  round: number;
  matchup_number: number;
  song1_id: UUID | null;
  song2_id: UUID | null;
  winner_song_id: UUID | null;
  created_at: string;
}

export interface StudentPick {
  id: UUID;
  student_bracket_id: UUID;
  bracket_matchup_id: UUID;
  picked_song_id: UUID;
  created_at: string;
}

export interface Song {
  id: UUID;
  season_id: UUID;
  title: string;
  artist: string;
  youtube_url: string | null;
  created_at: string;
}

export interface MasterResult {
  id: UUID;
  season_id: UUID;
  bracket_matchup_id: UUID;
  winner_song_id: UUID;
  updated_at: string;
}

export interface StudentBracket {
  id: UUID;
  student_id: UUID;
  season_id: UUID;
  finalized: boolean;
  points: number;
  created_at: string;
}

/**
 * Resolves the active season from a list of seasons.
 * Returns the season where is_active = true, or null if none exists.
 */
export function resolveActiveSeason(seasons: Season[]): Season | null {
  return seasons.find(season => season.is_active) || null;
}

/**
 * Gets valid song options for a matchup based on bracket structure and student picks.
 * For round 1: returns song1_id and song2_id from the immutable matchup structure.
 * For later rounds: returns the student's picks from previous round matchups that feed into this matchup.
 * Fully derived - no mutation, no state propagation, no side effects.
 */
export function getValidOptionsForMatchup(
  matchup: BracketMatchup,
  allMatchups: BracketMatchup[],
  studentPicks: StudentPick[]
): UUID[] {
  // Round 1: valid options are the two songs in the immutable matchup structure
  if (matchup.round === 1) {
    const options: UUID[] = [];
    if (matchup.song1_id) options.push(matchup.song1_id);
    if (matchup.song2_id) options.push(matchup.song2_id);
    return options;
  }

  // Explicit feed structure based on printed bracket layout
  const feedMap: Record<number, number[]> = {
    9: [1, 3],
    10: [2, 4],
    11: [5, 7],
    12: [6, 8],
    13: [9, 11],
    14: [10, 12],
    15: [13, 14],
  };

  const feedingMatchups = feedMap[matchup.matchup_number] || [];
  const validOptions: UUID[] = [];

  feedingMatchups.forEach(prevMatchupNumber => {
    const prevMatchup = allMatchups.find(
      m => m.matchup_number === prevMatchupNumber
    );

    if (prevMatchup) {
      const pick = studentPicks.find(
        p => p.bracket_matchup_id === prevMatchup.id
      );

      if (pick) {
        validOptions.push(pick.picked_song_id);
      }
    }
  });

  return validOptions;
}

/**
 * Gets valid song options for a master bracket matchup based on master results.
 * For round 1: returns song1_id and song2_id from the immutable matchup structure.
 * For later rounds: returns the master_results winner_song_id from previous round matchups that feed into this matchup.
 * Fully derived - no mutation, no state propagation, no side effects.
 */
export function getValidMasterOptionsForMatchup(
  matchup: BracketMatchup,
  allMatchups: BracketMatchup[],
  masterResults: MasterResult[]
): UUID[] {
  // Round 1: valid options are the two songs in the immutable matchup structure
  if (matchup.round === 1) {
    const options: UUID[] = [];
    if (matchup.song1_id) options.push(matchup.song1_id);
    if (matchup.song2_id) options.push(matchup.song2_id);
    return options;
  }

  // Explicit feed structure based on printed bracket layout
  const feedMap: Record<number, number[]> = {
    9: [1, 3],
    10: [2, 4],
    11: [5, 7],
    12: [6, 8],
    13: [9, 11],
    14: [10, 12],
    15: [13, 14],
  };

  const feedingMatchups = feedMap[matchup.matchup_number] || [];
  const validOptions: UUID[] = [];

  // Create a map of bracket_matchup_id -> winner_song_id for quick lookup
  const masterResultsMap = new Map<UUID, UUID>();
  masterResults.forEach(result => {
    masterResultsMap.set(result.bracket_matchup_id, result.winner_song_id);
  });

  feedingMatchups.forEach(prevMatchupNumber => {
    const prevMatchup = allMatchups.find(
      m => m.matchup_number === prevMatchupNumber
    );

    if (prevMatchup) {
      const masterResult = masterResultsMap.get(prevMatchup.id);
      if (masterResult) {
        validOptions.push(masterResult);
      }
    }
  });

  return validOptions.filter((id, index, self) => self.indexOf(id) === index); // Remove duplicates
}

/**
 * Computes the score for a student bracket by comparing picks with master results.
 * Awards points based on correct picks, with higher points for later rounds.
 */
export function computeStudentBracketScore(
  studentPicks: StudentPick[],
  masterResults: MasterResult[],
  allMatchups: BracketMatchup[]
): number {
  let score = 0;

  // Create a map of matchup_id -> master winner for quick lookup
  const masterResultsMap = new Map<UUID, UUID>();
  masterResults.forEach(result => {
    masterResultsMap.set(result.bracket_matchup_id, result.winner_song_id);
  });

  // Create a map of matchup_id -> round for point calculation
  const matchupRoundMap = new Map<UUID, number>();
  allMatchups.forEach(matchup => {
    matchupRoundMap.set(matchup.id, matchup.round);
  });

  // Score each pick with fixed weights
  const roundWeights: Record<number, number> = {
    1: 1,
    2: 3,
    3: 5,
    4: 8,
  };

  studentPicks.forEach(pick => {
    const masterWinner = masterResultsMap.get(pick.bracket_matchup_id);
    if (masterWinner && pick.picked_song_id === masterWinner) {
      const round = matchupRoundMap.get(pick.bracket_matchup_id) || 1;
      const weight = roundWeights[round] || 0;
      score += weight;
    }
  });

  return score;
}
