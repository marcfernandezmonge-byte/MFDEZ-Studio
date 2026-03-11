class GlobalNavigation {
  constructor() {
    // IMPORTANTE: Ajusta esta ruta si alguna página está en una carpeta más profunda
    this.basePath = '../../components/navBar'; 
    this.init();
  }

  async init() {
    try {
      // 1. Cargar e Inyectar el CSS automáticamente
      if (!document.querySelector(`link[href="${this.basePath}/NavBar.css"]`)) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = `${this.basePath}/NavBar.css`;
        document.head.appendChild(link);
      }

      // 2. Descargar el archivo HTML e inyectarlo en el body
      const response = await fetch(`${this.basePath}/NavBar.html`);
      if (!response.ok) throw new Error('No se pudo cargar el HTML del NavBar');
      const html = await response.text();
      
      document.body.insertAdjacentHTML('afterbegin', html);

      // 3. Cargar dependencias (Lottie)
      this.loadLottieScript();

      // 4. Seleccionar los elementos del DOM (ahora que ya existen)
      this.menuBtn = document.getElementById('menuBtn');
      this.menuOverlay = document.getElementById('menuOverlay');
      this.header = document.getElementById('mainHeader');
      this.body = document.body;
      
      // 5. Asignar los eventos
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
      script.src = "https://unpkg.com/@lottiefiles/lottie-player@latest/dist/lottie-player.js";
      script.async = true;
      document.head.appendChild(script);
    }
  }

  addEventListeners() {
    this.isOpen = false;

    this.menuBtn.addEventListener('click', () => this.toggleMenu());
    
    window.addEventListener('scroll', () => {
      if (!this.isOpen) {
        if (window.scrollY > 30) {
          this.header.classList.add('scrolled');
        } else {
          this.header.classList.remove('scrolled');
        }
      }
    });
  }

  toggleMenu() {
    this.isOpen = this.menuOverlay.classList.toggle('is-open');
    this.menuBtn.classList.toggle('is-active');
    
    this.menuBtn.setAttribute('aria-expanded', this.isOpen);
    this.menuOverlay.setAttribute('aria-hidden', !this.isOpen);

    if (this.isOpen) {
      this.body.style.overflow = 'hidden';
      this.header.classList.add('menu-open'); 
    } else {
      this.body.style.overflow = '';
      this.header.classList.remove('menu-open');
    }
  }
}

// Iniciar cuando el DOM de la página esté listo
document.addEventListener('DOMContentLoaded', () => {
  new GlobalNavigation();
});