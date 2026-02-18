// Clase para encapsular el componente
class GlobalNavigation {
  constructor() {
    this.init();
  }

  // 1. Definir el HTML del componente
  getTemplate() {
    return `
      <header class="topbar" id="mainHeader" aria-label="Barra superior">
        <button class="icon-btn" id="menuBtn" type="button" aria-label="Abrir menu" aria-expanded="false">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line class="line top" x1="4" y1="7" x2="20" y2="7"/>
            <line class="line middle" x1="4" y1="12" x2="20" y2="12"/>
            <line class="line bottom" x1="4" y1="17" x2="20" y2="17"/>
          </svg>
        </button>

        <a class="brand" href="/src/pages/mainPage/mainPage.html" aria-label="Inicio">
          <img src="../../../public/images/MF6.png" alt="MFDEZ Studio" class="brand__mark" />
        </a>

        <a class="cta" href="/src/pages/Contacto/contacto.html">Contacto</a>
      </header>

      <div class="menu-overlay" id="menuOverlay" aria-hidden="true">
        <div class="menu-content">
          <nav class="menu-grid">
            <a href="/src/pages/servicios/servicios.html" class="menu-item" style="--delay: 0.1s">
        <h2 class="menu-title">SERVICIOS</h2>
      </a>

      <a href="/src/pages/portfolio/portfolio.html" class="menu-item" style="--delay: 0.2s">
        <h2 class="menu-title">PORTFOLIO</h2>
      </a>

      <a href="/src/pages/collectorsClub/collectorsClub.html" class="menu-item" style="--delay: 0.3s">
        <h2 class="menu-title">COLLECTOR'S CLUB</h2>
      </a>
          </nav>

          <footer class="menu-footer">
            <div>©MFDEZ Studio</div>
            <div>Social Icons</div>
            <div>2026</div>
          </footer>
        </div>
      </div>
    `;
  }

  // 2. Inyectar HTML y arrancar lógica
  init() {
    // Insertar al principio del body
    document.body.insertAdjacentHTML('afterbegin', this.getTemplate());

    // Referencias al DOM
    this.menuBtn = document.getElementById('menuBtn');
    this.menuOverlay = document.getElementById('menuOverlay');
    this.header = document.getElementById('mainHeader');
    this.body = document.body;

    // Listeners
    this.addEventListeners();
  }

  addEventListeners() {
    // A) Toggle Menú
    this.menuBtn.addEventListener('click', () => this.toggleMenu());

    // B) Efecto Scroll en Navbar
    window.addEventListener('scroll', () => {
      if (!this.isOpen) { // Solo si el menú está cerrado
        if (window.scrollY > 50) {
          this.header.classList.add('scrolled');
        } else {
          this.header.classList.remove('scrolled');
        }
      }
    });
  }

  toggleMenu() {
    // Alternar estado
    this.isOpen = this.menuOverlay.classList.toggle('is-open');
    this.menuBtn.classList.toggle('is-active');
    
    // Accesibilidad
    this.menuBtn.setAttribute('aria-expanded', this.isOpen);
    this.menuOverlay.setAttribute('aria-hidden', !this.isOpen);

    // Bloquear scroll del body
    if (this.isOpen) {
      this.body.style.overflow = 'hidden';
      // Al abrir menú, quitamos fondo de la navbar para que se vea limpio
      this.header.style.background = 'transparent';
      this.header.style.backdropFilter = 'none';
    } else {
      this.body.style.overflow = '';
      // Restaurar estilo scroll si estamos abajo
      if (window.scrollY > 50) {
         this.header.classList.add('scrolled');
         this.header.style.background = ''; // Resetea al CSS
         this.header.style.backdropFilter = ''; 
      }
    }
  }
}

// Inicializar automáticamente cuando cargue el DOM
document.addEventListener('DOMContentLoaded', () => {
  new GlobalNavigation();
});