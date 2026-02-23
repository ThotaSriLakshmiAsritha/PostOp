from datetime import datetime
from typing import Literal, Optional
import os
import statistics

import firebase_admin
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from firebase_admin import credentials, firestore
from pydantic import BaseModel

load_dotenv()

# Initialize Firebase Admin
if not firebase_admin._apps:
    cred_path = os.getenv("FIREBASE_CREDENTIALS_PATH")
    if cred_path and os.path.exists(cred_path):
        cred = credentials.Certificate(cred_path)
    else:
        cred = credentials.ApplicationDefault()

    firebase_admin.initialize_app(cred)

db = firestore.client()

app = FastAPI(title="Post-Op Guardian API")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Request/Response models
class SymptomLog(BaseModel):
    log_id: str
    patientId: str
    pain_score: float
    temperature: float
    redness_level: str
    swelling_level: str
    discharge: bool
    mobility_level: str
    sleep_hours: float
    appetite: str
    fatigue: str
    mood: str
    antibiotics_taken: bool
    pain_meds_taken: bool
    dressing_changed: bool
    createdAt: Optional[str] = None


class RiskResponse(BaseModel):
    risk: Literal["GREEN", "YELLOW", "RED"]
    message: str
    rule_risk: Literal["GREEN", "YELLOW", "RED"]
    trend_risk: Literal["GREEN", "YELLOW", "RED"]


CONFIG = {
    "critical_spo2": 90,
    "low_spo2": 94,
    "high_temp": 38,
    "very_high_temp": 39,
    "severe_pain": 7,
    "extreme_pain": 9,
    "missing_penalty": 12,
    "stale_hours": 24,
}


def compute_dynamic_baseline(history, window=5):
    """Median baseline from recent stable days."""
    if not history:
        return None

    recent = [
        h
        for h in history[-window:]
        if h.get("temperature", 0) < 38 and h.get("spo2", 100) >= 94
    ] or history[-window:]

    def med(key):
        vals = [d[key] for d in recent if d.get(key) is not None]
        return statistics.median(vals) if vals else None

    return {
        "heart_rate": med("heart_rate"),
        "temperature": med("temperature"),
        "spo2": med("spo2"),
    }


def validate_inputs(data):
    """Reject physiologically impossible values."""
    issues = []

    if data.get("heart_rate") is not None:
        if not (30 <= data["heart_rate"] <= 220):
            issues.append("Invalid heart rate reading")

    if data.get("spo2") is not None:
        if not (70 <= data["spo2"] <= 100):
            issues.append("Invalid SpO2 reading")

    if data.get("temperature") is not None:
        if not (34 <= data["temperature"] <= 42):
            issues.append("Invalid temperature reading")

    if data.get("pain") is not None:
        if not (0 <= data["pain"] <= 10):
            issues.append("Invalid pain score")

    return issues


def hours_since(ts):
    if ts is None:
        return None
    return (datetime.now() - ts).total_seconds() / 3600


def news_like_score(data):
    """Physiological early warning scoring."""
    score = 0
    reasons = []

    temp = data.get("temperature")
    if temp is not None:
        if temp >= 39:
            score += 3
            reasons.append("High fever (>=39)")
        elif temp >= 38:
            score += 2
            reasons.append("Fever (>=38)")

    spo2 = data.get("spo2")
    if spo2 is not None:
        if spo2 < CONFIG["critical_spo2"]:
            return 10, ["Critical hypoxia"]
        if spo2 < CONFIG["low_spo2"]:
            score += 3
            reasons.append("Low oxygen")

    hr = data.get("heart_rate")
    if hr is not None:
        if hr >= 130:
            score += 3
            reasons.append("Severe tachycardia")
        elif hr >= 110:
            score += 2
            reasons.append("Tachycardia")

    return score, reasons


def trend_analysis(history, current_data):
    """Clinically calibrated trend detection."""
    if not history or len(history) < 3:
        return 0, []

    penalties = 0
    reasons = []

    temps = [h.get("temperature") for h in history if h.get("temperature") is not None]
    pains = [h.get("pain") for h in history if h.get("pain") is not None]

    current_temp = current_data.get("temperature")
    current_pain = current_data.get("pain")

    if len(temps) >= 3 and all(t >= 38 for t in temps[-3:]):
        if current_temp and current_temp >= 38:
            penalties += 2
            reasons.append("Persistent fever (active)")
        else:
            penalties += 1
            reasons.append("Recent fever history (monitor)")

    if len(pains) >= 3 and pains[-1] > pains[-2] > pains[-3]:
        if current_pain and current_pain >= 7:
            penalties += 2
            reasons.append("Pain worsening trend")
        else:
            penalties += 1
            reasons.append("Pain trend improving but monitor")

    return penalties, reasons


