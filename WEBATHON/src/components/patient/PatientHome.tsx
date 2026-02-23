import { useEffect, useState } from 'react';
import {
  Container,
  Grid,
  Paper,
  Typography,
  Box,
  Chip,
  Alert,
  Button,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, limit, getDocs, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { getRiskColor } from '../../utils/riskUtils';
import PainTrendChart from './PainTrendChart';
import TemperatureTrendChart from './TemperatureTrendChart';

interface LogEntry {
  id: string;
  pain_score: number;
  temperature: number;
  risk: string;
  risk_message?: string;
  rule_risk?: string;
  trend_risk?: string;
  risk_details?: { risk?: string };
  createdAt: any;
  createdAtClient?: number;
  risk_assessed_at?: any;
}

const normalizeRisk = (rawRisk: unknown): 'GREEN' | 'YELLOW' | 'RED' => {
  const risk = String(rawRisk || '').toUpperCase();
  if (risk === 'RED' || risk === 'CRITICAL') return 'RED';
  if (risk === 'YELLOW' || risk === 'WARNING') return 'YELLOW';
  return 'GREEN';
};

const toMillis = (value: any): number => {
  if (!value) return 0;
  if (typeof value?.toDate === 'function') return value.toDate().getTime();
  if (value?.seconds) return value.seconds * 1000;
  if (typeof value === 'number') return value;
  return 0;
};

const parseSurgeryDate = (value: any): Date | null => {
  if (!value) return null;
  if (typeof value?.toDate === 'function') {
    const d = value.toDate();
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (value?.seconds) {
    const d = new Date(value.seconds * 1000);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof value === 'string') {
    // Support YYYY-MM-DD and ISO strings.
    const normalized = /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00` : value;
    const d = new Date(normalized);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof value === 'number') {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
};

const calculateDaysSince = (surgeryDate: Date): number => {
  const today = new Date();
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const startOfSurgery = new Date(
    surgeryDate.getFullYear(),
    surgeryDate.getMonth(),
    surgeryDate.getDate()
  );
  const diff = startOfToday.getTime() - startOfSurgery.getTime();
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
};

const PatientHome = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [riskStatus, setRiskStatus] = useState<'GREEN' | 'YELLOW' | 'RED'>('GREEN');
  const [recoveryScore, setRecoveryScore] = useState(85);
  const [daysSinceSurgery, setDaysSinceSurgery] = useState(0);
  const [upcomingAppointments, setUpcomingAppointments] = useState<Array<{ id: string; proposedAt: string }>>([]);
  const [recentLogs, setRecentLogs] = useState<LogEntry[]>([]);
  const [latestAlertMessage, setLatestAlertMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [doctorEmail, setDoctorEmail] = useState<string | null>(null);
  const { t } = useTranslation();

  const riskLabel = (risk: 'GREEN' | 'YELLOW' | 'RED') => {
    if (risk === 'RED') return t('danger', 'Danger');
    if (risk === 'YELLOW') return t('warning', 'Warning');
    return t('safe', 'Safe');
  };

  const localizeRiskMessage = (message: string) => {
    if (!message) return '';

    const map: Array<{ from: string; to: string }> = [
      { from: 'High fever', to: t('highFever', 'High fever') },
      { from: 'Fever', to: t('fever', 'Fever') },
      { from: 'Possible wound infection', to: t('possibleWoundInfection', 'Possible wound infection') },
      { from: 'Extreme pain', to: t('extremePain', 'Extreme pain') },
      { from: 'Severe pain', to: t('severePain', 'Severe pain') },
      { from: 'Medication non-adherence', to: t('medicationNonAdherence', 'Medication non-adherence') },
      { from: 'High risk symptoms detected', to: t('highRiskSymptomsDetected', 'High risk symptoms detected') },
      {
        from: 'Moderate risk symptoms detected',
        to: t('moderateRiskSymptomsDetected', 'Moderate risk symptoms detected'),
      },
      { from: 'All parameters normal', to: t('allParametersNormal', 'All parameters normal') },
    ];

    let localized = message;
    map.forEach(({ from, to }) => {
      localized = localized.split(from).join(to);
    });
    return localized;
  };

  const latestLog = recentLogs.length > 0 ? recentLogs[0] : null;
  const latestRuleOutput = latestLog
    ? String(
        latestLog.risk_message ||
          latestLog.rule_risk ||
          latestLog.trend_risk ||
          latestLog.risk_details?.risk ||
          latestLog.risk ||
          ''
      ).trim()
    : '';

  useEffect(() => {
    if (!user) return;
    let unsubscribeLogs: (() => void) | null = null;
    let unsubscribeAppointments: (() => void) | null = null;
    let unsubscribeAlerts: (() => void) | null = null;

    const fetchPatientData = async () => {
      try {
        // Fetch patient profile for surgery date
        const patientRef = collection(db, 'patients');
        const patientQuery = query(patientRef, where('userId', '==', user.uid), limit(1));
        const patientSnapshot = await getDocs(patientQuery);
        
        const patientIdentifiers = new Set<string>([user.uid]);

        if (!patientSnapshot.empty) {
          const patientData = patientSnapshot.docs[0].data();
          patientIdentifiers.add(String(patientSnapshot.docs[0].id));
          if (patientData?.patient_id) patientIdentifiers.add(String(patientData.patient_id));
          if (patientData?.userId) patientIdentifiers.add(String(patientData.userId));

          const surgeryDate =
            parseSurgeryDate(patientData?.surgeryDate) ||
            parseSurgeryDate(patientData?.surgery_date) ||
            null;
          if (surgeryDate) {
            setDaysSinceSurgery(calculateDaysSince(surgeryDate));
          } else {
            // Fallback for older records where surgery date exists only on users doc.
            const userSnap = await getDoc(doc(db, 'users', user.uid));
            if (userSnap.exists()) {
              const userData: any = userSnap.data();
              const userSurgeryDate =
                parseSurgeryDate(userData?.surgeryDate) ||
                parseSurgeryDate(userData?.surgery_date) ||
                null;
              if (userSurgeryDate) {
                setDaysSinceSurgery(calculateDaysSince(userSurgeryDate));
              }
            }
          }
          // Prefer mapped doctor email directly from patient profile.
          if (patientData.doctor_email) {
            setDoctorEmail(String(patientData.doctor_email));
          }

          // Fallback: resolve doctor by id from user profile fields.
          const doctorId = patientData.doctor_id || patientData.doctorId || patientData.assignedDoctorId;
          if (doctorId && !patientData.doctor_email) {
            try {
              const { doc, getDoc } = await import('firebase/firestore');
              const docRef = await getDoc(doc(db, 'users', doctorId));
              if (docRef.exists()) {
                const d: any = docRef.data();
                setDoctorEmail(d.email || null);
              }
            } catch (e) {
              console.error('Error fetching doctor email:', e);
            }
          }
        } else {
          // Fallback for legacy users without a patients document.
          const userSnap = await getDoc(doc(db, 'users', user.uid));
          if (userSnap.exists()) {
            const userData: any = userSnap.data();
            const userSurgeryDate =
              parseSurgeryDate(userData?.surgeryDate) ||
              parseSurgeryDate(userData?.surgery_date) ||
              null;
            if (userSurgeryDate) {
              setDaysSinceSurgery(calculateDaysSince(userSurgeryDate));
            }
          }
        }

        // Restore latest alert message behavior from alerts collection.
        const alertsRef = collection(db, 'alerts');
        const alertsQuery = query(alertsRef, limit(500));
        unsubscribeAlerts = onSnapshot(
          alertsQuery,
          (alertsSnapshot) => {
            const rows = alertsSnapshot.docs
              .map((d) => ({ id: d.id, ...(d.data() as any) }))
              .filter((row) => {
                const id = String(
                  row?.patientId || row?.patient_id || row?.patientDocId || ''
                );
                return id && patientIdentifiers.has(id);
              })
              .sort((a, b) => {
                const ta = toMillis(a.createdAt) || toMillis(a.createdAtClient);
                const tb = toMillis(b.createdAt) || toMillis(b.createdAtClient);
                return tb - ta;
              });

            const latest = rows[0];
            setLatestAlertMessage(String(latest?.message || '').trim());
          },
          (err) => {
            console.error('Error watching alerts:', err);
          }
        );

        const logsRef = collection(db, 'symptom_logs');
        const logsQuery = query(logsRef, where('patientId', '==', user.uid), limit(500));
        unsubscribeLogs = onSnapshot(
          logsQuery,
          (logsSnapshot) => {
            const logs = logsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as LogEntry));
            logs.sort((a, b) => {
              const ta = toMillis(a.createdAt) || toMillis(a.risk_assessed_at) || toMillis(a.createdAtClient);
              const tb = toMillis(b.createdAt) || toMillis(b.risk_assessed_at) || toMillis(b.createdAtClient);
              return tb - ta;
            });
            const recent = logs.slice(0, 5);
            setRecentLogs(recent);

            if (recent.length > 0) {
              setRiskStatus(normalizeRisk(recent[0].risk || recent[0].risk_details?.risk));
            } else {
              setRiskStatus('GREEN');
            }

            // Calculate recovery score (simplified)
            if (recent.length > 0) {
              const avgPain = recent.reduce((sum, log) => sum + (Number(log.pain_score) || 0), 0) / recent.length;
              const avgTemp = recent.reduce((sum, log) => sum + (Number(log.temperature) || 0), 0) / recent.length;
              let score = 100;
              score -= avgPain * 5; // Pain reduces score
              if (avgTemp > 37) score -= (avgTemp - 37) * 10; // Fever reduces score
              setRecoveryScore(Math.max(0, Math.min(100, Math.round(score))));
            }
            setLoading(false);
          },
          (err) => {
            console.error('Error watching symptom logs:', err);
            setLoading(false);
          }
        );

        const appointmentsRef = collection(db, 'appointment_requests');
        const appointmentsQuery = query(
          appointmentsRef,
          where('patientId', '==', user.uid),
          where('status', '==', 'accepted')
        );
        unsubscribeAppointments = onSnapshot(
          appointmentsQuery,
          (appointmentsSnapshot) => {
            const now = Date.now();
            const rows = appointmentsSnapshot.docs
              .map((d) => ({ id: d.id, ...(d.data() as any) }))
              .filter((row) => {
                const at = Date.parse(String(row.proposedAt || ''));
                return at && at >= now;
              })
              .sort((a, b) => Date.parse(String(a.proposedAt || '')) - Date.parse(String(b.proposedAt || '')))
              .slice(0, 3)
              .map((row) => ({ id: row.id, proposedAt: String(row.proposedAt || '') }));
            setUpcomingAppointments(rows);
          },
          (err) => {
            console.error('Error watching appointments:', err);
          }
        );
      } catch (error) {
        console.error('Error fetching patient data:', error);
        setLoading(false);
      } finally {
        // loading state is finalized by realtime listeners
      }
    };

    fetchPatientData();
    return () => {
      if (unsubscribeLogs) unsubscribeLogs();
      if (unsubscribeAppointments) unsubscribeAppointments();
      if (unsubscribeAlerts) unsubscribeAlerts();
    };
  }, [user]);

  if (loading) {
    return <Typography>{t('loading', 'Loading...')}</Typography>;
  }

  return (
    <Container maxWidth="lg">
      <Grid container spacing={3}>
        {/* Risk Status Card */}
        <Grid item xs={12}>
          <Paper sx={{ p: 3 }}>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
              <Typography variant="h5">{t('riskStatus', 'Risk Status')}</Typography>
              <Chip
                label={riskLabel(riskStatus)}
                color={getRiskColor(riskStatus)}
                size="medium"
              />
            </Box>
            {riskStatus === 'RED' && (
              <Alert severity="error" sx={{ mb: 2 }}>
                <Typography variant="h6">{t('urgentAttention', 'Urgent Attention Required')}</Typography>
                <Typography>{t('contactDoctorPrompt', 'Please contact your doctor immediately.')}</Typography>
                <Box mt={1} display="flex" gap={1}>
                  <Button variant="contained" color="error" onClick={() => navigate('/patient/chat')}>
                    {t('contactDoctor', 'Contact Doctor')}
                  </Button>
                  <Button variant="outlined" onClick={async () => {
                    if (doctorEmail) {
                      const { openGmailCompose } = await import('../../utils/emailUtils');
                      openGmailCompose(doctorEmail, t('emailSubject', 'Post-Op Guardian: Urgent'), t('emailBody', 'Please contact me regarding post-op concerns.'));
                    } else {
                      alert(t('noMeetLink', 'No video meeting link configured. Please ask your doctor to set a meeting link in their profile.'));
                    }
                  }}>
                    {t('emailDoctor', 'Email Doctor')}
                  </Button>
                </Box>
              </Alert>
            )}
            {riskStatus === 'YELLOW' && (
              <Alert severity="warning" sx={{ mb: 2 }}>
                <Typography>{t('monitorSymptoms', 'Monitor your symptoms closely. Consider chatting with your doctor.')}</Typography>
              </Alert>
            )}
            {riskStatus === 'GREEN' && (
              <Alert severity="success" sx={{ mb: 2 }}>
                <Typography>{t('recoveryProgress', 'Your recovery is progressing well. Keep up the good work!')}</Typography>
              </Alert>
            )}
          </Paper>
        </Grid>

        {/* Recovery Metrics */}
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 3, textAlign: 'center' }}>
            <Typography variant="h6" color="text.secondary" gutterBottom>
              {t('recoveryScore', 'Recovery Score')}
            </Typography>
            <Typography variant="h2" color="primary">
              {recoveryScore}
            </Typography>
          </Paper>
        </Grid>

        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 3, textAlign: 'center' }}>
            <Typography variant="h6" color="text.secondary" gutterBottom>
              {t('daysSinceSurgery', 'Days Since Surgery')}
            </Typography>
            <Typography variant="h2" color="primary">
              {daysSinceSurgery}
            </Typography>
          </Paper>
        </Grid>

        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              {t('latestAlert', 'Latest Alert')}
            </Typography>
            <Typography sx={{ mb: 1 }}>
              {localizeRiskMessage(latestAlertMessage || latestRuleOutput || t('noAlerts', 'No alerts'))}
            </Typography>
            <Typography sx={{ mb: 1 }}>
              {t('potentialRisk', 'Potential Risk')}: {riskLabel(riskStatus)}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              {t('upcomingAppointments', 'Upcoming Appointments')}
            </Typography>
            {upcomingAppointments.length === 0 ? (
              <Typography color="text.secondary">
                {t('noUpcomingAppointments', 'No upcoming appointments')}
              </Typography>
            ) : (
              upcomingAppointments.map((appt) => (
                <Typography key={appt.id} variant="body2">
                  {new Date(appt.proposedAt).toLocaleString()}
                </Typography>
              ))
            )}
          </Paper>
        </Grid>

        {/* Quick Actions */}
        <Grid item xs={12}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              {t('quickActions', 'Quick Actions')}
            </Typography>
            <Box display="flex" gap={2} flexWrap="wrap">
              <Button variant="contained" onClick={() => navigate('/patient/log')}>
                {t('logSymptoms', 'Log Symptoms')}
              </Button>
              <Button variant="outlined" onClick={() => navigate('/patient/logs')}>
                {t('viewMyLogs', 'View My Logs')}
              </Button>
              <Button variant="outlined" onClick={() => navigate('/patient/trends')}>
                {t('viewTrends', 'View Trends')}
              </Button>
              <Button variant="outlined" onClick={() => navigate('/patient/reminders')}>
                {t('manageReminders', 'Manage Reminders')}
              </Button>
            </Box>
          </Paper>
        </Grid>

        {/* Trend Charts */}
        {recentLogs.length > 0 && (
          <>
            <Grid item xs={12} md={6}>
              <Paper sx={{ p: 3 }}>
                <Typography variant="h6" gutterBottom>
                  {t('painTrend', 'Pain Trend')}
                </Typography>
                <PainTrendChart logs={recentLogs} />
              </Paper>
            </Grid>
            <Grid item xs={12} md={6}>
              <Paper sx={{ p: 3 }}>
                <Typography variant="h6" gutterBottom>
                  {t('temperatureTrend', 'Temperature Trend')}
                </Typography>
                <TemperatureTrendChart logs={recentLogs} />
              </Paper>
            </Grid>
          </>
        )}
      </Grid>
    </Container>
  );
};

export default PatientHome;
