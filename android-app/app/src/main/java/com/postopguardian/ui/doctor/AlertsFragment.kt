package com.postopguardian.ui.doctor

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Toast
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import androidx.navigation.fragment.findNavController
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.google.android.material.dialog.MaterialAlertDialogBuilder
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.Query
import com.postopguardian.R
import com.postopguardian.api.AlertAcknowledgeRequest
import com.postopguardian.api.RetrofitClient
import com.postopguardian.databinding.FragmentDoctorAlertsBinding
import com.postopguardian.models.Alert
import kotlinx.coroutines.launch

class AlertsFragment : Fragment() {
    private var _binding: FragmentDoctorAlertsBinding? = null
    private val binding get() = _binding!!

    private val db = FirebaseFirestore.getInstance()
    private val auth = FirebaseAuth.getInstance()
    private lateinit var alertsAdapter: AlertsAdapter
    private var listener: com.google.firebase.firestore.ListenerRegistration? = null

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
        _binding = FragmentDoctorAlertsBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        alertsAdapter = AlertsAdapter(
            onAcknowledge = { alert -> askNoteAndAcknowledge(alert) },
            onOpen = { alert ->
                runCatching { findNavController().navigate(
                    R.id.doctorDetailFragment,
                    Bundle().apply {
                        putString("patientId", alert.patient_id)
                        putString("patientName", "Patient ${alert.patient_id.takeLast(4)}")
                        putString("riskLevel", alert.risk_level)
                    }
                ) }
            }
        )
        binding.alertsRecyclerView.layoutManager = LinearLayoutManager(requireContext())
        binding.alertsRecyclerView.adapter = alertsAdapter
        binding.backToPatientsButton.setOnClickListener {
            runCatching { findNavController().navigate(R.id.action_alerts_to_patients) }
        }
        loadAlerts()
    }

    private fun loadAlerts() {
        listener = db.collection("alerts")
            .whereEqualTo("status", "pending")
            .orderBy("timestamp", Query.Direction.DESCENDING)
            .addSnapshotListener { snapshot, e ->
                if (snapshot == null) return@addSnapshotListener
                if (e != null) {
                    // Query fallback when index/orderBy constraints fail on some Firestore configs.
                    loadAlertsWithoutOrder()
                    return@addSnapshotListener
                }
                val doctorId = auth.currentUser?.uid.orEmpty()
                val alerts = snapshot.documents.mapNotNull { doc ->
                    val patientId = doc.getString("patient_id").orEmpty()
                    val riskLevel = doc.getString("risk_level")
                        ?: doc.getString("riskLevel")
                        ?: ""
                    val doctorField = doc.getString("doctor_id").orEmpty()
                    val status = doc.getString("status").orEmpty().ifBlank { "pending" }
                    val message = doc.getString("message").orEmpty()
                    if (riskLevel.isBlank() || message.isBlank()) {
                        return@mapNotNull null
                    }
                    if (doctorField.isNotBlank() && doctorField != doctorId) {
                        return@mapNotNull null
                    }
                    Alert(
                        alert_id = doc.id,
                        patient_id = patientId,
                        risk_level = riskLevel.lowercase(),
                        message = message,
                        status = status,
                        note = doc.getString("note").orEmpty(),
                        timestamp = doc.get("timestamp")
                    )
                }
                alertsAdapter.submitList(alerts)
            }
    }

    private fun loadAlertsWithoutOrder() {
        listener?.remove()
        listener = db.collection("alerts")
            .whereEqualTo("status", "pending")
            .addSnapshotListener { snapshot, _ ->
                if (snapshot == null) return@addSnapshotListener
                val doctorId = auth.currentUser?.uid.orEmpty()
                val alerts = snapshot.documents.mapNotNull { doc ->
                    val doctorField = doc.getString("doctor_id").orEmpty()
                    if (doctorField.isNotBlank() && doctorField != doctorId) return@mapNotNull null
                    Alert(
                        alert_id = doc.id,
                        patient_id = doc.getString("patient_id").orEmpty(),
                        risk_level = (doc.getString("risk_level") ?: doc.getString("riskLevel") ?: "").lowercase(),
                        message = doc.getString("message").orEmpty(),
                        status = doc.getString("status").orEmpty().ifBlank { "pending" },
                        note = doc.getString("note").orEmpty(),
                        timestamp = doc.get("timestamp")
                    )
                }.sortedByDescending { alert ->
                    when (val ts = alert.timestamp) {
                        is Long -> ts
                        is Double -> ts.toLong()
                        else -> 0L
                    }
                }
                alertsAdapter.submitList(alerts)
            }
    }

    private fun askNoteAndAcknowledge(alert: Alert) {
        val input = android.widget.EditText(requireContext())
        MaterialAlertDialogBuilder(requireContext())
            .setTitle(getString(R.string.acknowledge_alert))
            .setView(input)
            .setPositiveButton(getString(R.string.submit)) { _, _ ->
                acknowledgeAlert(alert, input.text?.toString()?.trim().orEmpty())
            }
            .setNegativeButton(getString(R.string.cancel), null)
            .show()
    }

    private fun acknowledgeAlert(alert: Alert, note: String) {
        lifecycleScope.launch {
            val doctorId = auth.currentUser?.uid ?: "doctor_456"
            runCatching {
                RetrofitClient.api.acknowledgeAlert(AlertAcknowledgeRequest(alert.alert_id, doctorId))
                db.collection("alerts").document(alert.alert_id).update(
                    mapOf("status" to "acknowledged", "note" to note)
                )
                Toast.makeText(requireContext(), getString(R.string.alert_acknowledged), Toast.LENGTH_SHORT).show()
            }.onFailure {
                Toast.makeText(requireContext(), getString(R.string.alert_ack_failed), Toast.LENGTH_SHORT).show()
            }
        }
    }

    override fun onDestroyView() {
        listener?.remove()
        _binding = null
        super.onDestroyView()
    }
}

class AlertsAdapter(
    private val onAcknowledge: (Alert) -> Unit,
    private val onOpen: (Alert) -> Unit
) : RecyclerView.Adapter<AlertViewHolder>() {
    private val alerts = mutableListOf<Alert>()

    fun submitList(newAlerts: List<Alert>) {
        alerts.clear()
        alerts.addAll(newAlerts)
        notifyDataSetChanged()
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): AlertViewHolder {
        val view = LayoutInflater.from(parent.context).inflate(R.layout.item_alert, parent, false)
        return AlertViewHolder(view, onAcknowledge, onOpen)
    }

    override fun onBindViewHolder(holder: AlertViewHolder, position: Int) = holder.bind(alerts[position])
    override fun getItemCount(): Int = alerts.size
}

class AlertViewHolder(
    itemView: View,
    private val onAcknowledge: (Alert) -> Unit,
    private val onOpen: (Alert) -> Unit
) : RecyclerView.ViewHolder(itemView) {
    private val alertTitle = itemView.findViewById<android.widget.TextView>(R.id.alertTitle)
    private val alertPatient = itemView.findViewById<android.widget.TextView>(R.id.alertPatient)
    private val ackButton = itemView.findViewById<android.widget.Button>(R.id.ackButton)

    fun bind(alert: Alert) {
        alertTitle.text = "${alert.risk_level.uppercase()}: ${alert.message}"
        alertPatient.text = itemView.context.getString(R.string.patient_value, alert.patient_id.takeLast(8))
        ackButton.setOnClickListener { onAcknowledge(alert) }
        itemView.setOnClickListener { onOpen(alert) }
    }
}
