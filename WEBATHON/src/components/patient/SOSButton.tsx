import { useState } from 'react';
import {
  Fab,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  List,
  ListItem,
  ListItemText,
  ListItemButton,
} from '@mui/material';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import PhoneIcon from '@mui/icons-material/Phone';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { useTranslation } from 'react-i18next';

const SOSButton = () => {
  const [open, setOpen] = useState(false);
  const { user } = useAuth();
  const { t } = useTranslation();

  const handleEmergency = async () => {
    if (!user) return;

    try {
      await addDoc(collection(db, 'alerts'), {
        patientId: user.uid,
        type: 'SOS',
        message: t('sosAlertMessage', 'Patient activated SOS emergency button'),
        risk: 'RED',
        acknowledged: false,
        createdAt: new Date(),
      });
      alert(t('emergencyAlertSent', 'Emergency alert sent to your doctor!'));
    } catch (error) {
      console.error('Error sending emergency alert:', error);
      alert(t('emergencyAlertFailed', 'Failed to send emergency alert. Please call your doctor directly.'));
    }
    setOpen(false);
  };

  return (
    <>
      <Fab
        color="error"
        aria-label="SOS"
        sx={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          zIndex: 1000,
        }}
        onClick={() => setOpen(true)}
      >
        <WarningAmberIcon />
      </Fab>

      <Dialog open={open} onClose={() => setOpen(false)}>
        <DialogTitle>{t('emergencyOptions', 'Emergency Options')}</DialogTitle>
        <DialogContent>
          <Typography variant="body1" gutterBottom>
            {t('chooseEmergencyAction', 'Choose an emergency action:')}
          </Typography>
          <List>
            <ListItem disablePadding>
                <ListItemButton onClick={handleEmergency}>
                <WarningAmberIcon sx={{ mr: 2 }} />
                <ListItemText primary={t('sendEmergencyAlert', 'Send Emergency Alert to Doctor')} />
              </ListItemButton>
            </ListItem>
            <ListItem disablePadding>
                <ListItemButton component="a" href="tel:+1234567890">
                <PhoneIcon sx={{ mr: 2 }} />
                <ListItemText primary={t('callDoctor', 'Call Doctor')} />
              </ListItemButton>
            </ListItem>
            <ListItem disablePadding>
                <ListItemButton component="a" href="tel:+1234567890">
                <PhoneIcon sx={{ mr: 2 }} />
                <ListItemText primary={t('callCaregiver', 'Call Caregiver')} />
              </ListItemButton>
            </ListItem>
          </List>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>{t('cancel', 'Cancel')}</Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default SOSButton;
