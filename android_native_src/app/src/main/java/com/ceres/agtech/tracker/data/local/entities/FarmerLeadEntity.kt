package com.ceres.agtech.tracker.data.local.entities

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "farmer_leads")
data class FarmerLeadEntity(
    @PrimaryKey
    val id: String,
    val assistant: String,
    val farmerName: String,
    val village: String,
    val block: String,
    val mobile: String?,
    val crop: String,
    val acreage: Double,
    val stage: String = "New", // New, Contacted, Trial Sample, Committed, Converted
    val potentialKgLtr: Double = 0.0,
    val followUpDate: String? = null,
    val notes: String? = null,
    val syncStatus: String = "PENDING_SYNC"
)
