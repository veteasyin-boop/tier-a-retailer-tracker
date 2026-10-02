let toastTimer = null;

export function showToast(message, icon = '✓') {
  let toastEl = document.getElementById('toast');
  if (!toastEl) {
    toastEl = document.createElement('div');
    toastEl.id = 'toast';
    document.body.appendChild(toastEl);
  }

  toastEl.innerHTML = `<span style="font-size:16px;">${icon}</span> <span>${message}</span>`;
  toastEl.classList.add('show');

  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toastEl.classList.remove('show');
  }, 2400);
}
