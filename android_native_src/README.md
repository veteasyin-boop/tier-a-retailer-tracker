# Tier A Retailer Tracker - Native Android App (Kotlin & Jetpack Compose)

This is the pure native Android application for the **Tier A Retailer & Field Workforce Tracker**, built with **Kotlin**, **Jetpack Compose (Material3)**, **Room SQLite Database**, and enterprise-grade hardware integrations inspired by the **Truein App**.

---

## 🏗️ Architecture & Tech Stack

- **UI Framework**: 100% Jetpack Compose (Material 3) with custom Truein luxury dark console design system.
- **Local Persistence**: Android Room SQLite with reactive Kotlin `Flow` streams and pre-seeded Bihar territory data.
- **Hardware Telemetry**:
  - `FusedLocationProviderClient` with `LocationTrackingService` running as an Android `ForegroundService`.
  - Anti-Fraud Geofencing: Detects and rejects mock location providers (`Location.isMock` / `Location.isFromMockProvider`).
  - Speed Telemetry: Continuous velocity computation with in-app safety breach warnings when exceeding thresholds (>70 km/h car / >50 km/h bike).
  - TA/DA Mileage Accumulator: Background distance logging with `WakeLock` to ensure 100% accurate mileage even when the phone is locked in the rep's pocket.
- **Domain Algorithms**:
  - Traveling Salesperson Problem (TSP) 2-Opt route optimizer for daily Journey Plans (PJP).

---

## 📱 How to Open & Run in Android Studio

1. Launch **Android Studio** (Hedgehog 2023.1.1 or Ladybug / Iguana / Jellyfish).
2. Select **Open** and choose the `android_native_src` folder:
   ```
   c:\Users\Ankit\Downloads\files\android_native_src
   ```
3. Allow Gradle Sync to finish downloading dependencies.
4. Connect an Android phone (Android 8.0+ / API 26+) with USB Debugging enabled, or launch an Android Emulator.
5. Click **Run 'app'** (`Shift + F10`) to compile and launch.

---

## 📦 Building via Command Line

To assemble the debug APK from terminal:
```bash
cd android_native_src
./gradlew assembleDebug
```
The output APK will be generated at:
```
android_native_src/app/build/outputs/apk/debug/app-debug.apk
```
