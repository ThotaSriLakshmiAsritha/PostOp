package com.postopguardian.ui.auth

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Toast
import androidx.fragment.app.Fragment
import androidx.navigation.fragment.findNavController
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import com.postopguardian.R
import com.postopguardian.databinding.FragmentRegisterBinding

class RegisterFragment : Fragment() {

    private var _binding: FragmentRegisterBinding? = null
    private val binding get() = _binding!!
    
    private val auth = FirebaseAuth.getInstance()
    private val db = FirebaseFirestore.getInstance()

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentRegisterBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        
        binding.registerButton.setOnClickListener {
            register()
        }
        
        binding.loginLink.setOnClickListener {
            findNavController().navigateUp()
        }
    }
    
    private fun register() {
        val name = binding.nameEditText.text.toString().trim()
        val email = binding.emailEditText.text.toString().trim()
        val password = binding.passwordEditText.text.toString()
        val confirmPassword = binding.confirmPasswordEditText.text.toString()
        
        // Validation
        if (name.isEmpty() || email.isEmpty() || password.isEmpty() || confirmPassword.isEmpty()) {
            Toast.makeText(requireContext(), "Please fill all fields", Toast.LENGTH_SHORT).show()
            return
        }
        
        if (password != confirmPassword) {
            Toast.makeText(requireContext(), "Passwords do not match", Toast.LENGTH_SHORT).show()
            return
        }
        
        if (password.length < 6) {
            Toast.makeText(requireContext(), "Password must be at least 6 characters", Toast.LENGTH_SHORT).show()
            return
        }
        
        val roleRadioGroup = binding.root.findViewById<android.widget.RadioGroup>(R.id.roleRadioGroup)
        val selectedRadioId = roleRadioGroup.checkedRadioButtonId
        val role = if (selectedRadioId == R.id.doctorRadio) "doctor" else "patient"
        
        binding.registerButton.isEnabled = false
        binding.registerButton.text = "Registering..."
        
        auth.createUserWithEmailAndPassword(email, password)
            .addOnCompleteListener { task ->
                binding.registerButton.isEnabled = true
                binding.registerButton.text = getString(R.string.register)
                
                if (task.isSuccessful) {
                    val user = auth.currentUser
                    if (user != null) {
                        // Save user data to Firestore
                        val userData = hashMapOf(
                            "uid" to user.uid,
                            "email" to email,
                            "name" to name,
                            "role" to role.lowercase(),
                            "doctor_id" to "",
                            "doctor_phone" to "",
                            "caregiver_phone" to "",
                            "surgery_date" to "",
                            "surgery_type" to "",
                            "current_risk" to "green",
                            "risk_score" to 0.0,
                            "last_update_time" to System.currentTimeMillis()
                        )
                        
                        db.collection("users").document(user.uid).set(userData)
                            .addOnSuccessListener {
                                Toast.makeText(requireContext(), "Registration successful!", Toast.LENGTH_SHORT).show()
                                navigateToRoleDashboard(role)
                            }
                            .addOnFailureListener { e ->
                                Toast.makeText(
                                    requireContext(),
                                    "Failed to save user data: ${e.message}",
                                    Toast.LENGTH_SHORT
                                ).show()
                            }
                    }
                } else {
                    Toast.makeText(
                        requireContext(),
                        "Registration failed: ${task.exception?.message}",
                        Toast.LENGTH_SHORT
                    ).show()
                }
            }
    }
    
    private fun navigateToRoleDashboard(role: String) {
        when (role.lowercase()) {
            "doctor" -> findNavController().navigate(R.id.action_register_to_doctor_main)
            else -> findNavController().navigate(R.id.action_register_to_patient_main)
        }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
