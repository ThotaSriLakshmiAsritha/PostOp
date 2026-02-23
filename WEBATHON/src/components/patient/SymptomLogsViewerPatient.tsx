import React, { useEffect, useState } from 'react';
import {
  Container,
  Paper,
  Typography,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  TableContainer,
  Chip,
} from '@mui/material';
import { collection, query, limit, getDocs, where } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { useTranslation } from 'react-i18next';

const SymptomLogsViewerPatient: React.FC = () => {
  const { user } = useAuth();
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { t, i18n } = useTranslation();

  const getRiskChip = (rawRisk: unknown) => {
    const risk = String(rawRisk || '').toUpperCase();
    if (risk === 'CRITICAL' || risk === 'RED') {
      return <Chip label={String(t('critical', 'Critical'))} color="error" size="small" />;
    }
    if (risk === 'WARNING' || risk === 'YELLOW') {
      return <Chip label={String(t('warning', 'Warning'))} color="warning" size="small" />;
    }
    if (risk === 'NORMAL' || risk === 'GREEN' || risk === 'LOW') {
      return <Chip label={String(t('safe', 'Safe'))} color="success" size="small" />;
    }
    return <Chip label={risk || '-'} size="small" />;
  };

  useEffect(() => {
    if (!user) return;

    const loadLogs = async () => {
      setLoading(true);
      try {
        // Avoid composite-index requirement by fetching by equality and sorting client-side
        const q = query(
          collection(db, 'symptom_logs'),
          where('patientId', '==', user.uid),
          limit(500)
        );
        const snap = await getDocs(q);
        const rows: any[] = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        // sort by createdAt desc in client to avoid needing a composite index
        rows.sort((a, b) => {
          const ta = a.createdAt && typeof a.createdAt.toDate === 'function' ? a.createdAt.toDate().getTime() : (a.createdAt?.seconds ? a.createdAt.seconds * 1000 : 0);
          const tb = b.createdAt && typeof b.createdAt.toDate === 'function' ? b.createdAt.toDate().getTime() : (b.createdAt?.seconds ? b.createdAt.seconds * 1000 : 0);
          return tb - ta;
        });
        setLogs(rows.slice(0, 100));
      } catch (err) {
        console.error('Error loading symptom logs for patient:', err);
      } finally {
        setLoading(false);
      }
    };

    loadLogs();
  }, [user]);

  const formatDate = (ts: any) => {
    if (!ts) return '';
    if (typeof ts.toDate === 'function') return ts.toDate().toLocaleString(i18n.language);
    if (ts.seconds) return new Date(ts.seconds * 1000).toLocaleString(i18n.language);
    return String(ts);
  };

  return (
    <Container maxWidth="lg">
      <Typography variant="h4" gutterBottom>
        {t('myLogs', 'My Symptom Logs')}
      </Typography>

      <Paper>
        <TableContainer>
          {loading ? (
            <Typography sx={{ p: 3 }}>{t('loading', 'Loading...')}</Typography>
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>{t('createdAt', 'Created At')}</TableCell>
                  <TableCell>{t('pain', 'Pain')}</TableCell>
                  <TableCell>{t('temp', 'Temp')}</TableCell>
                  <TableCell>{t('risk', 'Risk')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id} hover>
                    <TableCell>{formatDate(log.createdAt)}</TableCell>
                    <TableCell>{log.pain_score ?? '-'}</TableCell>
                    <TableCell>{log.temperature ?? '-'}</TableCell>
                    <TableCell>{getRiskChip(log.risk)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </TableContainer>
      </Paper>
    </Container>
  );
};

export default SymptomLogsViewerPatient;
