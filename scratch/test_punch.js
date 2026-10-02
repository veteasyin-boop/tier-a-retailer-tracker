global.localStorage = {
  data: {},
  getItem(k) { return this.data[k] || null; },
  setItem(k, v) { this.data[k] = String(v); },
  removeItem(k) { delete this.data[k]; }
};

global.sessionStorage = {
  data: {},
  getItem(k) { return this.data[k] || null; },
  setItem(k, v) { this.data[k] = String(v); },
  removeItem(k) { delete this.data[k]; }
};

global.window = {
  dispatchEvent() {}
};
global.CustomEvent = class CustomEvent { constructor(type, detail) { this.type = type; this.detail = detail; } };

async function run() {
  const { storage } = await import('../src/services/storage.js');

  console.log('Testing Punch In / Punch Out...');

  const rep = 'Assistant 1 (West Patna)';
  console.log('Current IST date:', storage.getISTDateStr());
  const initialToday = storage.getTodayAttendance(rep);
  console.log('Initial today attendance record:');
  console.log(JSON.stringify(initialToday, null, 2));

  try {
    const punchInRes = storage.recordPunchIn(rep, { workMode: 'Field Operations', notes: 'Test punch in' });
    console.log('recordPunchIn result: punchIn=', punchInRes.punchIn, 'punchOut=', punchInRes.punchOut);
  } catch (e) {
    console.error('recordPunchIn ERROR:', e);
  }

  const afterInToday = storage.getTodayAttendance(rep);
  console.log('After punch in record: punchIn=', afterInToday.punchIn, 'punchOut=', afterInToday.punchOut);

  try {
    const punchOutRes = storage.recordPunchOut(rep, { notes: 'Test punch out' });
    console.log('recordPunchOut result: punchIn=', punchOutRes.punchIn, 'punchOut=', punchOutRes.punchOut);
  } catch (e) {
    console.error('recordPunchOut ERROR:', e);
  }

  const afterOutToday = storage.getTodayAttendance(rep);
  console.log('After punch out record: punchIn=', afterOutToday.punchIn, 'punchOut=', afterOutToday.punchOut);
}

run();
