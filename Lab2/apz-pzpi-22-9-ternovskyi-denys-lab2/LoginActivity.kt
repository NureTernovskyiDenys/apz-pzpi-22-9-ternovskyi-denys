package com.smartlamp.taskmanager

import android.content.Intent
import android.os.Bundle
import android.view.View
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.smartlamp.taskmanager.databinding.ActivityLoginBinding
import com.smartlamp.taskmanager.models.LoginRequest
import com.smartlamp.taskmanager.network.ApiClient
import com.smartlamp.taskmanager.utils.AuthManager
import kotlinx.coroutines.launch

class LoginActivity : AppCompatActivity() {

    private lateinit var binding: ActivityLoginBinding
    private lateinit var apiClient: ApiClient
    private lateinit var authManager: AuthManager

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityLoginBinding.inflate(layoutInflater)
        setContentView(binding.root)

        apiClient = ApiClient.getInstance(this)
        authManager = AuthManager.getInstance(this)

        // Check if already logged in
        if (authManager.isLoggedIn()) {
            startMainActivity()
            return
        }

        setupClickListeners()
    }

    private fun setupClickListeners() {
        binding.loginButton.setOnClickListener {
            performLogin()
        }

        binding.registerTextView.setOnClickListener {
            startActivity(Intent(this, RegisterActivity::class.java))
        }
    }

    private fun performLogin() {
        val email = binding.emailEditText.text.toString().trim()
        val password = binding.passwordEditText.text.toString()

        if (email.isEmpty() || password.isEmpty()) {
            Toast.makeText(this, "Please fill all fields", Toast.LENGTH_SHORT).show()
            return
        }

        showLoading(true)

        lifecycleScope.launch {
            try {
                val response = apiClient.apiService.login(LoginRequest(email, password))

                if (response.isSuccessful && response.body()?.success == true) {
                    val authResponse = response.body()?.data
                    if (authResponse != null) {
                        authManager.saveUserData(authResponse.user, authResponse.accessToken)
                        Toast.makeText(this@LoginActivity, "Login successful", Toast.LENGTH_SHORT).show()
                        startMainActivity()
                    }
                } else {
                    Toast.makeText(this@LoginActivity,
                        response.body()?.message ?: "Login failed",
                        Toast.LENGTH_SHORT).show()
                }
            } catch (e: Exception) {
                Toast.makeText(this@LoginActivity,
                    "Network error: ${e.message}",
                    Toast.LENGTH_SHORT).show()
            } finally {
                showLoading(false)
            }
        }
    }

    private fun showLoading(show: Boolean) {
        binding.progressBar.visibility = if (show) View.VISIBLE else View.GONE
        binding.loginButton.isEnabled = !show
    }

    private fun startMainActivity() {
        startActivity(Intent(this, MainActivity::class.java))
        finish()
    }
}