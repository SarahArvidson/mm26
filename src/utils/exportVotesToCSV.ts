import type {
  StudentBracket,
  StudentPick,
  BracketMatchup,
  Song,
  UUID,
} from './bracketLogic';
import { computeVoteCounts } from './computeVoteCounts';

export function exportVotesToCSV(
  studentBrackets: StudentBracket[],
  allStudentPicks: StudentPick[],
  matchups: BracketMatchup[],
  songs: Song[],
  className?: string
): string {
  // Get vote counts using centralized utility
  const voteCounts = computeVoteCounts(studentBrackets, allStudentPicks);

  // Build CSV rows
  const rows: string[] = [];
  rows.push('Matchup,Song A,Song A Votes,Song B,Song B Votes');

  // Sort matchups by round and matchup_number
  const sortedMatchups = [...matchups].sort((a, b) => {
    if (a.round !== b.round) return a.round - b.round;
    return a.matchup_number - b.matchup_number;
  });

  sortedMatchups.forEach(matchup => {
    const matchupVotes = voteCounts.get(matchup.id) || new Map();
    
    const song1 = songs.find(s => s.id === matchup.song1_id);
    const song2 = songs.find(s => s.id === matchup.song2_id);

    if (!song1 || !song2) return;

    const song1Label = `« ${song1.title} » – ${song1.artist}`;
    const song2Label = `« ${song2.title} » – ${song2.artist}`;

    const song1Votes = matchupVotes.get(matchup.song1_id) || 0;
    const song2Votes = matchupVotes.get(matchup.song2_id) || 0;

    const matchupLabel = `Round ${matchup.round}, Matchup ${matchup.matchup_number}`;
    rows.push(
      `"${matchupLabel}","${song1Label}",${song1Votes},"${song2Label}",${song2Votes}`
    );
  });

  return rows.join('\n');
}

export function downloadCSV(csvContent: string, filename: string): void {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
