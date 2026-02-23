package com.postopguardian.models

data class User(
    val uid: String = "",
    val email: String = "",
    val name: String = "",
    val role: String = "", // "patient" or "doctor"
    val caregiver_phone: String = "",
    val doctor_id: String = "",
    val doctor_phone: String = "",
    val surgery_date: String = "",
    val surgery_type: String = ""
)

data class DailyLog(
    val patient_id: String,
    val pain_score: Int,
    val temperature: Double,
    val redness: String,
    val swelling: String,
    val discharge: Boolean,
    val mobility: String,
    val sleep_hours: Double,
    val appetite: String,
    val fatigue: String,
    val mood: String,
    val antibiotics_taken: Boolean,
    val pain_meds_taken: Boolean,
    val dressing_changed: Boolean,
    val timestamp: String? = null
)

data class RiskResponse(
    val risk_level: String,
    val risk_score: Float,
    val message: String,
    val escalation_action: String? = null
)

data class Alert(
    val alert_id: String = "",
    val patient_id: String = "",
    val risk_level: String = "",
    val message: String = "",
    val status: String = "pending",
    val note: String = "",
    val timestamp: Any? = null
)

data class ChatMessage(
    val senderId: String = "",
    val receiverId: String = "",
    val message: String = "",
    val timestamp: Long = 0
)

data class Reminder(
    val reminderId: String = "",
    val patient_id: String = "",
    val title: String = "",
    val time: String = "",
    val repeat_daily: Boolean = true,
    val enabled: Boolean = true,
    val timestamp: Long = 0
)

data class FollowUp(
    val patient_id: String = "",
    val doctor_id: String = "",
    val title: String = "",
    val notes: String = "",
    val timestamp: Long = 0
)
