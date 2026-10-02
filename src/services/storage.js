import { DEFAULT_ASSISTANTS } from '../data/assistants.js';
import { generateSeedData } from '../data/seedData.js';
import { auth } from './auth.js';
import { showToast } from '../components/toast.js';
import { supabaseService } from './supabase.js';
import { AGRONOMY_QUIZ_QUESTIONS } from './kpiService.js';
import { BIHAR_BLOCKS, calculateCheckInJourneyKm, calculateDistanceKm, optimizeTourBeatRoute } from '../utils/geo.js';
import { idbStorage } from './idbStorage.js';
import { syncQueue } from './syncQueue.js';

const STORAGE_KEY = 'tier_a_retailers_bihar_v3';
const ASSISTANTS_KEY = 'tier_a_assistants_config_v1';

class StorageService {
  // Returns today's date string in IST (India Standard Time, UTC+5:30)
  // MUST be used instead of new Date().toISOString() for all attendance date stamps
  getISTDateStr(date = new Date()) {
    const IST_OFFSET_MS = 5.5 * 60 * 60000;
    return new Date(date.getTime() + IST_OFFSET_MS).toISOString().split('T')[0];
  }

  constructor() {
    this.rows = [];
    this.assistants = [];
    this.db = null;
    this.isClaudeEnv = false;
    this.initialized = false;
  }

  async init() {
    if (this.initialized) return this.rows;

    // Start background optimistic sync queue with exponential backoff
    try {
      syncQueue.start();
    } catch (e) {
      console.warn('Sync queue start note:', e);
    }

    if (typeof window !== 'undefined' && window.claude && typeof window.claude.use === 'function') {
      try {
        this.db = await window.claude.use('db');
        if (this.db) {
          this.isClaudeEnv = true;
          this.updateStorageIndicator('🟢 Claude Live Sync', 'Real-time database sync active');
          
          try {
            this.db.collection('retailers').onSnapshot((snap) => {
              if (snap && snap.docs) {
                this.rows = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                this.triggerChange();
              }
            });
          } catch(e) {
            console.warn("onSnapshot fallback:", e);
          }
        }
      } catch(e) {
        console.warn("Claude API error:", e);
      }
    }

    this.loadAssistants();
    await this.loadRows();
    await this.initSupabaseSync();
    this.initialized = true;
    return this.rows;
  }

  async initSupabaseSync() {
    if (this.isClaudeEnv) return;

    try {
      const isConnected = await supabaseService.init();
      if (isConnected) {
        this.updateStorageIndicator('🟢 Supabase Cloud Active', 'Live sync enabled with Supabase PostgreSQL');

        // Subscribe to real-time events across field reps
        supabaseService.subscribeToRealtime((table, payload) => {
          this.handleRealtimeChange(table, payload);
        });

        // Background pull if cloud has data
        try {
          const cloudRows = await supabaseService.fetchRetailers();
          if (cloudRows && cloudRows.length > 0) {
            this.rows = cloudRows;
            this.saveToLocal();
            this.triggerChange();
          }

          const cloudAssistants = await supabaseService.fetchAssistants();
          if (cloudAssistants && cloudAssistants.length > 0) {
            this.assistants = cloudAssistants;
            this.saveAssistantsToLocal();
            this.triggerChange();
          }

          // Initial pull for MGO SOP tables
          const cloudMeetings = await supabaseService.fetchFarmerMeetings();
          if (cloudMeetings && cloudMeetings.length > 0) {
            this.saveFarmerMeetingsToLocal(cloudMeetings);
            this.triggerChange();
          }

          const cloudDemos = await supabaseService.fetchDemoPlots();
          if (cloudDemos && cloudDemos.length > 0) {
            this.saveDemoPlotsToLocal(cloudDemos);
            this.triggerChange();
          }

          const cloudIntel = await supabaseService.fetchCompetitorIntel();
          if (cloudIntel && cloudIntel.length > 0) {
            this.saveCompetitorIntelToLocal(cloudIntel);
            this.triggerChange();
          }

          const cloudLeads = await supabaseService.fetchFarmerLeads();
          if (cloudLeads && cloudLeads.length > 0) {
            this.saveFarmerLeadsToLocal(cloudLeads);
            this.triggerChange();
          }

          const cloudAqfs = await supabaseService.fetchAqfsAudits();
          if (cloudAqfs && cloudAqfs.length > 0) {
            this.saveAqfsAuditsToLocal(cloudAqfs);
            this.triggerChange();
          }

          const cloudReviews = await supabaseService.fetchWeeklyReviews();
          if (cloudReviews && cloudReviews.length > 0) {
            this.saveWeeklyReviewsToLocal(cloudReviews);
            this.triggerChange();
          }
        } catch(syncErr) {
          console.warn('Initial Supabase fetch warning:', syncErr);
        }
      } else {
        this.updateStorageIndicator('⚡ Local Offline Storage', 'Offline persistence enabled via localStorage. Click to configure Supabase.');
      }
    } catch(e) {
      console.warn('Supabase init warning:', e);
      this.updateStorageIndicator('⚡ Local Offline Storage', 'Offline persistence enabled via localStorage');
    }
  }

  handleRealtimeChange(table, payload) {
    if (!payload) return;
    const { eventType, new: newRec, old: oldRec } = payload;
    console.log(`⚡ Supabase Realtime [${table}]:`, eventType, newRec?.id || oldRec?.id);

    if (table === 'retailers') {
      if (eventType === 'INSERT' || eventType === 'UPDATE') {
        const mapped = {
          id: newRec.id,
          retailer: newRec.retailer,
          assistant: newRec.assistant,
          hq: newRec.hq,
          district: newRec.district,
          block: newRec.block,
          mobile: newRec.mobile,
          status: newRec.status,
          potentialFor: newRec.potential_for,
          potentialSell: newRec.potential_sell,
          notes: newRec.notes,
          verifiedVisit: Boolean(newRec.verified_visit),
          checkInDate: newRec.check_in_date,
          checkInTime: newRec.check_in_time,
          checkInCoords: (newRec.check_in_lat && newRec.check_in_lng) ? {
            lat: newRec.check_in_lat,
            lng: newRec.check_in_lng,
            accuracy: newRec.check_in_accuracy
          } : null,
          checkInDistKm: newRec.check_in_dist_km,
          checkInMapUrl: newRec.check_in_map_url,
          checkInRep: newRec.check_in_rep,
          updatedBy: newRec.updated_by,
          updatedAt: newRec.updated_at ? new Date(newRec.updated_at).getTime() : Date.now()
        };

        const idx = this.rows.findIndex(r => r.id === mapped.id);
        if (idx >= 0) {
          this.rows[idx] = { ...this.rows[idx], ...mapped };
        } else {
          this.rows.unshift(mapped);
        }
        this.saveToLocal();
        this.triggerChange();
      } else if (eventType === 'DELETE') {
        if (oldRec && oldRec.id) {
          this.rows = this.rows.filter(r => r.id !== oldRec.id);
          this.saveToLocal();
          this.triggerChange();
        }
      }
    } else if (table === 'check_in_logs') {
      if (eventType === 'INSERT' || eventType === 'UPDATE') {
        const mappedLog = {
          id: newRec.id,
          retailerId: newRec.retailer_id,
          retailer: newRec.retailer,
          mobile: newRec.mobile,
          district: newRec.district,
          block: newRec.block,
          rep: newRec.rep,
          date: newRec.date,
          time: newRec.time,
          timestamp: newRec.timestamp || (newRec.created_at ? new Date(newRec.created_at).getTime() : Date.now()),
          lat: newRec.lat,
          lng: newRec.lng,
          accuracy: newRec.accuracy,
          distKm: newRec.dist_km,
          mapUrl: newRec.map_url,
          status: newRec.status,
          notes: newRec.notes
        };
        this.saveCheckInLog(mappedLog, false);
      }
    } else if (table === 'assistants') {
      if (eventType === 'INSERT' || eventType === 'UPDATE') {
        const mappedAsst = {
          name: newRec.name,
          hq: newRec.hq,
          district: newRec.district,
          target: newRec.target || 50,
          blocks: newRec.blocks || [],
          password: newRec.password || 'rep123'
        };
        const idx = this.assistants.findIndex(a => a.name === mappedAsst.name);
        if (idx >= 0) {
          this.assistants[idx] = mappedAsst;
        } else {
          this.assistants.push(mappedAsst);
        }
        this.saveAssistantsToLocal();
        this.triggerChange();
      }
    } else if (table === 'farmer_meetings') {
      if (eventType === 'INSERT' || eventType === 'UPDATE') {
        this.saveFarmerMeeting(newRec, false);
      } else if (eventType === 'DELETE' && oldRec?.id) {
        const list = this.getFarmerMeetings().filter(m => m.id !== oldRec.id);
        this.saveFarmerMeetingsToLocal(list);
        this.triggerChange();
      }
    } else if (table === 'demo_plots') {
      if (eventType === 'INSERT' || eventType === 'UPDATE') {
        this.saveDemoPlot(newRec, false);
      } else if (eventType === 'DELETE' && oldRec?.id) {
        const list = this.getDemoPlots().filter(d => d.id !== oldRec.id);
        this.saveDemoPlotsToLocal(list);
        this.triggerChange();
      }
    } else if (table === 'competitor_intel') {
      if (eventType === 'INSERT' || eventType === 'UPDATE') {
        this.saveCompetitorIntel(newRec, false);
      } else if (eventType === 'DELETE' && oldRec?.id) {
        const list = this.getCompetitorIntel().filter(c => c.id !== oldRec.id);
        this.saveCompetitorIntelToLocal(list);
        this.triggerChange();
      }
    } else if (table === 'farmer_leads') {
      if (eventType === 'INSERT' || eventType === 'UPDATE') {
        this.saveFarmerLead(newRec, false);
      } else if (eventType === 'DELETE' && oldRec?.id) {
        const list = this.getFarmerLeads().filter(l => l.id !== oldRec.id);
        this.saveFarmerLeadsToLocal(list);
        this.triggerChange();
      }
    } else if (table === 'aqfs_audits') {
      if (eventType === 'INSERT' || eventType === 'UPDATE') {
        this.saveAqfsAudit(newRec, false);
      } else if (eventType === 'DELETE' && oldRec?.id) {
        const list = this.getAqfsAudits().filter(a => a.id !== oldRec.id);
        this.saveAqfsAuditsToLocal(list);
        this.triggerChange();
      }
    } else if (table === 'weekly_reviews') {
      if (eventType === 'INSERT' || eventType === 'UPDATE') {
        this.saveWeeklyReview(newRec, false);
      } else if (eventType === 'DELETE' && oldRec?.id) {
        const list = this.getWeeklyReviews().filter(r => r.id !== oldRec.id);
        this.saveWeeklyReviewsToLocal(list);
        this.triggerChange();
      }
    }
  }

  updateStorageIndicator(label, title) {
    const labelEl = document.getElementById('storageLabel');
    const pillEl = document.getElementById('storagePill');
    if (labelEl) labelEl.textContent = label;
    if (pillEl) {
      pillEl.title = title;
      pillEl.style.cursor = 'pointer';
    }
  }

  loadAssistants() {
    try {
      const raw = localStorage.getItem(ASSISTANTS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          this.assistants = parsed;
          return this.assistants;
        }
      }
    } catch(e) {
      console.error("Assistants config read error:", e);
    }

