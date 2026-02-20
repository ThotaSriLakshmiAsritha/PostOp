from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()

class AlertAcknowledge(BaseModel):
    alert_id: str
    doctor_id: str

@router.post("/acknowledge_alert")
async def acknowledge_alert(req: AlertAcknowledge):
    # Logic to update Firestore alert status to 'acknowledged'
    return {"status": "success", "message": f"Alert {req.alert_id} acknowledged by {req.doctor_id}"}
