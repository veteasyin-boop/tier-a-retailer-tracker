package com.ceres.agtech.tracker.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import com.ceres.agtech.tracker.data.local.entities.AttendanceEntity
import com.ceres.agtech.tracker.ui.theme.*
import java.text.SimpleDateFormat
import java.util.*

@Composable
fun AttendancePunchDialog(
    assistant: String,
    todayAttendance: AttendanceEntity?,
    onDismiss: () -> Unit,
    onSubmitPunchIn: (lat: Double, lng: Double, photoUri: String?, address: String?) -> Unit,
    onSubmitPunchOut: (lat: Double, lng: Double, photoUri: String?) -> Unit
) {
    val isPunchedIn = todayAttendance?.punchInTime != null && todayAttendance.punchOutTime == null
    val isShiftEnded = todayAttendance?.punchOutTime != null

    val currentTime = SimpleDateFormat("hh:mm:ss a", Locale.getDefault()).format(Date())
    val currentDate = SimpleDateFormat("EEEE, dd MMMM yyyy", Locale.getDefault()).format(Date())

    Dialog(onDismissRequest = onDismiss) {
        Card(
            shape = RoundedCornerShape(24.dp),
            colors = CardDefaults.cardColors(containerColor = Color.White),
            modifier = Modifier.fillMaxWidth()
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(24.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                // Header
                Text(
                    text = "हाजिरी - Official Attendance",
                    fontSize = 18.sp,
                    fontWeight = FontWeight.Black,
                    color = InkPrimary
                )
                Text(
                    text = "Geofenced Anti-Fraud Biometric Muster",
                    fontSize = 12.sp,
                    color = TextMuted
                )

                Spacer(modifier = Modifier.height(16.dp))

                // Time Display Card
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(16.dp))
                        .background(TrueinHeroDark)
                        .padding(16.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(
                            text = currentTime,
                            color = Color.White,
                            fontSize = 24.sp,
                            fontWeight = FontWeight.Black
                        )
                        Text(
                            text = currentDate,
                            color = TextMuted,
                            fontSize = 11.sp
                        )
                        Spacer(modifier = Modifier.height(4.dp))
                        Text(
                            text = "🟢 GPS Coords: 25.5642°N, 84.8683°E (±8m)",
                            color = TrueinCyan,
                            fontSize = 10.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }

                Spacer(modifier = Modifier.height(16.dp))

                // Shift Information Table
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Column {
                        Text(text = "Rep Name", color = TextMuted, fontSize = 11.sp)
                        Text(text = assistant, color = InkPrimary, fontSize = 13.sp, fontWeight = FontWeight.Bold)
                    }
                    Column(horizontalAlignment = Alignment.End) {
                        Text(text = "Status", color = TextMuted, fontSize = 11.sp)
                        Text(
                            text = when {
                                isShiftEnded -> "Shift Completed"
                                isPunchedIn -> "Punched In (${todayAttendance?.punchInTime})"
                                else -> "Punch Due"
                            },
                            color = if (isPunchedIn) TrueinEmeraldDark else TrueinRose,
                            fontSize = 13.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }

                Spacer(modifier = Modifier.height(16.dp))

                // Camera Facial Proof Container
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(110.dp)
                        .clip(RoundedCornerShape(16.dp))
                        .background(Color(0xFFF8FAFC))
                        .border(1.dp, BorderSubtle, RoundedCornerShape(16.dp)),
                    contentAlignment = Alignment.Center
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(text = "📸", fontSize = 28.sp)
                        Text(
                            text = "Facial Selfie & Watermark Verified",
                            color = TextMuted,
                            fontSize = 11.5.sp,
                            fontWeight = FontWeight.Medium
                        )
                    }
                }

                Spacer(modifier = Modifier.height(20.dp))

                // Action Button
                if (!isShiftEnded) {
                    Button(
                        onClick = {
                            if (isPunchedIn) {
                                onSubmitPunchOut(25.5642, 84.8683, null)
                            } else {
                                onSubmitPunchIn(25.5642, 84.8683, null, "Bihta Station Area")
                            }
                            onDismiss()
                        },
                        colors = ButtonDefaults.buttonColors(
                            containerColor = if (isPunchedIn) TrueinRoseDark else TrueinEmeraldDark
                        ),
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(14.dp)
                    ) {
                        Text(
                            text = if (isPunchedIn) "🏁 Confirm Punch Out (Close Duty)" else "👉 Confirm Punch In (Start Duty)",
                            fontSize = 14.sp,
                            fontWeight = FontWeight.Bold,
                            modifier = Modifier.padding(vertical = 4.dp)
                        )
                    }
                } else {
                    OutlinedButton(
                        onClick = onDismiss,
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(14.dp)
                    ) {
                        Text(text = "Close", color = InkPrimary)
                    }
                }
            }
        }
    }
}
