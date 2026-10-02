const storageMap = new Map();
global.localStorage = {
  getItem: (k) => storageMap.get(k) || null,
  setItem: (k, v) => storageMap.set(k, String(v)),
  removeItem: (k) => storageMap.delete(k),
  clear: () => storageMap.clear()
};
global.sessionStorage = {
  getItem: (k) => storageMap.get(k) || null,
  setItem: (k, v) => storageMap.set(k, String(v)),
  removeItem: (k) => storageMap.delete(k),
  clear: () => storageMap.clear()
};
global.window = {
  dispatchEvent: () => {}
};
global.CustomEvent = class CustomEvent {};

const { storage } = await import('../src/services/storage.js');

console.log('--- 1. Testing Default Policy Config ---');
const defaultPolicy = storage.getTadaPolicyConfig();
console.log('Default Bike Rate:', defaultPolicy.bikeFuelRatePerKm);
console.log('Default Car Rate:', defaultPolicy.carFuelRatePerKm);
console.log('Default Full DA:', defaultPolicy.daFullDayAmount);
console.log('Default Night Stay Allowance:', defaultPolicy.outstationNightAllowance);
console.log('Assistant 3 Vehicle Mode:', defaultPolicy.assistantVehicleModes['Assistant 3 (East Patna)']);
console.log('Assistant 1 Vehicle Mode:', defaultPolicy.assistantVehicleModes['Assistant 1 (West Patna)']);

if (defaultPolicy.bikeFuelRatePerKm !== 4.50 || defaultPolicy.carFuelRatePerKm !== 9.50) {
  throw new Error('Default policy rates mismatch!');
}

console.log('--- 2. Testing Policy Update ---');
const updatedPolicy = {
  ...defaultPolicy,
  bikeFuelRatePerKm: 5.00,
  carFuelRatePerKm: 11.00,
  outstationNightAllowance: 900,
  daFullDayAmount: 300,
  assistantVehicleModes: {
    ...defaultPolicy.assistantVehicleModes,
    'Assistant 1 (West Patna)': 'Car' // Switch Assistant 1 to Car
  }
};
storage.saveTadaPolicyConfig(updatedPolicy);

const reloaded = storage.getTadaPolicyConfig();
console.log('Reloaded Bike Rate:', reloaded.bikeFuelRatePerKm);
console.log('Reloaded Car Rate:', reloaded.carFuelRatePerKm);
console.log('Reloaded Night Stay:', reloaded.outstationNightAllowance);
console.log('Reloaded Asst 1 Mode:', storage.getAssistantVehicleMode('Assistant 1 (West Patna)'));

if (reloaded.bikeFuelRatePerKm !== 5.00 || reloaded.carFuelRatePerKm !== 11.00 || storage.getAssistantVehicleMode('Assistant 1 (West Patna)') !== 'Car') {
  throw new Error('Policy update verification failed!');
}

console.log('--- 3. Testing TADA Preview Calculations with Vehicle Modes ---');
// Preview for Assistant 1 on a date with Car mode (default is now Car)
const previewCar = storage.calculateTadaPreview('Assistant 1 (West Patna)', '2026-09-29');
console.log('Assistant 1 Car Preview:', {
  vehicleMode: previewCar.vehicleMode,
  fuelRate: previewCar.fuelRate,
  gpsKm: previewCar.gpsVerifiedKm,
  fuelAmount: previewCar.fuelAmount,
  daAmount: previewCar.daAmount
});

// Override to Bike mode
const previewBike = storage.calculateTadaPreview('Assistant 1 (West Patna)', '2026-09-29', 'Bike');
console.log('Assistant 1 Bike Override Preview:', {
  vehicleMode: previewBike.vehicleMode,
  fuelRate: previewBike.fuelRate,
  gpsKm: previewBike.gpsVerifiedKm,
  fuelAmount: previewBike.fuelAmount
});

if (previewCar.fuelRate !== 11.00 || previewBike.fuelRate !== 5.00) {
  throw new Error('Vehicle mode rates mismatch in calculateTadaPreview!');
}

console.log('--- 4. Testing Claim Creation with Attached Bills ---');
const testClaim = {
  id: 'tada_test_001',
  assistant: 'Assistant 1 (West Patna)',
  hq: 'Bihta',
  district: 'Patna',
  date: '2026-09-29',
  vehicleMode: 'Car',
  verifiedStops: 5,
  gpsVerifiedKm: 40.0,
  claimedKm: 40.0,
  fuelRate: 11.00,
  fuelAmount: 440.0,
  daAmount: 300,
  outstationAmount: 900,
  incidentalAmount: 150,
  incidentalNotes: 'Farmer meeting refreshments',
  totalClaimAmount: 1790.0,
  approvedAmount: 1790.0,
  status: 'Pending Approval',
  auditFlags: ['🟢 Test GPS Approved', '🚗 Transit Mode: Car (₹11.00/km)'],
  attachedBills: [
    {
      id: 'b1',
      name: 'Fuel_Petrol_Receipt.jpg',
      category: 'Fuel Refill',
      amount: 440,
      notes: 'Indian Oil petrol refill memo',
      dataUrl: 'data:image/svg+xml;charset=utf-8,%3Csvg%3E%3C/svg%3E',
      uploadedAt: new Date().toISOString()
    },
    {
      id: 'b2',
      name: 'Night_Stay_Lodge.png',
      category: 'Hotel/Night Stay',
      amount: 900,
      notes: 'Outstation stay at Sasaram',
      dataUrl: 'data:image/svg+xml;charset=utf-8,%3Csvg%3E%3C/svg%3E',
      uploadedAt: new Date().toISOString()
    }
  ],
  managerNotes: '',
  approvedBy: '',
  approvedAt: null,
  createdAt: new Date().toISOString()
};

storage.saveTadaClaim(testClaim);
const fetchedClaim = storage.getTadaClaim('tada_test_001');
console.log('Fetched Claim Bills Count:', fetchedClaim.attachedBills.length);
console.log('Fetched Claim Vehicle Mode:', fetchedClaim.vehicleMode);

if (fetchedClaim.attachedBills.length !== 2 || fetchedClaim.vehicleMode !== 'Car') {
  throw new Error('Claim persistence with attached bills and vehicle mode failed!');
}

console.log('--- 5. Restoring Baseline Policy ---');
storage.saveTadaPolicyConfig({
  bikeFuelRatePerKm: 4.50,
  carFuelRatePerKm: 9.50,
  daFullDayAmount: 250,
  daHalfDayAmount: 150,
  minVisitsForFullDa: 4,
  outstationNightAllowance: 800,
  maxIncidentalWithoutReceipt: 150,
  assistantVehicleModes: {
    "Assistant 1 (West Patna)": "Bike",
    "Assistant 2 (Central/South Patna)": "Bike",
    "Assistant 3 (East Patna)": "Car",
    "Assistant 4 (West Vaishali)": "Bike",
    "Assistant 5 (East Vaishali)": "Bike",
    "Assistant 6 (Rohtas)": "Car",
    "Assistant 7 (Kaimur)": "Bike",
    "Assistant 8 (Bhojpur & Buxar)": "Bike"
  }
});

console.log('✅ ALL TADA & VEHICLE POLICY TESTS PASSED WITH 100% SUCCESS!');
