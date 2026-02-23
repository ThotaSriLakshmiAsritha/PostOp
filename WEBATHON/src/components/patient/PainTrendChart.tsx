import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useTranslation } from 'react-i18next';

interface LogEntry {
  createdAt: any;
  pain_score: number;
}

interface PainTrendChartProps {
  logs: LogEntry[];
}

const PainTrendChart: React.FC<PainTrendChartProps> = ({ logs }) => {
  const { i18n } = useTranslation();
  const toMillis = (createdAt: any): number => {
    if (!createdAt) return 0;
    if (typeof createdAt.toDate === 'function') return createdAt.toDate().getTime();
    if (createdAt.seconds) return createdAt.seconds * 1000;
    const parsed = Date.parse(String(createdAt));
    return Number.isNaN(parsed) ? 0 : parsed;
  };

  const data = logs
    .map((log) => {
      const timestamp = toMillis(log.createdAt);
      return {
        timestamp,
        date: timestamp > 0
          ? new Intl.DateTimeFormat(i18n.language, { month: 'short', day: '2-digit' }).format(new Date(timestamp))
          : '',
        pain: log.pain_score,
      };
    })
    .filter((point) => point.timestamp > 0 && Number.isFinite(point.pain));

  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="date" />
        <YAxis domain={[0, 10]} />
        <Tooltip />
        <Line type="monotone" dataKey="pain" stroke="#8884d8" strokeWidth={2} />
      </LineChart>
    </ResponsiveContainer>
  );
};

export default PainTrendChart;
