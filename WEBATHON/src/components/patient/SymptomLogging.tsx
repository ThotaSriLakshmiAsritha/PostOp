import { useState } from 'react';
import {
  Container,
  Paper,
  Typography,
  TextField,
  Button,
  Box,
  Slider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Switch,
  Alert,
  CircularProgress,
} from '@mui/material';
import {
  collection,
  addDoc,
  doc,
  updateDoc,
  setDoc,
  serverTimestamp,
  getDocs,
  query,
  where,
} from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const SymptomLogging = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const { t } = useTranslation();

  // Clinical inputs
  const [painScore, setPainScore] = useState(5);
  const [temperature, setTemperature] = useState(36.5);
  const [rednessLevel, setRednessLevel] = useState('none');
  const [swellingLevel, setSwellingLevel] = useState('none');
  const [discharge, setDischarge] = useState(false);

  // Functional inputs
  const [mobilityLevel, setMobilityLevel] = useState('good');
  const [sleepHours, setSleepHours] = useState(8);
  const [appetite, setAppetite] = useState('good');
  const [fatigue, setFatigue] = useState('moderate');
  const [mood, setMood] = useState('good');

  // Medication inputs
  const [antibioticsTaken, setAntibioticsTaken] = useState(false);
  const [painMedsTaken, setPainMedsTaken] = useState(false);
  const [dressingChanged, setDressingChanged] = useState(false);

  const normalizeRisk = (rawRisk: unknown): 'GREEN' | 'YELLOW' | 'RED' => {
    const risk = String(rawRisk || '').toUpperCase();
    if (risk === 'RED' || risk === 'CRITICAL') return 'RED';
    if (risk === 'YELLOW' || risk === 'WARNING') return 'YELLOW';
    return 'GREEN';
  };

  const localizeRiskReason = (reason: string): string => {
    const key = reason.trim().toLowerCase();
    const map: Record<string, string> = {
      'high fever': t('highFever', 'High fever'),
      fever: t('fever', 'Fever'),
      'possible wound infection': t('possibleWoundInfection', 'Possible wound infection'),
      'extreme pain': t('extremePain', 'Extreme pain'),
      'severe pain': t('severePain', 'Severe pain'),
      'medication non-adherence': t('medicationNonAdherence', 'Medication non-adherence'),
    };
    return map[key] || reason;
  };

  const fallbackRiskFromLog = (logData: {
    pain_score: number;
    temperature: number;
    discharge: boolean;
    antibiotics_taken: boolean;
  }): { risk: 'GREEN' | 'YELLOW' | 'RED'; message: string } => {
    let score = 0;
    const reasons: string[] = [];

    if (logData.temperature >= 39) {
      score += 3;
      reasons.push('High fever');
    } else if (logData.temperature >= 38) {
      score += 2;
      reasons.push('Fever');
    }

    if (logData.discharge) {
      score += 3;
      reasons.push('Possible wound infection');
    }

    if (logData.pain_score >= 9) {
      score += 3;
      reasons.push('Extreme pain');
    } else if (logData.pain_score >= 7) {
      score += 2;
      reasons.push('Severe pain');
    }

    if (!logData.antibiotics_taken) {
      score += 1;
      reasons.push('Medication non-adherence');
    }

    const localizedReasons = reasons.map(localizeRiskReason);
    if (score >= 6) {
      return {
        risk: 'RED',
        message:
          localizedReasons.join('; ') || t('highRiskSymptomsDetected', 'High risk symptoms detected'),
      };
    }
    if (score >= 3) {
      return {
        risk: 'YELLOW',
        message:
          localizedReasons.join('; ') ||
          t('moderateRiskSymptomsDetected', 'Moderate risk symptoms detected'),
      };
    }
    return {
      risk: 'GREEN',
      message: localizedReasons.join('; ') || t('allParametersNormal', 'All parameters normal'),
    };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    setError('');
    setSuccess(false);

    try {
      let surgeryDateMillis: number | null = null;
      let surgeryDateValue: string | null = null;
      const patientSnap = await getDocs(query(collection(db, 'patients'), where('userId', '==', user.uid)));
      if (!patientSnap.empty) {
        const candidates = patientSnap.docs
          .map((d) => d.data() as any)
          .filter((p) => p?.surgeryDate || p?.surgery_date);
        const patientData: any = candidates[0] || patientSnap.docs[0].data();
        const surgeryDate = patientData?.surgeryDate;
        surgeryDateValue = patientData?.surgery_date || null;
        if (typeof surgeryDate?.toDate === 'function') {
          surgeryDateMillis = surgeryDate.toDate().getTime();
        } else if (typeof surgeryDate === 'string') {
          surgeryDateMillis = new Date(surgeryDate).getTime();
        }
        if (!surgeryDateMillis && surgeryDateValue) {
          surgeryDateMillis = new Date(`${surgeryDateValue}T00:00:00`).getTime();
        }
      }

      const daysAfterSurgery =
        surgeryDateMillis && !Number.isNaN(surgeryDateMillis)
          ? Math.max(
              0,
              Math.floor((Date.now() - surgeryDateMillis) / (1000 * 60 * 60 * 24))
            )
          : null;

      const logData = {
        patientId: user.uid,
        days_after_surgery: daysAfterSurgery,
        surgery_date: surgeryDateValue,
        // Clinical
        pain_score: painScore,
        temperature: temperature,
        redness_level: rednessLevel,
        swelling_level: swellingLevel,
        discharge: discharge,
        // Functional
        mobility_level: mobilityLevel,
        sleep_hours: sleepHours,
        appetite: appetite,
        fatigue: fatigue,
        mood: mood,
        // Medication
        antibiotics_taken: antibioticsTaken,
        pain_meds_taken: painMedsTaken,
        dressing_changed: dressingChanged,
      };

      const initialRisk = fallbackRiskFromLog(logData);

      // Create a new doc ref first so we can always update it later
      const docRef = doc(collection(db, 'symptom_logs'));

      // Write initial log with server timestamp and pending risk
      await setDoc(docRef, {
        ...logData,
        createdAt: serverTimestamp(),
        createdAtClient: Date.now(),
        risk: initialRisk.risk,
        rule_risk: initialRisk.risk,
        trend_risk: initialRisk.risk,
        risk_message: initialRisk.message,
      });

      // Call backend API for risk assessment
      try {
        const response = await axios.post(`${import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'}/api/submit_log`, {
          log_id: docRef.id,
          ...logData,
        });

        const apiRisk = normalizeRisk(response.data?.risk ?? response.data?.result?.risk);
        const rawConfidence = Number(
          response.data?.confidence ?? response.data?.result?.confidence ?? 0
        );
        const confidencePercent = rawConfidence <= 1 ? rawConfidence * 100 : rawConfidence;

        // Update log with risk assessment
        await updateDoc(doc(db, 'symptom_logs', docRef.id), {
          risk: apiRisk,
          rule_risk: normalizeRisk(response.data?.rule_risk ?? response.data?.result?.risk),
          trend_risk: normalizeRisk(response.data?.trend_risk ?? response.data?.result?.risk),
          confidence: Number(confidencePercent.toFixed(2)),
          risk_message: response.data?.message || initialRisk.message,
          risk_assessed_at: serverTimestamp(),
        });

        // If RED risk, create alert
        if (apiRisk === 'RED') {
          await addDoc(collection(db, 'alerts'), {
            patientId: user.uid,
            type: 'HIGH_RISK',
            message: response.data.message || 'High risk symptoms detected',
            risk: 'RED',
            acknowledged: false,
            logId: docRef.id,
            createdAt: serverTimestamp(),
          });
        }

        setSuccess(true);
        setTimeout(() => navigate('/patient'), 700);

        // Reset form
        setTimeout(() => {
          setPainScore(5);
          setTemperature(36.5);
          setRednessLevel('none');
          setSwellingLevel('none');
          setDischarge(false);
          setMobilityLevel('good');
          setSleepHours(8);
          setAppetite('good');
          setFatigue('moderate');
          setMood('good');
          setAntibioticsTaken(false);
          setPainMedsTaken(false);
          setDressingChanged(false);
          setSuccess(false);
        }, 3000);
      } catch (apiError: any) {
        console.error('Backend API error:', apiError);
        // Fail-safe: compute risk locally so dashboard still updates even when API is unavailable.
        const fallback = fallbackRiskFromLog(logData);
        try {
          await updateDoc(doc(db, 'symptom_logs', docRef.id), {
            risk: fallback.risk,
            rule_risk: fallback.risk,
            trend_risk: fallback.risk,
            risk_message: fallback.message,
            risk_assessed_at: serverTimestamp(),
          });
          if (fallback.risk === 'RED') {
            await addDoc(collection(db, 'alerts'), {
              patientId: user.uid,
              type: 'HIGH_RISK',
              message: fallback.message || 'High risk symptoms detected',
              risk: 'RED',
              acknowledged: false,
              logId: docRef.id,
              createdAt: serverTimestamp(),
            });
          }
        } catch (updateErr) {
          console.error('Error updating risk after API failure:', updateErr);
        }
        setSuccess(true);
        setTimeout(() => navigate('/patient'), 700);
      }
    } catch (err: any) {
      setError(t('submitLogFailed', 'Failed to submit log. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxWidth="md">
      <Paper sx={{ p: 4 }}>
        <Typography variant="h4" gutterBottom>
          {t('dailySymptomLogging', 'Daily Symptom Logging')}
        </Typography>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          {t('dailySymptomLoggingHelp', 'Please fill out this form daily to track your recovery progress.')}
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}

        {success && (
          <Alert severity="success" sx={{ mt: 2 }}>
            {t('symptomLogSuccess', 'Symptoms logged successfully! Your risk status has been updated.')}
          </Alert>
        )}

        <form onSubmit={handleSubmit}>
          {/* Clinical Inputs */}
          <Typography variant="h6" sx={{ mt: 3, mb: 2 }}>
            {t('clinicalSymptoms', 'Clinical Symptoms')}
          </Typography>

          <Box sx={{ mb: 3 }}>
            <Typography gutterBottom>{t('painScoreLabel', 'Pain Score')}: {painScore}/10</Typography>
            <Slider
              value={painScore}
              onChange={(_, value) => setPainScore(value as number)}
              min={0}
              max={10}
              step={1}
              marks
            />
          </Box>

          <TextField
            fullWidth
            label={t('temperatureLabel', 'Temperature (°C)')}
            type="number"
            value={temperature}
            onChange={(e) => setTemperature(parseFloat(e.target.value))}
            margin="normal"
            inputProps={{ min: 35, max: 42, step: 0.1 }}
            required
          />

          <FormControl fullWidth margin="normal">
            <InputLabel>{t('rednessLevel', 'Redness Level')}</InputLabel>
            <Select value={rednessLevel} onChange={(e) => setRednessLevel(e.target.value)}>
                <MenuItem value="none">{t('none', 'None')}</MenuItem>
                <MenuItem value="mild">{t('mild', 'Mild')}</MenuItem>
                <MenuItem value="moderate">{t('moderate', 'Moderate')}</MenuItem>
                <MenuItem value="severe">{t('severe', 'Severe')}</MenuItem>
            </Select>
          </FormControl>

          <FormControl fullWidth margin="normal">
            <InputLabel>{t('swellingLevel', 'Swelling Level')}</InputLabel>
            <Select value={swellingLevel} onChange={(e) => setSwellingLevel(e.target.value)}>
              <MenuItem value="none">{t('none', 'None')}</MenuItem>
              <MenuItem value="mild">{t('mild', 'Mild')}</MenuItem>
              <MenuItem value="moderate">{t('moderate', 'Moderate')}</MenuItem>
              <MenuItem value="severe">{t('severe', 'Severe')}</MenuItem>
            </Select>
          </FormControl>

            <FormControlLabel
            control={<Switch checked={discharge} onChange={(e) => setDischarge(e.target.checked)} />}
            label={t('dischargePresent', 'Discharge/Pus Present')}
            sx={{ mt: 2 }}
          />

          {/* Functional Inputs */}
          <Typography variant="h6" sx={{ mt: 4, mb: 2 }}>
            {t('functionalStatus', 'Functional Status')}
          </Typography>

          <FormControl fullWidth margin="normal">
            <InputLabel>{t('mobilityLevel', 'Mobility Level')}</InputLabel>
            <Select value={mobilityLevel} onChange={(e) => setMobilityLevel(e.target.value)}>
              <MenuItem value="excellent">{t('excellent', 'Excellent')}</MenuItem>
              <MenuItem value="good">{t('good', 'Good')}</MenuItem>
              <MenuItem value="limited">{t('limited', 'Limited')}</MenuItem>
              <MenuItem value="poor">{t('poor', 'Poor')}</MenuItem>
            </Select>
          </FormControl>

            <TextField
            fullWidth
            label={t('sleepHours', 'Sleep Hours')}
            type="number"
            value={sleepHours}
            onChange={(e) => setSleepHours(parseInt(e.target.value))}
            margin="normal"
            inputProps={{ min: 0, max: 24 }}
          />

          <FormControl fullWidth margin="normal">
            <InputLabel>{t('appetite', 'Appetite')}</InputLabel>
            <Select value={appetite} onChange={(e) => setAppetite(e.target.value)}>
              <MenuItem value="excellent">{t('excellent', 'Excellent')}</MenuItem>
              <MenuItem value="good">{t('good', 'Good')}</MenuItem>
              <MenuItem value="poor">{t('poor', 'Poor')}</MenuItem>
              <MenuItem value="none">{t('none', 'None')}</MenuItem>
            </Select>
          </FormControl>

          <FormControl fullWidth margin="normal">
            <InputLabel>{t('fatigueLevel', 'Fatigue Level')}</InputLabel>
            <Select value={fatigue} onChange={(e) => setFatigue(e.target.value)}>
              <MenuItem value="none">{t('none', 'None')}</MenuItem>
              <MenuItem value="mild">{t('mild', 'Mild')}</MenuItem>
              <MenuItem value="moderate">{t('moderate', 'Moderate')}</MenuItem>
              <MenuItem value="severe">{t('severe', 'Severe')}</MenuItem>
            </Select>
          </FormControl>

          <FormControl fullWidth margin="normal">
            <InputLabel>{t('mood', 'Mood')}</InputLabel>
            <Select value={mood} onChange={(e) => setMood(e.target.value)}>
              <MenuItem value="excellent">{t('excellent', 'Excellent')}</MenuItem>
              <MenuItem value="good">{t('good', 'Good')}</MenuItem>
              <MenuItem value="moderate">{t('moderate', 'Moderate')}</MenuItem>
              <MenuItem value="poor">{t('poor', 'Poor')}</MenuItem>
            </Select>
          </FormControl>

          {/* Medication Inputs */}
          <Typography variant="h6" sx={{ mt: 4, mb: 2 }}>
            {t('medicationAndCare', 'Medication & Care')}
          </Typography>

          <FormControlLabel
            control={<Switch checked={antibioticsTaken} onChange={(e) => setAntibioticsTaken(e.target.checked)} />}
            label={t('antibioticsTaken', 'Antibiotics Taken')}
            sx={{ mt: 1 }}
          />

          <FormControlLabel
            control={<Switch checked={painMedsTaken} onChange={(e) => setPainMedsTaken(e.target.checked)} />}
            label={t('painMedicationTaken', 'Pain Medication Taken')}
            sx={{ mt: 1 }}
          />

          <FormControlLabel
            control={<Switch checked={dressingChanged} onChange={(e) => setDressingChanged(e.target.checked)} />}
            label={t('dressingChanged', 'Dressing Changed')}
            sx={{ mt: 1 }}
          />

          <Button
            type="submit"
            fullWidth
            variant="contained"
            size="large"
            sx={{ mt: 4 }}
            disabled={loading}
          >
            {loading ? <CircularProgress size={24} /> : t('submitSymptomLog', 'Submit Symptom Log')}
          </Button>
        </form>
      </Paper>
    </Container>
  );
};

export default SymptomLogging;
