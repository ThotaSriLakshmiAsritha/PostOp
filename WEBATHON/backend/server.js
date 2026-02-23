const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors({ origin: ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002', 'http://localhost:3003', 'http://localhost:3004', 'http://localhost:5173'] }));
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Node backend running' });
});

const CONFIG = {
  critical_spo2: 90,
  low_spo2: 94,
  high_temp: 38,
  very_high_temp: 39,
  severe_pain: 7,
  extreme_pain: 9,
  missing_penalty: 12,
  stale_hours: 24,
};

function median(arr) {
  if (!arr || arr.length === 0) return null;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function compute_dynamic_baseline(history = [], window = 5) {
  if (!history.length) return null;

  const recentStable = history
    .slice(-window)
    .filter((h) => (h.temperature ?? 0) < 38 && (h.spo2 ?? 100) >= 94);

  const recent = recentStable.length ? recentStable : history.slice(-window);

  const med = (key) => {
    const vals = recent.map((d) => d[key]).filter((v) => v != null);
    return vals.length ? median(vals) : null;
  };

  return {
    heart_rate: med('heart_rate'),
    temperature: med('temperature'),
    spo2: med('spo2'),
  };
}

function validate_inputs(data) {
  const issues = [];

  if (data.heart_rate != null && !(data.heart_rate >= 30 && data.heart_rate <= 220)) {
    issues.push('Invalid heart rate reading');
  }
  if (data.spo2 != null && !(data.spo2 >= 70 && data.spo2 <= 100)) {
    issues.push('Invalid SpO2 reading');
  }
  if (data.temperature != null && !(data.temperature >= 34 && data.temperature <= 42)) {
    issues.push('Invalid temperature reading');
  }
  if (data.pain != null && !(data.pain >= 0 && data.pain <= 10)) {
    issues.push('Invalid pain score');
  }

  return issues;
}

function hours_since(ts) {
  if (!ts) return null;
  const then = ts instanceof Date ? ts : new Date(ts);
  return (Date.now() - then.getTime()) / 3600000;
}

function news_like_score(data) {
  let score = 0;
  const reasons = [];

  const temp = data.temperature;
  if (temp != null) {
    if (temp >= 39) {
      score += 3;
      reasons.push('High fever (>=39)');
    } else if (temp >= 38) {
      score += 2;
      reasons.push('Fever (>=38)');
    }
  }

  const spo2 = data.spo2;
  if (spo2 != null) {
    if (spo2 < CONFIG.critical_spo2) {
      return { score: 10, reasons: ['Critical hypoxia'] };
    }
    if (spo2 < CONFIG.low_spo2) {
      score += 3;
      reasons.push('Low oxygen');
    }
  }

  const hr = data.heart_rate;
  if (hr != null) {
    if (hr >= 130) {
      score += 3;
      reasons.push('Severe tachycardia');
    } else if (hr >= 110) {
      score += 2;
      reasons.push('Tachycardia');
    }
  }

  return { score, reasons };
}

function trend_analysis(history = [], current_data = {}) {
  if (!history.length || history.length < 3) return { penalties: 0, reasons: [] };

  let penalties = 0;
  const reasons = [];

  const temps = history.map((h) => h.temperature).filter((v) => v != null);
  const pains = history.map((h) => h.pain).filter((v) => v != null);

  const current_temp = current_data.temperature;
  const current_pain = current_data.pain;

  if (temps.length >= 3 && temps.slice(-3).every((t) => t >= 38)) {
    if (current_temp != null && current_temp >= 38) {
      penalties += 2;
      reasons.push('Persistent fever (active)');
    } else {
      penalties += 1;
      reasons.push('Recent fever history (monitor)');
    }
  }

  if (pains.length >= 3 && pains[pains.length - 1] > pains[pains.length - 2] && pains[pains.length - 2] > pains[pains.length - 3]) {
    if (current_pain != null && current_pain >= 7) {
      penalties += 2;
      reasons.push('Pain worsening trend');
    } else {
      penalties += 1;
      reasons.push('Pain trend improving but monitor');
    }
  }

  return { penalties, reasons };
}

function evaluate_patient_ultra(data, history = [], surgery_type = 'general', baseline = null) {
  if (!data) {
    return {
      risk: 'NORMAL',
      score: 0,
      confidence: 0,
      alerts: ['No data provided'],
      missing_fields: [],
      recommended_action: 'Provide patient data',
    };
  }

  const alerts = [];
  let score = 0;
  let critical = false;
  const missing = [];

  const validation_issues = validate_inputs(data);
  alerts.push(...validation_issues);

  if (!baseline && history.length) {
    baseline = compute_dynamic_baseline(history);
  }

  ['temperature', 'spo2', 'pain', 'heart_rate'].forEach((key) => {
    if (data[key] == null) missing.push(key);
  });

  const hrs = hours_since(data.timestamp);
  if (hrs != null && hrs > CONFIG.stale_hours) {
    alerts.push('Data is stale');
  }

  if (data.spo2 != null && data.spo2 < CONFIG.critical_spo2) {
    critical = true;
    alerts.push('CRITICAL: Oxygen dangerously low');
  }

  if (data.breathlessness === true) {
    critical = true;
    alerts.push('CRITICAL: Breathing difficulty');
  }

  const phys = news_like_score(data);
  score += phys.score;
  alerts.push(...phys.reasons);

  if (data.pain != null) {
    if (data.pain >= CONFIG.extreme_pain) {
      score += 3;
      alerts.push('Extreme pain');
    } else if (data.pain >= CONFIG.severe_pain) {
      score += 2;
      alerts.push('Severe pain');
    }
  }

  if (data.wound_discharge) {
    score += 3;
    alerts.push('Possible wound infection');
  }

  if ((data.missed_doses ?? 0) >= 3) {
    score += 2;
    alerts.push('Multiple medication doses missed');
  }

  const trend = trend_analysis(history, data);
  score += trend.penalties;
  alerts.push(...trend.reasons);

  if (baseline && data.heart_rate != null && baseline.heart_rate != null) {
    if (data.heart_rate > baseline.heart_rate + 20) {
      score += 1;
      alerts.push('HR elevated from personal baseline');
    }
  }

  if (surgery_type === 'cardiac' && (data.spo2 ?? 100) < 95) {
    score += 1;
    alerts.push('Cardiac patient oxygen caution');
  }

  let risk = 'NORMAL';
  if (critical || score >= 9) risk = 'CRITICAL';
  else if (score >= 4) risk = 'WARNING';

  let confidence = 95;
  if (!history.length || history.length < 3) confidence -= 5;
  confidence -= missing.length * CONFIG.missing_penalty;
  if (hrs != null && hrs > CONFIG.stale_hours) confidence -= 20;
  if (validation_issues.length) confidence -= 25;
  confidence = Math.max(0, confidence);

  let action = 'Continue routine monitoring';
  if (risk === 'CRITICAL') action = 'Immediate medical attention required';
  else if (risk === 'WARNING') action = 'Doctor review within 24 hours';

  return {
    risk,
    score,
    confidence,
    alerts,
    missing_fields: missing,
    recommended_action: action,
  };
}

function score_band(score) {
  if (score >= 9) return 'High';
  if (score >= 4) return 'Moderate';
  return 'Low';
}

function generate_explanation(result, patient_data) {
  const lines = [];
  lines.push(`Risk Level: ${result.risk}`);
  lines.push(`Clinical Risk Score: ${result.score} (${score_band(result.score)} severity)`);
  lines.push(`Confidence: ${result.confidence}%`);
  lines.push('');

  if (result.alerts?.length) {
    lines.push('Key Clinical Findings:');
    result.alerts.forEach((a) => lines.push(`- ${a}`));
    lines.push('');
  }

  lines.push('Current Vitals Snapshot:');
  ['temperature', 'spo2', 'heart_rate', 'pain'].forEach((v) => {
    if (patient_data[v] != null) lines.push(`- ${v}: ${patient_data[v]}`);
  });
  lines.push('');

  if (result.missing_fields?.length) {
    lines.push(`Data Quality Note: Missing inputs -> ${JSON.stringify(result.missing_fields)}`);
    lines.push('');
  }

  lines.push('Clinical Interpretation:');
  if (result.risk === 'CRITICAL') {
    lines.push('Patient shows signs of potential clinical deterioration. Immediate medical evaluation is strongly recommended.');
  } else if (result.risk === 'WARNING') {
    lines.push('Patient shows moderate risk indicators. Close monitoring and doctor review within 24 hours advised.');
  } else {
    lines.push('Patient parameters are within acceptable post-operative range. Continue routine monitoring.');
  }
  lines.push('');
  lines.push(`Recommended Action: ${result.recommended_action}`);

  return lines.join('\n');
}

function mapPayloadToEngineInput(payload) {
  return {
    temperature: payload.temperature,
    spo2: payload.spo2,
    pain: payload.pain ?? payload.pain_score,
    heart_rate: payload.heart_rate,
    breathlessness: Boolean(payload.breathlessness),
    wound_discharge: Boolean(payload.wound_discharge ?? payload.discharge),
    missed_doses: payload.missed_doses ?? (payload.antibiotics_taken === false ? 1 : 0),
    timestamp: payload.timestamp ?? new Date().toISOString(),
  };
}

function mapRiskToTraffic(risk) {
  if (risk === 'CRITICAL') return 'RED';
  if (risk === 'WARNING') return 'YELLOW';
  return 'GREEN';
}

app.post('/api/submit_log', (req, res) => {
  try {
    const payload = req.body || {};
    const historyRaw = Array.isArray(payload.history) ? payload.history : [];
    const history = historyRaw.map(mapPayloadToEngineInput);
    const current = mapPayloadToEngineInput(payload);
    const surgery_type = payload.surgery_type || 'general';
    const baseline = payload.baseline || null;

    const assessment = evaluate_patient_ultra(current, history, surgery_type, baseline);
    const explanation = generate_explanation(assessment, current);

    const risk = mapRiskToTraffic(assessment.risk);
    const message = assessment.alerts.length ? assessment.alerts.join('; ') : assessment.recommended_action;

    // Keep frontend compatibility and also return detailed engine output.
    res.json({
      risk,
      rule_risk: risk,
      trend_risk: risk,
      message,
      result: assessment,
      explanation,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal error' });
  }
});

const port = process.env.PORT || 8000;
app.listen(port, () => console.log(`Backend server listening on ${port}`));
