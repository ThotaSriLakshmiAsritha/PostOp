# Post-Op Guardian Backend API

FastAPI backend for risk assessment and data processing.

## Setup

1. Install dependencies:
```bash
pip install -r requirements.txt
```

2. Set up Firebase Admin SDK:
   - Download service account key from Firebase Console
   - Set `FIREBASE_CREDENTIALS_PATH` in `.env` file
   - Or use Application Default Credentials for development

3. Run the server:
```bash
uvicorn main:app --reload
```

The API will be available at `http://localhost:8000`

## API Endpoints

- `POST /api/submit_log` - Submit symptom log and get risk assessment
- `GET /api/health` - Health check endpoint

## Risk Engine

The risk engine uses:
1. **Rule-based assessment**: Checks for RED/YELLOW conditions
2. **Trend analysis**: Analyzes pain trends from last 3 logs
3. **Risk fusion**: Takes maximum risk level
