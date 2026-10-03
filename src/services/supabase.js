import { createClient } from '@supabase/supabase-js';

const URL_KEY = 'tat_supabase_url';
const KEY_KEY = 'tat_supabase_anon_key';
const DEFAULT_URL = 'https://jmzbsotojorqmrlhxmoy.supabase.co';
const DEFAULT_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImptemJzb3Rvam9ycW1ybGh4bW95Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA1Mjc3NTAsImV4cCI6MjEwNjEwMzc1MH0.ezwAHWTDUQjMQKOiskCj87gOCfsssrseXNuWiL33h7M';

class SupabaseService {
  constructor() {
    this.client = null;
    this.isReady = false;
    this.subscription = null;
  }

  getCredentials() {
    const url = localStorage.getItem(URL_KEY) || (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL) || DEFAULT_URL;
    const key = localStorage.getItem(KEY_KEY) || (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_ANON_KEY) || DEFAULT_KEY;
    return { url: url.trim(), key: key.trim() };
  }

  saveCredentials(url, key) {
    if (url && key) {
      localStorage.setItem(URL_KEY, url.trim());
      localStorage.setItem(KEY_KEY, key.trim());
      return this.init();
    } else {
      localStorage.removeItem(URL_KEY);
      localStorage.removeItem(KEY_KEY);
      this.client = null;
      this.isReady = false;
      return false;
    }
  }

