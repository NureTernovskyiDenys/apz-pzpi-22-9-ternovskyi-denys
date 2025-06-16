package com.smartlamp.taskmanager.models

import android.os.Parcelable
import kotlinx.parcelize.Parcelize

@Parcelize
data class Task(
    val _id: String,
    val title: String? = null,
    val description: String? = null,
    val category: String? = "other",
    val priority: Int = 2,
    val status: String? = "pending",
    val timing: TaskTiming,
    val assignedDevice: String? = null,
    val progress: TaskProgress? = null,
    val createdAt: String? = null,
    val tags: List<String>? = null
) : Parcelable

@Parcelize
data class TaskTiming(
    val estimatedDuration: Int = 30,
    val actualDuration: Int = 0,
    val deadline: String? = null,
    val scheduledStart: String? = null,
    val actualStart: String? = null,
    val actualEnd: String? = null
) : Parcelable

@Parcelize
data class TaskProgress(
    val percentage: Int = 0,
    val notes: List<TaskNote>? = null
) : Parcelable

@Parcelize
data class TaskNote(
    val content: String,
    val timestamp: String
) : Parcelable