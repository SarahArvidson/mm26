import { PieChart, Pie, Cell, ResponsiveContainer, Legend } from 'recharts';
import type { StudentBracket, StudentPick, Song, UUID } from '../../utils/bracketLogic';

interface PredictionDistributionPieProps {
  matchupId: UUID;
  classStudentBrackets: StudentBracket[];
  allStudentPicks: StudentPick[];
  songs: Song[];
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

export default function PredictionDistributionPie({
  matchupId,
  classStudentBrackets,
  allStudentPicks,
  songs,
}: PredictionDistributionPieProps) {
  // Get bracket IDs for the class
  const bracketIds = new Set(classStudentBrackets.map(b => b.id));

  // Count picks per song for this matchup
  const pickCounts = new Map<UUID, number>();
  allStudentPicks.forEach(pick => {
    if (pick.bracket_matchup_id === matchupId && bracketIds.has(pick.student_bracket_id)) {
      const count = pickCounts.get(pick.picked_song_id) || 0;
      pickCounts.set(pick.picked_song_id, count + 1);
    }
  });

  // Calculate total picks
  const totalPicks = Array.from(pickCounts.values()).reduce((sum, count) => sum + count, 0);

  // Build data array with percentages
  const data = Array.from(pickCounts.entries()).map(([songId, count]) => {
    const song = songs.find(s => s.id === songId);
    const percentage = totalPicks > 0 ? Math.round((count / totalPicks) * 100) : 0;
    return {
      name: song ? `« ${song.title} » – ${song.artist}` : 'Unknown',
      value: count,
      percentage,
      label: song ? `« ${song.title} » – ${song.artist} (${percentage}%)` : `Unknown (${percentage}%)`,
    };
  });

  if (data.length === 0) {
    return <div>No predictions yet</div>;
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
