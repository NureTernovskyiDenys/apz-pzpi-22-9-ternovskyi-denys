package com.smartlamp.taskmanager.models

import android.os.Parcelable
import kotlinx.parcelize.Parcelize

@Parcelize
data class Device(
    val _id: String,
    val deviceId: String,
    val name: String,
    val description: String?,
    val status: String,
    val deviceType: String,
    val location: DeviceLocation?,
    val isOnline: Boolean,
    val statistics: DeviceStatistics,
    val createdAt: String
) : Parcelable

@Parcelize
data class DeviceLocation(
    val room: String?,
    val building: String?
) : Parcelable

@Parcelize
data class DeviceStatistics(
    val totalTasksReceived: Int,
    val totalTasksCompleted: Int,
    val totalUptime: Int
) : Parcelable