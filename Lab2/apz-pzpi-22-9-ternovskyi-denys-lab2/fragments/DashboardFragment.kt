package com.smartlamp.taskmanager.fragments

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Toast
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import com.smartlamp.taskmanager.adapters.TaskAdapter
import com.smartlamp.taskmanager.databinding.FragmentDashboardBinding
import com.smartlamp.taskmanager.models.Task
import com.smartlamp.taskmanager.network.ApiClient
import com.smartlamp.taskmanager.network.DashboardData  // Исправленный импорт
import com.smartlamp.taskmanager.utils.AuthManager
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.*

class DashboardFragment : Fragment() {

    private var _binding: FragmentDashboardBinding? = null
    private val binding get() = _binding!!

    private lateinit var apiClient: ApiClient
    private lateinit var authManager: AuthManager
    private lateinit var taskAdapter: TaskAdapter

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentDashboardBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        apiClient = ApiClient.getInstance(requireContext())
        authManager = AuthManager.getInstance(requireContext())

        setupUI()
        setupRecyclerView()
        loadDashboardData()
    }

    private fun setupUI() {
        val user = authManager.getCurrentUser()
        binding.welcomeTextView.text = "Welcome back, ${user?.firstName}!"

        val dateFormat = SimpleDateFormat("EEEE, MMMM d", Locale.getDefault())
        binding.dateTextView.text = dateFormat.format(Date())

        binding.swipeRefresh.setOnRefreshListener {
            loadDashboardData()
        }

        binding.createTaskButton.setOnClickListener {
            // TODO: Navigate to create task
            Toast.makeText(context, "Create task feature coming soon", Toast.LENGTH_SHORT).show()
        }
    }

    private fun setupRecyclerView() {
        taskAdapter = TaskAdapter { task ->
            // TODO: Handle task click
            Toast.makeText(context, "Clicked: ${task.title}", Toast.LENGTH_SHORT).show()
        }

        binding.todayTasksRecyclerView.apply {
            layoutManager = LinearLayoutManager(context)
            adapter = taskAdapter
        }
    }

    private fun loadDashboardData() {
        binding.swipeRefresh.isRefreshing = true

        lifecycleScope.launch {
            try {
                val response = apiClient.apiService.getDashboard()

                if (response.isSuccessful && response.body()?.success == true) {
                    val dashboardData = response.body()?.data
                    if (dashboardData != null) {
                        updateDashboardUI(dashboardData)
                    }
                } else {
                    Toast.makeText(context, "Failed to load dashboard", Toast.LENGTH_SHORT).show()
                }
            } catch (e: Exception) {
                Toast.makeText(context, "Network error: ${e.message}", Toast.LENGTH_SHORT).show()
            } finally {
                binding.swipeRefresh.isRefreshing = false
            }
        }
    }

    private fun updateDashboardUI(dashboardData: DashboardData) {
        binding.completedTasksNumber.text = dashboardData.overview.totalTasksCompleted.toString()
        binding.productivityScore.text = dashboardData.overview.productivityScore.toString()

        // Update today's tasks - проверяем что upcomingDeadlines не null
        val tasks = dashboardData.upcomingDeadlines ?: emptyList()
        taskAdapter.updateTasks(tasks)
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}