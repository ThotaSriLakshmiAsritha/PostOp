# Post-Op Guardian Android App - Workflow Documentation

## App Architecture

**Architecture Pattern:** Single Activity with Navigation Component (Fragment-based)
- **Main Activity:** `MainActivity` (hosts NavHostFragment)
- **Navigation:** Android Navigation Component
- **Start Destination:** `SplashFragment`

---

## Complete User Workflows

### 1. **App Launch & Authentication Flow**

```
App Launch
    ->
MainActivity (hosts NavHostFragment)
    ->
SplashFragment (2 second delay)
    ->
    |- Check Firebase Auth State
    |   |- User Logged In?
    |   |   |- YES -> Get User Role from Firestore
    |   |   |   |- Role = "patient" -> Navigate to PatientDashboardFragment
    |   |   |   `- Role = "doctor" -> Navigate to DoctorPatientsFragment
    |   |   `- NO -> Navigate to LoginFragment
    |
    `- LoginFragment
        |- User clicks "Register" -> RegisterFragment
        |- User enters credentials -> Firebase Auth Sign In
        |   |- Success -> Get Role -> Navigate to Dashboard
        |   `- Failure -> Show Error Toast
        |
        `- RegisterFragment
            |- User fills form (name, email, password, role)
            |- Firebase Auth Create Account
            |- Save user data to Firestore (users collection)
            `- Navigate to Dashboard based on role
```

---

### 2. **Patient User Flow**

#### **2.1 Patient Dashboard (Main Hub)**

```
PatientDashboardFragment
    |- Displays:
    |   |- Risk Status Badge (Green/Yellow/Red)
    |   |- Recovery Score (%)
    |   |- Days Since Surgery
    |   |- Pain Trend Chart (MPAndroidChart)
    |   `- Temperature Trend Chart (MPAndroidChart)
    |
    |- Actions:
    |   |- "Open Daily Log" Button -> DailyLogFragment
    |   |- "Open Chat" Button -> ChatFragment
    |   |- "Video Consultation" Button -> Opens Google Meet Link
    |   |- "Reminders" Button -> RemindersFragment
    |   |- Language Button (top-right) -> Language Selection Dialog
    |   `- SOS Button (floating) -> Emergency Dialog
    |
    `- Data Loading:
        |- Fetch patient logs from API (/patient_logs/{patient_id})
        |- Calculate risk level from latest log
        |- Update charts with historical data
        `- Calculate recovery score
```

#### **2.2 Daily Symptom Logging**

```
DailyLogFragment
    |- Form Fields:
    |   |- Clinical Inputs:
    |   |   |- Pain Score (0-10 SeekBar)
    |   |   |- Temperature (deg C) - TextInput
    |   |   |- Redness (Spinner: None/Mild/Moderate/Severe)
    |   |   |- Swelling (Spinner: None/Mild/Moderate/Severe)
    |   |   `- Discharge/Pus (Switch)
    |   |
    |   |- Functional Inputs:
    |   |   |- Mobility Level (Spinner)
    |   |   |- Sleep Hours (TextInput)
    |   |   |- Appetite (Spinner)
    |   |   |- Fatigue (Spinner)
    |   |   `- Mood (Spinner)
    |   |
    |   `- Medication Inputs:
    |       |- Antibiotics Taken (Checkbox)
    |       |- Pain Meds Taken (Checkbox)
    |       `- Dressing Changed (Checkbox)
    |
    |- User clicks "Submit Daily Log"
    |   |- Validate inputs
    |   |- Create DailyLog object
    |   |- POST to API (/submit_log)
    |   |- Backend processes:
    |   |   |- Run Risk Engine (rules + trends)
    |   |   |- Save log to Firestore (daily_logs collection)
    |   |   |- Create alert if risk = Yellow/Red
    |   |   `- Return RiskResponse
    |   |
    |   `- On Success:
    |       |- Show success toast with risk level
    |       `- Navigate back to PatientDashboardFragment
