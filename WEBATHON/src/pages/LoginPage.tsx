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

const LoginPage = () => {
  const [role, setRole] = useState<'patient' | 'doctor'>('patient');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login } = useAuth();
  const { t } = useTranslation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    try {
      await login(email, password);
      // Navigation will happen automatically via AuthContext
    } catch (err: any) {
      setError(t('loginFailed', 'Login failed. Please check your credentials and try again.'));
    }
  };

  return (
    <Container maxWidth="sm">
      <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center' }}>
        <Paper elevation={3} sx={{ p: 4, width: '100%' }}>
          <Typography variant="h4" component="h1" gutterBottom align="center">
            {t('welcome', 'Welcome')}
          </Typography>
          <Typography variant="h6" component="h2" gutterBottom align="center" color="text.secondary">
            {t('login', 'Login')}
          </Typography>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <form onSubmit={handleSubmit}>
            <TextField
              fullWidth
              select
              label={t('role', 'Role')}
              value={role}
              onChange={(e) => setRole(e.target.value as 'patient' | 'doctor')}
              margin="normal"
              required
            >
              <MenuItem value="patient">{t('patient', 'Patient')}</MenuItem>
              <MenuItem value="doctor">{t('doctor', 'Doctor')}</MenuItem>
            </TextField>
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
            <Button
              type="submit"
              fullWidth
              variant="contained"
              sx={{ mt: 3, mb: 2 }}
            >
              {t('loginButton', 'Login')}
            </Button>
            {role === 'doctor' && (
              <Box textAlign="center">
                <Link to="/register" style={{ textDecoration: 'none' }}>
                  <Typography variant="body2" color="primary">
                    {t('register')}
                  </Typography>
                </Link>
              </Box>
            )}
          </form>
        </Paper>
      </Box>
    </Container>
  );
};

export default LoginPage;
