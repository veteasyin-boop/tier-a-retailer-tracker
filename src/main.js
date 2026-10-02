import './styles/main.css';
import { storage } from './services/storage.js';
import { auth } from './services/auth.js';
import { renderFieldView, switchFieldSubTab, updateTourNavBadge, closeCounterBottomSheet } from './components/fieldView.js';
import { renderAdminView } from './components/adminView.js';
import { showToast } from './components/toast.js';
import { promptManagerPin } from './components/pinModal.js';
import { openSupabaseModal } from './components/supabaseModal.js';
import { initPWA } from './services/pwa.js';

let currentView = 'field';

async function bootstrap() {
  initTheme();
  initRole();
  initTabs();
  initBottomNav();
  initFab();
  initPWA();

  document.getElementById('storagePill')?.addEventListener('click', () => {
    if (auth.isAdmin) {
      openSupabaseModal();
    }
  });

  // Storage initialization
  await storage.init();
  updateRoleUI();

  const loadingEl = document.getElementById('loading');
  if (loadingEl) loadingEl.classList.add('hidden');

  const mainView = document.getElementById('mainViewContainer');
  if (mainView) mainView.classList.remove('hidden');

  renderCurrentView();
  updateTourNavBadge();

  window.addEventListener('tracker:dataChanged', () => {
    renderCurrentView();
    updateTourNavBadge();
  });

  window.addEventListener('tracker:roleChanged', () => {
    updateRoleUI();
    updateTourNavBadge();
    switchView('field');
  });

  window.addEventListener('tracker:syncStatus', (e) => {
    const { isOnline, isSyncing, pendingCount } = e.detail || {};
    const storageLabel = document.getElementById('storageLabel');
    const storagePill = document.getElementById('storagePill');
    if (storageLabel) {
      if (isSyncing) {
        storageLabel.textContent = `Syncing (${pendingCount})...`;
      } else if (pendingCount > 0) {
        storageLabel.textContent = isOnline ? `Queued (${pendingCount})` : `Offline (${pendingCount})`;
      } else {
        storageLabel.textContent = isOnline ? 'Supabase Connected' : 'Offline Mode';
      }
    }
    if (storagePill) {
      storagePill.title = `Network: ${isOnline ? 'Online' : 'Offline'} • Pending queue in IndexedDB: ${pendingCount || 0} • Click to configure Supabase`;
    }
  });

  // ESC key closes bottom sheet
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeCounterBottomSheet();
  });
}

function initTheme() {
  const saved = localStorage.getItem('tat_theme');
  if (saved) {
    document.documentElement.setAttribute('data-theme', saved);
  }

  const themeToggle = document.getElementById('themeToggle');
  themeToggle?.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme') || 
      (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('tat_theme', next);
    showToast(`Switched to ${next} theme`, next === 'dark' ? '🌙' : '☀️');
  });
}

function initRole() {
  const roleToggle = document.getElementById('roleToggle');
  const adminLogoutBtn = document.getElementById('adminLogoutBtn');
  updateRoleUI();

  const handleLogout = () => {
    if (auth.isAdmin) {
      auth.logoutManager();
      showToast('Admin logged out successfully. Returned to Field Mode', '🔒');
    } else if (auth.isRepAuthenticated()) {
      auth.logoutRep();
      showToast('Field Assistant logged out successfully.', '🔒');
    }
    updateRoleUI();
    window.dispatchEvent(new CustomEvent('tracker:roleChanged'));
    switchView('field');
    syncBottomNav('counters');
  };

  adminLogoutBtn?.addEventListener('click', handleLogout);

  roleToggle?.addEventListener('click', async () => {
    if (auth.isAdmin) {
      handleLogout();
    } else if (auth.isRepAuthenticated()) {
      handleLogout();
    } else {
      const authorized = await promptManagerPin('Enter Manager PIN', 'Admin mode allows managing all 8 territories, reassigning dealers, and exports.');
      if (authorized) {
        auth.loginAsManager(auth.getManagerPin());
        updateRoleUI();
        showToast('Admin Mode unlocked', '👑');
        switchView('admin');
        syncBottomNav('admin');
      }
    }
  });
}

function updateRoleUI() {
  const roleBtn = document.getElementById('roleToggle');
  const logoutBtn = document.getElementById('adminLogoutBtn');
  const storagePill = document.getElementById('storagePill');

  // Supabase cloud connected tab must never be shown to assistant or on homepage.
  // It is only visible in Admin (Manager) mode when inspecting records.
  if (storagePill) {
    storagePill.style.display = (auth.isAdmin && currentView === 'admin') ? 'inline-flex' : 'none';
  }

  if (roleBtn) {
    if (auth.isAdmin) {
      roleBtn.textContent = 'Admin Mode (Active)';
      roleBtn.classList.add('btn-primary');
      roleBtn.classList.remove('btn-secondary');
    } else if (auth.isRepAuthenticated()) {
      roleBtn.textContent = `👤 ${auth.getAssignedRep()}`;
      roleBtn.classList.remove('btn-primary');
      roleBtn.classList.add('btn-secondary');
    } else {
      roleBtn.textContent = '👑 Admin Login';
      roleBtn.classList.remove('btn-primary');
      roleBtn.classList.add('btn-secondary');
    }
  }
  if (logoutBtn) {
    logoutBtn.style.display = (auth.isAdmin || auth.isRepAuthenticated()) ? 'inline-flex' : 'none';
    logoutBtn.title = auth.isAdmin ? 'Logout from Admin Mode' : 'Logout Assistant';
  }
}

