package com.smartlamp.taskmanager

import android.content.Intent
import android.os.Bundle
import android.view.View
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.smartlamp.taskmanager.databinding.ActivityRegisterBinding
import com.smartlamp.taskmanager.models.RegisterRequest
import com.smartlamp.taskmanager.network.ApiClient
import com.smartlamp.taskmanager.utils.AuthManager
import kotlinx.coroutines.launch

class RegisterActivity : AppCompatActivity() {

    private lateinit var binding: ActivityRegisterBinding
    private lateinit var apiClient: ApiClient
    private lateinit var authManager: AuthManager

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityRegisterBinding.inflate(layoutInflater)
        setContentView(binding.root)

        apiClient = ApiClient.getInstance(this)
        authManager = AuthManager.getInstance(this)

        setupClickListeners()
    }

    private fun setupClickListeners() {
        binding.registerButton.setOnClickListener {
            performRegister()
        }

        binding.loginTextView.setOnClickListener {
            finish() // Return to login
        }
    }

    private fun performRegister() {
        val username = binding.usernameEditText.text.toString().trim()
        val email = binding.emailEditText.text.toString().trim()
        val password = binding.passwordEditText.text.toString()
        val firstName = binding.firstNameEditText.text.toString().trim()
        val lastName = binding.lastNameEditText.text.toString().trim()

        if (username.isEmpty() || email.isEmpty() || password.isEmpty() ||
            firstName.isEmpty() || lastName.isEmpty()) {
            Toast.makeText(this, "Please fill all fields", Toast.LENGTH_SHORT).show()
            return
        }

        showLoading(true)

        lifecycleScope.launch {
            try {
                val response = apiClient.apiService.register(
                    RegisterRequest(username, email, password, firstName, lastName)
                )

                if (response.isSuccessful && response.body()?.success == true) {
                    val authResponse = response.body()?.data
                    if (authResponse != null) {
                        authManager.saveUserData(authResponse.user, authResponse.accessToken)
                        Toast.makeText(this@RegisterActivity, "Registration successful", Toast.LENGTH_SHORT).show()
                        startMainActivity()
                    }
                } else {
                    Toast.makeText(this@RegisterActivity,
                        response.body()?.message ?: "Registration failed",
                        Toast.LENGTH_SHORT).show()
                }
            } catch (e: Exception) {
                Toast.makeText(this@RegisterActivity,
                    "Network error: ${e.message}",
                    Toast.LENGTH_SHORT).show()
            } finally {
                showLoading(false)
            }
        }
    }

    private fun showLoading(show: Boolean) {
        binding.progressBar.visibility = if (show) View.VISIBLE else View.GONE
        binding.registerButton.isEnabled = !show
    }

    private fun startMainActivity() {
        startActivity(Intent(this, MainActivity::class.java))
        finish()
    }
}