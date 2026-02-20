package com.postopguardian.ui.patient

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.SeekBar
import android.widget.Toast
import androidx.fragment.app.Fragment
import androidx.navigation.fragment.findNavController
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.SetOptions
import com.postopguardian.R
import com.postopguardian.api.RetrofitClient
import com.postopguardian.databinding.FragmentDailyLogBinding
import com.postopguardian.models.DailyLog
import com.postopguardian.models.RiskResponse
import com.postopguardian.utils.AppUtils
import retrofit2.Call
import retrofit2.Callback
import retrofit2.Response

class DailyLogFragment : Fragment() {
    private var _binding: FragmentDailyLogBinding? = null
    private val binding get() = _binding!!

    private val auth = FirebaseAuth.getInstance()
    private val db = FirebaseFirestore.getInstance()
    private val patientId get() = auth.currentUser?.uid.orEmpty()
    private var currentStep = 1

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentDailyLogBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        binding.painValueText.text = "0"
        binding.painSeekBar.setOnSeekBarChangeListener(object : SeekBar.OnSeekBarChangeListener {
            override fun onProgressChanged(seekBar: SeekBar?, progress: Int, fromUser: Boolean) {
                binding.painValueText.text = progress.toString()
            }
            override fun onStartTrackingTouch(seekBar: SeekBar?) = Unit
            override fun onStopTrackingTouch(seekBar: SeekBar?) = Unit
        })
        binding.nextStepButton.setOnClickListener {
            if (currentStep < 3) {
                currentStep++
                renderStep(animated = true)
            }
        }
        binding.prevStepButton.setOnClickListener {
            if (currentStep > 1) {
                currentStep--
                renderStep(animated = true)
            }
        }
        binding.submitLogButton.setOnClickListener { submitDailyLog() }
        renderStep(animated = false)
    }

    private fun renderStep(animated: Boolean) {
        fun setStepVisibility(view: View, show: Boolean) {
            if (!animated) {
                view.visibility = if (show) View.VISIBLE else View.GONE
                return
            }
            if (show) {
                view.alpha = 0f
                view.visibility = View.VISIBLE
                view.animate().alpha(1f).setDuration(180).start()
            } else {
                view.animate().alpha(0f).setDuration(120).withEndAction {
                    view.visibility = View.GONE
                }.start()
            }
        }

        setStepVisibility(binding.stepOneCard, currentStep == 1)
        setStepVisibility(binding.stepTwoCard, currentStep == 2)
        setStepVisibility(binding.stepThreeCard, currentStep == 3)

        binding.prevStepButton.visibility = if (currentStep == 1) View.GONE else View.VISIBLE
        binding.nextStepButton.visibility = if (currentStep == 3) View.GONE else View.VISIBLE

        when (currentStep) {
            1 -> {
                binding.stepTitleText.text = getString(R.string.daily_log_step_1)
            }
            2 -> {
                binding.stepTitleText.text = getString(R.string.daily_log_step_2)
            }
            else -> {
                binding.stepTitleText.text = getString(R.string.daily_log_step_3)
            }
        }
    }

    private fun submitDailyLog() {
        val temperature = binding.tempEditText.text?.toString()?.toDoubleOrNull()
        if (temperature == null || temperature < 30.0 || temperature > 45.0) {
            Toast.makeText(requireContext(), getString(R.string.invalid_temperature), Toast.LENGTH_SHORT).show()
            return
        }

        val sleepHours = binding.sleepHoursEditText.text?.toString()?.toDoubleOrNull() ?: 0.0
        val dailyLog = DailyLog(
            patient_id = patientId,
            pain_score = binding.painSeekBar.progress,
            temperature = temperature,
            redness = binding.rednessSpinner.selectedItem.toString(),
            swelling = binding.swellingSpinner.selectedItem.toString(),
            discharge = binding.dischargeSwitch.isChecked,
            mobility = binding.mobilitySpinner.selectedItem.toString(),
            sleep_hours = sleepHours,
            appetite = binding.appetiteSpinner.selectedItem.toString(),
            fatigue = binding.fatigueSpinner.selectedItem.toString(),
            mood = binding.moodSpinner.selectedItem.toString(),
            antibiotics_taken = binding.antibioticsCheck.isChecked,
            pain_meds_taken = binding.painMedsCheck.isChecked,
            dressing_changed = binding.dressingChangedCheck.isChecked,
            timestamp = AppUtils.nowIsoString()
        )
        val logPayload = hashMapOf(
            "patient_id" to patientId,
            "pain_score" to dailyLog.pain_score,
            "temperature" to dailyLog.temperature,
            "redness" to dailyLog.redness,
            "swelling" to dailyLog.swelling,
            "discharge" to dailyLog.discharge,
            "mobility" to dailyLog.mobility,
            "sleep_hours" to dailyLog.sleep_hours,
            "appetite" to dailyLog.appetite,
            "fatigue" to dailyLog.fatigue,
            "mood" to dailyLog.mood,
            "antibiotics_taken" to dailyLog.antibiotics_taken,
            "pain_meds_taken" to dailyLog.pain_meds_taken,
            "dressing_changed" to dailyLog.dressing_changed,
            "timestamp" to System.currentTimeMillis(),
            "timestamp_iso" to dailyLog.timestamp
        )

        binding.submitLogButton.isEnabled = false
        binding.submitLogButton.text = getString(R.string.loading)

        db.collection("daily_logs").add(logPayload)
            .addOnSuccessListener {
                callSubmitApi(dailyLog)
            }
            .addOnFailureListener {
                binding.submitLogButton.isEnabled = true
                binding.submitLogButton.text = getString(R.string.submit_log)
                Toast.makeText(requireContext(), getString(R.string.log_error), Toast.LENGTH_SHORT).show()
            }
    }

    private fun callSubmitApi(log: DailyLog) {
        RetrofitClient.api.submitLog(log).enqueue(object : Callback<RiskResponse> {
            override fun onResponse(call: Call<RiskResponse>, response: Response<RiskResponse>) {
                binding.submitLogButton.isEnabled = true
                binding.submitLogButton.text = getString(R.string.submit_log)
                if (!response.isSuccessful || response.body() == null) {
                    val fallback = calculateOfflineRisk(log)
                    persistRiskAndRoute(fallback.first, fallback.second, getString(R.string.offline_risk_message))
                    Toast.makeText(
                        requireContext(),
                        getString(R.string.backend_unreachable_offline_used),
                        Toast.LENGTH_LONG
                    ).show()
                    return
                }

                val risk = response.body()!!.risk_level.lowercase()
                val riskScore = response.body()!!.risk_score
                val message = response.body()!!.message.ifBlank { "Risk detected from daily log" }
                persistRiskAndRoute(risk, riskScore, message)
            }

            override fun onFailure(call: Call<RiskResponse>, t: Throwable) {
                binding.submitLogButton.isEnabled = true
                binding.submitLogButton.text = getString(R.string.submit_log)
                val fallback = calculateOfflineRisk(log)
                persistRiskAndRoute(fallback.first, fallback.second, getString(R.string.offline_risk_message))
                Toast.makeText(
                    requireContext(),
                    getString(R.string.backend_unreachable_offline_used),
                    Toast.LENGTH_LONG
                ).show()
            }
        })
    }

    private fun persistRiskAndRoute(risk: String, riskScore: Float, message: String) {
        val now = System.currentTimeMillis()
        val userRiskPayload = mapOf(
            "current_risk" to risk,
            "risk_score" to riskScore,
            "last_update_time" to now
        )
        db.collection("users").document(patientId).set(userRiskPayload, SetOptions.merge())

        if (risk == "red" || risk == "yellow") {
            db.collection("alerts").add(
                mapOf(
                    "patient_id" to patientId,
                    "doctor_id" to "",
                    "risk_level" to risk,
                    "message" to message,
                    "status" to "pending",
                    "timestamp" to now
                )
            )
        }

        Toast.makeText(
            requireContext(),
            "${getString(R.string.log_submitted)} ${risk.uppercase()}",
            Toast.LENGTH_LONG
        ).show()
        findNavController().navigate(R.id.action_dailylog_to_dashboard)
    }

    private fun calculateOfflineRisk(log: DailyLog): Pair<String, Float> {
        val risk = when {
            log.temperature >= 38.0 -> "red"
            log.discharge -> "red"
            log.pain_score >= 9 -> "red"
            log.redness.equals("Severe", ignoreCase = true) -> "red"
            !log.antibiotics_taken -> "yellow"
            log.swelling.equals("Moderate", ignoreCase = true) || log.swelling.equals("Severe", ignoreCase = true) -> "yellow"
            log.pain_score >= 6 -> "yellow"
            log.fatigue.equals("High", ignoreCase = true) || log.fatigue.equals("Severe", ignoreCase = true) -> "yellow"
            else -> "green"
        }
        val score = when (risk) {
            "red" -> 0.9f
            "yellow" -> 0.6f
            else -> 0.2f
        }
        return risk to score
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
