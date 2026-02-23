import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Container,
  Paper,
  Typography,
  Grid,
  Chip,
  Button,
  Box,
  List,
  ListItem,
  ListItemText,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
} from '@mui/material';
import ChatIcon from '@mui/icons-material/Chat';
import VideoCallIcon from '@mui/icons-material/VideoCall';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { collection, query, where, limit, getDocs, doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { getRiskColor } from '../../utils/riskUtils';
import PainTrendChart from '../patient/PainTrendChart';
import TemperatureTrendChart from '../patient/TemperatureTrendChart';
import { useAuth } from '../../contexts/AuthContext';
import { resolvePairForDoctorAndPatient } from '../../utils/assignmentUtils';
import { handleVideoCall as startConsultationVideoCall } from '../../services/consultationService';

interface LogEntry {
  id: string;
  pain_score: number;
  temperature: number;
  risk: string;
  risk_message?: string;
  days_after_surgery?: number;
  createdAt: any;
  createdAtClient?: number;
  risk_assessed_at?: any;
  antibiotics_taken?: boolean;
  pain_meds_taken?: boolean;
}

interface AlertRow {
  id: string;
  message: string;
  acknowledged: boolean;
  createdAt: any;
  risk?: string;
}

const PatientDetail = () => {
  const { patientId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [patient, setPatient] = useState<any>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [chatTargetId, setChatTargetId] = useState<string | null>(null);
  const [risk, setRisk] = useState<'NORMAL' | 'WARNING' | 'CRITICAL'>('NORMAL');
  const [acknowledgeDialog, setAcknowledgeDialog] = useState(false);
  const [selectedAlert, setSelectedAlert] = useState<AlertRow | null>(null);
  const [note, setNote] = useState('');
  const [accessDenied, setAccessDenied] = useState(false);
  const [startingVideo, setStartingVideo] = useState(false);
  const { t, i18n } = useTranslation();

  const normalizeRisk = (rawRisk: unknown): 'NORMAL' | 'WARNING' | 'CRITICAL' => {
    const value = String(rawRisk || '').trim().toUpperCase();
    if (value === 'RED' || value === 'CRITICAL') return 'CRITICAL';
    if (value === 'YELLOW' || value === 'WARNING') return 'WARNING';
    return 'NORMAL';
  };

  const toLegacyRisk = (value: 'NORMAL' | 'WARNING' | 'CRITICAL'): 'GREEN' | 'YELLOW' | 'RED' => {
    if (value === 'CRITICAL') return 'RED';
    if (value === 'WARNING') return 'YELLOW';
    return 'GREEN';
  };

  const riskLabel = (value: 'NORMAL' | 'WARNING' | 'CRITICAL') => {
    if (value === 'CRITICAL') return t('critical', 'Critical');
    if (value === 'WARNING') return t('warning', 'Warning');
    return t('safe', 'Safe');
  };

  const extractRiskFromLog = (log: any): 'NORMAL' | 'WARNING' | 'CRITICAL' =>
    normalizeRisk(log?.risk || log?.rule_risk || log?.trend_risk || log?.risk_details?.risk);

  const toMillis = (value: any): number => {
    if (!value) return 0;
    if (typeof value?.toDate === 'function') return value.toDate().getTime();
    if (value?.seconds) return value.seconds * 1000;
    if (typeof value === 'number') return value;
    return 0;
  };

  useEffect(() => {
    if (patientId) {
      loadPatientData();
    }
  }, [patientId, user?.uid]);

  const loadPatientData = async () => {
    try {
      if (!user?.uid || !patientId) return;

      const pair = await resolvePairForDoctorAndPatient(user.uid, patientId);
      if (!pair) {
        setAccessDenied(true);
        setPatient(null);
        setLogs([]);
        setAlerts([]);
        return;
      }
      setAccessDenied(false);

      let patientData: any = null;
      let actualUserId: string | null = null;
      const patientIdentifiers: string[] = [];
      patientIdentifiers.push(
        String(pair.patientUserId || ''),
        String(pair.patientId || '')
      );
      const patientCandidates = Array.from(
        new Set(
          [
            patientId,
            pair.patientDocId,
            pair.patientId,
            pair.patientUserId,
          ]
            .filter(Boolean)
            .map((v) => String(v))
        )
      );

      let resolvedPatientDocId: string | null = null;

      for (const candidate of patientCandidates) {
        const patientDoc = await getDoc(doc(db, 'patients', candidate));
        if (patientDoc.exists()) {
          patientData = patientDoc.data();
          resolvedPatientDocId = patientDoc.id;
          actualUserId =
            patientData.userId ||
            patientData.patient_user_id ||
            patientData.patientUid ||
            pair.patientUserId ||
            null;
          break;
        }
      }

      if (!patientData) {
        const byUserIdCandidates = Array.from(
          new Set([patientId, pair.patientUserId, pair.patientId].filter(Boolean).map(String))
        );
        for (const candidate of byUserIdCandidates) {
          const patientsSnapshot = await getDocs(
            query(collection(db, 'patients'), where('userId', '==', candidate), limit(1))
          );
          if (!patientsSnapshot.empty) {
            patientData = patientsSnapshot.docs[0].data();
            resolvedPatientDocId = patientsSnapshot.docs[0].id;
            actualUserId =
              patientData.userId ||
              patientData.patient_user_id ||
              patientData.patientUid ||
              candidate;
            break;
          }
        }
      }

      if (!patientData) {
        const byPatientIdCandidates = Array.from(
          new Set([patientId, pair.patientId].filter(Boolean).map(String))
        );
        for (const candidate of byPatientIdCandidates) {
          const byPatientIdSnapshot = await getDocs(
            query(collection(db, 'patients'), where('patient_id', '==', candidate), limit(1))
          );
          if (!byPatientIdSnapshot.empty) {
            patientData = byPatientIdSnapshot.docs[0].data();
            resolvedPatientDocId = byPatientIdSnapshot.docs[0].id;
            actualUserId =
              patientData.userId ||
              patientData.patient_user_id ||
              patientData.patientUid ||
              pair.patientUserId ||
              null;
            break;
          }
        }
      }

      // Fallback for deployments where patient profile exists only in users collection.
      if (!patientData) {
        const userCandidates = Array.from(
          new Set([patientId, pair.patientUserId, pair.patientId].filter(Boolean).map(String))
        );
        for (const candidate of userCandidates) {
          const userDoc = await getDoc(doc(db, 'users', candidate));
          if (!userDoc.exists()) continue;
          const userData = userDoc.data() as any;
          if (String(userData?.role || '').toLowerCase() !== 'patient') continue;
          patientData = userData;
          resolvedPatientDocId = pair.patientDocId || userDoc.id;
          actualUserId = userData?.uid || userDoc.id;
          break;
        }
      }

      if (patientData) {
        const targetId = actualUserId || pair.patientUserId || pair.patientId || resolvedPatientDocId;
        setChatTargetId(targetId || null);
        setPatient({ ...patientData, id: resolvedPatientDocId || pair.patientDocId || patientId });
        patientIdentifiers.push(
          String(actualUserId || ''),
          String(patientData.patient_id || ''),
          String(patientData.uid || ''),
          String(resolvedPatientDocId || '')
        );
      }

      if (!actualUserId) {
        console.error('Patient not found');
        return;
      }

      const uniqueIdentifiers = Array.from(
        new Set(
          patientIdentifiers
            .map((id) => id.trim())
            .filter((id) => id.length > 0)
        )
      );
      const allLogsSnapshot = await getDocs(query(collection(db, 'symptom_logs'), limit(2000)));
      const logRows = allLogsSnapshot.docs
        .map((logDoc) => ({ id: logDoc.id, ...logDoc.data() } as LogEntry))
        .filter((row: any) => uniqueIdentifiers.includes(String(row?.patientId || '')));
      logRows.sort((a, b) => {
        const ta = toMillis(a.createdAt) || toMillis(a.risk_assessed_at) || toMillis(a.createdAtClient);
        const tb = toMillis(b.createdAt) || toMillis(b.risk_assessed_at) || toMillis(b.createdAtClient);
        return tb - ta;
      });
      setLogs(logRows);
      setRisk(logRows.length > 0 ? extractRiskFromLog(logRows[0]) : 'NORMAL');

      const allAlertsSnapshot = await getDocs(query(collection(db, 'alerts'), limit(500)));
      const alertRows = allAlertsSnapshot.docs
        .map((alertDoc) => ({ id: alertDoc.id, ...alertDoc.data() } as AlertRow))
        .filter((row: any) => uniqueIdentifiers.includes(String(row?.patientId || '')))
        .sort(
        (a, b) => toMillis(b.createdAt) - toMillis(a.createdAt)
      );
      setAlerts(alertRows);

      // Fallback: derive risk from latest alert when logs are unavailable.
      if (logRows.length === 0 && alertRows.length > 0) {
        setRisk(normalizeRisk(alertRows[0].risk));
      }
    } catch (error) {
      console.error('Error loading patient data:', error);
    }
  };

  const handleAcknowledge = async () => {
    if (!selectedAlert) return;

    try {
      await updateDoc(doc(db, 'alerts', selectedAlert.id), {
        acknowledged: true,
        acknowledgedAt: new Date(),
        note,
      });
      await loadPatientData();
      setAcknowledgeDialog(false);
      setSelectedAlert(null);
      setNote('');
    } catch (error) {
      console.error('Error acknowledging alert:', error);
    }
  };

  const calculateAdherence = (rows: LogEntry[]): number => {
    if (rows.length === 0) return 0;
    const taken = rows.filter((log) => log.antibiotics_taken && log.pain_meds_taken).length;
    return Math.round((taken / rows.length) * 100);
  };

  const handleVideoCall = async () => {
    if (!user?.uid || !chatTargetId) {
      alert(t('cannotStartCall', 'Cannot start call for this patient.'));
      return;
    }

    try {
      setStartingVideo(true);
      const pair = await resolvePairForDoctorAndPatient(user.uid, chatTargetId);
      if (!pair || !pair.patientUserId) {
        alert(
          t(
            'assignmentMissing',
            'This patient is not assigned to you. Calls are restricted to assigned doctor-patient pairs.'
          )
        );
        return;
      }
      await startConsultationVideoCall(pair.patientDocId);
    } catch (error) {
      console.error('Error starting video call:', error);
      alert(t('cannotStartCall', 'Cannot start call for this patient.'));
    } finally {
      setStartingVideo(false);
    }
  };

  if (accessDenied) {
    return (
      <Container maxWidth="md">
        <Typography color="error">
          {t(
            'assignmentMissing',
            'This patient is not assigned to you. Access is restricted to assigned doctor-patient pairs.'
          )}
        </Typography>
      </Container>
    );
  }

  if (!patient) {
    return <Typography>{t('loadingPatientData', 'Loading patient data...')}</Typography>;
  }

  const latestLog = logs.length > 0 ? logs[0] : null;
  const chartLogs = [...logs].reverse();

  return (
    <Container maxWidth="lg">
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">{patient.name || t('patientFallback', 'Patient')}</Typography>
        <Box display="flex" gap={2}>
          <Chip label={riskLabel(risk)} color={getRiskColor(toLegacyRisk(risk))} size="medium" />
          <Button
            variant="outlined"
            startIcon={<ChatIcon />}
            onClick={() => navigate(`/doctor/chat/${chatTargetId || patient.userId || patient.id}`)}
            disabled={!chatTargetId && !patient.userId && !patient.id}
          >
            {t('chat', 'Chat')}
          </Button>
          <Button
            variant="outlined"
            startIcon={<VideoCallIcon />}
            onClick={handleVideoCall}
            disabled={startingVideo}
          >
            {startingVideo ? t('startingVideoCall', 'Starting...') : t('videoCall', 'Video Call')}
          </Button>
        </Box>
      </Box>

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              {t('patientInformation', 'Patient Information')}
            </Typography>
            <List>
              <ListItem>
                <ListItemText
                  primary={t('specialisation', 'Specialisation')}
                  secondary={patient.surgery_type || patient.surgeryType || t('na', 'N/A')}
                />
              </ListItem>
              <ListItem>
                <ListItemText
                  primary={t('surgeryDate', 'Surgery Date')}
                  secondary={
                    patient.surgeryDate?.toDate
                      ? patient.surgeryDate.toDate().toLocaleDateString(i18n.language)
                      : t('na', 'N/A')
                  }
                />
              </ListItem>
              <ListItem>
                <ListItemText
                  primary={t('medicationAdherence', 'Medication Adherence')}
                  secondary={`${calculateAdherence(logs)}%`}
                />
              </ListItem>
              <ListItem>
                <ListItemText
                  primary={t('latestRisk', 'Latest Risk')}
                  secondary={latestLog ? riskLabel(extractRiskFromLog(latestLog)) : t('na', 'N/A')}
                />
              </ListItem>
              <ListItem>
                <ListItemText
                  primary={t('latestPainScore', 'Latest Pain Score')}
                  secondary={latestLog?.pain_score ?? t('na', 'N/A')}
                />
              </ListItem>
              <ListItem>
                <ListItemText
                  primary={t('latestTemperature', 'Latest Temperature')}
                  secondary={latestLog?.temperature !== undefined ? `${latestLog.temperature}°C` : t('na', 'N/A')}
                />
              </ListItem>
              <ListItem>
                <ListItemText
                  primary={t('latestRiskMessage', 'Latest Risk Message')}
                  secondary={latestLog?.risk_message || t('na', 'N/A')}
                />
              </ListItem>
            </List>
          </Paper>
        </Grid>

        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              {t('allSymptomLogs', 'All Symptom Logs')}
            </Typography>
            <TableContainer sx={{ maxHeight: 420 }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell>{t('date', 'Date')}</TableCell>
                    <TableCell>{t('daysAfterSurgery', 'Days After Surgery')}</TableCell>
                    <TableCell>{t('pain', 'Pain')}</TableCell>
                    <TableCell>{t('temp', 'Temp')}</TableCell>
                    <TableCell>{t('risk', 'Risk')}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {logs.map((log) => {
                    const logRisk = extractRiskFromLog(log);
                    return (
                      <TableRow key={log.id}>
                        <TableCell>
                          {log.createdAt?.toDate
                            ? log.createdAt.toDate().toLocaleString(i18n.language)
                            : t('na', 'N/A')}
                        </TableCell>
                        <TableCell>{log.days_after_surgery ?? '-'}</TableCell>
                        <TableCell>{log.pain_score}</TableCell>
                        <TableCell>{log.temperature}°C</TableCell>
                        <TableCell>
                          <Chip
                            label={riskLabel(logRisk)}
                            color={getRiskColor(toLegacyRisk(logRisk))}
                            size="small"
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Grid>

        {logs.length > 0 && (
          <>
            <Grid item xs={12} md={6}>
              <Paper sx={{ p: 3 }}>
                <Typography variant="h6" gutterBottom>
                  {t('painTrend', 'Pain Trend')}
                </Typography>
                <PainTrendChart logs={chartLogs as any} />
              </Paper>
            </Grid>
            <Grid item xs={12} md={6}>
              <Paper sx={{ p: 3 }}>
                <Typography variant="h6" gutterBottom>
                  {t('temperatureTrend', 'Temperature Trend')}
                </Typography>
                <TemperatureTrendChart logs={chartLogs as any} />
              </Paper>
            </Grid>
          </>
        )}

        <Grid item xs={12}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              {t('alerts', 'Alerts')}
            </Typography>
            {alerts.length === 0 ? (
              <Typography color="text.secondary">{t('noAlerts', 'No alerts')}</Typography>
            ) : (
              <List>
                {alerts.map((alert) => (
                  <ListItem
                    key={alert.id}
                    secondaryAction={
                      !alert.acknowledged && (
                        <Button
                          startIcon={<CheckCircleIcon />}
                          onClick={() => {
                            setSelectedAlert(alert);
                            setAcknowledgeDialog(true);
                          }}
                        >
                          {t('acknowledge', 'Acknowledge')}
                        </Button>
                      )
                    }
                  >
                    <ListItemText
                      primary={alert.message}
                      secondary={
                        alert.createdAt?.toDate
                          ? alert.createdAt.toDate().toLocaleString(i18n.language)
                          : t('na', 'N/A')
                      }
                    />
                    {alert.acknowledged && (
                      <Chip
                        label={t('acknowledged', 'Acknowledged')}
                        color="success"
                        size="small"
                        sx={{ ml: 2 }}
                      />
                    )}
                  </ListItem>
                ))}
              </List>
            )}
          </Paper>
        </Grid>
      </Grid>

      <Dialog open={acknowledgeDialog} onClose={() => setAcknowledgeDialog(false)}>
        <DialogTitle>{t('acknowledgeAlert', 'Acknowledge Alert')}</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            multiline
            rows={4}
            label={t('addNoteOptional', 'Add Note (Optional)')}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            margin="normal"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAcknowledgeDialog(false)}>{t('cancel', 'Cancel')}</Button>
          <Button onClick={handleAcknowledge} variant="contained">
            {t('acknowledge', 'Acknowledge')}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default PatientDetail;
