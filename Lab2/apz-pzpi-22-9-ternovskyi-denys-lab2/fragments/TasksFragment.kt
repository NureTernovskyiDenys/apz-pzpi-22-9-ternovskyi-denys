package com.smartlamp.taskmanager.fragments

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Toast
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import com.smartlamp.taskmanager.R
import com.smartlamp.taskmanager.adapters.TaskAdapter
import com.smartlamp.taskmanager.databinding.FragmentTasksBinding
import com.smartlamp.taskmanager.models.Task
import com.smartlamp.taskmanager.network.ApiClient
import kotlinx.coroutines.launch

class TasksFragment : Fragment() {

    private var _binding: FragmentTasksBinding? = null
    private val binding get() = _binding!!

    private lateinit var apiClient: ApiClient
    private lateinit var taskAdapter: TaskAdapter
    private var currentFilter = "all"

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentTasksBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        apiClient = ApiClient.getInstance(requireContext())

        setupUI()
        setupRecyclerView()
        setupFilters()
        loadTasks()
    }

    private fun setupUI() {
        binding.swipeRefresh.setOnRefreshListener {
            loadTasks()
        }

        binding.fabCreateTask.setOnClickListener {
            // TODO: Navigate to create task
            Toast.makeText(context, "Create task feature coming soon", Toast.LENGTH_SHORT).show()
        }
    }

    private fun setupRecyclerView() {
        taskAdapter = TaskAdapter { task ->
            // TODO: Handle task click
            Toast.makeText(context, "Clicked: ${task.title}", Toast.LENGTH_SHORT).show()
        }

        binding.tasksRecyclerView.apply {
            layoutManager = LinearLayoutManager(context)
            adapter = taskAdapter
        }
    }

    private fun setupFilters() {
        binding.chipAll.setOnClickListener { filterTasks("all") }
        binding.chipPending.setOnClickListener { filterTasks("pending") }
        binding.chipInProgress.setOnClickListener { filterTasks("in_progress") }
        binding.chipCompleted.setOnClickListener { filterTasks("completed") }
    }

    private fun filterTasks(filter: String) {
        currentFilter = filter
        loadTasks()
    }

    private fun loadTasks() {
        binding.swipeRefresh.isRefreshing = true

        lifecycleScope.launch {
            try {
                val status = if (currentFilter == "all") null else currentFilter
                val response = apiClient.apiService.getTasks(status = status)

                if (response.isSuccessful && response.body()?.success == true) {
                    val tasksData = response.body()?.data
                    if (tasksData != null) {
                        updateTasksList(tasksData.tasks)
                    }
                } else {
                    Toast.makeText(context, "Failed to load tasks", Toast.LENGTH_SHORT).show()
                }
            } catch (e: Exception) {
                Toast.makeText(context, "Network error: ${e.message}", Toast.LENGTH_SHORT).show()
            } finally {
                binding.swipeRefresh.isRefreshing = false
            }
        }
    }

    private fun updateTasksList(tasks: List<Task>) {
        if (tasks.isEmpty()) {
            binding.emptyStateTextView.visibility = View.VISIBLE
            binding.tasksRecyclerView.visibility = View.GONE
        } else {
            binding.emptyStateTextView.visibility = View.GONE
            binding.tasksRecyclerView.visibility = View.VISIBLE
            taskAdapter.updateTasks(tasks)
        }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}