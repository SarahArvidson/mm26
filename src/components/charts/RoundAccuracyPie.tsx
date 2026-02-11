import { PieChart, Pie, Cell, ResponsiveContainer, Legend } from 'recharts';
import type { StudentBracket, StudentPick, MasterResult, BracketMatchup, UUID } from '../../utils/bracketLogic';

interface RoundAccuracyPieProps {
  round: number;
  classStudentBrackets: StudentBracket[];
  allStudentPicks: StudentPick[];
  masterResults: MasterResult[];
  allMatchups: BracketMatchup[];
}

const COLORS = ['#00C49F', '#FF8042'];

export default function RoundAccuracyPie({
  round,
  classStudentBrackets,
  allStudentPicks,
  masterResults,
  allMatchups,
}: RoundAccuracyPieProps) {
  // Get bracket IDs for the class
  const bracketIds = new Set(classStudentBrackets.map(b => b.id));

  // Get matchups for this round
  const roundMatchups = allMatchups.filter(m => m.round === round);
  const roundMatchupIds = new Set(roundMatchups.map(m => m.id));

  // Create master results map
  const masterResultsMap = new Map<UUID, UUID>();
  masterResults.forEach(result => {
    if (roundMatchupIds.has(result.bracket_matchup_id)) {
      masterResultsMap.set(result.bracket_matchup_id, result.winner_song_id);
    }
  });

  // Count correct and incorrect picks
  let correctCount = 0;
  let incorrectCount = 0;

  allStudentPicks.forEach(pick => {
    if (
      bracketIds.has(pick.student_bracket_id) &&
      roundMatchupIds.has(pick.bracket_matchup_id)
    ) {
      const masterWinner = masterResultsMap.get(pick.bracket_matchup_id);
      if (masterWinner) {
        if (pick.picked_song_id === masterWinner) {
          correctCount++;
        } else {
          incorrectCount++;
        }
      }
    }
  });

  const total = correctCount + incorrectCount;
  const correctPercentage = total > 0 ? Math.round((correctCount / total) * 100) : 0;
  const incorrectPercentage = total > 0 ? Math.round((incorrectCount / total) * 100) : 0;

  const data = [
    {
      name: 'Correct',
      value: correctCount,
      percentage: correctPercentage,
    },
    {
      name: 'Incorrect',
      value: incorrectCount,
      percentage: incorrectPercentage,
    },
  ];

  if (total === 0) {
    return <div>No predictions yet for Round {round}</div>;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const renderCustomizedLabel = (props: any) => {
    const { cx, cy, midAngle, innerRadius, outerRadius, percent } = props;
    const percentage = percent !== undefined ? percent * 100 : 0;
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    return (
      <text
        x={x}
        y={y}
        fill="white"
        textAnchor={x > cx ? 'start' : 'end'}
        dominantBaseline="central"
        fontSize={12}
      >
        {`${Math.round(percentage)}%`}
      </text>
    );
  };

  return (
    <div>
      <h3>Round {round} Accuracy</h3>
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={renderCustomizedLabel}
            outerRadius={80}
            fill="#8884d8"
            dataKey="value"
          >
            {data.map((_, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
