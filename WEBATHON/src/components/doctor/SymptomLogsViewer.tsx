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
  Button,
  Chip,
} from '@mui/material';
import ChatIcon from '@mui/icons-material/Chat';
import { collection, query, orderBy, limit, getDocs, doc, getDoc, where } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';

const SymptomLogsViewer: React.FC = () => {
  const { user } = useAuth();
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
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
    const loadLogs = async () => {
      setLoading(true);
      try {
        if (!user?.uid) {
          setLogs([]);
          return;
        }

        let resolvedDoctorId = user.uid;
        if (user.email) {
          const doctorByEmailSnap = await getDocs(
            query(collection(db, 'doctors'), where('email', '==', user.email), limit(1))
          );
          if (!doctorByEmailSnap.empty) {
            resolvedDoctorId = doctorByEmailSnap.docs[0].id;
          }
        }

        const assignedPatientsSnap = await getDocs(
          query(collection(db, 'patients'), where('doctor_id', '==', resolvedDoctorId), limit(500))
        );
        const assignedPatientKeys = new Set<string>();
        assignedPatientsSnap.docs.forEach((patientDoc) => {
          const data = patientDoc.data() as any;
          assignedPatientKeys.add(patientDoc.id);
          if (data?.patient_id) assignedPatientKeys.add(String(data.patient_id));
          if (data?.userId) assignedPatientKeys.add(String(data.userId));
        });

        if (assignedPatientKeys.size === 0) {
          setLogs([]);
          return;
        }

        const q = query(collection(db, 'symptom_logs'), orderBy('createdAt', 'desc'), limit(100));
        const snap = await getDocs(q);
        const rows: any[] = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        const assignedRows = rows.filter((row) =>
          assignedPatientKeys.has(String(row.patientId || ''))
        );

        // Resolve assigned doctor for each log by looking up patient -> doctor -> user
        const resolved = await Promise.all(assignedRows.map(async (r) => {
          try {
            // Try patient doc by id
            let patientDoc = await getDoc(doc(db, 'patients', r.patientId));
            if (!patientDoc.exists()) {
              // Fall back to query by userId
              const patientsQuery = query(collection(db, 'patients'), where('userId', '==', r.patientId));
              const patientsSnap = await getDocs(patientsQuery);
              if (!patientsSnap.empty) patientDoc = patientsSnap.docs[0];
            }

            const patientData: any = patientDoc?.exists() ? patientDoc.data() : null;
            const doctorId = patientData?.doctorId || patientData?.assignedDoctorId || null;

            let doctorUser: any = null;
            if (doctorId) {
              const doctorDoc = await getDoc(doc(db, 'users', doctorId));
              if (doctorDoc.exists()) doctorUser = doctorDoc.data();
            }

            return { ...r, _patient: patientData, _doctor: doctorUser };
          } catch (err) {
            console.error('Error resolving patient/doctor for log', r.id, err);
            return { ...r, _patient: null, _doctor: null };
          }
        }));

        setLogs(resolved);
      } catch (err) {
        console.error('Error loading symptom logs:', err);
      } finally {
        setLoading(false);
      }
    };

    loadLogs();
  }, [user?.uid, user?.email]);

  const formatDate = (ts: any) => {
    if (!ts) return '';
    if (typeof ts.toDate === 'function') return ts.toDate().toLocaleString(i18n.language);
    if (ts.seconds) return new Date(ts.seconds * 1000).toLocaleString(i18n.language);
    return String(ts);
  };

  return (
    <Container maxWidth="lg">
      <Typography variant="h4" gutterBottom>
        {t('logs', 'Symptom Logs')}
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
                  <TableCell>{t('patientId', 'Patient ID')}</TableCell>
                  <TableCell>{t('patientName', 'Patient Name')}</TableCell>
                  <TableCell>{t('doctor', 'Assigned Doctor')}</TableCell>
                  <TableCell>{t('daysAfterSurgery', 'Days After Surgery')}</TableCell>
                  <TableCell>{t('pain', 'Pain')}</TableCell>
                  <TableCell>{t('temp', 'Temp')}</TableCell>
                  <TableCell>{t('risk', 'Risk')}</TableCell>
                  <TableCell>{t('actions', 'Actions')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id} hover>
                    <TableCell>{formatDate(log.createdAt)}</TableCell>
                    <TableCell>{log.patientId}</TableCell>
                    <TableCell>{log._patient?.name ?? '-'}</TableCell>
                    <TableCell>{log._doctor ? `${log._doctor.name || ''} ${log._doctor.email ? `<${log._doctor.email}>` : ''}` : '-'}</TableCell>
                    <TableCell>{log.days_after_surgery ?? '-'}</TableCell>
                    <TableCell>{log.pain_score ?? '-'}</TableCell>
                    <TableCell>{log.temperature ?? '-'}</TableCell>
                    <TableCell>{getRiskChip(log.risk)}</TableCell>
                    <TableCell>
                      <Button size="small" onClick={() => navigate(`/doctor/patients/${log.patientId}`)}>
                        {t('viewPatient', 'View Patient')}
                      </Button>
                      <Button
                        size="small"
                        startIcon={<ChatIcon />}
                        onClick={() => navigate(`/doctor/chat/${log.patientId}`)}
                      >
                        {t('chat', 'Chat')}
                      </Button>
                    </TableCell>
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

export default SymptomLogsViewer;
