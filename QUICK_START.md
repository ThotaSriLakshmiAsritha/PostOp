# 🚀 Quick Start Guide - Post-Op Guardian App

## Step-by-Step: Running the App

### Prerequisites Checklist ✅
- [x] Android Studio installed
- [x] Android device connected OR Android Emulator running
- [x] `google-services.json` copied to `android-app/app/` ✅ (Already done!)
- [ ] Backend API running (optional for testing)

---

## Method 1: Using Android Studio (Recommended)

### Step 1: Open Project
1. Open **Android Studio**
2. Click **File > Open**
3. Navigate to: `PostOpGuardian/android-app`
4. Click **OK**

### Step 2: Sync Gradle
1. Wait for Android Studio to index files
2. Click **File > Sync Project with Gradle Files**
3. Wait for sync to complete (check bottom status bar)

### Step 3: Clean & Build
1. Click **Build > Clean Project**
2. Wait for clean to finish
3. Click **Build > Rebuild Project**
4. Wait for build to complete (check Build tab at bottom)

### Step 4: Connect Device/Emulator

**Option A: Physical Device**
1. Enable **USB Debugging** on your Android phone:
   - Settings > About Phone > Tap "Build Number" 7 times
   - Settings > Developer Options > Enable "USB Debugging"
2. Connect phone via USB
3. Allow USB debugging when prompted

**Option B: Android Emulator**
1. Click **Tools > Device Manager**
2. Click **Create Device** (if no emulator exists)
3. Select a device (e.g., Pixel 5)
4. Download a system image (API 31 recommended)
5. Click **Finish**
6. Click **▶ Play** button to start emulator

### Step 5: Run the App
1. Click **Run > Run 'app'** (or press `Shift + F10`)
2. Select your device/emulator from the list
3. Click **OK**
4. App will install and launch automatically!

---

## Method 2: Using Command Line

### Step 1: Open Terminal
Navigate to project directory:
```bash
cd PostOpGuardian/android-app
```

### Step 2: Clean & Build
```bash
# Windows
gradlew.bat clean
gradlew.bat assembleDebug

# Mac/Linux
./gradlew clean
./gradlew assembleDebug
```

### Step 3: Install on Device
```bash
# Windows
gradlew.bat installDebug

# Mac/Linux
./gradlew installDebug
```

### Step 4: Launch App
```bash
adb shell am start -n com.postopguardian/.MainActivity
```

---

## What You Should See

### First Launch:
1. **Splash Screen** (2 seconds) - Shows app logo
2. **Login Screen** - Email, password, role selection

### After Login/Register:
- **Patient**: Dashboard with risk badge, charts, buttons
- **Doctor**: Patients list with flagged patients

---

## Testing the App

### Test Registration:
1. Click **"Create Account"** or **"Register"**
2. Fill in:
   - Name: `Test Patient`
   - Email: `test@example.com`
   - Password: `test1234`
   - Select **Patient** role
3. Click **Register**
4. Should navigate to Patient Dashboard

### Test Login:
1. Enter email and password
2. Select role
3. Click **Login**
4. Should navigate to dashboard

### Test Features:
- ✅ **Dashboard**: View risk status, recovery score
- ✅ **Daily Log**: Click "Open Daily Log" → Fill form → Submit
- ✅ **Chat**: Click "Open Chat" → Send message
- ✅ **Reminders**: Click "Reminders" → Add reminder
- ✅ **Video**: Click "Video Consultation" → Opens Google Meet
- ✅ **SOS**: Click red SOS button → Emergency options
- ✅ **Language**: Click language icon (top-right) → Change language

---

## Troubleshooting

### ❌ Build Fails
**Error: "google-services.json not found"**
- ✅ Already fixed! File is in `android-app/app/google-services.json`

**Error: "SDK not found"**
- Install Android SDK: **Tools > SDK Manager**
- Install Android SDK Platform 31

**Error: "Gradle sync failed"**
- Check internet connection
- File > Invalidate Caches > Invalidate and Restart

### ❌ App Crashes on Launch
**Check Logcat:**
1. Click **View > Tool Windows > Logcat**
2. Look for red error messages
3. Common issues:
   - Firebase not configured → Check `google-services.json`
   - Missing permissions → Check AndroidManifest.xml
   - Backend not running → App will use mock data

### ❌ Cannot Connect to Backend
- Backend URL is: `http://10.23.31.86:8001/`
- If backend is not running, app will use mock data
- To change URL: Edit `RetrofitClient.kt`

### ❌ Firebase Auth Errors
- Go to Firebase Console: https://console.firebase.google.com
- Select project: `postopguardian-4f3a2`
- Enable **Authentication > Sign-in method > Email/Password**
- Enable **Firestore Database**

---

## Project Structure

```
android-app/
├── app/
│   ├── google-services.json ✅ (Firebase config)
│   ├── src/
│   │   └── main/
│   │       ├── java/com/postopguardian/
│   │       │   ├── MainActivity.kt (Entry point)
│   │       │   ├── ui/ (All screens)
│   │       │   ├── api/ (Backend API)
│   │       │   └── models/ (Data models)
│   │       └── res/ (Layouts, strings, etc.)
│   └── build.gradle
└── build.gradle
```

---

## Quick Commands Reference

```bash
# Clean project
gradlew clean

# Build APK
gradlew assembleDebug

# Install on device
gradlew installDebug

# Run tests
gradlew test

# View connected devices
adb devices

# View logs
adb logcat
```

---

## Next Steps After Running

1. ✅ **Test Registration** - Create a patient account
2. ✅ **Test Login** - Login with created account
3. ✅ **Submit Daily Log** - Test symptom logging
4. ✅ **Test Chat** - Send messages (needs doctor account)
5. ✅ **Test Reminders** - Create medication reminders
6. ✅ **Test Multilingual** - Switch languages

---

## Need Help?

**Check Logcat for errors:**
- View > Tool Windows > Logcat
- Filter by "Error" or "Exception"

**Common Issues:**
- App shows "Hello Android" → Clean and rebuild
- Firebase errors → Check google-services.json location
- Build errors → Sync Gradle files

**Firebase Console:**
- https://console.firebase.google.com/project/postopguardian-4f3a2

---

## 🎉 You're Ready!

The app should now run successfully. All Firebase configuration is complete, and all compilation errors are fixed.

**Happy Testing! 🚀**
