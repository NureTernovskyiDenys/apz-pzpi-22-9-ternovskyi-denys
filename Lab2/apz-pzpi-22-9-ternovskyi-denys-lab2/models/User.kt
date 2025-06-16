package com.smartlamp.taskmanager.models

import android.os.Parcelable
import kotlinx.parcelize.Parcelize

@Parcelize
data class User(
    val _id: String,
    val username: String,
    val email: String,
    val firstName: String,
    val lastName: String,
    val role: String,
    val preferences: UserPreferences,
    val statistics: UserStatistics,
    val createdAt: String
) : Parcelable

@Parcelize
data class UserPreferences(
    val timezone: String,
    val language: String,
    val workSchedule: WorkSchedule
) : Parcelable

@Parcelize
data class WorkSchedule(
    val startTime: String,
    val endTime: String
) : Parcelable

@Parcelize
data class UserStatistics(
    val totalTasksCompleted: Int,
    val totalWorkingTime: Int,
    val averageTaskDuration: Int,
    val streakDays: Int
) : Parcelable