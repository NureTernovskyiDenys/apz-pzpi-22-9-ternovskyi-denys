package com.smartlamp.taskmanager.fragments

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Toast
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import com.smartlamp.taskmanager.adapters.DeviceAdapter
import com.smartlamp.taskmanager.databinding.FragmentDevicesBinding
import com.smartlamp.taskmanager.models.Device
import com.smartlamp.taskmanager.network.ApiClient
import kotlinx.coroutines.launch

class DevicesFragment : Fragment() {

    private var _binding: FragmentDevicesBinding? = null
    private val binding get() = _binding!!

    private lateinit var apiClient: ApiClient
    private lateinit var deviceAdapter: DeviceAdapter

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentDevicesBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        apiClient = ApiClient.getInstance(requireContext())

        setupUI()
        setupRecyclerView()
        loadDevices()
    }

    private fun setupUI() {
        binding.swipeRefresh.setOnRefreshListener {
            loadDevices()
        }
    }

    private fun setupRecyclerView() {
        deviceAdapter = DeviceAdapter { device ->
            // TODO: Handle device click - show device details
            Toast.makeText(context, "Device: ${device.name}", Toast.LENGTH_SHORT).show()
        }

        binding.devicesRecyclerView.apply {
            layoutManager = LinearLayoutManager(context)
            adapter = deviceAdapter
        }
    }

    private fun loadDevices() {
        binding.swipeRefresh.isRefreshing = true

        lifecycleScope.launch {
            try {
                val response = apiClient.apiService.getDevices()

                if (response.isSuccessful && response.body()?.success == true) {
                    val devicesData = response.body()?.data
                    if (devicesData != null) {
                        updateDevicesList(devicesData.devices)
                    }
                } else {
                    Toast.makeText(context, "Failed to load devices", Toast.LENGTH_SHORT).show()
                }
            } catch (e: Exception) {
                Toast.makeText(context, "Network error: ${e.message}", Toast.LENGTH_SHORT).show()
            } finally {
                binding.swipeRefresh.isRefreshing = false
            }
        }
    }

    private fun updateDevicesList(devices: List<Device>) {
        if (devices.isEmpty()) {
            binding.emptyStateTextView.visibility = View.VISIBLE
            binding.devicesRecyclerView.visibility = View.GONE
        } else {
            binding.emptyStateTextView.visibility = View.GONE
            binding.devicesRecyclerView.visibility = View.VISIBLE
            deviceAdapter.updateDevices(devices)
        }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}