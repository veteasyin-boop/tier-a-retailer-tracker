package com.ceres.agtech.tracker.data.local

import androidx.room.*
import com.ceres.agtech.tracker.data.local.entities.AttendanceEntity
import kotlinx.coroutines.flow.Flow

@Dao
interface AttendanceDao {
    @Query("SELECT * FROM attendance_records WHERE assistant = :assistant AND date = :date LIMIT 1")
    fun getTodayAttendance(assistant: String, date: String): Flow<AttendanceEntity?>

    @Query("SELECT * FROM attendance_records WHERE assistant = :assistant ORDER BY date DESC")
    fun getAllAttendance(assistant: String): Flow<List<AttendanceEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertOrUpdate(attendance: AttendanceEntity)

    @Query("""
        UPDATE attendance_records 
        SET punchOutTime = :time,
            punchOutLat = :lat,
            punchOutLng = :lng,
            punchOutPhotoUri = :photoUri,
            syncStatus = 'PENDING_SYNC'
        WHERE id = :id
    """)
    suspend fun recordPunchOut(id: String, time: String, lat: Double, lng: Double, photoUri: String?)
}
