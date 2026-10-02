package com.ceres.agtech.tracker.data.repository

import com.ceres.agtech.tracker.data.local.AppDatabase
import com.ceres.agtech.tracker.data.local.entities.*
import kotlinx.coroutines.flow.Flow
import java.text.SimpleDateFormat
import java.util.*

class TrackerRepository(private val db: AppDatabase) {

    fun getRetailers(assistant: String): Flow<List<RetailerEntity>> =
        db.retailerDao().getRetailersByAssistant(assistant)

    suspend fun recordCheckIn(
        retailerId: String,
        lat: Double,
        lng: Double,
        distKm: Double
    ) {
        val now = Calendar.getInstance()
        val dateStr = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).format(now.time)
        val timeStr = SimpleDateFormat("hh:mm a", Locale.getDefault()).format(now.time)
        db.retailerDao().recordCheckIn(retailerId, dateStr, timeStr, lat, lng, distKm)
    }

    suspend fun updateFollowUpDate(retailerId: String, followUpDate: String) {
        db.retailerDao().updateFollowUpDate(retailerId, followUpDate)
    }

    fun getTodayAttendance(assistant: String): Flow<AttendanceEntity?> {
        val todayStr = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).format(Date())
        return db.attendanceDao().getTodayAttendance(assistant, todayStr)
    }

    suspend fun recordPunchIn(
        assistant: String,
        lat: Double,
        lng: Double,
        photoUri: String?,
        address: String?
    ) {
        val todayStr = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).format(Date())
        val timeStr = SimpleDateFormat("hh:mm a", Locale.getDefault()).format(Date())
        val record = AttendanceEntity(
            id = "att_${assistant.replace(" ", "_")}_$todayStr",
            assistant = assistant,
            date = todayStr,
            punchInTime = timeStr,
            punchOutTime = null,
            punchInLat = lat,
            punchInLng = lng,
            punchOutLat = null,
            punchOutLng = null,
            punchInPhotoUri = photoUri,
            punchOutPhotoUri = null,
            punchInAddress = address ?: "Patna Field HQ",
            punchOutAddress = null
        )
        db.attendanceDao().insertOrUpdate(record)
    }

    suspend fun recordPunchOut(
        assistant: String,
        lat: Double,
        lng: Double,
        photoUri: String?
    ) {
        val todayStr = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).format(Date())
        val timeStr = SimpleDateFormat("hh:mm a", Locale.getDefault()).format(Date())
        val id = "att_${assistant.replace(" ", "_")}_$todayStr"
        db.attendanceDao().recordPunchOut(id, timeStr, lat, lng, photoUri)
    }

    fun getOrders(assistant: String): Flow<List<SalesOrderEntity>> =
        db.salesOrderDao().getOrdersByAssistant(assistant)

    suspend fun bookOrder(
        retailerId: String,
        assistant: String,
        orderValue: Double,
        liquidationStatus: String,
        paymentStatus: String,
        notes: String?
    ) {
        val todayStr = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).format(Date())
        val order = SalesOrderEntity(
            id = "ord_${UUID.randomUUID().toString().substring(0, 8)}",
            retailerId = retailerId,
            assistant = assistant,
            orderDate = todayStr,
            orderValue = orderValue,
            liquidationStatus = liquidationStatus,
            paymentStatus = paymentStatus,
            notes = notes
        )
        db.salesOrderDao().insert(order)
        db.retailerDao().incrementOrderValue(retailerId, orderValue)
    }

    fun getFarmerLeads(assistant: String): Flow<List<FarmerLeadEntity>> =
        db.farmerLeadDao().getLeadsByAssistant(assistant)

    suspend fun addFarmerLead(lead: FarmerLeadEntity) {
        db.farmerLeadDao().insert(lead)
    }

    suspend fun advanceLeadStage(leadId: String, nextStage: String) {
        db.farmerLeadDao().updateStage(leadId, nextStage)
    }

    fun getPendingSpeedBreaches(assistant: String): Flow<List<SpeedBreachEntity>> =
        db.speedBreachDao().getPendingBreaches(assistant)

    suspend fun acknowledgeSpeedBreach(breachId: String) {
        db.speedBreachDao().acknowledgeBreach(breachId, System.currentTimeMillis())
    }

    fun getTadaClaims(assistant: String): Flow<List<TadaClaimEntity>> =
        db.tadaDao().getClaimsByAssistant(assistant)

    suspend fun submitTadaClaim(claim: TadaClaimEntity) {
        db.tadaDao().insert(claim)
    }
}