```

#### **2.3 Chat with Doctor**

```
ChatFragment
    |- Real-time Firestore Listener:
    |   `- Listens to: chats/{chatId}/messages collection
    |
    |- Display:
    |   |- RecyclerView with messages
    |   |- Messages sorted by timestamp
    |   `- Color-coded (sent vs received)
    |
    |- User Actions:
    |   |- Type message in EditText
    |   |- Click Send Button
    |   `- Message saved to Firestore
    |
    `- Navigation:
        `- Back button -> PatientDashboardFragment
```

#### **2.4 Medication Reminders**

```
RemindersFragment
    |- Display:
    |   `- RecyclerView with all reminders
    |       |- Reminder title
    |       |- Time
    |       `- Repeat status (Daily/One-time)
    |
    |- User Actions:
    |   |- Click FAB (+) -> Show Add Reminder Dialog
    |   |- Long-press reminder -> Delete confirmation
    |   `- Toggle reminder on/off
    |
    `- Add Reminder Dialog:
        |- Enter reminder title
        |- Select time (TimePickerDialog)
        |- Toggle "Repeat Daily"
        |- Toggle "Add to Google Calendar"
        |- Click "Save Reminder"
        |   |- Save to Firestore (reminders collection)
        |   `- If calendar enabled -> Open Google Calendar Intent
        `- Dialog closes, list updates
```

#### **2.5 Video Consultation**

```
User clicks "Video Consultation" Button
    |- Fetch Google Meet link from Firestore
    |   `- Query: doctors/{doctor_id}/meet_link
    |
    |- Open Intent:
    |   `- ACTION_VIEW -> Google Meet URL
    |
    `- Opens in browser/app
```

#### **2.6 SOS Emergency**

```
User clicks SOS Button
    |- Show AlertDialog:
    |   |- "Call Doctor" -> Dial intent
    |   |- "Call Caregiver" -> Dial intent
    |   `- "Cancel"
    |
    `- Creates emergency alert in Firestore (if needed)
```

---

### 3. **Doctor User Flow**

#### **3.1 Doctor Dashboard (Patients List)**

```
DoctorPatientsFragment
    |- Display:
    |   `- RecyclerView with flagged patients
    |       |- Patient name
    |       |- Surgery type
    |       |- Current risk (color indicator)
    |       `- Last update time
    |
    |- Data Loading:
    |   |- Fetch from API (/flagged_patients)
    |   `- Listen to Firestore alerts collection
    |
    |- User Actions:
    |   |- Click patient -> Navigate to Patient Detail (TODO)
    |   `- Click "Open Alerts" -> DoctorAlertsFragment
    |
    `- Filters (Future):
        |- All patients
        |- Yellow only
        `- Red only
```

#### **3.2 Doctor Alerts**

```
DoctorAlertsFragment
    |- Real-time Firestore Listener:
    |   `- Listens to: alerts collection
    |       `- Filters: status = "pending"
    |
    |- Display:
    |   `- RecyclerView with alerts
    |       |- Alert title (risk level + message)
    |       |- Patient ID
    |       `- Timestamp
    |
    |- User Actions:
    |   `- Click "Acknowledge" Button
    |       |- POST to API (/acknowledge_alert)
    |       |- Update Firestore: status = "acknowledged"
    |       `- Show success toast
    |
    `- Navigation:
        `- "Back to Patients" -> DoctorPatientsFragment
```

---

## Authentication & Authorization

### **User Registration**
```
RegisterFragment
    ->
User enters: Name, Email, Password, Role (Patient/Doctor)
    ->
Firebase Auth: createUserWithEmailAndPassword()
    ->
On Success:
    |- Save to Firestore: users/{uid}
    |   `- Fields: uid, email, name, role
    |
    `- Navigate based on role:
        |- patient -> PatientDashboardFragment
        `- doctor -> DoctorPatientsFragment
```

