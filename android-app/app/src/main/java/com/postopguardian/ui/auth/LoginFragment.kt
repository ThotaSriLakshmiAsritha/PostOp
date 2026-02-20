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
import com.postopguardian.databinding.FragmentLoginBinding

class LoginFragment : Fragment() {

    private var _binding: FragmentLoginBinding? = null
    private val binding get() = _binding!!
    
    private val auth = FirebaseAuth.getInstance()
    private val db = FirebaseFirestore.getInstance()

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentLoginBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        
        binding.loginButton.setOnClickListener {
            login()
        }
        
        binding.registerLink.setOnClickListener {
            findNavController().navigate(R.id.action_login_to_register)
        }
    }
    
    private fun login() {
        val email = binding.emailEditText.text.toString().trim()
        val password = binding.passwordEditText.text.toString()
        val selectedRole = if (binding.roleRadioGroup.checkedRadioButtonId == R.id.doctorRadio) {
            "doctor"
        } else {
            "patient"
        }
        
        if (email.isEmpty() || password.isEmpty()) {
            Toast.makeText(requireContext(), "Please fill all fields", Toast.LENGTH_SHORT).show()
            return
        }
        
        if (password.length < 6) {
            Toast.makeText(requireContext(), "Password must be at least 6 characters", Toast.LENGTH_SHORT).show()
            return
        }
        
        binding.loginButton.isEnabled = false
        binding.loginButton.text = "Logging in..."
        
        auth.signInWithEmailAndPassword(email, password)
            .addOnCompleteListener { task ->
                binding.loginButton.isEnabled = true
                binding.loginButton.text = getString(R.string.login)
                
                if (task.isSuccessful) {
                    val user = auth.currentUser
                    if (user != null) {
                        // Get user role from Firestore
                        db.collection("users").document(user.uid).get()
                            .addOnSuccessListener { document ->
                                val role = document.getString("role") ?: "patient"
                                if (role.lowercase() != selectedRole) {
                                    auth.signOut()
                                    Toast.makeText(
                                        requireContext(),
                                        getString(R.string.error_role_mismatch),
                                        Toast.LENGTH_SHORT
                                    ).show()
                                    return@addOnSuccessListener
                                }
                                navigateToRoleDashboard(role)
                            }
                            .addOnFailureListener {
                                auth.signOut()
                                Toast.makeText(
                                    requireContext(),
                                    getString(R.string.error_user_data_missing),
                                    Toast.LENGTH_SHORT
                                ).show()
                            }
                    }
                } else {
                    Toast.makeText(
                        requireContext(),
                        "Login failed: ${task.exception?.message}",
                        Toast.LENGTH_SHORT
                    ).show()
                }
            }
    }
    
    private fun navigateToRoleDashboard(role: String) {
        when (role.lowercase()) {
            "doctor" -> findNavController().navigate(R.id.action_login_to_doctor_main)
            else -> findNavController().navigate(R.id.action_login_to_patient_main)
        }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
