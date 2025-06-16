package com.smartlamp.taskmanager.fragments

import android.app.TimePickerDialog
import android.content.Intent
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Toast
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import com.smartlamp.taskmanager.LoginActivity
import com.smartlamp.taskmanager.databinding.FragmentProfileBinding
import com.smartlamp.taskmanager.models.UserPreferences
import com.smartlamp.taskmanager.models.WorkSchedule
import com.smartlamp.taskmanager.network.ApiClient
import com.smartlamp.taskmanager.network.ChangePasswordRequest
import com.smartlamp.taskmanager.network.UpdateProfileRequest
import com.smartlamp.taskmanager.utils.AuthManager
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.*

class ProfileFragment : Fragment() {

    private var _binding: FragmentProfileBinding? = null
    private val binding get() = _binding!!

    private lateinit var apiClient: ApiClient
    private lateinit var authManager: AuthManager

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentProfileBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        apiClient = ApiClient.getInstance(requireContext())
        authManager = AuthManager.getInstance(requireContext())

        setupUI()
        loadUserData()
        setupClickListeners()
    }

    private fun setupUI() {
        // Setup time pickers
        binding.startTimeEditText.setOnClickListener {
            showTimePicker { time ->
                binding.startTimeEditText.setText(time)
            }
        }

        binding.endTimeEditText.setOnClickListener {
            showTimePicker { time ->
                binding.endTimeEditText.setText(time)
            }
        }
    }

    private fun loadUserData() {
        val user = authManager.getCurrentUser()
        if (user != null) {
            binding.userNameTextView.text = "${user.firstName} ${user.lastName}"
            binding.userEmailTextView.text = user.email

            binding.firstNameEditText.setText(user.firstName)
            binding.lastNameEditText.setText(user.lastName)
            binding.timezoneEditText.setText(user.preferences.timezone)
            binding.startTimeEditText.setText(user.preferences.workSchedule.startTime)
            binding.endTimeEditText.setText(user.preferences.workSchedule.endTime)
        }
    }

    private fun setupClickListeners() {
        binding.updateProfileButton.setOnClickListener {
            updateProfile()
        }

        binding.changePasswordButton.setOnClickListener {
            changePassword()
        }

        binding.logoutButton.setOnClickListener {
            logout()
        }
    }

    private fun updateProfile() {
        val firstName = binding.firstNameEditText.text.toString().trim()
        val lastName = binding.lastNameEditText.text.toString().trim()
        val timezone = binding.timezoneEditText.text.toString().trim()
        val startTime = binding.startTimeEditText.text.toString()
        val endTime = binding.endTimeEditText.text.toString()

        if (firstName.isEmpty() || lastName.isEmpty()) {
            Toast.makeText(context, "Please fill all required fields", Toast.LENGTH_SHORT).show()
            return
        }

        showLoading(true)

        val updateRequest = UpdateProfileRequest(
            firstName = firstName,
            lastName = lastName,
            preferences = UserPreferences(
                timezone = timezone,
                language = "en",
                workSchedule = WorkSchedule(
                    startTime = startTime,
                    endTime = endTime
                )
            )
        )

        lifecycleScope.launch {
            try {
                val response = apiClient.apiService.updateProfile(updateRequest)

                if (response.isSuccessful && response.body()?.success == true) {
                    val userData = response.body()?.data?.user
                    if (userData != null) {
                        authManager.saveUserData(userData, apiClient.getToken() ?: "")
                        loadUserData() // Refresh UI
                        Toast.makeText(context, "Profile updated successfully", Toast.LENGTH_SHORT).show()
                    }
                } else {
                    Toast.makeText(context,
                        response.body()?.message ?: "Failed to update profile",
                        Toast.LENGTH_SHORT).show()
                }
            } catch (e: Exception) {
                Toast.makeText(context, "Network error: ${e.message}", Toast.LENGTH_SHORT).show()
            } finally {
                showLoading(false)
            }
        }
    }

    private fun changePassword() {
        val currentPassword = binding.currentPasswordEditText.text.toString()
        val newPassword = binding.newPasswordEditText.text.toString()
        val confirmPassword = binding.confirmPasswordEditText.text.toString()

        if (currentPassword.isEmpty() || newPassword.isEmpty() || confirmPassword.isEmpty()) {
            Toast.makeText(context, "Please fill all password fields", Toast.LENGTH_SHORT).show()
            return
        }

        if (newPassword != confirmPassword) {
            Toast.makeText(context, "New passwords don't match", Toast.LENGTH_SHORT).show()
            return
        }

        if (newPassword.length < 6) {
            Toast.makeText(context, "New password must be at least 6 characters", Toast.LENGTH_SHORT).show()
            return
        }

        showLoading(true)

        val changeRequest = ChangePasswordRequest(
            currentPassword = currentPassword,
            newPassword = newPassword,
            confirmPassword = confirmPassword
        )

        lifecycleScope.launch {
            try {
                val response = apiClient.apiService.changePassword(changeRequest)

                if (response.isSuccessful && response.body()?.success == true) {
                    Toast.makeText(context, "Password changed successfully", Toast.LENGTH_SHORT).show()
                    clearPasswordFields()
                } else {
                    Toast.makeText(context,
                        response.body()?.message ?: "Failed to change password",
                        Toast.LENGTH_SHORT).show()
                }
            } catch (e: Exception) {
                Toast.makeText(context, "Network error: ${e.message}", Toast.LENGTH_SHORT).show()
            } finally {
                showLoading(false)
            }
        }
    }

    private fun logout() {
        lifecycleScope.launch {
            try {
                apiClient.apiService.logout()
            } catch (e: Exception) {
                // Ignore logout errors
            }

            authManager.logout()

            val intent = Intent(requireContext(), LoginActivity::class.java)
            intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
            startActivity(intent)
            requireActivity().finish()
        }
    }

    private fun showTimePicker(onTimeSelected: (String) -> Unit) {
        val calendar = Calendar.getInstance()
        val hour = calendar.get(Calendar.HOUR_OF_DAY)
        val minute = calendar.get(Calendar.MINUTE)

        TimePickerDialog(
            requireContext(),
            { _, selectedHour, selectedMinute ->
                val time = String.format("%02d:%02d", selectedHour, selectedMinute)
                onTimeSelected(time)
            },
            hour,
            minute,
            true
        ).show()
    }

    private fun clearPasswordFields() {
        binding.currentPasswordEditText.setText("")
        binding.newPasswordEditText.setText("")
        binding.confirmPasswordEditText.setText("")
    }

    private fun showLoading(show: Boolean) {
        binding.progressBar.visibility = if (show) View.VISIBLE else View.GONE
        binding.updateProfileButton.isEnabled = !show
        binding.changePasswordButton.isEnabled = !show
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}