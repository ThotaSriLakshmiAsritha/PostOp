from fastapi import APIRouter, HTTPException
from models.log_model import DailyLog
from models.response_model import RiskResponse
from services.risk_engine import RiskEngine
from services.firebase_service import FirebaseService
from datetime import datetime

router = APIRouter()
risk_engine = RiskEngine()
firebase_service = FirebaseService()

@router.post("/submit_log", response_model=RiskResponse)
async def submit_log(log: DailyLog):
    # Set timestamp if not provided
    if not log.timestamp:
        log.timestamp = datetime.utcnow().isoformat()
    
    # Get historical logs for trend analysis
    historical_logs = firebase_service.get_historical_logs(log.patient_id)
    
    # Calculate risk
    risk_data = risk_engine.calculate_risk(log, historical_logs)
    
    # Save log to Firestore
    firebase_service.save_log(log.patient_id, log.dict())
    
    # Save alert if risk is elevated
    if risk_data["risk_level"] in ["yellow", "red"]:
        firebase_service.create_alert(log.patient_id, risk_data)
        
    return RiskResponse(**risk_data)