### **User Login**
```
LoginFragment
    ->
User enters: Email, Password, Role (Patient/Doctor)
    ->
Firebase Auth: signInWithEmailAndPassword()
    ->
On Success:
    |- Get user role from Firestore: users/{uid}/role
    |
    `- Navigate based on role:
        |- patient -> PatientDashboardFragment
        `- doctor -> DoctorPatientsFragment
```

### **Session Management**
```
SplashFragment (on app launch)
    ->
Check: FirebaseAuth.currentUser
    ->
    |- User exists?
    |   |- YES -> Get role -> Navigate to dashboard
    |   `- NO -> Navigate to LoginFragment
    |
    `- 2 second delay for splash screen
```

---

## Risk Engine Workflow

### **Risk Calculation Process**

```
Daily Log Submission
    ->
POST /submit_log
    ->
Backend: RiskEngine.calculate_risk()
    ->
    |- Layer 1: Rule Engine
    |   |- RED if:
    |   |   |- temperature >= 38 C
    |   |   |- discharge == true
    |   |   |- pain_score >= 9
    |   |   `- redness == "Severe"
    |   |
    |   |- YELLOW if:
    |   |   |- antibiotics_taken == false
    |   |   |- swelling in ["Moderate", "Severe"]
    |   |   |- pain_score >= 6
    |   |   `- fatigue == "High"
    |   |
    |   `- GREEN otherwise
    |
    |- Layer 2: Trend Analysis
    |   |- Get last 3-5 logs
    |   |- Calculate pain slope
    |   |- Calculate temperature slope
    |   `- Escalate if increasing trends
    |
    `- Final Risk = max(rule_risk, trend_risk)
        ->
    Save log to Firestore
        ->
    If risk = Yellow/Red:
        |- Create alert in Firestore
        `- Send notification (if RED)
            ->
    Return RiskResponse to client
        ->
    Update PatientDashboardFragment
        |- Update risk badge color
        |- Show risk message
        `- Trigger UI warnings if RED
```

---

## Data Flow

### **Firestore Collections Structure**

```
Firestore
|- users/
|   `- {uid}/
|       |- email: string
|       |- name: string
|       `- role: "patient" | "doctor"
|
|- daily_logs/
|   `- {log_id}/
|       |- patient_id: string
|       |- pain_score: int
|       |- temperature: float
|       |- redness: string
|       |- swelling: string
|       |- discharge: bool
|       |- mobility: string
|       |- sleep_hours: float
|       |- appetite: string
|       |- fatigue: string
|       |- mood: string
|       |- antibiotics_taken: bool
|       |- pain_meds_taken: bool
|       |- dressing_changed: bool
|       `- timestamp: timestamp
|
|- alerts/
|   `- {alert_id}/
|       |- patient_id: string
|       |- risk_level: "yellow" | "red"
|       |- message: string
|       |- status: "pending" | "acknowledged"
|       `- timestamp: timestamp
|
|- chats/
|   `- {chat_id}/
|       `- messages/
|           `- {message_id}/
|               |- senderId: string
|               |- receiverId: string
|               |- message: string
|               `- timestamp: timestamp
|
|- reminders/
|   `- {reminder_id}/
|       |- patient_id: string
|       |- title: string
|       |- time: string (HH:mm)
|       |- repeat_daily: bool
|       |- enabled: bool
|       `- timestamp: timestamp
|
`- doctors/
    `- {doctor_id}/
        `- meet_link: string (Google Meet URL)
```

---

## Navigation Graph

```
SplashFragment (START)
    |- LoginFragment
    |   |- RegisterFragment
    |   |- PatientDashboardFragment
    |   `- DoctorPatientsFragment
    |
    |- PatientDashboardFragment (if logged in as patient)
    |   |- DailyLogFragment
    |   |- ChatFragment
    |   `- RemindersFragment
    |
    `- DoctorPatientsFragment (if logged in as doctor)
        `- DoctorAlertsFragment
```

---

## Multilingual Support Flow

```
User clicks Language Button
    ->
Show Language Selection Dialog
    |- English
    |- Hindi
    `- Telugu
    ->
User selects language
    ->