def evaluate_patient_ultra(data, history=None, surgery_type="general", baseline=None):
    """Rule-based post-op risk engine."""
    if not data:
        return {
            "risk": "NORMAL",
            "score": 0,
            "confidence": 0,
            "alerts": ["No data provided"],
            "missing_fields": [],
            "recommended_action": "Provide patient data",
        }

    alerts = []
    score = 0
    critical = False
    missing = []

    validation_issues = validate_inputs(data)
    alerts.extend(validation_issues)

    if baseline is None and history:
        baseline = compute_dynamic_baseline(history)

    required = ["temperature", "spo2", "pain", "heart_rate"]
    for field_name in required:
        if data.get(field_name) is None:
            missing.append(field_name)

    hrs = hours_since(data.get("timestamp"))
    if hrs is not None and hrs > CONFIG["stale_hours"]:
        alerts.append("Data is stale")

    if data.get("spo2") is not None and data["spo2"] < CONFIG["critical_spo2"]:
        critical = True
        alerts.append("CRITICAL: Oxygen dangerously low")

    if data.get("breathlessness") is True:
        critical = True
        alerts.append("CRITICAL: Breathing difficulty")

    phys_score, phys_reasons = news_like_score(data)
    score += phys_score
    alerts.extend(phys_reasons)

    pain = data.get("pain")
    if pain is not None:
        if pain >= CONFIG["extreme_pain"]:
            score += 3
            alerts.append("Extreme pain")
        elif pain >= CONFIG["severe_pain"]:
            score += 2
            alerts.append("Severe pain")

    if data.get("wound_discharge"):
        score += 3
        alerts.append("Possible wound infection")

    if data.get("missed_doses", 0) >= 3:
        score += 2
        alerts.append("Multiple medication doses missed")

    t_score, t_alerts = trend_analysis(history or [], data)
    score += t_score
    alerts.extend(t_alerts)

    if baseline and data.get("heart_rate") and baseline.get("heart_rate"):
        if data["heart_rate"] > baseline["heart_rate"] + 20:
            score += 1
            alerts.append("HR elevated from personal baseline")

    if surgery_type == "cardiac" and data.get("spo2", 100) < 95:
        score += 1
        alerts.append("Cardiac patient oxygen caution")

    if critical:
        risk = "CRITICAL"
    elif score >= 9:
        risk = "CRITICAL"
    elif score >= 4:
        risk = "WARNING"
    else:
        risk = "NORMAL"

    confidence = 95
    if not history or len(history) < 3:
        confidence -= 5

    confidence -= len(missing) * CONFIG["missing_penalty"]

    if hrs and hrs > CONFIG["stale_hours"]:
        confidence -= 20

    if validation_issues:
        confidence -= 25

    confidence = max(0, confidence)

    if risk == "CRITICAL":
        action = "Immediate medical attention required"
    elif risk == "WARNING":
        action = "Doctor review within 24 hours"
    else:
        action = "Continue routine monitoring"

    return {
        "risk": risk,
        "score": score,
        "confidence": confidence,
        "alerts": alerts,
        "missing_fields": missing,
        "recommended_action": action,
    }


def map_log_to_engine_input(log_data: dict) -> dict:
    """Maps app symptom-log shape to risk-engine expected fields."""
    return {
        "temperature": log_data.get("temperature"),
        "spo2": log_data.get("spo2"),
        "pain": log_data.get("pain") if log_data.get("pain") is not None else log_data.get("pain_score"),
        "heart_rate": log_data.get("heart_rate"),
        "breathlessness": bool(log_data.get("breathlessness", False)),
        "wound_discharge": bool(log_data.get("wound_discharge", log_data.get("discharge", False))),
        "missed_doses": log_data.get("missed_doses", 1 if log_data.get("antibiotics_taken") is False else 0),
        "timestamp": datetime.now(),
    }


def fetch_patient_history(patient_id: str, limit: int = 10) -> list[dict]:
    """Loads recent symptom logs and converts them to engine input format."""
    try:
        logs_ref = db.collection("symptom_logs")
        query = (
            logs_ref.where("patientId", "==", patient_id)
            .order_by("createdAt", direction=firestore.Query.DESCENDING)
            .limit(limit)
        )

        docs = [doc.to_dict() for doc in query.stream()]
        docs.reverse()
        return [map_log_to_engine_input(item) for item in docs]
    except Exception as exc:
        print(f"History fetch failed for {patient_id}: {exc}")
        return []


def risk_to_traffic_label(risk: str) -> Literal["GREEN", "YELLOW", "RED"]:
    mapping = {
        "NORMAL": "GREEN",
        "WARNING": "YELLOW",
        "CRITICAL": "RED",
    }
    return mapping.get(risk, "GREEN")


@app.post("/api/submit_log", response_model=RiskResponse)
async def submit_log(log: SymptomLog):
    """Submit symptom log and return rule-engine risk in existing response format."""
    try:
        log_dict = log.dict()
        history = fetch_patient_history(log.patientId)
        engine_input = map_log_to_engine_input(log_dict)

        result = evaluate_patient_ultra(
            engine_input,
            history=history,
            surgery_type="general",
            baseline=None,
        )

        final_risk = risk_to_traffic_label(result["risk"])
        message = "; ".join(result["alerts"]) if result["alerts"] else result["recommended_action"]

        log_ref = db.collection("symptom_logs").document(log.log_id)
        log_ref.update(
            {
                "risk": final_risk,
                "rule_risk": final_risk,
                "trend_risk": final_risk,
                "risk_assessed_at": datetime.now(),
                "risk_details": result,
            }
        )

        return RiskResponse(
            risk=final_risk,
            message=message,
            rule_risk=final_risk,
            trend_risk=final_risk,
        )

    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Error processing log: {str(exc)}")


@app.get("/api/health")
async def health_check():
    return {"status": "ok", "message": "Post-Op Guardian API is running"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
