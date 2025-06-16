package com.smartlamp.taskmanager.network

import android.content.Context
import android.content.SharedPreferences
import com.google.gson.GsonBuilder
import okhttp3.Interceptor
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import java.util.concurrent.TimeUnit

class ApiClient private constructor(context: Context) {

    private val sharedPrefs: SharedPreferences =
        context.getSharedPreferences("smart_lamp_prefs", Context.MODE_PRIVATE)

    private val authInterceptor = Interceptor { chain ->
        val token = sharedPrefs.getString("access_token", null)
        val request = if (token != null) {
            chain.request().newBuilder()
                .addHeader("Authorization", "Bearer $token")
                .build()
        } else {
            chain.request()
        }
        chain.proceed(request)
    }

    private val loggingInterceptor = HttpLoggingInterceptor().apply {
        level = HttpLoggingInterceptor.Level.BODY
    }

    private val okHttpClient = OkHttpClient.Builder()
        .addInterceptor(authInterceptor)
        .addInterceptor(loggingInterceptor)
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .build()

    private val gson = GsonBuilder()
        .setDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'")
        .create()

    private val retrofit = Retrofit.Builder()
        .baseUrl("http://10.0.2.2:8080/api/") // Android emulator localhost
        .client(okHttpClient)
        .addConverterFactory(GsonConverterFactory.create(gson))
        .build()

    val apiService: ApiService = retrofit.create(ApiService::class.java)

    fun saveToken(token: String) {
        sharedPrefs.edit().putString("access_token", token).apply()
    }

    fun getToken(): String? = sharedPrefs.getString("access_token", null)

    fun clearToken() {
        sharedPrefs.edit().remove("access_token").apply()
    }

    companion object {
        @Volatile
        private var INSTANCE: ApiClient? = null

        fun getInstance(context: Context): ApiClient {
            return INSTANCE ?: synchronized(this) {
                INSTANCE ?: ApiClient(context.applicationContext).also { INSTANCE = it }
            }
        }
    }
}