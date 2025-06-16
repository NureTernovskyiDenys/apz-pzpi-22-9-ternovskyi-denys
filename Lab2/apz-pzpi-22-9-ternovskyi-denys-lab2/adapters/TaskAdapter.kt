package com.smartlamp.taskmanager.adapters

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.core.content.ContextCompat
import androidx.recyclerview.widget.RecyclerView
import com.smartlamp.taskmanager.R
import com.smartlamp.taskmanager.databinding.ItemTaskBinding
import com.smartlamp.taskmanager.models.Task

class TaskAdapter(
    private val onTaskClick: (Task) -> Unit
) : RecyclerView.Adapter<TaskAdapter.TaskViewHolder>() {

    private var tasks = listOf<Task>()

    fun updateTasks(newTasks: List<Task>) {
        tasks = newTasks
        notifyDataSetChanged()
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): TaskViewHolder {
        val binding = ItemTaskBinding.inflate(
            LayoutInflater.from(parent.context),
            parent,
            false
        )
        return TaskViewHolder(binding)
    }

    override fun onBindViewHolder(holder: TaskViewHolder, position: Int) {
        holder.bind(tasks[position])
    }

    override fun getItemCount() = tasks.size

    inner class TaskViewHolder(
        private val binding: ItemTaskBinding
    ) : RecyclerView.ViewHolder(binding.root) {

        fun bind(task: Task) {
            binding.taskTitle.text = task.title ?: "Untitled"
            binding.taskCategory.text = (task.category ?: "other").replaceFirstChar {
                if (it.isLowerCase()) it.titlecase() else it.toString()
            }
            binding.taskDuration.text = "${task.timing.estimatedDuration} min"

            // Безопасная обработка статуса
            val status = task.status ?: "pending"
            binding.statusChip.text = status.replace("_", " ").replaceFirstChar {
                if (it.isLowerCase()) it.titlecase() else it.toString()
            }

            // Set priority indicator color
            val priorityColor = when (task.priority) {
                1 -> ContextCompat.getColor(binding.root.context, R.color.priority_high)
                2 -> ContextCompat.getColor(binding.root.context, R.color.priority_medium)
                3 -> ContextCompat.getColor(binding.root.context, R.color.priority_low)
                else -> ContextCompat.getColor(binding.root.context, R.color.priority_medium)
            }
            binding.priorityIndicator.setBackgroundColor(priorityColor)

            // Show/hide action buttons based on status
            when (status) {
                "pending", "assigned" -> {
                    binding.actionButtonsLayout.visibility = View.VISIBLE
                    binding.startButton.visibility = View.VISIBLE
                    binding.pauseButton.visibility = View.GONE
                }
                "in_progress" -> {
                    binding.actionButtonsLayout.visibility = View.VISIBLE
                    binding.startButton.visibility = View.GONE
                    binding.pauseButton.visibility = View.VISIBLE
                }
                else -> {
                    binding.actionButtonsLayout.visibility = View.GONE
                }
            }

            // Set click listeners
            binding.root.setOnClickListener { onTaskClick(task) }
            binding.startButton.setOnClickListener {
                // TODO: Start task
            }
            binding.pauseButton.setOnClickListener {
                // TODO: Pause task
            }
        }
    }
}