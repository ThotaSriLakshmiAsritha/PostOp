package com.postopguardian.utils

import com.postopguardian.models.DailyLog
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

object AppUtils {
    private val isoFormat = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.getDefault())

    fun nowIsoString(): String = isoFormat.format(Date())

    fun safeTimestampToLong(value: Any?): Long {
        return when (value) {
            is Long -> value
            is Int -> value.toLong()
            is Double -> value.toLong()
            is String -> value.toLongOrNull() ?: System.currentTimeMillis()
            else -> System.currentTimeMillis()
        }
    }

    fun calculateRiskLevel(log: DailyLog): String {
        return when {
            log.temperature >= 38.0 || log.discharge || log.pain_score >= 9 || log.redness.equals("severe", true) -> "red"
            !log.antibiotics_taken || log.swelling.equals("moderate", true) || log.swelling.equals("severe", true) || log.pain_score >= 6 || log.fatigue.equals("high", true) -> "yellow"
            else -> "green"
        }
    }

    fun daysSince(surgeryDateIso: String?): Int {
        if (surgeryDateIso.isNullOrBlank()) return 0
        return runCatching {
            val start = isoFormat.parse(surgeryDateIso)?.time ?: return 0
            val diff = System.currentTimeMillis() - start
            (diff / (24L * 60 * 60 * 1000)).toInt().coerceAtLeast(0)
        }.getOrDefault(0)
    }
}
