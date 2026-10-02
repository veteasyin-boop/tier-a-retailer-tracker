import { showToast } from '../components/toast.js';

let deferredPrompt = null;

export function initPWA() {
  registerServiceWorker();
  initInstallPrompt();
}

function registerServiceWorker() {
  if (typeof window === 'undefined') return;

  if ('serviceWorker' in navigator && (window.location.protocol === 'https:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js')
        .then((reg) => {
          console.log('⚡ PWA Service Worker active:', reg.scope);
          // Check for service worker updates
          reg.addEventListener('updatefound', () => {
            const installing = reg.installing;
            if (installing) {
              installing.addEventListener('statechange', () => {
                if (installing.state === 'installed' && navigator.serviceWorker.controller) {
                  showToast('App update available! Refresh to load new features.', '🔄');
                }
              });
            }
          });
        })
        .catch((err) => {
          console.warn('PWA Service Worker registration warning:', err);
        });
    });
  }
}

function initInstallPrompt() {
  const installBtn = document.getElementById('btnInstallPwa');

  // Check if running in standalone mode (already installed)
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  if (isStandalone) {
    console.log('📱 Running in native standalone PWA mode');
    return;
  }

  // 1. Android / Chrome / Edge beforeinstallprompt
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;

    if (installBtn) {
      installBtn.style.display = 'inline-flex';
      installBtn.onclick = promptInstall;
    }

    renderFloatingInstallBanner();
  });

  // 2. Post-installation listener
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    if (installBtn) installBtn.style.display = 'none';
    const banner = document.getElementById('pwaInstallBanner');
    if (banner) banner.remove();
    showToast('Tier A Tracker installed to your home screen! 🎉', '📱');
  });

  // 3. iOS Safari detection
  const isIos = /iphone|ipad|ipod/.test(window.navigator.userAgent.toLowerCase());
  if (isIos && !isStandalone) {
    const hasSeenIosPrompt = sessionStorage.getItem('tat_ios_install_seen');
    if (!hasSeenIosPrompt) {
      setTimeout(() => {
        renderIosInstallPrompt();
      }, 3500);
    }
  }
}

export async function promptInstall() {
  if (!deferredPrompt) {
    showToast('Install prompt not available. You can add this page from browser menu (⋮ > Add to Home screen)', 'ℹ️');
    return;
  }

  deferredPrompt.prompt();
  const choice = await deferredPrompt.userChoice;
  if (choice.outcome === 'accepted') {
    showToast('Installing app to home screen…', '📲');
  }
  deferredPrompt = null;
  const banner = document.getElementById('pwaInstallBanner');
  if (banner) banner.remove();
}

function renderFloatingInstallBanner() {
  if (document.getElementById('pwaInstallBanner')) return;

  const banner = document.createElement('div');
  banner.id = 'pwaInstallBanner';
  banner.style.cssText = `
    position: fixed;
    top: 14px;
    left: 50%;
    transform: translateX(-50%);
    width: min(92%, 460px);
    background: var(--surface-glass);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    border: 1px solid var(--primary);
    box-shadow: 0 12px 36px rgba(0, 0, 0, 0.16);
    border-radius: var(--radius-lg);
    padding: 12px 16px;
    z-index: 9999;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    animation: slideDown 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  `;

  banner.innerHTML = `
    <div style="display: flex; align-items: center; gap: 10px; flex: 1; min-width: 0;">
      <div style="width: 38px; height: 38px; border-radius: var(--radius-md); background: linear-gradient(135deg, #15803d, #22c55e); display: flex; align-items: center; justify-content: center; font-size: 20px; flex-shrink: 0; box-shadow: 0 4px 10px rgba(21, 128, 61, 0.3);">
        🌱
      </div>
      <div style="min-width: 0;">
        <strong style="font-size: 13px; font-weight: 700; color: var(--ink); display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
          Install Tier A Tracker
        </strong>
        <span style="font-size: 11px; color: var(--muted); display: block;">
          Install as native app for 0ms offline access &amp; instant GPS
        </span>
      </div>
    </div>
    <div style="display: flex; align-items: center; gap: 6px; flex-shrink: 0;">
      <button class="btn btn-primary btn-sm" id="btnBannerInstall" style="padding: 6px 12px; font-size: 12px; font-weight: 700;">
        Install
      </button>
      <button id="btnBannerClose" aria-label="Dismiss banner" style="background: none; border: none; font-size: 18px; color: var(--muted); cursor: pointer; padding: 4px;">
        &times;
      </button>
    </div>
  `;

  document.body.appendChild(banner);

  document.getElementById('btnBannerInstall')?.addEventListener('click', promptInstall);
  document.getElementById('btnBannerClose')?.addEventListener('click', () => {
    banner.remove();
  });
}

function renderIosInstallPrompt() {
  if (document.getElementById('iosInstallPrompt')) return;

  const tip = document.createElement('div');
  tip.id = 'iosInstallPrompt';
  tip.style.cssText = `
    position: fixed;
    bottom: calc(75px + env(safe-area-inset-bottom, 0px));
    left: 50%;
    transform: translateX(-50%);
    width: min(92%, 400px);
    background: var(--surface-glass);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    border: 1px solid var(--line-strong);
    border-radius: var(--radius-lg);
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.15);
    padding: 14px 16px;
    z-index: 800;
    display: flex;
    flex-direction: column;
    gap: 8px;
  `;

  tip.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: flex-start;">
      <div style="display: flex; align-items: center; gap: 8px;">
        <span style="font-size: 18px;">📲</span>
        <strong style="font-size: 13px;">Install on iPhone / iPad</strong>
      </div>
      <button id="btnIosClose" style="background: none; border: none; font-size: 18px; color: var(--muted); cursor: pointer;">&times;</button>
    </div>
    <div style="font-size: 12px; color: var(--muted); line-height: 1.5;">
      Tap the <strong>Share</strong> button <span style="font-size: 14px;">📤</span> in Safari, then scroll down and tap <strong>Add to Home Screen (➕)</strong>.
    </div>
  `;

  document.body.appendChild(tip);
  sessionStorage.setItem('tat_ios_install_seen', 'true');

  document.getElementById('btnIosClose')?.addEventListener('click', () => {
    tip.remove();
  });
}
