import { supabaseService } from './supabase.js';
import { tenantApiGet } from './apiClient.js';
import { hasTenantCapability } from './tenantCapabilities.js';

const SELECTED_TENANT_KEY = 'growta_selected_tenant';
const CURRENT_REP_KEY = 'tat_assigned_rep';
const ADMIN_SESSION_KEY = 'tat_admin_session';
const LEGACY_PROTOTYPE_ENABLED = Boolean(
  import.meta.env?.DEV && import.meta.env?.VITE_ENABLE_LEGACY_PROTOTYPE === 'true'
);

function emitAuthChange() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('tracker:authStateChanged'));
  }
}

class AuthService {
  constructor() {
    this.session = null;
    this.user = null;
    this.tenants = [];
    this.tenantContext = null;
    this.selectedTenantId = null;
    this.status = 'initializing';
    this.error = null;
    this._legacyIsAdmin = LEGACY_PROTOTYPE_ENABLED && sessionStorage.getItem(ADMIN_SESSION_KEY) === 'true';
    this.currentRep = LEGACY_PROTOTYPE_ENABLED ? (localStorage.getItem(CURRENT_REP_KEY) || '') : '';
    this.authMode = 'tenant';
    this.authSubscription = null;
  }

  get isAdmin() {
    return LEGACY_PROTOTYPE_ENABLED && this._legacyIsAdmin;
  }

  set isAdmin(value) {
    if (!LEGACY_PROTOTYPE_ENABLED) return;
    this._legacyIsAdmin = Boolean(value);
    if (this._legacyIsAdmin) sessionStorage.setItem(ADMIN_SESSION_KEY, 'true');
    else sessionStorage.removeItem(ADMIN_SESSION_KEY);
  }

  get isTenantAuthenticated() {
    return Boolean(
      this.user?.id
      && this.tenantContext?.userId === this.user.id
      && this.tenantContext?.tenantId === this.selectedTenantId
      && this.selectedTenantId
    );
  }

  get isAuthenticated() {
    return Boolean(this.user);
  }

  isLegacyPrototypeEnabled() {
    return LEGACY_PROTOTYPE_ENABLED;
  }

  async initialize() {
    const ready = await supabaseService.init();
    if (!ready) {
      this.status = 'configuration_error';
      this.error = 'Supabase is not configured. Check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.';
      emitAuthChange();
      return this.getState();
    }

    if (!this.authSubscription) {
      this.authSubscription = supabaseService.onAuthStateChange((event, nextSession) => {
        if (event === 'SIGNED_OUT' || !nextSession) {
          this.clearIdentity('signed_out');
          return;
        }
        if (event === 'SIGNED_IN' && nextSession.user?.id !== this.user?.id) {
          this.tenantContext = null;
          this.selectedTenantId = null;
          this.tenants = [];
          localStorage.removeItem(SELECTED_TENANT_KEY);
          this.status = 'loading_tenants';
        }
        if (event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN' || event === 'USER_UPDATED') {
          this.session = nextSession;
          this.user = nextSession.user || this.user;
          emitAuthChange();
        }
      });
    }

    const session = await supabaseService.getCurrentSession();
    if (!session) {
      this.clearIdentity('signed_out');
      return this.getState();
    }

    try {
      await this.loadAuthenticatedIdentity(session);
    } catch (error) {
      this.error = error.message || 'Unable to restore your session.';
      this.status = 'error';
      emitAuthChange();
    }

    return this.getState();
  }

  async signIn(email, password) {
    const normalizedEmail = String(email || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      throw new Error('Enter a valid email address.');
    }
    if (typeof password !== 'string' || password.length < 1 || password.length > 256) {
      throw new Error('Enter your password.');
    }

    const ready = await supabaseService.init();
    if (!ready) throw new Error('Supabase is not configured.');
    const { data, error } = await supabaseService.signInWithEmail(normalizedEmail, password);
    if (error) throw new Error(error.message || 'Email or password is incorrect.');

    await this.loadAuthenticatedIdentity(data.session);
    return this.getState();
  }

  async loadAuthenticatedIdentity(session) {
    if (!session?.access_token) throw new Error('Supabase did not return an authenticated session.');
    this.session = session;
    const user = await supabaseService.getCurrentUser();
    if (!user?.id) throw new Error('Supabase could not verify the signed-in user.');
    this.user = user;
    this.tenants = [];
    this.tenantContext = null;
    this.selectedTenantId = null;
    this.status = 'loading_tenants';
    this.error = null;
    emitAuthChange();

    let response;
    try {
      response = await tenantApiGet('/tenants');
    } catch (error) {
      this.status = 'error';
      this.error = error.message || 'Unable to load tenant memberships.';
      emitAuthChange();
      throw error;
    }
    this.tenants = Array.isArray(response.data) ? response.data : [];
    if (this.tenants.length === 0) {
      this.status = 'no_memberships';
      localStorage.removeItem(SELECTED_TENANT_KEY);
      emitAuthChange();
      return;
    }

    const rememberedTenantId = localStorage.getItem(SELECTED_TENANT_KEY);
    if (rememberedTenantId && this.tenants.some((tenant) => tenant.id === rememberedTenantId)) {
      try {
        await this.selectTenant(rememberedTenantId);
        return;
      } catch {
        localStorage.removeItem(SELECTED_TENANT_KEY);
      }
    }

    this.status = 'tenant_selection';
    emitAuthChange();
  }

