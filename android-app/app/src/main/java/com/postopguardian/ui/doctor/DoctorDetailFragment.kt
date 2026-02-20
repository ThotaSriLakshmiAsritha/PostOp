package com.postopguardian.ui.doctor

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import androidx.fragment.app.Fragment
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Toast
import androidx.lifecycle.lifecycleScope
import androidx.navigation.fragment.findNavController
import com.github.mikephil.charting.data.Entry
import com.github.mikephil.charting.data.LineData
import com.github.mikephil.charting.data.LineDataSet
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import com.postopguardian.R
import com.postopguardian.api.AlertAcknowledgeRequest
import com.postopguardian.api.RetrofitClient
import com.postopguardian.databinding.FragmentDoctorDetailBinding
import com.postopguardian.models.DailyLog
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await

class DoctorDetailFragment : Fragment() {
    private var _binding: FragmentDoctorDetailBinding? = null
    private val binding get() = _binding!!

    private val auth = FirebaseAuth.getInstance()
    private val db = FirebaseFirestore.getInstance()

    private val patientId by lazy { arguments?.getString("patientId").orEmpty() }
    private val patientName by lazy { arguments?.getString("patientName").orEmpty().ifBlank { "Patient" } }
    private val riskLevel by lazy { arguments?.getString("riskLevel").orEmpty().ifBlank { "green" } }

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
        _binding = FragmentDoctorDetailBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        binding.patientHeader.text = patientName
        binding.detailRiskBadge.text = riskLevel.uppercase()
        setupActions()
        loadPatientMetrics()
    }

    private fun setupActions() {
        binding.chatButton.setOnClickListener {
            findNavController().navigate(
                R.id.chatFragment,
                Bundle().apply { putString("partnerId", patientId) }
            )
        }
        binding.callButton.setOnClickListener { openMeetLink() }
        binding.scheduleFollowupButton.setOnClickListener { scheduleFollowUp() }
        binding.acknowledgeAlertDetail.setOnClickListener { acknowledgeAlertWithNote() }
    }

    private fun loadPatientMetrics() {
        lifecycleScope.launch {
            val logs = loadLogs()
            updateCharts(logs)
            updateAdherence(logs)
            binding.recentLogsText.text = logs.take(5).joinToString("\n") {
                "Pain ${it.pain_score}, Temp ${it.temperature}, Antibiotics ${if (it.antibiotics_taken) "Yes" else "No"}"
            }

            val reminders = runCatching {
                db.collection("reminders")
                    .whereEqualTo("patient_id", patientId)
                    .whereEqualTo("enabled", false)
                    .get()
                    .await().size()
            }.getOrDefault(0)
            binding.missedReminderText.text = getString(R.string.missed_reminders_value, reminders)
        }
    }

    private suspend fun loadLogs(): List<DailyLog> {
        return runCatching {
            RetrofitClient.api.getPatientLogs(patientId).body()?.logs ?: emptyList()
        }.getOrDefault(emptyList())
    }

    private fun updateCharts(logs: List<DailyLog>) {
        val pain = logs.reversed().mapIndexed { i, log -> Entry(i.toFloat(), log.pain_score.toFloat()) }
        val temp = logs.reversed().mapIndexed { i, log -> Entry(i.toFloat(), log.temperature.toFloat()) }
        binding.painChart.data = LineData(LineDataSet(pain, "pain").apply { lineWidth = 2f })
        binding.tempChart.data = LineData(LineDataSet(temp, "temp").apply { lineWidth = 2f })
        binding.painChart.invalidate()
        binding.tempChart.invalidate()
    }

    private fun updateAdherence(logs: List<DailyLog>) {
        if (logs.isEmpty()) {
            binding.adherenceText.text = getString(R.string.med_adherence_value, 0)
            return
        }
        val taken = logs.count { it.antibiotics_taken && it.pain_meds_taken }
        val adherence = ((taken * 100f) / logs.size).toInt()
        binding.adherenceText.text = getString(R.string.med_adherence_value, adherence)
    }

    private fun openMeetLink() {
        lifecycleScope.launch {
            val link = runCatching {
                val doc = db.collection("users").document(patientId).get().await()
                val doctorId = doc.getString("doctor_id").orEmpty()
                db.collection("doctors").document(doctorId).get().await().getString("meet_link")
            }.getOrNull() ?: "https://meet.google.com/"
            startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(link)))
        }
    }

    private fun scheduleFollowUp() {
        val title = binding.followupTitleInput.text?.toString()?.trim().orEmpty().ifBlank { "Follow-up Appointment" }
        db.collection("followups").add(
            mapOf(
                "patient_id" to patientId,
                "doctor_id" to (auth.currentUser?.uid ?: ""),
                "title" to title,
                "notes" to "",
                "timestamp" to System.currentTimeMillis()
            )
        )
        val now = System.currentTimeMillis() + 24L * 60 * 60 * 1000
        val intent = Intent(Intent.ACTION_VIEW, Uri.parse("https://calendar.google.com/calendar/render?action=TEMPLATE&text=$title&dates=${toGCal(now)}/${toGCal(now + 30L * 60 * 1000)}"))
        startActivity(intent)
    }

    private fun toGCal(time: Long): String {
        val sdf = java.text.SimpleDateFormat("yyyyMMdd'T'HHmmss'Z'", java.util.Locale.US)
        sdf.timeZone = java.util.TimeZone.getTimeZone("UTC")
        return sdf.format(java.util.Date(time))
    }

    private fun acknowledgeAlertWithNote() {
        val doctorId = auth.currentUser?.uid.orEmpty()
        val note = binding.ackNoteInput.text?.toString()?.trim().orEmpty()
        lifecycleScope.launch {
            runCatching {
                val pending = db.collection("alerts")
                    .whereEqualTo("patient_id", patientId)
                    .whereEqualTo("status", "pending")
                    .get().await().documents
                val firstId = pending.firstOrNull()?.id ?: ""
                if (firstId.isNotBlank()) {
                    RetrofitClient.api.acknowledgeAlert(AlertAcknowledgeRequest(alert_id = firstId, doctor_id = doctorId))
                }
                pending.forEach {
                        it.reference.update(
                            mapOf("status" to "acknowledged", "note" to note)
                        )
                }
                Toast.makeText(requireContext(), getString(R.string.alert_acknowledged), Toast.LENGTH_SHORT).show()
            }.onFailure {
                Toast.makeText(requireContext(), getString(R.string.alert_ack_failed), Toast.LENGTH_SHORT).show()
            }
        }
    }

    override fun onDestroyView() {
        _binding = null
        super.onDestroyView()
    }
}
