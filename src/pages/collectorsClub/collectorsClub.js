/**
 * Collector's Club — MFDEZ Studio
 * collectorsClub.js  (~2.8KB minified)
 *
 * Sistemas:
 *  1. Navbar height detection → CSS var --cc-nav-h
 *  2. Slot counter animated entry
 *  3. Countdown timer (real-time)
 *  4. Pricing toggle (monthly / annual)
 *  5. Modal open / close / checkout flow
 *  6. Card input formatting
 *  7. Scroll reveal (IntersectionObserver)
 */
(function () {
  'use strict';

  /* ── 1. NAVBAR HEIGHT DETECTION ──────────────────────────── */
  function detectNavbar() {
    // Intentar detectar navbar por clase o tag común
    const nav = document.querySelector('nav, header, [class*="nav"], [class*="Nav"]');
    if (nav) {
      const h = nav.getBoundingClientRect().height;
      if (h > 0) {
        document.documentElement.style.setProperty('--cc-nav-h', `${h}px`);
        return;
      }
    }
    // Fallback: mantener el valor por defecto del CSS (72px)
  }

  /* ── 2. SLOT COUNTER ANIMATION ────────────────────────────── */
  function animateSlotCounter() {
    const el = document.getElementById('slotCount');
    if (!el) return;
    const target = 53;
    const start  = 61;
    let   current = start;
    const step = () => {
      if (current <= target) { el.textContent = current; return; }
      el.textContent = current--;
      setTimeout(step, 80 + Math.random() * 60);
    };
    setTimeout(step, 600);
  }

  /* ── 3. COUNTDOWN TIMER ───────────────────────────────────── */
  function initCountdown() {
    // Target: 4 días 18 horas desde ahora
    const target = new Date(Date.now() + ((4 * 24 + 18) * 3600 + 33 * 60 + 7) * 1000);

    const pad  = n => String(Math.max(0, Math.floor(n))).padStart(2, '0');
    const els  = {
      d: document.getElementById('cd-d'),
      h: document.getElementById('cd-h'),
      m: document.getElementById('cd-m'),
      s: document.getElementById('cd-s'),
    };

    function tick() {
      const diff = target - Date.now();
      if (diff <= 0) {
        Object.values(els).forEach(el => { if (el) el.textContent = '00'; });
        return;
      }
      const d = diff / 86400000;
      const h = (diff % 86400000) / 3600000;
      const m = (diff % 3600000)  / 60000;
      const s = (diff % 60000)    / 1000;

      if (els.d) els.d.textContent = pad(d);
      if (els.h) els.h.textContent = pad(h);
      if (els.m) els.m.textContent = pad(m);

      // Tick animation on seconds
      if (els.s) {
        const newS = pad(s);
        if (els.s.textContent !== newS) {
          els.s.classList.remove('tick');
          void els.s.offsetWidth;          // reflow to restart animation
          els.s.textContent = newS;
          els.s.classList.add('tick');
        }
      }
    }

    tick();
    setInterval(tick, 1000);
  }

  /* ── 4. PRICING TOGGLE ────────────────────────────────────── */
  function initPricingToggle() {
    const toggle   = document.getElementById('priceToggle');
    const priceNum = document.getElementById('priceNum');
    const pricePer = document.getElementById('pricePer');
    const priceNote= document.getElementById('priceNote');
    if (!toggle) return;

    const plans = {
      monthly: { num: '15', per: '/mes', note: 'Sin permanencia. Cancela cuando quieras.' },
      annual:  { num: '13', per: '/mes', note: 'Facturado anualmente (162€/año). Ahorra 18€.' },
    };

    toggle.addEventListener('click', e => {
      const btn = e.target.closest('[data-plan]');
      if (!btn) return;
      const plan = btn.dataset.plan;
      if (!plans[plan]) return;

      // Update active button
      toggle.querySelectorAll('[data-plan]').forEach(b => b.classList.remove('cc-toggle__btn--active'));
      btn.classList.add('cc-toggle__btn--active');

      // Animate price change
      if (priceNum) {
        priceNum.style.transform = 'translateY(-6px)';
        priceNum.style.opacity   = '0';
        setTimeout(() => {
          priceNum.textContent     = plans[plan].num;
          priceNum.style.transform = 'translateY(0)';
          priceNum.style.opacity   = '1';
        }, 180);
        priceNum.style.transition = 'transform 0.18s ease, opacity 0.18s ease';
      }
      if (pricePer)  pricePer.textContent  = plans[plan].per;
      if (priceNote) priceNote.textContent  = plans[plan].note;
    });
  }

  /* ── 5. MODAL ─────────────────────────────────────────────── */
  function initModal() {
    const overlay = document.getElementById('modalOverlay');
    const step1   = document.getElementById('step1');
    const step2   = document.getElementById('step2');
    const closeBtn= document.getElementById('modalClose');
    const form    = document.getElementById('checkoutForm');
    const confirmCloseBtn = document.getElementById('confirmClose');
    if (!overlay) return;

    function openModal() {
      overlay.classList.add('is-open');
      overlay.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
      // Focus first input
      setTimeout(() => {
        const first = overlay.querySelector('input, button');
        if (first) first.focus();
      }, 320);
    }

    function closeModal() {
      overlay.classList.remove('is-open');
      overlay.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
    }

    // All CTAs open modal
    document.querySelectorAll('[data-modal="open"]').forEach(btn => {
      btn.addEventListener('click', openModal);
    });

    // Close triggers
    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (confirmCloseBtn) confirmCloseBtn.addEventListener('click', closeModal);

    // Click outside modal
    overlay.addEventListener('click', e => {
      if (e.target === overlay) closeModal();
    });

    // Escape key
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && overlay.classList.contains('is-open')) closeModal();
    });

    // Form submit → show confirmation
    if (form) {
      form.addEventListener('submit', e => {
        e.preventDefault();
        const submitBtn = document.getElementById('submitBtn');
        if (submitBtn) {
          submitBtn.textContent = 'Procesando...';
          submitBtn.disabled    = true;
        }
        // Simulate processing
        setTimeout(() => {
          if (step1) step1.classList.add('cc-modal__step--hidden');
          if (step2) step2.classList.remove('cc-modal__step--hidden');
          // Update slots
          const sl   = document.getElementById('slotsLeft');
          const sb   = document.getElementById('slotCount');
          const slots = 47;
          if (sl)  sl.textContent  = slots - 1;
          if (sb)  sb.textContent  = '54';
        }, 1200);
      });
    }
  }

  /* ── 6. CARD INPUT FORMATTING ─────────────────────────────── */
  function initCardInput() {
    const cardInput = document.getElementById('cardInput');
    if (!cardInput) return;
    cardInput.addEventListener('input', e => {
      let v = e.target.value.replace(/\D/g, '').slice(0, 16);
      e.target.value = v.replace(/(.{4})/g, '$1 ').trim();
    });

    const expInput = document.getElementById('expInput');
    if (expInput) {
      expInput.addEventListener('input', e => {
        let v = e.target.value.replace(/\D/g, '').slice(0, 4);
        if (v.length > 2) v = v.slice(0,2) + '/' + v.slice(2);
        e.target.value = v;
      });
    }
  }

  /* ── 7. SCROLL REVEAL ─────────────────────────────────────── */
  function initScrollReveal() {
    const targets = document.querySelectorAll(
      '.cc-teaser__left, .cc-teaser__right,' +
      '.cc-benefits__col, .cc-vault,' +
      '.cc-pricing__title, .cc-price-card,' +
      '.cc-quote, .cc-final-cta__title'
    );
    targets.forEach(el => el.classList.add('cc-reveal'));

    const obs = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('cc-visible');
          obs.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -30px 0px' });

    // Stagger quotes
    document.querySelectorAll('.cc-quote').forEach((q, i) => {
      q.style.transitionDelay = `${i * 90}ms`;
    });

    targets.forEach(el => obs.observe(el));
  }

  /* ── INIT ─────────────────────────────────────────────────── */
  function init() {
    detectNavbar();
    animateSlotCounter();
    initCountdown();
    initPricingToggle();
    initModal();
    initCardInput();
    initScrollReveal();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Re-detect navbar height after fonts/images load
  window.addEventListener('load', detectNavbar);

})();
/* ═══════════════════════════════════════════════════════════════
   SUBSCRIPTION SYSTEM
   Control de acceso a imágenes + modal auth/suscripción
═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const API_BASE = 'http://localhost:3000/api';

  function getToken()   { return localStorage.getItem('token') || null; }
  function isLoggedIn() { return Boolean(getToken()); }

  async function checkSubscription() {
    const token = getToken();
    if (!token) return false;
    try {
      const res = await fetch(`${API_BASE}/user/subscription`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return false;
      const data = await res.json();
      return Boolean(data.subscription?.active);
    } catch {
      return false;
    }
  }

  /* ── Modal ───────────────────────────────────────────────── */
  let authOverlay = null;

  function buildAuthModal() {
    if (document.getElementById('ccAuthOverlay')) return;
    const overlay = document.createElement('div');
    overlay.className = 'cc-auth-overlay';
    overlay.id        = 'ccAuthOverlay';
    overlay.setAttribute('aria-hidden', 'true');
    overlay.innerHTML = `
      <div class="cc-auth-modal" role="dialog" aria-modal="true">
        <span class="cc-auth-modal__icon" id="ccAuthIcon">🔒</span>
        <h3 class="cc-auth-modal__title" id="ccAuthTitle">Contenido exclusivo</h3>
        <p  class="cc-auth-modal__sub"   id="ccAuthSub">Únete al Collector's Club para acceder.</p>
        <div class="cc-auth-modal__actions" id="ccAuthActions"></div>
        <button class="cc-auth-modal__dismiss" id="ccAuthDismiss">Cerrar</button>
      </div>`;
    document.body.appendChild(overlay);
    authOverlay = overlay;
    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeAuthModal(); });
    document.getElementById('ccAuthDismiss').addEventListener('click', closeAuthModal);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && overlay.classList.contains('is-open')) closeAuthModal();
    });
  }

  function openAuthModal(loggedIn) {
    if (!authOverlay) buildAuthModal();
    const actionsEl = document.getElementById('ccAuthActions');
    const titleEl   = document.getElementById('ccAuthTitle');
    const subEl     = document.getElementById('ccAuthSub');
    const iconEl    = document.getElementById('ccAuthIcon');
    actionsEl.innerHTML = '';

    if (!loggedIn) {
      iconEl.textContent  = '🔐';
      titleEl.textContent = 'Inicia sesión';
      subEl.textContent   = 'Necesitas una cuenta para ver este contenido.';
      const btnLogin = document.createElement('button');
      btnLogin.className   = 'cc-auth-modal__btn cc-auth-modal__btn--primary';
      btnLogin.textContent = 'Iniciar sesión';
      btnLogin.addEventListener('click', () => {
        window.location.href = '/src/pages/loginRegistro/login.html';
      });
      const btnReg = document.createElement('button');
      btnReg.className   = 'cc-auth-modal__btn cc-auth-modal__btn--secondary';
      btnReg.textContent = 'Registrarse gratis';
      btnReg.addEventListener('click', () => {
        window.location.href = '/src/pages/loginRegistro/registro.html';
      });
      actionsEl.appendChild(btnLogin);
      actionsEl.appendChild(btnReg);
    } else {
      iconEl.textContent  = '🔒';
      titleEl.textContent = 'Acceso para miembros';
      subEl.textContent   = 'Suscríbete al Collector\'s Club para desbloquear este contenido.';
      const btnSub = document.createElement('button');
      btnSub.className   = 'cc-auth-modal__btn cc-auth-modal__btn--primary';
      btnSub.textContent = 'Suscribirme — 15€/mes';
      btnSub.addEventListener('click', () => {
        closeAuthModal();
        document.querySelector('[data-modal="open"]')?.click();
      });
      actionsEl.appendChild(btnSub);
    }

    authOverlay.setAttribute('aria-hidden', 'false');
    authOverlay.classList.add('is-open');
    document.body.style.overflow = 'hidden';
  }

  function closeAuthModal() {
    authOverlay?.classList.remove('is-open');
    authOverlay?.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  /* ── Bloqueo de imágenes ─────────────────────────────────── */
  async function initImageLock() {
    const subscribed = await checkSubscription();
    if (subscribed) return;

    const loggedIn = isLoggedIn();

    const targets = document.querySelectorAll(
      '.cc-vault__blur, .cc-teaser__blur, .cc-print-card__placeholder'
    );

    targets.forEach((el) => {
      const parent = el.closest('.cc-vault__cell, .cc-teaser__visual, .cc-print-card__img');
      if (!parent) return;
      if (getComputedStyle(parent).position === 'static') {
        parent.style.position = 'relative';
      }

      el.classList.add('locked-image');

      const overlay = document.createElement('div');
      overlay.className = 'image-overlay-lock';
      overlay.setAttribute('role', 'button');
      overlay.setAttribute('tabindex', '0');
      overlay.setAttribute('aria-label', 'Contenido exclusivo para miembros');

      const icon = document.createElement('span');
      icon.className   = 'lock-icon';
      icon.textContent = '🔒';
      icon.setAttribute('aria-hidden', 'true');
      overlay.appendChild(icon);

      const handleClick = () => openAuthModal(loggedIn);
      overlay.addEventListener('click', handleClick);
      overlay.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') handleClick();
      });

      parent.appendChild(overlay);
    });
  }

  /* ── Init ────────────────────────────────────────────────── */
  function init() {
    buildAuthModal();
    initImageLock();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();