from pydantic import BaseModel
from typing import Optional

class RiskResponse(BaseModel):
    risk_level: str  # "green", "yellow", "red"
    risk_score: float
    message: str
    escalation_action: Optional[str] = None
