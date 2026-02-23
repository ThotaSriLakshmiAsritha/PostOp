# How to Run Post-Op Guardian Android App

## Prerequisites

1. **Android Studio** (Latest version recommended)
2. **JDK 8 or higher**
3. **Android SDK** (API level 23+)
4. **Firebase Project** with:
   - Authentication enabled
   - Firestore database
   - `google-services.json` file

## Setup Steps

### 1. Clone/Open the Project

```bash
cd android-app
```

### 2. Add Firebase Configuration

1. Download `google-services.json` from Firebase Console
2. Place it in: `android-app/app/google-services.json`
3. Make sure Firebase Authentication and Firestore are enabled

### 3. Configure Backend API

Update the backend URL in `RetrofitClient.kt`:
```kotlin
private const val BASE_URL = "http://YOUR_BACKEND_IP:8000/"
```

### 4. Sync Gradle

In Android Studio:
- Click **File > Sync Project with Gradle Files**
- Wait for dependencies to download

### 5. Build the Project

**Option A: Using Android Studio**
1. Click **Build > Clean Project**
2. Click **Build > Rebuild Project**
3. Wait for build to complete

**Option B: Using Command Line**
```bash
cd android-app
./gradlew clean
./gradlew assembleDebug
```

### 6. Run on Device/Emulator

**Option A: Android Studio**
1. Connect Android device (USB debugging enabled) or start emulator
2. Click **Run > Run 'app'** or press `Shift+F10`
3. Select device/emulator
4. App will install and launch

**Option B: Command Line**
```bash
./gradlew installDebug
adb shell am start -n com.postopguardian/.MainActivity
```

## Troubleshooting

### Build Errors

**Error: "Cannot access class 'MaterialRadioButton'"**
- ✅ Fixed: Updated RegisterFragment to use RadioGroup checkedRadioButtonId

**Error: "Conflicting import"**
- ✅ Fixed: Removed duplicate imports in AlertsFragment and PatientsFragment

**Error: "Unresolved reference: tasks.await"**
- ✅ Fixed: Added `kotlinx-coroutines-play-services` dependency

**Error: "package found in AndroidManifest.xml"**
- ✅ Fixed: Removed package attribute from manifest (namespace is set in build.gradle)

### Runtime Errors

**App crashes on launch:**
- Check Firebase `google-services.json` is present
- Verify internet permission in manifest
- Check Logcat for specific error messages

**Cannot connect to backend:**
- Verify backend is running on `http://YOUR_IP:8000`
- Check firewall settings
- Update BASE_URL in RetrofitClient.kt

**Firebase Auth errors:**
- Verify Authentication is enabled in Firebase Console
- Check email/password provider is enabled
- Verify `google-services.json` is correct

## Testing the App

### 1. First Launch
- App should show Splash screen (2 seconds)
- Then navigate to Login screen

### 2. Register New User
1. Click "Register" or "Create Account"
2. Fill in:
   - Name
   - Email
   - Password (min 6 characters)
   - Select role (Patient/Doctor)
3. Click "Register"
4. Should navigate to appropriate dashboard

### 3. Login
1. Enter email and password
2. Select role
3. Click "Login"
4. Should navigate to dashboard

### 4. Patient Features
- **Dashboard**: View risk status, recovery score, charts
- **Daily Log**: Submit symptom log
- **Chat**: Message doctor
- **Reminders**: Create medication reminders
- **Video**: Open Google Meet consultation
- **SOS**: Emergency call options

### 5. Doctor Features
- **Patients List**: View flagged patients
- **Alerts**: View and acknowledge alerts

## Project Structure

```
android-app/
├── app/
│   ├── src/
│   │   ├── main/
│   │   │   ├── java/com/postopguardian/
│   │   │   │   ├── ui/
│   │   │   │   │   ├── auth/ (Login, Register, Splash)
│   │   │   │   │   ├── patient/ (Dashboard, DailyLog, Reminders)
│   │   │   │   │   ├── doctor/ (Patients, Alerts)
│   │   │   │   │   └── chat/ (ChatFragment)
│   │   │   │   ├── api/ (RetrofitClient, ApiService)
│   │   │   │   ├── models/ (Data models)
│   │   │   │   └── utils/ (LocaleHelper)
│   │   │   ├── res/
│   │   │   │   ├── layout/ (All XML layouts)
│   │   │   │   ├── navigation/ (nav_graph.xml)
│   │   │   │   └── values/ (strings, colors, arrays)
│   │   │   └── AndroidManifest.xml
│   │   └── google-services.json (Firebase config)
│   └── build.gradle
└── build.gradle
```

## Dependencies

Key dependencies (already in build.gradle):
- Navigation Component
- Firebase (Auth, Firestore, Messaging)
- Retrofit (API calls)
- MPAndroidChart (Charts)
- Material Components
- Coroutines

## Next Steps After Running

1. **Test all features** according to PRD
2. **Configure Firebase** with real data
3. **Set up backend** API endpoints
4. **Add Google Meet links** to Firestore `doctors` collection
5. **Test multilingual** support (Language button)

## Support

If you encounter issues:
1. Check Logcat for error messages
2. Verify all dependencies are synced
3. Clean and rebuild project
4. Check Firebase configuration
5. Verify backend is running

---

**Happy Coding! 🚀**
