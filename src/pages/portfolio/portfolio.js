/**
 * portfolio.js
 * -----------
 * Módulos:
 *   1. ScrollReveal  — anima las gallery-items al entrar en el viewport
 *   2. HorizontalScroll — convierte scroll vertical en horizontal dentro de las filas
 *   3. Lightbox — pantalla completa al hacer clic en una imagen
 *
 * Sin dependencias externas. Vanilla ES6+.
 */

(function () {
  'use strict';

  /* ========================================================
   * 1. SCROLL REVEAL
   * Observa cada .gallery-item y la revela con un stagger
   * suave cuando cruza el umbral del viewport.
   * ======================================================== */
  const ScrollReveal = {
    /** Configuración por defecto */
    config: {
      rootMargin: '-60px 0px',
      threshold: 0.15,
      staggerDelay: 0.12,     // segundos entre cada item de una fila
    },

    init() {
      const items = document.querySelectorAll('.gallery-item');
      if (!items.length) return;

      // Ocultar todos inicialmente mediante clase CSS
      items.forEach((item) => {
        // Quitamos la animación CSS original para usar transiciones propias
        item.style.animation = 'none';
        item.classList.add('reveal-hidden');
      });

      // Crear observer
      this.observer = new IntersectionObserver(
        (entries) => this._onIntersect(entries),
        {
          rootMargin: this.config.rootMargin,
          threshold: this.config.threshold,
        }
      );

      items.forEach((item) => this.observer.observe(item));
    },

    _onIntersect(entries) {
      // Agrupamos las entradas visibles por fila para escalonar
      const visibleByRow = new Map();

      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;

        const row = entry.target.closest('.gallery-row');
        const key = row ? row.dataset.row : 'default';

        if (!visibleByRow.has(key)) visibleByRow.set(key, []);
        visibleByRow.get(key).push(entry.target);

        this.observer.unobserve(entry.target);
      });

      // Revelar con delay escalonado dentro de cada fila
      visibleByRow.forEach((items) => {
        items.forEach((item, index) => {
          const delay = index * this.config.staggerDelay;
          item.style.transitionDelay = `${delay}s`;
          // Usamos requestAnimationFrame para asegurar que el browser
          // registre el estado hidden antes de animar al visible
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              item.classList.remove('reveal-hidden');
              item.classList.add('reveal-visible');
            });
          });

          // Limpiar el delay después de la transición
          item.addEventListener('transitionend', function cleanup() {
            item.style.transitionDelay = '';
            item.removeEventListener('transitionend', cleanup);
          });
        });
      });
    },
  };

  /* ========================================================
   * 2. HORIZONTAL SCROLL
   * Convierte el scroll vertical (wheel) en desplazamiento
   * horizontal dentro de cada .gallery-row.
   * ======================================================== */
  const HorizontalScroll = {
    config: {
      speed: 300,   // pixeles por tick de rueda
      smooth: true,
    },

    init() {
      const rows = document.querySelectorAll('.gallery-row');
      rows.forEach((row) => {
        row.addEventListener('wheel', (e) => this._onWheel(e, row), {
          passive: false,
        });
      });
    },

    _onWheel(e, row) {
      // Solo interceptar si la fila realmente tiene scroll horizontal
      if (row.scrollWidth <= row.clientWidth) return;

      e.preventDefault();
      const direction = e.deltaY > 0 ? 1 : -1;

      row.scrollBy({
        left: direction * this.config.speed,
        behavior: this.config.smooth ? 'smooth' : 'auto',
      });
    },
  };

  /* ========================================================
   * 3. LIGHTBOX
   * Abre una imagen a pantalla completa con navegación
   * y se cierra al hacer clic fuera o presionar Escape.
   * ======================================================== */
  const Lightbox = {
    /** Estado interno */
    _state: {
      isOpen: false,
      currentIndex: -1,
      items: [],       // { src, alt, number, title }
    },

    /** Referencias al DOM del lightbox */
    _dom: {},

    init() {
      this._collectItems();
      if (!this._state.items.length) return;

      this._buildDOM();
      this._bindEvents();
    },

    /* ---- Recopilar imágenes de la galería ---- */
    _collectItems() {
      const galleryItems = document.querySelectorAll('.gallery-item');
      galleryItems.forEach((item) => {
        const img = item.querySelector('img');
        const numberEl = item.querySelector('.gallery-number');
        const titleEl = item.querySelector('.gallery-title') || item.querySelector('h3');

        if (!img) return;

        this._state.items.push({
          src: img.src,
          alt: img.alt || '',
          number: numberEl ? numberEl.textContent.trim() : '',
          title: titleEl ? titleEl.textContent.trim() : '',
          element: item,
        });
      });
    },

    /* ---- Construir el overlay en el DOM ---- */
    _buildDOM() {
      // Overlay principal
      const overlay = document.createElement('div');
      overlay.className = 'lightbox-overlay';
      overlay.setAttribute('role', 'dialog');
      overlay.setAttribute('aria-modal', 'true');
      overlay.setAttribute('aria-label', 'Image viewer');

      overlay.innerHTML = `
        <span class="lightbox-close-hint">Click or Esc to close</span>

        <button class="lightbox-nav lightbox-nav--prev" aria-label="Previous image">&#8592;</button>
        <button class="lightbox-nav lightbox-nav--next" aria-label="Next image">&#8594;</button>

        <div class="lightbox-image-wrap">
          <img src="" alt="" />
        </div>

        <div class="lightbox-caption">
          <span class="lightbox-caption-number"></span>
          <span class="lightbox-caption-title"></span>
        </div>

        <span class="lightbox-counter"></span>
      `;

      document.body.appendChild(overlay);

      // Guardar referencias
      this._dom.overlay = overlay;
      this._dom.img = overlay.querySelector('.lightbox-image-wrap img');
      this._dom.captionNumber = overlay.querySelector('.lightbox-caption-number');
      this._dom.captionTitle = overlay.querySelector('.lightbox-caption-title');
      this._dom.counter = overlay.querySelector('.lightbox-counter');
      this._dom.prevBtn = overlay.querySelector('.lightbox-nav--prev');
      this._dom.nextBtn = overlay.querySelector('.lightbox-nav--next');
    },

    /* ---- Bindear eventos ---- */
    _bindEvents() {
      const self = this;

      // Click en cada gallery-item abre el lightbox
      this._state.items.forEach((item, index) => {
        item.element.addEventListener('click', (e) => {
          e.stopPropagation();
          self.open(index);
        });
      });

      // Click en overlay cierra (pero no si clickeas en la imagen o nav)
      this._dom.overlay.addEventListener('click', (e) => {
        // Si el click fue en el overlay o en la imagen, cerrar
        if (
          e.target === self._dom.overlay ||
          e.target === self._dom.img ||
          e.target.closest('.lightbox-image-wrap')
        ) {
          self.close();
        }
      });

      // Navegación
      this._dom.prevBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        self.prev();
      });

      this._dom.nextBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        self.next();
      });

      // Keyboard
      document.addEventListener('keydown', (e) => {
        if (!self._state.isOpen) return;

        switch (e.key) {
          case 'Escape':
            self.close();
            break;
          case 'ArrowLeft':
            self.prev();
            break;
          case 'ArrowRight':
            self.next();
            break;
        }
      });
    },

    /* ---- Abrir lightbox ---- */
    open(index) {
      this._state.currentIndex = index;
      this._state.isOpen = true;
      this._updateContent();

      document.body.classList.add('lightbox-open');
      this._dom.overlay.classList.add('is-active');
    },

    /* ---- Cerrar lightbox ---- */
    close() {
      this._state.isOpen = false;
      document.body.classList.remove('lightbox-open');
      this._dom.overlay.classList.remove('is-active');
    },

    /* ---- Navegar ---- */
    prev() {
      const total = this._state.items.length;
      this._state.currentIndex = (this._state.currentIndex - 1 + total) % total;
      this._updateContent();
    },

    next() {
      const total = this._state.items.length;
      this._state.currentIndex = (this._state.currentIndex + 1) % total;
      this._updateContent();
    },

    /* ---- Actualizar imagen y caption ---- */
    _updateContent() {
      const item = this._state.items[this._state.currentIndex];
      if (!item) return;

      this._dom.img.src = item.src;
      this._dom.img.alt = item.alt;
      this._dom.captionNumber.textContent = item.number;
      this._dom.captionTitle.textContent = item.title;
      this._dom.counter.textContent = `${this._state.currentIndex + 1} / ${this._state.items.length}`;
    },
  };

  /* ========================================================
   * INIT — Arranque cuando el DOM está listo
   * ======================================================== */
  document.addEventListener('DOMContentLoaded', () => {
    ScrollReveal.init();
    HorizontalScroll.init();
    Lightbox.init();
  });
})();
