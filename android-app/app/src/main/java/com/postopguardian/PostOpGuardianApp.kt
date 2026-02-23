package com.postopguardian

import android.app.Application
import android.util.Log

class PostOpGuardianApp : Application() {
    override fun onCreate() {
        super.onCreate()

        Thread.setDefaultUncaughtExceptionHandler { thread, throwable ->
            Log.e("GlobalCrash", "Uncaught exception on thread ${thread.name}", throwable)
        }
    }
}
