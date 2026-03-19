class GlobalNavigation {
  constructor() {
    // IMPORTANTE: Ajusta esta ruta si alguna página está en una carpeta más profunda
    this.basePath = '../../components/navBar';
    this.canvasAnim = null;
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
      const html = await response.text();
      document.body.insertAdjacentHTML('afterbegin', html);

      // 3. Cargar dependencias externas
      this.loadLottieScript();

      // 4. Seleccionar elementos del DOM
      this.menuBtn     = document.getElementById('menuBtn');
      this.menuOverlay = document.getElementById('menuOverlay');
      this.header      = document.getElementById('mainHeader');
      this.canvas      = document.getElementById('menuCanvas');
      this.body        = document.body;

      if (this.menuBtn && this.menuOverlay && this.header) {
        this.addEventListeners();
      }

    } catch (error) {
      console.error('Error al inicializar la navegación:', error);
    }
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

      // Iniciar o reanudar la animación del canvas
      if (!this.canvasAnim) {
        this.canvasAnim = new MenuCanvasAnimation(this.canvas);
      }
      this.canvasAnim.start();

    } else {
      this.body.style.overflow = '';
      this.header.classList.remove('menu-open');

      // Detener el canvas cuando el overlay termina de cerrarse
      const delay = 650; // coincide con la duración del clip-path
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