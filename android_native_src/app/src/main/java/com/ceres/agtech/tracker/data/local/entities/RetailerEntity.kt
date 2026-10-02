package com.ceres.agtech.tracker.data.local.entities

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "retailers")
data class RetailerEntity(
    @PrimaryKey
    val id: String,
    val retailer: String,
    val mobile: String?,
    val block: String,
    val district: String,
    val lat: Double?,
    val lng: Double?,
    val potentialFor: String?,
    val potentialSell: String?,
    val status: String = "Pending", // Visited, Called, Pending
    val verifiedVisit: Boolean = false,
    val checkInDate: String? = null,
    val checkInTime: String? = null,
    val checkInLat: Double? = null,
    val checkInLng: Double? = null,
    val checkInDistKm: Double? = null,
    val checkInMapUrl: String? = null,
    val storefrontPhotoUri: String? = null,
    val lastVisitDate: String? = null,
    val followUpDate: String? = null,
    val totalOrdersValue: Double = 0.0,
    val notes: String? = null,
    val assistant: String, // Station owner (e.g. Om Prakash)
    val syncStatus: String = "SYNCED" // SYNCED, PENDING_SYNC
)
