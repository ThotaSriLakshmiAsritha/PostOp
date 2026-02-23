import React, { useEffect, useState } from 'react';
import { Container, Paper, Typography, TextField, Button, Box, MenuItem } from '@mui/material';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { HOSPITAL_ID_OPTIONS, SURGERY_TYPE_OPTIONS } from '../../constants/medicalOptions';
import { upsertDoctorProfile } from '../../services/profileService';

const DoctorSettings: React.FC = () => {
  const { user } = useAuth();
  const [meetLink, setMeetLink] = useState('');
  const [hospitalId, setHospitalId] = useState('');
  const [surgeryType, setSurgeryType] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const { t } = useTranslation();

  useEffect(() => {
    (async () => {
      if (!user) return;
      try {
        const userRef = doc(db, 'users', user.uid);
        const userDoc = await getDoc(userRef);
        if (userDoc.exists()) {
          const data: any = userDoc.data();
          if (data?.meetLink) setMeetLink(data.meetLink);
          if (data?.hospital_id) setHospitalId(String(data.hospital_id));
          if (data?.surgery_type) setSurgeryType(String(data.surgery_type));
          if (data?.phone) setPhone(String(data.phone));
        }
      } catch (err) {
        console.error('Error loading profile:', err);
      }
    })();
  }, [user]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      await upsertDoctorProfile({
        uid: user.uid,
        name: user.name || 'Doctor',
        email: user.email || '',
        hospital_id: hospitalId,
        surgery_type: surgeryType,
        meetLink,
        phone,
      });
      alert(t('meetingLinkSaved', 'Meeting link saved.'));
    } catch (err) {
      console.error('Error saving meet link:', err);
      alert(t('meetingLinkSaveFailed', 'Failed to save meeting link.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Container maxWidth="sm">
      <Paper sx={{ p: 3 }}>
        <Typography variant="h5" gutterBottom>
          {t('doctorSettings', 'Doctor Settings')}
        </Typography>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          {t('configureMeetingLink', 'Configure your video meeting link (Google Meet / Zoom / other).')}
        </Typography>
        <TextField
          label={t('meetingLink', 'Meeting Link')}
          placeholder={t('meetingLinkPlaceholder', 'https://meet.google.com/xxx-xxxx-xxx')}
          fullWidth
          value={meetLink}
          onChange={(e) => setMeetLink(e.target.value)}
          margin="normal"
        />
        <TextField
          label={t('phone', 'Phone')}
          fullWidth
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          margin="normal"
        />
        <TextField
          select
          label={t('hospitalId', 'Hospital ID')}
          fullWidth
          value={hospitalId}
          onChange={(e) => setHospitalId(e.target.value)}
          margin="normal"
        >
          {HOSPITAL_ID_OPTIONS.map((id) => (
            <MenuItem key={id} value={id}>
              {id}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          label={t('specialisation', 'Specialisation')}
          fullWidth
          value={surgeryType}
          onChange={(e) => setSurgeryType(e.target.value)}
          margin="normal"
        >
          {SURGERY_TYPE_OPTIONS.map((type) => (
            <MenuItem key={type} value={type}>
              {type}
            </MenuItem>
          ))}
        </TextField>
        <Box mt={2} display="flex" justifyContent="flex-end">
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={saving || !meetLink.trim() || !hospitalId || !surgeryType}
          >
            {t('save', 'Save')}
          </Button>
        </Box>
      </Paper>
    </Container>
  );
};

export default DoctorSettings;
