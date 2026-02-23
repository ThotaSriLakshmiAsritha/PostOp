import { useEffect, useState } from 'react';
import {
  Container,
  Paper,
  Typography,
  Grid,
} from '@mui/material';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { useTranslation } from 'react-i18next';
import { db } from '../../config/firebase';
import { useAuth } from '../../contexts/AuthContext';
import PainTrendChart from './PainTrendChart';
import TemperatureTrendChart from './TemperatureTrendChart';
import RecoveryScoreChart from './RecoveryScoreChart';

interface LogEntry {
  id: string;
  pain_score: number;
  temperature: number;
  risk: 'GREEN' | 'YELLOW' | 'RED';
  createdAt: any;
  createdAtClient?: number;
}

const TrendsDashboard = () => {
  const { user } = useAuth();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const { t } = useTranslation();

  useEffect(() => {
    if (!user) return;

    const fetchLogs = async () => {
      try {
        const logsRef = collection(db, 'symptom_logs');
        const q = query(
          logsRef,
          where('patientId', '==', user.uid),
          limit(500)
        );
        const snapshot = await getDocs(q);
        const logsData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        } as LogEntry));

        // Sort client-side to avoid requiring a Firestore composite index.
        logsData.sort((a, b) => {
          const ta =
            a.createdAt && typeof a.createdAt.toDate === 'function'
              ? a.createdAt.toDate().getTime()
              : (a.createdAt?.seconds ? a.createdAt.seconds * 1000 : (a.createdAtClient ?? 0));
          const tb =
            b.createdAt && typeof b.createdAt.toDate === 'function'
              ? b.createdAt.toDate().getTime()
              : (b.createdAt?.seconds ? b.createdAt.seconds * 1000 : (b.createdAtClient ?? 0));
          return ta - tb;
        });

        setLogs(logsData);
      } catch (error) {
        console.error('Error fetching logs:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchLogs();
  }, [user]);

  if (loading) {
    return <Typography>{t('loadingTrends', 'Loading trends...')}</Typography>;
  }

  if (logs.length === 0) {
    return (
      <Container maxWidth="lg">
        <Typography variant="h4" gutterBottom>
          {t('recoveryTrends', 'Recovery Trends')}
        </Typography>
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography color="text.secondary">
            {t('noSymptomLogs', 'No symptom logs yet. Start logging your symptoms to see trends.')}
          </Typography>
        </Paper>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg">
      <Typography variant="h4" gutterBottom>
        {t('recoveryTrends', 'Recovery Trends')}
      </Typography>
      <Grid container spacing={3}>
        <Grid item xs={12}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              {t('painScoreTrend', 'Pain Score Trend')}
            </Typography>
            <PainTrendChart logs={logs} />
          </Paper>
        </Grid>
        <Grid item xs={12}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              {t('temperatureTrend', 'Temperature Trend')}
            </Typography>
            <TemperatureTrendChart logs={logs} />
          </Paper>
        </Grid>
        <Grid item xs={12}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              {t('recoveryScoreTrend', 'Recovery Score Trend')}
            </Typography>
            <RecoveryScoreChart logs={logs} />
          </Paper>
        </Grid>
      </Grid>
    </Container>
  );
};

export default TrendsDashboard;
