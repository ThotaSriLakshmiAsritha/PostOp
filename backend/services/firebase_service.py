import firebase_admin
from firebase_admin import credentials, firestore, messaging
import os
from dotenv import load_dotenv

load_dotenv()

# Initialize Firebase Admin SDK (only once)
if not firebase_admin._apps:
    try:
        cred_path = os.getenv("FIREBASE_SERVICE_ACCOUNT_PATH", "firebase_key.json")
        if os.path.exists(cred_path):
            cred = credentials.Certificate(cred_path)
            firebase_admin.initialize_app(cred)
        else:
            print("Firebase credentials file not found. Using mock mode.")
    except Exception as e:
        print(f"Firebase Admin SDK initialization error: {e}")

db = firestore.client() if firebase_admin._apps else None

class FirebaseService:
    def save_log(self, patient_id, log_data):
        if db:
            db.collection("daily_logs").add(log_data)
        return True

    def get_historical_logs(self, patient_id):
        if not db:
            return []
        
        docs = db.collection("daily_logs")\
                .where("patient_id", "==", patient_id)\
                .order_by("timestamp", direction=firestore.Query.DESCENDING)\
                .limit(10)\
                .stream()
        
        return [doc.to_dict() for doc in docs]

    def create_alert(self, patient_id, risk_data):
        if db:
            alert_data = {
                "patient_id": patient_id,
                "risk_level": risk_data["risk_level"],
                "message": risk_data["message"],
                "status": "pending",
                "timestamp": firestore.SERVER_TIMESTAMP
            }
            db.collection("alerts").add(alert_data)
            
            # Stub for FCM trigger
            if risk_data["risk_level"] == "red":
                self.send_push_notification("Doctor", f"EMERGENCY: Patient {patient_id} needs attention.")

    def send_push_notification(self, target_role, message):
        """
        Stub for FCM notification logic.
        """
        print(f"NOTIFYING {target_role}: {message}")
        # if db:
        #    # Actual FCM logic here
        #    pass
    
    def get_patient_info(self, patient_id):
        """Get patient information from Firestore"""
        if not db:
            return None
        try:
            doc = db.collection("patients").document(patient_id).get()
            if doc.exists:
                return doc.to_dict()
            return None
        except Exception as e:
            print(f"Error getting patient info: {e}")
            return None
    
    def get_flagged_patients(self):
        """Get all patients with yellow or red risk status"""
        if not db:
            return []
        try:
            # Get recent alerts
            alerts = db.collection("alerts")\
                .where("status", "==", "pending")\
                .order_by("timestamp", direction=firestore.Query.DESCENDING)\
                .limit(50)\
                .stream()
            
            flagged = []
            seen_patients = set()
            
            for alert_doc in alerts:
                alert_data = alert_doc.to_dict()
                patient_id = alert_data.get("patient_id")
                
                if patient_id and patient_id not in seen_patients:
                    seen_patients.add(patient_id)
                    # Get latest log for this patient
                    logs = self.get_historical_logs(patient_id)
                    latest_log = logs[0] if logs else None
                    
                    flagged.append({
                        "patient_id": patient_id,
                        "patient_name": f"Patient {patient_id[-4:]}",
                        "surgery_type": "Unknown",  # Should be stored in patient doc
                        "risk_level": alert_data.get("risk_level", "yellow"),
                        "last_update": alert_data.get("timestamp", ""),
                        "message": alert_data.get("message", "")
                    })
            
            return flagged
        except Exception as e:
            print(f"Error getting flagged patients: {e}")
            return []
    
    def calculate_recovery_score(self, patient_id):
        """Calculate recovery score based on recent logs"""
        logs = self.get_historical_logs(patient_id)
        if not logs or len(logs) < 2:
            return 50  # Default score
        
        # Simple scoring algorithm
        score = 100
        recent_logs = logs[:5]  # Last 5 logs
        
        for log in recent_logs:
            # Deduct points for issues
            if log.get("pain_score", 0) > 7:
                score -= 10
            elif log.get("pain_score", 0) > 4:
                score -= 5
            
            if log.get("temperature", 37) > 37.5:
                score -= 5
            
            if log.get("discharge", False):
                score -= 15
            
            if not log.get("antibiotics_taken", True):
                score -= 10
            
            if log.get("swelling", "").lower() in ["moderate", "severe"]:
                score -= 5
        
        return max(0, min(100, score))
