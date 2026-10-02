// Scratch test for speed policy & auto-capture logic
class LocalStorageMock {
  constructor() { this.store = {}; }
  getItem(key) { return this.store[key] || null; }
  setItem(key, value) { this.store[key] = String(value); }
  removeItem(key) { delete this.store[key]; }
}
global.localStorage = new LocalStorageMock();

// Test the core logic
const DEFAULT_SPEED_POLICY = {
  bikeMaxSpeedKmH: 60,
  carMaxSpeedKmH: 80,
  enabled: true
};

function testSpeedBreachRule(speedKmH, vehicleMode, thresholdKmH) {
  // STRICT RULE: ONLY log if speed > threshold
  if (speedKmH <= thresholdKmH) {
    return null; // Not captured!
  }
  const excess = speedKmH - thresholdKmH;
  return {
    speedKmH,
    thresholdKmH,
    excessKmH: excess,
    vehicleMode,
    captured: true
  };
}

console.log('Testing Bike at 55 km/h (Limit 60):', testSpeedBreachRule(55, 'Bike', 60)); // Expected: null
console.log('Testing Bike at 74 km/h (Limit 60):', testSpeedBreachRule(74, 'Bike', 60)); // Expected: captured, excess 14
console.log('Testing Car at 78 km/h (Limit 80):', testSpeedBreachRule(78, 'Car', 80));  // Expected: null
console.log('Testing Car at 98 km/h (Limit 80):', testSpeedBreachRule(98, 'Car', 80));  // Expected: captured, excess 18
