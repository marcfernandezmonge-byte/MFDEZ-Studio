/* =========================================
   GRID STUDIO — SERVICIOS — script.js
   ========================================= */


// Close on Escape
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeMenu();
    document.querySelectorAll('.modal-overlay.open').forEach(closeModal);
  }
});

// === MODAL SYSTEM ===
window.openModal = function (id) {
  const overlay = document.getElementById(id);
  if (!overlay) return;
  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';
  // Focus first input
  const firstInput = overlay.querySelector('input, select, textarea');
  if (firstInput) setTimeout(() => firstInput.focus(), 300);
};

window.closeModal = function (target) {
  // target can be overlay element or click event target
  const overlay = target?.currentTarget || target;
  if (!overlay) return;
  // Only close if click is directly on overlay (not modal content)
  if (target?.type === 'click' && target.target !== overlay) return;
  overlay.classList.remove('open');
  // Only restore scroll if no other modals are open
  if (!document.querySelector('.modal-overlay.open')) {
    document.body.style.overflow = '';
  }
};

// Handle overlay click — close only when clicking the backdrop
document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeModal(overlay);
  });
});

// === FORM SUBMIT ===
window.handleFormSubmit = function (e) {
  e.preventDefault();
  const form = e.target;
  const btn = form.querySelector('[type="submit"]');
  const originalText = btn.textContent;

  btn.textContent = 'Enviando...';
  btn.disabled = true;

  // Simulate async (replace with real fetch when backend ready)
  setTimeout(() => {
    // Close modal
    const overlay = form.closest('.modal-overlay');
    if (overlay) closeModal(overlay);

    // Reset form
    form.reset();
    btn.textContent = originalText;
    btn.disabled = false;

    // Show toast
    showToast('Solicitud enviada — te contactamos en 24h.');
  }, 1200);
};

// === TOAST ===
let toastTimeout;
function showToast(msg) {
  const toast = document.getElementById('toast');
  const msgEl = toast.querySelector('.toast__msg');
  if (msgEl) msgEl.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => toast.classList.remove('show'), 4000);
}

// === SCROLL REVEAL ===
const revealObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        revealObserver.unobserve(entry.target);
      }
    });
  },
  {
    threshold: 0.1,
    rootMargin: '0px 0px -60px 0px',
  }
);

// Stagger children inside each reveal block
document.querySelectorAll('.reveal').forEach((el, i) => {
  el.style.transitionDelay = `${(i % 4) * 0.08}s`;
  revealObserver.observe(el);
});

// === SMOOTH ANCHOR SCROLL ===
document.querySelectorAll('a[href^="#"]').forEach(link => {
  link.addEventListener('click', (e) => {
    const id = link.getAttribute('href').slice(1);
    const target = document.getElementById(id);
    if (!target) return;
    e.preventDefault();
    const offset = nav.offsetHeight + 20;
    const top = target.getBoundingClientRect().top + window.scrollY - offset;
    window.scrollTo({ top, behavior: 'smooth' });
  });
});

// === HERO TITLE STAGGER ===
const heroLines = document.querySelectorAll('.hero__title-line');
heroLines.forEach((line, i) => {
  line.style.opacity = '0';
  line.style.transform = 'translateY(30px)';
  line.style.transition = `opacity 0.7s ease ${0.15 + i * 0.1}s, transform 0.7s ease ${0.15 + i * 0.1}s`;
});

window.addEventListener('load', () => {
  heroLines.forEach((line) => {
    line.style.opacity = '1';
    line.style.transform = 'translateY(0)';
  });
  // Trigger hero reveal items
  document.querySelectorAll('.hero .reveal').forEach((el, i) => {
    setTimeout(() => el.classList.add('visible'), 600 + i * 100);
  });
});

// === PACK VISUAL HOVER PARALLAX ===
document.querySelectorAll('.pack-block').forEach(block => {
  const visual = block.querySelector('.pack-block__visual');
  if (!visual) return;

  block.addEventListener('mousemove', (e) => {
    const rect = block.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    visual.style.transform = `translate(${x * 8}px, ${y * 8}px)`;
  });

  block.addEventListener('mouseleave', () => {
    visual.style.transform = '';
    visual.style.transition = 'transform 0.5s ease';
  });
  block.addEventListener('mouseenter', () => {
    visual.style.transition = 'transform 0.1s linear';
  });
});

// === SERVICE CARD MAGNETIC BUTTON ===
document.querySelectorAll('.service-card__btn').forEach(btn => {
  btn.addEventListener('mousemove', (e) => {
    const rect = btn.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;
    btn.style.transform = `translate(${x * 0.18}px, ${y * 0.18}px)`;
  });
  btn.addEventListener('mouseleave', () => {
    btn.style.transform = '';
  });
});

// === TELEMETRY DATA TICKER (hero label) ===
const labels = [
  'Season 2024 · Active',
  '7 Campeonatos · Cubiertos',
  '120+ Eventos · Entregados',
  'Próxima cita · Disponible',
];
const labelText = document.querySelector('.hero__label span:last-child');
if (labelText) {
  let li = 0;
  setInterval(() => {
    li = (li + 1) % labels.length;
    labelText.style.opacity = '0';
    labelText.style.transform = 'translateY(-6px)';
    setTimeout(() => {
      labelText.textContent = labels[li];
      labelText.style.opacity = '1';
      labelText.style.transform = 'translateY(0)';
    }, 300);
  }, 3500);

  labelText.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
}
