import { useEffect, useMemo, useState } from 'react';
import {
  Container,
  Grid,
  Paper,
  Typography,
  Box,
  Chip,
  List,
  ListItem,
  ListItemText,
  Button,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { collection, query, where, orderBy, limit, getDocs, getDoc, doc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { getRiskColor } from '../../utils/riskUtils';
import { useAuth } from '../../contexts/AuthContext';
import { useDoctorPatients } from '../../hooks/useDoctorPatients';

interface Alert {
  id: string;
  patientId: string;
  patientName: string;
  message: string;
  risk: 'NORMAL' | 'WARNING' | 'CRITICAL';
  acknowledged: boolean;
  createdAt: any;
}

interface PatientSummary {
  id: string;
  name: string;
  risk: 'NORMAL' | 'WARNING' | 'CRITICAL';
  lastUpdate: any;
}

interface LogDerivedRisk {
  risk: 'NORMAL' | 'WARNING' | 'CRITICAL';
  lastUpdate: any;
}

interface FlaggedLogRecord {
  id: string;
  patientId: string;
  patientDocId: string;
  patientName: string;
  risk: 'WARNING' | 'CRITICAL';
  createdAt: any;
}

const normalizeRisk = (
  risk: string | null | undefined
): 'NORMAL' | 'WARNING' | 'CRITICAL' => {
  switch ((risk || '').trim().toUpperCase()) {
    case 'RED':
    case 'CRITICAL':
      return 'CRITICAL';
    case 'YELLOW':
    case 'WARNING':
      return 'WARNING';
    default:
      return 'NORMAL';
  }
};

const toLegacyRisk = (risk: 'NORMAL' | 'WARNING' | 'CRITICAL'): 'GREEN' | 'YELLOW' | 'RED' => {
  if (risk === 'CRITICAL') return 'RED';
  if (risk === 'WARNING') return 'YELLOW';
  return 'GREEN';
};

const riskLabel = (
  risk: 'NORMAL' | 'WARNING' | 'CRITICAL',
  t: (key: string, fallback: string) => string
) => {
  if (risk === 'CRITICAL') return t('critical', 'Critical');
  if (risk === 'WARNING') return t('warning', 'Warning');
  return t('safe', 'Safe');
};

const riskPriority = (risk: 'NORMAL' | 'WARNING' | 'CRITICAL') => {
  if (risk === 'CRITICAL') return 2;
  if (risk === 'WARNING') return 1;
  return 0;
};

const toMillis = (value: any): number => {
  if (!value) return 0;
  if (typeof value?.toDate === 'function') return value.toDate().getTime();
  if (value?.seconds) return value.seconds * 1000;
  if (typeof value === 'number') return value;
  return 0;
};

const DoctorHome = () => {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const [doctorId, setDoctorId] = useState<string | null>(null);
  const [doctorIdLoading, setDoctorIdLoading] = useState(true);
  const { patients, loading: patientsLoading } = useDoctorPatients(doctorId, user?.email || null);
  const [redAlerts, setRedAlerts] = useState<Alert[]>([]);
  const [alertsLoading, setAlertsLoading] = useState(true);
  const [logRiskByPatient, setLogRiskByPatient] = useState<Record<string, LogDerivedRisk>>({});
  const [logsLoading, setLogsLoading] = useState(true);
  const [flaggedLogRecords, setFlaggedLogRecords] = useState<FlaggedLogRecord[]>([]);

  useEffect(() => {
    const resolveDoctorId = async () => {
      try {
        if (!user?.uid) {
          setDoctorId(null);
          return;
        }

        if (user.email) {
          const byEmail = query(collection(db, 'doctors'), where('email', '==', user.email));
          const doctorSnap = await getDocs(byEmail);
          if (!doctorSnap.empty) {
            setDoctorId(doctorSnap.docs[0].id);
            return;
          }
        }

        setDoctorId(user.uid);
      } catch (err) {
        console.error('Failed to resolve doctor_id:', err);
        setDoctorId(user?.uid || null);
      } finally {
        setDoctorIdLoading(false);
      }
    };

    resolveDoctorId();
  }, [user?.uid, user?.email]);

  const assignedPatientKeySet = useMemo(() => {
    const keys = new Set<string>();
    patients.forEach((patient: any) => {
      if (patient.id) keys.add(String(patient.id));
      if (patient.patient_id) keys.add(String(patient.patient_id));
      if (patient.userId) keys.add(String(patient.userId));
    });
    return keys;
  }, [patients]);

  useEffect(() => {
    const loadAlerts = async () => {
      try {
        if (!doctorId) {
          setRedAlerts([]);
          return;
        }

        const alertsRef = collection(db, 'alerts');
        const alertsQuery = query(
          alertsRef,
          where('acknowledged', '==', false),
          orderBy('createdAt', 'desc'),
          limit(30)
        );
        const alertsSnapshot = await getDocs(alertsQuery);
        const criticalAlerts: Alert[] = [];

        for (const alertDoc of alertsSnapshot.docs) {
          const data = alertDoc.data() as any;
          const normalizedRisk = normalizeRisk(data.risk);
          const patientId = String(data.patientId || data.patient_id || '');
          if (normalizedRisk !== 'CRITICAL' || !patientId) continue;
          if (assignedPatientKeySet.size > 0 && !assignedPatientKeySet.has(patientId)) continue;

          const matchedPatient = patients.find(
            (patient: any) =>
              patient.id === patientId ||
              patient.patient_id === patientId ||
              patient.userId === patientId
          );

          criticalAlerts.push({
            id: alertDoc.id,
            patientId,
            patientName: matchedPatient?.name || t('unknown', 'Unknown'),
            message: data.message || t('criticalAlert', 'Critical alert'),
            risk: normalizedRisk,
            acknowledged: Boolean(data.acknowledged),
            createdAt: data.createdAt,
          });
        }

        setRedAlerts(criticalAlerts);
      } catch (error) {
        console.error('Error loading dashboard alerts:', error);
      } finally {
        setAlertsLoading(false);
      }
    };

    loadAlerts();
  }, [doctorId, patients, assignedPatientKeySet, t]);

  useEffect(() => {
    const loadLatestRisksFromLogs = async () => {
      try {
        setLogsLoading(true);
        if (!doctorId || patients.length === 0) {
          setLogRiskByPatient({});
          return;
        }

        const next: Record<string, LogDerivedRisk> = {};
        await Promise.all(
          patients.map(async (patient: any) => {
            const candidateIds = [patient.userId, patient.patient_id, patient.id]
              .filter(Boolean)
              .map((value) => String(value));

            let latestLog: any = null;
            for (const candidateId of candidateIds) {
              const logSnap = await getDocs(
                query(
                  collection(db, 'symptom_logs'),
                  where('patientId', '==', candidateId),
                  orderBy('createdAt', 'desc'),
                  limit(1)
                )
              );
              if (!logSnap.empty) {
                latestLog = logSnap.docs[0].data() as any;
                break;
              }
            }

            if (!latestLog) return;

            const derived: LogDerivedRisk = {
              risk: normalizeRisk(
                latestLog?.risk || latestLog?.rule_risk || latestLog?.trend_risk
              ),
              lastUpdate:
                latestLog?.createdAt || latestLog?.risk_assessed_at || latestLog?.createdAtClient || null,
            };

            candidateIds.forEach((candidateId) => {
              next[candidateId] = derived;
            });
          })
        );

        setLogRiskByPatient(next);
      } catch (error) {
        console.error('Error loading log-derived risks:', error);
      } finally {
        setLogsLoading(false);
      }
    };

    loadLatestRisksFromLogs();
  }, [doctorId, patients]);

  useEffect(() => {
    const loadFlaggedLogRecords = async () => {
      try {
        if (!user?.uid) {
          setFlaggedLogRecords([]);
          return;
        }

        const logsSnap = await getDocs(
          query(collection(db, 'symptom_logs'), orderBy('createdAt', 'desc'), limit(400))
        );

        const patientCache = new Map<string, { id: string; data: any } | null>();
        const records: FlaggedLogRecord[] = [];
        const doctorEmail = String(user.email || '').toLowerCase();

        const resolvePatient = async (patientIdentifier: string) => {
          if (patientCache.has(patientIdentifier)) return patientCache.get(patientIdentifier);

          const byDocId = await getDoc(doc(db, 'patients', patientIdentifier));
          if (byDocId.exists()) {
            const result = { id: byDocId.id, data: byDocId.data() as any };
            patientCache.set(patientIdentifier, result);
            return result;
          }

          const byUserIdSnap = await getDocs(
            query(collection(db, 'patients'), where('userId', '==', patientIdentifier), limit(1))
          );
          if (!byUserIdSnap.empty) {
            const result = {
              id: byUserIdSnap.docs[0].id,
              data: byUserIdSnap.docs[0].data() as any,
            };
            patientCache.set(patientIdentifier, result);
            return result;
          }

          const byPatientIdSnap = await getDocs(
            query(collection(db, 'patients'), where('patient_id', '==', patientIdentifier), limit(1))
          );
          if (!byPatientIdSnap.empty) {
            const result = {
              id: byPatientIdSnap.docs[0].id,
              data: byPatientIdSnap.docs[0].data() as any,
            };
            patientCache.set(patientIdentifier, result);
            return result;
          }

          patientCache.set(patientIdentifier, null);
          return null;
        };

        for (const logDoc of logsSnap.docs) {
          const log = logDoc.data() as any;
          const risk = normalizeRisk(log?.risk || log?.rule_risk || log?.trend_risk);
          if (risk !== 'WARNING' && risk !== 'CRITICAL') continue;

          const patientIdentifier = String(log?.patientId || '').trim();
          if (!patientIdentifier) continue;

          const patient = await resolvePatient(patientIdentifier);
          if (!patient) continue;

          const patientData = patient.data || {};
          const assignedDoctorId = String(
            patientData?.doctor_id || patientData?.doctorId || patientData?.assignedDoctorId || ''
          );
          const assignedDoctorEmail = String(patientData?.doctor_email || '').toLowerCase();
          const isAssigned =
            (doctorId && assignedDoctorId === doctorId) ||
            assignedDoctorId === user.uid ||
            (doctorEmail && assignedDoctorEmail === doctorEmail);
          if (!isAssigned) continue;

          records.push({
            id: logDoc.id,
            patientId: patientIdentifier,
            patientDocId: patient.id,
            patientName: patientData?.name || t('unknown', 'Unknown'),
            risk,
            createdAt: log?.createdAt || log?.risk_assessed_at || log?.createdAtClient || null,
          });
        }

        records.sort((a, b) => {
          const byRisk = riskPriority(b.risk) - riskPriority(a.risk);
          if (byRisk !== 0) return byRisk;
          return toMillis(b.createdAt) - toMillis(a.createdAt);
        });

        setFlaggedLogRecords(records.slice(0, 50));
      } catch (error) {
        console.error('Error loading flagged log records:', error);
        setFlaggedLogRecords([]);
      }
    };

    loadFlaggedLogRecords();
  }, [doctorId, user?.uid, user?.email, t]);

  const flaggedPatients = useMemo<PatientSummary[]>(() => {
    const criticalPatientIds = new Set<string>();
    redAlerts.forEach((alert) => criticalPatientIds.add(alert.patientId));
    const merged = new Map<string, PatientSummary>();

    patients.forEach((patient: any) => {
      const keys = [patient.id, patient.patient_id, patient.userId]
        .filter(Boolean)
        .map((value) => String(value));
      let risk = normalizeRisk(patient.latest_risk);
      let lastUpdate = patient.updated_at || patient.created_at || null;

      const logDerived = keys
        .map((key) => logRiskByPatient[key])
        .find((entry) => Boolean(entry));
      if (logDerived) {
        const logIsNewer = toMillis(logDerived.lastUpdate) >= toMillis(lastUpdate);
        const logIsHigherPriority = riskPriority(logDerived.risk) > riskPriority(risk);
        if (logIsHigherPriority || logIsNewer) {
          risk = logDerived.risk;
          lastUpdate = logDerived.lastUpdate || lastUpdate;
        }
      }
      if (risk === 'NORMAL' && keys.some((key) => criticalPatientIds.has(key))) {
        risk = 'CRITICAL';
      }
      if (risk !== 'NORMAL') {
        merged.set(patient.id, {
          id: patient.id,
          name: patient.name || t('unknown', 'Unknown'),
          risk,
          lastUpdate,
        });
      }
    });

    flaggedLogRecords.forEach((record) => {
      const existing = merged.get(record.patientDocId);
      if (!existing) {
        merged.set(record.patientDocId, {
          id: record.patientDocId,
          name: record.patientName,
          risk: record.risk,
          lastUpdate: record.createdAt,
        });
        return;
      }

      const shouldUpgradeRisk = riskPriority(record.risk) > riskPriority(existing.risk);
      const shouldUseNewerTime = toMillis(record.createdAt) > toMillis(existing.lastUpdate);
      if (shouldUpgradeRisk || shouldUseNewerTime) {
        merged.set(record.patientDocId, {
          ...existing,
          risk: shouldUpgradeRisk ? record.risk : existing.risk,
          lastUpdate: shouldUseNewerTime ? record.createdAt : existing.lastUpdate,
        });
      }
    });

    return Array.from(merged.values()).sort((a, b) => {
      const byRisk = riskPriority(b.risk) - riskPriority(a.risk);
      if (byRisk !== 0) return byRisk;
      return toMillis(b.lastUpdate) - toMillis(a.lastUpdate);
    });
  }, [patients, redAlerts, logRiskByPatient, flaggedLogRecords, t]);

  const loading = doctorIdLoading || patientsLoading || alertsLoading || logsLoading;

  if (loading) {
    return <Typography>{t('loading', 'Loading...')}</Typography>;
  }

  return (
    <Container maxWidth="lg">
      <Typography variant="h4" gutterBottom>
        {t('dashboard', 'Dashboard')}
      </Typography>
      <Grid container spacing={3}>
        {/* Flagged Patients */}
        <Grid item xs={12}>
          <Paper sx={{ p: 3 }}>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
              <Typography variant="h6">{t('flaggedPatients', 'Flagged Patients')}</Typography>
              <Button variant="outlined" onClick={() => navigate('/doctor/patients')}>
                {t('viewAllPatients', 'View All Patients')}
              </Button>
            </Box>
            {flaggedPatients.length === 0 ? (
              <Typography color="text.secondary">{t('noFlaggedPatients', 'No flagged patients')}</Typography>
            ) : (
              <List>
                {flaggedPatients.map((patient) => (
                  <ListItem
                    key={patient.id}
                    button
                    onClick={() => navigate(`/doctor/patients/${patient.id}`)}
                    secondaryAction={
                      <Chip
                        label={riskLabel(patient.risk, t)}
                        color={getRiskColor(toLegacyRisk(patient.risk))}
                      />
                    }
                  >
                      <ListItemText
                      primary={patient.name}
                      secondary={`${t('lastUpdate', 'Last update')}: ${patient.lastUpdate?.toDate ? patient.lastUpdate.toDate().toLocaleString(i18n.language) : t('na', 'N/A')}`}
                    />
                  </ListItem>
                ))}
              </List>
            )}
          </Paper>
        </Grid>

        {/* Flagged Log Records */}
        <Grid item xs={12}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              {t('flaggedLogRecords', 'Flagged Log Records (Critical/Warning)')}
            </Typography>
            {flaggedLogRecords.length === 0 ? (
              <Typography color="text.secondary">
                {t('noFlaggedLogRecords', 'No critical or warning log records')}
              </Typography>
            ) : (
              <List>
                {flaggedLogRecords.map((record) => (
                  <ListItem
                    key={record.id}
                    button
                    onClick={() => navigate(`/doctor/patients/${record.patientDocId}`)}
                    secondaryAction={
                      <Chip
                        label={riskLabel(record.risk, t)}
                        color={getRiskColor(toLegacyRisk(record.risk))}
                      />
                    }
                  >
                    <ListItemText
                      primary={record.patientName}
                      secondary={`${t('lastUpdate', 'Last update')}: ${
                        record.createdAt?.toDate
                          ? record.createdAt.toDate().toLocaleString(i18n.language)
                          : t('na', 'N/A')
                      }`}
                    />
                  </ListItem>
                ))}
              </List>
            )}
          </Paper>
        </Grid>
      </Grid>
    </Container>
  );
};

export default DoctorHome;
