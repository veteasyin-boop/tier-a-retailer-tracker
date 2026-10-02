package com.ceres.agtech.tracker.ui.components

import androidx.compose.animation.core.*
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.ceres.agtech.tracker.data.local.entities.AttendanceEntity
import com.ceres.agtech.tracker.ui.theme.*
import java.text.SimpleDateFormat
import java.util.*

@Composable
fun TrueinHeroConsole(
    repName: String,
    hq: String,
    district: String,
    totalCounters: Int,
    attendance: AttendanceEntity?,
    kpiScore: Int,
    verifiedStops: Int,
    totalStops: Int,
    totalBookedValue: Double,
    leadsCount: Int,
    followUpsCount: Int,
    onPunchClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    val isPunchedIn = attendance?.punchInTime != null && attendance.punchOutTime == null
    val isShiftEnded = attendance?.punchOutTime != null

    // Live clock ticker
    var currentTimeStr by remember { mutableStateOf("") }
    var currentDateStr by remember { mutableStateOf("") }
    LaunchedEffect(Unit) {
        while (true) {
            val now = Calendar.getInstance().time
            currentTimeStr = SimpleDateFormat("hh:mm a", Locale.getDefault()).format(now)
            currentDateStr = SimpleDateFormat("EEE, dd MMM yyyy", Locale.getDefault()).format(now)
            kotlinx.coroutines.delay(1000L)
        }
    }

    // Glow pulse animation for punch button
    val infiniteTransition = rememberInfiniteTransition(label = "punchGlow")
    val glowScale by infiniteTransition.animateFloat(
        initialValue = 1.0f,
        targetValue = 1.08f,
        animationSpec = infiniteRepeatable(
            animation = tween(1400, easing = FastOutSlowInEasing),
            repeatMode = RepeatMode.Reverse
        ),
        label = "glowScale"
    )

    Column(
        modifier = modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(24.dp))
            .background(
                brush = Brush.linearGradient(
                    colors = listOf(TrueinHeroDark, TrueinConsoleMid, Color(0xFF0F172A))
                )
            )
            .border(1.dp, Color.White.copy(alpha = 0.12f), RoundedCornerShape(24.dp))
            .padding(20.dp)
    ) {
        // 1. Profile & Live Clock Header
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                // Avatar Initials
                val initials = repName.split(" ").mapNotNull { it.firstOrNull()?.uppercase() }.take(2).joinToString("")
                Box(
                    modifier = Modifier
                        .size(48.dp)
                        .clip(RoundedCornerShape(16.dp))
                        .background(Brush.linearGradient(listOf(TrueinEmerald, TrueinEmeraldDark))),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = initials.ifEmpty { "OP" },
                        color = Color.White,
                        fontSize = 18.sp,
                        fontWeight = FontWeight.Bold
                    )
                }

                Spacer(modifier = Modifier.width(12.dp))

                Column {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(
                            text = repName,
                            color = Color.White,
                            fontSize = 17.sp,
                            fontWeight = FontWeight.ExtraBold
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        DutyStatusBadge(isPunchedIn = isPunchedIn, isShiftEnded = isShiftEnded)
                    }
                    Text(
                        text = "📍 $hq • $district • $totalCounters Counters",
                        color = TextMuted,
                        fontSize = 11.5.sp,
                        fontWeight = FontWeight.Medium
                    )
                }
            }

            // Digital Clock
            Column(horizontalAlignment = Alignment.End) {
                Text(
                    text = currentTimeStr,
                    color = Color.White,
                    fontSize = 20.sp,
                    fontWeight = FontWeight.Black
                )
                Text(
                    text = currentDateStr,
                    color = TextMuted,
                    fontSize = 10.5.sp
                )
                Text(
                    text = "🟢 GPS Locked ±12m",
                    color = TrueinCyan,
                    fontSize = 9.5.sp,
                    fontWeight = FontWeight.Bold
                )
            }
        }

        Spacer(modifier = Modifier.height(18.dp))

        // 2. Central Punch Console
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(18.dp))
                .background(Color.White.copy(alpha = 0.05f))
                .border(1.dp, Color.White.copy(alpha = 0.08f), RoundedCornerShape(18.dp))
                .padding(14.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = "SHIFT PROTOCOL (SOP)",
                    color = TextMuted,
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Bold
                )
                Text(
                    text = "09:30 AM – 06:30 PM",
                    color = TrueinCyan,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.ExtraBold
                )

                Spacer(modifier = Modifier.height(8.dp))

                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    ShiftTimeBox(label = "PUNCH IN", time = attendance?.punchInTime ?: "Pending", isEmerald = isPunchedIn)
                    ShiftTimeBox(label = "PUNCH OUT", time = attendance?.punchOutTime ?: "--:--", isEmerald = isShiftEnded)
                }
            }

            Spacer(modifier = Modifier.width(16.dp))

            // Glowing Concentric Punch Button
            Box(
                contentAlignment = Alignment.Center,
                modifier = Modifier
                    .scale(if (!isShiftEnded) glowScale else 1.0f)
                    .size(96.dp)
                    .clip(CircleShape)
                    .background(
                        when {
                            isShiftEnded -> Brush.radialGradient(listOf(Color(0xFF64748B), Color(0xFF334155)))
                            isPunchedIn -> Brush.radialGradient(listOf(TrueinRose, TrueinRoseDark))
                            else -> Brush.radialGradient(listOf(TrueinEmerald, TrueinEmeraldDark))
                        }
                    )
                    .clickable { onPunchClick() }
                    .padding(8.dp)
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(
                        text = when {
                            isShiftEnded -> "✅"
                            isPunchedIn -> "🏁"
                            else -> "👉"
                        },
                        fontSize = 20.sp
                    )
                    Text(
                        text = when {
                            isShiftEnded -> "DONE"
                            isPunchedIn -> "PUNCH OUT"
                            else -> "PUNCH IN"
                        },
                        color = Color.White,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Black
                    )
                    Text(
                        text = if (isPunchedIn) "End Shift" else "Mark Duty",
                        color = Color.White.copy(alpha = 0.85f),
                        fontSize = 8.5.sp
                    )
                }
            }
        }

        Spacer(modifier = Modifier.height(14.dp))

        // 3. Quick Performance Chips
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            MetricChip(label = "100-PT KPI", value = "$kpiScore/100", color = TrueinEmerald, modifier = Modifier.weight(1f))
            MetricChip(label = "PJP STOPS", value = "$verifiedStops/$totalStops", color = TrueinCyan, modifier = Modifier.weight(1f))
            MetricChip(label = "ORDERS", value = "₹${(totalBookedValue/1000).toInt()}k", color = TrueinAmber, modifier = Modifier.weight(1f))
            MetricChip(label = "LEADS", value = "$leadsCount", color = TrueinPurple, modifier = Modifier.weight(1f))
            MetricChip(label = "FOLLOW-UPS", value = "$followUpsCount", color = TrueinRose, modifier = Modifier.weight(1f))
        }
    }
}

