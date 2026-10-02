package com.ceres.agtech.tracker.service

import android.annotation.SuppressLint
import android.app.Notification
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.location.Location
import android.os.Build
import android.os.IBinder
import android.os.Looper
import android.os.PowerManager
import androidx.core.app.NotificationCompat
import com.ceres.agtech.tracker.MainActivity
import com.ceres.agtech.tracker.R
import com.ceres.agtech.tracker.TierATrackerApp
import com.ceres.agtech.tracker.data.local.entities.SpeedBreachEntity
import com.google.android.gms.location.*
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import java.util.UUID

class LocationTrackingService : Service() {

    private lateinit var fusedLocationClient: FusedLocationProviderClient
    private lateinit var locationCallback: LocationCallback
    private var wakeLock: PowerManager.WakeLock? = null

    private var lastLocation: Location? = null
    private var accumulatedGpsMeters: Double = 0.0

    private val serviceScope = CoroutineScope(Dispatchers.IO)

    override fun onCreate() {
        super.onCreate()
        fusedLocationClient = LocationServices.getFusedLocationProviderClient(this)

        val powerManager = getSystemService(POWER_SERVICE) as PowerManager
        wakeLock = powerManager.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "TierATracker::LocationWakeLock").apply {
            setReferenceCounted(false)
        }

        setupLocationCallback()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val action = intent?.action
        if (action == ACTION_STOP) {
            stopTracking()
            stopSelf()
            return START_NOT_STICKY
        }

        wakeLock?.acquire(10 * 60 * 1000L /*10 minutes before auto release*/)
        startForeground(NOTIFICATION_ID, buildForegroundNotification("Tracking active • GPS locked"))
        startLocationUpdates()

        return START_STICKY
    }

    private fun setupLocationCallback() {
        locationCallback = object : LocationCallback() {
            override fun onLocationResult(result: LocationResult) {
                for (location in result.locations) {
                    processLocationUpdate(location)
                }
            }
        }
    }

    private fun processLocationUpdate(location: Location) {
        // 1. Anti-Spoofing & Mock Location Detection
        val isMock = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            location.isMock
        } else {
            @Suppress("DEPRECATION")
            location.isFromMockProvider
        }

        if (isMock) {
            // Reject mock coordinates to prevent GPS faking
            return
        }

        // 2. Distance accumulation for TA/DA Mileage
        lastLocation?.let { prev ->
            val dist = prev.distanceTo(location)
            if (dist in 2.0..500.0) { // filter out GPS jitter and impossibly large jumps
                accumulatedGpsMeters += dist
            }
        }
        lastLocation = location

        // 3. Real-time Speed Telemetry Violation Check
        val speedKmH = (location.speed * 3.6).toInt()
        val thresholdKmH = 70 // Default highway safety threshold
        if (speedKmH > thresholdKmH) {
            val excessKmH = speedKmH - thresholdKmH
            recordSpeedViolation(speedKmH, thresholdKmH, excessKmH, location)
        }

        // Update notification status
        val kmText = String.format("%.2f km logged", accumulatedGpsMeters / 1000.0)
        val note = buildForegroundNotification("Active Duty • $kmText • Speed: $speedKmH km/h")
        val notificationManager = getSystemService(NOTIFICATION_SERVICE) as android.app.NotificationManager
        notificationManager.notify(NOTIFICATION_ID, note)
    }

    private fun recordSpeedViolation(speedKmH: Int, threshold: Int, excess: Int, loc: Location) {
        serviceScope.launch {
            val breach = SpeedBreachEntity(
                id = "speed_${UUID.randomUUID().toString().substring(0, 8)}",
                assistant = "Om Prakash",
                timestamp = System.currentTimeMillis(),
                speedKmH = speedKmH,
                thresholdKmH = threshold,
                excessKmH = excess,
                vehicleMode = "Car",
                lat = loc.latitude,
                lng = loc.longitude,
                locationName = "Bihar Highway Transit"
            )
            TierATrackerApp.instance.database.speedBreachDao().insert(breach)
        }
    }

    @SuppressLint("MissingPermission")
    private fun startLocationUpdates() {
        val request = LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, 5000L).apply {
            setMinUpdateIntervalMillis(3000L)
            setMinUpdateDistanceMeters(5f)
            setWaitForAccurateLocation(false)
        }.build()

        fusedLocationClient.requestLocationUpdates(request, locationCallback, Looper.getMainLooper())
    }

    private fun stopTracking() {
        fusedLocationClient.removeLocationUpdates(locationCallback)
        if (wakeLock?.isHeld == true) {
            wakeLock?.release()
        }
        stopForeground(STOP_FOREGROUND_REMOVE)
    }

    private fun buildForegroundNotification(statusText: String): Notification {
        val pendingIntent = PendingIntent.getActivity(
            this,
            0,
            Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )

        return NotificationCompat.Builder(this, TierATrackerApp.CHANNEL_DUTY_TRACKING)
            .setContentTitle("🌾 AgriField Truein Tracking Active")
            .setContentText(statusText)
            .setSmallIcon(R.drawable.ic_stat_location)
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .build()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        super.onDestroy()
        stopTracking()
    }

    companion object {
        const val ACTION_START = "ACTION_START_TRACKING"
        const val ACTION_STOP = "ACTION_STOP_TRACKING"
        const val NOTIFICATION_ID = 1001
    }
}
