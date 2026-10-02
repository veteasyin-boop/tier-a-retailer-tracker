package com.ceres.agtech.tracker.ui.components

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.ceres.agtech.tracker.data.local.entities.RetailerEntity
import com.ceres.agtech.tracker.ui.theme.*

@Composable
fun RetailerPassCard(
    retailer: RetailerEntity,
    isInTodayTour: Boolean,
    onToggleTour: () -> Unit,
    onLiveCheckIn: () -> Unit,
    onLogDetails: () -> Unit,
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current

    // Compute dealer 2-letter initials & deterministic gradient
    val initials = retailer.retailer.trim().split(Regex("\\s+"))
        .mapNotNull { it.firstOrNull()?.uppercase() }
        .take(2)
        .joinToString("")
        .ifEmpty { "RT" }

    val gradients = listOf(
        listOf(TrueinEmerald, TrueinEmeraldDark),
        listOf(TrueinCyan, TrueinCyanDark),
        listOf(TrueinPurple, Color(0xFF6D28D9)),
        listOf(TrueinAmber, Color(0xFFD97706)),
        listOf(TrueinPink, Color(0xFFBE185D))
    )
    val gradIndex = kotlin.math.abs(initials.hashCode()) % gradients.size
    val avatarGrad = gradients[gradIndex]

    Box(
        modifier = modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(20.dp))
            .background(Color.White)
            .border(1.dp, BorderSubtle, RoundedCornerShape(20.dp))
            .padding(16.dp)
    ) {
        Column {
            // Row 1: Dealer Avatar + Details + Action Circles
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.Top
            ) {
                Row(modifier = Modifier.weight(1f)) {
                    // Dealer Monogram Avatar
                    Box(
                        modifier = Modifier
                            .size(44.dp)
                            .clip(RoundedCornerShape(14.dp))
                            .background(Brush.linearGradient(avatarGrad)),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = initials,
                            color = Color.White,
                            fontSize = 16.sp,
                            fontWeight = FontWeight.Black
                        )
                    }

                    Spacer(modifier = Modifier.width(12.dp))

                    Column {
                        // Status & Distance Tags
                        Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            Box(
                                modifier = Modifier
                                    .clip(RoundedCornerShape(6.dp))
                                    .background(Color(0x2210B981))
                                    .padding(horizontal = 6.dp, vertical = 2.dp)
                            ) {
                                Text(
                                    text = "📍 In ${retailer.block}",
                                    color = TrueinEmeraldDark,
                                    fontSize = 9.5.sp,
                                    fontWeight = FontWeight.Bold
                                )
                            }

                            Box(
                                modifier = Modifier
                                    .clip(RoundedCornerShape(6.dp))
                                    .background(Color(0xFFF1F5F9))
                                    .padding(horizontal = 6.dp, vertical = 2.dp)
                            ) {
                                Text(
                                    text = retailer.status,
                                    color = InkSecondary,
                                    fontSize = 9.5.sp,
                                    fontWeight = FontWeight.Bold
                                )
                            }
                        }

                        Spacer(modifier = Modifier.height(3.dp))

                        Text(
                            text = retailer.retailer,
                            color = InkPrimary,
                            fontSize = 15.sp,
                            fontWeight = FontWeight.ExtraBold
                        )

                        Text(
                            text = "📍 ${retailer.block}, ${retailer.district}",
                            color = TextMuted,
                            fontSize = 11.5.sp
                        )
                    }
                }

                // Quick Action Circles (Call, WhatsApp, Maps, Tour Star)
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    retailer.mobile?.let { phone ->
                        ActionCircle(icon = "📞") {
                            val intent = Intent(Intent.ACTION_DIAL, Uri.parse("tel:$phone"))
                            context.startActivity(intent)
                        }
                        ActionCircle(icon = "💬") {
                            val intent = Intent(Intent.ACTION_VIEW, Uri.parse("https://wa.me/91$phone"))
                            context.startActivity(intent)
                        }
                    }

                    ActionCircle(icon = "🧭") {
                        val query = Uri.encode("${retailer.retailer} ${retailer.block} ${retailer.district} Bihar")
                        val intent = Intent(Intent.ACTION_VIEW, Uri.parse("https://www.google.com/maps/search/?api=1&query=$query"))
                        context.startActivity(intent)
                    }

                    ActionCircle(
                        icon = if (isInTodayTour) "★" else "☆",
                        bgColor = if (isInTodayTour) Color(0x33F59E0B) else Color(0xFFF8FAFC),
                        onClick = onToggleTour
                    )
                }
            }

            // Key Metrics Pills (Orders booked, follow-up date)
            Spacer(modifier = Modifier.height(10.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                if (retailer.totalOrdersValue > 0) {
                    Box(
                        modifier = Modifier
                            .clip(RoundedCornerShape(8.dp))
                            .background(Color(0x2210B981))
                            .padding(horizontal = 8.dp, vertical = 3.dp)
                    ) {
                        Text(
                            text = "📦 ₹${retailer.totalOrdersValue.toInt()} Booked",
                            color = TrueinEmeraldDark,
                            fontSize = 10.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }

                retailer.followUpDate?.let { date ->
                    Box(
                        modifier = Modifier
                            .clip(RoundedCornerShape(8.dp))
                            .background(Color(0x22EF4444))
                            .padding(horizontal = 8.dp, vertical = 3.dp)
                    ) {
                        Text(
                            text = "📅 Due: $date",
                            color = TrueinRoseDark,
                            fontSize = 10.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }
            }

            // Notes Callout
            retailer.notes?.let { note ->
                Spacer(modifier = Modifier.height(8.dp))
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(8.dp))
                        .background(Color(0xFFF8FAFC))
                        .border(1.dp, BorderSubtle, RoundedCornerShape(8.dp))
                        .padding(8.dp)
                ) {
                    Text(
                        text = "💬 \"$note\"",
                        color = InkSecondary,
                        fontSize = 11.5.sp
                    )
                }
            }

            // GPS Check-In Status Bar
            Spacer(modifier = Modifier.height(10.dp))
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(8.dp))
                    .background(if (retailer.verifiedVisit) Color(0x2210B981) else Color(0xFFF8FAFC))
                    .padding(horizontal = 10.dp, vertical = 6.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = if (retailer.verifiedVisit) "✅ GPS Verified Counter (${retailer.checkInTime})" else "⚠️ Check-In Pending (In-person GPS required)",
                    color = if (retailer.verifiedVisit) TrueinEmeraldDark else TextMuted,
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold
                )
            }

            // Action Buttons Strip
            Spacer(modifier = Modifier.height(10.dp))
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Button(
                    onClick = onLiveCheckIn,
                    modifier = Modifier.weight(1f),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = if (retailer.verifiedVisit) TrueinSurfaceCard else TrueinEmeraldDark
                    ),
                    shape = RoundedCornerShape(12.dp)
                ) {
                    Text(
                        text = if (retailer.verifiedVisit) "🔄 Re-Check In" else "📍 Live GPS Check-In",
                        fontSize = 11.5.sp,
                        fontWeight = FontWeight.Bold
                    )
                }

                OutlinedButton(
                    onClick = onLogDetails,
                    modifier = Modifier.weight(1f),
                    shape = RoundedCornerShape(12.dp)
                ) {
                    Text(
                        text = "✏️ Log Details →",
                        color = InkPrimary,
                        fontSize = 11.5.sp,
                        fontWeight = FontWeight.Bold
                    )
                }
            }
        }
    }
}

@Composable
private fun ActionCircle(
    icon: String,
    bgColor: Color = Color(0xFFF1F5F9),
    onClick: () -> Unit
) {
    Box(
        modifier = Modifier
            .size(34.dp)
            .clip(CircleShape)
            .background(bgColor)
            .border(1.dp, BorderSubtle, CircleShape)
            .clickable { onClick() },
        contentAlignment = Alignment.Center
    ) {
        Text(text = icon, fontSize = 14.sp)
    }
}
