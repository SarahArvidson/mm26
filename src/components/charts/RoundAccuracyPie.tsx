import { PieChart, Pie, Cell, ResponsiveContainer, Legend } from 'recharts';
import type { StudentBracket, StudentPick, MasterResult, BracketMatchup } from '../../utils/bracketLogic';
import { computeRoundAccuracyAcrossBrackets } from '../../utils/analytics';

interface RoundAccuracyPieProps {
  round: number;
  classStudentBrackets: StudentBracket[];
  allStudentPicks: StudentPick[];
  masterResults: MasterResult[];
  allMatchups: BracketMatchup[];
}

const COLORS = ['#10B981', '#F97316'];

export default function RoundAccuracyPie({
  round,
  classStudentBrackets,
  allStudentPicks,
  masterResults,
  allMatchups,
}: RoundAccuracyPieProps) {
  const roundResults = computeRoundAccuracyAcrossBrackets(
    classStudentBrackets,
    allStudentPicks,
    masterResults,
    allMatchups
  );

  const thisRound = roundResults.find(r => r.round === round);

  const correctCount = thisRound?.correct ?? 0;
  const total = thisRound?.total ?? 0;
  const incorrectCount = total - correctCount;

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
    const roundLabel = round === 4 ? 'Championnat' : round === 1 ? '1er tour' : round === 2 ? '2e tour' : '3e tour';
    return <div>Aucune prédiction pour {roundLabel}</div>;
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

  const isChampionnat = round === 4;
  const roundLabel = isChampionnat ? '🏆 Championnat – Le gagnant de la Manie musicale 2026' : round === 1 ? '1er tour' : round === 2 ? '2e tour' : '3e tour';

  return (
    <div>
      {isChampionnat ? (
        <h3 style={{
          fontSize: '20px',
          fontWeight: 700,
          color: '#B45309',
          marginBottom: '16px'
        }}>
          {roundLabel}
        </h3>
      ) : (
        <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px' }}>
          {roundLabel}
        </h3>
      )}
      <ResponsiveContainer width="100%" height={isChampionnat ? 414 : 300}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={renderCustomizedLabel}
            outerRadius={isChampionnat ? 109 : 80}
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
