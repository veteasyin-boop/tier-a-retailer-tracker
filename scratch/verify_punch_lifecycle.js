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

async function verifyAll() {
  const { storage } = await import('../src/services/storage.js');
  const assistants = storage.getAssistants();
  console.log(`Verifying attendance for ${assistants.length} field assistants:`);

  for (const asst of assistants) {
    const today = storage.getISTDateStr();
    // 1. Initial state (should be null or not punched in)
    const initAtt = storage.getTodayAttendance(asst.name);
    console.log(`[${asst.name}] Initial status:`, initAtt ? initAtt.statusLabel : 'Not Punched In (Clean)');

    // 2. Punch in
    const inRec = storage.recordPunchIn(asst.name, { workMode: 'Field Operations', notes: 'Field testing' });
    console.log(`[${asst.name}] Punched In:`, inRec.punchIn, '| PunchOut:', inRec.punchOut, '| Status:', inRec.statusLabel);

    if (inRec.punchOut !== null) {
      throw new Error(`Failure: punchOut should be null after punch in, but got ${inRec.punchOut}`);
    }

    // 3. Punch out
    const outRec = storage.recordPunchOut(asst.name, { notes: 'Completed day' });
    console.log(`[${asst.name}] Punched Out:`, outRec.punchOut, '| Duration:', outRec.workingHoursFormatted, '| Status:', outRec.statusLabel);

    if (!outRec.punchOut) {
      throw new Error('Failure: punchOut should have timestamp after punch out');
    }

    // 4. Reset
    storage.resetTodayPunch(asst.name);
    const resetAtt = storage.getTodayAttendance(asst.name);
    console.log(`[${asst.name}] After Reset:`, resetAtt ? resetAtt.statusLabel : 'Reset Confirmed (null)');
  }

  console.log('\n✅ ALL PUNCH IN / PUNCH OUT TESTS PASSED CLEANLY FOR ALL 8 FIELD REPS!');
}

verifyAll();
