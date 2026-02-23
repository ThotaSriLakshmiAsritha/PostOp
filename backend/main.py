from fastapi import FastAPI
from routers import logs, alerts, patients
import uvicorn
import firebase_admin
from firebase_admin import credentials

# Initialize Firebase
cred = credentials.Certificate("firebase_key.json")
firebase_admin.initialize_app(cred)

app = FastAPI(title="Post-Op Guardian API", description="Recovery monitoring system backend")

# Include routers
app.include_router(logs.router, tags=["Logs"])
app.include_router(alerts.router, tags=["Alerts"])
app.include_router(patients.router, tags=["Patients"])

@app.get("/")
async def root():
    return {"message": "Post-Op Guardian Backend is running", "status": "healthy"}

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
