package com.ceres.agtech.tracker.domain

import com.ceres.agtech.tracker.data.local.entities.RetailerEntity
import kotlin.math.*

object TspRouteOptimizer {

    data class GeoPoint(val id: String, val name: String, val lat: Double, val lng: Double)

    /**
     * Haversine formula to compute great-circle distance between two GPS coordinates in kilometers.
     */
    fun calculateDistanceKm(lat1: Double, lon1: Double, lat2: Double, lon2: Double): Double {
        val r = 6371.0 // Earth radius in km
        val dLat = Math.toRadians(lat2 - lat1)
        val dLon = Math.toRadians(lon2 - lon1)
        val a = sin(dLat / 2).pow(2.0) +
                cos(Math.toRadians(lat1)) * cos(Math.toRadians(lat2)) *
                sin(dLon / 2).pow(2.0)
        val c = 2 * atan2(sqrt(a), sqrt(1 - a))
        return r * c
    }

    /**
     * Solves TSP using Nearest-Neighbor heuristic followed by 2-Opt iterative improvement.
     * Takes HQ as the depot (start and end point) and returns ordered list of retailer stops.
     */
    fun optimizeRoute(
        hqPoint: GeoPoint,
        retailers: List<RetailerEntity>
    ): List<RetailerEntity> {
        val validRetailers = retailers.filter { it.lat != null && it.lng != null }
        if (validRetailers.size <= 2) return validRetailers

        // Build list of points with HQ at index 0
        val points = mutableListOf(hqPoint).apply {
            addAll(validRetailers.map { GeoPoint(it.id, it.retailer, it.lat!!, it.lng!!) })
        }

        val n = points.size
        val visited = BooleanArray(n) { false }
        val tour = IntArray(n)

        // Step 1: Nearest Neighbor from HQ (index 0)
        tour[0] = 0
        visited[0] = true

        for (step in 1 until n) {
            val curr = tour[step - 1]
            var bestNext = -1
            var bestDist = Double.MAX_VALUE

            for (candidate in 1 until n) {
                if (!visited[candidate]) {
                    val dist = calculateDistanceKm(
                        points[curr].lat, points[curr].lng,
                        points[candidate].lat, points[candidate].lng
                    )
                    if (dist < bestDist) {
                        bestDist = dist
                        bestNext = candidate
                    }
                }
            }

            if (bestNext != -1) {
                tour[step] = bestNext
                visited[bestNext] = true
            }
        }

        // Step 2: 2-Opt local search improvement
        var improved = true
        var iterations = 0
        while (improved && iterations < 50) {
            improved = false
            iterations++
            for (i in 1 until n - 1) {
                for (j in i + 1 until n) {
                    val p1 = points[tour[i - 1]]
                    val p2 = points[tour[i]]
                    val p3 = points[tour[j]]
                    val p4 = points[if (j + 1 < n) tour[j + 1] else 0]

                    val currentDistance = calculateDistanceKm(p1.lat, p1.lng, p2.lat, p2.lng) +
                            calculateDistanceKm(p3.lat, p3.lng, p4.lat, p4.lng)

                    val newDistance = calculateDistanceKm(p1.lat, p1.lng, p3.lat, p3.lng) +
                            calculateDistanceKm(p2.lat, p2.lng, p4.lat, p4.lng)

                    if (newDistance < currentDistance - 0.001) {
                        // Reverse segment between i and j
                        var left = i
                        var right = j
                        while (left < right) {
                            val temp = tour[left]
                            tour[left] = tour[right]
                            tour[right] = temp
                            left++
                            right--
                        }
                        improved = true
                    }
                }
            }
        }

        // Map tour indices back to RetailerEntity list (ignoring HQ at index 0)
        val retailerMap = validRetailers.associateBy { it.id }
        return tour.drop(1).mapNotNull { points[it].id.let { id -> retailerMap[id] } }
    }
}
