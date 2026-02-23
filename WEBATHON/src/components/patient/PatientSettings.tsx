import { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Container,
  MenuItem,
  Paper,
  TextField,
  Typography,
} from '@mui/material';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore';
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from 'firebase/auth';
import { useTranslation } from 'react-i18next';
import { auth, db } from '../../config/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { HOSPITAL_ID_OPTIONS, SURGERY_TYPE_OPTIONS } from '../../constants/medicalOptions';
import { upsertPatientProfile } from '../../services/profileService';

const PatientSettings: React.FC = () => {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [hospitalId, setHospitalId] = useState('');
  const [surgeryType, setSurgeryType] = useState('');
  const [phone, setPhone] = useState('');
  const [emergencyContact, setEmergencyContact] = useState('');
  const [assignedDoctor, setAssignedDoctor] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  useEffect(() => {
    const loadProfile = async () => {
      if (!user?.uid) return;
      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (!userDoc.exists()) return;
        const data: any = userDoc.data();
        setName(data?.name || user.name || '');
        setHospitalId(data?.hospital_id || '');
        setSurgeryType(data?.surgery_type || '');
        setPhone(data?.phone || '');
        setEmergencyContact(data?.emergency_contact || '');
        setAssignedDoctor(data?.doctor_email || '');
      } catch (e) {
        console.error('Failed to load patient profile:', e);
      }
    };
    loadProfile();
  }, [user?.uid, user?.name]);

  const onSave = async () => {
    if (!user?.uid || !user?.email) return;
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const mappedDoctor = await upsertPatientProfile({
        uid: user.uid,
        name: name || user.name || t('patientFallback', 'Patient'),
        email: user.email,
        hospital_id: hospitalId,
        surgery_type: surgeryType,
        phone,
        emergency_contact: emergencyContact,
      });
      setAssignedDoctor(mappedDoctor?.email || '');
      setSuccess(
        mappedDoctor
          ? t('profileSavedAssignedDoctor', 'Profile saved. Assigned doctor: {{doctor}}', {
              doctor: mappedDoctor.name || mappedDoctor.email || mappedDoctor.id,
            })
          : t(
              'profileSavedNoDoctor',
              'Profile saved. No matching doctor found yet for selected hospital and specialisation.'
            )
      );
    } catch (e: any) {
      setError(e?.message || t('failedSaveProfile', 'Failed to save profile.'));
    } finally {
      setSaving(false);
    }
  };

  const onChangePassword = async () => {
    setPasswordError('');
    setPasswordSuccess('');

    if (!user?.email) {
      setPasswordError(t('userEmailUnavailable', 'User email not available.'));
      return;
    }
    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError(
        t('fillPasswordFields', 'Please fill current password and new password fields.')
      );
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError(t('newPasswordMinLength', 'New password must be at least 8 characters.'));
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError(
        t('passwordMismatch', 'New password and confirm password do not match.')
      );
      return;
    }

    try {
      setChangingPassword(true);
      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error(t('noAuthenticatedUser', 'No authenticated user found.'));
      }

      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(currentUser, credential);
      await updatePassword(currentUser, newPassword);

      const passwordUpdatePayload = {
        temporary_password_changed: true,
        password_changed_at: serverTimestamp(),
        updated_at: serverTimestamp(),
      };

      await setDoc(doc(db, 'users', user.uid), passwordUpdatePayload, { merge: true });

      const patientsSnap = await getDocs(
        query(collection(db, 'patients'), where('userId', '==', user.uid))
      );
      if (!patientsSnap.empty) {
        await Promise.all(
          patientsSnap.docs.map((patientDoc) =>
            setDoc(doc(db, 'patients', patientDoc.id), passwordUpdatePayload, { merge: true })
          )
        );
      } else {
        await setDoc(doc(db, 'patients', user.uid), passwordUpdatePayload, { merge: true });
      }

      setPasswordSuccess(t('passwordUpdatedSuccessfully', 'Password updated successfully.'));
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (e: any) {
      const code = e?.code || '';
      if (code === 'auth/invalid-credential' || code === 'auth/wrong-password') {
        setPasswordError(t('currentPasswordIncorrect', 'Current password is incorrect.'));
      } else if (code === 'auth/too-many-requests') {
        setPasswordError(t('tooManyAttemptsLater', 'Too many attempts. Please try again later.'));
      } else {
        setPasswordError(e?.message || t('failedUpdatePassword', 'Failed to update password.'));
      }
    } finally {
      setChangingPassword(false);
    }
  };

  return (
    <Container maxWidth="sm">
      <Paper sx={{ p: 3 }}>
        <Typography variant="h5" gutterBottom>
          {t('patientProfile', 'Patient Profile')}
        </Typography>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          {t(
            'completeProfileForMapping',
            'Complete your profile to map your assigned doctor and enable consultation/chat flow.'
          )}
        </Typography>

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}

        <TextField
          fullWidth
          label={t('fullName', 'Full Name')}
          value={name}
          onChange={(e) => setName(e.target.value)}
          margin="normal"
          required
        />
        <TextField
          fullWidth
          select
          label={t('hospitalId', 'Hospital ID')}
          value={hospitalId}
          onChange={(e) => setHospitalId(e.target.value)}
          margin="normal"
          required
        >
          {HOSPITAL_ID_OPTIONS.map((id) => (
            <MenuItem key={id} value={id}>
              {id}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          fullWidth
          select
          label={t('specialisation', 'Specialisation')}
          value={surgeryType}
          onChange={(e) => setSurgeryType(e.target.value)}
          margin="normal"
          required
        >
          {SURGERY_TYPE_OPTIONS.map((type) => (
            <MenuItem key={type} value={type}>
              {type}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          fullWidth
          label={t('phone', 'Phone')}
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          margin="normal"
        />
        <TextField
          fullWidth
          label={t('emergencyContact', 'Emergency Contact')}
          value={emergencyContact}
          onChange={(e) => setEmergencyContact(e.target.value)}
          margin="normal"
        />

        <Box sx={{ mt: 2 }}>
          <Typography variant="body2" color="text.secondary">
            {t('assignedDoctor', 'Assigned doctor')}: {assignedDoctor || t('notAssignedYet', 'Not assigned yet')}
          </Typography>
        </Box>

        <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
          <Button
            variant="contained"
            onClick={onSave}
            disabled={saving || !name || !hospitalId || !surgeryType}
          >
            {t('saveProfile', 'Save Profile')}
          </Button>
        </Box>

        <Box sx={{ mt: 4 }}>
          <Typography variant="h6" gutterBottom>
            {t('changeTemporaryPassword', 'Change Temporary Password')}
          </Typography>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            {t(
              'updateTemporaryPasswordAfterFirstLogin',
              'Update your temporary password after first login.'
            )}
          </Typography>
          {passwordError && <Alert severity="error" sx={{ mb: 2 }}>{passwordError}</Alert>}
          {passwordSuccess && <Alert severity="success" sx={{ mb: 2 }}>{passwordSuccess}</Alert>}

          <TextField
            fullWidth
            label={t('currentPassword', 'Current Password')}
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            margin="normal"
          />
          <TextField
            fullWidth
            label={t('newPassword', 'New Password')}
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            margin="normal"
          />
          <TextField
            fullWidth
            label={t('confirmNewPassword', 'Confirm New Password')}
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            margin="normal"
          />

          <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
            <Button
              variant="outlined"
              onClick={onChangePassword}
              disabled={changingPassword}
            >
              {changingPassword
                ? t('updating', 'Updating...')
                : t('updatePassword', 'Update Password')}
            </Button>
          </Box>
        </Box>
      </Paper>
    </Container>
  );
};

export default PatientSettings;
