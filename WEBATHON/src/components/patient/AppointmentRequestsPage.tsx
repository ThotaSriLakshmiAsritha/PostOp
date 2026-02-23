import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Container,
  List,
  ListItem,
  ListItemText,
  Paper,
  TextField,
  Typography,
  Chip,
} from '@mui/material';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import {
  createAppointmentRequest,
  buildGoogleCalendarUrl,
  respondToAppointmentRequest,
  subscribePatientAppointments,
  type AppointmentRequest,
} from '../../services/appointmentService';

const AppointmentRequestsPage: React.FC = () => {
  const { user } = useAuth();
  const { t, i18n } = useTranslation();
  const [doctorId, setDoctorId] = useState<string | null>(null);
  const [doctorEmail, setDoctorEmail] = useState<string | null>(null);
  const [proposedAt, setProposedAt] = useState('');
  const [note, setNote] = useState('');
  const [requests, setRequests] = useState<AppointmentRequest[]>([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    const load = async () => {
      if (!user?.uid) return;
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (!userDoc.exists()) return;
      const data: any = userDoc.data();
      setDoctorId(data?.doctor_id || null);
      setDoctorEmail(data?.doctor_email || null);
    };
    load().catch((e) => console.error(e));
  }, [user?.uid]);

  useEffect(() => {
    if (!user?.uid) return;
    const unsub = subscribePatientAppointments(
      user.uid,
      setRequests,
      (e) => {
        console.error(e);
        setError(t('failedLoadAppointmentRequests', 'Failed to load appointment requests'));
      }
    );
    return () => unsub();
  }, [user?.uid, t]);

  const onRequest = async () => {
    if (!user?.uid || !doctorId || !proposedAt) return;
    setError('');
    setSuccess('');
    try {
      await createAppointmentRequest({
        patientId: user.uid,
        doctorId,
        requestedBy: 'patient',
        proposedAt,
        note,
      });
      setSuccess(t('appointmentRequestSentToDoctor', 'Appointment request sent to doctor.'));
      setProposedAt('');
      setNote('');
    } catch (e: any) {
      setError(e?.message || t('failedCreateAppointmentRequest', 'Failed to create appointment request'));
    }
  };

  const onRespond = async (requestId: string, status: 'accepted' | 'rejected') => {
    setError('');
    setSuccess('');
    try {
      await respondToAppointmentRequest({ requestId, status });
      if (status === 'accepted') {
        const req = requests.find((r) => r.id === requestId);
        if (req?.proposedAt) {
          const url = buildGoogleCalendarUrl({
            title: t('doctorAppointmentForPatient', 'Doctor Appointment for Patient'),
            startAt: req.proposedAt,
            details: req.note || '',
          });
          window.open(url, '_blank');
        }
      }
      setSuccess(
        t('appointmentStatusUpdated', 'Appointment {{status}}.', {
          status:
            status === 'accepted'
              ? t('statusAccepted', 'Accepted')
              : t('statusRejected', 'Rejected'),
        })
      );
    } catch (e: any) {
      setError(e?.message || t('failedRespondAppointmentRequest', 'Failed to respond to appointment request'));
    }
  };

  const pendingFromDoctor = useMemo(
    () => requests.filter((r) => r.status === 'pending' && r.requestedBy === 'doctor'),
    [requests]
  );

  const statusLabel = (status: AppointmentRequest['status']) => {
    if (status === 'accepted') return t('statusAccepted', 'Accepted');
    if (status === 'rejected') return t('statusRejected', 'Rejected');
    return t('statusPending', 'Pending');
  };

  const requestedByLabel = (requestedBy: AppointmentRequest['requestedBy']) =>
    requestedBy === 'doctor'
      ? t('requestedByDoctor', 'Doctor')
      : t('requestedByPatient', 'Patient');

  return (
    <Container maxWidth="md">
      <Typography variant="h4" gutterBottom>
        {t('appointments', 'Appointments')}
      </Typography>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}

      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          {t('requestAppointment', 'Request Appointment')}
        </Typography>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          {t('assignedDoctor', 'Assigned doctor')}: {doctorEmail || doctorId || t('notMappedYet', 'Not mapped yet')}
        </Typography>
        <TextField
          fullWidth
          type="datetime-local"
          label={t('proposedDateTime', 'Proposed Date & Time')}
          value={proposedAt}
          onChange={(e) => setProposedAt(e.target.value)}
          margin="normal"
          InputLabelProps={{ shrink: true }}
        />
        <TextField
          fullWidth
          label={t('notes', 'Notes')}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          margin="normal"
          multiline
          rows={3}
        />
        <Button variant="contained" onClick={onRequest} disabled={!doctorId || !proposedAt}>
          {t('sendRequest', 'Send Request')}
        </Button>
      </Paper>

      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          {t('incomingRequestsFromDoctor', 'Incoming Requests From Doctor')}
        </Typography>
        {pendingFromDoctor.length === 0 ? (
          <Typography color="text.secondary">{t('noPendingRequestsFromDoctor', 'No pending requests from doctor.')}</Typography>
        ) : (
          <List>
            {pendingFromDoctor.map((r) => (
              <ListItem
                key={r.id}
                secondaryAction={
                  <Box display="flex" gap={1}>
                    <Button size="small" variant="contained" onClick={() => onRespond(r.id, 'accepted')}>
                      {t('accept', 'Accept')}
                    </Button>
                    <Button size="small" variant="outlined" onClick={() => onRespond(r.id, 'rejected')}>
                      {t('reject', 'Reject')}
                    </Button>
                  </Box>
                }
              >
                <ListItemText
                  primary={`${t('proposed', 'Proposed')}: ${new Date(r.proposedAt).toLocaleString(
                    i18n.language
                  )}`}
                  secondary={r.note || t('noNote', 'No note')}
                />
              </ListItem>
            ))}
          </List>
        )}
      </Paper>

      <Paper sx={{ p: 3, mt: 3 }}>
        <Typography variant="h6" gutterBottom>
          {t('allAppointmentRequests', 'All Appointment Requests')}
        </Typography>
        {requests.length === 0 ? (
          <Typography color="text.secondary">{t('noAppointmentRequestsYet', 'No appointment requests yet.')}</Typography>
        ) : (
          <List>
            {requests.map((r) => (
              <ListItem key={r.id}>
                <ListItemText
                  primary={`${new Date(r.proposedAt).toLocaleString(i18n.language)} (${requestedByLabel(
                    r.requestedBy
                  )})`}
                  secondary={r.note || t('noNote', 'No note')}
                />
                <Chip
                  label={statusLabel(r.status)}
                  color={r.status === 'accepted' ? 'success' : r.status === 'rejected' ? 'error' : 'warning'}
                  size="small"
                />
              </ListItem>
            ))}
          </List>
        )}
      </Paper>
    </Container>
  );
};

export default AppointmentRequestsPage;
