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
      setTimeout(step, 140 + Math.random() * 100);
    };
    setTimeout(step, 1200);
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

      // Tick animation on seconds — subtle gravitational
      if (els.s) {
        const newS = pad(s);
        if (els.s.textContent !== newS) {
          els.s.textContent = newS;
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

      // Animate price change — gravitational
      if (priceNum) {
        priceNum.style.transform = 'translateY(-4px)';
        priceNum.style.opacity   = '0';
        setTimeout(() => {
          priceNum.textContent     = plans[plan].num;
          priceNum.style.transform = 'translateY(0)';
          priceNum.style.opacity   = '1';
        }, 400);
        priceNum.style.transition = 'transform 0.6s ease, opacity 0.6s ease';
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
      if (document.documentElement.dataset.ccSubscriptionState === 'subscriber') return;

      overlay.classList.add('is-open');
      overlay.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
      // Focus first input — delayed for gravitational entrance
      setTimeout(() => {
        const first = overlay.querySelector('input, button');
        if (first) first.focus();
      }, 800);
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
        // Simulate processing — ceremonial delay
        setTimeout(() => {
          if (step1) step1.classList.add('cc-modal__step--hidden');
          if (step2) step2.classList.remove('cc-modal__step--hidden');
          // Update slots
          const sl   = document.getElementById('slotsLeft');
          const sb   = document.getElementById('slotCount');
          const slots = 47;
          if (sl)  sl.textContent  = slots - 1;
          if (sb)  sb.textContent  = '54';
        }, 1800);
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
    }, { threshold: 0.08, rootMargin: '0px 0px -60px 0px' });

    // Stagger quotes — slow ceremonial reveal
    document.querySelectorAll('.cc-quote').forEach((q, i) => {
      q.style.transitionDelay = `${i * 200}ms`;
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
    // Replaced by the modular premium image system below.
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

/* ================================================================
   PREMIUM IMAGE SYSTEM
   Modular, fail-closed access control for Collector's Club visuals.
================================================================ */
(function () {
  'use strict';

  const API_BASE = 'http://localhost:3000/api';
  const ASSET_BASE = '/public/images/club/';
  const SUBSCRIPTION_STATES = {
    CHECKING: 'checking',
    GUEST: 'guest',
    LOCKED: 'locked',
    SUBSCRIBER: 'subscriber',
  };

  const CLUB_IMAGES = [
    {
      id: 'club-hero-07',
      role: 'premium',
      tier: 'premium',
      edition: 'Print #01/100',
      src: '@mfdezphoto- (1).jpg',
      alt: "MFDEZ Collector's Club premium print",
      priority: true,
    },
    {
      id: 'club-drop-07',
      role: 'teaser',
      tier: 'premium',
      edition: 'Drop #01',
      src: '@mfdezphoto--2.jpg',
      alt: "Teaser mensual Collector's Club",
    },
    {
      id: 'club-vault-01',
      role: 'vault-full',
      tier: 'premium',
      edition: 'Vault #01',
      src: '@mfdezphoto- (1).jpg',
      alt: 'Vault premium trackside print 01',
    },
    {
      id: 'club-vault-02',
      role: 'vault-full',
      tier: 'premium',
      edition: 'Vault #02',
      src: '@mfdezphoto--2.jpg',
      alt: 'Vault premium backstage print 02',
    },
    {
      id: 'club-vault-03',
      role: 'vault-full',
      tier: 'premium',
      edition: 'Vault #03',
      src: '@mfdezphoto-4.jpg',
      alt: 'Vault premium circuit print 03',
    },
  ];

  function lockIconSvg() {
    return `
      <svg class="cc-overlay-premium__lock" width="28" height="32" viewBox="0 0 28 32" fill="none" aria-hidden="true">
        <rect x="4" y="13" width="20" height="17" rx="3" stroke="currentColor" stroke-width="1.5"/>
        <path d="M9 13V10a5 5 0 0110 0v3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        <circle cx="14" cy="21" r="2" fill="currentColor"/>
        <line x1="14" y1="23" x2="14" y2="26" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      </svg>`;
  }

  const collectorsClubImageManager = {
    assetPath(fileName) {
      return `${ASSET_BASE}${encodeURIComponent(fileName).replace(/%2F/g, '/')}`;
    },

    attachImageLifecycle(root = document) {
      root.querySelectorAll('.cc-real-image').forEach((img) => {
        if (img.dataset.ccLifecycleReady === 'true') return;
        img.dataset.ccLifecycleReady = 'true';
        img.addEventListener('load', () => img.classList.add('is-loaded'), { once: true });
        img.addEventListener('error', () => this.applyFallback(img), { once: true });
        if (img.complete && img.naturalWidth > 0) img.classList.add('is-loaded');
        if (img.complete && img.naturalWidth === 0) this.applyFallback(img);
      });
    },

    applyFallback(img) {
      img.classList.add('is-loaded', 'has-error');
      img.removeAttribute('src');
      img.setAttribute('alt', `${img.getAttribute('alt') || 'Imagen premium'} no disponible`);
    },

    setAccessState(state) {
      const isSubscriber = state === SUBSCRIPTION_STATES.SUBSCRIBER;
      document.querySelectorAll('[data-access-tier="premium"] .cc-real-image').forEach((img) => {
        img.classList.toggle('cc-image--locked', !isSubscriber);
        img.classList.toggle('cc-image--subscriber', isSubscriber);
      });
    },

    preloadPremiumImages() {
      CLUB_IMAGES.forEach((image) => {
        const preload = new Image();
        preload.decoding = 'async';
        preload.src = this.assetPath(image.src);
      });
    },
  };

  const collectorsClubSubscriptionAccess = {
    getToken() {
      return localStorage.getItem('token') || null;
    },

    async resolveState() {
      const token = this.getToken();
      if (!token) return SUBSCRIPTION_STATES.GUEST;

      try {
        const res = await fetch(`${API_BASE}/user/subscription`, {
          method: 'GET',
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return SUBSCRIPTION_STATES.LOCKED;

        const data = await res.json();
        return data && data.subscription && data.subscription.active
          ? SUBSCRIPTION_STATES.SUBSCRIBER
          : SUBSCRIPTION_STATES.LOCKED;
      } catch {
        return SUBSCRIPTION_STATES.LOCKED;
      }
    },

    applyState(state) {
      const page = document.querySelector('.cc-page');
      if (page) page.dataset.subscriptionState = state;
      document.documentElement.dataset.ccSubscriptionState = state;
      collectorsClubImageManager.setAccessState(state);
    },
  };

  const collectorsClubModalAccess = {
    overlay: null,
    currentState: SUBSCRIPTION_STATES.GUEST,

    init() {
      this.overlay = document.getElementById('ccAuthOverlay');
      if (!this.overlay) this.build();
    },

    build() {
      const overlay = document.createElement('div');
      overlay.className = 'cc-auth-overlay';
      overlay.id = 'ccAuthOverlay';
      overlay.setAttribute('aria-hidden', 'true');
      overlay.innerHTML = `
        <div class="cc-auth-modal" role="dialog" aria-modal="true" aria-labelledby="ccAuthTitle">
          <span class="cc-auth-modal__icon" id="ccAuthIcon" aria-hidden="true"></span>
          <h3 class="cc-auth-modal__title" id="ccAuthTitle">Contenido exclusivo</h3>
          <p class="cc-auth-modal__sub" id="ccAuthSub">Unete al Collector's Club para acceder.</p>
          <div class="cc-auth-modal__actions" id="ccAuthActions"></div>
          <button class="cc-auth-modal__dismiss" id="ccAuthDismiss">Cerrar</button>
        </div>`;
      document.body.appendChild(overlay);
      this.overlay = overlay;

      overlay.addEventListener('click', (event) => {
        if (event.target === overlay) this.close();
      });
      overlay.querySelector('#ccAuthDismiss')?.addEventListener('click', () => this.close());
      document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && overlay.classList.contains('is-open')) this.close();
      });
    },

    bindPremiumTriggers(state) {
      this.currentState = state;
      document.querySelectorAll('[data-access-tier="premium"]').forEach((node) => {
        if (node.dataset.ccAccessBound === 'true') return;
        node.dataset.ccAccessBound = 'true';
        node.addEventListener('click', (event) => {
          if (this.currentState === SUBSCRIPTION_STATES.SUBSCRIBER) return;
          event.preventDefault();
          this.open(this.currentState);
        });
      });

      document.querySelectorAll('.cc-overlay-premium').forEach((overlay) => {
        overlay.setAttribute('role', 'button');
        overlay.setAttribute('tabindex', '0');
        overlay.setAttribute('aria-label', 'Contenido exclusivo para miembros');
        if (state === SUBSCRIPTION_STATES.SUBSCRIBER) {
          overlay.setAttribute('aria-hidden', 'true');
        } else {
          overlay.removeAttribute('aria-hidden');
        }
        if (overlay.dataset.ccKeyboardBound === 'true') return;
        overlay.dataset.ccKeyboardBound = 'true';
        overlay.addEventListener('keydown', (event) => {
          if (event.key !== 'Enter' && event.key !== ' ') return;
          event.preventDefault();
          this.open(this.currentState);
        });
      });
    },

    open(state) {
      if (!this.overlay) this.init();

      const iconEl = this.overlay.querySelector('#ccAuthIcon');
      const titleEl = this.overlay.querySelector('#ccAuthTitle');
      const subEl = this.overlay.querySelector('#ccAuthSub');
      const actionsEl = this.overlay.querySelector('#ccAuthActions');
      actionsEl.innerHTML = '';

      if (state === SUBSCRIPTION_STATES.GUEST) {
        iconEl.innerHTML = lockIconSvg();
        titleEl.textContent = 'Inicia sesion';
        subEl.textContent = 'Necesitas una cuenta para ver este contenido premium.';
        actionsEl.appendChild(this.actionButton('Iniciar sesion', 'primary', () => {
          window.location.href = '/src/pages/loginRegistro/login.html';
        }));
        actionsEl.appendChild(this.actionButton('Registrarse', 'secondary', () => {
          window.location.href = '/src/pages/loginRegistro/registro.html';
        }));
      } else {
        iconEl.innerHTML = lockIconSvg();
        titleEl.textContent = 'Acceso para miembros';
        subEl.textContent = "Suscribete al Collector's Club para desbloquear la galeria completa.";
        actionsEl.appendChild(this.actionButton('Suscribirme - 15 EUR/mes', 'primary', () => {
          this.close();
          document.querySelector('[data-modal="open"]')?.click();
        }));
      }

      this.overlay.setAttribute('aria-hidden', 'false');
      this.overlay.classList.add('is-open');
      document.body.style.overflow = 'hidden';
    },

    close() {
      if (!this.overlay) return;
      this.overlay.classList.remove('is-open');
      this.overlay.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
    },

    actionButton(label, variant, onClick) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `cc-auth-modal__btn cc-auth-modal__btn--${variant}`;
      button.textContent = label;
      button.addEventListener('click', onClick);
      return button;
    },
  };

  const collectorsClubVaultRenderer = {
    render(state) {
      const gallery = document.querySelector('.cc-vault-gallery');
      if (!gallery) return;

      const isSubscriber = state === SUBSCRIPTION_STATES.SUBSCRIBER;
      gallery.dataset.imageRole = isSubscriber ? 'vault-full' : 'vault-preview';
      gallery.innerHTML = '';

      CLUB_IMAGES
        .filter((image) => image.role === 'vault-full')
        .forEach((image) => gallery.appendChild(this.createVaultItem(image, isSubscriber)));

      if (!isSubscriber) gallery.appendChild(this.createMoreItem());
      collectorsClubImageManager.attachImageLifecycle(gallery);
    },

    createVaultItem(image, isSubscriber) {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'cc-vault__cell cc-vault-gallery__item';
      item.dataset.accessTier = 'premium';
      item.dataset.imageRole = isSubscriber ? 'vault-full' : 'vault-preview';
      item.dataset.edition = image.edition;
      item.setAttribute('aria-label', image.edition);

      const img = document.createElement('img');
      img.className = 'cc-real-image cc-image--vault cc-image-transition';
      img.src = collectorsClubImageManager.assetPath(image.src);
      img.alt = image.alt;
      img.loading = image.priority ? 'eager' : 'lazy';
      img.decoding = 'async';
      img.sizes = '(max-width: 900px) 45vw, 250px';
      img.dataset.imageRole = isSubscriber ? 'vault-full' : 'vault-preview';
      item.appendChild(img);

      const overlay = document.createElement('span');
      overlay.className = 'cc-vault__overlay cc-overlay-premium';
      overlay.innerHTML = `${lockIconSvg()}<span class="cc-overlay-premium__label">Miembros</span>`;
      item.appendChild(overlay);

      return item;
    },

    createMoreItem() {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'cc-vault__cell cc-vault__cell--teaser cc-vault-gallery__item cc-vault-gallery__item--more';
      item.dataset.accessTier = 'premium';
      item.dataset.imageRole = 'vault-preview';
      item.setAttribute('aria-label', 'Mas prints premium en el Vault');
      item.innerHTML = `
        <span class="cc-vault__overlay cc-vault__overlay--teaser cc-overlay-premium">
          ${lockIconSvg()}
          <span class="cc-vault__more">+19 mas</span>
        </span>`;
      return item;
    },
  };

  function hideSubscriberPremiumOverlays(state) {
    if (state !== SUBSCRIPTION_STATES.SUBSCRIBER) return;

    document.querySelectorAll('.cc-overlay-premium').forEach((overlay) => {
      overlay.hidden = true;
      overlay.inert = true;
      overlay.setAttribute('aria-hidden', 'true');
      overlay.setAttribute('tabindex', '-1');
    });
  }

  function normalizeCtaText(text) {
    return text
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  function applySubscriberCTAs(state) {
    if (state !== SUBSCRIPTION_STATES.SUBSCRIBER) return;

    document.querySelectorAll('[data-modal="open"]').forEach((button) => {
      if (button.dataset.ccSubscriberCtaBound === 'true') return;
      button.dataset.ccSubscriberCtaBound = 'true';

      const label = normalizeCtaText(button.textContent || '');

      if (label.startsWith('reserva')) {
        button.textContent = 'Acceder al Vault';
        button.addEventListener('click', (event) => {
          event.preventDefault();
          document.querySelector('.cc-vault')?.scrollIntoView({
            behavior: 'smooth',
            block: 'start',
          });
        });
        return;
      }

      button.textContent = label.includes('suscripcion') ? 'Ver mi cuenta' : 'Vault';
      button.addEventListener('click', (event) => {
        event.preventDefault();
        window.location.href = '/src/pages/vault/vault.html';
      });
    });
  }

  async function initPremiumImageSystem() {
    collectorsClubModalAccess.init();
    collectorsClubImageManager.attachImageLifecycle();
    collectorsClubSubscriptionAccess.applyState(SUBSCRIPTION_STATES.CHECKING);

    const state = await collectorsClubSubscriptionAccess.resolveState();
    collectorsClubSubscriptionAccess.applyState(state);
    applySubscriberCTAs(state);
    hideSubscriberPremiumOverlays(state);
    collectorsClubVaultRenderer.render(state);
    hideSubscriberPremiumOverlays(state);
    collectorsClubModalAccess.bindPremiumTriggers(state);
    hideSubscriberPremiumOverlays(state);

    if (state === SUBSCRIPTION_STATES.SUBSCRIBER) {
      collectorsClubImageManager.preloadPremiumImages();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPremiumImageSystem);
  } else {
    initPremiumImageSystem();
  }
})();
