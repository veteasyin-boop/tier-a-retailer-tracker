package com.ceres.agtech.tracker.data.local.entities

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "sales_orders")
data class SalesOrderEntity(
    @PrimaryKey
    val id: String,
    val retailerId: String,
    val assistant: String,
    val orderDate: String,
    val orderValue: Double,
    val liquidationStatus: String = "Normal", // Normal, Critical, High
    val paymentStatus: String = "Pending", // Paid, Advance, Credit
    val expectedDeliveryDate: String? = null,
    val notes: String? = null,
    val syncStatus: String = "PENDING_SYNC"
)
