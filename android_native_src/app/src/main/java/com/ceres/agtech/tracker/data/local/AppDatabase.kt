package com.ceres.agtech.tracker.data.local

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import androidx.sqlite.db.SupportSQLiteDatabase
import com.ceres.agtech.tracker.data.local.entities.*
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

@Database(
    entities = [
        RetailerEntity::class,
        AttendanceEntity::class,
        SalesOrderEntity::class,
        FarmerLeadEntity::class,
        TadaClaimEntity::class,
        SpeedBreachEntity::class
    ],
    version = 1,
    exportSchema = false
)
abstract class AppDatabase : RoomDatabase() {

    abstract fun retailerDao(): RetailerDao
    abstract fun attendanceDao(): AttendanceDao
    abstract fun salesOrderDao(): SalesOrderDao
    abstract fun farmerLeadDao(): FarmerLeadDao
    abstract fun tadaDao(): TadaDao
    abstract fun speedBreachDao(): SpeedBreachDao

    companion object {
        @Volatile
        private var INSTANCE: AppDatabase? = null

        fun getInstance(context: Context): AppDatabase {
            return INSTANCE ?: synchronized(this) {
                val instance = Room.databaseBuilder(
                    context.applicationContext,
                    AppDatabase::class.java,
                    "tier_a_retailer_tracker.db"
                )
                .addCallback(DatabaseCallback())
                .fallbackToDestructiveMigration()
                .build()
                INSTANCE = instance
                instance
            }
        }

        private class DatabaseCallback : RoomDatabase.Callback() {
            override fun onCreate(db: SupportSQLiteDatabase) {
                super.onCreate(db)
                INSTANCE?.let { database ->
                    CoroutineScope(Dispatchers.IO).launch {
                        populateInitialRetailers(database.retailerDao())
                    }
                }
            }

            private suspend fun populateInitialRetailers(retailerDao: RetailerDao) {
                val sampleRetailers = listOf(
                    RetailerEntity(
                        id = "rt_001",
                        retailer = "Kisan Krishi Seva Kendra",
                        mobile = "9876543210",
                        block = "Bihta",
                        district = "Patna",
                        lat = 25.5642,
                        lng = 84.8683,
                        potentialFor = "Mustard & Wheat Seed",
                        potentialSell = "75000",
                        status = "Pending",
                        lastVisitDate = "2026-09-28",
                        followUpDate = "2026-10-04",
                        totalOrdersValue = 35000.0,
                        notes = "Requested 50 bags hybrid mustard seed delivery before Diwali sowing.",
                        assistant = "Om Prakash"
                    ),
                    RetailerEntity(
                        id = "rt_002",
                        retailer = "Maa Tara Khad Beej Bhandar",
                        mobile = "9123456780",
                        block = "Danapur",
                        district = "Patna",
                        lat = 25.6295,
                        lng = 85.0442,
                        potentialFor = "Bio-fertilizers & Fungicides",
                        potentialSell = "50000",
                        status = "Pending",
                        lastVisitDate = "2026-09-25",
                        followUpDate = "2026-10-02",
                        totalOrdersValue = 48000.0,
                        notes = "Interested in zinc sulfate liquidation scheme. Check payment status.",
                        assistant = "Om Prakash"
                    ),
                    RetailerEntity(
                        id = "rt_003",
                        retailer = "Shree Ram Krishi Kendra",
                        mobile = "9988776655",
                        block = "Bikram",
                        district = "Patna",
                        lat = 25.4312,
                        lng = 84.8451,
                        potentialFor = "Paddy & Vegetable Pesticides",
                        potentialSell = "90000",
                        status = "Pending",
                        lastVisitDate = null,
                        followUpDate = null,
                        totalOrdersValue = 0.0,
                        notes = "Counter requires physical verification and owner phone interview.",
                        assistant = "Om Prakash"
                    ),
                    RetailerEntity(
                        id = "rt_004",
                        retailer = "Agritech Bio-Inputs Depot",
                        mobile = "9771122334",
                        block = "Phulwari Sharif",
                        district = "Patna",
                        lat = 25.5781,
                        lng = 85.0762,
                        potentialFor = "Soil Conditioners & Micronutrients",
                        potentialSell = "120000",
                        status = "Pending",
                        lastVisitDate = "2026-09-30",
                        followUpDate = "2026-10-05",
                        totalOrdersValue = 72000.0,
                        notes = "High-tier dealer with strong farmer base across 4 panchayats.",
                        assistant = "Om Prakash"
                    )
                )
                retailerDao.insertAll(sampleRetailers)
            }
        }
    }
}
