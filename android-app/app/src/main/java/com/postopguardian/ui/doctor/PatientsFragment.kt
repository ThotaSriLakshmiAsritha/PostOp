package com.postopguardian.ui.doctor

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import androidx.fragment.app.Fragment
import androidx.navigation.fragment.findNavController
import androidx.navigation.navOptions
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.ListenerRegistration
import com.postopguardian.R
import com.postopguardian.databinding.FragmentDoctorPatientsBinding
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

data class PatientListItem(
    val patientId: String,
    val patientName: String,
    val surgeryType: String,
    val currentRisk: String,
    val lastUpdateTime: String
)

class PatientsFragment : Fragment() {
    private var _binding: FragmentDoctorPatientsBinding? = null
    private val binding get() = _binding!!

    private val db = FirebaseFirestore.getInstance()
    private val auth = FirebaseAuth.getInstance()
    private lateinit var patientsAdapter: PatientsAdapter
    private var usersListener: ListenerRegistration? = null

    private var allPatients = mutableListOf<PatientListItem>()
    private var filter: String = "all"

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentDoctorPatientsBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        setupRecycler()
        setupFilters()
        binding.openAlertsButton.setOnClickListener {
            runCatching { findNavController().navigate(R.id.action_patients_to_alerts) }
        }
        binding.logoutDoctorButton.setOnClickListener {
            auth.signOut()
            findNavController().navigate(
                R.id.loginFragment,
                null,
                navOptions {
                    popUpTo(R.id.splashFragment) { inclusive = true }
                    launchSingleTop = true
                }
            )
        }
        subscribePatients()
    }

    private fun setupRecycler() {
        patientsAdapter = PatientsAdapter { patient ->
            findNavController().navigate(
                R.id.action_patients_to_detail,
                Bundle().apply {
                    putString("patientId", patient.patientId)
                    putString("patientName", patient.patientName)
                    putString("riskLevel", patient.currentRisk)
                }
            )
        }
        binding.patientsRecyclerView.layoutManager = LinearLayoutManager(requireContext())
        binding.patientsRecyclerView.adapter = patientsAdapter
    }

    private fun setupFilters() {
        binding.filterChipGroup.setOnCheckedChangeListener { _, checkedId ->
            filter = when (checkedId) {
                R.id.filterYellowChip -> "yellow"
                R.id.filterRedChip -> "red"
                else -> "all"
            }
            applyFilter()
        }
    }

    private fun subscribePatients() {
        usersListener?.remove()
        usersListener = db.collection("users")
            .whereEqualTo("role", "patient")
            .addSnapshotListener { snapshot, error ->
                if (error != null || snapshot == null) {
                    allPatients = mutableListOf()
                    updatePrioritySummary()
                    applyFilter()
                    return@addSnapshotListener
                }
                allPatients = snapshot.documents.map { doc ->
                    val risk = doc.getString("current_risk").orEmpty().ifBlank { "green" }.lowercase()
                    val lastUpdate = doc.getLong("last_update_time")
                    PatientListItem(
                        patientId = doc.id,
                        patientName = doc.getString("name").orEmpty().ifBlank { "Unknown Patient" },
                        surgeryType = doc.getString("surgery_type").orEmpty().ifBlank { "Unknown Surgery" },
                        currentRisk = if (risk in setOf("green", "yellow", "red")) risk else "green",
                        lastUpdateTime = formatTimestamp(lastUpdate)
                    )
                }.sortedByDescending { item ->
                    when (item.currentRisk) {
                        "red" -> 3
                        "yellow" -> 2
                        else -> 1
                    }
                }.toMutableList()
                updatePrioritySummary()
                applyFilter()
            }
    }

    private fun formatTimestamp(timestamp: Long?): String {
        if (timestamp == null || timestamp <= 0L) return "N/A"
        return SimpleDateFormat("dd MMM, HH:mm", Locale.getDefault()).format(Date(timestamp))
    }

    private fun updatePrioritySummary() {
        val red = allPatients.count { it.currentRisk == "red" }
        val yellow = allPatients.count { it.currentRisk == "yellow" }
        binding.prioritySummaryText.text = getString(R.string.priority_summary_value, red, yellow)
        binding.redCountText.text = getString(R.string.red_cases_value, red)
        binding.yellowCountText.text = getString(R.string.yellow_cases_value, yellow)
    }

    private fun applyFilter() {
        val filtered = when (filter) {
            "yellow" -> allPatients.filter { it.currentRisk == "yellow" }
            "red" -> allPatients.filter { it.currentRisk == "red" }
            else -> allPatients
        }
        patientsAdapter.submitList(filtered)
    }

    override fun onDestroyView() {
        usersListener?.remove()
        _binding = null
        super.onDestroyView()
    }
}

class PatientsAdapter(private val onPatientClick: (PatientListItem) -> Unit) :
    RecyclerView.Adapter<PatientViewHolder>() {

    private val patients = mutableListOf<PatientListItem>()

    fun submitList(newPatients: List<PatientListItem>) {
        patients.clear()
        patients.addAll(newPatients)
        notifyDataSetChanged()
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): PatientViewHolder {
        val view = LayoutInflater.from(parent.context).inflate(R.layout.item_patient, parent, false)
        return PatientViewHolder(view, onPatientClick)
    }

    override fun onBindViewHolder(holder: PatientViewHolder, position: Int) = holder.bind(patients[position])
    override fun getItemCount(): Int = patients.size
}

class PatientViewHolder(
    itemView: View,
    private val onPatientClick: (PatientListItem) -> Unit
) : RecyclerView.ViewHolder(itemView) {
    private val patientName = itemView.findViewById<TextView>(R.id.patientName)
    private val surgeryType = itemView.findViewById<TextView>(R.id.surgeryTypeText)
    private val lastLogDate = itemView.findViewById<TextView>(R.id.lastLogDate)
    private val riskIndicator = itemView.findViewById<View>(R.id.riskIndicator)
    private val riskText = itemView.findViewById<TextView>(R.id.riskText)

    fun bind(patient: PatientListItem) {
        patientName.text = patient.patientName
        surgeryType.text = patient.surgeryType
        lastLogDate.text = itemView.context.getString(R.string.last_update_value, patient.lastUpdateTime)
        riskText.text = patient.currentRisk.uppercase()
        val color = when (patient.currentRisk) {
            "red" -> android.R.color.holo_red_light
            "yellow" -> android.R.color.holo_orange_light
            else -> android.R.color.holo_green_light
        }
        riskIndicator.setBackgroundColor(itemView.context.getColor(color))
        itemView.setOnClickListener { onPatientClick(patient) }
    }
}

