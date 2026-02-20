package com.postopguardian.viewmodels

import androidx.lifecycle.MutableLiveData
import androidx.lifecycle.ViewModel
import com.postopguardian.api.ApiService
import com.postopguardian.models.DailyLog
import com.postopguardian.models.RiskResponse
import retrofit2.Call
import retrofit2.Callback
import retrofit2.Response
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory

class DailyLogViewModel : ViewModel() {
    val riskResult = MutableLiveData<RiskResponse?>()
    val isLoading = MutableLiveData<Boolean>(false)
    val errorMessage = MutableLiveData<String?>()

    private val retrofit = Retrofit.Builder()
        .baseUrl("http://10.23.31.86:8000/") // Backend IP for real phone access
        .addConverterFactory(GsonConverterFactory.create())
        .build()

    private val apiService = retrofit.create(ApiService::class.java)

    fun submitLog(log: DailyLog) {
        isLoading.value = true
        apiService.submitLog(log).enqueue(object : Callback<RiskResponse> {
            override fun onResponse(call: Call<RiskResponse>, response: Response<RiskResponse>) {
                isLoading.value = false
                if (response.isSuccessful) {
                    riskResult.value = response.body()
                } else {
                    errorMessage.value = "Submission failed: ${response.code()}"
                }
            }

            override fun onFailure(call: Call<RiskResponse>, t: Throwable) {
                isLoading.value = false
                errorMessage.value = "Network error: ${t.message}"
            }
        })
    }
}