    this.assistants = JSON.parse(JSON.stringify(DEFAULT_ASSISTANTS));
    this.saveAssistantsToLocal();
    return this.assistants;
  }

  saveAssistantsToLocal() {
    try {
      localStorage.setItem(ASSISTANTS_KEY, JSON.stringify(this.assistants));
    } catch(e) {
      console.error("Assistants config save error:", e);
    }
  }

  getAssistants() {
    if (!this.assistants || this.assistants.length === 0) {
      this.loadAssistants();
    }
    return this.assistants;
  }

  async saveAssistant(assistantData, oldName = null) {
    if (!auth.isAdmin) {
      throw new Error('Permission denied: Only Admin / Manager can update assistant names and territories.');
    }

    const list = this.getAssistants();
    const idx = list.findIndex(a => a.name === (oldName || assistantData.name));

    if (idx >= 0) {
      list[idx] = {
        ...list[idx],
        ...assistantData
      };
    } else {
      list.push(assistantData);
    }

    // Cascade name update across all retailer records if name changed
    if (oldName && oldName !== assistantData.name) {
      let cascadedCount = 0;
      this.rows.forEach(r => {
        if (r.assistant === oldName) {
          r.assistant = assistantData.name;
          r.updatedAt = Date.now();
          cascadedCount++;
        }
      });

      // Update active session rep if it was the old name
      if (auth.getAssignedRep() === oldName) {
        auth.setAssignedRep(assistantData.name);
      }

      this.saveToLocal();
      showToast(`Updated rep name & cascaded to ${cascadedCount} retailers`, '✅');
    }

    this.saveAssistantsToLocal();
    this.triggerChange();
    if (supabaseService.isReady) {
      supabaseService.saveAssistant(assistantData).catch(e => console.warn('Supabase saveAssistant warning:', e));
    }
    return assistantData;
  }

  async addAssistant(newAssistant) {
    if (!auth.isAdmin) {
      throw new Error('Permission denied: Only Admin / Manager can add assistants.');
    }

    const list = this.getAssistants();
    if (list.some(a => a.name.toLowerCase() === newAssistant.name.toLowerCase())) {
      throw new Error(`An assistant named "${newAssistant.name}" already exists.`);
    }

    list.push(newAssistant);
    this.saveAssistantsToLocal();
    this.triggerChange();
    if (supabaseService.isReady) {
      supabaseService.saveAssistant(newAssistant).catch(e => console.warn('Supabase addAssistant warning:', e));
    }
    return newAssistant;
  }

  async deleteAssistant(name, transferTo = '') {
    if (!auth.isAdmin) {
      throw new Error('Permission denied: Only Admin / Manager can delete assistants.');
    }

    if (transferTo) {
      this.rows.forEach(r => {
        if (r.assistant === name) {
          r.assistant = transferTo;
          r.updatedAt = Date.now();
        }
      });
      this.saveToLocal();
    }

    this.assistants = this.assistants.filter(a => a.name !== name);
    this.saveAssistantsToLocal();
    this.triggerChange();
    if (supabaseService.isReady && supabaseService.client) {
      supabaseService.client.from('assistants').delete().eq('name', name).catch(e => console.warn('Supabase deleteAssistant warning:', e));
    }
  }

  async reassignBlockRetailers(blockName, targetAssistantName) {
    if (!auth.isAdmin) {
      throw new Error('Permission denied: Only Admin / Manager can reassign territories.');
    }

    let reassignedCount = 0;
    this.rows.forEach(r => {
      if ((r.block || '').toLowerCase() === blockName.toLowerCase()) {
        r.assistant = targetAssistantName;
        r.updatedAt = Date.now();
        reassignedCount++;
      }
    });

    // Also update block lists in assistants config
    const targetAssoc = this.assistants.find(a => a.name === targetAssistantName);
    if (targetAssoc && !targetAssoc.blocks.includes(blockName)) {
      targetAssoc.blocks.push(blockName);
      this.saveAssistantsToLocal();
    }

    this.saveToLocal();
    this.triggerChange();
    return reassignedCount;
  }

  async transferAllRetailers(fromAssistant, toAssistant) {
    if (!auth.isAdmin) {
      throw new Error('Permission denied: Only Admin / Manager can transfer territories.');
    }
    if (fromAssistant === toAssistant) {
      throw new Error('Source and Target assistants must be different.');
    }

    let count = 0;
    this.rows.forEach(r => {
      if (r.assistant === fromAssistant) {
        r.assistant = toAssistant;
        r.updatedAt = Date.now();
        count++;
      }
    });

    const sourceObj = this.assistants.find(a => a.name === fromAssistant);
    const targetObj = this.assistants.find(a => a.name === toAssistant);
    if (sourceObj && targetObj) {
      const mergedBlocks = [...new Set([...(targetObj.blocks || []), ...(sourceObj.blocks || [])])];
      targetObj.blocks = mergedBlocks;
      targetObj.target = (targetObj.target || 0) + (sourceObj.target || 0);
      sourceObj.blocks = [];
      sourceObj.target = 0;
      this.saveAssistantsToLocal();
    }

    this.saveToLocal();
    this.triggerChange();
    return count;
  }

  async reassignMultipleRetailers(retailerIds, targetAssistantName) {
    if (!auth.isAdmin) {
      throw new Error('Permission denied: Only Admin / Manager can reassign retailers.');
    }
    if (!Array.isArray(retailerIds) || retailerIds.length === 0) {
      throw new Error('No retailers selected.');
    }

    const idSet = new Set(retailerIds);
    let count = 0;
    const touchedBlocks = new Set();

    this.rows.forEach(r => {
      if (idSet.has(r.id)) {
        r.assistant = targetAssistantName;
        r.updatedAt = Date.now();
        if (r.block) touchedBlocks.add(r.block);
        count++;
      }
    });

    const targetAssoc = this.assistants.find(a => a.name === targetAssistantName);
    if (targetAssoc) {
      const currentBlocks = new Set(targetAssoc.blocks || []);
      touchedBlocks.forEach(b => currentBlocks.add(b));
      targetAssoc.blocks = Array.from(currentBlocks);
      this.saveAssistantsToLocal();
    }

    this.saveToLocal();
    this.triggerChange();
    return count;
  }

  async loadRows() {
    if (this.isClaudeEnv && this.db) {
      try {
        const snap = await this.db.collection('retailers').orderBy('idx').get();
        if (snap && snap.docs && snap.docs.length > 0) {
          this.rows = snap.docs.map(d => ({ id: d.id, ...d.data() }));
          return this.rows;
        } else {
          const seed = generateSeedData();
          for (let i = 0; i < seed.length; i++) {
            await this.db.collection('retailers').doc(seed[i].id).set(seed[i]);
          }
          this.rows = seed;
          return this.rows;
        }
      } catch (err) {
        console.warn("Claude DB fetch fallback to local store:", err);
      }
    }

    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          this.rows = parsed;
          return this.rows;
        }
      }
    } catch(e) {
      console.error("Local storage read error:", e);
    }

    this.rows = generateSeedData();
    this.saveToLocal();
    return this.rows;
  }

  saveToLocal() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.rows));
    } catch(e) {
      console.error("Local storage save error:", e);
    }
  }

  async saveRow(doc) {
    const existing = this.rows.find(r => r.id === doc.id);

    if (!auth.isAdmin) {
      const assignedRep = auth.getAssignedRep();
      if (!assignedRep) {
        throw new Error('Device is not assigned to any Field Station. Please select territory or login as Manager.');
      }

      if (existing && existing.assistant !== assignedRep) {
        throw new Error(`Permission denied: Retailer is assigned to "${existing.assistant}". You cannot modify another rep's data.`);
      }

      doc.assistant = assignedRep;
    }

    const updatePayload = {
      ...doc,
      updatedBy: auth.isAdmin ? 'Admin' : auth.getAssignedRep(),
      updatedAt: Date.now()
    };

    if (this.isClaudeEnv && this.db) {
      try {
        await this.db.collection('retailers').doc(doc.id).set(updatePayload, { merge: true });
      } catch(e) {
        console.error("Claude DB save failed:", e);
      }
    }

    const idx = this.rows.findIndex(r => r.id === doc.id);
    if (idx >= 0) {
      this.rows[idx] = { ...this.rows[idx], ...updatePayload };
    } else {
      this.rows.unshift(updatePayload);
    }

    this.saveToLocal();
    this.triggerChange();
    if (supabaseService.isReady) {
      supabaseService.upsertRetailer(updatePayload).catch(e => console.warn('Supabase saveRow warning:', e));
    }
    return updatePayload;
  }

  async deleteRow(id) {
    if (!auth.isAdmin) {
      throw new Error('Permission denied: Only Admin / Manager can delete retailers from the system.');
    }

    if (this.isClaudeEnv && this.db) {
      try {
        await this.db.collection('retailers').doc(id).delete();
      } catch(e) {
        console.error("Claude DB delete failed:", e);
      }
    }

    this.rows = this.rows.filter(r => r.id !== id);
    this.saveToLocal();
    this.triggerChange();
    if (supabaseService.isReady && supabaseService.client) {
      supabaseService.client.from('retailers').delete().eq('id', id).catch(e => console.warn('Supabase deleteRow warning:', e));
    }
  }

  async importBatch(newRows) {
    if (!auth.isAdmin) {
      throw new Error('Permission denied: Only Admin / Manager can import batch spreadsheets.');
    }

    for (const r of newRows) {
      const idx = this.rows.findIndex(row => row.id === r.id);
      if (idx >= 0) {
        this.rows[idx] = { ...this.rows[idx], ...r };
      } else {
        this.rows.push(r);
      }
    }

    this.saveToLocal();
    this.triggerChange();
    if (supabaseService.isReady) {
      supabaseService.bulkUpsertRetailers(newRows).catch(e => console.warn('Supabase batch import warning:', e));
    }
  }

  async resetData() {
    if (!auth.isAdmin) {
      throw new Error('Permission denied: Only Admin / Manager can reset the database.');
    }

    this.rows = generateSeedData();
    this.assistants = JSON.parse(JSON.stringify(DEFAULT_ASSISTANTS));
    this.saveAssistantsToLocal();
    this.saveToLocal();
    this.triggerChange();
    showToast('Database reset to original 573 Tier-A Bihar dealers & default territories', '🔄');
  }

  getCheckInLogs() {
    try {
      const raw = localStorage.getItem('tat_live_checkins_v1');
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr) && arr.length > 0) return arr;
      }
    } catch(e) {
      console.error('Error loading checkin logs:', e);
    }

    // Build synthesized logs from current rows that have verified visits
    const logs = [];
    (this.rows || []).forEach(r => {
      if (r.verifiedVisit && r.checkInDate) {
        const lat = r.checkInCoords?.lat;
        const lng = r.checkInCoords?.lng;
        logs.push({
          id: 'chk_' + r.id + '_' + (r.checkInTimestamp || Date.now()),
          retailerId: r.id,
          retailer: r.retailer,
          mobile: r.mobile || '',
          block: r.block,
          district: r.district,
          rep: r.assistant || 'Field Rep',
          date: r.checkInDate,
          time: r.checkInTime || '',
          timestamp: r.checkInTimestamp || Date.now(),
          lat: lat !== undefined ? lat : null,
          lng: lng !== undefined ? lng : null,
          accuracy: r.checkInCoords?.accuracy || null,
          distKm: r.checkInDistKm,
          mapUrl: r.checkInMapUrl || ((lat && lng) ? `https://www.google.com/maps?q=${lat},${lng}` : null),
          status: r.status || 'Visited',
          notes: r.notes || ''
        });
      }
    });
    return logs;
  }

  saveCheckInLog(entry, syncToCloud = true) {
    try {
      const logs = this.getCheckInLogs();
      // Avoid duplicate consecutive logs for same retailer on same date/time
      const existingIdx = logs.findIndex(l => l.retailerId === entry.retailerId && l.date === entry.date);
      if (existingIdx >= 0) {
        logs[existingIdx] = { ...logs[existingIdx], ...entry };
      } else {
        logs.unshift(entry);
      }
      localStorage.setItem('tat_live_checkins_v1', JSON.stringify(logs.slice(0, 1000)));
      window.dispatchEvent(new CustomEvent('tracker:checkInLogged', { detail: { entry } }));

      // Optimistically enqueue mutation to sync queue with exponential backoff
      if (syncToCloud) {
        syncQueue.enqueue('check_in_logs', 'upsert', entry).catch(e => console.warn('Sync queue checkin warning:', e));
      }
    } catch(e) {
      console.error('Error saving checkin log:', e);
    }
  }

  // ========================================================
  // MGO SOP EXTENSIONS: FARMER MEETINGS, DEMOS, COMPETITOR INTEL
  // ========================================================

  getFarmerMeetings() {
    try {
      const raw = localStorage.getItem('tat_farmer_meetings_v1');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.error('Error reading farmer meetings:', e);
    }
    // Default seed meetings for Bihar operations
    const defaultMeetings = [
      {
        id: 'fm_001',
        assistant: 'Assistant 1 (West Patna)',
        village: 'Katesar',
        block: 'Bihta',
        district: 'Patna',
        crop: 'Maize (Corn)',
        meeting_type: 'Group Meeting',
        attendees_count: 14,
        lead_farmers: [
          { name: 'Rameshwar Singh', mobile: '9835012345', acre: 4 },
          { name: 'Vijay Yadav', mobile: '9431098765', acre: 6 }
        ],
        key_discussion: 'Demonstrated cob size and stay-green characteristics. Advised on weed management during early vegetative stage.',
        date: '2026-09-27',
        photo_url: '',
        created_at: new Date(Date.now() - 86400000).toISOString()
      },
      {
        id: 'fm_002',
        assistant: 'Assistant 4 (West Vaishali)',
        village: 'Subhai',
        block: 'Hajipur',
        district: 'Vaishali',
        crop: 'Vegetables (Cauliflower, Chilli, Tomato)',
        meeting_type: 'Field Day',
        attendees_count: 22,
        lead_farmers: [
          { name: 'Sanjay Kumar', mobile: '9934123456', acre: 2.5 }
        ],
        key_discussion: 'Field day on curd firmness, disease resistance, and higher market price realization with local wholesale traders.',
        date: '2026-09-28',
        photo_url: '',
        created_at: new Date().toISOString()
      }
    ];
    this.saveFarmerMeetingsToLocal(defaultMeetings);
    return defaultMeetings;
  }

  saveFarmerMeetingsToLocal(meetings) {
    try {
      localStorage.setItem('tat_farmer_meetings_v1', JSON.stringify(meetings));
    } catch (e) {
      console.error('Error saving farmer meetings local:', e);
    }
  }

  saveFarmerMeeting(meeting, syncToCloud = true) {
    const list = this.getFarmerMeetings();
    const idx = list.findIndex(m => m.id === meeting.id);
    if (idx >= 0) {
      list[idx] = { ...list[idx], ...meeting };
    } else {
      list.unshift(meeting);
    }
    this.saveFarmerMeetingsToLocal(list);
    window.dispatchEvent(new CustomEvent('tracker:farmerMeetingLogged', { detail: { meeting } }));
    this.triggerChange();

    // Optimistically enqueue mutation to sync queue with exponential backoff
    if (syncToCloud) {
      syncQueue.enqueue('farmer_meetings', 'upsert', meeting).catch(e => console.warn('Sync queue meeting warning:', e));
    }
    return meeting;
  }

  deleteFarmerMeeting(id) {
    const list = this.getFarmerMeetings().filter(m => m.id !== id);
    this.saveFarmerMeetingsToLocal(list);
    this.triggerChange();
    if (supabaseService.isReady && supabaseService.client) {
      supabaseService.client.from('farmer_meetings').delete().eq('id', id).catch(e => console.warn(e));
    }
  }

  getDemoPlots() {
    try {
      const raw = localStorage.getItem('tat_demo_plots_v1');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.error('Error reading demo plots:', e);
    }
    const defaultDemos = [
      {
        id: 'dp_001',
        assistant: 'Assistant 1 (West Patna)',
        farmer_name: 'Dharmendra Pandey',
        farmer_mobile: '9470123456',
        village: 'Sikaria',
        block: 'Bihta',
        district: 'Patna',
        crop: 'Maize (Corn)',
        hybrid_tested: 'Hy-Maize Gold 910',
        competitor_check: 'DKC 9108',
        sowing_date: '2026-08-10',
        current_stage: 'Vegetative Growth',
        yield_result_kg_acre: null,
        observations: 'Excellent germination rate (96%). Vigorous root development and dark green canopy compared to competitor check plot.',
        updated_at: new Date().toISOString()
      },
      {
        id: 'dp_002',
        assistant: 'Assistant 6 (Rohtas)',
        farmer_name: 'Satendra Chaudhary',
        farmer_mobile: '9835876543',
        village: 'Barun',
        block: 'Dehri',
        district: 'Rohtas',
        crop: 'Paddy (Rice)',
        hybrid_tested: 'Super Paddy 64',
        competitor_check: 'Arize 6444 Gold',
        sowing_date: '2026-07-15',
        current_stage: 'Flowering / Tasseling',
        yield_result_kg_acre: null,
        observations: 'Tillering average 26 productive tillers/hill vs 21 in competitor check. Uniform flowering.',
        updated_at: new Date().toISOString()
      }
    ];
    this.saveDemoPlotsToLocal(defaultDemos);
    return defaultDemos;
  }

  saveDemoPlotsToLocal(plots) {
    try {
      localStorage.setItem('tat_demo_plots_v1', JSON.stringify(plots));
    } catch (e) {
      console.error('Error saving demo plots local:', e);
    }
  }

  saveDemoPlot(plot, syncToCloud = true) {
    const list = this.getDemoPlots();
    let cleanPlot = { ...plot };

    // Offload high-res photo to IndexedDB to bypass 5MB localStorage limits
    if (plot.photo_data_url) {
      idbStorage.saveMedia(plot.id, 'demo_plot_photo', plot.photo_data_url, {
        crop: plot.crop,
        farmer_name: plot.farmer_name,
        hybrid_tested: plot.hybrid_tested
      }).catch(err => console.warn('idbStorage saveMedia error:', err));

      // Keep lightweight pointer in localStorage record
      cleanPlot.has_photo = true;
      delete cleanPlot.photo_data_url;
    }

    const idx = list.findIndex(d => d.id === plot.id);
    if (idx >= 0) {
      list[idx] = { ...list[idx], ...cleanPlot, updated_at: new Date().toISOString() };
    } else {
      list.unshift({ ...cleanPlot, updated_at: new Date().toISOString() });
    }
    this.saveDemoPlotsToLocal(list);
    window.dispatchEvent(new CustomEvent('tracker:demoPlotLogged', { detail: { plot: cleanPlot } }));
    this.triggerChange();

    if (syncToCloud) {
      syncQueue.enqueue('demo_plots', 'upsert', cleanPlot);
    }
    return cleanPlot;
  }

  deleteDemoPlot(id) {
    const list = this.getDemoPlots().filter(d => d.id !== id);
    this.saveDemoPlotsToLocal(list);
    idbStorage.deleteMedia(id).catch(err => console.warn('idb deleteMedia error:', err));
    this.triggerChange();
    syncQueue.enqueue('demo_plots', 'delete', { id });
  }

  getCompetitorIntel() {
    try {
      const raw = localStorage.getItem('tat_competitor_intel_v1');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.error('Error reading competitor intel:', e);
    }
    const defaultIntel = [
      {
        id: 'ci_001',
        assistant: 'Assistant 1 (West Patna)',
        retailer_id: 'BR-PAT-001',
        retailer_name: 'Kisan Krishi Kendra',
        district: 'Patna',
        block: 'Bihta',
        crop: 'Maize (Corn)',
        competitor_brand: 'Corteva / Pioneer',
        product_name: 'Pioneer 3355',
        retail_price: 2450,
        dealer_price: 2200,
        promotional_scheme: 'Free spray pump on purchase of 25 bags',
        farmer_sentiment: 'High Demand',
        date: '2026-09-28',
        created_at: new Date().toISOString()
      },
      {
        id: 'ci_002',
        assistant: 'Assistant 6 (Rohtas)',
        retailer_id: 'BR-ROH-002',
        retailer_name: 'Maurya Khad Beej Bhandar',
        district: 'Rohtas',
        block: 'Sasaram',
        crop: 'Paddy (Rice)',
        competitor_brand: 'Bayer',
        product_name: 'Arize 6444 Gold',
        retail_price: 980,
        dealer_price: 890,
        promotional_scheme: 'Cash discount Rs 30/bag on 7-day payment',
        farmer_sentiment: 'High Demand',
        date: '2026-09-27',
        created_at: new Date(Date.now() - 86400000).toISOString()
      }
    ];
    this.saveCompetitorIntelToLocal(defaultIntel);
    return defaultIntel;
  }

  saveCompetitorIntelToLocal(intelList) {
    try {
      localStorage.setItem('tat_competitor_intel_v1', JSON.stringify(intelList));
    } catch (e) {
      console.error('Error saving competitor intel local:', e);
    }
  }

  saveCompetitorIntel(entry, syncToCloud = true) {
    const list = this.getCompetitorIntel();
    const idx = list.findIndex(c => c.id === entry.id);
    if (idx >= 0) {
      list[idx] = { ...list[idx], ...entry };
    } else {
      list.unshift(entry);
    }
    this.saveCompetitorIntelToLocal(list);
    window.dispatchEvent(new CustomEvent('tracker:competitorIntelLogged', { detail: { entry } }));
    this.triggerChange();

    if (syncToCloud && supabaseService.isReady && supabaseService.client) {
      supabaseService.client.from('competitor_intel').upsert(entry).then(({ error }) => {
        if (error) console.warn('Supabase competitor_intel sync note:', error.message);
      }).catch(e => console.warn('Supabase competitor intel error:', e));
    }
    return entry;
  }

  deleteCompetitorIntel(id) {
    const list = this.getCompetitorIntel().filter(c => c.id !== id);
    this.saveCompetitorIntelToLocal(list);
    this.triggerChange();
    if (supabaseService.isReady && supabaseService.client) {
      supabaseService.client.from('competitor_intel').delete().eq('id', id).catch(e => console.warn(e));
    }
  }

  getEodReport(assistantName, dateStr) {
    try {
      const key = `tat_eod_${String(assistantName).toLowerCase().trim()}_${dateStr}`;
      const raw = localStorage.getItem(key);
      if (raw) return JSON.parse(raw);
    } catch (e) {
      console.error('Error reading EOD report:', e);
    }
    return null;
  }

  saveEodReport(assistantName, dateStr, report) {
    try {
      const key = `tat_eod_${String(assistantName).toLowerCase().trim()}_${dateStr}`;
      const payload = {
        assistant: assistantName,
        date: dateStr,
        submittedAt: new Date().toISOString(),
        ...report
      };
      localStorage.setItem(key, JSON.stringify(payload));
      window.dispatchEvent(new CustomEvent('tracker:eodSubmitted', { detail: { assistantName, dateStr } }));
      this.triggerChange();

      if (supabaseService.isReady && supabaseService.client) {
        const id = `${String(assistantName).toLowerCase().replace(/[^a-z0-9]/g, '_')}_${dateStr}`;
        supabaseService.client.from('eod_reports').upsert({
          id,
          assistant: assistantName,
          date: dateStr,
          day_visits: report.visitsCount || 0,
          day_meetings: report.meetingsCount || 0,
          day_intel: report.intelCount || 0,
          highlights: report.highlights || '',
          bottlenecks: report.bottlenecks || '',
          acknowledged: Boolean(report.reviewedByManager || report.acknowledged),
          manager_feedback: report.managerFeedback || '',
          submitted_at: payload.submittedAt
        }).then(({ error }) => {
          if (error) console.warn('Supabase eod_reports note:', error.message);
        }).catch(e => console.warn(e));
      }

      return true;
    } catch (e) {
      console.error('Error saving EOD report:', e);
      return false;
    }
  }

  // --- AGRONOMY QUIZ CURRICULUM & KNOWLEDGE MANAGEMENT ---
  getQuizQuestions() {
    try {
      const raw = localStorage.getItem('tat_quiz_questions_v1');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.error('Error reading quiz questions:', e);
    }
    return AGRONOMY_QUIZ_QUESTIONS;
  }

  saveQuizQuestions(questions) {
    try {
      localStorage.setItem('tat_quiz_questions_v1', JSON.stringify(questions));
      this.triggerChange();

      if (supabaseService.isReady && supabaseService.client) {
        const rows = questions.map(q => ({
          id: q.id,
          question: q.question,
          options: q.options,
          answer_index: q.correctIndex !== undefined ? q.correctIndex : q.answer_index,
          explanation: q.explanation || '',
          category: q.category || 'Agronomy'
        }));
        supabaseService.client.from('quiz_questions').upsert(rows).then(({ error }) => {
          if (error) console.warn('Supabase quiz_questions sync note:', error.message);
        }).catch(e => console.warn(e));
      }

      return true;
    } catch (e) {
      console.error('Error saving quiz questions:', e);
      return false;
    }
  }

  resetAllQuizStates() {
    try {
      const assistants = this.getAssistants();
      assistants.forEach(a => {
        const key = `tat_quiz_${String(a.name).toLowerCase().trim()}`;
        localStorage.removeItem(key);
      });
      this.triggerChange();

      if (supabaseService.isReady && supabaseService.client) {
        supabaseService.client.from('quiz_states').delete().neq('id', '___keep___').catch(e => console.warn(e));
      }

      return true;
    } catch (e) {
      console.error('Error resetting quiz states:', e);
      return false;
    }
  }

  getAllQuizStates() {
    const assistants = this.getAssistants();
    const questions = this.getQuizQuestions();
    return assistants.map(a => {
      const state = this.getQuizState(a.name);
      let score = 0;
      let isCompleted = false;
      let completedAt = null;
      if (state && state.completedAt) {
        isCompleted = true;
        completedAt = state.completedAt;
        const answers = state.answers || {};
        questions.forEach(q => {
          if (answers[q.id] === q.correctIndex) {
            score++;
          }
        });
      }
      return {
        assistant: a.name,
        hq: a.hq,
        district: a.district,
        isCompleted,
        completedAt,
        score,
        totalQuestions: questions.length,
        answers: state?.answers || {}
      };
    });
  }

  getQuizState(assistantName) {
    try {
      const key = `tat_quiz_${String(assistantName).toLowerCase().trim()}`;
      const raw = localStorage.getItem(key);
      if (raw) return JSON.parse(raw);
    } catch (e) {
      console.error('Error reading quiz state:', e);
    }
    return null;
  }

  saveQuizState(assistantName, quizData) {
    try {
      const key = `tat_quiz_${String(assistantName).toLowerCase().trim()}`;
      const payload = {
        assistant: assistantName,
        completedAt: new Date().toISOString(),
        ...quizData
      };
      localStorage.setItem(key, JSON.stringify(payload));
      this.triggerChange();

      if (supabaseService.isReady && supabaseService.client) {
        supabaseService.client.from('quiz_states').upsert({
          id: assistantName,
          assistant: assistantName,
          score: quizData.score || 0,
          total: quizData.total || 5,
          completed_at: payload.completedAt
        }).then(({ error }) => {
          if (error) console.warn('Supabase quiz_states note:', error.message);
        }).catch(e => console.warn(e));
      }

      return true;
    } catch (e) {
      console.error('Error saving quiz state:', e);
      return false;
    }
  }

  getAllEodReports(dateStr) {
    const assistants = this.getAssistants();
    return assistants.map(a => {
      const report = this.getEodReport(a.name, dateStr);
      return {
        assistant: a.name,
        hq: a.hq,
        district: a.district,
        date: dateStr,
        submitted: Boolean(report && report.submittedAt),
        submittedAt: report?.submittedAt || null,
        data: report || null
      };
    });
  }

  acknowledgeEodReport(assistantName, dateStr, feedback = '') {
    const report = this.getEodReport(assistantName, dateStr);
    if (!report) return false;
    report.reviewedByManager = true;
    report.managerReviewedAt = new Date().toISOString();
    report.managerFeedback = feedback;
    return this.saveEodReport(assistantName, dateStr, report);
  }

  // --- ASSISTANT REAL-TIME NOTIFICATIONS ---
  getAssistantNotifications(assistantName) {
    try {
      const key = `tat_notifs_${String(assistantName).toLowerCase().trim()}`;
      const raw = localStorage.getItem(key);
      if (raw) return JSON.parse(raw);
    } catch (e) {
      console.error('Error reading assistant notifications:', e);
    }
    return [];
  }

  sendAssistantNotification(assistantName, notification) {
    try {
      const list = this.getAssistantNotifications(assistantName);
      const newNotif = {
        id: notification.id || `notif_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        title: notification.title || 'Notice from Management',
        message: notification.message || '',
        type: notification.type || 'general',
        timestamp: notification.timestamp || new Date().toISOString(),
        read: false
      };
      list.unshift(newNotif);
      const key = `tat_notifs_${String(assistantName).toLowerCase().trim()}`;
      localStorage.setItem(key, JSON.stringify(list));
      window.dispatchEvent(new CustomEvent('tracker:notificationReceived', { detail: { assistantName, notification: newNotif } }));
      this.triggerChange();
      return newNotif;
    } catch (e) {
      console.error('Error sending assistant notification:', e);
      return null;
    }
  }

  broadcastNotification(notification) {
    const assistants = this.getAssistants();
    assistants.forEach(a => {
      this.sendAssistantNotification(a.name, notification);
    });
  }

  markNotificationRead(assistantName, notifId) {
    try {
      const list = this.getAssistantNotifications(assistantName);
      const target = list.find(n => n.id === notifId);
      if (target) {
        target.read = true;
        const key = `tat_notifs_${String(assistantName).toLowerCase().trim()}`;
        localStorage.setItem(key, JSON.stringify(list));
        this.triggerChange();
      }
    } catch (e) {
      console.error('Error marking notification read:', e);
    }
  }

  markAllNotificationsRead(assistantName) {
    try {
      const list = this.getAssistantNotifications(assistantName);
      list.forEach(n => n.read = true);
      const key = `tat_notifs_${String(assistantName).toLowerCase().trim()}`;
      localStorage.setItem(key, JSON.stringify(list));
      this.triggerChange();
    } catch (e) {
      console.error('Error marking all notifications read:', e);
    }
  }

  clearAssistantNotifications(assistantName) {
    try {
      const key = `tat_notifs_${String(assistantName).toLowerCase().trim()}`;
      localStorage.removeItem(key);
      this.triggerChange();
    } catch (e) {
      console.error('Error clearing notifications:', e);
    }
  }

  // --- DYNAMIC FORMS & TARGETED SURVEY STUDIO ---
  getDynamicForms() {
    try {
      const raw = localStorage.getItem('tat_dynamic_forms_v1');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.error('Error reading dynamic forms:', e);
    }
    const defaultForms = [
      {
        id: 'form_seed_001',
        title: 'Fall Armyworm & Pest Surveillance Audit',
        description: 'Bi-weekly field monitoring report on Spodoptera frugiperda and stem borer incidence across vegetative maize fields.',
        category: 'Crop Health Surveillance',
        targetType: 'all',
        targetValue: '',
        deadline: '2026-10-10',
        createdAt: '2026-09-28T10:00:00Z',
        fields: [
          { id: 'f_village', label: 'Village / Tola Name', type: 'text', required: true, placeholder: 'e.g. Katesar' },
          { id: 'f_crop_stage', label: 'Maize Crop Growth Stage', type: 'select', required: true, options: ['V1-V3 (Early Seedling)', 'V4-V8 (Knee-High)', 'Tasseling / Silking', 'Grain Filling / Maturity'] },
          { id: 'f_infestation_pct', label: 'Estimated Infested Plants (%)', type: 'number', required: true, placeholder: 'e.g. 15' },
          { id: 'f_frass_observed', label: 'Fresh Whorl Frass / Windowing Damage?', type: 'select', required: true, options: ['Yes - Heavy', 'Yes - Moderate', 'No - Clean'] },
          { id: 'f_chemical_applied', label: 'Technical Spray Recommended to Farmer', type: 'text', required: false, placeholder: 'e.g. Emamectin benzoate 5% SG @ 0.4g/L' },
          { id: 'f_action_taken', label: 'Follow-Up Required Within 48 Hours?', type: 'select', required: true, options: ['Yes', 'No'] }
        ]
      },
      {
        id: 'form_seed_002',
        title: 'Vegetable Curd Firmness & Mandi Price Realization Survey',
        description: 'Wholesale mandi price checks and cauliflower curd compactness audits for Hajipur & Mahua markets.',
        category: 'Market Intelligence',
        targetType: 'district',
        targetValue: 'Vaishali',
        deadline: '2026-10-08',
        createdAt: '2026-09-28T14:00:00Z',
        fields: [
          { id: 'f_mandi_name', label: 'Wholesale Mandi Name', type: 'text', required: true, placeholder: 'e.g. Hajipur Mandi' },
          { id: 'f_hybrid_sold', label: 'Leading Hybrid Brand Observed', type: 'text', required: true, placeholder: 'e.g. Super Hybrid Chilli 55' },
          { id: 'f_rate_per_kg', label: 'Average Wholesale Price (₹ / kg)', type: 'number', required: true, placeholder: 'e.g. 35' },
          { id: 'f_curd_firmness', label: 'Curd Quality / Firmness Grade', type: 'select', required: true, options: ['Grade A (Export/Premium)', 'Grade B (Local Standard)', 'Grade C (Loose/Yellowing)'] },
          { id: 'f_farmer_margin', label: 'Wholesale Trader Feedback on Quality', type: 'text', required: false, placeholder: 'Trader comments on shelf life' }
        ]
      }
    ];
    this.saveDynamicFormsToLocal(defaultForms);
    return defaultForms;
  }

  saveDynamicFormsToLocal(forms) {
    try {
      localStorage.setItem('tat_dynamic_forms_v1', JSON.stringify(forms));
    } catch (e) {
      console.error('Error saving dynamic forms to local:', e);
    }
  }

  saveDynamicForm(form) {
    const list = this.getDynamicForms();
    const idx = list.findIndex(f => f.id === form.id);
    if (idx >= 0) {
      list[idx] = { ...list[idx], ...form, updatedAt: new Date().toISOString() };
    } else {
      list.unshift({ ...form, createdAt: new Date().toISOString() });
    }
    this.saveDynamicFormsToLocal(list);

    // Notify targeted assistants
    if (form.targetType === 'all') {
      this.broadcastNotification({
        title: `New Field Survey: ${form.title}`,
        message: `Management has assigned a new field survey (${form.category}). Please submit responses before ${form.deadline || 'due date'}.`,
        type: 'form'
      });
    } else if (form.targetType === 'individual') {
      this.sendAssistantNotification(form.targetValue, {
        title: `New Assigned Survey: ${form.title}`,
        message: `You have been directly assigned a specific field survey (${form.category}). Please complete it in your panel.`,
        type: 'form'
      });
    } else if (form.targetType === 'district') {
      const assistants = this.getAssistants().filter(a => a.district === form.targetValue);
      assistants.forEach(a => {
        this.sendAssistantNotification(a.name, {
          title: `District Survey: ${form.title}`,
          message: `Special survey assigned for ${form.targetValue} territory reps. Please complete before ${form.deadline || 'due date'}.`,
          type: 'form'
        });
      });
    }

    this.triggerChange();
    return form;
  }

  deleteDynamicForm(formId) {
    const list = this.getDynamicForms().filter(f => f.id !== formId);
    this.saveDynamicFormsToLocal(list);
    try {
      localStorage.removeItem(`tat_form_sub_${formId}`);
    } catch (e) {}
    this.triggerChange();
  }

  getFormSubmissions(formId) {
    try {
      const raw = localStorage.getItem(`tat_form_sub_${formId}`);
      if (raw) return JSON.parse(raw);
    } catch (e) {
      console.error('Error reading form submissions:', e);
    }

    // Seed default submissions for sample forms
    if (formId === 'form_seed_001') {
      const defaultSubmissions = [
        {
          id: 'sub_001',
          formId: 'form_seed_001',
          assistant: 'Assistant 1 (West Patna)',
          hq: 'Bihta',
          district: 'Patna',
          submittedAt: '2026-09-28T16:30:00Z',
          coords: { lat: 25.565, lng: 84.872 },
          answers: {
            f_village: 'Katesar',
            f_crop_stage: 'V4-V8 (Knee-High)',
            f_infestation_pct: 14,
            f_frass_observed: 'Yes - Moderate',
            f_chemical_applied: 'Emamectin benzoate 5% SG @ 0.4g/L + sticker',
            f_action_taken: 'Yes'
          }
        },
        {
          id: 'sub_002',
          formId: 'form_seed_001',
          assistant: 'Assistant 6 (Rohtas)',
          hq: 'Sasaram',
          district: 'Rohtas',
          submittedAt: '2026-09-29T11:15:00Z',
          coords: { lat: 24.952, lng: 84.028 },
          answers: {
            f_village: 'Nokha Proper',
            f_crop_stage: 'V1-V3 (Early Seedling)',
            f_infestation_pct: 4,
            f_frass_observed: 'No - Clean',
            f_chemical_applied: 'Pheromone traps installed at 5 traps/acre',
            f_action_taken: 'No'
          }
        }
      ];
      this.saveFormSubmissionsToLocal(formId, defaultSubmissions);
      return defaultSubmissions;
    }
    return [];
  }

  saveFormSubmissionsToLocal(formId, submissions) {
    try {
      localStorage.setItem(`tat_form_sub_${formId}`, JSON.stringify(submissions));
    } catch (e) {
      console.error('Error saving form submissions:', e);
    }
  }

  saveFormSubmission(formId, answers, assistantName, coords = null) {
    const list = this.getFormSubmissions(formId);
    const assistants = this.getAssistants();
    const asstObj = assistants.find(a => a.name === assistantName) || { hq: '', district: '' };

    const newSub = {
      id: `sub_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      formId,
      assistant: assistantName,
      hq: asstObj.hq,
      district: asstObj.district,
      submittedAt: new Date().toISOString(),
      coords: coords || null,
      answers
    };

    list.unshift(newSub);
    this.saveFormSubmissionsToLocal(formId, list);
    window.dispatchEvent(new CustomEvent('tracker:formSubmitted', { detail: { formId, submission: newSub } }));
    this.triggerChange();
    return newSub;
  }

  getFormsForAssistant(assistantName) {
    const allForms = this.getDynamicForms();
    const assistants = this.getAssistants();
    const asst = assistants.find(a => a.name === assistantName);
    if (!asst) return allForms.filter(f => f.targetType === 'all');

    return allForms.filter(f => {
      if (f.targetType === 'all') return true;
      if (f.targetType === 'individual' && f.targetValue === assistantName) return true;
      if (f.targetType === 'district' && f.targetValue === asst.district) return true;
      return false;
    });
  }

  // --- FARMER LEADS (CRM & MARKET DEVELOPMENT FUNNEL) ---
  getFarmerLeads() {
    try {
      const raw = localStorage.getItem('tat_farmer_leads_v1');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.error('Error reading farmer leads:', e);
    }
    const defaultLeads = [
      {
        id: 'fl_001',
        assistant: 'Assistant 1 (West Patna)',
        farmer_name: 'Rameshwar Singh',
        mobile: '9835012345',
        village: 'Sikaria',
        block: 'Bihta',
        district: 'Patna',
        crop: 'Maize (Corn)',
        acreage: 4.0,
        farmer_category: 'Influential',
        product_interest: 'Hy-Maize Gold 910',
        funnel_stage: 'Interest',
        assigned_dealer_id: 'BR-PAT-001',
        assigned_dealer_name: 'Kisan Krishi Kendra',
        demand_volume_bags: 4,
        follow_up_date: '2026-10-02',
        follow_up_notes: 'Demonstrated cob size. Farmer requested sample rate for 4 acres.',
        created_at: new Date(Date.now() - 86400000).toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: 'fl_002',
        assistant: 'Assistant 1 (West Patna)',
        farmer_name: 'Dharmendra Pandey',
        mobile: '9470123456',
        village: 'Sikaria',
        block: 'Bihta',
        district: 'Patna',
        crop: 'Maize (Corn)',
        acreage: 5.5,
        farmer_category: 'Progressive',
        product_interest: 'Hy-Maize Gold 910',
        funnel_stage: 'Trial',
        assigned_dealer_id: 'BR-PAT-001',
        assigned_dealer_name: 'Kisan Krishi Kendra',
        demand_volume_bags: 6,
        follow_up_date: '2026-10-05',
        follow_up_notes: 'Demo plot planted. Canopy is vigorous.',
        created_at: new Date(Date.now() - 172800000).toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: 'fl_003',
        assistant: 'Assistant 4 (West Vaishali)',
        farmer_name: 'Sanjay Kumar',
        mobile: '9934123456',
        village: 'Subhai',
        block: 'Hajipur',
        district: 'Vaishali',
        crop: 'Vegetables (Cauliflower, Chilli, Tomato)',
        acreage: 2.5,
        farmer_category: 'Commercial',
        product_interest: 'Super Hybrid Chilli 55',
        funnel_stage: 'Adoption',
        assigned_dealer_id: 'BR-VAI-001',
        assigned_dealer_name: 'Vaishali Seeds & Pesticides',
        demand_volume_bags: 8,
        follow_up_date: '2026-10-01',
        follow_up_notes: 'Fully adopted for commercial season. Converted at local dealer counter.',
        created_at: new Date(Date.now() - 259200000).toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: 'fl_004',
        assistant: 'Assistant 6 (Rohtas)',
        farmer_name: 'Satendra Chaudhary',
        mobile: '9835876543',
        village: 'Barun',
        block: 'Dehri',
        district: 'Rohtas',
        crop: 'Paddy (Rice)',
        acreage: 6.0,
        farmer_category: 'Progressive',
        product_interest: 'Super Paddy 64',
        funnel_stage: 'Repeat Demand',
        assigned_dealer_id: 'BR-ROH-002',
        assigned_dealer_name: 'Maurya Khad Beej Bhandar',
        demand_volume_bags: 12,
        follow_up_date: '2026-09-30',
        follow_up_notes: 'Repeat buyer from last Kharif. Advance booked 12 bags.',
        created_at: new Date(Date.now() - 345600000).toISOString(),
        updated_at: new Date().toISOString()
      }
    ];
    this.saveFarmerLeadsToLocal(defaultLeads);
    return defaultLeads;
  }

  saveFarmerLeadsToLocal(leads) {
    try {
      localStorage.setItem('tat_farmer_leads_v1', JSON.stringify(leads));
    } catch (e) {
      console.error('Error saving farmer leads local:', e);
    }
  }

  saveFarmerLead(lead, syncToCloud = true) {
    const list = this.getFarmerLeads();
    const idx = list.findIndex(l => l.id === lead.id);
    if (idx >= 0) {
      list[idx] = { ...list[idx], ...lead, updated_at: new Date().toISOString() };
    } else {
      list.unshift({ ...lead, updated_at: new Date().toISOString() });
    }
    this.saveFarmerLeadsToLocal(list);
    window.dispatchEvent(new CustomEvent('tracker:farmerLeadLogged', { detail: { lead } }));
    this.triggerChange();

    if (syncToCloud && supabaseService.isReady && supabaseService.client) {
      supabaseService.client.from('farmer_leads').upsert(lead).then(({ error }) => {
        if (error) console.warn('Supabase farmer_leads sync note:', error.message);
      }).catch(e => console.warn('Supabase farmer lead error:', e));
    }
    return lead;
  }

  advanceFarmerLeadStage(leadId, nextStage) {
    const list = this.getFarmerLeads();
    const lead = list.find(l => l.id === leadId);
    if (lead) {
      lead.funnel_stage = nextStage;
      lead.updated_at = new Date().toISOString();
      this.saveFarmerLeadsToLocal(list);
      window.dispatchEvent(new CustomEvent('tracker:farmerLeadLogged', { detail: { lead } }));
      this.triggerChange();
      if (supabaseService.isReady && supabaseService.client) {
        supabaseService.client.from('farmer_leads').upsert(lead).catch(e => console.warn('Stage sync error:', e));
      }
      return lead;
    }
    return null;
  }

  deleteFarmerLead(id) {
    const list = this.getFarmerLeads().filter(l => l.id !== id);
    this.saveFarmerLeadsToLocal(list);
    this.triggerChange();
    if (supabaseService.isReady && supabaseService.client) {
      supabaseService.client.from('farmer_leads').delete().eq('id', id).catch(e => console.warn(e));
    }
  }

  // --- AQFS AUDITS (MANAGER FIELD QUALITY SCORING) ---
  getAqfsAudits() {
    try {
      const raw = localStorage.getItem('tat_aqfs_audits_v1');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return parsed.map(a => ({
            ...a,
            scores: a.scores || {
              compliance: a.compliance_score ?? 3.5,
              quality: a.quality_score ?? 3.5,
              documentation: a.documentation_score ?? 2.5,
              followup: a.followup_score ?? 2.0,
              accuracy: a.accuracy_score ?? 2.0
            }
          }));
        }
      }
    } catch (e) {
      console.error('Error reading AQFS audits:', e);
    }
    return [];
  }

  saveAqfsAuditsToLocal(audits) {
    try {
      localStorage.setItem('tat_aqfs_audits_v1', JSON.stringify(audits));
    } catch (e) {
      console.error('Error saving AQFS audits local:', e);
    }
  }

  saveAqfsAudit(audit, syncToCloud = true) {
    const list = this.getAqfsAudits();
    const normalizedAudit = {
      ...audit,
      scores: audit.scores || {
        compliance: audit.compliance_score ?? 3.5,
        quality: audit.quality_score ?? 3.5,
        documentation: audit.documentation_score ?? 2.5,
        followup: audit.followup_score ?? 2.0,
        accuracy: audit.accuracy_score ?? 2.0
      }
    };
    const idx = list.findIndex(a => a.id === audit.id || (a.assistant === audit.assistant && a.week_code === audit.week_code));
    if (idx >= 0) {
      list[idx] = { ...list[idx], ...normalizedAudit, updated_at: new Date().toISOString() };
    } else {
      list.unshift({ ...normalizedAudit, created_at: new Date().toISOString() });
    }
    this.saveAqfsAuditsToLocal(list);
    window.dispatchEvent(new CustomEvent('tracker:aqfsAudited', { detail: { audit: normalizedAudit } }));
    this.triggerChange();

    if (syncToCloud && supabaseService.isReady && supabaseService.client) {
      const dbRow = {
        id: normalizedAudit.id,
        assistant: normalizedAudit.assistant,
        auditor: normalizedAudit.auditor || 'Regional Sales Manager',
        week_code: normalizedAudit.week_code,
        compliance_score: normalizedAudit.scores?.compliance ?? normalizedAudit.compliance_score ?? 3.5,
        quality_score: normalizedAudit.scores?.quality ?? normalizedAudit.quality_score ?? 3.5,
        documentation_score: normalizedAudit.scores?.documentation ?? normalizedAudit.documentation_score ?? 2.5,
        followup_score: normalizedAudit.scores?.followup ?? normalizedAudit.followup_score ?? 2.0,
        accuracy_score: normalizedAudit.scores?.accuracy ?? normalizedAudit.accuracy_score ?? 2.0,
        total_aqfs_score: normalizedAudit.total_aqfs_score ?? 13.5,
        coaching_notes: normalizedAudit.coaching_notes || '',
        created_at: normalizedAudit.created_at || new Date().toISOString()
      };
      supabaseService.client.from('aqfs_audits').upsert(dbRow).then(({ error }) => {
        if (error) console.warn('Supabase aqfs_audits sync note:', error.message);
      }).catch(e => console.warn('Supabase aqfs audit error:', e));
    }
    return normalizedAudit;
  }

  getAssistantAqfsAudit(assistantName) {
    const audits = this.getAqfsAudits();
    return audits.find(a => a.assistant === assistantName) || null;
  }

  // --- WEEKLY OPERATING REVIEWS ---
  getWeeklyReviews() {
    try {
      const raw = localStorage.getItem('tat_weekly_reviews_v1');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.error('Error reading weekly reviews:', e);
    }
    return [];
  }

  saveWeeklyReviewsToLocal(reviews) {
    try {
      localStorage.setItem('tat_weekly_reviews_v1', JSON.stringify(reviews));
    } catch (e) {
      console.error('Error saving weekly reviews local:', e);
    }
  }

  saveWeeklyReview(review, syncToCloud = true) {
    const list = this.getWeeklyReviews();
    const idx = list.findIndex(r => r.id === review.id || (r.assistant === review.assistant && r.week_code === review.week_code));
    if (idx >= 0) {
      list[idx] = { ...list[idx], ...review, updated_at: new Date().toISOString() };
    } else {
      list.unshift({ ...review, submitted_at: new Date().toISOString() });
    }
    this.saveWeeklyReviewsToLocal(list);
    window.dispatchEvent(new CustomEvent('tracker:weeklyReviewSubmitted', { detail: { review } }));
    this.triggerChange();

    if (syncToCloud && supabaseService.isReady && supabaseService.client) {
      const dbRow = {
        id: review.id,
        assistant: review.assistant,
        week_code: review.week_code,
        planned_visits: review.planned_visits || 0,
        completed_visits: review.completed_visits || 0,
        farmer_meetings_count: review.farmer_meetings_count || 0,
        new_farmer_leads: review.new_farmer_leads || 0,
        demos_active: review.demos_active || 0,
        competitor_updates: review.competitor_updates || 0,
        key_challenges: review.key_challenges || '',
        next_week_priorities: review.next_week_priorities || '',
        status: review.status || 'Submitted',
        manager_remarks: review.manager_remarks || '',
        submitted_at: review.submitted_at || new Date().toISOString()
      };
      supabaseService.client.from('weekly_reviews').upsert(dbRow).then(({ error }) => {
        if (error) console.warn('Supabase weekly_reviews sync note:', error.message);
      }).catch(e => console.warn('Supabase weekly review error:', e));
    }
    return review;
  }

  getAssistantWeeklyReview(assistantName, weekCode) {
    const list = this.getWeeklyReviews();
    return list.find(r => r.assistant === assistantName && (!weekCode || r.week_code === weekCode)) || null;
  }

  // =========================================================================
  // DYNAMIC FORMS & TARGETED FIELD SURVEYS
  // =========================================================================
  getDynamicForms() {
    try {
      const raw = localStorage.getItem('tat_dynamic_forms_v1');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.error('Error reading dynamic forms:', e);
    }

    // Default Seed Forms for Bihar Agro Operations
    const defaultForms = [
      {
        id: 'form_faw_audit',
        title: 'Fall Armyworm & Whorl Pest Surveillance Audit',
        category: 'Pest Surveillance',
        targetType: 'district',
        targetValue: 'Samastipur',
        deadline: '2026-10-05',
        status: 'active',
        description: 'Mandatory field assessment for vegetative Rabi maize (V3-V6). Inspect 20 plants across 5 points and report whorl frass incidence.',
        fields: [
          { id: 'f_crop_stage', label: 'Crop Phenological Stage', type: 'select', options: ['V2 (2-leaf)', 'V4 (4-leaf)', 'V6 (Rapid growth)', 'Tasseling', 'Silking'], required: true },
          { id: 'f_incidence_pct', label: 'Infested Plants Percentage (%)', type: 'number', placeholder: 'e.g. 12', required: true },
          { id: 'f_larva_stage', label: 'Larval Instar Observed', type: 'select', options: ['Small Instar (1st-2nd)', 'Medium Instar (3rd-4th)', 'Large Larva (5th-6th)', 'No Live Larvae'], required: true },
          { id: 'f_chemical_sprayed', label: 'Farmer Chemical Action Taken', type: 'text', placeholder: 'e.g. Emamectin benzoate 5% SG or Chlorantraniliprole', required: false },
          { id: 'f_recommendation_given', label: 'MGO Agronomic Recommendation Delivered?', type: 'yesno', required: true },
          { id: 'f_notes', label: 'Field Observations & Frass Severity', type: 'textarea', placeholder: 'Record windowing symptoms, whorl leaf feeding, soil moisture...', required: false }
        ],
        created_at: new Date(Date.now() - 3 * 86400000).toISOString()
      },
      {
        id: 'form_veg_mandi',
        title: 'Vegetable Curd Firmness & Mandi Price Realization Survey',
        category: 'Mandi Pricing',
        targetType: 'all',
        targetValue: 'all',
        deadline: '2026-10-10',
        status: 'active',
        description: 'Collect wholesale farmgate and mandi realization rates for Cauliflower, Cabbage, and Tomato across district trade hubs.',
        fields: [
          { id: 'f_crop', label: 'Target Vegetable Crop', type: 'select', options: ['Cauliflower (Snowball)', 'Cabbage', 'Hybrid Tomato', 'Chilli', 'Okra'], required: true },
          { id: 'f_mandi_name', label: 'Mandi / Farmgate Market Name', type: 'text', placeholder: 'e.g. Rosera Mandi / Musrigharari', required: true },
          { id: 'f_wholesale_rate', label: 'Wholesale Price (₹/Quintal or ₹/kg)', type: 'number', placeholder: 'e.g. 2400', required: true },
          { id: 'f_curd_quality', label: 'Curd Quality / Grade Rating', type: 'select', options: ['A-Grade (Export / Premium White)', 'B-Grade (Standard Commercial)', 'C-Grade (Loose / Yellowing)'], required: true },
          { id: 'f_counter_stock_moving', label: 'Is Hybrid Seed Stock Moving Well at Counter?', type: 'yesno', required: true },
          { id: 'f_notes', label: 'Dealer / Farmer Price Realization Feedback', type: 'textarea', required: false }
        ],
        created_at: new Date(Date.now() - 5 * 86400000).toISOString()
      }
    ];
    this.saveDynamicFormsToLocal(defaultForms);
    return defaultForms;
  }

  saveDynamicFormsToLocal(forms) {
    try {
      localStorage.setItem('tat_dynamic_forms_v1', JSON.stringify(forms));
    } catch (e) {
      console.error('Error saving dynamic forms local:', e);
    }
  }

  saveDynamicForm(form) {
    const list = this.getDynamicForms();
    const idx = list.findIndex(f => f.id === form.id);
    if (idx >= 0) {
      list[idx] = { ...list[idx], ...form, updated_at: new Date().toISOString() };
    } else {
      list.unshift({ ...form, id: form.id || `form_${Date.now()}`, created_at: new Date().toISOString() });
    }
    this.saveDynamicFormsToLocal(list);
    this.triggerChange();
    return form;
  }

  deleteDynamicForm(id) {
    const list = this.getDynamicForms().filter(f => f.id !== id);
    this.saveDynamicFormsToLocal(list);
    // Also remove associated submissions
    const subs = this.getFormSubmissions().filter(s => s.formId !== id);
    this.saveFormSubmissionsToLocal(subs);
    this.triggerChange();
  }

  getFormSubmissions() {
    try {
      const raw = localStorage.getItem('tat_form_submissions_v1');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.error('Error reading form submissions:', e);
    }

    // Default Seed Submissions
    const defaultSubs = [
      {
        id: 'sub_001',
        formId: 'form_faw_audit',
        assistant: 'Ankit Sharma',
        answers: {
          f_crop_stage: 'V4 (4-leaf)',
          f_incidence_pct: 14,
          f_larva_stage: 'Medium Instar (3rd-4th)',
          f_chemical_sprayed: 'Emamectin benzoate 5% SG @ 80g/acre applied yesterday',
          f_recommendation_given: 'yes',
          f_notes: 'Heavy pinhole damage observed in south-facing plots near Rosera canal. Advised whorl direct application.'
        },
        location: { lat: 25.7532, lng: 85.9984, accuracy: 12, isRealGps: true },
        submittedAt: new Date(Date.now() - 36 * 3600000).toISOString()
      },
      {
        id: 'sub_002',
        formId: 'form_veg_mandi',
        assistant: 'Vikash Kumar',
        answers: {
          f_crop: 'Cauliflower (Snowball)',
          f_mandi_name: 'Musrigharari Mandi Hub',
          f_wholesale_rate: 2200,
          f_curd_quality: 'A-Grade (Export / Premium White)',
          f_counter_stock_moving: 'yes',
          f_notes: 'Snowball 16 fetched ₹400/quintal premium over local open pollinated varieties. Strong counter demand.'
        },
        location: { lat: 25.8621, lng: 85.7812, accuracy: 15, isRealGps: true },
        submittedAt: new Date(Date.now() - 20 * 3600000).toISOString()
      }
    ];
    this.saveFormSubmissionsToLocal(defaultSubs);
    return defaultSubs;
  }

  saveFormSubmissionsToLocal(submissions) {
    try {
      localStorage.setItem('tat_form_submissions_v1', JSON.stringify(submissions));
    } catch (e) {
      console.error('Error saving form submissions local:', e);
    }
  }

  saveFormSubmission(submission) {
    const list = this.getFormSubmissions();
    const newSub = {
      ...submission,
      id: submission.id || `sub_${Date.now()}`,
      submittedAt: submission.submittedAt || new Date().toISOString()
    };
    list.unshift(newSub);
    this.saveFormSubmissionsToLocal(list);
    this.triggerChange();
    return newSub;
  }

  getFormsForAssistant(assistantName) {
    const allForms = this.getDynamicForms();
    const asst = this.getAssistants().find(a => a.name === assistantName);
    const submissions = this.getFormSubmissions();

    return allForms.filter(f => {
      if (f.status !== 'active') return false;
      if (f.targetType === 'all') return true;
      if (f.targetType === 'individual') return f.targetValue === assistantName;
      if (f.targetType === 'district' && asst) return f.targetValue === asst.district;
      return false;
    }).map(f => {
      const userSubmission = submissions.find(s => s.formId === f.id && s.assistant === assistantName);
      return {
        ...f,
        userSubmitted: Boolean(userSubmission),
        submissionData: userSubmission || null
      };
    });
  }

  // =========================================================================
  // PHYSICAL INVENTORY ALLOCATIONS & FIELD LIQUIDATION LEDGER
  // =========================================================================
  getInventoryAllocations() {
    try {
      const raw = localStorage.getItem('tat_inventory_allocations_v1');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.error('Error reading inventory allocations:', e);
    }

    // Default Seed Allocations across Bihar Territory Hubs
    const defaultAllocations = [
      {
        id: 'alloc_001',
        productName: 'Shaktiman Hybrid Maize 3355',
        crop: 'Maize',
        category: 'Hybrid Seeds',
        batchNo: 'LOT-BIH-M3355-A',
        unit: 'packets',
        targetRep: 'Ankit Sharma',
        allocatedQty: 400,
        unitPrice: 650,
        allocatedDate: '2026-09-15',
        season: 'Rabi 2026',
        notes: 'Target Rosera & Dalsinghsarai high-yield maize counters'
      },
      {
        id: 'alloc_002',
        productName: 'Shaktiman Hybrid Maize 3355',
        crop: 'Maize',
        category: 'Hybrid Seeds',
        batchNo: 'LOT-BIH-M3355-A',
        unit: 'packets',
        targetRep: 'Vikash Kumar',
        allocatedQty: 350,
        unitPrice: 650,
        allocatedDate: '2026-09-15',
        season: 'Rabi 2026',
        notes: 'Focus on Muzaffarpur and Vaishali belt'
      },
      {
        id: 'alloc_003',
        productName: 'Snowball 16 Cauliflower Seed',
        crop: 'Cauliflower',
        category: 'Vegetable Seeds',
        batchNo: 'LOT-SNOW-26-B',
        unit: 'kg',
        targetRep: 'Pawan Jha',
        allocatedQty: 80,
        unitPrice: 4800,
        allocatedDate: '2026-09-16',
        season: 'Rabi 2026',
        notes: 'Premium curd firmness promotion in Begusarai vegetable pocket'
      },
      {
        id: 'alloc_004',
        productName: 'Snowball 16 Cauliflower Seed',
        crop: 'Cauliflower',
        category: 'Vegetable Seeds',
        batchNo: 'LOT-SNOW-26-B',
        unit: 'kg',
        targetRep: 'Ankit Sharma',
        allocatedQty: 45,
        unitPrice: 4800,
        allocatedDate: '2026-09-16',
        season: 'Rabi 2026',
        notes: 'Deploy across Samastipur vegetable cluster'
      },
      {
        id: 'alloc_005',
        productName: 'Abhinav F1 Hybrid Tomato Seeds',
        crop: 'Tomato',
        category: 'Vegetable Seeds',
        batchNo: 'LOT-TOM-ABH-09',
        unit: 'packets',
        targetRep: 'Sunil Kumar',
        allocatedQty: 200,
        unitPrice: 950,
        allocatedDate: '2026-09-18',
        season: 'Rabi 2026',
        notes: 'Early nursery sowing campaign in Nalanda'
      },
      {
        id: 'alloc_006',
        productName: 'Biozyme Crop Energizer (Liquid)',
        crop: 'General',
        category: 'Bio-stimulants',
        batchNo: 'LOT-BIO-901',
        unit: 'liters',
        targetRep: 'Abhishek Patel',
        allocatedQty: 120,
        unitPrice: 850,
        allocatedDate: '2026-09-20',
        season: 'Rabi 2026',
        notes: 'Seed treatment and foliar trial kits for progressive farmers'
      },
      {
        id: 'alloc_007',
        productName: 'Biozyme Crop Energizer (Liquid)',
        crop: 'General',
        category: 'Bio-stimulants',
        batchNo: 'LOT-BIO-901',
        unit: 'liters',
        targetRep: 'Ankit Sharma',
        allocatedQty: 100,
        unitPrice: 850,
        allocatedDate: '2026-09-20',
        season: 'Rabi 2026',
        notes: 'Rosera and Bibhutipur demonstration support'
      }
    ];

    this.saveInventoryAllocationsToLocal(defaultAllocations);
    return defaultAllocations;
  }

  saveInventoryAllocationsToLocal(allocations) {
    try {
      localStorage.setItem('tat_inventory_allocations_v1', JSON.stringify(allocations));
    } catch (e) {
      console.error('Error saving inventory allocations local:', e);
    }
  }

  saveInventoryAllocation(allocation) {
    const list = this.getInventoryAllocations();
    const idx = list.findIndex(a => a.id === allocation.id);
    const saved = {
      ...allocation,
      id: allocation.id || `alloc_${Date.now()}`,
      allocatedQty: Number(allocation.allocatedQty) || 0,
      unitPrice: Number(allocation.unitPrice) || 0,
      created_at: allocation.created_at || new Date().toISOString()
    };

    if (idx >= 0) {
      list[idx] = saved;
    } else {
      list.unshift(saved);
    }

    this.saveInventoryAllocationsToLocal(list);
    this.triggerChange();
    return saved;
  }

  deleteInventoryAllocation(id) {
    const list = this.getInventoryAllocations().filter(a => a.id !== id);
    this.saveInventoryAllocationsToLocal(list);
    // Also remove linked movements
    const movements = this.getInventoryMovements().filter(m => m.allocationId !== id);
    this.saveInventoryMovementsToLocal(movements);
    this.triggerChange();
  }

  getInventoryMovements() {
    try {
      const raw = localStorage.getItem('tat_inventory_movements_v1');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.error('Error reading inventory movements:', e);
    }

    // Default Seed Movements (Field Liquidations & Farmer Samples)
    const defaultMovements = [
      {
        id: 'mov_001',
        allocationId: 'alloc_001',
        assistant: 'Ankit Sharma',
        date: '2026-09-24',
        movementType: 'liquidation', // 'liquidation' | 'demo_sample' | 'dealer_transfer' | 'damage_return'
        quantity: 180,
        unit: 'packets',
        recipientName: 'Kisan Krishi Kendra (Rosera)',
        recipientType: 'dealer',
        invoiceOrRefNo: 'INV-KKK-9921',
        realizedPricePerUnit: 650,
        notes: 'Liquidated to counter for active farmer booking. Advance payment received.',
        gps: { lat: 25.7512, lng: 85.9965, isRealGps: true }
      },
      {
        id: 'mov_002',
        allocationId: 'alloc_001',
        assistant: 'Ankit Sharma',
        date: '2026-09-26',
        movementType: 'demo_sample',
        quantity: 20,
        unit: 'packets',
        recipientName: 'Rameshwar Mahto (Village Lead)',
        recipientType: 'farmer',
        invoiceOrRefNo: 'DEMO-RM-04',
        realizedPricePerUnit: 0,
        notes: 'Distributed free 1-acre trial seed packets during farmer meeting at Rosera.',
        gps: { lat: 25.7540, lng: 85.9991, isRealGps: true }
      },
      {
        id: 'mov_003',
        allocationId: 'alloc_003',
        assistant: 'Pawan Jha',
        date: '2026-09-25',
        movementType: 'liquidation',
        quantity: 42,
        unit: 'kg',
        recipientName: 'Maa Tara Fertilizer & Seeds (Begusarai)',
        recipientType: 'dealer',
        invoiceOrRefNo: 'INV-MT-884',
        realizedPricePerUnit: 4800,
        notes: 'Bulk counter purchase for nursery growers around Begusarai hub.',
        gps: { lat: 25.4211, lng: 86.1345, isRealGps: true }
      },
      {
        id: 'mov_004',
        allocationId: 'alloc_002',
        assistant: 'Vikash Kumar',
        date: '2026-09-27',
        movementType: 'liquidation',
        quantity: 150,
        unit: 'packets',
        recipientName: 'Bajrang Beej Bhandar (Muzaffarpur)',
        recipientType: 'dealer',
        invoiceOrRefNo: 'INV-BBB-412',
        realizedPricePerUnit: 650,
        notes: 'Full payment realized at counter delivery.',
        gps: { lat: 26.1205, lng: 85.3902, isRealGps: true }
      },
      {
        id: 'mov_005',
        allocationId: 'alloc_004',
        assistant: 'Ankit Sharma',
        date: '2026-09-28',
        movementType: 'liquidation',
        quantity: 22,
        unit: 'kg',
        recipientName: 'Shri Ram Beej Kendra (Samastipur)',
        recipientType: 'dealer',
        invoiceOrRefNo: 'INV-SRBK-103',
        realizedPricePerUnit: 4800,
        notes: 'Supplied for second batch nursery transplanting.',
        gps: { lat: 25.8645, lng: 85.7820, isRealGps: true }
      }
    ];

    this.saveInventoryMovementsToLocal(defaultMovements);
    return defaultMovements;
  }

  saveInventoryMovementsToLocal(movements) {
    try {
      localStorage.setItem('tat_inventory_movements_v1', JSON.stringify(movements));
    } catch (e) {
      console.error('Error saving inventory movements local:', e);
    }
  }

  recordInventoryMovement(movement) {
    const list = this.getInventoryMovements();
    const newMovement = {
      ...movement,
      id: movement.id || `mov_${Date.now()}`,
      quantity: Number(movement.quantity) || 0,
      realizedPricePerUnit: Number(movement.realizedPricePerUnit) || 0,
      date: movement.date || new Date().toISOString().slice(0, 10),
      created_at: new Date().toISOString()
    };
    list.unshift(newMovement);
    this.saveInventoryMovementsToLocal(list);
    this.triggerChange();
    return newMovement;
  }

  deleteInventoryMovement(id) {
    const list = this.getInventoryMovements().filter(m => m.id !== id);
    this.saveInventoryMovementsToLocal(list);
    this.triggerChange();
  }

  // --- RECONCILED INVENTORY LEDGER CALCULATOR (WITH WEEKLY & HISTORICAL FILTERS) ---
  getInventoryLedgerSummary(filters = {}) {
    const {
      period = 'all', // 'all' | 'this_week' | 'last_week' | 'month' | 'custom'
      startDate = null,
      endDate = null,
      assistant = '',
      product = '',
      includePastAllocations = true
    } = filters;

    let allocations = this.getInventoryAllocations();
    let movements = this.getInventoryMovements();
    const assistants = this.getAssistants();

    // Determine Date Boundaries
    let startFilterDate = startDate;
    let endFilterDate = endDate;

    if (period === 'this_week') {
      const now = new Date();
      const day = now.getDay() || 7; // Monday is 1, Sunday is 7
      const monday = new Date(now);
      monday.setDate(now.getDate() - day + 1);
      const sunday = new Date(now);
      sunday.setDate(now.getDate() - day + 7);
      startFilterDate = monday.toISOString().slice(0, 10);
      endFilterDate = sunday.toISOString().slice(0, 10);
    } else if (period === 'last_week') {
      const now = new Date();
      const day = now.getDay() || 7;
      const lastMonday = new Date(now);
      lastMonday.setDate(now.getDate() - day - 6);
      const lastSunday = new Date(now);
      lastSunday.setDate(now.getDate() - day);
      startFilterDate = lastMonday.toISOString().slice(0, 10);
      endFilterDate = lastSunday.toISOString().slice(0, 10);
    } else if (period === 'month') {
      const now = new Date();
      const past30 = new Date(now.getTime() - 30 * 86400000);
      startFilterDate = past30.toISOString().slice(0, 10);
      endFilterDate = now.toISOString().slice(0, 10);
    }

    // Filter allocations if not including past allocations
    if (!includePastAllocations && startFilterDate) {
      allocations = allocations.filter(a => (!a.allocatedDate || (a.allocatedDate >= startFilterDate && a.allocatedDate <= (endFilterDate || '9999-12-31'))));
    }

    // Filter by assistant if specified
    if (assistant) {
      allocations = allocations.filter(a => a.targetRep === assistant);
      movements = movements.filter(m => m.assistant === assistant);
    }

    // Filter by product if specified
    if (product) {
      allocations = allocations.filter(a => a.productName === product);
    }

    // 1. Calculate per-allocation movement sums (Period achievements vs Cumulative in-hand balance)
    const allocMetrics = allocations.map(a => {
      const allMovesForAlloc = movements.filter(m => m.allocationId === a.id);

      // Period movements within the filtered week/dates
      let periodMoves = allMovesForAlloc;
      if (startFilterDate) {
        periodMoves = periodMoves.filter(m => m.date >= startFilterDate && (!endFilterDate || m.date <= endFilterDate));
      }

      const periodLiquidatedQty = periodMoves.filter(m => m.movementType === 'liquidation' || m.movementType === 'dealer_transfer')
        .reduce((sum, m) => sum + (Number(m.quantity) || 0), 0);
      const periodSampleQty = periodMoves.filter(m => m.movementType === 'demo_sample')
        .reduce((sum, m) => sum + (Number(m.quantity) || 0), 0);
      const periodDamageQty = periodMoves.filter(m => m.movementType === 'damage_return')
        .reduce((sum, m) => sum + (Number(m.quantity) || 0), 0);
      const periodRevenue = periodMoves.reduce((sum, m) => sum + ((Number(m.quantity) || 0) * (Number(m.realizedPricePerUnit) || Number(a.unitPrice) || 0)), 0);

      // Cumulative movements up to endFilterDate for true remaining in-hand balance
      let cumulativeMoves = allMovesForAlloc;
      if (endFilterDate) {
        cumulativeMoves = cumulativeMoves.filter(m => m.date <= endFilterDate);
      }
      const totalOutQty = cumulativeMoves.reduce((sum, m) => sum + (Number(m.quantity) || 0), 0);
      const balanceQty = Math.max(0, a.allocatedQty - totalOutQty);
      const liquidationPct = a.allocatedQty > 0 ? Math.round((totalOutQty / a.allocatedQty) * 100) : 0;

      return {
        ...a,
        liquidatedQty: periodLiquidatedQty,
        sampleQty: periodSampleQty,
        damageQty: periodDamageQty,
        totalOutQty,
        balanceQty,
        liquidationPct,
        realizedRevenue: periodRevenue,
        movements: periodMoves,
        periodMovesCount: periodMoves.length
      };
    });

    // 2. Aggregate Product-wise Totals
    const productMap = new Map();
    allocMetrics.forEach(a => {
      const key = `${a.productName}__${a.unit}`;
      if (!productMap.has(key)) {
        productMap.set(key, {
          productName: a.productName,
          crop: a.crop,
          category: a.category,
          unit: a.unit,
          unitPrice: a.unitPrice,
          totalAllocated: 0,
          totalLiquidated: 0,
          totalSampleDistributed: 0,
          totalDamaged: 0,
          totalBalance: 0,
          totalRealizedValue: 0,
          allocationsCount: 0
        });
      }
      const p = productMap.get(key);
      p.totalAllocated += a.allocatedQty;
      p.totalLiquidated += a.liquidatedQty;
      p.totalSampleDistributed += a.sampleQty;
      p.totalDamaged += a.damageQty;
      p.totalBalance += a.balanceQty;
      p.totalRealizedValue += a.realizedRevenue;
      p.allocationsCount += 1;
    });

    const productSummaries = Array.from(productMap.values()).map(p => ({
      ...p,
      liquidationPct: p.totalAllocated > 0 ? Math.round(((p.totalLiquidated + p.totalSampleDistributed) / p.totalAllocated) * 100) : 0
    }));

    // 3. Aggregate Assistant-wise Totals (Supports ANY dynamic number of assistants!)
    const relevantAssistants = assistant ? assistants.filter(a => a.name === assistant) : assistants;
    const assistantSummaries = relevantAssistants.map(asst => {
      const asstAllocs = allocMetrics.filter(a => a.targetRep === asst.name);
      const asstMoves = movements.filter(m => m.assistant === asst.name);

      const totalAllocatedUnits = asstAllocs.reduce((sum, a) => sum + a.allocatedQty, 0);
      const totalLiquidatedUnits = asstAllocs.reduce((sum, a) => sum + a.liquidatedQty, 0);
      const totalSampleUnits = asstAllocs.reduce((sum, a) => sum + a.sampleQty, 0);
      const totalBalanceUnits = asstAllocs.reduce((sum, a) => sum + a.balanceQty, 0);
      const totalRealizedRevenue = asstAllocs.reduce((sum, a) => sum + a.realizedRevenue, 0);
      const avgLiquidationPct = asstAllocs.length > 0 
        ? Math.round(asstAllocs.reduce((sum, a) => sum + a.liquidationPct, 0) / asstAllocs.length) 
        : 0;

      return {
        assistant: asst.name,
        hq: asst.hq,
        district: asst.district,
        allocations: asstAllocs,
        movements: asstMoves,
        totalAllocatedUnits,
        totalLiquidatedUnits,
        totalSampleUnits,
        totalBalanceUnits,
        totalRealizedRevenue,
        avgLiquidationPct
      };
    });

    // 4. Overall Master High-level Totals
    const totalAllocatedVal = allocations.reduce((sum, a) => sum + (a.allocatedQty * (a.unitPrice || 0)), 0);
    const totalRealizedVal = allocMetrics.reduce((sum, a) => sum + a.realizedRevenue, 0);
    const overallLiquidationPct = totalAllocatedVal > 0 ? Math.round((totalRealizedVal / totalAllocatedVal) * 100) : 0;

    let periodLabel = 'All Time (Full Season)';
    if (period === 'this_week') periodLabel = `⚡ Current Week (${startFilterDate} to ${endFilterDate})`;
    else if (period === 'last_week') periodLabel = `⏮️ Previous Week (${startFilterDate} to ${endFilterDate})`;
    else if (period === 'month') periodLabel = `📆 Past 30 Days (${startFilterDate} to ${endFilterDate})`;
    else if (period === 'custom') periodLabel = `🔍 Custom (${startFilterDate || 'Start'} to ${endFilterDate || 'Present'})`;

    return {
      allocMetrics,
      productSummaries,
      assistantSummaries,
      totalAllocatedVal,
      totalRealizedVal,
      overallLiquidationPct,
      totalAllocationsCount: allocations.length,
      totalMovementsCount: movements.length,
      filterMeta: {
        period,
        startFilterDate,
        endFilterDate,
        assistant,
        product,
        includePastAllocations,
        periodLabel
      }
    };
  }

  getAssistantInventoryLedger(assistantName) {
    const summary = this.getInventoryLedgerSummary();
    const asstSummary = summary.assistantSummaries.find(a => a.assistant === assistantName);
    return asstSummary || {
      assistant: assistantName,
      allocations: [],
      movements: [],
      totalAllocatedUnits: 0,
      totalLiquidatedUnits: 0,
      totalSampleUnits: 0,
      totalBalanceUnits: 0,
      totalRealizedRevenue: 0,
      avgLiquidationPct: 0
    };
  }

  // ========================================================
  // 🗺️ SMART TOUR BEAT PLANS & GPS ROUTE OPTIMIZATION
  // ========================================================

  getTourBeatPlans() {
    try {
      const raw = localStorage.getItem('tat_tour_beats_v1');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.error('Error reading tour beats:', e);
    }
    const defaultBeats = this.generateDefaultTourBeats();
    this.saveTourBeatPlansToLocal(defaultBeats);
    return defaultBeats;
  }

  saveTourBeatPlansToLocal(beats) {
    try {
      localStorage.setItem('tat_tour_beats_v1', JSON.stringify(beats));
    } catch (e) {
      console.error('Error saving tour beats:', e);
    }
  }

  getTourBeatPlan(assistantName, dateStr) {
    const list = this.getTourBeatPlans();
    return list.find(b => b.assistant === assistantName && b.date === dateStr) || null;
  }

  saveTourBeatPlan(plan, syncToCloud = true) {
    const list = this.getTourBeatPlans();
    const idx = list.findIndex(b => b.id === plan.id || (b.assistant === plan.assistant && b.date === plan.date));
    if (idx >= 0) {
      list[idx] = { ...list[idx], ...plan, updatedAt: new Date().toISOString() };
    } else {
      list.unshift({ ...plan, createdAt: new Date().toISOString() });
    }
    this.saveTourBeatPlansToLocal(list);
    window.dispatchEvent(new CustomEvent('tracker:tourBeatChanged', { detail: { plan } }));
    this.triggerChange();

    if (syncToCloud && supabaseService.isReady && supabaseService.client) {
      supabaseService.client.from('tour_beat_plans').upsert(plan).then(({ error }) => {
        if (error) console.warn('Supabase tour_beat_plans sync note:', error.message);
      }).catch(e => console.warn('Supabase beat sync error:', e));
    }
    return plan;
  }

  generateDefaultTourBeats() {
    const today = new Date().toISOString().split('T')[0];
    return [
      {
        id: 'beat_001_westpatna',
        assistant: 'Assistant 1 (West Patna)',
        date: today,
        block: 'Bihta',
        district: 'Patna',
        originName: 'Bihta Station HQ',
        originCoords: { lat: 25.564, lng: 84.868 },
        totalKm: 38.6,
        totalDrivingMinutes: 72,
        totalVisitMinutes: 125,
        totalShiftMinutes: 197,
        status: 'In Progress',
        googleMapsUrl: 'https://www.google.com/maps/dir/?api=1&origin=25.564,84.868&destination=25.564,84.868&travelmode=driving',
        stops: [
          { id: 'ret_001', retailer: 'Kisan Krishi Kendra (Bihta Bazar)', block: 'Bihta', district: 'Patna', lat: 25.567, lng: 84.864, isCompleted: true, checkInTime: '10:15 AM', sequence: 1 },
          { id: 'ret_002', retailer: 'Maa Vaishno Beej Bhandar', block: 'Bihta', district: 'Patna', lat: 25.571, lng: 84.872, isCompleted: true, checkInTime: '11:05 AM', sequence: 2 },
          { id: 'ret_003', retailer: 'Patliputra Agro Center', block: 'Bihta', district: 'Patna', lat: 25.558, lng: 84.855, isCompleted: false, checkInTime: null, sequence: 3 },
          { id: 'ret_004', retailer: 'Shiv Krishi Seva Kendra', block: 'Maner', district: 'Patna', lat: 25.644, lng: 84.877, isCompleted: false, checkInTime: null, sequence: 4 },
          { id: 'ret_005', retailer: 'Annapurna Khad Beej', block: 'Maner', district: 'Patna', lat: 25.639, lng: 84.882, isCompleted: false, checkInTime: null, sequence: 5 }
        ],
        createdAt: new Date().toISOString()
      },
      {
        id: 'beat_002_westvaishali',
        assistant: 'Assistant 4 (West Vaishali)',
        date: today,
        block: 'Hajipur',
        district: 'Vaishali',
        originName: 'Hajipur Station HQ',
        originCoords: { lat: 25.685, lng: 85.214 },
        totalKm: 32.4,
        totalDrivingMinutes: 65,
        totalVisitMinutes: 100,
        totalShiftMinutes: 165,
        status: 'Planned',
        googleMapsUrl: 'https://www.google.com/maps/dir/?api=1&origin=25.685,85.214&destination=25.685,85.214&travelmode=driving',
        stops: [
          { id: 'ret_006', retailer: 'Vaishali Kisan Mandi', block: 'Hajipur', district: 'Vaishali', lat: 25.688, lng: 85.219, isCompleted: false, checkInTime: null, sequence: 1 },
          { id: 'ret_007', retailer: 'Bihar Agro Agencies', block: 'Hajipur', district: 'Vaishali', lat: 25.692, lng: 85.208, isCompleted: false, checkInTime: null, sequence: 2 },
          { id: 'ret_008', retailer: 'Bajrang Beej Bhandar', block: 'Lalganj', district: 'Vaishali', lat: 25.867, lng: 85.178, isCompleted: false, checkInTime: null, sequence: 3 },
          { id: 'ret_009', retailer: 'Gramin Khad Kendra', block: 'Lalganj', district: 'Vaishali', lat: 25.871, lng: 85.174, isCompleted: false, checkInTime: null, sequence: 4 }
        ],
        createdAt: new Date().toISOString()
      }
    ];
  }

  // ========================================================
  // 💰 TA/DA MILEAGE CLAIMS & AUDIT HUB
  // ========================================================

  getTadaClaims(filter = {}) {
    try {
      const raw = localStorage.getItem('tat_tada_claims_v1');
      let claims = [];
      if (raw) {
        claims = JSON.parse(raw);
      }
      if (!claims || claims.length === 0) {
        claims = this.generateDefaultTadaClaims();
        this.saveTadaClaimsToLocal(claims);
      }

      let filtered = [...claims];
      if (filter.assistant && filter.assistant !== 'ALL') {
        filtered = filtered.filter(c => c.assistant === filter.assistant);
      }
      if (filter.status && filter.status !== 'all') {
        filtered = filtered.filter(c => c.status.toLowerCase() === filter.status.toLowerCase());
      }
      if (filter.startDate) {
        filtered = filtered.filter(c => c.date >= filter.startDate);
      }
      if (filter.endDate) {
        filtered = filtered.filter(c => c.date <= filter.endDate);
      }
      return filtered;
    } catch (e) {
      console.error('Error reading TADA claims:', e);
      return [];
    }
  }

  saveTadaClaimsToLocal(claims) {
    try {
      localStorage.setItem('tat_tada_claims_v1', JSON.stringify(claims));
    } catch (e) {
      console.error('Error saving TADA claims local:', e);
    }
  }

  getTadaClaim(id) {
    const list = this.getTadaClaims();
    return list.find(c => c.id === id) || null;
  }

  saveTadaClaim(claim, syncToCloud = true) {
    // Offload attached bills with large base64 dataUrls to IndexedDB
    if (claim.attachedBills && Array.isArray(claim.attachedBills)) {
      claim.attachedBills.forEach(b => {
        if (b.dataUrl && b.dataUrl.length > 500) {
          idbStorage.saveMedia({
            id: b.id,
            entity: 'tada_bill',
            entityId: claim.id,
            category: b.category,
            name: b.name,
            amount: b.amount,
            dataUrl: b.dataUrl
          }).catch(e => console.warn('Idb bill save note:', e));
        }
      });
    }

    const cleanClaim = {
      ...claim,
      // For localStorage, keep bill metadata and lightweight thumbnails/placeholders
      attachedBills: (claim.attachedBills || []).map(b => ({
        id: b.id,
        name: b.name,
        category: b.category,
        amount: b.amount,
        notes: b.notes,
        uploadedAt: b.uploadedAt,
        isStoredInIdb: true
      }))
    };

    const list = this.getTadaClaims();
    const idx = list.findIndex(c => c.id === cleanClaim.id);
    if (idx >= 0) {
      list[idx] = { ...list[idx], ...cleanClaim, updatedAt: new Date().toISOString() };
    } else {
      list.unshift({ ...cleanClaim, createdAt: new Date().toISOString() });
    }
    this.saveTadaClaimsToLocal(list);
    window.dispatchEvent(new CustomEvent('tracker:tadaClaimChanged', { detail: { claim: cleanClaim } }));
    this.triggerChange();

    // Optimistically enqueue mutation to sync queue with exponential backoff
    if (syncToCloud) {
      syncQueue.enqueue('tada_claims', 'upsert', cleanClaim).catch(e => console.warn('Sync queue tada warning:', e));
    }
    return cleanClaim;
  }

  updateTadaClaimStatus(claimId, updateData, syncToCloud = true) {
    const list = this.getTadaClaims();
    const idx = list.findIndex(c => c.id === claimId);
    if (idx >= 0) {
      list[idx] = {
        ...list[idx],
        ...updateData,
        updatedAt: new Date().toISOString()
      };
      this.saveTadaClaimsToLocal(list);
      window.dispatchEvent(new CustomEvent('tracker:tadaClaimChanged', { detail: { claim: list[idx] } }));
      this.triggerChange();

      if (syncToCloud && supabaseService.isReady && supabaseService.client) {
        supabaseService.client.from('tada_claims').update(updateData).eq('id', claimId).then(({ error }) => {
          if (error) console.warn('Supabase tada status update note:', error.message);
        }).catch(e => console.warn('Supabase tada update error:', e));
      }
      return list[idx];
    }
    return null;
  }

  // ========================================================
  // ⚙️ TA/DA POLICY & RATE MATRIX CONFIGURATION
  // ========================================================

  getTadaPolicyConfig() {
    try {
      const raw = localStorage.getItem('tat_tada_policy_config_v1');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          return {
            bikeFuelRatePerKm: parsed.bikeFuelRatePerKm !== undefined ? Number(parsed.bikeFuelRatePerKm) : 4.50,
            carFuelRatePerKm: parsed.carFuelRatePerKm !== undefined ? Number(parsed.carFuelRatePerKm) : 9.50,
            daFullDayAmount: parsed.daFullDayAmount !== undefined ? Number(parsed.daFullDayAmount) : 250,
            daHalfDayAmount: parsed.daHalfDayAmount !== undefined ? Number(parsed.daHalfDayAmount) : 150,
            minVisitsForFullDa: parsed.minVisitsForFullDa !== undefined ? Number(parsed.minVisitsForFullDa) : 4,
            outstationNightAllowance: parsed.outstationNightAllowance !== undefined ? Number(parsed.outstationNightAllowance) : 800,
            maxIncidentalWithoutReceipt: parsed.maxIncidentalWithoutReceipt !== undefined ? Number(parsed.maxIncidentalWithoutReceipt) : 150,
            assistantVehicleModes: parsed.assistantVehicleModes || {
              "Assistant 1 (West Patna)": "Bike",
              "Assistant 2 (Central/South Patna)": "Bike",
              "Assistant 3 (East Patna)": "Car",
              "Assistant 4 (West Vaishali)": "Bike",
              "Assistant 5 (East Vaishali)": "Bike",
              "Assistant 6 (Rohtas)": "Car",
              "Assistant 7 (Kaimur)": "Bike",
              "Assistant 8 (Bhojpur & Buxar)": "Bike"
            }
          };
        }
      }
    } catch(e) {
      console.error('Error reading TADA policy config:', e);
    }
    const defaultConfig = {
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
    };
    this.saveTadaPolicyConfig(defaultConfig);
    return defaultConfig;
  }

  saveTadaPolicyConfig(config, syncToCloud = true) {
    try {
      localStorage.setItem('tat_tada_policy_config_v1', JSON.stringify(config));
      window.dispatchEvent(new CustomEvent('tracker:tadaPolicyChanged', { detail: { config } }));
      if (syncToCloud && supabaseService.isReady && supabaseService.client) {
        supabaseService.client.from('tada_policy_config').upsert({ id: 'bihar_sales_policy', ...config }).then(({ error }) => {
          if (error) console.warn('Supabase tada policy sync:', error.message);
        }).catch(e => console.warn(e));
      }
    } catch(e) {
      console.error('Error saving TADA policy:', e);
    }
  }

  getAssistantVehicleMode(assistantName) {
    const config = this.getTadaPolicyConfig();
    return config.assistantVehicleModes?.[assistantName] || 'Bike';
  }

  // ===========================================================================
  // 🚨 FLEET SPEED GOVERNANCE & TELEMETRY BREACH MONITORING
  // ===========================================================================

  getSpeedPolicyConfig() {
    try {
      const raw = localStorage.getItem('tat_speed_policy_config_v1');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          return {
            bikeThresholdKmH: parsed.bikeThresholdKmH !== undefined ? Number(parsed.bikeThresholdKmH) : 60,
            carThresholdKmH: parsed.carThresholdKmH !== undefined ? Number(parsed.carThresholdKmH) : 80,
            speedMonitoringActive: parsed.speedMonitoringActive !== undefined ? Boolean(parsed.speedMonitoringActive) : true,
            cooldownSeconds: parsed.cooldownSeconds !== undefined ? Number(parsed.cooldownSeconds) : 60,
            warningNoticeTemplate: parsed.warningNoticeTemplate || "OFFICIAL ROAD SAFETY NOTICE: Vehicle telemetry logged your speed at {speed} km/h, exceeding the mandatory company threshold of {limit} km/h for {vehicle} in {block}, {district} on {date} at {time}. Over-speeding is a direct safety hazard and violates field travel compliance. Please moderate your transit speed immediately."
          };
        }
      }
    } catch(e) {
      console.error('Error reading speed policy config:', e);
    }
    const defaultConfig = {
      bikeThresholdKmH: 60, // 2-wheeler speed threshold
      carThresholdKmH: 80,  // 4-wheeler speed threshold
      speedMonitoringActive: true,
      cooldownSeconds: 60,
      warningNoticeTemplate: "OFFICIAL ROAD SAFETY NOTICE: Vehicle telemetry logged your speed at {speed} km/h, exceeding the mandatory company threshold of {limit} km/h for {vehicle} in {block}, {district} on {date} at {time}. Over-speeding is a direct safety hazard and violates field travel compliance. Please moderate your transit speed immediately."
    };
    this.saveSpeedPolicyConfig(defaultConfig);
    return defaultConfig;
  }

  saveSpeedPolicyConfig(config, syncToCloud = true) {
    try {
      localStorage.setItem('tat_speed_policy_config_v1', JSON.stringify(config));
      window.dispatchEvent(new CustomEvent('tracker:speedPolicyChanged', { detail: { config } }));
      if (syncToCloud && supabaseService.isReady && supabaseService.client) {
        supabaseService.client.from('tada_policy_config').upsert({ id: 'speed_governance_policy', ...config }).then(({ error }) => {
          if (error) console.warn('Supabase speed policy sync note:', error.message);
        }).catch(e => console.warn(e));
      }
    } catch(e) {
      console.error('Error saving speed policy:', e);
    }
  }

  getSpeedBreachLogs(filter = {}) {
    try {
      const raw = localStorage.getItem('tat_speed_breach_logs_v1');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          let list = parsed;
          if (filter.rep && filter.rep !== 'ALL') {
            list = list.filter(l => l.rep === filter.rep);
          }
          if (filter.vehicleMode && filter.vehicleMode !== 'all') {
            list = list.filter(l => l.vehicleMode === filter.vehicleMode);
          }
          if (filter.warningStatus === 'sent') {
            list = list.filter(l => l.warningSent === true);
          } else if (filter.warningStatus === 'pending') {
            list = list.filter(l => !l.warningSent);
          }
          if (filter.date) {
            list = list.filter(l => l.date === filter.date);
          }
          return list.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        }
      }
    } catch(e) {
      console.error('Error reading speed breach logs:', e);
    }
    const defaults = this.generateDefaultSpeedBreaches();
    this.saveSpeedBreachLogsToLocal(defaults);
    return defaults;
  }

  saveSpeedBreachLogsToLocal(logs) {
    try {
      localStorage.setItem('tat_speed_breach_logs_v1', JSON.stringify(logs));
      window.dispatchEvent(new CustomEvent('tracker:speedBreachChanged', { detail: { logs } }));
    } catch(e) {
      console.error('Error saving speed breach logs:', e);
    }
  }

  saveSpeedBreachLog(breach, syncToCloud = true) {
    const list = this.getSpeedBreachLogs();
    const idx = list.findIndex(l => l.id === breach.id);
    if (idx >= 0) {
      list[idx] = { ...list[idx], ...breach, updatedAt: new Date().toISOString() };
    } else {
      list.unshift({ ...breach, createdAt: new Date().toISOString() });
    }
    this.saveSpeedBreachLogsToLocal(list);
    window.dispatchEvent(new CustomEvent('tracker:speedBreachLogged', { detail: { breach } }));

    if (syncToCloud && supabaseService.isReady && supabaseService.client) {
      supabaseService.client.from('speed_breach_logs').upsert(breach).then(({ error }) => {
        if (error) console.warn('Supabase speed breach sync note:', error.message);
      }).catch(e => console.warn(e));
    }
    return breach;
  }

  /**
   * Evaluates telemetry speed and AUTOMATICALLY LOGS ONLY WHEN THRESHOLD IS BREACHED
   */
  recordSpeedBreachIfViolated(data) {
    const policy = this.getSpeedPolicyConfig();
    if (!policy.speedMonitoringActive) return { breached: false, reason: 'Monitoring inactive' };

    const rep = data.rep || 'Unknown Rep';
    const vehicleMode = data.vehicleMode || this.getAssistantVehicleMode(rep);
    const speedKmH = Number(data.speedKmH) || 0;
    const threshold = vehicleMode === 'Car' ? policy.carThresholdKmH : policy.bikeThresholdKmH;

    // CRITICAL: Automatically captured ONLY IF they breach the threshold level!
    if (speedKmH <= threshold) {
      return { breached: false, speedKmH, threshold };
    }

    // Cooldown check (prevent logging multiple alerts within cooldown window for the same rep)
    const recentLogs = this.getSpeedBreachLogs();
    const lastBreach = recentLogs.find(l => l.rep === rep);
    const now = Date.now();
    const cooldownMs = (policy.cooldownSeconds || 60) * 1000;
    if (lastBreach && (now - lastBreach.timestamp) < cooldownMs) {
      return { breached: true, throttled: true, recordedSpeedKmH: speedKmH, thresholdSpeedKmH: threshold };
    }

    const excessKmH = Math.round((speedKmH - threshold) * 10) / 10;
    const severity = excessKmH > 15 ? 'High Hazard Breach' : 'Moderate Breach';
    const d = new Date();
    const timeStr = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const dateStr = this.getISTDateStr(d);

    const breachRecord = {
      id: `spd_${String(rep).toLowerCase().replace(/[^a-z0-9]/g, '_')}_${now}`,
      rep,
      vehicleMode,
      recordedSpeedKmH: Math.round(speedKmH * 10) / 10,
      thresholdSpeedKmH: threshold,
      excessKmH,
      severity,
      lat: data.lat || 25.564,
      lng: data.lng || 84.868,
      block: data.block || 'Transit Corridor',
      district: data.district || 'Bihar',
      locationName: data.locationName || `${data.block || 'Highway'} Sector`,
      timestamp: now,
      date: dateStr,
      time: timeStr,
      warningSent: false,
      warningNotice: null,
      warningSentAt: null
    };

    this.saveSpeedBreachLog(breachRecord);
    return { breached: true, breach: breachRecord };
  }

  sendSpeedWarningNotice(breachId, customNotice = null) {
    const list = this.getSpeedBreachLogs();
    const breach = list.find(l => l.id === breachId);
    if (!breach) return { success: false, error: 'Breach log not found' };

    const policy = this.getSpeedPolicyConfig();
    const noticeText = customNotice || policy.warningNoticeTemplate
      .replace('{speed}', breach.recordedSpeedKmH)
      .replace('{limit}', breach.thresholdSpeedKmH)
      .replace('{excess}', breach.excessKmH)
      .replace('{vehicle}', breach.vehicleMode === 'Car' ? 'Four-Wheeler' : 'Two-Wheeler')
      .replace('{block}', breach.block)
      .replace('{district}', breach.district)
      .replace('{date}', breach.date)
      .replace('{time}', breach.time);

    const now = new Date().toISOString();
    breach.warningSent = true;
    breach.warningNotice = noticeText;
    breach.warningSentAt = now;

    this.saveSpeedBreachLog(breach);

    // Send push notification directly to the rep station
    this.sendAssistantNotification(breach.rep, {
      title: `⚠️ Formal Safety Notice: Speed Limit Exceeded (${breach.recordedSpeedKmH} km/h)`,
      message: noticeText,
      type: 'warning',
      breachId: breach.id
    });

    // Save to rep station persistent warnings box
    try {
      const wRaw = localStorage.getItem('tat_rep_warning_notices_v1');
      const wList = wRaw ? JSON.parse(wRaw) : [];
      wList.unshift({
        id: `warn_${breach.id}`,
        rep: breach.rep,
        breachId: breach.id,
        title: '⚠️ Formal Fleet Safety & Over-Speeding Warning',
        noticeText,
        sentAt: now,
        speedRecorded: breach.recordedSpeedKmH,
        threshold: breach.thresholdSpeedKmH,
        excess: breach.excessKmH,
        vehicleMode: breach.vehicleMode,
        location: `${breach.block}, ${breach.district}`,
        acknowledged: false
      });
      localStorage.setItem('tat_rep_warning_notices_v1', JSON.stringify(wList));
    } catch(e) {}

    return { success: true, breach, noticeText };
  }

  getRepPendingSpeedWarnings(repName) {
    try {
      const wRaw = localStorage.getItem('tat_rep_warning_notices_v1');
      if (wRaw) {
        const list = JSON.parse(wRaw);
        return list.filter(w => w.rep === repName && !w.acknowledged);
      }
    } catch(e) {}
    return [];
  }

  acknowledgeSpeedWarning(warningId) {
    try {
      const wRaw = localStorage.getItem('tat_rep_warning_notices_v1');
      if (wRaw) {
        const list = JSON.parse(wRaw);
        const item = list.find(w => w.id === warningId);
        if (item) {
          item.acknowledged = true;
          item.acknowledgedAt = new Date().toISOString();
          localStorage.setItem('tat_rep_warning_notices_v1', JSON.stringify(list));
        }
      }
    } catch(e) {}
  }

  generateDefaultSpeedBreaches() {
    const today = this.getISTDateStr();
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    const twoDaysAgo = new Date(Date.now() - 172800000).toISOString().split('T')[0];

    return [
      {
        id: 'spd_001_eastpatna',
        rep: 'Assistant 3 (East Patna)',
        vehicleMode: 'Car',
        recordedSpeedKmH: 94.5,
        thresholdSpeedKmH: 80.0,
        excessKmH: 14.5,
        severity: 'Moderate Breach',
        lat: 25.460,
        lng: 85.535,
        block: 'Bakhtiarpur',
        district: 'Patna',
        locationName: 'NH-31 Highway Stretch (Bakhtiarpur-Barh bypass)',
        timestamp: Date.now() - 3600000 * 3,
        date: today,
        time: '11:15 AM',
        warningSent: false,
        warningNotice: null,
        warningSentAt: null
      },
      {
        id: 'spd_002_westvaishali',
        rep: 'Assistant 4 (West Vaishali)',
        vehicleMode: 'Bike',
        recordedSpeedKmH: 78.2,
        thresholdSpeedKmH: 60.0,
        excessKmH: 18.2,
        severity: 'High Hazard Breach',
        lat: 25.867,
        lng: 85.178,
        block: 'Lalganj',
        district: 'Vaishali',
        locationName: 'SH-74 Hajipur-Lalganj Main Corridor',
        timestamp: Date.now() - 3600000 * 18,
        date: yesterday,
        time: '04:45 PM',
        warningSent: true,
        warningNotice: "OFFICIAL ROAD SAFETY NOTICE: Vehicle telemetry logged your speed at 78.2 km/h, exceeding the mandatory company threshold of 60 km/h for Two-Wheeler in Lalganj, Vaishali. Drive safely and keep speed under 60 km/h.",
        warningSentAt: new Date(Date.now() - 3600000 * 16).toISOString()
      },
      {
        id: 'spd_003_westpatna',
        rep: 'Assistant 1 (West Patna)',
        vehicleMode: 'Bike',
        recordedSpeedKmH: 73.0,
        thresholdSpeedKmH: 60.0,
        excessKmH: 13.0,
        severity: 'Moderate Breach',
        lat: 25.564,
        lng: 84.868,
        block: 'Bihta',
        district: 'Patna',
        locationName: 'Bihta-Danapur State Highway',
        timestamp: Date.now() - 3600000 * 42,
        date: twoDaysAgo,
        time: '01:20 PM',
        warningSent: false,
        warningNotice: null,
        warningSentAt: null
      }
    ];
  }


  calculateTadaPreview(assistantName, dateStr, vehicleModeOverride = null) {
    const policy = this.getTadaPolicyConfig();
    const assistants = this.getAssistants();
    const repInfo = assistants.find(a => a.name === assistantName) || {
      name: assistantName,
      hq: 'Bihta',
      district: 'Patna'
    };

    // Determine Vehicle Mode
    const defaultMode = this.getAssistantVehicleMode(assistantName);
    const vehicleMode = vehicleModeOverride || defaultMode;
    const fuelRate = vehicleMode === 'Car' ? policy.carFuelRatePerKm : policy.bikeFuelRatePerKm;

    // Find HQ centroid
    const hqBlock = BIHAR_BLOCKS.find(b => b.block.toLowerCase() === (repInfo.hq || '').toLowerCase()) || BIHAR_BLOCKS[0];
    const hqCoords = { lat: hqBlock.lat, lng: hqBlock.lng, name: `${repInfo.hq} HQ` };

    // Find all verified check-ins for this assistant on this date
    const allLogs = this.getCheckInLogs();
    const dayLogs = allLogs.filter(l => l.rep === assistantName && (l.date === dateStr || l.checkInDate === dateStr));

    // Calculate verified journey
    const journey = calculateCheckInJourneyKm(dayLogs, hqCoords);

    let verifiedKm = journey.totalRoadKm;

    // If no check-ins yet today, check if there's a scheduled beat plan
    const beatPlan = this.getTourBeatPlan(assistantName, dateStr);
    let plannedKm = beatPlan ? beatPlan.totalKm : 0;
    if (verifiedKm === 0 && plannedKm > 0) {
      verifiedKm = plannedKm;
    }

    const verifiedStops = dayLogs.length > 0 ? dayLogs.length : (beatPlan?.stops?.length || 0);

    // Daily Allowance rule
    let daAmount = 0;
    if (verifiedStops >= policy.minVisitsForFullDa) daAmount = policy.daFullDayAmount;
    else if (verifiedStops >= 1) daAmount = policy.daHalfDayAmount;

    // Outstation check
    const isOutstation = dayLogs.some(l => l.district && l.district.toLowerCase() !== (repInfo.district || '').toLowerCase());
    const outstationAmount = isOutstation ? policy.outstationNightAllowance : 0;

    const fuelAmount = Math.round(verifiedKm * fuelRate * 10) / 10;
    const totalAmount = Math.round((fuelAmount + daAmount + outstationAmount) * 10) / 10;

    const auditFlags = [];
    if (dayLogs.length >= policy.minVisitsForFullDa) {
      auditFlags.push(`🟢 Full-Day GPS Route Verified (${dayLogs.length}+ Counters Checked-In)`);
    } else if (dayLogs.length > 0) {
      auditFlags.push(`ℹ️ Partial Field Activity (${dayLogs.length} Checked-In Counters)`);
    } else {
      auditFlags.push('⚠️ No Live GPS Check-Ins Found For This Date');
    }

    if (isOutstation) {
      auditFlags.push(`🚀 Outstation Allowance Triggered (₹${policy.outstationNightAllowance} Night Stay Verified)`);
    }

    auditFlags.push(`🚗 Transit Mode: ${vehicleMode} (Rate: ₹${fuelRate}/km)`);

    return {
      assistant: assistantName,
      date: dateStr,
      hq: repInfo.hq,
      district: repInfo.district,
      hqCoords,
      journeyLegs: journey.legs,
      verifiedStops,
      gpsVerifiedKm: verifiedKm,
      claimedKm: verifiedKm,
      vehicleMode,
      bikeFuelRate: policy.bikeFuelRatePerKm,
      carFuelRate: policy.carFuelRatePerKm,
      fuelRate,
      fuelAmount,
      daAmount,
      outstationAmount,
      incidentalAmount: 0,
      incidentalNotes: '',
      totalAmount,
      auditFlags,
      dayLogs,
      policy
    };
  }

  generateDefaultTadaClaims() {
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    const twoDaysAgo = new Date(Date.now() - 172800000).toISOString().split('T')[0];

    const makeSampleBillSvg = (vendor, category, amount, dateStr, billNo) => {
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="520" viewBox="0 0 400 520" fill="none">
        <rect width="400" height="520" rx="8" fill="#FFFDF8"/>
        <rect x="15" y="15" width="370" height="490" rx="6" stroke="#D1D5DB" stroke-width="2" stroke-dasharray="4 4" fill="none"/>
        <text x="200" y="55" font-family="sans-serif" font-weight="900" font-size="18" fill="#1E293B" text-anchor="middle">${vendor.toUpperCase()}</text>
        <text x="200" y="75" font-family="sans-serif" font-size="12" fill="#64748B" text-anchor="middle">Official GST Tax Invoice / Cash Memo</text>
        <line x1="30" y1="95" x2="370" y2="95" stroke="#CBD5E1" stroke-width="1.5"/>
        <text x="40" y="125" font-family="sans-serif" font-size="12" fill="#475569">Bill No: <strong>#${billNo}</strong></text>
        <text x="360" y="125" font-family="sans-serif" font-size="12" fill="#475569" text-anchor="end">Date: <strong>${dateStr}</strong></text>
        <text x="40" y="150" font-family="sans-serif" font-size="12" fill="#475569">Category: <strong>${category}</strong></text>
        <text x="360" y="150" font-family="sans-serif" font-size="12" fill="#16A34A" text-anchor="end">✓ VERIFIED VENDOR</text>
        <rect x="35" y="175" width="330" height="180" rx="4" fill="#F8FAFC" stroke="#E2E8F0"/>
        <text x="50" y="210" font-family="sans-serif" font-size="13" font-weight="700" fill="#334155">Description</text>
        <text x="345" y="210" font-family="sans-serif" font-size="13" font-weight="700" fill="#334155" text-anchor="end">Amount (INR)</text>
        <line x1="50" y1="225" x2="350" y2="225" stroke="#CBD5E1"/>
        <text x="50" y="255" font-family="sans-serif" font-size="12" fill="#475569">${category} Expense Charges</text>
        <text x="345" y="255" font-family="sans-serif" font-size="12" font-weight="700" fill="#1E293B" text-anchor="end">₹${amount}.00</text>
        <text x="50" y="285" font-family="sans-serif" font-size="11" fill="#64748B">Central & State GST (Tax Paid)</text>
        <text x="345" y="285" font-family="sans-serif" font-size="11" fill="#64748B" text-anchor="end">Included</text>
        <line x1="50" y1="315" x2="350" y2="315" stroke="#CBD5E1"/>
        <text x="50" y="340" font-family="sans-serif" font-size="14" font-weight="800" fill="#0F172A">TOTAL BILLED</text>
        <text x="345" y="340" font-family="sans-serif" font-size="16" font-weight="900" fill="#047857" text-anchor="end">₹${amount}.00</text>
        <g transform="translate(140, 385) rotate(-8)">
          <rect width="130" height="42" rx="4" stroke="#DC2626" stroke-width="2" fill="none"/>
          <text x="65" y="27" font-family="sans-serif" font-size="14" font-weight="900" fill="#DC2626" text-anchor="middle">PAID / CASH</text>
        </g>
        <text x="200" y="475" font-family="sans-serif" font-size="10.5" fill="#94A3B8" text-anchor="middle">Verified on-site for Bihar AgTech field allowance claim</text>
      </svg>`;
      return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    };

    return [
      {
        id: 'tada_001_westpatna',
        assistant: 'Assistant 1 (West Patna)',
        hq: 'Bihta',
        district: 'Patna',
        date: yesterday,
        vehicleMode: 'Bike',
        verifiedStops: 5,
        gpsVerifiedKm: 42.4,
        claimedKm: 42.4,
        fuelRate: 4.50,
        fuelAmount: 190.8,
        daAmount: 250,
        outstationAmount: 0,
        incidentalAmount: 60,
        incidentalNotes: 'Farmer group meeting tea & refreshments (Bihta bazar)',
        totalClaimAmount: 500.8,
        approvedAmount: 500.8,
        status: 'Approved',
        auditFlags: ['🟢 100% GPS Check-In Match', '✅ 5 Verified Counters', '🏍️ Vehicle Mode: Bike (₹4.50/km)'],
        attachedBills: [
          {
            id: 'bill_001_tea',
            name: 'Bihta_Kisan_Meeting_Chai.svg',
            category: 'Refreshments',
            amount: 60,
            notes: 'Tea & snacks for 12 farmers at Kisan Krishi Kendra meeting',
            dataUrl: makeSampleBillSvg('Sharma Chai & Snacks Bihta', 'Refreshments', 60, yesterday, 'REC-8921'),
            uploadedAt: new Date(Date.now() - 79000000).toISOString()
          }
        ],
        managerNotes: 'GPS route matched with Bihta & Maner checks. Tea receipt verified. Approved in full.',
        approvedBy: 'State Sales Manager (Bihar HQ)',
        approvedAt: new Date(Date.now() - 43200000).toISOString(),
        createdAt: new Date(Date.now() - 80000000).toISOString()
      },
      {
        id: 'tada_002_centralsouth',
        assistant: 'Assistant 2 (Central/South Patna)',
        hq: 'Phulwari Sharif',
        district: 'Patna',
        date: yesterday,
        vehicleMode: 'Bike',
        verifiedStops: 6,
        gpsVerifiedKm: 48.6,
        claimedKm: 48.6,
        fuelRate: 4.50,
        fuelAmount: 218.7,
        daAmount: 250,
        outstationAmount: 0,
        incidentalAmount: 0,
        incidentalNotes: '',
        totalClaimAmount: 468.7,
        approvedAmount: 468.7,
        status: 'Pending Approval',
        auditFlags: ['🟢 Exact GPS Road Alignment (Masaurhi - Punpun)', '🏍️ Vehicle Mode: Bike (₹4.50/km)'],
        attachedBills: [],
        managerNotes: '',
        approvedBy: '',
        approvedAt: null,
        createdAt: new Date(Date.now() - 75000000).toISOString()
      },
      {
        id: 'tada_003_eastpatna',
        assistant: 'Assistant 3 (East Patna)',
        hq: 'Bakhtiarpur',
        district: 'Patna',
        date: yesterday,
        vehicleMode: 'Car',
        verifiedStops: 5,
        gpsVerifiedKm: 64.2,
        claimedKm: 64.2,
        fuelRate: 9.50,
        fuelAmount: 609.9,
        daAmount: 250,
        outstationAmount: 0,
        incidentalAmount: 80,
        incidentalNotes: 'NH-31 Bakhtiarpur-Mokama highway toll & parking',
        totalClaimAmount: 939.9,
        approvedAmount: 939.9,
        status: 'Pending Approval',
        auditFlags: ['🟢 Long-haul Highway Route Verified via GPS Telemetry', '🚗 Transit Mode: Car (₹9.50/km)'],
        attachedBills: [
          {
            id: 'bill_002_toll',
            name: 'NH31_Toll_Receipt.svg',
            category: 'Toll/Parking',
            amount: 80,
            notes: 'NH-31 Highway four-wheeler toll plaza voucher',
            dataUrl: makeSampleBillSvg('NHAI Bakhtiarpur Toll Plaza', 'Toll/Parking', 80, yesterday, 'TOLL-4482'),
            uploadedAt: new Date(Date.now() - 69000000).toISOString()
          }
        ],
        managerNotes: '',
        approvedBy: '',
        approvedAt: null,
        createdAt: new Date(Date.now() - 70000000).toISOString()
      },
      {
        id: 'tada_004_westvaishali',
        assistant: 'Assistant 4 (West Vaishali)',
        hq: 'Hajipur',
        district: 'Vaishali',
        date: twoDaysAgo,
        vehicleMode: 'Bike',
        verifiedStops: 4,
        gpsVerifiedKm: 31.8,
        claimedKm: 58.0, // Inflated mileage
        fuelRate: 4.50,
        fuelAmount: 261.0,
        daAmount: 250,
        outstationAmount: 0,
        incidentalAmount: 40,
        incidentalNotes: 'Refreshments',
        totalClaimAmount: 551.0,
        approvedAmount: 433.1, // Adjusted based on verified GPS km: 31.8 * 4.50 = 143.1 + 250 + 40
        status: 'Adjusted',
        auditFlags: ['⚠️ High Mileage Discrepancy (Claimed 58.0 km vs GPS 31.8 km: +82% variance)', '🏍️ Vehicle Mode: Bike (₹4.50/km)'],
        attachedBills: [
          {
            id: 'bill_003_tea',
            name: 'Lalganj_Tea_Bill.svg',
            category: 'Refreshments',
            amount: 40,
            notes: 'Counter visit refreshments',
            dataUrl: makeSampleBillSvg('Lalganj Mishthan & Tea', 'Refreshments', 40, twoDaysAgo, 'REC-3310'),
            uploadedAt: new Date(Date.now() - 159000000).toISOString()
          }
        ],
        managerNotes: 'Adjusted to verified GPS telemetry distance of 31.8 km. Assistant briefed on GPS-only policy.',
        approvedBy: 'State Sales Manager (Bihar HQ)',
        approvedAt: new Date(Date.now() - 120000000).toISOString(),
        createdAt: new Date(Date.now() - 160000000).toISOString()
      },
      {
        id: 'tada_005_eastvaishali',
        assistant: 'Assistant 5 (East Vaishali)',
        hq: 'Mahua',
        district: 'Vaishali',
        date: yesterday,
        vehicleMode: 'Bike',
        verifiedStops: 4,
        gpsVerifiedKm: 36.5,
        claimedKm: 36.5,
        fuelRate: 4.50,
        fuelAmount: 164.3,
        daAmount: 250,
        outstationAmount: 0,
        incidentalAmount: 0,
        incidentalNotes: '',
        totalClaimAmount: 414.3,
        approvedAmount: 414.3,
        status: 'Approved',
        auditFlags: ['🟢 Verified Mahua - Jandaha Circuit', '🏍️ Vehicle Mode: Bike (₹4.50/km)'],
        attachedBills: [],
        managerNotes: 'Approved in regular run.',
        approvedBy: 'State Sales Manager (Bihar HQ)',
        approvedAt: new Date(Date.now() - 40000000).toISOString(),
        createdAt: new Date(Date.now() - 72000000).toISOString()
      },
      {
        id: 'tada_006_rohtas',
        assistant: 'Assistant 6 (Rohtas)',
        hq: 'Sasaram',
        district: 'Rohtas',
        date: yesterday,
        vehicleMode: 'Car',
        verifiedStops: 5,
        gpsVerifiedKm: 56.4,
        claimedKm: 56.4,
        fuelRate: 9.50,
        fuelAmount: 535.8,
        daAmount: 250,
        outstationAmount: 800,
        incidentalAmount: 110,
        incidentalNotes: 'Farmer plot demo banner conveyance & counter tea',
        totalClaimAmount: 1695.8,
        approvedAmount: 1695.8,
        status: 'Pending Approval',
        auditFlags: ['🚀 Inter-District Travel Verified (Sasaram to Bhabua border)', '🏨 Night Stay Claimed (₹800 Bill Attached)', '🚗 Transit Mode: Car (₹9.50/km)'],
        attachedBills: [
          {
            id: 'bill_004_hotel',
            name: 'Hotel_Maurya_Lodging_Bill.svg',
            category: 'Hotel/Night Stay',
            amount: 800,
            notes: 'Overnight stay at Sasaram outstation hub during remote block campaign',
            dataUrl: makeSampleBillSvg('Hotel Maurya Deluxe Sasaram', 'Hotel/Night Stay', 800, yesterday, 'HTL-9812'),
            uploadedAt: new Date(Date.now() - 64000000).toISOString()
          },
          {
            id: 'bill_005_transport',
            name: 'Demo_Banner_Transport.svg',
            category: 'Other',
            amount: 110,
            notes: 'Banner transport by auto-rickshaw to demo plot',
            dataUrl: makeSampleBillSvg('Sasaram Local Transport', 'Transport/Auto', 110, yesterday, 'VOU-1092'),
            uploadedAt: new Date(Date.now() - 63500000).toISOString()
          }
        ],
        managerNotes: '',
        approvedBy: '',
        approvedAt: null,
        createdAt: new Date(Date.now() - 65000000).toISOString()
      },
      {
        id: 'tada_007_kaimur',
        assistant: 'Assistant 7 (Kaimur)',
        hq: 'Bhabua',
        district: 'Kaimur',
        date: twoDaysAgo,
        vehicleMode: 'Bike',
        verifiedStops: 4,
        gpsVerifiedKm: 39.2,
        claimedKm: 39.2,
        fuelRate: 4.50,
        fuelAmount: 176.4,
        daAmount: 250,
        outstationAmount: 0,
        incidentalAmount: 50,
        incidentalNotes: 'Counter refreshments',
        totalClaimAmount: 476.4,
        approvedAmount: 476.4,
        status: 'Approved',
        auditFlags: ['🟢 Bhabua - Mohania circuit verified', '🏍️ Vehicle Mode: Bike (₹4.50/km)'],
        attachedBills: [
          {
            id: 'bill_006_snacks',
            name: 'Mohania_Chai_Bill.svg',
            category: 'Refreshments',
            amount: 50,
            notes: 'Counter meeting tea',
            dataUrl: makeSampleBillSvg('Mohania Dhaba & Tea', 'Refreshments', 50, twoDaysAgo, 'REC-5511'),
            uploadedAt: new Date(Date.now() - 149000000).toISOString()
          }
        ],
        managerNotes: 'Approved.',
        approvedBy: 'State Sales Manager (Bihar HQ)',
        approvedAt: new Date(Date.now() - 110000000).toISOString(),
        createdAt: new Date(Date.now() - 150000000).toISOString()
      },
      {
        id: 'tada_008_bhojpur',
        assistant: 'Assistant 8 (Bhojpur & Buxar)',
        hq: 'Behea',
        district: 'Bhojpur',
        date: yesterday,
        vehicleMode: 'Bike',
        verifiedStops: 6,
        gpsVerifiedKm: 61.5,
        claimedKm: 61.5,
        fuelRate: 4.50,
        fuelAmount: 276.8,
        daAmount: 250,
        outstationAmount: 0,
        incidentalAmount: 120,
        incidentalNotes: 'Farmer group meeting tea & refreshments (Dumraon)',
        totalClaimAmount: 646.8,
        approvedAmount: 646.8,
        status: 'Pending Approval',
        auditFlags: ['🟢 Multi-Counter Buxar Belt Circuit Verified', '🏍️ Vehicle Mode: Bike (₹4.50/km)'],
        attachedBills: [
          {
            id: 'bill_007_tea',
            name: 'Dumraon_Farmer_Tea.svg',
            category: 'Refreshments',
            amount: 120,
            notes: 'Tea & biscuits for 18 attendee farmers',
            dataUrl: makeSampleBillSvg('Dumraon Kisan Sweets', 'Refreshments', 120, yesterday, 'REC-7729'),
            uploadedAt: new Date(Date.now() - 59000000).toISOString()
          }
        ],
        managerNotes: '',
        approvedBy: '',
        approvedAt: null,
        createdAt: new Date(Date.now() - 60000000).toISOString()
      }
    ];
  }

  // =========================================================================
  // 🇮🇳 INDIAN ONLINE ATTENDANCE & STATUTORY MUSTER ROLL SYSTEM (मस्टर रोल)
  // =========================================================================

  getAttendanceSettings() {
    try {
      const raw = localStorage.getItem('tat_attendance_settings_v1');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.dailyBaseWage) return parsed;
      }
    } catch (e) {
      console.error('Error reading attendance settings:', e);
    }
    const defaultSettings = {
      shiftStartTime: '09:00 AM',
      shiftEndTime: '06:00 PM',
      gracePeriodMinutes: 30, // 09:30 AM cutoff for on-time punch
      minHoursFullDay: 8,
      minHoursHalfDay: 4,
      dailyBaseWage: 650, // Standard daily stipend / wage in INR
      monthlyStipend: 19500, // Monthly base stipend (₹650 * 30)
      weeklyOffDay: 0, // 0 = Sunday
      requireGps: true,
      geofenceThresholdMeters: 500,
      stateHolidays: [
        { date: '2026-01-26', name: 'Republic Day (गणतंत्र दिवस)' },
        { date: '2026-03-22', name: 'Bihar Diwas (बिहार दिवस)' },
        { date: '2026-03-25', name: 'Holi (होली)' },
        { date: '2026-04-14', name: 'Ambedkar Jayanti (आंबेडकर जयंती)' },
        { date: '2026-08-15', name: 'Independence Day (स्वतंत्रता दिवस)' },
        { date: '2026-10-02', name: 'Gandhi Jayanti (गांधी जयंती)' },
        { date: '2026-10-20', name: 'Dussehra / Vijaya Dashami (दशहरा)' },
        { date: '2026-11-09', name: 'Diwali (दीपावली)' },
        { date: '2026-11-15', name: 'Chhath Puja Sandhya Arghya (छठ पूजा)' },
        { date: '2026-11-16', name: 'Chhath Puja Usha Arghya (छठ पारण)' }
      ]
    };
    this.saveAttendanceSettings(defaultSettings);
    return defaultSettings;
  }

  saveAttendanceSettings(settings, syncToCloud = true) {
    try {
      localStorage.setItem('tat_attendance_settings_v1', JSON.stringify(settings));
      window.dispatchEvent(new CustomEvent('tracker:attendanceSettingsChanged', { detail: { settings } }));
      if (syncToCloud && supabaseService.isReady && supabaseService.client) {
        supabaseService.client.from('attendance_settings').upsert({ id: 'bihar_ops_attendance_policy', ...settings }).then(({ error }) => {
          if (error) console.warn('Supabase attendance settings sync:', error.message);
        }).catch(e => console.warn(e));
      }
    } catch (e) {
      console.error('Error saving attendance settings:', e);
    }
  }

  getEmployeeMetadata(assistantName) {
    const defaultMeta = {
      'Assistant 1 (West Patna)': { empCode: 'AGT-001', fatherName: 'Rameshwar Prasad Singh', designation: 'Field Representative / MGO', doj: '2024-02-15' },
      'Assistant 2 (Central/South Patna)': { empCode: 'AGT-002', fatherName: 'Suresh Kumar Verma', designation: 'Field Representative / MGO', doj: '2024-03-01' },
      'Assistant 3 (East Patna)': { empCode: 'AGT-003', fatherName: 'Dinesh Chandra Yadav', designation: 'Field Representative / MGO', doj: '2024-03-15' },
      'Assistant 4 (West Vaishali)': { empCode: 'AGT-004', fatherName: 'Ajay Kumar Jha', designation: 'Field Representative / MGO', doj: '2024-04-01' },
      'Assistant 5 (East Vaishali)': { empCode: 'AGT-005', fatherName: 'Ram Naresh Roy', designation: 'Field Representative / MGO', doj: '2024-04-15' },
      'Assistant 6 (Rohtas)': { empCode: 'AGT-006', fatherName: 'Shri Ram Sharan Tiwari', designation: 'Field Representative / MGO', doj: '2024-05-01' },
      'Assistant 7 (Kaimur)': { empCode: 'AGT-007', fatherName: 'Brij Kishore Gupta', designation: 'Field Representative / MGO', doj: '2024-05-15' },
      'Assistant 8 (Bhojpur & Buxar)': { empCode: 'AGT-008', fatherName: 'Awadhesh Kumar Mishra', designation: 'Field Representative / MGO', doj: '2024-06-01' }
    };
    return defaultMeta[assistantName] || {
      empCode: 'AGT-009',
      fatherName: 'Late S. K. Sharma',
      designation: 'Field Representative',
      doj: '2024-07-01'
    };
  }

  getAttendanceRecords(filter = {}) {
    let list = [];
    try {
      const raw = localStorage.getItem('tat_attendance_records_v1');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          list = parsed;
        }
      }
    } catch (e) {
      console.error('Error reading attendance records:', e);
    }

    if (!list || list.length === 0) {
      list = this.generateDefaultAttendanceRecords();
      this.saveAttendanceRecordsToLocal(list);
    }

    // Clean up any stale auto-generated mock punchOut for TODAY's date (so today is actionable)
    const todayStr = this.getISTDateStr();
    let cleaned = false;
    list = list.map(r => {
      // If a record is for today and has mock punchOut stamped in the past with default pattern, clear it
      if (r.date === todayStr && r.punchOut && (r.isMockSeed || r.punchOutTime?.endsWith('T13:00:00Z') || r.notes?.startsWith('Covered assigned dealer counters in'))) {
        cleaned = true;
        return {
          ...r,
          punchIn: null,
          punchInTime: null,
          punchInGps: null,
          punchOut: null,
          punchOutTime: null,
          punchOutGps: null,
          workingMinutes: 0,
          workingHoursFormatted: 'In Progress',
          status: 'A',
          statusLabel: 'Not Punched In',
          isMockSeed: false
        };
      }
      return r;
    });
    if (cleaned) {
      this.saveAttendanceRecordsToLocal(list);
    }

    // Apply filters
    if (filter.assistant && filter.assistant !== 'ALL') {
      list = list.filter(r => r.assistant === filter.assistant);
    }
    if (filter.date) {
      list = list.filter(r => r.date === filter.date);
    }
    if (filter.month && filter.year) {
      const prefix = `${filter.year}-${String(filter.month).padStart(2, '0')}`;
      list = list.filter(r => r.date.startsWith(prefix));
    }
    if (filter.status && filter.status !== 'all') {
      list = list.filter(r => r.status === filter.status);
    }
    return list;
  }

  saveAttendanceRecordsToLocal(records) {
    try {
      localStorage.setItem('tat_attendance_records_v1', JSON.stringify(records));
      window.dispatchEvent(new CustomEvent('tracker:attendanceChanged', { detail: { records } }));
    } catch (e) {
      console.error('Error saving attendance records:', e);
    }
  }

  saveAttendanceRecord(record, syncToCloud = true) {
    const list = this.getAttendanceRecords();
    const idx = list.findIndex(r => r.id === record.id || (r.assistant === record.assistant && r.date === record.date));
    if (idx >= 0) {
      list[idx] = { ...list[idx], ...record, updatedAt: new Date().toISOString() };
    } else {
      list.unshift({ ...record, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    }
    this.saveAttendanceRecordsToLocal(list);

    // Optimistically enqueue mutation to sync queue with exponential backoff
    if (syncToCloud) {
      syncQueue.enqueue('attendance_records', 'upsert', record).catch(e => console.warn('Sync queue attendance warning:', e));
    }
    return record;
  }

  getTodayAttendance(assistantName) {
    const today = this.getISTDateStr(); // IST date — avoids UTC midnight rollover bug
    const records = this.getAttendanceRecords({ assistant: assistantName, date: today });
    return records[0] || null;
  }

  recordPunchIn(assistantName, details = {}) {
    const now = new Date();
    const today = this.getISTDateStr(now); // IST date — avoids UTC midnight rollover
    const hours = now.getHours();
    const mins = now.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    const timeFormatted = `${String(displayHours).padStart(2, '0')}:${String(mins).padStart(2, '0')} ${ampm}`;

    const assistants = this.getAssistants();
    const repInfo = assistants.find(a => a.name === assistantName) || { name: assistantName, hq: 'Bihta', district: 'Patna' };
    const empMeta = this.getEmployeeMetadata(assistantName);
    const settings = this.getAttendanceSettings();

    // Check if late (after 09:30 AM)
    const isLate = hours > 9 || (hours === 9 && mins > settings.gracePeriodMinutes);

    const existing = this.getTodayAttendance(assistantName);

    const record = {
      id: existing?.id || `att_${String(assistantName).toLowerCase().replace(/[^a-z0-9]/g, '_')}_${today}`,
      assistant: assistantName,
      empCode: empMeta.empCode,
      hq: repInfo.hq,
      district: repInfo.district,
      date: today,
      punchIn: timeFormatted,
      punchInTime: now.toISOString(),
      punchInGps: details.gps || { lat: 25.564, lng: 84.871, locationName: `${repInfo.hq} Station Hub` },
      punchInPhoto: details.photo || null,
      workMode: details.workMode || 'Field Operations', // 'Field Operations' | 'HQ Station Office' | 'Tour / Outstation' | 'Work From Home'
      punchOut: null,
      punchOutTime: null,
      punchOutGps: null,
      workingMinutes: 0,
      workingHoursFormatted: 'In Progress',
      status: details.workMode === 'Tour / Outstation' ? 'OD' : 'P',
      statusLabel: details.workMode === 'Tour / Outstation' ? 'On Duty (Field Tour)' : (isLate ? 'Present (Late In)' : 'Present (Full Day)'),
      isLate,
      notes: details.notes || 'Normal shift commencement',
      regularizationRequested: false,
      regularizationReason: '',
      regularizationStatus: 'None',
      createdAt: existing?.createdAt || now.toISOString(),
      updatedAt: now.toISOString()
    };

    this.saveAttendanceRecord(record);

    // Send push notice
    this.sendAssistantNotification(assistantName, {
      title: `Punch-In Confirmed (${timeFormatted})`,
      message: `Your attendance is stamped at ${timeFormatted} (${record.workMode}). Location: ${record.punchInGps.locationName || 'Field Station'}.`,
      type: 'attendance'
    });

    return record;
  }

  recordPunchOut(assistantName, details = {}) {
    const now = new Date();
    const today = this.getISTDateStr(now); // IST date — avoids UTC midnight rollover
    const hours = now.getHours();
    const mins = now.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    const timeFormatted = `${String(displayHours).padStart(2, '0')}:${String(mins).padStart(2, '0')} ${ampm}`;

    const existing = this.getTodayAttendance(assistantName);
    if (!existing || !existing.punchInTime) {
      throw new Error('You must punch in before punching out.');
    }

    const inTime = new Date(existing.punchInTime);
    const durationMs = Math.max(0, now.getTime() - inTime.getTime());
    const durationMinutes = Math.round(durationMs / 60000);
    const durHours = Math.floor(durationMinutes / 60);
    const durMins = durationMinutes % 60;
    const formattedDuration = `${durHours}h ${durMins}m`;

    const settings = this.getAttendanceSettings();
    let status = existing.status;
    let statusLabel = existing.statusLabel;

    if (existing.workMode !== 'Tour / Outstation') {
      if (durHours >= settings.minHoursFullDay) {
        status = 'P';
        statusLabel = 'Present (Full Day)';
      } else if (durHours >= settings.minHoursHalfDay) {
        status = 'HD';
        statusLabel = 'Half Day (<8 hours)';
      } else {
        status = 'HD';
        statusLabel = 'Partial Shift';
      }
    }

    const updated = {
      ...existing,
      punchOut: timeFormatted,
      punchOutTime: now.toISOString(),
      punchOutGps: details.gps || { lat: 25.565, lng: 84.872, locationName: `${existing.hq} Station Hub` },
      workingMinutes: durationMinutes,
      workingHoursFormatted: formattedDuration,
      status,
      statusLabel,
      notes: details.notes || existing.notes,
      updatedAt: now.toISOString()
    };

    this.saveAttendanceRecord(updated);

    this.sendAssistantNotification(assistantName, {
      title: `Punch-Out Confirmed (${timeFormatted})`,
      message: `Shift closed. Total working time logged: ${formattedDuration}. Daily muster status: ${statusLabel}.`,
      type: 'attendance'
    });

    return updated;
  }

  updateAttendanceStatus(assistantName, dateStr, status, notes = '', managerUser = 'State Sales Manager (Bihar HQ)') {
    const list = this.getAttendanceRecords();
    const existing = list.find(r => r.assistant === assistantName && r.date === dateStr);
    const assistants = this.getAssistants();
    const repInfo = assistants.find(a => a.name === assistantName) || { name: assistantName, hq: 'Bihta', district: 'Patna' };
    const empMeta = this.getEmployeeMetadata(assistantName);

    const labels = {
      'P': 'Present (Full Day)',
      'HD': 'Half Day (0.5)',
      'OD': 'On Duty (Official Tour)',
      'WO': 'Weekly Off (Sunday)',
      'PL': 'Paid Leave (Approved)',
      'CL': 'Casual Leave',
      'SL': 'Sick Leave',
      'H': 'Gazetted Holiday',
      'A': 'Absent'
    };

    const updated = {
      id: existing?.id || `att_${String(assistantName).toLowerCase().replace(/[^a-z0-9]/g, '_')}_${dateStr}`,
      assistant: assistantName,
      empCode: empMeta.empCode,
      hq: repInfo.hq,
      district: repInfo.district,
      date: dateStr,
      punchIn: existing?.punchIn || (status === 'P' || status === 'OD' ? '09:00 AM' : '—'),
      punchInTime: existing?.punchInTime || (status === 'P' || status === 'OD' ? `${dateStr}T09:00:00Z` : null),
      punchInGps: existing?.punchInGps || null,
      punchOut: existing?.punchOut || (status === 'P' || status === 'OD' ? '06:00 PM' : '—'),
      punchOutTime: existing?.punchOutTime || (status === 'P' || status === 'OD' ? `${dateStr}T18:00:00Z` : null),
      punchOutGps: existing?.punchOutGps || null,
      workingMinutes: existing?.workingMinutes || (status === 'P' || status === 'OD' ? 540 : 0),
      workingHoursFormatted: existing?.workingHoursFormatted || (status === 'P' || status === 'OD' ? '9h 00m' : '—'),
      workMode: existing?.workMode || (status === 'OD' ? 'Tour / Outstation' : 'Field Operations'),
      status,
      statusLabel: labels[status] || 'Present',
      notes: notes || `Status updated to ${labels[status]} by ${managerUser}`,
      regularizationRequested: false,
      regularizationStatus: existing?.regularizationRequested ? 'Approved' : 'None',
      updatedAt: new Date().toISOString()
    };

    this.saveAttendanceRecord(updated);
    return updated;
  }

  submitAttendanceRegularization(assistantName, dateStr, reason, requestedStatus = 'P') {
    const list = this.getAttendanceRecords();
    const existing = list.find(r => r.assistant === assistantName && r.date === dateStr);
    const assistants = this.getAssistants();
    const repInfo = assistants.find(a => a.name === assistantName) || { name: assistantName, hq: 'Bihta', district: 'Patna' };
    const empMeta = this.getEmployeeMetadata(assistantName);

    const record = {
      id: existing?.id || `att_${String(assistantName).toLowerCase().replace(/[^a-z0-9]/g, '_')}_${dateStr}`,
      assistant: assistantName,
      empCode: empMeta.empCode,
      hq: repInfo.hq,
      district: repInfo.district,
      date: dateStr,
      punchIn: existing?.punchIn || '09:00 AM',
      punchInTime: existing?.punchInTime || `${dateStr}T09:00:00Z`,
      punchOut: existing?.punchOut || '06:00 PM',
      punchOutTime: existing?.punchOutTime || `${dateStr}T18:00:00Z`,
      status: existing?.status || 'A',
      statusLabel: existing?.statusLabel || 'Absent',
      regularizationRequested: true,
      regularizationReason: reason,
      requestedStatus,
      regularizationStatus: 'Pending',
      updatedAt: new Date().toISOString()
    };

    this.saveAttendanceRecord(record);

    this.broadcastNotification({
      title: `Attendance Regularization: ${assistantName}`,
      message: `${assistantName} submitted an attendance regularization request for ${dateStr} (${requestedStatus}): "${reason}". Awaiting managerial approval.`,
      type: 'attendance'
    });

    return record;
  }

  reviewAttendanceRegularization(recordId, approved, managerNotes = '') {
    const list = this.getAttendanceRecords();
    const target = list.find(r => r.id === recordId);
    if (!target) return null;

    if (approved) {
      target.status = target.requestedStatus || 'P';
      target.statusLabel = target.status === 'OD' ? 'On Duty (Regularized)' : 'Present (Regularized)';
      target.regularizationStatus = 'Approved';
      target.notes = `Regularization approved by Manager: ${managerNotes || 'Approved'}`;
    } else {
      target.regularizationStatus = 'Rejected';
      target.notes = `Regularization rejected by Manager: ${managerNotes || 'Rejected'}`;
    }

    target.regularizationRequested = false;
    target.updatedAt = new Date().toISOString();
    this.saveAttendanceRecord(target);

    this.sendAssistantNotification(target.assistant, {
      title: `Regularization ${approved ? 'Approved' : 'Rejected'} (${target.date})`,
      message: `Your attendance request for ${target.date} was ${approved ? 'approved' : 'rejected'}. Status: ${target.statusLabel}. Remarks: ${managerNotes || 'Reviewed'}.`,
      type: 'attendance'
    });

    return target;
  }

  // =========================================================================
  // STATUTORY MUSTER ROLL COMPILER (FORM XVI / FORM D)
  // =========================================================================

  getMusterRollMonthData(year = 2026, month = 9) {
    const settings = this.getAttendanceSettings();
    const assistants = this.getAssistants();
    const daysInMonth = new Date(year, month, 0).getDate();
    const records = this.getAttendanceRecords({ year, month });
    const checkIns = this.getCheckInLogs();
    const tourBeats = this.getTourBeatPlans ? this.getTourBeatPlans() : [];

    const monthStr = String(month).padStart(2, '0');
    const today = new Date().toISOString().split('T')[0];

    // Build day columns
    const daysList = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const dStr = String(d).padStart(2, '0');
      const dateStr = `${year}-${monthStr}-${dStr}`;
      const dt = new Date(year, month - 1, d);
      const dayOfWeek = dt.getDay(); // 0 = Sunday
      const isSunday = dayOfWeek === 0;
      const holiday = settings.stateHolidays.find(h => h.date === dateStr);

      daysList.push({
        dayNum: d,
        dateStr,
        dayOfWeek,
        dayName: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dayOfWeek],
        isSunday,
        isHoliday: Boolean(holiday),
        holidayName: holiday?.name || null
      });
    }

    // Compile rows for each assistant
    const rows = assistants.map(asst => {
      const empMeta = this.getEmployeeMetadata(asst.name);
      const asstRecords = records.filter(r => r.assistant === asst.name);

      let presentCount = 0;
      let halfDayCount = 0;
      let onDutyCount = 0;
      let weeklyOffCount = 0;
      let leaveCount = 0;
      let holidayCount = 0;
      let absentCount = 0;

      const dailyAttendance = daysList.map(day => {
        const isFuture = day.dateStr > today;
        const rec = asstRecords.find(r => r.date === day.dateStr);

        let code = '—';
        let label = 'Upcoming';
        let timeIn = '';
        let timeOut = '';
        let hours = '';

        if (rec) {
          code = rec.status;
          label = rec.statusLabel;
          timeIn = rec.punchIn || '';
          timeOut = rec.punchOut || '';
          hours = rec.workingHoursFormatted || '';
        } else if (day.isSunday) {
          code = 'WO';
          label = 'Weekly Off (Sunday)';
        } else if (day.isHoliday) {
          code = 'H';
          label = day.holidayName || 'Holiday';
        } else if (isFuture) {
          code = '—';
          label = 'Upcoming Date';
        } else {
          // Check if there was field activity (GPS check-ins or tour beat)
          const dayCheckIns = checkIns.filter(l => l.rep === asst.name && (l.date === day.dateStr || l.checkInDate === day.dateStr));
          if (dayCheckIns.length >= 4) {
            code = 'P';
            label = 'Present (GPS Verified Activity)';
            timeIn = '09:00 AM';
            timeOut = '06:00 PM';
            hours = '9h 00m';
          } else if (dayCheckIns.length >= 1) {
            code = 'HD';
            label = 'Half Day (Field Visits)';
            timeIn = '09:30 AM';
            timeOut = '02:00 PM';
            hours = '4h 30m';
          } else {
            code = 'A';
            label = 'Absent (No Punch / Visits)';
          }
        }

        // Increment monthly tallies for past & today dates
        if (!isFuture) {
          if (code === 'P') presentCount++;
          else if (code === 'HD') halfDayCount++;
          else if (code === 'OD') onDutyCount++;
          else if (code === 'WO') weeklyOffCount++;
          else if (code === 'PL' || code === 'CL' || code === 'SL') leaveCount++;
          else if (code === 'H') holidayCount++;
          else if (code === 'A') absentCount++;
        }

        return {
          dayNum: day.dayNum,
          dateStr: day.dateStr,
          dayName: day.dayName,
          isSunday: day.isSunday,
          isHoliday: day.isHoliday,
          code,
          label,
          timeIn,
          timeOut,
          hours,
          recordId: rec?.id || null,
          regularizationRequested: rec?.regularizationRequested || false
        };
      });

      // Total Payable Days formula: P + (0.5 * HD) + OD + WO + Leave + Holiday
      const payableDays = presentCount + (halfDayCount * 0.5) + onDutyCount + weeklyOffCount + leaveCount + holidayCount;
      const dailyWage = settings.dailyBaseWage || 650;
      const grossWage = Math.round(payableDays * dailyWage);

      return {
        assistant: asst.name,
        empCode: empMeta.empCode,
        fatherName: empMeta.fatherName,
        designation: empMeta.designation,
        hq: asst.hq,
        district: asst.district,
        dailyAttendance,
        presentCount,
        halfDayCount,
        onDutyCount,
        weeklyOffCount,
        leaveCount,
        holidayCount,
        absentCount,
        payableDays,
        dailyWage,
        grossWage
      };
    });

    // Summary Rollup
    const totalPayableDays = rows.reduce((s, r) => s + r.payableDays, 0);
    const totalGrossPayroll = rows.reduce((s, r) => s + r.grossWage, 0);
    const totalPresents = rows.reduce((s, r) => s + r.presentCount, 0);
    const totalAbsents = rows.reduce((s, r) => s + r.absentCount, 0);
    const pendingRegularizations = records.filter(r => r.regularizationRequested && r.regularizationStatus === 'Pending');

    return {
      year,
      month,
      monthName: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][month - 1],
      daysInMonth,
      daysList,
      rows,
      settings,
      totalPayableDays,
      totalGrossPayroll,
      totalPresents,
      totalAbsents,
      pendingRegularizations
    };
  }

  autoPopulateMusterRollFromGps(year = 2026, month = 9) {
    const daysInMonth = new Date(year, month, 0).getDate();
    const monthStr = String(month).padStart(2, '0');
    const today = new Date().toISOString().split('T')[0];
    const checkIns = this.getCheckInLogs();
    const assistants = this.getAssistants();
    const settings = this.getAttendanceSettings();
    let updatedCount = 0;

    assistants.forEach(asst => {
      for (let d = 1; d <= daysInMonth; d++) {
        const dStr = String(d).padStart(2, '0');
        const dateStr = `${year}-${monthStr}-${dStr}`;
        if (dateStr > today) continue;

        const dt = new Date(year, month - 1, d);
        if (dt.getDay() === 0) continue; // Skip Sunday

        const holiday = settings.stateHolidays.find(h => h.date === dateStr);
        if (holiday) continue; // Skip state holiday

        const dayLogs = checkIns.filter(l => l.rep === asst.name && (l.date === dateStr || l.checkInDate === dateStr));
        if (dayLogs.length >= 4) {
          this.updateAttendanceStatus(asst.name, dateStr, 'P', 'Auto-populated from 4+ verified GPS check-in logs');
          updatedCount++;
        } else if (dayLogs.length >= 1) {
          this.updateAttendanceStatus(asst.name, dateStr, 'HD', 'Auto-populated from 1-3 GPS check-in visits');
          updatedCount++;
        }
      }
    });

    return updatedCount;
  }

  autoMarkSundaysWeeklyOff(year = 2026, month = 9) {
    const daysInMonth = new Date(year, month, 0).getDate();
    const monthStr = String(month).padStart(2, '0');
    const assistants = this.getAssistants();
    let count = 0;

    assistants.forEach(asst => {
      for (let d = 1; d <= daysInMonth; d++) {
        const dt = new Date(year, month - 1, d);
        if (dt.getDay() === 0) { // Sunday
          const dStr = String(d).padStart(2, '0');
          const dateStr = `${year}-${monthStr}-${dStr}`;
          this.updateAttendanceStatus(asst.name, dateStr, 'WO', 'Statutory Weekly Rest Day (Sunday)');
          count++;
        }
      }
    });
    return count;
  }

  generateDefaultAttendanceRecords() {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1; // 1-12
    const currentDay = now.getDate();
    const monthStr = String(month).padStart(2, '0');

    const assistants = this.getAssistants();
    const records = [];

    const statusesPool = ['P', 'P', 'P', 'P', 'P', 'OD', 'HD'];

    assistants.forEach((asst, aIdx) => {
      const empMeta = this.getEmployeeMetadata(asst.name);

      // Only seed past days (d < currentDay) so today's shift is active for punch in/out
      for (let d = 1; d < currentDay; d++) {
        const dStr = String(d).padStart(2, '0');
        const dateStr = `${year}-${monthStr}-${dStr}`;
        const dt = new Date(year, month - 1, d);
        const isSunday = dt.getDay() === 0;

        let status = 'P';
        let label = 'Present (Full Day)';
        let punchIn = '09:12 AM';
        let punchOut = '06:30 PM';
        let mins = 558;
        let formattedHours = '9h 18m';
        let workMode = 'Field Operations';

        if (isSunday) {
          status = 'WO';
          label = 'Weekly Off (Sunday)';
          punchIn = '—';
          punchOut = '—';
          mins = 0;
          formattedHours = '—';
          workMode = 'Rest Day';
        } else if (d === 14 && aIdx % 3 === 0) {
          status = 'PL';
          label = 'Paid Leave (Approved)';
          punchIn = '—';
          punchOut = '—';
          mins = 0;
          formattedHours = '—';
          workMode = 'Leave';
        } else if (d === 8 && aIdx === 5) {
          status = 'OD';
          label = 'On Duty (Bhabua Outstation Tour)';
          punchIn = '08:45 AM';
          punchOut = '07:15 PM';
          mins = 630;
          formattedHours = '10h 30m';
          workMode = 'Tour / Outstation';
        } else if (d === 22 && aIdx === 3) {
          status = 'HD';
          label = 'Half Day (0.5)';
          punchIn = '09:40 AM';
          punchOut = '02:10 PM';
          mins = 270;
          formattedHours = '4h 30m';
        } else {
          // Regular day
          const pMins = 5 + ((d + aIdx) % 25);
          punchIn = `09:${String(pMins).padStart(2, '0')} AM`;
          punchOut = `06:${String(20 + ((d * 3) % 35)).padStart(2, '0')} PM`;
          mins = 540 + ((d * 7) % 60);
          formattedHours = `${Math.floor(mins / 60)}h ${mins % 60}m`;
        }

        records.push({
          id: `att_${String(asst.name).toLowerCase().replace(/[^a-z0-9]/g, '_')}_${dateStr}`,
          assistant: asst.name,
          empCode: empMeta.empCode,
          hq: asst.hq,
          district: asst.district,
          date: dateStr,
          punchIn,
          punchInTime: punchIn !== '—' ? `${dateStr}T${punchIn.includes('09:') ? '03:40:00Z' : '03:15:00Z'}` : null,
          punchInGps: punchIn !== '—' ? { lat: 25.564 + (aIdx * 0.05), lng: 84.871 + (aIdx * 0.04), locationName: `${asst.hq} Station Hub` } : null,
          punchOut,
          punchOutTime: punchOut !== '—' ? `${dateStr}T13:00:00Z` : null,
          punchOutGps: punchOut !== '—' ? { lat: 25.565 + (aIdx * 0.05), lng: 84.872 + (aIdx * 0.04), locationName: `${asst.hq} Station Hub` } : null,
          workingMinutes: mins,
          workingHoursFormatted: formattedHours,
          workMode,
          status,
          statusLabel: label,
          isLate: punchIn.startsWith('09:3') || punchIn.startsWith('09:4'),
          notes: status === 'P' ? `Covered assigned dealer counters in ${asst.hq}` : label,
          regularizationRequested: (d === currentDay - 1 && aIdx === 0),
          regularizationReason: (d === currentDay - 1 && aIdx === 0) ? 'Poor cellular connectivity at remote Katesar mandi counter' : '',
          requestedStatus: 'P',
          regularizationStatus: (d === currentDay - 1 && aIdx === 0) ? 'Pending' : 'None',
          createdAt: new Date(Date.now() - ((31 - d) * 86400000)).toISOString(),
          updatedAt: new Date(Date.now() - ((31 - d) * 86400000)).toISOString()
        });
      }
    });

    return records;
  }

  resetTodayPunch(assistantName) {
    const today = this.getISTDateStr();
    let list = [];
    try {
      const raw = localStorage.getItem('tat_attendance_records_v1');
      if (raw) list = JSON.parse(raw);
    } catch (e) {}
    if (Array.isArray(list)) {
      list = list.filter(r => !(r.assistant === assistantName && r.date === today));
      this.saveAttendanceRecordsToLocal(list);
    }
    return true;
  }

  triggerChange() {
    window.dispatchEvent(new CustomEvent('tracker:dataChanged', { detail: { rows: this.rows } }));
  }

  // ===========================================================================
  // LEAVE MANAGEMENT SYSTEM
  // Policy: 12 PL + 12 CL + 12 SL per calendar year (Indian Labour Law)
  // ===========================================================================

  getLeaveApplications(filter = {}) {
    try {
      const raw = localStorage.getItem('tat_leave_applications_v1');
      let list = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(list)) list = [];
      if (filter.assistant && filter.assistant !== 'ALL') list = list.filter(l => l.assistant === filter.assistant);
      if (filter.status && filter.status !== 'all') list = list.filter(l => l.status === filter.status);
      if (filter.type && filter.type !== 'all') list = list.filter(l => l.leaveType === filter.type);
      if (filter.year) list = list.filter(l => l.fromDate && l.fromDate.startsWith(String(filter.year)));
      return list.sort((a, b) => new Date(b.appliedAt || 0) - new Date(a.appliedAt || 0));
    } catch (e) { console.error('Error reading leave applications:', e); }
    return [];
  }

  saveLeaveApplication(application) {
    try {
      const raw = localStorage.getItem('tat_leave_applications_v1');
      let list = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(list)) list = [];
      const idx = list.findIndex(l => l.id === application.id);
      const now = new Date().toISOString();
      if (idx >= 0) {
        list[idx] = { ...list[idx], ...application, updatedAt: now };
      } else {
        list.unshift({ ...application, createdAt: now, updatedAt: now });
      }
      localStorage.setItem('tat_leave_applications_v1', JSON.stringify(list));
      window.dispatchEvent(new CustomEvent('tracker:leaveChanged'));
      if (supabaseService.isReady && supabaseService.client) {
        supabaseService.client.from('leave_applications').upsert(application).catch(e => console.warn(e));
      }
      return application;
    } catch (e) { console.error('Error saving leave application:', e); }
  }

  applyForLeave({ assistant, leaveType, fromDate, toDate, reason, days, halfDay = false, session = 'full' }) {
    const assistants = this.getAssistants();
    const repInfo = assistants.find(a => a.name === assistant) || { name: assistant, hq: 'Bihta', district: 'Patna' };
    const empMeta = this.getEmployeeMetadata(assistant);
    const balance = this.getLeaveBalance(assistant, new Date(fromDate).getFullYear());
    const leaveLabels = { PL: 'Paid Leave', CL: 'Casual Leave', SL: 'Sick Leave', LWP: 'Leave Without Pay' };

    // Balance validation (skip for LWP)
    const available = balance[leaveType]?.available ?? 0;
    if (!['LWP'].includes(leaveType) && available < days) {
      return { success: false, error: `Insufficient ${leaveLabels[leaveType]} balance. Available: ${available} day(s), Requested: ${days} day(s).` };
    }

    const application = {
      id: `leave_${String(assistant).toLowerCase().replace(/[^a-z0-9]/g, '_')}_${fromDate}_${Date.now()}`,
      assistant,
      empCode: empMeta.empCode,
      hq: repInfo.hq,
      district: repInfo.district,
      leaveType,
      leaveLabel: leaveLabels[leaveType] || leaveType,
      fromDate,
      toDate,
      days: halfDay ? 0.5 : days,
      halfDay,
      session,
      reason,
      status: 'Pending',
      appliedAt: new Date().toISOString(),
      approvedBy: null,
      approvedAt: null,
      managerRemarks: null
    };

    this.saveLeaveApplication(application);

    // Notify the manager (admin)
    try {
      const notifRaw = localStorage.getItem('tat_admin_notifications_v1');
      const notifs = notifRaw ? JSON.parse(notifRaw) : [];
      notifs.unshift({
        id: `notif_leave_${Date.now()}`,
        title: `Leave Request: ${leaveLabels[leaveType]} — ${assistant}`,
        message: `${assistant} applied for ${application.days} day(s) of ${leaveLabels[leaveType]} from ${fromDate} to ${toDate}. Reason: ${reason}`,
        type: 'leave',
        applicationId: application.id,
        createdAt: new Date().toISOString(),
        read: false
      });
      localStorage.setItem('tat_admin_notifications_v1', JSON.stringify(notifs));
    } catch(e) {}

    return { success: true, application };
  }

  reviewLeaveApplication(applicationId, decision, managerRemarks = '') {
    const all = this.getLeaveApplications();
    const appRaw = all.find(a => a.id === applicationId);
    if (!appRaw) return { success: false, error: 'Application not found' };

    const updated = {
      ...appRaw,
      status: decision,
      approvedBy: 'State Sales Manager (Bihar HQ)',
      approvedAt: new Date().toISOString(),
      managerRemarks: managerRemarks || (decision === 'Approved' ? 'Approved by manager.' : 'Rejected.'),
      updatedAt: new Date().toISOString()
    };
    this.saveLeaveApplication(updated);

    // If approved — mark attendance records for the leave dates
    if (decision === 'Approved') {
      const from = new Date(appRaw.fromDate);
      const to = new Date(appRaw.toDate);
      for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split('T')[0];
        if (d.getDay() === 0) continue; // skip Sundays
        const code = appRaw.halfDay ? 'HD' : (appRaw.leaveType === 'LWP' ? 'A' : appRaw.leaveType);
        this.updateAttendanceStatus && this.updateAttendanceStatus(appRaw.assistant, dateStr, code,
          `${appRaw.leaveLabel} — ${appRaw.reason} (Approved)`);
      }
    }

    // Notify the rep
    this.sendAssistantNotification(appRaw.assistant, {
      title: `Leave ${decision}: ${appRaw.leaveLabel}`,
      message: `Your ${appRaw.leaveLabel} (${appRaw.fromDate} to ${appRaw.toDate}) has been ${decision.toLowerCase()}. ${managerRemarks ? `Remarks: ${managerRemarks}` : ''}`,
      type: 'leave'
    });

    return { success: true, updated };
  }

  getLeaveBalance(assistantName, year = new Date().getFullYear()) {
    const settings = this.getAttendanceSettings();
    const policy = settings.leavePolicy || { annualPL: 12, annualCL: 12, annualSL: 12, plMaxEncashableYearEnd: 30 };

    const approved = this.getLeaveApplications({ assistant: assistantName, status: 'Approved', year });
    const used = { PL: 0, CL: 0, SL: 0, LWP: 0 };
    approved.forEach(a => { if (used[a.leaveType] !== undefined) used[a.leaveType] += (a.days || 0); });

    // PL carry-forward from previous year (max 15 days)
    const prevApproved = this.getLeaveApplications({ assistant: assistantName, status: 'Approved', year: year - 1 });
    const prevUsedPL = prevApproved.filter(a => a.leaveType === 'PL').reduce((s, a) => s + (a.days || 0), 0);
    const carryForward = Math.min(Math.max(0, policy.annualPL - prevUsedPL), 15);

    const dailyWage = settings.dailyBaseWage || 650;
    const plAvailable = Math.max(0, policy.annualPL + carryForward - used.PL);
    const encashable = Math.min(plAvailable, policy.plMaxEncashableYearEnd || 30);

    return {
      PL: { type: 'PL', label: 'Paid Leave', annual: policy.annualPL, carryForward, opening: policy.annualPL + carryForward, used: used.PL, available: plAvailable, encashableBalance: encashable, encashmentValue: Math.round(encashable * dailyWage), color: '#16a34a' },
      CL: { type: 'CL', label: 'Casual Leave', annual: policy.annualCL, carryForward: 0, opening: policy.annualCL, used: used.CL, available: Math.max(0, policy.annualCL - used.CL), color: '#0284c7' },
      SL: { type: 'SL', label: 'Sick Leave', annual: policy.annualSL, carryForward: 0, opening: policy.annualSL, used: used.SL, available: Math.max(0, policy.annualSL - used.SL), color: '#db2777' },
      LWP: { type: 'LWP', label: 'Leave Without Pay', annual: 0, carryForward: 0, opening: 0, used: used.LWP, available: 999, color: '#dc2626' }
    };
  }

  getAllLeaveBalances(year = new Date().getFullYear()) {
    return this.getAssistants().map(asst => ({
      assistant: asst.name,
      empCode: this.getEmployeeMetadata(asst.name).empCode,
      hq: asst.hq,
      district: asst.district,
      balance: this.getLeaveBalance(asst.name, year)
    }));
  }

  getLeaveCalendarData(year, month) {
    const prefix = `${year}-${String(month).padStart(2, '0')}`;
    const calMap = {};
    this.getLeaveApplications({ year }).forEach(app => {
      if (app.status !== 'Approved' && app.status !== 'Pending') return;
      const from = new Date(app.fromDate), to = new Date(app.toDate);
      for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split('T')[0];
        if (!dateStr.startsWith(prefix)) continue;
        if (!calMap[dateStr]) calMap[dateStr] = [];
        calMap[dateStr].push({ assistant: app.assistant, empCode: app.empCode, leaveType: app.leaveType, leaveLabel: app.leaveLabel, days: app.days, halfDay: app.halfDay, status: app.status });
      }
    });
    return calMap;
  }
}

export const storage = new StorageService();
