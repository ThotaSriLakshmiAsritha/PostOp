# Post-Op Guardian - Setup Guide

## Prerequisites

- Node.js 18+ and npm
- Python 3.10+
- Firebase account
- Google Cloud account (for Firebase)

## Step 1: Firebase Setup

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project or select existing one
3. Enable the following services:
   - **Authentication**: Enable Email/Password provider
   - **Firestore Database**: Create database in production mode (for MVP)
   - **Cloud Messaging**: Enable FCM (optional for notifications)

4. Get your Firebase config:
   - Go to Project Settings > General
   - Scroll down to "Your apps" section
   - Click on Web app icon
   - Copy the config values

5. Create Firestore collections structure:
   - `users` - User profiles with role
   - `patients` - Patient information
   - `symptom_logs` - Daily symptom logs
   - `alerts` - Risk alerts
   - `reminders` - Medication reminders
   - `chats` - Chat messages

6. Set up Firebase Admin SDK:
   - Go to Project Settings > Service Accounts
   - Click "Generate new private key"
   - Save the JSON file as `backend/serviceAccountKey.json`
   - Add to `.gitignore` (already included)

## Step 2: Frontend Setup

1. Install dependencies:
```bash
npm install
```

2. Configure environment variables:
```bash
cp .env.example .env
```

3. Edit `.env` and add your Firebase configuration values

4. Start development server:
```bash
npm run dev
```

The frontend will be available at `http://localhost:3000`

## Step 3: Backend Setup

1. Navigate to backend directory:
```bash
cd backend
```

2. Create virtual environment:
```bash
python -m venv venv
```

3. Activate virtual environment:
   - Windows: `venv\Scripts\activate`
   - Mac/Linux: `source venv/bin/activate`

4. Install dependencies:
```bash
pip install -r requirements.txt
```

5. Configure Firebase Admin:
   - Place your `serviceAccountKey.json` in the `backend` folder
   - Or set `FIREBASE_CREDENTIALS_PATH` in `.env`

6. Start the backend server:
```bash
uvicorn main:app --reload
```

The backend API will be available at `http://localhost:8000`

## Step 4: Firestore Security Rules (Development)

For MVP/development, you can use these basic rules:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can read/write their own data
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Patients can read/write their own data
    match /patients/{patientId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null;
    }
    
    // Symptom logs
    match /symptom_logs/{logId} {
      allow read, write: if request.auth != null;
    }
    
    // Alerts
    match /alerts/{alertId} {
      allow read, write: if request.auth != null;
    }
    
    // Reminders
    match /reminders/{reminderId} {
      allow read, write: if request.auth != null;
    }
    
    // Chats
    match /chats/{chatId} {
      allow read, write: if request.auth != null;
    }
  }
}
```

**Note**: These are permissive rules for development. For production, implement proper role-based access control.

## Step 5: Testing the Application

1. **Register a Patient**:
   - Go to `/register`
   - Create account with role "Patient"
   - Fill in patient profile (you may need to add this manually in Firestore)

2. **Register a Doctor**:
   - Go to `/register`
   - Create account with role "Doctor"

3. **Create Patient Profile** (in Firestore):
   - Go to Firestore Console
   - Create document in `patients` collection
   - Add fields:
     - `userId`: Patient's Firebase UID
     - `name`: Patient name
     - `surgeryType`: Type of surgery
     - `surgeryDate`: Timestamp

4. **Test Symptom Logging**:
   - Login as patient
   - Go to "Log Symptoms"
   - Fill out the form and submit
   - Check dashboard for risk status

5. **Test Doctor Portal**:
   - Login as doctor
   - View flagged patients
   - Check patient details
   - Test chat functionality

## Troubleshooting

### Firebase Auth Issues
- Ensure Email/Password provider is enabled
- Check that Firebase config values are correct in `.env`

### Backend API Errors
- Verify Firebase Admin SDK credentials
- Check that Firestore is initialized
- Ensure backend is running on port 8000

### CORS Errors
- Verify backend CORS settings include frontend URL
- Check that backend is running

### Firestore Permission Errors
- Review security rules
- Check that user is authenticated
- Verify collection names match exactly

## Production Deployment

For production deployment:

1. **Frontend**:
   - Build: `npm run build`
   - Deploy to Vercel, Netlify, or Firebase Hosting

2. **Backend**:
   - Deploy to Heroku, Railway, or Google Cloud Run
   - Set environment variables
   - Use production Firebase credentials

3. **Security**:
   - Implement proper Firestore security rules
   - Use environment variables for all secrets
   - Enable Firebase App Check
   - Set up proper CORS policies

## Additional Features to Implement

- Email notifications for alerts
- Push notifications via FCM
- Follow-up appointment scheduling
- Export reports (PDF)
- Advanced analytics dashboard
- Multi-language content (currently only UI is translated)
