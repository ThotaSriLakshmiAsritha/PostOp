# Post-Op Guardian - AI-Assisted Post-Surgery Recovery Companion

A web-based recovery monitoring platform for post-surgery patients and doctors.

## Tech Stack

### Frontend
- React 18 + TypeScript
- Vite
- Material UI (MUI)
- Firebase (Auth, Firestore, FCM)
- Recharts for graphs
- react-i18next for multilingual support

### Backend
- Python 3.10+
- FastAPI
- Firebase Admin SDK
- Pandas + NumPy for trend analysis

## Setup

### Frontend
```bash
npm install
npm run dev
```

### Backend
```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload
```

## Firebase Configuration

1. Create a Firebase project
2. Enable Authentication (Email/Password)
3. Create Firestore database
4. Enable Cloud Messaging
5. Copy config to `src/config/firebase.ts`

## Environment Variables

Create `.env` file:
```
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_auth_domain
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_storage_bucket
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_BACKEND_URL=http://localhost:8000
```
