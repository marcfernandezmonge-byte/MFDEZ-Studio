class GlobalNavigation {
  constructor() {
    // IMPORTANTE: Ajusta esta ruta si alguna página está en una carpeta más profunda
    this.basePath = '../../components/navBar';
    this.isLoggedIn = false;
    this.canvasAnim = null;
    this.overlayAnimationMs = 920;
    this.overlayCloseTimer = null;
    this.init();
  }

  async init() {
    try {
      // 1. Cargar e inyectar el CSS automáticamente
      if (!document.querySelector(`link[href="${this.basePath}/NavBar.css"]`)) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = `${this.basePath}/NavBar.css`;
        document.head.appendChild(link);
      }

      // 2. Descargar el HTML e inyectarlo en el body
      const response = await fetch(`${this.basePath}/NavBar.html`);
      if (!response.ok) throw new Error('No se pudo cargar el HTML del NavBar');
      const html = this.resolveNavMarkup(await response.text());
      document.body.insertAdjacentHTML('afterbegin', html);

      // 3. Cargar dependencias externas
      this.loadLottieScript();

      // 4. Seleccionar elementos del DOM
      this.menuBtn     = document.getElementById('menuBtn');
      this.menuOverlay = document.getElementById('menuOverlay');
      this.header      = document.getElementById('mainHeader');
      this.canvas      = document.getElementById('menuCanvas');
      this.cta         = document.querySelector('.cta');
      this.body        = document.body;
      this.menuContent = this.menuOverlay?.querySelector('.menu-content') || null;
      this.menuItems   = this.menuOverlay ? [...this.menuOverlay.querySelectorAll('.menu-item')] : [];
      this.menuFooter  = this.menuOverlay?.querySelector('.menu-footer') || null;

      if (this.menuBtn && this.menuOverlay && this.header) {
        this.addEventListeners();
      }

      if (this.cta) {
        // Actualizar el CTA según estado de autenticación ANTES de añadir
        // las interacciones, para que operen sobre el estado final del botón.
        this.checkAuthStatus();
        this.updateAuthCTA();
        this.setupCTAInteractions();
      }

      // Bonus: observar cambios en localStorage para logout automático
      // (otro tab cierra sesión, el token desaparece, el botón se actualiza)
      this._watchAuthStorage();

    } catch (error) {
      console.error('Error al inicializar la navegación:', error);
    }
  }

  /* ─────────────────────────────────────────────────────────
     checkAuthStatus()
     Detecta si el usuario está autenticado comprobando:
       1. localStorage.getItem('token')
       2. Cookie llamada 'token'
     Actualiza this.isLoggedIn = true / false.
  ───────────────────────────────────────────────────────── */
  checkAuthStatus() {
    // 1. localStorage — método principal
    const lsToken = localStorage.getItem('token');
    if (lsToken && lsToken.trim() !== '') {
      this.isLoggedIn = true;
      return;
    }

    // 2. Cookie 'token' — método alternativo
    const cookieToken = this._getCookie('token');
    if (cookieToken && cookieToken.trim() !== '') {
      this.isLoggedIn = true;
      return;
    }

    this.isLoggedIn = false;
  }

  /* ─────────────────────────────────────────────────────────
     updateAuthCTA()
     Actualiza href, label e icono del botón .cta
     según el estado actual de this.isLoggedIn.
     No modifica clases ni estilos — solo contenido.
  ───────────────────────────────────────────────────────── */
  updateAuthCTA() {
    if (!this.cta) return;

    const iconEl  = this.cta.querySelector('.cta__icon');
    const labelEl = this.cta.querySelector('.cta__label');

    if (this.isLoggedIn) {
      // ── Usuario autenticado → Dashboard ──
      this.cta.href = '../../pages/dashboard/dashboard.html';
      this.cta.setAttribute('aria-label', 'Ir al Dashboard');

      if (labelEl) labelEl.textContent = 'Dashboard';

      if (iconEl) {
        iconEl.innerHTML = `
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="1.6"
               stroke-linecap="round" stroke-linejoin="round"
               aria-hidden="true">
            <rect x="3" y="3" width="7" height="7" rx="1"/>
            <rect x="14" y="3" width="7" height="7" rx="1"/>
            <rect x="14" y="14" width="7" height="7" rx="1"/>
            <rect x="3" y="14" width="7" height="7" rx="1"/>
          </svg>`;
      }

    } else {
      // ── Usuario no autenticado → Login ──
      this.cta.href = '../../pages/loginRegistro/login.html';
      this.cta.setAttribute('aria-label', 'Iniciar sesión');

      if (labelEl) labelEl.textContent = 'Login';

      if (iconEl) {
        iconEl.innerHTML = `
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none"
               stroke="currentColor" stroke-width="1.5"
               stroke-linecap="round" stroke-linejoin="round"
               aria-hidden="true">
            <circle cx="9" cy="6" r="3"/>
            <path d="M3 16c0-3.314 2.686-6 6-6s6 2.686 6 6"/>
          </svg>`;
      }
    }
  }

  /* ─────────────────────────────────────────────────────────
     _watchAuthStorage()
     Bonus: escucha el evento 'storage' (se dispara cuando
     otro tab/ventana modifica localStorage).
     Si el token desaparece → actualiza el botón a Login.
     Si el token aparece    → actualiza el botón a Dashboard.
     También comprueba periódicamente la cookie (no hay
     evento nativo para cookies).
  ───────────────────────────────────────────────────────── */
  _watchAuthStorage() {
    // Escuchar cambios entre pestañas
    window.addEventListener('storage', (e) => {
      if (e.key !== 'token') return;
      this.checkAuthStatus();
      this.updateAuthCTA();
    });

    // Polling ligero para detectar cambios de cookie o logout
    // dentro de la misma pestaña (intervalo: 4 s)
    this._authPollInterval = setInterval(() => {
      const wasLoggedIn = this.isLoggedIn;
      this.checkAuthStatus();
      if (wasLoggedIn !== this.isLoggedIn) {
        this.updateAuthCTA();
      }
    }, 4000);
  }

  /* ─────────────────────────────────────────────────────────
     _getCookie(name)
     Lee el valor de una cookie por nombre.
     Devuelve null si no existe.
  ───────────────────────────────────────────────────────── */
  _getCookie(name) {
    const match = document.cookie
      .split(';')
      .map(c => c.trim())
      .find(c => c.startsWith(`${name}=`));
    return match ? decodeURIComponent(match.split('=').slice(1).join('=')) : null;
  }

  sanitizeFetchedHTML(html) {
    // Live Server inyecta scripts de recarga en archivos .html servidos.
    // Como este archivo se usa como fragmento vía fetch(), esa inyección
    // puede colarse dentro de los <svg> y corromper el DOM del navbar.
    return html
      .replace(/<!-- Code injected by live-server -->[\s\S]*?<\/script>/gi, '')
      .trim();
  }

  resolveNavMarkup(html) {
    const sanitized = this.sanitizeFetchedHTML(html);
    return this.isValidNavMarkup(sanitized) ? sanitized : this.getFallbackNavMarkup();
  }

  isValidNavMarkup(html) {
    if (!html) return false;

    const requiredFragments = [
      'id="mainHeader"',
      'id="menuBtn"',
      'id="menuOverlay"',
      'id="menuCanvas"',
      'class="menu-content"',
      'class="menu-grid"',
      'class="menu-item"',
      'class="menu-footer"',
      'SERVICIOS',
      'PORTFOLIO',
      'COLLECTOR\'S CLUB',
      'CONTACTO',
    ];

    return requiredFragments.every((fragment) => html.includes(fragment));
  }

  getFallbackNavMarkup() {
    return `
<header class="topbar" id="mainHeader" aria-label="Barra superior">
  <button class="icon-btn" id="menuBtn" type="button" aria-label="Abrir menu" aria-expanded="false">
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <line class="line top" x1="4" y1="7" x2="20" y2="7"/>
      <line class="line middle" x1="4" y1="12" x2="20" y2="12"/>
      <line class="line bottom" x1="4" y1="17" x2="20" y2="17"/>
    </svg>
  </button>

  <a class="brand" href="../../pages/mainPage/mainPage.html" aria-label="Inicio">
    <img src="../../../public/images/MF6.png" alt="MFDEZ Studio" class="brand__mark" />
  </a>

  <a class="cta" href="../../pages/loginRegistro/login.html">
    <span class="cta__icon">
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <circle cx="9" cy="6" r="3"/>
        <path d="M3 16c0-3.314 2.686-6 6-6s6 2.686 6 6"/>
      </svg>
    </span>
    <span class="cta__label">Login</span>
  </a>
</header>

<div class="menu-overlay" id="menuOverlay" aria-hidden="true">
  <canvas class="menu-bg-canvas" id="menuCanvas" aria-hidden="true"></canvas>
  <div class="menu-light" aria-hidden="true"></div>

  <div class="menu-content">
    <nav class="menu-grid">
      <a href="../../pages/servicios/servicios.html" class="menu-item" style="--delay: 0.08s">
        <span class="menu-index">01</span>
        <h2 class="menu-title">SERVICIOS</h2>
        <div class="menu-item__bar"></div>
      </a>
      <a href="../../pages/portfolio/portfolio.html" class="menu-item" style="--delay: 0.16s">
        <span class="menu-index">02</span>
        <h2 class="menu-title">PORTFOLIO</h2>
        <div class="menu-item__bar"></div>
      </a>
      <a href="../../pages/collectorsClub/collectorsClub.html" class="menu-item" style="--delay: 0.24s">
        <span class="menu-index">03</span>
        <h2 class="menu-title">COLLECTOR'S CLUB</h2>
        <div class="menu-item__bar"></div>
      </a>
      <a href="../../pages/Contacto/contacto.html" class="menu-item" style="--delay: 0.32s">
        <span class="menu-index">04</span>
        <h2 class="menu-title">CONTACTO</h2>
        <div class="menu-item__bar"></div>
      </a>
    </nav>

    <footer class="menu-footer">
      <div class="menu-footer__copy">&copy;MFDEZ Studio</div>
      <a href="https://instagram.com/mfdezphoto" class="menu-footer__social" aria-label="Instagram">
        <lottie-player
          id="lottie"
          src="../../../public/icons/Instagram.json"
          background="transparent"
          speed="1"
          style="width: 28px; height: 28px;"
          loop
          autoplay>
        </lottie-player>
      </a>
      <div class="menu-footer__year">2026</div>
    </footer>
  </div>
</div>`.trim();
  }

  loadLottieScript() {
    if (!document.querySelector('script[src*="lottie-player"]')) {
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/@lottiefiles/lottie-player@latest/dist/lottie-player.js';
      script.async = true;
      document.head.appendChild(script);
    }
  }

  addEventListeners() {
    this.isOpen = false;
    this.menuBtn.addEventListener('click', () => this.toggleMenu());

    window.addEventListener('scroll', () => {
      if (!this.isOpen) {
        this.header.classList.toggle('scrolled', window.scrollY > 30);
      }
    }, { passive: true });
  }

  setupCTAInteractions() {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let frameId = null;
    let pointerInside = false;
    let currentX = 0;
    let currentY = 0;
    let currentScale = 1;
    let targetX = 0;
    let targetY = 0;
    let targetScale = 1;

    const render = () => {
      currentX += (targetX - currentX) * 0.16;
      currentY += (targetY - currentY) * 0.16;
      currentScale += (targetScale - currentScale) * 0.16;

      this.cta.style.setProperty('--cta-tx', `${currentX.toFixed(2)}px`);
      this.cta.style.setProperty('--cta-ty', `${currentY.toFixed(2)}px`);
      this.cta.style.setProperty('--cta-scale', currentScale.toFixed(3));

      const shouldContinue =
        pointerInside ||
        Math.abs(targetX - currentX) > 0.02 ||
        Math.abs(targetY - currentY) > 0.02 ||
        Math.abs(targetScale - currentScale) > 0.002;

      if (shouldContinue) {
        frameId = requestAnimationFrame(render);
      } else {
        frameId = null;
      }
    };

    const startRender = () => {
      if (frameId === null) {
        frameId = requestAnimationFrame(render);
      }
    };

    this.cta.addEventListener('mouseenter', () => {
      pointerInside = true;
      targetScale = 1.02;
      startRender();
    });

    this.cta.addEventListener('mousemove', (event) => {
      const rect = this.cta.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width) * 100;
      const y = ((event.clientY - rect.top) / rect.height) * 100;

      this.cta.style.setProperty('--x', `${x}%`);
      this.cta.style.setProperty('--y', `${y}%`);

      targetX = (x - 50) * 0.1;
      targetY = (y - 50) * 0.1;
      targetScale = 1.03;
      startRender();
    });

    this.cta.addEventListener('mouseleave', () => {
      pointerInside = false;
      targetX = 0;
      targetY = 0;
      targetScale = 1;
      startRender();
    });

    this.cta.addEventListener('mousedown', () => {
      targetScale = 0.96;
      startRender();
    });

    this.cta.addEventListener('mouseup', () => {
      targetScale = pointerInside ? 1.03 : 1;
      startRender();
    });

    this.cta.addEventListener('blur', () => {
      pointerInside = false;
      targetX = 0;
      targetY = 0;
      targetScale = 1;
      startRender();
    });
  }

  forceOverlayVisibleState() {
    if (!this.menuOverlay) return;

    if (this.overlayCloseTimer) {
      clearTimeout(this.overlayCloseTimer);
      this.overlayCloseTimer = null;
    }

    this.menuOverlay.style.webkitClipPath = 'none';
    this.menuOverlay.style.clipPath = 'none';
    this.menuOverlay.style.opacity = '1';
    this.menuOverlay.style.transform = 'translate3d(0, 0, 0)';
    this.menuOverlay.style.visibility = 'visible';
    this.menuOverlay.style.pointerEvents = 'auto';

    if (this.menuContent) {
      this.menuContent.style.removeProperty('opacity');
      this.menuContent.style.removeProperty('transform');
    }

    this.menuItems.forEach((item) => {
      item.style.opacity = '1';
      item.style.transform = 'none';
    });

    if (this.menuFooter) {
      this.menuFooter.style.opacity = '1';
      this.menuFooter.style.transform = 'none';
    }
  }

  forceOverlayHiddenState() {
    if (!this.menuOverlay) return;

    this.menuOverlay.style.opacity = '0';
    this.menuOverlay.style.transform = 'translate3d(-100%, 0, 0)';
    this.menuOverlay.style.pointerEvents = 'none';
    this.menuOverlay.style.visibility = 'visible';

    if (this.menuContent) {
      this.menuContent.style.removeProperty('opacity');
      this.menuContent.style.removeProperty('transform');
    }

    if (this.overlayCloseTimer) {
      clearTimeout(this.overlayCloseTimer);
    }

    this.overlayCloseTimer = setTimeout(() => {
      if (!this.isOpen && this.menuOverlay) {
        this.menuOverlay.style.visibility = 'hidden';
      }
      this.overlayCloseTimer = null;
    }, this.overlayAnimationMs);
  }

  toggleMenu() {
    this.isOpen = !this.isOpen;
    this.menuOverlay.classList.toggle('is-open', this.isOpen);
    this.menuBtn.classList.toggle('is-active', this.isOpen);
    this.menuBtn.setAttribute('aria-expanded', String(this.isOpen));
    this.menuOverlay.setAttribute('aria-hidden', String(!this.isOpen));

    if (this.isOpen) {
      this.body.style.overflow = 'hidden';

      // Ocultar fondo de topbar inmediatamente al abrir
      this.header.classList.add('menu-open');
      this.forceOverlayVisibleState();
      requestAnimationFrame(() => this.forceOverlayVisibleState());

      // Iniciar o reanudar la animación del canvas
      if (!this.canvasAnim) {
        this.canvasAnim = new MenuCanvasAnimation(this.canvas);
      }
      this.canvasAnim.start();

    } else {
      this.body.style.overflow = '';
      this.header.classList.remove('menu-open');
      this.forceOverlayHiddenState();

      // Detener el canvas cuando el overlay termina de salir
      const delay = this.overlayAnimationMs;
      setTimeout(() => {
        if (this.canvasAnim) this.canvasAnim.stop();
      }, delay);
    }
  }
}

