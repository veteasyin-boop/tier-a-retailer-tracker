package com.ceres.agtech.tracker.data.local.entities

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "tada_claims")
data class TadaClaimEntity(
    @PrimaryKey
    val id: String,
    val assistant: String,
    val date: String,
    val vehicleMode: String, // Bike, Car, Bus
    val gpsKm: Double,
    val approvedKm: Double,
    val ratePerKm: Double,
    val dailyAllowanceDa: Double,
    val totalClaimAmount: Double,
    val receiptPhotoUri: String? = null,
    val remarks: String? = null,
    val status: String = "Submitted", // Submitted, Approved, Rejected
    val syncStatus: String = "PENDING_SYNC"
)