function initTabs() {
  document.getElementById('tabField')?.addEventListener('click', () => {
    switchView('field');
    syncBottomNav('counters');
  });
  document.getElementById('tabAdmin')?.addEventListener('click', async () => {
    if (auth.isAdmin) {
      switchView('admin');
      syncBottomNav('admin');
    } else {
      const authorized = await promptManagerPin('Manager Authorization Required', 'Enter Manager PIN to access executive analytics & master directory.');
      if (authorized) {
        auth.loginAsManager(auth.getManagerPin());
        updateRoleUI();
        showToast('Admin Mode unlocked', '👑');
        switchView('admin');
        syncBottomNav('admin');
      }
    }
  });
}

function initBottomNav() {
  const bCounters = document.getElementById('bNavCounters');
  const bTour = document.getElementById('bNavTour');
  const bAudit = document.getElementById('bNavAudit');
  const bAdmin = document.getElementById('bNavAdmin');

  bCounters?.addEventListener('click', () => {
    syncBottomNav('counters');
    switchView('field');
    switchFieldSubTab('nearby');
  });

  bTour?.addEventListener('click', () => {
    syncBottomNav('tour');
    switchView('field');
    switchFieldSubTab('tour');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  bAudit?.addEventListener('click', async () => {
    if (!auth.isAdmin) {
      const authorized = await promptManagerPin('GPS Audit Trail Access', 'Enter Manager PIN to access Live GPS Check-Ins & Journey Audit.');
      if (!authorized) return;
      auth.loginAsManager(auth.getManagerPin());
      updateRoleUI();
    }
    syncBottomNav('audit');
    switchView('admin');
    // Pre-activate GPS tab in admin view
    setTimeout(() => {
      const gpsTabBtn = document.getElementById('subTabCheckIns');
      gpsTabBtn?.click();
    }, 50);
  });

  bAdmin?.addEventListener('click', async () => {
    if (auth.isAdmin) {
      syncBottomNav('admin');
      switchView('admin');
    } else {
      const authorized = await promptManagerPin('Manager Authorization Required', 'Enter Manager PIN to access executive analytics & master directory.');
      if (authorized) {
        auth.loginAsManager(auth.getManagerPin());
        updateRoleUI();
        showToast('Admin Mode unlocked', '👑');
        syncBottomNav('admin');
        switchView('admin');
      }
    }
  });
}

function syncBottomNav(activeView) {
  const items = {
    counters: document.getElementById('bNavCounters'),
    tour: document.getElementById('bNavTour'),
    audit: document.getElementById('bNavAudit'),
    admin: document.getElementById('bNavAdmin')
  };

  Object.entries(items).forEach(([key, el]) => {
    if (el) el.classList.toggle('active', key === activeView);
  });
}

function initFab() {
  const fab = document.getElementById('fabRefresh');
  fab?.addEventListener('click', () => {
    // If on field view, trigger refresh flow
    const mainRefreshBtn = document.getElementById('btnMainRefresh');
    const topRefreshBtn = document.getElementById('btnTopRefresh');

    if (topRefreshBtn) {
      topRefreshBtn.click();
    } else if (mainRefreshBtn) {
      mainRefreshBtn.click();
    } else {
      showToast('Switching to Counters view to refresh location', '📍');
      syncBottomNav('counters');
      switchView('field');
      setTimeout(() => {
        const btn = document.getElementById('btnTopRefresh') || document.getElementById('btnMainRefresh');
        btn?.click();
      }, 100);
    }
  });
}

function switchView(view) {
  currentView = view;
  document.getElementById('tabField')?.classList.toggle('active', view === 'field');
  document.getElementById('tabAdmin')?.classList.toggle('active', view === 'admin');
  const storagePill = document.getElementById('storagePill');
  if (storagePill) {
    storagePill.style.display = (auth.isAdmin && view === 'admin') ? 'inline-flex' : 'none';
  }
  renderCurrentView();
  updateTourNavBadge();
}

function renderCurrentView() {
  const container = document.getElementById('mainViewContainer');
  if (!container) return;

  if (currentView === 'field') {
    renderFieldView(container, storage.rows);
  } else {
    if (!auth.isAdmin) {
      switchView('field');
      syncBottomNav('counters');
      return;
    }
    renderAdminView(container, storage.rows);
  }
}

bootstrap();

