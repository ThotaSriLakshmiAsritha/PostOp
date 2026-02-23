package com.postopguardian.api

import com.postopguardian.models.DailyLog
import com.postopguardian.models.RiskResponse
import retrofit2.Call
import retrofit2.Response
import retrofit2.http.GET
import retrofit2.http.Body
import retrofit2.http.POST
import retrofit2.http.Path

interface ApiService {

    @GET("/")
    suspend fun testConnection(): Response<String>

    @POST("/submit_log")
    fun submitLog(@Body log: DailyLog): Call<RiskResponse>
    
    @GET("/patient_logs/{patient_id}")
    suspend fun getPatientLogs(@Path("patient_id") patientId: String): Response<PatientLogsResponse>
    
    @GET("/risk/{patient_id}")
    suspend fun getPatientRisk(@Path("patient_id") patientId: String): Response<RiskResponse>
    
    @GET("/flagged_patients")
    suspend fun getFlaggedPatients(): Response<FlaggedPatientsResponse>
    
    @POST("/acknowledge_alert")
    suspend fun acknowledgeAlert(@Body request: AlertAcknowledgeRequest): Response<AcknowledgeResponse>

}

data class AlertAcknowledgeRequest(
    val alert_id: String,
    val doctor_id: String
)

data class AcknowledgeResponse(
    val status: String,
    val message: String
)

data class FlaggedPatientsResponse(
    val flagged: List<Map<String, Any>>
)

data class PatientLogsResponse(
    val patient_id: String,
    val logs: List<DailyLog>
)
