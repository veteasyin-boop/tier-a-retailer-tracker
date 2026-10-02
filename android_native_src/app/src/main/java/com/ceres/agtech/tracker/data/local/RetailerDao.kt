package com.ceres.agtech.tracker.data.local

import androidx.room.*
import com.ceres.agtech.tracker.data.local.entities.RetailerEntity
import kotlinx.coroutines.flow.Flow

@Dao
interface RetailerDao {
    @Query("SELECT * FROM retailers WHERE assistant = :assistant ORDER BY retailer ASC")
    fun getRetailersByAssistant(assistant: String): Flow<List<RetailerEntity>>

    @Query("SELECT * FROM retailers WHERE id = :id LIMIT 1")
    suspend fun getRetailerById(id: String): RetailerEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertOrUpdate(retailer: RetailerEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAll(retailers: List<RetailerEntity>)

    @Query("""
        UPDATE retailers 
        SET verifiedVisit = 1, 
            checkInDate = :date, 
            checkInTime = :time, 
            checkInLat = :lat, 
            checkInLng = :lng, 
            checkInDistKm = :distKm,
            lastVisitDate = :date,
            status = 'Visited',
            syncStatus = 'PENDING_SYNC'
        WHERE id = :retailerId
    """)
    suspend fun recordCheckIn(
        retailerId: String,
        date: String,
        time: String,
        lat: Double,
        lng: Double,
        distKm: Double
    )

    @Query("UPDATE retailers SET followUpDate = :followUpDate, syncStatus = 'PENDING_SYNC' WHERE id = :retailerId")
    suspend fun updateFollowUpDate(retailerId: String, followUpDate: String)

    @Query("UPDATE retailers SET totalOrdersValue = totalOrdersValue + :orderValue, syncStatus = 'PENDING_SYNC' WHERE id = :retailerId")
    suspend fun incrementOrderValue(retailerId: String, orderValue: Double)

    @Query("SELECT COUNT(*) FROM retailers WHERE assistant = :assistant AND verifiedVisit = 1 AND checkInDate = :date")
    suspend fun getTodayVerifiedCount(assistant: String, date: String): Int
}
