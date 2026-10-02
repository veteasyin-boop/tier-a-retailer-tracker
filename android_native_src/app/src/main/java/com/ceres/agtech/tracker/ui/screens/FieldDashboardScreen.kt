package com.ceres.agtech.tracker.ui.screens

import android.widget.Toast
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.ceres.agtech.tracker.data.local.entities.RetailerEntity
import com.ceres.agtech.tracker.data.repository.TrackerRepository
import com.ceres.agtech.tracker.ui.components.*
import com.ceres.agtech.tracker.ui.theme.*
import kotlinx.coroutines.launch

@Composable
fun FieldDashboardScreen(
    repository: TrackerRepository,
    assistantName: String = "Om Prakash",
    hq: String = "Bihta",
    district: String = "Patna",
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current
    val coroutineScope = rememberCoroutineScope()

    val retailers by repository.getRetailers(assistantName).collectAsState(initial = emptyList())
    val todayAttendance by repository.getTodayAttendance(assistantName).collectAsState(initial = null)
    val pendingBreaches by repository.getPendingSpeedBreaches(assistantName).collectAsState(initial = emptyList())
    val orders by repository.getOrders(assistantName).collectAsState(initial = emptyList())
    val leads by repository.getFarmerLeads(assistantName).collectAsState(initial = emptyList())

    var searchQuery by remember { mutableStateOf("") }
    var showPunchDialog by remember { mutableStateOf(false) }
    var todayTourIds by remember { mutableStateOf(setOf<String>()) }

    val filteredRetailers = remember(retailers, searchQuery) {
        if (searchQuery.isBlank()) retailers
        else retailers.filter {
            it.retailer.contains(searchQuery, ignoreCase = true) ||
            it.block.contains(searchQuery, ignoreCase = true)
        }
    }

    val totalBooked = remember(orders) { orders.sumOf { it.orderValue } }
    val verifiedStopsCount = remember(retailers) { retailers.count { it.verifiedVisit } }

    Scaffold(
        modifier = modifier.fillMaxSize(),
        containerColor = Color(0xFFF1F5F9)
    ) { paddingValues ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .padding(horizontal = 16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // Top Spacing & App Branding Bar
            item {
                Spacer(modifier = Modifier.height(12.dp))
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(text = "🌾", fontSize = 20.sp)
                        Spacer(modifier = Modifier.width(6.dp))
                        Text(
                            text = "AgriField Enterprise",
                            fontSize = 15.sp,
                            fontWeight = FontWeight.Black,
                            color = InkPrimary
                        )
                    }

                    Box(
                        modifier = Modifier
                            .clip(RoundedCornerShape(99.dp))
                            .background(Color(0x2210B981))
                            .padding(horizontal = 8.dp, vertical = 4.dp)
                    ) {
                        Text(
                            text = "Bihar Grid Active",
                            color = TrueinEmeraldDark,
                            fontSize = 10.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }
            }

            // 1. Truein Hero Console
            item {
                TrueinHeroConsole(
                    repName = assistantName,
                    hq = hq,
                    district = district,
                    totalCounters = retailers.size,
                    attendance = todayAttendance,
                    kpiScore = 88,
                    verifiedStops = verifiedStopsCount,
                    totalStops = retailers.size,
                    totalBookedValue = totalBooked,
                    leadsCount = leads.size,
                    followUpsCount = retailers.count { it.followUpDate != null },
                    onPunchClick = { showPunchDialog = true }
                )
            }

            // 2. Real-Time Fleet Speed Warning Notice (if any breach detected)
            if (pendingBreaches.isNotEmpty()) {
                item {
                    val breach = pendingBreaches.first()
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(16.dp))
                            .background(Color(0x15EF4444))
                            .border(1.5.dp, TrueinRose, RoundedCornerShape(16.dp))
                            .padding(14.dp)
                    ) {
                        Column {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Text(text = "🚨", fontSize = 20.sp)
                                    Spacer(modifier = Modifier.width(6.dp))
                                    Text(
                                        text = "SPEED BREACH DETECTED",
                                        color = TrueinRoseDark,
                                        fontSize = 13.sp,
                                        fontWeight = FontWeight.Black
                                    )
                                }
                                Box(
                                    modifier = Modifier
                                        .clip(RoundedCornerShape(99.dp))
                                        .background(TrueinRose)
                                        .padding(horizontal = 6.dp, vertical = 2.dp)
                                ) {
                                    Text(text = "Action Required", color = Color.White, fontSize = 9.sp, fontWeight = FontWeight.Bold)
                                }
                            }

                            Spacer(modifier = Modifier.height(4.dp))
                            Text(
                                text = "Clocked at ${breach.speedKmH} km/h (Limit: ${breach.thresholdKmH} km/h). +${breach.excessKmH} km/h excess on ${breach.locationName ?: "transit route"}.",
                                color = InkPrimary,
                                fontSize = 11.5.sp
                            )

                            Spacer(modifier = Modifier.height(8.dp))
                            Button(
                                onClick = {
                                    coroutineScope.launch {
                                        repository.acknowledgeSpeedBreach(breach.id)
                                        Toast.makeText(context, "Safe driving commitment acknowledged", Toast.LENGTH_SHORT).show()
                                    }
                                },
                                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF047857)),
                                shape = RoundedCornerShape(10.dp)
                            ) {
                                Text(text = "✓ I Acknowledge & Comply", fontSize = 11.sp, fontWeight = FontWeight.Bold)
                            }
                        }
                    }
                }
            }

            // 3. Truein 6-Pillar Bento Grid
            item {
                TrueinBentoGrid(
                    pjpStopsCount = todayTourIds.size,
                    countersCount = retailers.size,
                    followUpsCount = retailers.count { it.followUpDate != null },
                    leadsCount = leads.size,
                    onBeatClick = { Toast.makeText(context, "Navigating to TSP Smart Beat Optimizer", Toast.LENGTH_SHORT).show() },
                    onCountersClick = { Toast.makeText(context, "Viewing Station Counter Directory", Toast.LENGTH_SHORT).show() },
                    onFollowUpsClick = { Toast.makeText(context, "Viewing Due Follow-ups", Toast.LENGTH_SHORT).show() },
                    onFarmerCrmClick = { Toast.makeText(context, "Viewing Farmer CRM Leads", Toast.LENGTH_SHORT).show() },
                    onOutreachClick = { Toast.makeText(context, "Viewing Demos & Trials", Toast.LENGTH_SHORT).show() },
                    onTadaClick = { Toast.makeText(context, "Viewing TA/DA Mileage Claims", Toast.LENGTH_SHORT).show() }
                )
            }

            // 4. Counter Directory Header & Search Bar
            item {
                Column {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = "Station Counters (${retailers.size})",
                            fontSize = 16.sp,
                            fontWeight = FontWeight.ExtraBold,
                            color = InkPrimary
                        )

                        Text(
                            text = "Bihta HQ Grid",
                            fontSize = 12.sp,
                            color = TextMuted,
                            fontWeight = FontWeight.Medium
                        )
                    }

                    Spacer(modifier = Modifier.height(8.dp))

                    OutlinedTextField(
                        value = searchQuery,
                        onValueChange = { searchQuery = it },
                        modifier = Modifier.fillMaxWidth(),
                        placeholder = { Text(text = "Search by retailer name or block…", fontSize = 13.sp) },
                        shape = RoundedCornerShape(14.dp),
                        singleLine = true,
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedContainerColor = Color.White,
                            unfocusedContainerColor = Color.White,
                            focusedBorderColor = TrueinEmerald,
                            unfocusedBorderColor = BorderSubtle
                        )
                    )
                }
            }

            // 5. Retailer Pass Cards List
            items(filteredRetailers, key = { it.id }) { retailer ->
                RetailerPassCard(
                    retailer = retailer,
                    isInTodayTour = todayTourIds.contains(retailer.id),
                    onToggleTour = {
                        todayTourIds = if (todayTourIds.contains(retailer.id)) {
                            todayTourIds - retailer.id
                        } else {
                            todayTourIds + retailer.id
                        }
                    },
                    onLiveCheckIn = {
                        coroutineScope.launch {
                            repository.recordCheckIn(
                                retailerId = retailer.id,
                                lat = 25.5642,
                                lng = 84.8683,
                                distKm = 0.05
                            )
                            Toast.makeText(context, "✅ Verified Check-In recorded at ${retailer.retailer}!", Toast.LENGTH_SHORT).show()
                        }
                    },
                    onLogDetails = {
                        Toast.makeText(context, "Opening Log Details for ${retailer.retailer}", Toast.LENGTH_SHORT).show()
                    }
                )
            }

            item {
                Spacer(modifier = Modifier.height(24.dp))
            }
        }

        // Attendance Punch Modal Dialog
        if (showPunchDialog) {
            AttendancePunchDialog(
                assistant = assistantName,
                todayAttendance = todayAttendance,
                onDismiss = { showPunchDialog = false },
                onSubmitPunchIn = { lat, lng, photo, address ->
                    coroutineScope.launch {
                        repository.recordPunchIn(assistantName, lat, lng, photo, address)
                        Toast.makeText(context, "🟢 Shift Started! GPS attendance recorded.", Toast.LENGTH_LONG).show()
                    }
                },
                onSubmitPunchOut = { lat, lng, photo ->
                    coroutineScope.launch {
                        repository.recordPunchOut(assistantName, lat, lng, photo)
                        Toast.makeText(context, "🏁 Shift Completed! Muster recorded.", Toast.LENGTH_LONG).show()
                    }
                }
            )
        }
    }
}
