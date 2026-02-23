# Quick Start Guide

## 🚀 Fast Setup (5 minutes)

### 1. Install Dependencies

```bash
# Frontend
npm install

# Backend
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
cd ..
```

### 2. Firebase Quick Setup

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create project → Enable Authentication (Email/Password)
3. Create Firestore Database (Start in test mode for MVP)
4. Copy config from Project Settings → General → Your apps → Web app
5. Create `.env` file:
```bash
cp .env.example .env
```
6. Paste Firebase config into `.env`

### 3. Start Development Servers

**Terminal 1 - Frontend:**
```bash
npm run dev
```

**Terminal 2 - Backend:**
```bash
cd backend
uvicorn main:app --reload
```

### 4. Test the Application

1. Open `http://localhost:3000`
2. Register as Patient
3. Register as Doctor
4. Login as Patient → Log Symptoms
5. Login as Doctor → View Patients

## 🎯 Key Features to Test

### Patient Flow
1. ✅ Login → See Dashboard
2. ✅ Log Symptoms → See Risk Badge Update
3. ✅ View Trends → See Charts
4. ✅ Create Reminder → Sync to Calendar
5. ✅ Click SOS → Send Alert
6. ✅ Chat with Doctor

### Doctor Flow
1. ✅ Login → See Dashboard
2. ✅ View Patient List → Filter by Risk
3. ✅ Click Patient → See Details
4. ✅ View Charts → See Trends
5. ✅ Acknowledge Alert
6. ✅ Chat with Patient

## 🔧 Common Issues

**Firebase Auth Error:**
- Check `.env` file has correct values
- Ensure Email/Password provider is enabled

**Backend Error:**
- Check Firebase Admin credentials
- Ensure backend is running on port 8000

**CORS Error:**
- Verify backend CORS settings include `http://localhost:3000`

**Firestore Permission Error:**
- Use test mode rules for MVP
- Or update security rules (see SETUP.md)

## 📱 Demo Credentials

Create test accounts:
- Patient: `patient@test.com` / `password123`
- Doctor: `doctor@test.com` / `password123`

## 🎉 You're Ready!

The application is now running. Check `SETUP.md` for detailed configuration and `PROJECT_SUMMARY.md` for feature overview.
