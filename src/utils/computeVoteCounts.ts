import type {
  StudentBracket,
  StudentPick,
  UUID,
} from './bracketLogic';

export function computeVoteCounts(
  studentBrackets: StudentBracket[],
  studentPicks: StudentPick[]
): Map<UUID, Map<UUID, number>> {
  // Filter to finalized brackets only
  const finalizedBracketIds = new Set<UUID>(
    studentBrackets
      .filter(bracket => bracket.finalized === true)
      .map(bracket => bracket.id)
  );

  // Filter picks to finalized brackets only
  const finalizedPicks = studentPicks.filter(pick =>
    finalizedBracketIds.has(pick.student_bracket_id)
  );

  // Build vote counts per matchup
  const voteCounts = new Map<UUID, Map<UUID, number>>();

  finalizedPicks.forEach(pick => {
    if (!voteCounts.has(pick.bracket_matchup_id)) {
      voteCounts.set(pick.bracket_matchup_id, new Map());
    }
    const matchupVotes = voteCounts.get(pick.bracket_matchup_id)!;
    const currentCount = matchupVotes.get(pick.picked_song_id) || 0;
    matchupVotes.set(pick.picked_song_id, currentCount + 1);
  });

  return voteCounts;
}
