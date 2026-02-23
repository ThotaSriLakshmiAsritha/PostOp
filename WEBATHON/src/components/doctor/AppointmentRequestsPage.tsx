import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Container,
  List,
  ListItem,
  ListItemText,
  MenuItem,
  Paper,
  TextField,
  Typography,
  Chip,
} from '@mui/material';
import { useAuth } from '../../contexts/AuthContext';
import { useDoctorPatients } from '../../hooks/useDoctorPatients';
import { useTranslation } from 'react-i18next';
import {
  createAppointmentRequest,
  buildGoogleCalendarUrl,
  respondToAppointmentRequest,
  subscribeDoctorAppointments,
  type AppointmentRequest,
} from '../../services/appointmentService';

const AppointmentRequestsPage: React.FC = () => {
  const { user } = useAuth();
  const { t, i18n } = useTranslation();
  const { patients } = useDoctorPatients(user?.uid || null, user?.email || null);
  const [patientId, setPatientId] = useState('');
  const [proposedAt, setProposedAt] = useState('');
  const [note, setNote] = useState('');
  const [requests, setRequests] = useState<AppointmentRequest[]>([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (!user?.uid) return;
    const unsub = subscribeDoctorAppointments(
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
    if (!user?.uid || !patientId || !proposedAt) return;
    setError('');
    setSuccess('');
    try {
      await createAppointmentRequest({
        patientId,
        doctorId: user.uid,
        requestedBy: 'doctor',
        proposedAt,
        note,
      });
      setSuccess(t('appointmentRequestSentToPatient', 'Appointment request sent to patient.'));
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

  const pendingFromPatient = useMemo(
    () => requests.filter((r) => r.status === 'pending' && r.requestedBy === 'patient'),
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
        {t('appointmentRequests', 'Appointment Requests')}
      </Typography>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}

      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          {t('requestAppointmentFromDoctor', 'Request Appointment From Doctor Side')}
        </Typography>
        <TextField
          fullWidth
          select
          label={t('patient', 'Patient')}
          value={patientId}
          onChange={(e) => setPatientId(e.target.value)}
          margin="normal"
        >
          {patients.map((p) => (
            <MenuItem key={p.patient_id || p.id} value={p.patient_id || p.id}>
              {p.name} ({p.patient_id || p.id})
            </MenuItem>
          ))}
        </TextField>
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
        <Button variant="contained" onClick={onRequest} disabled={!patientId || !proposedAt}>
          {t('sendRequest', 'Send Request')}
        </Button>
      </Paper>

      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          {t('incomingRequestsFromPatients', 'Incoming Requests From Patients')}
        </Typography>
        {pendingFromPatient.length === 0 ? (
          <Typography color="text.secondary">
            {t('noPendingRequestsFromPatients', 'No pending requests from patients.')}
          </Typography>
        ) : (
          <List>
            {pendingFromPatient.map((r) => (
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
                  primary={`${t('patient', 'Patient')} ${r.patientId} - ${new Date(r.proposedAt).toLocaleString(i18n.language)}`}
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
                  primary={`${new Date(r.proposedAt).toLocaleString(i18n.language)} - ${t('patient', 'Patient')} ${r.patientId}`}
                  secondary={`${requestedByLabel(r.requestedBy)} - ${r.note || t('noNote', 'No note')}`}
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

