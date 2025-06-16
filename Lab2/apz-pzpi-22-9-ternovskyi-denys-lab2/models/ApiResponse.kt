package com.smartlamp.taskmanager.models

data class ApiResponse<T>(
    val success: Boolean,
    val message: String?,
    val data: T?
)

data class LoginRequest(
    val email: String,
    val password: String
)

data class RegisterRequest(
    val username: String,
    val email: String,
    val password: String,
    val firstName: String,
    val lastName: String
)

data class AuthResponse(
    val user: User,
    val accessToken: String,
    val refreshToken: String
)

data class CreateTaskRequest(
    val title: String,
    val description: String?,
    val category: String,
    val priority: Int,
    val timing: TaskTimingRequest,
    val tags: List<String>?
)

data class TaskTimingRequest(
    val estimatedDuration: Int,
    val deadline: String?,
    val scheduledStart: String?
)

data class TaskListResponse(
    val tasks: List<Task>,
    val pagination: Pagination
)

data class Pagination(
    val currentPage: Int,
    val totalPages: Int,
    val totalTasks: Int
)