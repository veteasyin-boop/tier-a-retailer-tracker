package com.ceres.agtech.tracker

import android.app.Application
import android.app.NotificationChannel
import android.app.NotificationManager
import android.os.Build
import com.ceres.agtech.tracker.data.local.AppDatabase

class TierATrackerApp : Application() {

    lateinit var database: AppDatabase
        private set

    override fun onCreate() {
        super.onCreate()
        instance = this
        database = AppDatabase.getInstance(this)
        createNotificationChannels()
    }

    private fun createNotificationChannels() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val dutyChannel = NotificationChannel(
                CHANNEL_DUTY_TRACKING,
                getString(R.string.notification_channel_name),
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = getString(R.string.notification_channel_desc)
                setShowBadge(false)
            }

            val alertChannel = NotificationChannel(
                CHANNEL_SAFETY_ALERTS,
                "Field Safety & Over-Speed Notices",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Urgent alerts regarding fleet speed threshold violations and manager SOP pings"
                enableVibration(true)
            }

            val manager = getSystemService(NotificationManager::class.java)
            manager.createNotificationChannel(dutyChannel)
            manager.createNotificationChannel(alertChannel)
        }
    }

    companion object {
        const val CHANNEL_DUTY_TRACKING = "field_duty_tracking"
        const val CHANNEL_SAFETY_ALERTS = "field_safety_alerts"
        lateinit var instance: TierATrackerApp
            private set
    }
}
