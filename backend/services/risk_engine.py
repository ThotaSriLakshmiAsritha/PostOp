from services.trend_analyzer import TrendAnalyzer
from ml.ml_placeholder import predict_ml_risk

class RiskEngine:
    def __init__(self):
        self.trend_analyzer = TrendAnalyzer()

    def run_rules(self, log_data):
        """
        Layer 1: Deterministic Rule Engine
        RED if: temp >= 38, discharge == True, pain >= 9
        YELLOW if: missed antibiotics, moderate swelling
        """
        risk = 0 # 0=Green, 1=Yellow, 2=Red
        
        # Red Flags
        if (log_data.temperature >= 38 or 
            log_data.discharge == True or 
            log_data.pain_score >= 9 or
            log_data.redness.lower() == "severe"):
            return 2
            
        # Yellow Flags
        if (not log_data.antibiotics_taken or 
            log_data.swelling.lower() in ["moderate", "severe"] or
            log_data.pain_score >= 6 or
            log_data.fatigue.lower() == "high"):
            risk = 1
            
        return risk

    def calculate_risk(self, current_log, historical_logs):
        """
        Calculates final risk using Rule, Trend, and ML layers.
        """
        rule_risk = self.run_rules(current_log)
        trend_risk = self.trend_analyzer.analyze(historical_logs)
        ml_risk = predict_ml_risk(current_log.dict())
        
        final_risk_val = max(rule_risk, trend_risk, ml_risk)
        
        risk_map = {0: "green", 1: "yellow", 2: "red"}
        risk_level = risk_map[final_risk_val]
        
        # Smart Escalation Messaging
        messages = {
            "green": "Your recovery is on track. Keep following the plan!",
            "yellow": "Minor issues detected. Please rest more and monitor closely.",
            "red": "High risk detected! A doctor has been notified. Please seek immediate attention."
        }
        
        escalations = {
            "green": "Continue monitoring.",
            "yellow": "Increased monitoring requested. Check temperature every 4 hours.",
            "red": "Doctor notified via dashboard. Fallback to caregiver if no response in 1 hour."
        }
        
        return {
            "risk_level": risk_level,
            "risk_score": float(final_risk_val),
            "message": messages[risk_level],
            "escalation_action": escalations[risk_level]
        }
