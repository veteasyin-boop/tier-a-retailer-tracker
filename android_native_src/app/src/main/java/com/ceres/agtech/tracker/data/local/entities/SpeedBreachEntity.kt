package com.ceres.agtech.tracker.data.local.entities

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "speed_breaches")
data class SpeedBreachEntity(
    @PrimaryKey
    val id: String,
    val assistant: String,
    val timestamp: Long,
    val speedKmH: Int,
    val thresholdKmH: Int,
    val excessKmH: Int,
    val vehicleMode: String,
    val lat: Double,
    val lng: Double,
    val locationName: String?,
    val acknowledged: Boolean = false,
    val acknowledgedAt: Long? = null
)
