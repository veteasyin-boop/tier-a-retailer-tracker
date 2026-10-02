package com.ceres.agtech.tracker.data.local

import androidx.room.*
import com.ceres.agtech.tracker.data.local.entities.SpeedBreachEntity
import com.ceres.agtech.tracker.data.local.entities.TadaClaimEntity
import kotlinx.coroutines.flow.Flow

@Dao
interface TadaDao {
    @Query("SELECT * FROM tada_claims WHERE assistant = :assistant ORDER BY date DESC")
    fun getClaimsByAssistant(assistant: String): Flow<List<TadaClaimEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(claim: TadaClaimEntity)
}

@Dao
interface SpeedBreachDao {
    @Query("SELECT * FROM speed_breaches WHERE assistant = :assistant ORDER BY timestamp DESC")
    fun getBreachesByAssistant(assistant: String): Flow<List<SpeedBreachEntity>>

    @Query("SELECT * FROM speed_breaches WHERE assistant = :assistant AND acknowledged = 0 ORDER BY timestamp DESC")
    fun getPendingBreaches(assistant: String): Flow<List<SpeedBreachEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(breach: SpeedBreachEntity)

    @Query("UPDATE speed_breaches SET acknowledged = 1, acknowledgedAt = :time WHERE id = :id")
    suspend fun acknowledgeBreach(id: String, time: Long)
}
