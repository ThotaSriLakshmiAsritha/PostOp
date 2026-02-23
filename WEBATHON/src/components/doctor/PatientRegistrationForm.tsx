import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Container,
  MenuItem,
  Paper,
  TextField,
  Typography,
} from '@mui/material';
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { registerPatient } from '../../services/patientService';
import { HOSPITAL_ID_OPTIONS, SURGERY_TYPE_OPTIONS } from '../../constants/medicalOptions';
import { useAuth } from '../../contexts/AuthContext';
import { useTranslation } from 'react-i18next';

interface DoctorOption {
  id: string;
  name: string;
  email: string;
  hospital_id?: string;
  surgery_type?: string;
  specialization?: string;
}

const PatientRegistrationForm = () => {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [hospitalId, setHospitalId] = useState('');
  const [surgeryType, setSurgeryType] = useState('');
  const [surgeryDate, setSurgeryDate] = useState('');
  const [generatedPassword, setGeneratedPassword] = useState('');
  const [assignedDoctor, setAssignedDoctor] = useState<DoctorOption | null>(null);
  const [loadingDoctors, setLoadingDoctors] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [downloadError, setDownloadError] = useState('');
  const [lastCredentialFile, setLastCredentialFile] = useState<{
    filename: string;
    text: string;
  } | null>(null);
  const [hospitalOptions, setHospitalOptions] = useState<string[]>(HOSPITAL_ID_OPTIONS);
  const [surgeryOptions, setSurgeryOptions] = useState<string[]>(SURGERY_TYPE_OPTIONS);
  const surgeryDateInputRef = useRef<HTMLInputElement | null>(null);

  const resolveDoctorSurgeryType = (doctor: Partial<DoctorOption> | null | undefined) =>
    String(doctor?.surgery_type || doctor?.specialization || '').trim();

  const downloadTextFile = (text: string, filename: string) => {
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const nav = window.navigator as Navigator & {
      msSaveOrOpenBlob?: (blob: Blob, filename?: string) => boolean;
    };
    if (nav.msSaveOrOpenBlob) {
      nav.msSaveOrOpenBlob(blob, filename);
      return;
    }

    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = filename;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  };

  useEffect(() => {
    const loadDoctors = async () => {
      try {
        setLoadingDoctors(true);
        const doctorsSnap = await getDocs(collection(db, 'doctors'));
        const doctorRowsFromDoctors = doctorsSnap.docs.map((doctorDoc) => {
          const data = doctorDoc.data() as Partial<DoctorOption>;
          return {
            id: doctorDoc.id,
            name: data.name || 'Unknown Doctor',
            email: data.email || '',
            hospital_id: data.hospital_id,
            surgery_type: (data as any).surgery_type || (data as any).surgeryType || '',
            specialization: (data as any).specialization || '',
          } as DoctorOption;
        });
        const doctorUsersSnap = await getDocs(
          query(collection(db, 'users'), where('role', '==', 'doctor'))
        );
        const doctorRowsFromUsers = doctorUsersSnap.docs.map((userDoc) => {
          const data = userDoc.data() as any;
          return {
            id: userDoc.id,
            name: data?.name || 'Unknown Doctor',
            email: data?.email || '',
            hospital_id: data?.hospital_id || data?.hospitalId || '',
            surgery_type: data?.surgery_type || data?.surgeryType || '',
            specialization: data?.specialization || '',
          } as DoctorOption;
        });

        const mergedById = new Map<string, DoctorOption>();
        [...doctorRowsFromUsers, ...doctorRowsFromDoctors].forEach((d) => {
          mergedById.set(d.id, d);
        });

        const doctorRows = Array.from(mergedById.values());
        const currentDoctor =
          doctorRows.find((doctor) => doctor.id === user?.uid) ||
          doctorRows.find(
            (doctor) =>
              doctor.email &&
              user?.email &&
              doctor.email.trim().toLowerCase() === user.email.trim().toLowerCase()
          ) ||
          null;
        const fallbackDoctor: DoctorOption | null = user?.uid
          ? {
              id: user.uid,
              name: user.name || 'Current Doctor',
              email: user.email || '',
              hospital_id: user.hospital_id || '',
              surgery_type: user.surgery_type || '',
              specialization: (user as any).specialization || '',
            }
          : null;
        let assigned = currentDoctor || fallbackDoctor;

        if (assigned?.id) {
          const [doctorDocSnap, userDocSnap] = await Promise.all([
            getDoc(doc(db, 'doctors', assigned.id)),
            getDoc(doc(db, 'users', assigned.id)),
          ]);

          const doctorDocData = doctorDocSnap.exists() ? (doctorDocSnap.data() as any) : null;
          const userDocData = userDocSnap.exists() ? (userDocSnap.data() as any) : null;

          assigned = {
            ...assigned,
            hospital_id:
              assigned.hospital_id ||
              doctorDocData?.hospital_id ||
              userDocData?.hospital_id ||
              userDocData?.hospitalId ||
              '',
            surgery_type:
              resolveDoctorSurgeryType(assigned) ||
              doctorDocData?.surgery_type ||
              doctorDocData?.surgeryType ||
              doctorDocData?.specialization ||
              userDocData?.surgery_type ||
              userDocData?.surgeryType ||
              userDocData?.specialization ||
              '',
            specialization:
              assigned.specialization ||
              doctorDocData?.specialization ||
              userDocData?.specialization ||
              '',
          };
        }

        setAssignedDoctor(assigned);
        if (assigned?.hospital_id) {
          setHospitalId(assigned.hospital_id);
        }
        const doctorSurgeryType = resolveDoctorSurgeryType(assigned);
        if (doctorSurgeryType) {
          setSurgeryType((prev) => prev || doctorSurgeryType);
        }

        const dynamicHospitals = Array.from(
          new Set(
            doctorRows
              .map((doctor) => doctor.hospital_id || '')
              .filter((id) => Boolean(id))
          )
        );
        if (dynamicHospitals.length > 0) {
          setHospitalOptions(Array.from(new Set([...HOSPITAL_ID_OPTIONS, ...dynamicHospitals])));
        }

        const dynamicSurgeryTypes = Array.from(
          new Set(
            [...doctorsSnap.docs, ...doctorUsersSnap.docs]
              .map((doctorDoc) => {
                const data = doctorDoc.data() as any;
                return String(
                  data?.surgery_type || data?.surgeryType || data?.specialization || ''
                ).trim();
              })
              .filter((value) => Boolean(value))
          )
        );
        if (dynamicSurgeryTypes.length > 0) {
          setSurgeryOptions(
            Array.from(new Set([...SURGERY_TYPE_OPTIONS, ...dynamicSurgeryTypes]))
          );
        }

        const defaultDoctorSurgeryType = resolveDoctorSurgeryType(assigned);
        if (defaultDoctorSurgeryType) {
          setSurgeryOptions((prev) =>
            prev.includes(defaultDoctorSurgeryType)
              ? prev
              : [defaultDoctorSurgeryType, ...prev]
          );
        }
      } catch (err) {
        console.error('Failed to load doctors:', err);
        setError('Failed to load doctors');
      } finally {
        setLoadingDoctors(false);
      }
    };

    loadDoctors();
  }, [user?.uid, user?.email]);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setSuccess('');
    setDownloadError('');

    try {
      setSubmitting(true);
      const password = generatedPassword || Math.random().toString(36).slice(-10) + 'A1!';
      const doctorId = assignedDoctor?.id || user?.uid || '';
      if (!doctorId) {
        throw new Error('Unable to resolve logged-in doctor profile.');
      }

      const result = await registerPatient({
        email,
        password,
        name,
        hospital_id: hospitalId,
        doctor_id: doctorId,
        surgery_type: surgeryType,
        surgery_date: surgeryDate,
      });

      const credentialText = [
        'Post-Op Guardian Patient Login Credentials',
        `Email: ${result.email}`,
        `Password: ${result.password}`,
        `Patient ID: ${result.patient_id}`,
        `User ID: ${result.user_id}`,
      ].join('\n');
      const filename = `patient-credentials-${result.patient_id}.txt`;
      setLastCredentialFile({ filename, text: credentialText });
      try {
        downloadTextFile(credentialText, filename);
      } catch (downloadErr) {
        console.error('Failed to auto-download credentials:', downloadErr);
        setDownloadError('Auto-download was blocked. Use the "Download Credentials TXT" button below.');
      }

      setSuccess(`Patient registered and assigned to you. Credentials ready for ${result.email}.`);
      setEmail('');
      setName('');
      setSurgeryType('');
      setSurgeryDate('');
      setGeneratedPassword('');
    } catch (err: any) {
      setError(err?.message || 'Failed to register patient');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Container maxWidth="sm">
      <Paper sx={{ p: 3 }}>
        <Typography variant="h5" gutterBottom>
          {t('registerPatient', 'Register Patient')}
        </Typography>

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}
        {downloadError && <Alert severity="warning" sx={{ mb: 2 }}>{downloadError}</Alert>}

        <form onSubmit={onSubmit}>
          <TextField
            fullWidth
            label={t('email', 'Email')}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            margin="normal"
            required
          />

          <TextField
            fullWidth
            label={t('temporaryPassword', 'Temporary Password')}
            value={generatedPassword}
            onChange={(e) => setGeneratedPassword(e.target.value)}
            margin="normal"
            helperText={t('temporaryPasswordHelper', 'Leave empty to auto-generate a password')}
          />

          <TextField
            fullWidth
            label={t('patientName', 'Patient Name')}
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
            disabled={Boolean(assignedDoctor?.hospital_id)}
            helperText={
              assignedDoctor?.hospital_id
                ? `${t('usingYourHospital', 'Using your hospital')}: ${assignedDoctor.hospital_id}`
                : undefined
            }
          >
            {hospitalOptions.map((id) => (
              <MenuItem key={id} value={id}>
                {id}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            fullWidth
            label={t('doctor', 'Doctor')}
            value={
              assignedDoctor
                ? `${assignedDoctor.name} (${assignedDoctor.email})`
                : user?.email || t('currentLoggedInDoctor', 'Current logged-in doctor')
            }
            margin="normal"
            disabled
            helperText={t(
              'assignedDoctorHelper',
              'Patients registered from this page are assigned to the logged-in doctor.'
            )}
          />

          <TextField
            fullWidth
            select
            label={t('surgeryType', 'Surgery Type')}
            value={surgeryType}
            onChange={(e) => setSurgeryType(e.target.value)}
            margin="normal"
            required
            helperText={
              resolveDoctorSurgeryType(assignedDoctor)
                ? `${t('defaultDoctorSpecialisation', "Defaulted to doctor's specialisation")}: ${resolveDoctorSurgeryType(assignedDoctor)}`
                : undefined
            }
          >
            {surgeryOptions.map((type) => (
              <MenuItem key={type} value={type}>
                {type}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            fullWidth
            label={t('surgeryDate', 'Surgery Date')}
            type="date"
            value={surgeryDate}
            onChange={(e) => setSurgeryDate(e.target.value)}
            onFocus={() => {
              const input = surgeryDateInputRef.current as any;
              if (input && typeof input.showPicker === 'function') {
                input.showPicker();
              }
            }}
            margin="normal"
            inputRef={surgeryDateInputRef}
            inputProps={{ max: new Date().toISOString().slice(0, 10) }}
            helperText={t('surgeryDateHelper', 'Use calendar picker or type date as YYYY-MM-DD')}
            InputLabelProps={{ shrink: true }}
            required
          />

          <Box sx={{ mt: 2 }}>
            <Button
              type="submit"
              variant="contained"
              disabled={submitting || loadingDoctors || !assignedDoctor}
            >
              {submitting ? <CircularProgress size={20} /> : t('registerPatient', 'Register Patient')}
            </Button>
            {lastCredentialFile && (
              <Button
                sx={{ ml: 2 }}
                variant="outlined"
                onClick={() => downloadTextFile(lastCredentialFile.text, lastCredentialFile.filename)}
              >
                {t('downloadCredentialsTxt', 'Download Credentials TXT')}
              </Button>
            )}
          </Box>
        </form>
      </Paper>
    </Container>
  );
};

export default PatientRegistrationForm;