  async selectTenant(tenantId) {
    if (typeof tenantId !== 'string' || !this.tenants.some((tenant) => tenant.id === tenantId)) {
      throw new Error('Select a tenant from your active memberships.');
    }

    const response = await tenantApiGet('/tenants/me', tenantId);
    if (!response.data || response.data.tenantId !== tenantId || response.data.userId !== this.user?.id) {
      throw new Error('The API returned an invalid tenant context.');
    }

    this.selectedTenantId = tenantId;
    this.tenantContext = response.data;
    localStorage.setItem(SELECTED_TENANT_KEY, tenantId);
    this.status = 'tenant_ready';
    this.error = null;
    emitAuthChange();
    return this.tenantContext;
  }

  async refreshTenantMemberships() {
    const session = await supabaseService.getCurrentSession();
    if (!session?.access_token) {
      this.clearIdentity('signed_out');
      throw new Error('Your session has expired. Sign in again.');
    }
    await this.loadAuthenticatedIdentity(session);
    return this.getState();
  }

  clearSelectedTenant() {
    this.selectedTenantId = null;
    this.tenantContext = null;
    localStorage.removeItem(SELECTED_TENANT_KEY);
    this.status = this.tenants.length ? 'tenant_selection' : 'no_memberships';
    emitAuthChange();
  }

  async signOut() {
    await supabaseService.signOutUser();
    this.clearIdentity('signed_out');
  }

  async requestPasswordReset(email) {
    const normalizedEmail = String(email || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      throw new Error('Enter a valid email address.');
    }
    const ready = await supabaseService.init();
    if (!ready) throw new Error('Supabase is not configured.');
    const { error } = await supabaseService.resetPasswordForEmail(normalizedEmail, window.location.origin);
    if (error) throw new Error(error.message || 'Password reset request failed.');
  }

  clearIdentity(status = 'signed_out') {
    this.session = null;
    this.user = null;
    this.tenants = [];
    this.tenantContext = null;
    this.selectedTenantId = null;
    this.status = status;
    this.error = null;
    localStorage.removeItem(SELECTED_TENANT_KEY);
    emitAuthChange();
  }

  getState() {
    return {
      status: this.status,
      error: this.error,
      user: this.user ? { id: this.user.id, email: this.user.email || '' } : null,
      tenants: this.tenants,
      selectedTenantId: this.selectedTenantId,
      tenantContext: this.tenantContext
    };
  }

  can(permission) {
    return Boolean(this.tenantContext?.permissions?.includes(permission));
  }

  canAny(permissions = []) {
    return permissions.some((permission) => this.can(permission));
  }

  canCapability(capability) {
    return hasTenantCapability(this.tenantContext, capability);
  }

  getSyncIdentity() {
    if (!this.isTenantAuthenticated) return null;
    return { userId: this.user.id, tenantId: this.selectedTenantId };
  }

  // The following compatibility methods exist only for an explicitly enabled
  // Vite development prototype. They are never enabled in production builds.
  getManagerPin() {
    if (!LEGACY_PROTOTYPE_ENABLED) return null;
    return import.meta.env?.VITE_LEGACY_MANAGER_PIN || null;
  }

  setManagerPin() {
    throw new Error('Local manager PIN changes are disabled. Use Supabase Auth and tenant permissions.');
  }

  verifyManagerPin(inputPin) {
    const configuredPin = this.getManagerPin();
    return Boolean(configuredPin && String(inputPin) === String(configuredPin));
  }

  loginAsManager(inputPin) {
    if (!LEGACY_PROTOTYPE_ENABLED || !this.verifyManagerPin(inputPin)) return false;
    this.isAdmin = true;
    return true;
  }

  async logoutManager() {
    this.isAdmin = false;
    if (this.authMode === 'cloud') await this.signOut();
  }

  getAssignedRep() {
    return LEGACY_PROTOTYPE_ENABLED ? (localStorage.getItem(CURRENT_REP_KEY) || '') : '';
  }

  isRepAuthenticated() {
    return LEGACY_PROTOTYPE_ENABLED && Boolean(this.getAssignedRep());
  }

  setAssignedRep(repName) {
    if (!LEGACY_PROTOTYPE_ENABLED) return;
    this.currentRep = repName || '';
    if (repName) localStorage.setItem(CURRENT_REP_KEY, repName);
    else localStorage.removeItem(CURRENT_REP_KEY);
  }

  loginRep(repName, inputPassword, assistantsList = []) {
    if (!LEGACY_PROTOTYPE_ENABLED) return { success: false, error: 'Use your individual email and password to sign in.' };
    const assistant = assistantsList.find((item) => item.name === repName);
    if (!assistant) return { success: false, error: 'Representative record not found.' };
    const expectedPassword = typeof assistant.password === 'string' ? assistant.password : '';
    if (!expectedPassword || String(inputPassword || '') !== expectedPassword) {
      return { success: false, error: 'No valid local password is configured. Contact the system administrator.' };
    }
    this.setAssignedRep(assistant.name);
    return { success: true, rep: assistant };
  }

  logoutRep() {
    this.setAssignedRep('');
  }

  unlockAndResetTerritory(pin) {
    if (!LEGACY_PROTOTYPE_ENABLED || !this.verifyManagerPin(pin)) return false;
    this.setAssignedRep('');
    return true;
  }

  canModifyRetailer(retailerDoc) {
    if (this.isAdmin) return true;
    const rep = this.getAssignedRep();
    return Boolean(LEGACY_PROTOTYPE_ENABLED && rep && retailerDoc?.assistant === rep);
  }

  // Compatibility alias: never infer role from email or user-editable metadata.
  async loginWithSupabase(email, password) {
    return this.signIn(email, password);
  }
}

export const auth = new AuthService();
export { LEGACY_PROTOTYPE_ENABLED };