  async init() {
    const { url, key } = this.getCredentials();
    if (!url || !key) {
      this.client = null;
      this.isReady = false;
      return false;
    }

    try {
      this.client = createClient(url, key, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          storageKey: 'tat_sb_auth_token'
        },
        realtime: { params: { eventsPerSecond: 10 } }
      });
      this.isReady = true;
      return true;
    } catch (e) {
      console.error('Supabase client initialization error:', e);
      this.client = null;
      this.isReady = false;
      return false;
    }
  }

  // Real Supabase Authentication Methods
  async signInWithEmail(email, password) {
    if (!this.client) throw new Error('Supabase client is not initialized.');
    return await this.client.auth.signInWithPassword({ email: email.trim(), password });
  }

  async signUpUser(email, password, metadata = {}) {
    if (!this.client) throw new Error('Supabase client is not initialized.');
    return await this.client.auth.signUp({
      email: email.trim(),
      password,
      options: { data: metadata }
    });
  }

  async signOutUser() {
    if (!this.client) return;
    return await this.client.auth.signOut();
  }

  async getCurrentSession() {
    if (!this.client) return null;
    const { data } = await this.client.auth.getSession();
    return data?.session || null;
  }

  async getCurrentUser() {
    if (!this.client) return null;
    const { data } = await this.client.auth.getUser();
    return data?.user || null;
  }

  async testConnection(url, key) {
    try {
      const tempClient = createClient(url.trim(), key.trim(), {
        auth: { persistSession: false }
      });
      const { data, error } = await tempClient.from('assistants').select('name').limit(1);
      if (error) throw error;
      return { success: true, count: data?.length || 0 };
    } catch (err) {
      return { success: false, error: err.message || 'Connection failed' };
    }
  }

  subscribeToRealtime(onTableChange) {
    if (!this.client || !this.isReady) return;

    if (this.subscription) {
      this.client.removeChannel(this.subscription);
    }

    this.subscription = this.client
      .channel('public_db_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'retailers' }, (payload) => {
        if (typeof onTableChange === 'function') onTableChange('retailers', payload);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'check_in_logs' }, (payload) => {
        if (typeof onTableChange === 'function') onTableChange('check_in_logs', payload);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'assistants' }, (payload) => {
        if (typeof onTableChange === 'function') onTableChange('assistants', payload);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tour_plans' }, (payload) => {
        if (typeof onTableChange === 'function') onTableChange('tour_plans', payload);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'farmer_meetings' }, (payload) => {
        if (typeof onTableChange === 'function') onTableChange('farmer_meetings', payload);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'demo_plots' }, (payload) => {
        if (typeof onTableChange === 'function') onTableChange('demo_plots', payload);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'competitor_intel' }, (payload) => {
        if (typeof onTableChange === 'function') onTableChange('competitor_intel', payload);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'farmer_leads' }, (payload) => {
        if (typeof onTableChange === 'function') onTableChange('farmer_leads', payload);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'aqfs_audits' }, (payload) => {
        if (typeof onTableChange === 'function') onTableChange('aqfs_audits', payload);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'weekly_reviews' }, (payload) => {
        if (typeof onTableChange === 'function') onTableChange('weekly_reviews', payload);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'quiz_questions' }, (payload) => {
        if (typeof onTableChange === 'function') onTableChange('quiz_questions', payload);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'quiz_states' }, (payload) => {
        if (typeof onTableChange === 'function') onTableChange('quiz_states', payload);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'eod_reports' }, (payload) => {
        if (typeof onTableChange === 'function') onTableChange('eod_reports', payload);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leave_applications' }, (payload) => {
        if (typeof onTableChange === 'function') onTableChange('leave_applications', payload);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance_records' }, (payload) => {
        if (typeof onTableChange === 'function') onTableChange('attendance_records', payload);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tada_claims' }, (payload) => {
        if (typeof onTableChange === 'function') onTableChange('tada_claims', payload);
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('⚡ Supabase real-time channel connected');
        }
      });
  }

  // --- RETAILERS ---
  async fetchRetailers() {
    if (!this.client) return null;
    const { data, error } = await this.client
      .from('retailers')
      .select('*')
      .order('retailer', { ascending: true });
    
    if (error) {
      console.warn('Supabase fetchRetailers error:', error.message);
      return null;
    }

    return (data || []).map(r => ({
      id: r.id,
      retailer: r.retailer,
      assistant: r.assistant,
      hq: r.hq,
      district: r.district,
      block: r.block,
      mobile: r.mobile,
      status: r.status,
      potentialFor: r.potential_for,
      potentialSell: r.potential_sell,
      notes: r.notes,
      verifiedVisit: r.verified_visit,
      checkInDate: r.check_in_date,
      checkInTime: r.check_in_time,
      checkInCoords: (r.check_in_lat && r.check_in_lng) ? {
        lat: r.check_in_lat,
        lng: r.check_in_lng,
        accuracy: r.check_in_accuracy
      } : null,
      checkInDistKm: r.check_in_dist_km,
      checkInMapUrl: r.check_in_map_url,
      checkInRep: r.check_in_rep,
      updatedBy: r.updated_by,
      updatedAt: r.updated_at ? new Date(r.updated_at).getTime() : Date.now()
    }));
  }

  async upsertRetailer(row) {
    if (!this.client) return null;
    const record = {
      id: row.id,
      retailer: row.retailer,
      assistant: row.assistant || null,
      hq: row.hq || null,
      district: row.district || 'Patna',
      block: row.block || '',
      mobile: row.mobile || '',
      status: row.status || 'Pending',
      potential_for: row.potentialFor || null,
      potential_sell: row.potentialSell || null,
      notes: row.notes || '',
      verified_visit: Boolean(row.verifiedVisit),
      check_in_date: row.checkInDate || null,
      check_in_time: row.checkInTime || null,
      check_in_lat: row.checkInCoords?.lat || null,
      check_in_lng: row.checkInCoords?.lng || null,
      check_in_accuracy: row.checkInCoords?.accuracy || null,
      check_in_dist_km: row.checkInDistKm !== undefined ? row.checkInDistKm : null,
      check_in_map_url: row.checkInMapUrl || null,
      check_in_rep: row.checkInRep || null,
      updated_by: row.updatedBy || null,
      updated_at: new Date().toISOString()
    };

    const { data, error } = await this.client
      .from('retailers')
      .upsert(record);
    if (error) throw error;
    return data;
  }

  async bulkUpsertRetailers(rows) {
    if (!this.client) return null;
    const records = rows.map(row => ({
      id: row.id,
      retailer: row.retailer,
      assistant: row.assistant || null,
      hq: row.hq || null,
      district: row.district || 'Patna',
      block: row.block || '',
      mobile: row.mobile || '',
      status: row.status || 'Pending',
      potential_for: row.potentialFor || null,
      potential_sell: row.potentialSell || null,
      notes: row.notes || '',
      verified_visit: Boolean(row.verifiedVisit),
      check_in_date: row.checkInDate || null,
      check_in_time: row.checkInTime || null,
      check_in_lat: row.checkInCoords?.lat || null,
      check_in_lng: row.checkInCoords?.lng || null,
      check_in_accuracy: row.checkInCoords?.accuracy || null,
      check_in_dist_km: row.checkInDistKm !== undefined ? row.checkInDistKm : null,
      check_in_map_url: row.checkInMapUrl || null,
      check_in_rep: row.checkInRep || null,
      updated_by: row.updatedBy || 'Initial Seed',
      updated_at: new Date().toISOString()
    }));

    // Process in batches of 100 to avoid payload limits
    const batchSize = 100;
    for (let i = 0; i < records.length; i += batchSize) {
      const chunk = records.slice(i, i + batchSize);
      const { error } = await this.client.from('retailers').upsert(chunk);
      if (error) throw error;
    }
    return true;
  }

  // --- CHECK-IN LOGS ---
  async fetchCheckInLogs() {
    if (!this.client) return null;
    const { data, error } = await this.client
      .from('check_in_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1000);

    if (error) {
      console.warn('Supabase fetchCheckInLogs error:', error.message);
      return null;
    }

    return (data || []).map(l => ({
      id: l.id,
      retailerId: l.retailer_id,
      retailer: l.retailer,
      mobile: l.mobile,
      district: l.district,
      block: l.block,
      rep: l.rep,
      date: l.date,
      time: l.time,
      timestamp: l.timestamp || (l.created_at ? new Date(l.created_at).getTime() : Date.now()),
      lat: l.lat,
      lng: l.lng,
      accuracy: l.accuracy,
      distKm: l.dist_km,
      mapUrl: l.map_url,
      status: l.status,
      notes: l.notes
    }));
  }

  async saveCheckInLog(entry) {
    if (!this.client) return null;
    const record = {
      id: entry.id,
      retailer_id: entry.retailerId,
      retailer: entry.retailer,
      mobile: entry.mobile || '',
      district: entry.district || '',
      block: entry.block || '',
      rep: entry.rep || '',
      date: entry.date,
      time: entry.time,
      timestamp: entry.timestamp || Date.now(),
      lat: entry.lat,
      lng: entry.lng,
      accuracy: entry.accuracy,
      dist_km: entry.distKm,
      map_url: entry.mapUrl,
      status: entry.status || 'Visited',
      notes: entry.notes || ''
    };

    const { error } = await this.client.from('check_in_logs').upsert(record);
    if (error) console.warn('Supabase saveCheckInLog error:', error.message);
  }

  // --- ASSISTANTS ---
  async fetchAssistants() {
    if (!this.client) return null;
    const { data, error } = await this.client.from('assistants').select('*');
    if (error) {
      console.warn('Supabase fetchAssistants error:', error.message);
      return null;
    }
    return (data || []).map(a => ({
      name: a.name,
      hq: a.hq,
      district: a.district,
      target: a.target || 50,
      blocks: a.blocks || [],
      password: a.password || 'rep123'
    }));
  }

  async saveAssistant(asst) {
    if (!this.client) return null;
    const { error } = await this.client.from('assistants').upsert({
      name: asst.name,
      hq: asst.hq,
      district: asst.district,
      target: asst.target,
      blocks: asst.blocks || [],
      password: asst.password || 'rep123',
      updated_at: new Date().toISOString()
    });
    if (error) throw error;
  }

  // --- TOUR PLANS ---
  async fetchTodayTour(repName, dateStr) {
    if (!this.client) return null;
    const id = `${repName}_${dateStr}`.toLowerCase().replace(/\s+/g, '_');
    const { data, error } = await this.client
      .from('tour_plans')
      .select('retailer_ids')
      .eq('id', id)
      .maybeSingle();
    
    if (error || !data) return null;
    return new Set(data.retailer_ids || []);
  }

  async saveTodayTour(repName, dateStr, idSet) {
    if (!this.client) return null;
    const id = `${repName}_${dateStr}`.toLowerCase().replace(/\s+/g, '_');
    const { error } = await this.client.from('tour_plans').upsert({
      id,
      rep_name: repName,
      plan_date: dateStr,
      retailer_ids: Array.from(idSet),
      updated_at: new Date().toISOString()
    });
    if (error) console.warn('Supabase saveTodayTour error:', error.message);
  }

  // --- MGO SOP: FARMER MEETINGS, DEMOS, COMPETITOR INTEL ---
  async fetchFarmerMeetings() {
    if (!this.client) return null;
    const { data, error } = await this.client
      .from('farmer_meetings')
      .select('*')
      .order('date', { ascending: false });
    if (error) {
      console.warn('Supabase fetchFarmerMeetings note:', error.message);
      return null;
    }
    return data || [];
  }

  async fetchDemoPlots() {
    if (!this.client) return null;
    const { data, error } = await this.client
      .from('demo_plots')
      .select('*')
      .order('updated_at', { ascending: false });
    if (error) {
      console.warn('Supabase fetchDemoPlots note:', error.message);
      return null;
    }
    return data || [];
  }

  async fetchCompetitorIntel() {
    if (!this.client) return null;
    const { data, error } = await this.client
      .from('competitor_intel')
      .select('*')
      .order('date', { ascending: false });
    if (error) {
      console.warn('Supabase fetchCompetitorIntel note:', error.message);
      return null;
    }
    return data || [];
  }

  async fetchFarmerLeads() {
    if (!this.client) return null;
    const { data, error } = await this.client
      .from('farmer_leads')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      console.warn('Supabase fetchFarmerLeads note:', error.message);
      return null;
    }
    return data || [];
  }

  async fetchAqfsAudits() {
    if (!this.client) return null;
    const { data, error } = await this.client
      .from('aqfs_audits')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      console.warn('Supabase fetchAqfsAudits note:', error.message);
      return null;
    }
    return data || [];
  }

  async fetchWeeklyReviews() {
    if (!this.client) return null;
    const { data, error } = await this.client
      .from('weekly_reviews')
      .select('*')
      .order('submitted_at', { ascending: false });
    if (error) {
      console.warn('Supabase fetchWeeklyReviews note:', error.message);
      return null;
    }
    return data || [];
  }

  async fetchQuizQuestions() {
    if (!this.client) return null;
    const { data, error } = await this.client
      .from('quiz_questions')
      .select('*')
      .order('created_at', { ascending: true });
    if (error) {
      console.warn('Supabase fetchQuizQuestions note:', error.message);
      return null;
    }
    return data || [];
  }

  async fetchQuizStates() {
    if (!this.client) return null;
    const { data, error } = await this.client
      .from('quiz_states')
      .select('*');
    if (error) {
      console.warn('Supabase fetchQuizStates note:', error.message);
      return null;
    }
    return data || [];
  }

  async fetchEodReports(dateStr) {
    if (!this.client) return null;
    let query = this.client.from('eod_reports').select('*');
    if (dateStr) query = query.eq('date', dateStr);
    const { data, error } = await query.order('submitted_at', { ascending: false });
    if (error) {
      console.warn('Supabase fetchEodReports note:', error.message);
      return null;
    }
    return data || [];
  }

  // --- LEAVE APPLICATIONS (अवकाश प्रबंधन) ---
  async fetchLeaveApplications() {
    if (!this.client) return null;
    const { data, error } = await this.client
      .from('leave_applications')
      .select('*')
      .order('applied_at', { ascending: false });
    if (error) {
      console.warn('Supabase fetchLeaveApplications note:', error.message);
      return null;
    }
    return (data || []).map(r => ({
      id: r.id,
      assistant: r.assistant,
      empCode: r.emp_code || '',
      hq: r.hq || '',
      district: r.district || '',
      leaveType: r.leave_type,
      leaveLabel: r.leave_label || r.leave_type,
      fromDate: r.from_date,
      toDate: r.to_date,
      days: parseFloat(r.days || 1),
      halfDay: Boolean(r.half_day),
      session: r.session || 'full',
      reason: r.reason,
      status: r.status || 'Pending',
      appliedAt: r.applied_at,
      approvedBy: r.approved_by,
      approvedAt: r.approved_at,
      managerRemarks: r.manager_remarks
    }));
  }

  async upsertLeaveApplication(app) {
    if (!this.client) return null;
    const record = {
      id: app.id,
      assistant: app.assistant,
      emp_code: app.empCode || null,
      hq: app.hq || null,
      district: app.district || null,
      leave_type: app.leaveType,
      leave_label: app.leaveLabel || app.leaveType,
      from_date: app.fromDate,
      to_date: app.toDate,
      days: app.days,
      half_day: Boolean(app.halfDay),
      session: app.session || 'full',
      reason: app.reason,
      status: app.status || 'Pending',
      applied_at: app.appliedAt || new Date().toISOString(),
      approved_by: app.approvedBy || null,
      approved_at: app.approvedAt || null,
      manager_remarks: app.managerRemarks || null,
      updated_at: new Date().toISOString()
    };
    const { data, error } = await this.client
      .from('leave_applications')
      .upsert(record);
    if (error) {
      console.warn('Supabase upsertLeaveApplication error:', error.message);
      throw error;
    }
    return data;
  }

  // --- ATTENDANCE RECORDS ---
  async fetchAttendanceRecords() {
    if (!this.client) return null;
    const { data, error } = await this.client
      .from('attendance_records')
      .select('*')
      .order('date', { ascending: false });
    if (error) {
      console.warn('Supabase fetchAttendanceRecords note:', error.message);
      return null;
    }
    return (data || []).map(r => ({
      id: r.id,
      assistant: r.assistant,
      empCode: r.emp_code || '',
      hq: r.hq || '',
      district: r.district || '',
      date: r.date,
      punchIn: r.punch_in,
      punchInTime: r.punch_in_time,
      punchInGps: (r.punch_in_lat && r.punch_in_lng) ? {
        lat: r.punch_in_lat,
        lng: r.punch_in_lng,
        locationName: r.punch_in_location_name || ''
      } : null,
      punchOut: r.punch_out,
      punchOutTime: r.punch_out_time,
      punchOutGps: (r.punch_out_lat && r.punch_out_lng) ? {
        lat: r.punch_out_lat,
        lng: r.punch_out_lng,
        locationName: r.punch_out_location_name || ''
      } : null,
      workingMinutes: r.working_minutes || 0,
      workingHoursFormatted: r.working_hours_formatted || '',
      workMode: r.work_mode || 'Field Operations',
      status: r.status,
      statusLabel: r.status_label,
      isLate: Boolean(r.is_late),
      notes: r.notes || '',
      regularizationRequested: Boolean(r.regularization_requested),
      regularizationReason: r.regularization_reason,
      requestedStatus: r.requested_status,
      regularizationStatus: r.regularization_status
    }));
  }

  // --- TADA CLAIMS ---
  async fetchTadaClaims() {
    if (!this.client) return null;
    const { data, error } = await this.client
      .from('tada_claims')
      .select('*')
      .order('date', { ascending: false });
    if (error) {
      console.warn('Supabase fetchTadaClaims note:', error.message);
      return null;
    }
    return (data || []).map(r => ({
      id: r.id,
      assistant: r.assistant,
      hq: r.hq,
      district: r.district,
      date: r.date,
      verifiedStops: r.verified_stops || 0,
      gpsVerifiedKm: r.gps_verified_km || 0,
      claimedKm: r.claimed_km || 0,
      fuelRate: r.fuel_rate || 3.5,
      fuelAmount: r.fuel_amount || 0,
      daAmount: r.da_amount || 0,
      outstationAmount: r.outstation_amount || 0,
      incidentalAmount: r.incidental_amount || 0,
      incidentalNotes: r.incidental_notes,
      totalClaimAmount: r.total_claim_amount || 0,
      approvedAmount: r.approved_amount || 0,
      status: r.status || 'Submitted',
      auditFlags: r.audit_flags || [],
      managerNotes: r.manager_notes,
      approvedBy: r.approved_by,
      approvedAt: r.approved_at
    }));
  }
}

export const supabaseService = new SupabaseService();


