import { useEffect, useMemo, useState } from 'react';
import {
  Container,
  Paper,
  Typography,
  Button,
  Box,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  Chip,
  Grid,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { collection, query, where, getDocs, addDoc, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { createGoogleCalendarEvent } from '../../utils/googleCalendar';

interface Reminder {
  id: string;
  title: string;
  time: string;
  repeat: 'daily' | 'custom';
  enabled: boolean;
  type: 'antibiotic' | 'pain_med' | 'dressing' | 'logging' | 'custom' | 'appointment';
  ownerId?: string;
  ownerRole?: 'patient' | 'doctor';
  message?: string;
  scheduledAt?: string;
  createdAt?: any;
  googleCalendarUrl?: string;
}

const dateKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

const parseReminderDate = (r: Reminder): Date | null => {
  if (r.scheduledAt) {
    const d = new Date(r.scheduledAt);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (r.createdAt?.seconds) {
    return new Date(r.createdAt.seconds * 1000);
  }
  return null;
};

const weekLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const RemindersPage = () => {
  const { user } = useAuth();
  const { t, i18n } = useTranslation();
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [open, setOpen] = useState(false);
  const [editingReminder, setEditingReminder] = useState<Reminder | null>(null);
  const [title, setTitle] = useState('');
  const [time, setTime] = useState('09:00');
  const [repeat, setRepeat] = useState<'daily' | 'custom'>('daily');
  const [type, setType] = useState<'antibiotic' | 'pain_med' | 'dressing' | 'logging' | 'custom'>('custom');
  const [monthCursor, setMonthCursor] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  useEffect(() => {
    if (user) {
      loadReminders();
    }
  }, [user]);

  const loadReminders = async () => {
    if (!user) return;
    try {
      const remindersRef = collection(db, 'reminders');
      const ownerSnapshot = await getDocs(query(remindersRef, where('ownerId', '==', user.uid)));
      const legacySnapshot = await getDocs(query(remindersRef, where('patientId', '==', user.uid)));
      const merged = [...ownerSnapshot.docs, ...legacySnapshot.docs];

      const byId = new Map<string, Reminder>();
      merged.forEach((d) => byId.set(d.id, { id: d.id, ...(d.data() as any) } as Reminder));

      const filtered = Array.from(byId.values()).filter((row) => {
        if (row.ownerId) return row.ownerId === user.uid && (row.ownerRole || 'patient') === 'patient';
        return (row as any).patientId === user.uid && !row.ownerRole;
      });

      filtered.sort((a, b) => {
        const ta = a.scheduledAt ? Date.parse(a.scheduledAt) : (a.createdAt?.seconds ? a.createdAt.seconds * 1000 : 0);
        const tb = b.scheduledAt ? Date.parse(b.scheduledAt) : (b.createdAt?.seconds ? b.createdAt.seconds * 1000 : 0);
        return tb - ta;
      });

      setReminders(filtered);
    } catch (error) {
      console.error('Error loading reminders:', error);
    }
  };

  const handleOpen = (reminder?: Reminder) => {
    if (reminder) {
      setEditingReminder(reminder);
      setTitle(reminder.title);
      setTime(reminder.time);
      setRepeat(reminder.repeat);
      setType(reminder.type === 'appointment' ? 'custom' : reminder.type);
    } else {
      setEditingReminder(null);
      setTitle('');
      setTime('09:00');
      setRepeat('daily');
      setType('custom');
    }
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    setEditingReminder(null);
  };

  const handleSave = async () => {
    if (!user) return;
    try {
      const reminderData = {
        patientId: user.uid,
        ownerId: user.uid,
        ownerRole: 'patient',
        title,
        time,
        repeat,
        type,
        enabled: true,
        createdAt: new Date(),
      };

      if (editingReminder) {
        await updateDoc(doc(db, 'reminders', editingReminder.id), reminderData);
      } else {
        await addDoc(collection(db, 'reminders'), reminderData);
      }
      await loadReminders();
      handleClose();
    } catch (error) {
      console.error('Error saving reminder:', error);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'reminders', id));
      await loadReminders();
    } catch (error) {
      console.error('Error deleting reminder:', error);
    }
  };

  const handleToggle = async (reminder: Reminder) => {
    try {
      await updateDoc(doc(db, 'reminders', reminder.id), { enabled: !reminder.enabled });
      await loadReminders();
    } catch (error) {
      console.error('Error toggling reminder:', error);
    }
  };

  const syncToCalendar = async (reminder: Reminder) => {
    if (reminder.googleCalendarUrl) {
      window.open(reminder.googleCalendarUrl, '_blank');
      return;
    }

    const startDate = reminder.scheduledAt ? new Date(reminder.scheduledAt) : new Date();
    if (!reminder.scheduledAt) {
      startDate.setHours(parseInt(reminder.time.split(':')[0]), parseInt(reminder.time.split(':')[1]));
    }
    const endDate = new Date(startDate);
    endDate.setHours(endDate.getHours() + 1);

    try {
      await createGoogleCalendarEvent({
        title: reminder.title,
        start: startDate,
        end: endDate,
        description: reminder.message || '',
        recurrence:
          reminder.repeat === 'daily' && reminder.type !== 'appointment'
            ? ['RRULE:FREQ=DAILY']
            : undefined,
      });
      alert(t('scheduledInGoogleCalendar', 'Scheduled directly in Google Calendar.'));
      return;
    } catch (err) {
      console.error('Direct Google Calendar scheduling failed, falling back to link:', err);
    }

    const recurrence = reminder.repeat === 'daily' && reminder.type !== 'appointment' ? '&recur=DAILY' : '';
    const googleCalendarUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(reminder.title)}&dates=${startDate.toISOString().replace(/[-:]/g, '').split('.')[0]}Z/${endDate.toISOString().replace(/[-:]/g, '').split('.')[0]}Z${recurrence}&details=${encodeURIComponent(reminder.message || '')}`;
    window.open(googleCalendarUrl, '_blank');
  };

  const monthDays = useMemo(() => {
    const year = monthCursor.getFullYear();
    const month = monthCursor.getMonth();
    const first = new Date(year, month, 1);
    const last = new Date(year, month + 1, 0);
    const items: (Date | null)[] = [];
    for (let i = 0; i < first.getDay(); i += 1) items.push(null);
    for (let d = 1; d <= last.getDate(); d += 1) items.push(new Date(year, month, d));
    return items;
  }, [monthCursor]);

  const remindersByDate = useMemo(() => {
    const map = new Map<string, Reminder[]>();
    reminders.forEach((r) => {
      if (r.repeat === 'daily') return;
      const d = parseReminderDate(r);
      if (!d) return;
      const key = dateKey(d);
      const current = map.get(key) || [];
      current.push(r);
      map.set(key, current);
    });
    return map;
  }, [reminders]);

  const selectedDateReminders = useMemo(() => {
    const specific = remindersByDate.get(dateKey(selectedDate)) || [];
    const daily = reminders.filter((r) => r.repeat === 'daily');
    return [...specific, ...daily];
  }, [remindersByDate, reminders, selectedDate]);

  const localizedWeekLabels = useMemo(
    () =>
      weekLabels.map((_, idx) =>
        new Date(2024, 0, 7 + idx).toLocaleDateString(i18n.language, { weekday: 'short' })
      ),
    [i18n.language]
  );

  return (
    <Container maxWidth="lg">
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">{t('medicationReminders', 'Medication & Care Reminders')}</Typography>
        <Box display="flex" gap={1}>
          <Button variant="outlined" onClick={() => window.open('https://calendar.google.com/calendar/u/0/r', '_blank')}>
            {t('openCalendar', 'Open Calendar')}
          </Button>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpen()}>
            {t('addReminder', 'Add Reminder')}
          </Button>
        </Box>
      </Box>

      <Paper sx={{ p: 2, mb: 3 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <IconButton onClick={() => setMonthCursor(new Date(monthCursor.getFullYear(), monthCursor.getMonth() - 1, 1))}>
            <ChevronLeftIcon />
          </IconButton>
          <Typography variant="h6">
            {monthCursor.toLocaleDateString(i18n.language, { month: 'long', year: 'numeric' })}
          </Typography>
          <IconButton onClick={() => setMonthCursor(new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 1))}>
            <ChevronRightIcon />
          </IconButton>
        </Box>

        <Grid container columns={7} spacing={1}>
          {localizedWeekLabels.map((w) => (
            <Grid item xs={1} key={w}>
              <Typography variant="caption" color="text.secondary">{w}</Typography>
            </Grid>
          ))}
          {monthDays.map((d, idx) => {
            if (!d) {
              return <Grid item xs={1} key={`empty-${idx}`}><Box sx={{ height: 72 }} /></Grid>;
            }
            const isSelected = dateKey(d) === dateKey(selectedDate);
            const count = (remindersByDate.get(dateKey(d))?.length || 0) + reminders.filter((r) => r.repeat === 'daily').length;
            return (
              <Grid item xs={1} key={dateKey(d)}>
                <Button
                  variant={isSelected ? 'contained' : 'outlined'}
                  fullWidth
                  onClick={() => setSelectedDate(d)}
                  sx={{ height: 72, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}
                >
                  <span>{d.getDate()}</span>
                  {count > 0 && <Chip size="small" label={count} sx={{ mt: 0.5 }} />}
                </Button>
              </Grid>
            );
          })}
        </Grid>
      </Paper>

      <Paper>
        <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
          <Typography variant="h6">
            {t('remindersOnDate', 'Reminders on {{date}}', {
              date: selectedDate.toLocaleDateString(i18n.language),
            })}
          </Typography>
        </Box>
        <List>
          {selectedDateReminders.length === 0 ? (
            <ListItem>
              <ListItemText
                primary={t('noRemindersForDate', 'No reminders for this date.')}
              />
            </ListItem>
          ) : (
            selectedDateReminders.map((reminder) => (
              <ListItem key={reminder.id}>
                <ListItemText
                  primary={
                    <Box display="flex" alignItems="center" gap={1}>
                      {reminder.title}
                      <Chip label={reminder.type} size="small" />
                      {reminder.type === 'appointment' && (
                        <Chip
                          label={t('confirmed', 'Confirmed')}
                          size="small"
                          color="success"
                        />
                      )}
                      {!reminder.enabled && <Chip label={t('disabled', 'Disabled')} size="small" color="default" />}
                    </Box>
                  }
                  secondary={`${t('time', 'Time')}: ${reminder.time} | ${t('repeat', 'Repeat')}: ${reminder.repeat === 'daily' ? t('daily', 'Daily') : t('custom', 'Custom')}${reminder.message ? ` | ${reminder.message}` : ''}`}
                />
                <ListItemSecondaryAction>
                  <Button size="small" onClick={() => syncToCalendar(reminder)} sx={{ mr: 1 }}>
                    {t('addToCalendar', 'Add to Calendar')}
                  </Button>
                  {reminder.type !== 'appointment' && (
                    <IconButton edge="end" onClick={() => handleToggle(reminder)}>
                      <Switch checked={reminder.enabled} />
                    </IconButton>
                  )}
                  <IconButton edge="end" onClick={() => handleOpen(reminder)} disabled={reminder.type === 'appointment'}>
                    <EditIcon />
                  </IconButton>
                  <IconButton edge="end" onClick={() => handleDelete(reminder.id)} disabled={reminder.type === 'appointment'}>
                    <DeleteIcon />
                  </IconButton>
                </ListItemSecondaryAction>
              </ListItem>
            ))
          )}
        </List>
      </Paper>

      <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
        <DialogTitle>{editingReminder ? t('editReminder', 'Edit Reminder') : t('addReminder', 'Add Reminder')}</DialogTitle>
        <DialogContent>
          <FormControl fullWidth margin="normal">
            <InputLabel>{t('reminderType', 'Reminder Type')}</InputLabel>
            <Select value={type} onChange={(e) => setType(e.target.value as any)}>
              <MenuItem value="antibiotic">{t('antibiotic', 'Antibiotic')}</MenuItem>
              <MenuItem value="pain_med">{t('painMedication', 'Pain Medication')}</MenuItem>
              <MenuItem value="dressing">{t('dressingChange', 'Dressing Change')}</MenuItem>
              <MenuItem value="logging">{t('dailyLogging', 'Daily Logging')}</MenuItem>
              <MenuItem value="custom">{t('custom', 'Custom')}</MenuItem>
            </Select>
          </FormControl>
          <TextField fullWidth label={t('title', 'Title')} value={title} onChange={(e) => setTitle(e.target.value)} margin="normal" required />
          <TextField fullWidth label={t('time', 'Time')} type="time" value={time} onChange={(e) => setTime(e.target.value)} margin="normal" InputLabelProps={{ shrink: true }} required />
          <FormControl fullWidth margin="normal">
            <InputLabel>{t('repeat', 'Repeat')}</InputLabel>
            <Select value={repeat} onChange={(e) => setRepeat(e.target.value as 'daily' | 'custom')}>
              <MenuItem value="daily">{t('daily', 'Daily')}</MenuItem>
              <MenuItem value="custom">{t('custom', 'Custom')}</MenuItem>
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>{t('cancel', 'Cancel')}</Button>
          <Button onClick={handleSave} variant="contained">
            {t('save', 'Save')}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default RemindersPage;
