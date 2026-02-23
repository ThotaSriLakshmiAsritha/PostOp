import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Chip,
  Container,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import ChatIcon from '@mui/icons-material/Chat';
import VideoCallIcon from '@mui/icons-material/VideoCall';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { useDoctorPatients } from '../../hooks/useDoctorPatients';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { handleVideoCall } from '../../services/consultationService';

type ConsultationRisk = 'NORMAL' | 'WARNING' | 'CRITICAL';
type LogRiskMap = Record<string, { risk: ConsultationRisk; confidence: number; at: number }>;

const riskChip = (risk: ConsultationRisk, t: any) => {
  if (risk === 'CRITICAL') return <Chip label={t('critical', 'Critical')} color="error" size="small" />;
  if (risk === 'WARNING') return <Chip label={t('warning', 'Warning')} color="warning" size="small" />;
  return <Chip label={t('safe', 'Safe')} color="success" size="small" />;
};

const PatientList = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user } = useAuth();
  const [doctorId, setDoctorId] = useState<string | null>(null);
  const [doctorIdLoading, setDoctorIdLoading] = useState(true);
  const { patients, loading, error } = useDoctorPatients(doctorId, user?.email || null);
  const [latestRiskByPatientId, setLatestRiskByPatientId] = useState<LogRiskMap>({});
  const [riskLoading, setRiskLoading] = useState(true);
  const [startingVideoFor, setStartingVideoFor] = useState<string | null>(null);

  const normalizeRisk = (raw: unknown): ConsultationRisk => {
    const value = String(raw || '').trim().toUpperCase();
    if (value === 'RED' || value === 'CRITICAL') return 'CRITICAL';
    if (value === 'YELLOW' || value === 'WARNING') return 'WARNING';
    return 'NORMAL';
  };

  const toMillis = (value: any): number => {
    if (!value) return 0;
    if (typeof value?.toDate === 'function') return value.toDate().getTime();
    if (value?.seconds) return value.seconds * 1000;
    if (typeof value === 'number') return value;
    return 0;
  };

  const daysAfterSurgery = (patient: any): number | null => {
    const surgeryDateValue = patient?.surgeryDate || patient?.surgery_date || null;
    if (!surgeryDateValue) return null;
    let surgeryMillis = 0;
    if (typeof surgeryDateValue?.toDate === 'function') {
      surgeryMillis = surgeryDateValue.toDate().getTime();
    } else if (typeof surgeryDateValue === 'string') {
      surgeryMillis = new Date(`${surgeryDateValue}T00:00:00`).getTime();
    } else if (typeof surgeryDateValue === 'number') {
      surgeryMillis = surgeryDateValue;
    }
    if (!surgeryMillis || Number.isNaN(surgeryMillis)) return null;
    return Math.max(0, Math.floor((Date.now() - surgeryMillis) / (1000 * 60 * 60 * 24)));
  };

  useEffect(() => {
    const resolveDoctorId = async () => {
      try {
        if (!user?.uid) {
          setDoctorId(null);
          return;
        }

        // Preferred mapping: doctors doc id equals auth uid.
        // Fallback: locate doctor doc by login email.
        if (user.email) {
          const byEmail = query(
            collection(db, 'doctors'),
            where('email', '==', user.email)
          );
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

  useEffect(() => {
    const loadLatestRisk = async () => {
      try {
        setRiskLoading(true);
        if (patients.length === 0) {
          setLatestRiskByPatientId({});
          return;
        }

        const ids = Array.from(
          new Set(
            patients.flatMap((p: any) =>
              [p.userId, p.patient_id, p.id].filter(Boolean).map((v) => String(v))
            )
          )
        );
        if (ids.length === 0) {
          setLatestRiskByPatientId({});
          return;
        }

        const logsSnap = await getDocs(query(collection(db, 'symptom_logs'), where('patientId', 'in', ids.slice(0, 10))));
        // Firestore 'in' supports max 10 values; fallback for remaining ids.
        const allDocs = [...logsSnap.docs];
        for (let i = 10; i < ids.length; i += 10) {
          const chunk = ids.slice(i, i + 10);
          const chunkSnap = await getDocs(query(collection(db, 'symptom_logs'), where('patientId', 'in', chunk)));
          allDocs.push(...chunkSnap.docs);
        }

        const next: LogRiskMap = {};
        allDocs.forEach((d) => {
          const data = d.data() as any;
          const patientId = String(data?.patientId || '');
          if (!patientId) return;
          const at =
            toMillis(data?.createdAt) ||
            toMillis(data?.risk_assessed_at) ||
            toMillis(data?.createdAtClient);
          const risk = normalizeRisk(
            data?.risk || data?.rule_risk || data?.trend_risk || data?.risk_details?.risk
          );
          const confidence = Number(data?.confidence ?? 0);
          const prev = next[patientId];
          if (!prev || at > prev.at) {
            next[patientId] = { risk, confidence, at };
          }
        });
        setLatestRiskByPatientId(next);
      } catch (err) {
        console.error('Failed to load latest risks from logs:', err);
        setLatestRiskByPatientId({});
      } finally {
        setRiskLoading(false);
      }
    };

    loadLatestRisk();
  }, [patients]);

  const rows = useMemo(
    () =>
      patients.map((patient) => {
        const keys = [patient.userId, patient.patient_id, patient.id]
          .filter(Boolean)
          .map((v) => String(v));
        const fromLogs = keys
          .map((k) => latestRiskByPatientId[k])
          .find((x) => Boolean(x));

        const risk = (fromLogs?.risk || patient.latest_risk || 'NORMAL') as ConsultationRisk;
        const confidence = Number(fromLogs?.confidence ?? patient.latest_confidence ?? 0);
        return {
          ...patient,
          risk,
          confidence,
        };
      }),
    [patients, latestRiskByPatientId]
  );

  const onStartVideoCall = async (patientIdentifier: string) => {
    try {
      setStartingVideoFor(patientIdentifier);
      await handleVideoCall(patientIdentifier);
    } catch (error) {
      console.error('Failed to start video call:', error);
      alert(t('unableStartVideoCall', 'Unable to start video call.'));
    } finally {
      setStartingVideoFor(null);
    }
  };

  if (doctorIdLoading || loading || riskLoading) {
    return <Typography>{t('loadingPatients', 'Loading assigned patients...')}</Typography>;
  }

  return (
    <Container maxWidth="lg">
      <Typography variant="h4" gutterBottom>
        {t('assignedPatients', 'Assigned Patients')}
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 2 }}>
        {t(
          'assignedPatientsRealtime',
          'This list updates in real-time when new patients are registered for this doctor.'
        )}
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>{t('patientId', 'Patient ID')}</TableCell>
              <TableCell>{t('name', 'Name')}</TableCell>
              <TableCell>{t('hospitalId', 'Hospital ID')}</TableCell>
              <TableCell>{t('specialisation', 'Specialisation')}</TableCell>
              <TableCell>{t('daysAfterSurgery', 'Days After Surgery')}</TableCell>
              <TableCell>{t('risk', 'Risk')}</TableCell>
              <TableCell>{t('actions', 'Actions')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} align="center">
                  <Typography color="text.secondary">
                    {t('noAssignedPatientsYet', 'No assigned patients yet.')}
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              rows.map((patient) => (
                <TableRow key={patient.id} hover>
                  <TableCell>{patient.patient_id || patient.id}</TableCell>
                  <TableCell>{patient.name}</TableCell>
                  <TableCell>{patient.hospital_id}</TableCell>
                  <TableCell>{patient.surgery_type}</TableCell>
                  <TableCell>{daysAfterSurgery(patient) ?? t('na', 'N/A')}</TableCell>
                  <TableCell>{riskChip(patient.risk, t)}</TableCell>
                  <TableCell>
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => navigate(`/doctor/patients/${patient.id}`)}
                      sx={{ mr: 1 }}
                    >
                      {t('viewDetails', 'View Details')}
                    </Button>
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<ChatIcon />}
                      onClick={() => navigate(`/doctor/chat/${patient.patient_id || patient.id}`)}
                      sx={{ mr: 1 }}
                    >
                      {t('chat', 'Chat')}
                    </Button>
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<VideoCallIcon />}
                      onClick={() => onStartVideoCall(patient.patient_id || patient.id)}
                      sx={{ mr: 1 }}
                      disabled={startingVideoFor === (patient.patient_id || patient.id)}
                    >
                      {startingVideoFor === (patient.patient_id || patient.id)
                        ? t('startingVideoCall', 'Starting...')
                        : t('videoCall', 'Video Call')}
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Container>
  );
};

export default PatientList;
