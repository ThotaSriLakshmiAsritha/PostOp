package com.postopguardian.ui.emergency

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Toast
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import androidx.navigation.fragment.findNavController
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import com.postopguardian.R
import com.postopguardian.databinding.FragmentEmergencyBinding
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await

class EmergencyFragment : Fragment() {
    private var _binding: FragmentEmergencyBinding? = null
    private val binding get() = _binding!!

    private val auth = FirebaseAuth.getInstance()
    private val db = FirebaseFirestore.getInstance()
    private val patientId get() = auth.currentUser?.uid.orEmpty()

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentEmergencyBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        binding.btnCallDoctor.setOnClickListener { launchDialAndAlert("doctor") }
        binding.btnCallCaregiver.setOnClickListener { launchDialAndAlert("caregiver") }
        binding.btnEmergencySos.setOnClickListener { createEmergencyAlertOnly() }
        binding.btnBackDashboard.setOnClickListener { findNavController().navigateUp() }
    }

    private fun launchDialAndAlert(target: String) {
        lifecycleScope.launch {
            val userDoc = runCatching { db.collection("users").document(patientId).get().await() }.getOrNull()
            val phone = if (target == "doctor") userDoc?.getString("doctor_phone") else userDoc?.getString("caregiver_phone")
            createAlertRecord()
            if (!phone.isNullOrBlank()) {
                startActivity(Intent(Intent.ACTION_DIAL, Uri.parse("tel:$phone")))
            } else {
                Toast.makeText(requireContext(), getString(R.string.phone_not_available), Toast.LENGTH_SHORT).show()
            }
        }
    }

    private fun createEmergencyAlertOnly() {
        lifecycleScope.launch {
            createAlertRecord()
            Toast.makeText(requireContext(), getString(R.string.sos_sent), Toast.LENGTH_SHORT).show()
        }
    }

    private suspend fun createAlertRecord() {
        db.collection("alerts").add(
            mapOf(
                "patient_id" to patientId,
                "risk_level" to "red",
                "message" to "Emergency SOS triggered by patient",
                "status" to "pending",
                "timestamp" to System.currentTimeMillis()
            )
        )
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
