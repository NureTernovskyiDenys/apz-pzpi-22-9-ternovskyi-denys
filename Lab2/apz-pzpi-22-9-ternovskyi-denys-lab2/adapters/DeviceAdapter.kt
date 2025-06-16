package com.smartlamp.taskmanager.adapters

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.core.content.ContextCompat
import androidx.recyclerview.widget.RecyclerView
import com.smartlamp.taskmanager.R
import com.smartlamp.taskmanager.databinding.ItemDeviceBinding
import com.smartlamp.taskmanager.models.Device

class DeviceAdapter(
    private val onDeviceClick: (Device) -> Unit
) : RecyclerView.Adapter<DeviceAdapter.DeviceViewHolder>() {

    private var devices = listOf<Device>()

    fun updateDevices(newDevices: List<Device>) {
        devices = newDevices
        notifyDataSetChanged()
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): DeviceViewHolder {
        val binding = ItemDeviceBinding.inflate(
            LayoutInflater.from(parent.context),
            parent,
            false
        )
        return DeviceViewHolder(binding)
    }

    override fun onBindViewHolder(holder: DeviceViewHolder, position: Int) {
        holder.bind(devices[position])
    }

    override fun getItemCount() = devices.size

    inner class DeviceViewHolder(
        private val binding: ItemDeviceBinding
    ) : RecyclerView.ViewHolder(binding.root) {

        fun bind(device: Device) {
            binding.deviceName.text = device.name ?: "Unknown Device"
            binding.deviceType.text = (device.deviceType ?: "smart_lamp").replace("_", " ").replaceFirstChar {
                if (it.isLowerCase()) it.titlecase() else it.toString()
            }

            // Device location
            val location = device.location
            val locationText = when {
                location?.room != null && location.building != null ->
                    "${location.room}, ${location.building}"
                location?.room != null -> location.room
                location?.building != null -> location.building
                else -> "Unknown Location"
            }
            binding.deviceLocation.text = locationText

            // Status indicator
            val isOnline = device.isOnline
            val statusColor = if (isOnline) {
                ContextCompat.getColor(binding.root.context, R.color.status_completed)
            } else {
                ContextCompat.getColor(binding.root.context, R.color.status_pending)
            }

            binding.statusIndicator.backgroundTintList =
                android.content.res.ColorStateList.valueOf(statusColor)
            binding.statusText.text = if (isOnline) "Online" else "Offline"

            // Statistics
            binding.tasksCompletedText.text = "Tasks: ${device.statistics.totalTasksCompleted}"

            val uptimeHours = device.statistics.totalUptime / 60
            binding.uptimeText.text = "Uptime: ${uptimeHours}h"

            // Click listener
            binding.root.setOnClickListener { onDeviceClick(device) }
        }
    }
}