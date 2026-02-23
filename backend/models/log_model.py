from pydantic import BaseModel
from typing import Optional

class DailyLog(BaseModel):
    patient_id: str
    
    # Clinical
    pain_score: int  # 0-10
    temperature: float
    redness: str  # e.g., "None", "Mild", "Moderate", "Severe"
    swelling: str # e.g., "None", "Mild", "Moderate", "Severe"
    discharge: bool
    
    # Functional
    mobility: str
    sleep_hours: float
    appetite: str
    fatigue: str
    mood: str
    
    # Medication
    antibiotics_taken: bool
    pain_meds_taken: bool
    dressing_changed: bool
    
    timestamp: Optional[str] = None
