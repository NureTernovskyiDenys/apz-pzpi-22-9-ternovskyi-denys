package com.smartlamp.taskmanager.network

import com.smartlamp.taskmanager.models.*
import retrofit2.Response
import retrofit2.http.*

interface ApiService {

    @POST("auth/login")
    suspend fun login(@Body request: LoginRequest): Response<ApiResponse<AuthResponse>>

    @POST("auth/register")
    suspend fun register(@Body request: RegisterRequest): Response<ApiResponse<AuthResponse>>

    @GET("auth/me")
    suspend fun getCurrentUser(): Response<ApiResponse<UserWrapper>>

    @GET("tasks")
    suspend fun getTasks(
        @Query("page") page: Int = 1,
        @Query("limit") limit: Int = 20,
        @Query("status") status: String? = null,
        @Query("category") category: String? = null
    ): Response<ApiResponse<TaskListResponse>>

    @POST("tasks")
    suspend fun createTask(@Body request: CreateTaskRequest): Response<ApiResponse<TaskWrapper>>

    @GET("tasks/{taskId}")
    suspend fun getTask(@Path("taskId") taskId: String): Response<ApiResponse<TaskWrapper>>

    @POST("tasks/{taskId}/start")
    suspend fun startTask(@Path("taskId") taskId: String): Response<ApiResponse<TaskWrapper>>

    @POST("tasks/{taskId}/pause")
    suspend fun pauseTask(@Path("taskId") taskId: String): Response<ApiResponse<TaskWrapper>>

    @POST("tasks/{taskId}/complete")
    suspend fun completeTask(
        @Path("taskId") taskId: String,
        @Body request: CompleteTaskRequest
    ): Response<ApiResponse<TaskWrapper>>

    @GET("devices")
    suspend fun getDevices(): Response<ApiResponse<DeviceListResponse>>

    @GET("analytics/dashboard")
    suspend fun getDashboard(): Response<ApiResponse<DashboardData>>

    @PUT("auth/profile")
    suspend fun updateProfile(@Body request: UpdateProfileRequest): Response<ApiResponse<UserWrapper>>

    @PUT("auth/change-password")
    suspend fun changePassword(@Body request: ChangePasswordRequest): Response<ApiResponse<Any>>

    @POST("auth/logout")
    suspend fun logout(): Response<ApiResponse<Any>>
}

data class UserWrapper(val user: User)
data class TaskWrapper(val task: Task)
data class DeviceListResponse(val devices: List<Device>)
data class CompleteTaskRequest(val rating: Int?, val feedback: String?)

data class DashboardData(
    val overview: DashboardOverview,
    val upcomingDeadlines: List<Task>
)

data class DashboardOverview(
    val totalTasksCompleted: Int,
    val productivityScore: Int,
    val todaysTasks: Int,
    val streakDays: Int
)

data class UpdateProfileRequest(
    val firstName: String? = null,
    val lastName: String? = null,
    val preferences: UserPreferences? = null
)

data class ChangePasswordRequest(
    val currentPassword: String,
    val newPassword: String,
    val confirmPassword: String
)