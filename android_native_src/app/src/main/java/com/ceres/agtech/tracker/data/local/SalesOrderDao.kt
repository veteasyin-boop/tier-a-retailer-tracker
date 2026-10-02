package com.ceres.agtech.tracker.data.local

import androidx.room.*
import com.ceres.agtech.tracker.data.local.entities.SalesOrderEntity
import kotlinx.coroutines.flow.Flow

@Dao
interface SalesOrderDao {
    @Query("SELECT * FROM sales_orders WHERE assistant = :assistant ORDER BY orderDate DESC")
    fun getOrdersByAssistant(assistant: String): Flow<List<SalesOrderEntity>>

    @Query("SELECT * FROM sales_orders WHERE retailerId = :retailerId ORDER BY orderDate DESC")
    fun getOrdersForRetailer(retailerId: String): Flow<List<SalesOrderEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(order: SalesOrderEntity)

    @Query("SELECT SUM(orderValue) FROM sales_orders WHERE assistant = :assistant")
    suspend fun getTotalBookedValue(assistant: String): Double?
}
