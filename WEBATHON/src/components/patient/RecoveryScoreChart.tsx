import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useTranslation } from 'react-i18next';

interface LogEntry {
  createdAt: any;
  pain_score: number;
  temperature: number;
}

interface RecoveryScoreChartProps {
  logs: LogEntry[];
}

const RecoveryScoreChart: React.FC<RecoveryScoreChartProps> = ({ logs }) => {
  const { i18n } = useTranslation();
  const toMillis = (createdAt: any): number => {
    if (!createdAt) return 0;
    if (typeof createdAt.toDate === 'function') return createdAt.toDate().getTime();
    if (createdAt.seconds) return createdAt.seconds * 1000;
    const parsed = Date.parse(String(createdAt));
    return Number.isNaN(parsed) ? 0 : parsed;
  };

  const calculateRecoveryScore = (log: LogEntry): number => {
    let score = 100;
    score -= log.pain_score * 5; // Pain reduces score
    if (log.temperature > 37) {
      score -= (log.temperature - 37) * 10; // Fever reduces score
    }
    return Math.max(0, Math.min(100, Math.round(score)));
  };

  const data = logs
    .map((log) => {
      const timestamp = toMillis(log.createdAt);
      return {
        timestamp,
        date: timestamp > 0
          ? new Intl.DateTimeFormat(i18n.language, { month: 'short', day: '2-digit' }).format(new Date(timestamp))
          : '',
        score: calculateRecoveryScore(log),
      };
    })
    .filter((point) => point.timestamp > 0);

  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="date" />
        <YAxis domain={[0, 100]} />
        <Tooltip />
        <Line type="monotone" dataKey="score" stroke="#4caf50" strokeWidth={2} />
      </LineChart>
    </ResponsiveContainer>
  );
};

export default RecoveryScoreChart;
