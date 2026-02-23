package com.postopguardian

import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.util.Log
import androidx.appcompat.app.AppCompatActivity
import androidx.navigation.findNavController
import com.postopguardian.databinding.ActivityMainBinding
import com.postopguardian.utils.LocaleHelper

class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding
    private val notificationPermissionRequestCode = 1101

    override fun onCreate(savedInstanceState: Bundle?) {
        // Set locale before super.onCreate
        val language = LocaleHelper.getLanguage(this)
        LocaleHelper.setLocale(this, language)
        super.onCreate(savedInstanceState)

        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        val navHostFragment =
            supportFragmentManager.findFragmentById(R.id.nav_host_fragment_activity_main)
        if (navHostFragment == null) {
            Log.e("MainActivity", "NavHostFragment not found! Check activity_main.xml")
        } else {
            val navController = findNavController(R.id.nav_host_fragment_activity_main)
            Log.d(
                "MainActivity",
                "Navigation initialized. Start destination: ${navController.graph.startDestinationId}"
            )
        }

        requestNotificationPermissionIfNeeded()
    }

    override fun attachBaseContext(newBase: android.content.Context) {
        val language = LocaleHelper.getLanguage(newBase)
        super.attachBaseContext(LocaleHelper.setLocale(newBase, language))
    }

    private fun requestNotificationPermissionIfNeeded() {
        if (Build.VERSION.SDK_INT >= 33) {
            val permission = "android.permission.POST_NOTIFICATIONS"
            if (checkSelfPermission(permission) != PackageManager.PERMISSION_GRANTED) {
                requestPermissions(arrayOf(permission), notificationPermissionRequestCode)
            }
        }
    }
}
