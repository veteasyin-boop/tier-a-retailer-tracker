package com.ceres.agtech.tracker.data.local.entities

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "attendance_records")
data class AttendanceEntity(
    @PrimaryKey
    val id: String, // e.g. "att_Om_Prakash_2026-10-02"
    val assistant: String,
    val date: String, // YYYY-MM-DD
    val punchInTime: String?,
    val punchOutTime: String?,
    val punchInLat: Double?,
    val punchInLng: Double?,
    val punchOutLat: Double?,
    val punchOutLng: Double?,
    val punchInPhotoUri: String?,
    val punchOutPhotoUri: String?,
    val punchInAddress: String?,
    val punchOutAddress: String?,
    val isMockGpsRejected: Boolean = false,
    val syncStatus: String = "SYNCED"
)
