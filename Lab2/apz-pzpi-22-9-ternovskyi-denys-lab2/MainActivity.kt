package com.smartlamp.taskmanager

import android.content.Intent
import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity
import androidx.fragment.app.Fragment
import com.google.android.material.bottomnavigation.BottomNavigationView
import com.smartlamp.taskmanager.databinding.ActivityMainBinding
import com.smartlamp.taskmanager.fragments.*
import com.smartlamp.taskmanager.utils.AuthManager

class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding
    private lateinit var authManager: AuthManager

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        authManager = AuthManager.getInstance(this)

        // Check if user is logged in
        if (!authManager.isLoggedIn()) {
            startActivity(Intent(this, LoginActivity::class.java))
            finish()
            return
        }

        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        setupBottomNavigation()

        // Set default fragment
        if (savedInstanceState == null) {
            switchFragment(DashboardFragment())
        }
    }

    private fun setupBottomNavigation() {
        binding.bottomNavigation.setOnItemSelectedListener { item ->
            when (item.itemId) {
                R.id.nav_dashboard -> {
                    switchFragment(DashboardFragment())
                    true
                }
                R.id.nav_tasks -> {
                    switchFragment(TasksFragment())
                    true
                }
                R.id.nav_devices -> {
                    switchFragment(DevicesFragment())
                    true
                }
                R.id.nav_profile -> {
                    switchFragment(ProfileFragment())
                    true
                }
                else -> false
            }
        }
    }

    private fun switchFragment(fragment: Fragment) {
        supportFragmentManager.beginTransaction()
            .replace(R.id.fragmentContainer, fragment)
            .commit()
    }
}