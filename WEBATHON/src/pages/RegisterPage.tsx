import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import {
  Container,
  Paper,
  TextField,
  Button,
  Typography,
  Box,
  Alert,
  MenuItem,
} from '@mui/material';
import { useAuth } from '../contexts/AuthContext';
import { HOSPITAL_ID_OPTIONS, SURGERY_TYPE_OPTIONS } from '../constants/medicalOptions';

const RegisterPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const role: 'doctor' = 'doctor';
  const [hospitalId, setHospitalId] = useState('');
  const [surgeryType, setSurgeryType] = useState('');
  const [error, setError] = useState('');
  const { register } = useAuth();
  const { t } = useTranslation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    try {
      await register(email, password, role, name, {
        hospital_id: hospitalId,
        surgery_type: surgeryType,
      });
      // Navigation will happen automatically via AuthContext
    } catch (err: any) {
      setError(t('registerFailed', 'Registration failed. Please try again.'));
    }
  };

  return (
    <Container maxWidth="sm">
      <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center' }}>
        <Paper elevation={3} sx={{ p: 4, width: '100%' }}>
          <Typography variant="h4" component="h1" gutterBottom align="center">
            {t('appTitle', 'Post-Op Guardian')}
          </Typography>
          <Typography variant="h6" component="h2" gutterBottom align="center" color="text.secondary">
            {t('register', 'Register')}
          </Typography>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <form onSubmit={handleSubmit}>
            <TextField
              fullWidth
              label={t('name', 'Name')}
              value={name}
              onChange={(e) => setName(e.target.value)}
              margin="normal"
              required
            />
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
              label={t('password', 'Password')}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
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
            <Button
              type="submit"
              fullWidth
              variant="contained"
              sx={{ mt: 3, mb: 2 }}
              disabled={!hospitalId || !surgeryType}
            >
              {t('registerButton', 'Register')}
            </Button>
            <Box textAlign="center">
              <Link to="/login" style={{ textDecoration: 'none' }}>
                <Typography variant="body2" color="primary">
                  {t('alreadyHaveAccount', 'Already have an account? Login')}
                </Typography>
              </Link>
            </Box>
          </form>
        </Paper>
      </Box>
    </Container>
  );
};

export default RegisterPage;
