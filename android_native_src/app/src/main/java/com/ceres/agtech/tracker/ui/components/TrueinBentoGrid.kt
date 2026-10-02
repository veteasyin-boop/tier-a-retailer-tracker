package com.ceres.agtech.tracker.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.ceres.agtech.tracker.ui.theme.*

@Composable
fun TrueinBentoGrid(
    pjpStopsCount: Int,
    countersCount: Int,
    followUpsCount: Int,
    leadsCount: Int,
    onBeatClick: () -> Unit,
    onCountersClick: () -> Unit,
    onFollowUpsClick: () -> Unit,
    onFarmerCrmClick: () -> Unit,
    onOutreachClick: () -> Unit,
    onTadaClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        // Row 1: Smart Beat + Counter Directory
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            BentoCard(
                icon = "🗺️",
                title = "Smart Beat (TSP)",
                subtitle = "GPS Shortest Route",
                badge = "$pjpStopsCount Stops",
                badgeBg = Color(0x2210B981),
                badgeColor = TrueinEmerald,
                iconGradient = listOf(TrueinEmerald, TrueinEmeraldDark),
                onClick = onBeatClick,
                modifier = Modifier.weight(1f)
            )

            BentoCard(
                icon = "🏬",
                title = "Counter Directory",
                subtitle = "Station Retailers",
                badge = "$countersCount Active",
                badgeBg = Color(0x2238BDF8),
                badgeColor = TrueinCyan,
                iconGradient = listOf(TrueinCyan, TrueinCyanDark),
                onClick = onCountersClick,
                modifier = Modifier.weight(1f)
            )
        }

        // Row 2: Due Follow-ups + Farmer CRM
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            BentoCard(
                icon = "📅",
                title = "Due Follow-ups",
                subtitle = "Pipeline Promises",
                badge = "$followUpsCount Due",
                badgeBg = if (followUpsCount > 0) Color(0x33EF4444) else Color(0x2294A3B8),
                badgeColor = if (followUpsCount > 0) TrueinRose else TextMuted,
                iconGradient = listOf(TrueinAmber, Color(0xFFD97706)),
                onClick = onFollowUpsClick,
                modifier = Modifier.weight(1f)
            )

            BentoCard(
                icon = "🌾",
                title = "Farmer CRM",
                subtitle = "Demand Generation",
                badge = "$leadsCount Leads",
                badgeBg = Color(0x228B5CF6),
                badgeColor = TrueinPurple,
                iconGradient = listOf(TrueinPurple, Color(0xFF6D28D9)),
                onClick = onFarmerCrmClick,
                modifier = Modifier.weight(1f)
            )
        }

        // Row 3: Meetings & Demos + TA/DA Mileage
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            BentoCard(
                icon = "👥",
                title = "Meetings & Demos",
                subtitle = "Field Crop Trials",
                badge = "Outreach",
                badgeBg = Color(0x22EC4899),
                badgeColor = TrueinPink,
                iconGradient = listOf(TrueinPink, Color(0xFFBE185D)),
                onClick = onOutreachClick,
                modifier = Modifier.weight(1f)
            )

            BentoCard(
                icon = "💰",
                title = "TA/DA Mileage",
                subtitle = "GPS Km & Claims",
                badge = "₹ Claim",
                badgeBg = Color(0x2210B981),
                badgeColor = TrueinEmerald,
                iconGradient = listOf(Color(0xFF34D399), TrueinEmeraldDark),
                onClick = onTadaClick,
                modifier = Modifier.weight(1f)
            )
        }
    }
}

@Composable
private fun BentoCard(
    icon: String,
    title: String,
    subtitle: String,
    badge: String,
    badgeBg: Color,
    badgeColor: Color,
    iconGradient: List<Color>,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Box(
        modifier = modifier
            .clip(RoundedCornerShape(18.dp))
            .background(Color.White)
            .border(1.dp, BorderSubtle, RoundedCornerShape(18.dp))
            .clickable { onClick() }
            .padding(14.dp)
    ) {
        Column {
            // Icon + Badge Header
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.Top
            ) {
                Box(
                    modifier = Modifier
                        .size(40.dp)
                        .clip(RoundedCornerShape(12.dp))
                        .background(Brush.linearGradient(iconGradient)),
                    contentAlignment = Alignment.Center
                ) {
                    Text(text = icon, fontSize = 20.sp)
                }

                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(99.dp))
                        .background(badgeBg)
                        .padding(horizontal = 7.dp, vertical = 2.5.dp)
                ) {
                    Text(text = badge, color = badgeColor, fontSize = 9.sp, fontWeight = FontWeight.Black)
                }
            }

            Spacer(modifier = Modifier.height(10.dp))

            Text(
                text = title,
                color = InkPrimary,
                fontSize = 13.5.sp,
                fontWeight = FontWeight.ExtraBold,
                lineHeight = 16.sp
            )

            Text(
                text = subtitle,
                color = TextMuted,
                fontSize = 11.sp,
                fontWeight = FontWeight.Medium
            )
        }
    }
}
