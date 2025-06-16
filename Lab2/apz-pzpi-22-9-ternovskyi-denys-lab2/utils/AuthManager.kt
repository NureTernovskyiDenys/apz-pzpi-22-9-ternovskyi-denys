package com.smartlamp.taskmanager.utils

import android.content.Context
import com.google.gson.Gson
import com.smartlamp.taskmanager.models.User
import com.smartlamp.taskmanager.network.ApiClient

class AuthManager private constructor(context: Context) {

    private val apiClient = ApiClient.getInstance(context)
    private val sharedPrefs = context.getSharedPreferences("smart_lamp_prefs", Context.MODE_PRIVATE)
    private val gson = Gson()

    fun saveUserData(user: User, accessToken: String) {
        apiClient.saveToken(accessToken)
        sharedPrefs.edit()
            .putString("user_data", gson.toJson(user))
            .putBoolean("is_logged_in", true)
            .apply()
    }

    fun getCurrentUser(): User? {
        val userData = sharedPrefs.getString("user_data", null)
        return if (userData != null) {
            gson.fromJson(userData, User::class.java)
        } else null
    }

    fun isLoggedIn(): Boolean {
        return sharedPrefs.getBoolean("is_logged_in", false) &&
                apiClient.getToken() != null
    }

    fun logout() {
        apiClient.clearToken()
        sharedPrefs.edit()
            .remove("user_data")
            .putBoolean("is_logged_in", false)
            .apply()
    }

    companion object {
        @Volatile
        private var INSTANCE: AuthManager? = null

        fun getInstance(context: Context): AuthManager {
            return INSTANCE ?: synchronized(this) {
                INSTANCE ?: AuthManager(context.applicationContext).also { INSTANCE = it }
            }
        }
    }
}