LocaleHelper.setLocale(context, languageCode)
    ->
Save preference to SharedPreferences
    ->
Restart Activity
    ->
All strings load from:
    |- values/strings.xml (English)
    |- values-hi/strings.xml (Hindi)
    `- values-te/strings.xml (Telugu)
```

---

## Alert Escalation Flow

```
Risk Detection (Yellow/Red)
    ->
Create Alert in Firestore
    |- Collection: alerts
    |- Status: "pending"
    `- Risk Level: "yellow" | "red"
    ->
If RED:
    |- Send Push Notification to Doctor
    `- Show Urgent UI Warning to Patient
    ->
Doctor sees alert in DoctorAlertsFragment
    ->
Doctor clicks "Acknowledge"
    ->
POST /acknowledge_alert
    ->
Update Firestore: status = "acknowledged"
    ->
Alert removed from pending list
```

---

## Screen Transitions Summary

### **Patient Flow**
1. **Splash** -> **Login** (if not logged in)
2. **Login** -> **Patient Dashboard** (after login)
3. **Dashboard** -> **Daily Log** -> **Dashboard** (after submission)
4. **Dashboard** -> **Chat** -> **Dashboard**
5. **Dashboard** -> **Reminders** -> **Dashboard**
6. **Dashboard** -> **Video Consultation** (external app)

### **Doctor Flow**
1. **Splash** -> **Login** (if not logged in)
2. **Login** -> **Doctor Patients** (after login)
3. **Patients** -> **Alerts** -> **Patients**
4. **Patients** -> **Patient Detail** (TODO)

---

## Key Technical Flows

### **API Communication**
```
Android App
    ->
RetrofitClient (Base URL: http://10.23.31.86:8001/)
    ->
API Endpoints:
    |- POST /submit_log
    |- GET /patient_logs/{patient_id}
    |- GET /risk/{patient_id}
    |- GET /flagged_patients
    |- GET /recovery_score/{patient_id}
    `- POST /acknowledge_alert
    ->
FastAPI Backend
    ->
Firebase Admin SDK
    ->
Firestore Database
```

### **Real-time Updates**
```
Firestore Listeners:
    |- Chat Messages: chats/{chatId}/messages
    |- Alerts: alerts (where status = "pending")
    `- Reminders: reminders (where patient_id = current_user)
    ->
On Data Change:
    |- Update RecyclerView Adapter
    |- Notify DataSetChanged()
    `- UI Updates Automatically
```

---

## MVP Success Criteria Checklist

- [x] Patient can log symptoms
- [x] Risk badge updates dynamically
- [x] Doctor sees flagged patients
- [x] Chat works in real-time
- [x] SOS works (emergency dial)
- [x] Reminder creation works
- [x] Trend graphs render (Pain & Temperature)
- [x] Video call launches (Google Meet)
- [x] Calendar integration works
- [x] Multilingual support (3 languages)
- [x] Firebase Auth integration
- [x] Role-based routing

---

## User Journey Examples

### **Example 1: Patient Daily Check-in**
```
1. Patient opens app -> Sees Dashboard
2. Clicks "Open Daily Log"
3. Fills symptom form
4. Submits log
5. Backend calculates risk = YELLOW
6. Dashboard updates with yellow badge
7. Alert created for doctor
8. Patient sees warning message
```

### **Example 2: Doctor Monitoring**
```
1. Doctor opens app -> Sees Patients List
2. Sees patient with RED risk indicator
3. Clicks "Open Alerts"
4. Sees RED alert: "High fever detected"
5. Clicks "Acknowledge"
6. Alert status updated
7. Can navigate to patient detail (TODO)
```

### **Example 3: Emergency Situation**
```
1. Patient feels unwell
2. Clicks SOS button
3. Sees emergency dialog
4. Clicks "Call Doctor"
5. Phone dialer opens
6. Patient calls doctor
7. Doctor receives call
```

---

This workflow document provides a complete overview of how the Post-Op Guardian app functions from launch to all major features.
