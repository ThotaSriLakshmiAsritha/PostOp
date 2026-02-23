from fastapi import APIRouter, HTTPException
from services.firebase_service import FirebaseService
from services.risk_engine import RiskEngine
from models.log_model import DailyLog

router = APIRouter()
firebase_service = FirebaseService()
risk_engine = RiskEngine()

@router.get("/risk/{patient_id}")
async def get_patient_risk(patient_id: str):
    """Get latest risk status for a patient"""
    logs = firebase_service.get_historical_logs(patient_id)
    if not logs:
        return {"patient_id": patient_id, "risk_level": "green", "risk_score": 0.0, "message": "No logs yet"}
    
    latest_log_dict = logs[0]
    # Convert dict to DailyLog model
    latest_log = DailyLog(**latest_log_dict)
    
    risk_data = risk_engine.calculate_risk(latest_log, logs[1:])
    return {
        "patient_id": patient_id,
        **risk_data
    }

@router.get("/patient_logs/{patient_id}")
async def get_patient_logs(patient_id: str):
    """Get historical logs for a patient"""
    logs = firebase_service.get_historical_logs(patient_id)
    return {"patient_id": patient_id, "logs": logs}

@router.get("/flagged_patients")
async def get_flagged_patients():
    """Get all patients with yellow or red risk status"""
    flagged = firebase_service.get_flagged_patients()
    return {"flagged": flagged}

@router.get("/recovery_score/{patient_id}")
async def get_recovery_score(patient_id: str):
    """Get recovery score for a patient"""
    score = firebase_service.calculate_recovery_score(patient_id)
    return {"patient_id": patient_id, "recovery_score": score}
