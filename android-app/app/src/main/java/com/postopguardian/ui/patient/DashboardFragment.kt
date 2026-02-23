package com.postopguardian.ui.patient

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.widget.Toast
import androidx.fragment.app.Fragment
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.lifecycle.lifecycleScope
import androidx.navigation.fragment.findNavController
import androidx.navigation.navOptions
import com.github.mikephil.charting.components.XAxis
import com.github.mikephil.charting.data.Entry
import com.github.mikephil.charting.data.LineData
import com.github.mikephil.charting.data.LineDataSet
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.Query
import com.postopguardian.R
import com.postopguardian.api.RetrofitClient
import com.postopguardian.databinding.FragmentDashboardBinding
import com.postopguardian.models.DailyLog
import com.postopguardian.utils.AppUtils
import com.postopguardian.utils.LocaleHelper
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await

class DashboardFragment : Fragment() {
    private var _binding: FragmentDashboardBinding? = null
    private val binding get() = _binding!!

    private val auth = FirebaseAuth.getInstance()
    private val db = FirebaseFirestore.getInstance()
    private val patientId get() = auth.currentUser?.uid.orEmpty()

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentDashboardBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        setupCharts()
        wireActions()
        loadDashboard()
    }

    private fun wireActions() {
        binding.openDailyLogButton.setOnClickListener {
            findNavController().navigate(R.id.action_dashboard_to_dailylog)
        }
        binding.openChatButton.setOnClickListener {
            findNavController().navigate(R.id.action_dashboard_to_chat)
        }
        binding.videoConsultButton.setOnClickListener { openVideoConsultation() }
        binding.remindersButton.setOnClickListener {
            findNavController().navigate(R.id.action_dashboard_to_reminders)
        }
        binding.languageButton.setOnClickListener { showLanguageDialog() }
        binding.sosButton.setOnClickListener { findNavController().navigate(R.id.action_dashboard_to_emergency) }
        binding.logoutButton.setOnClickListener {
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
    }

    private fun setupCharts() {
        listOf(binding.painChart, binding.temperatureChart, binding.recoveryChart).forEach { chart ->
            chart.description.isEnabled = false
            chart.axisRight.isEnabled = false
            chart.legend.isEnabled = false
            chart.xAxis.position = XAxis.XAxisPosition.BOTTOM
            chart.xAxis.setDrawGridLines(false)
            chart.axisLeft.setDrawGridLines(false)
        }
    }

    private fun loadDashboard() {
        if (patientId.isBlank()) return

        lifecycleScope.launch {
            val logs = loadPatientLogs()
            val last = logs.firstOrNull()
            updateRiskCard(last?.let(AppUtils::calculateRiskLevel) ?: "green")
            updatePainChart(logs)
            updateTemperatureChart(logs)
            updateRecoveryChart(logs)

            val score = calculateRecoveryScore(logs)
            binding.recoveryScoreText.text = "$score%"

            val userDoc = db.collection("users").document(patientId).get().await()
            binding.daysSinceSurgeryText.text = AppUtils.daysSince(userDoc.getString("surgery_date")).toString()
            binding.latestAlertText.text = loadLatestAlert()
            binding.upcomingRemindersText.text = loadUpcomingReminders()
        }
    }

    private suspend fun loadPatientLogs(): List<DailyLog> {
        return try {
            val response = RetrofitClient.api.getPatientLogs(patientId)
            if (response.isSuccessful) {
                response.body()?.logs ?: emptyList()
            } else {
                emptyList()
            }
        } catch (_: Exception) {
            emptyList()
        }
    }

    private suspend fun loadLatestAlert(): String {
        return runCatching {
            val snap = db.collection("alerts")
                .whereEqualTo("patient_id", patientId)
                .orderBy("timestamp", Query.Direction.DESCENDING)
                .limit(1)
                .get()
                .await()
            val doc = snap.documents.firstOrNull()
            if (doc == null) getString(R.string.no_alerts)
            else "${doc.getString("risk_level")?.uppercase()}: ${doc.getString("message").orEmpty()}"
        }.getOrDefault(getString(R.string.no_alerts))
    }

    private suspend fun loadUpcomingReminders(): String {
        return runCatching {
            val snap = db.collection("reminders")
                .whereEqualTo("patient_id", patientId)
                .whereEqualTo("enabled", true)
                .orderBy("time", Query.Direction.ASCENDING)
                .limit(3)
                .get()
                .await()
            if (snap.isEmpty) return getString(R.string.no_reminders)
            snap.documents.joinToString("\n") { "${it.getString("time")} - ${it.getString("title")}" }
        }.getOrDefault(getString(R.string.no_reminders))
    }

    private fun calculateRecoveryScore(logs: List<DailyLog>): Int {
        if (logs.isEmpty()) return 0
        val latest = logs.first()
        val painFactor = (10 - latest.pain_score) * 6
        val tempFactor = if (latest.temperature < 37.5) 25 else 10
        val medsFactor = if (latest.antibiotics_taken && latest.pain_meds_taken) 15 else 5
        return (painFactor + tempFactor + medsFactor).coerceIn(0, 100)
    }

    private fun updateRiskCard(riskLevel: String) {
        binding.riskCard.animate().alpha(0.6f).setDuration(120).withEndAction {
            binding.riskCard.animate().alpha(1f).setDuration(160).start()
        }.start()
        when (riskLevel.lowercase()) {
            "red" -> {
                binding.riskCard.setCardBackgroundColor(requireContext().getColor(R.color.risk_red_bg))
                binding.riskCircle.setStrokeColor(requireContext().getColor(R.color.risk_red_text))
                binding.riskStatusText.text = getString(R.string.risk_red)
                binding.riskStatusText.setTextColor(requireContext().getColor(R.color.risk_red_text))
                binding.riskMessageText.text = getString(R.string.urgent_message)
            }
            "yellow" -> {
                binding.riskCard.setCardBackgroundColor(requireContext().getColor(R.color.risk_yellow_bg))
                binding.riskCircle.setStrokeColor(requireContext().getColor(R.color.risk_yellow_text))
                binding.riskStatusText.text = getString(R.string.risk_yellow)
                binding.riskStatusText.setTextColor(requireContext().getColor(R.color.risk_yellow_text))
                binding.riskMessageText.text = getString(R.string.warning_message)
            }
            else -> {
                binding.riskCard.setCardBackgroundColor(requireContext().getColor(R.color.risk_green_bg))
                binding.riskCircle.setStrokeColor(requireContext().getColor(R.color.risk_green_text))
                binding.riskStatusText.text = getString(R.string.risk_green)
                binding.riskStatusText.setTextColor(requireContext().getColor(R.color.risk_green_text))
                binding.riskMessageText.text = getString(R.string.reassurance_message)
            }
        }
    }

    private fun updatePainChart(logs: List<DailyLog>) {
        val points = logs.reversed().mapIndexed { i, log -> Entry(i.toFloat(), log.pain_score.toFloat()) }
        val ds = LineDataSet(points, "pain").apply {
            color = requireContext().getColor(android.R.color.holo_red_dark)
            setCircleColor(requireContext().getColor(android.R.color.holo_red_dark))
            lineWidth = 2f
        }
        binding.painChart.data = LineData(ds)
        binding.painChart.invalidate()
    }

    private fun updateTemperatureChart(logs: List<DailyLog>) {
        val points = logs.reversed().mapIndexed { i, log -> Entry(i.toFloat(), log.temperature.toFloat()) }
        val ds = LineDataSet(points, "temp").apply {
            color = requireContext().getColor(android.R.color.holo_orange_dark)
            setCircleColor(requireContext().getColor(android.R.color.holo_orange_dark))
            lineWidth = 2f
        }
        binding.temperatureChart.data = LineData(ds)
        binding.temperatureChart.invalidate()
    }

    private fun updateRecoveryChart(logs: List<DailyLog>) {
        var running = 45f
        val points = logs.reversed().mapIndexed { i, log ->
            val delta = ((10 - log.pain_score) / 4f) + if (log.temperature < 37.5) 2f else -2f
            running = (running + delta).coerceIn(0f, 100f)
            Entry(i.toFloat(), running)
        }
        val ds = LineDataSet(points, "recovery").apply {
            color = requireContext().getColor(android.R.color.holo_green_dark)
            setCircleColor(requireContext().getColor(android.R.color.holo_green_dark))
            lineWidth = 2f
        }
        binding.recoveryChart.data = LineData(ds)
        binding.recoveryChart.invalidate()
    }

    private fun openVideoConsultation() {
        lifecycleScope.launch {
            val link = runCatching {
                val user = db.collection("users").document(patientId).get().await()
                val doctorId = user.getString("doctor_id").orEmpty()
                if (doctorId.isBlank()) return@runCatching "https://meet.google.com/"
                db.collection("doctors").document(doctorId).get().await().getString("meet_link")
                    ?: "https://meet.google.com/"
            }.getOrDefault("https://meet.google.com/")
            startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(link)))
        }
    }

    private fun showLanguageDialog() {
        val names = arrayOf("English", "Hindi", "Telugu")
        val codes = arrayOf("en", "hi", "te")
        val current = codes.indexOf(LocaleHelper.getLanguage(requireContext())).coerceAtLeast(0)
        android.app.AlertDialog.Builder(requireContext())
            .setTitle(getString(R.string.language))
            .setSingleChoiceItems(names, current) { dialog, which ->
                LocaleHelper.setLocale(requireContext(), codes[which])
                requireActivity().recreate()
                dialog.dismiss()
            }
            .setNegativeButton(getString(R.string.cancel), null)
            .show()
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