@Composable
private fun DutyStatusBadge(isPunchedIn: Boolean, isShiftEnded: Boolean) {
    val (bg, color, text) = when {
        isShiftEnded -> Triple(Color(0x3394A3B8), TextMuted, "🏁 SHIFT DONE")
        isPunchedIn -> Triple(Color(0x3310B981), TrueinEmerald, "🟢 ON DUTY")
        else -> Triple(Color(0x33EF4444), TrueinRose, "🔴 OFF DUTY")
    }

    Box(
        modifier = Modifier
            .clip(RoundedCornerShape(99.dp))
            .background(bg)
            .padding(horizontal = 7.dp, vertical = 2.dp)
    ) {
        Text(text = text, color = color, fontSize = 9.sp, fontWeight = FontWeight.Black)
    }
}

@Composable
private fun ShiftTimeBox(label: String, time: String, isEmerald: Boolean) {
    Column(
        modifier = Modifier
            .clip(RoundedCornerShape(8.dp))
            .background(Color.White.copy(alpha = 0.06f))
            .padding(horizontal = 8.dp, vertical = 4.dp)
    ) {
        Text(text = label, color = TextMuted, fontSize = 8.sp, fontWeight = FontWeight.Bold)
        Text(
            text = time,
            color = if (isEmerald) TrueinEmerald else Color.White,
            fontSize = 11.5.sp,
            fontWeight = FontWeight.Bold
        )
    }
}

@Composable
private fun MetricChip(label: String, value: String, color: Color, modifier: Modifier = Modifier) {
    Column(
        modifier = modifier
            .clip(RoundedCornerShape(12.dp))
            .background(Color.White.copy(alpha = 0.06f))
            .border(1.dp, Color.White.copy(alpha = 0.08f), RoundedCornerShape(12.dp))
            .padding(vertical = 8.dp, horizontal = 4.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Text(text = label, color = TextMuted, fontSize = 8.sp, fontWeight = FontWeight.Bold)
        Spacer(modifier = Modifier.height(2.dp))
        Text(text = value, color = color, fontSize = 12.sp, fontWeight = FontWeight.Black)
    }
}
