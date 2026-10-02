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

async function testFilterLogic() {
  const { storage } = await import('../src/services/storage.js');
  const rep = 'Assistant 1 (West Patna)';
  const today = storage.getISTDateStr();
  console.log('Today IST date:', today);

  // Clear localStorage to simulate fresh cold start
  localStorage.removeItem('tat_attendance_records_v1');

  // Cold start call with filter
  const records = storage.getAttendanceRecords({ assistant: rep, date: today });
  console.log('Cold start getAttendanceRecords length:', records.length);
  if (records.length > 0) {
    console.log('Returned record date:', records[0].date, '(Expected:', today, ')');
    console.log('Returned record assistant:', records[0].assistant, '(Expected:', rep, ')');
    console.log('Returned record punchIn:', records[0].punchIn);
    console.log('Returned record punchOut:', records[0].punchOut);
  } else {
    console.log('No record found for today on cold start (as expected if today is not seeded as completed)!');
  }
}

testFilterLogic();
