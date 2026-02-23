import { useEffect, useState } from 'react';
import { Container, Paper, Typography, List, ListItem, ListItemText, Chip, Box, Button } from '@mui/material';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { createGoogleCalendarEvent } from '../../utils/googleCalendar';
import { useTranslation } from 'react-i18next';

interface ReminderRow {
  id: string;
  title: string;
  time: string;
  repeat: string;
  type: string;
  message?: string;
  patientId?: string;
  googleCalendarUrl?: string;
  scheduledAt?: string;
}

const DoctorRemindersPage: React.FC = () => {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [rows, setRows] = useState<ReminderRow[]>([]);

  useEffect(() => {
    const load = async () => {
      if (!user?.uid) return;
      const snap = await getDocs(query(collection(db, 'reminders'), where('ownerId', '==', user.uid)));
      const r = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as ReminderRow[];
      setRows(r);
    };
    load().catch((e) => console.error('Error loading doctor reminders', e));
  }, [user?.uid]);

  const onAddToCalendar = async (r: ReminderRow) => {
    if (r.googleCalendarUrl) {
      window.open(r.googleCalendarUrl, '_blank');
      return;
    }

    const startDate = r.scheduledAt ? new Date(r.scheduledAt) : new Date();
    if (!r.scheduledAt && r.time) {
      const [hh, mm] = r.time.split(':').map((v) => parseInt(v, 10));
      if (!Number.isNaN(hh) && !Number.isNaN(mm)) {
        startDate.setHours(hh, mm, 0, 0);
      }
    }
    const endDate = new Date(startDate);
    endDate.setHours(endDate.getHours() + 1);

    try {
      await createGoogleCalendarEvent({
        title: r.title,
        start: startDate,
        end: endDate,
        description: r.message || '',
      });
      alert(t('scheduledInGoogleCalendar', 'Scheduled directly in Google Calendar.'));
    } catch (err) {
      console.error('Direct Google Calendar scheduling failed:', err);
      const fallbackUrl =
        `https://calendar.google.com/calendar/render?action=TEMPLATE` +
        `&text=${encodeURIComponent(r.title)}` +
        `&dates=${startDate.toISOString().replace(/[-:]/g, '').split('.')[0]}Z/${endDate.toISOString().replace(/[-:]/g, '').split('.')[0]}Z` +
        `&details=${encodeURIComponent(r.message || '')}`;
      window.open(fallbackUrl, '_blank');
    }
  };

  return (
    <Container maxWidth="md">
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h4">{t('reminders', 'Reminders')}</Typography>
        <Button variant="outlined" onClick={() => window.open('https://calendar.google.com/calendar/u/0/r', '_blank')}>
          {t('openCalendar', 'Open Calendar')}
        </Button>
      </Box>
      <Paper>
        <List>
          {rows.length === 0 ? (
            <ListItem>
              <ListItemText primary={t('noReminders', 'No reminders yet.')} />
            </ListItem>
          ) : (
            rows.map((r) => (
                <ListItem key={r.id}>
                <ListItemText
                  primary={`${r.title} (${r.time})`}
                  secondary={`${r.repeat}${r.patientId ? ` • ${t('patient', 'Patient')} ${r.patientId}` : ''}${r.message ? ` • ${r.message}` : ''}`}
                />
                {(r.googleCalendarUrl || r.time || r.scheduledAt) && (
                  <Button size="small" onClick={() => onAddToCalendar(r)} sx={{ mr: 1 }}>
                    {t('addToCalendar', 'Add to Calendar')}
                  </Button>
                )}
                <Chip label={r.type} size="small" />
              </ListItem>
            ))
          )}
        </List>
      </Paper>
    </Container>
  );
};

export default DoctorRemindersPage;