/* ========================================
   Canvas: Líneas diagonales sutiles en movimiento
   — da sensación de estudio digital vivo
   ======================================== */
class MenuCanvasAnimation {
  constructor(canvas) {
    this.canvas  = canvas;
    this.ctx     = canvas.getContext('2d');
    this.raf     = null;
    this.running = false;
    this.lines   = [];
    this.resize();
    this.buildLines();
    window.addEventListener('resize', () => this.resize(), { passive: true });
  }

  resize() {
    this.canvas.width  = window.innerWidth;
    this.canvas.height = window.innerHeight;
    this.buildLines();
  }

  buildLines() {
    const count = Math.round(window.innerWidth / 90);
    this.lines = [];
    for (let i = 0; i < count; i++) {
      this.lines.push(this.makeLine(i, count));
    }
  }

  makeLine(i, total) {
    const w = window.innerWidth;
    const h = window.innerHeight;
    return {
      x:     (w / total) * i + Math.random() * 60 - 30,
      y:     Math.random() * h,
      len:   60 + Math.random() * 120,
      speed: 0.15 + Math.random() * 0.25,
      alpha: 0.03 + Math.random() * 0.06,
      angle: -35 + Math.random() * 10, // grados
    };
  }

  draw() {
    const { ctx, canvas, lines } = this;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (const l of lines) {
      const rad = (l.angle * Math.PI) / 180;
      const x2 = l.x + Math.cos(rad) * l.len;
      const y2 = l.y + Math.sin(rad) * l.len;

      const grad = ctx.createLinearGradient(l.x, l.y, x2, y2);
      grad.addColorStop(0, `rgba(0,143,245,0)`);
      grad.addColorStop(0.5, `rgba(0,143,245,${l.alpha})`);
      grad.addColorStop(1, `rgba(0,143,245,0)`);

      ctx.beginPath();
      ctx.moveTo(l.x, l.y);
      ctx.lineTo(x2, y2);
      ctx.strokeStyle = grad;
      ctx.lineWidth = 1;
      ctx.stroke();

      // Mover hacia arriba en diagonal
      l.y -= l.speed;
      l.x += l.speed * 0.4;

      // Reposicionar cuando sale del canvas
      if (l.y + l.len < 0 || l.x > canvas.width + l.len) {
        l.x     = Math.random() * canvas.width;
        l.y     = canvas.height + Math.random() * 100;
        l.alpha = 0.03 + Math.random() * 0.06;
      }
    }
  }

  start() {
    if (this.running) return;
    this.running = true;
    const loop = () => {
      if (!this.running) return;
      this.draw();
      this.raf = requestAnimationFrame(loop);
    };
    loop();
  }

  stop() {
    this.running = false;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = null;
    if (this.ctx) this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }
}

// Iniciar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
  new GlobalNavigation();
});