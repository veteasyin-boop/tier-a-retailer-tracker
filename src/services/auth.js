import { supabaseService } from './supabase.js';

const MANAGER_PIN_KEY = 'tat_manager_pin';
const CURRENT_REP_KEY = 'tat_assigned_rep';
const ADMIN_SESSION_KEY = 'tat_admin_session';
const AUTH_MODE_KEY = 'tat_auth_mode'; // 'cloud' | 'local'

const DEFAULT_PIN = '2026';

class AuthService {
  constructor() {
    this.currentRep = localStorage.getItem(CURRENT_REP_KEY) || '';
    this.isAdmin = sessionStorage.getItem(ADMIN_SESSION_KEY) === 'true';
    this.authMode = localStorage.getItem(AUTH_MODE_KEY) || 'local';
  }

  isCloudAuth() {
    return this.authMode === 'cloud';
  }

  async loginWithSupabase(email, password) {
    if (!supabaseService.isReady) {
      await supabaseService.init();
    }
    const { data, error } = await supabaseService.signInWithEmail(email, password);
    if (error) {
      return { success: false, error: error.message };
    }

    const user = data.user;
    const role = user?.user_metadata?.role || (email.includes('admin') || email.includes('manager') ? 'manager' : 'field_rep');
    const repName = user?.user_metadata?.rep_name || user?.email;

    if (role === 'manager') {
      this.isAdmin = true;
      sessionStorage.setItem(ADMIN_SESSION_KEY, 'true');
    } else {
      this.setAssignedRep(repName);
    }

    this.authMode = 'cloud';
    localStorage.setItem(AUTH_MODE_KEY, 'cloud');
    return { success: true, user, role, repName };
  }

  getManagerPin() {
    return localStorage.getItem(MANAGER_PIN_KEY) || DEFAULT_PIN;
  }

  setManagerPin(newPin) {
    if (!newPin || newPin.length < 4) throw new Error('PIN must be at least 4 digits');
    localStorage.setItem(MANAGER_PIN_KEY, newPin);
  }

  verifyManagerPin(inputPin) {
    const validPin = this.getManagerPin();
    return String(inputPin).trim() === String(validPin).trim();
  }

  loginAsManager(inputPin) {
    if (this.verifyManagerPin(inputPin)) {
      this.isAdmin = true;
      sessionStorage.setItem(ADMIN_SESSION_KEY, 'true');
      return true;
    }
    return false;
  }

  async logoutManager() {
    this.isAdmin = false;
    sessionStorage.removeItem(ADMIN_SESSION_KEY);
    if (this.isCloudAuth()) {
      await supabaseService.signOutUser().catch(() => {});
    }
  }

  getAssignedRep() {
    return localStorage.getItem(CURRENT_REP_KEY) || '';
  }

  isRepAuthenticated() {
    return Boolean(this.getAssignedRep());
  }

  setAssignedRep(repName) {
    this.currentRep = repName || '';
    if (repName) {
      localStorage.setItem(CURRENT_REP_KEY, repName);
    } else {
      localStorage.removeItem(CURRENT_REP_KEY);
    }
  }

  loginRep(repName, inputPassword, assistantsList = []) {
    const asst = assistantsList.find(a => a.name === repName);
    if (!asst) {
      return { success: false, error: `Representative "${repName}" not found.` };
    }

    const expectedPassword = String(asst.password || 'rep123').trim();
    if (String(inputPassword || '').trim() !== expectedPassword) {
      return { success: false, error: `Incorrect password for ${repName}. Please check or contact admin.` };
    }

    this.setAssignedRep(asst.name);
    return { success: true, rep: asst };
  }

  logoutRep() {
    this.setAssignedRep('');
  }

  // Only manager can unlock and change the assigned territory on this device
  unlockAndResetTerritory(pin) {
    if (this.verifyManagerPin(pin)) {
      this.setAssignedRep('');
      return true;
    }
    return false;
  }

  canModifyRetailer(retailerDoc) {
    if (this.isAdmin) return true;
    const rep = this.getAssignedRep();
    if (!rep) return false;
    return retailerDoc.assistant === rep;
  }
}

export const auth = new AuthService();
