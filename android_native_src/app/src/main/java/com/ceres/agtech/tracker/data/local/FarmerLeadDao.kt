package com.ceres.agtech.tracker.data.local

import androidx.room.*
import com.ceres.agtech.tracker.data.local.entities.FarmerLeadEntity
import kotlinx.coroutines.flow.Flow

@Dao
interface FarmerLeadDao {
    @Query("SELECT * FROM farmer_leads WHERE assistant = :assistant ORDER BY id DESC")
    fun getLeadsByAssistant(assistant: String): Flow<List<FarmerLeadEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(lead: FarmerLeadEntity)

    @Query("UPDATE farmer_leads SET stage = :stage, syncStatus = 'PENDING_SYNC' WHERE id = :id")
    suspend fun updateStage(id: String, stage: String)
}
