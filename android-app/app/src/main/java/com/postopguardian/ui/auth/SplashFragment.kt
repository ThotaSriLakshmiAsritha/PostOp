package com.postopguardian.ui.auth

import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.fragment.app.Fragment
import androidx.navigation.fragment.findNavController
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import com.postopguardian.R
import com.postopguardian.databinding.FragmentSplashBinding

class SplashFragment : Fragment() {

    private var _binding: FragmentSplashBinding? = null
    private val binding get() = _binding!!
    
    private val auth = FirebaseAuth.getInstance()
    private val db = FirebaseFirestore.getInstance()
    private val handler = Handler(Looper.getMainLooper())
    private val routeRunnable = Runnable { checkAuthState() }

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentSplashBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        handler.postDelayed(routeRunnable, 2000)
    }
    
    private fun checkAuthState() {
        val currentUser = auth.currentUser
        if (currentUser != null) {
            // User is logged in, get their role and navigate accordingly
            db.collection("users").document(currentUser.uid).get()
                .addOnSuccessListener { document ->
                    if (!isAdded) return@addOnSuccessListener
                    val role = document.getString("role") ?: "patient"
                    navigateToDashboard(role)
                }
                .addOnFailureListener {
                    if (!isAdded) return@addOnFailureListener
                    // If role not found, go to login
                    findNavController().navigate(R.id.action_splash_to_login)
                }
        } else {
            // User not logged in, go to login screen
            findNavController().navigate(R.id.action_splash_to_login)
        }
    }
    
    private fun navigateToDashboard(role: String) {
        when (role.lowercase()) {
            "doctor" -> findNavController().navigate(R.id.action_splash_to_doctor_main)
            else -> findNavController().navigate(R.id.action_splash_to_patient_main)
        }
    }

    override fun onDestroyView() {
        handler.removeCallbacks(routeRunnable)
        super.onDestroyView()
        _binding = null
    }
}
