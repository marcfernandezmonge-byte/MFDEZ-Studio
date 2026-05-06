(function () {
  'use strict';

  let currentIndex = 0;
  let images = [];

  /* ─────────────────────────────
     1. CONTROL DE ACCESO
  ───────────────────────────── */
  function waitForSubscription() {
    return new Promise(resolve => {
      const check = () => {
        const state = document.documentElement.dataset.ccSubscriptionState;
        if (!state || state === 'checking') {
          requestAnimationFrame(check);
          return;
        }
        resolve(state);
      };
      check();
    });
  }

  function handleAccess(state) {
    if (state !== 'subscriber') {
      window.location.href = '/src/pages/collectorsClub/collectorsClub.html';
    }
  }

  /* ─────────────────────────────
     2. HYDRATE DESDE EL SISTEMA EXISTENTE
  ───────────────────────────── */
  function hydrateImages() {
    const nodes = document.querySelectorAll('.cc-vault-gallery img');

    images = Array.from(nodes).map((img, i) => ({
      src: img.src,
      alt: img.alt || `Pieza ${i + 1}`,
      title: img.dataset.title || img.alt || '',
      medium: img.dataset.medium || '',
      year: img.dataset.year || '',
      dimensions: img.dataset.dimensions || '',
      description: img.dataset.description || ''
    }));

    document.getElementById('trayTrigger').textContent =
      `Colección · ${images.length}`;
  }

  /* ─────────────────────────────
     3. VIEWER — elevated transitions
  ───────────────────────────── */
  function showImage(index, skipAnim) {
    if (!images[index]) return;

    const imgEl = document.getElementById('vaultImage');

    // ── Exit current
    imgEl.classList.remove('is-visible');
    imgEl.classList.add('is-exiting');

    const delay = skipAnim ? 0 : 200;

    setTimeout(() => {
      imgEl.classList.remove('is-exiting');
      imgEl.src = images[index].src;
      imgEl.alt = images[index].alt;

      // ── Enter new
      imgEl.onload = () => {
        requestAnimationFrame(() => {
          imgEl.classList.add('is-visible');
        });
      };

      // Fallback if already cached
      if (imgEl.complete && imgEl.naturalWidth > 0) {
        imgEl.classList.add('is-visible');
      }

      currentIndex = index;
      updateMeta(index);
      updateTrayActive(index);
    }, delay);
  }

  /* ─────────────────────────────
     4. META — update overlay info
  ───────────────────────────── */
  function updateMeta(index) {
    const meta = document.getElementById('vaultMeta');
    const img = images[index];
    if (!meta || !img) return;

    meta.innerHTML = `
      <div class="vault-meta-index">
        ${String(index + 1).padStart(2, '0')} · ${String(images.length).padStart(2, '0')}
      </div>
      ${img.title
        ? `<div class="vault-meta-title">${img.title}</div>`
        : ''}
    `;
  }

  /* ─────────────────────────────
     4b. TRAY — highlight active thumb
  ───────────────────────────── */
  function updateTrayActive(index) {
    document.querySelectorAll('.cc-vault-gallery img').forEach((img, i) => {
      img.classList.toggle('is-active', i === index);
    });
  }

  /* ─────────────────────────────
     5. TRAY
  ───────────────────────────── */
  function bindTray() {
    const tray    = document.getElementById('vaultTray');
    const trigger = document.getElementById('trayTrigger');

    trigger.addEventListener('click', () => {
      tray.classList.toggle('open');
    });

    // Close tray when clicking outside
    document.addEventListener('click', (e) => {
      if (!tray.contains(e.target) && e.target !== trigger) {
        tray.classList.remove('open');
      }
    });

    document.querySelectorAll('.cc-vault-gallery img').forEach((img, i) => {
      img.addEventListener('mouseenter', () => showImage(i));
      img.addEventListener('click', () => {
        showImage(i);
        tray.classList.remove('open');
      });
    });
  }

  /* ─────────────────────────────
     6. OVERLAY UI — auto hide
  ───────────────────────────── */
  function bindOverlay() {
    const ui = document.getElementById('vaultUI');
    let timeout;

    function show() {
      ui.classList.add('visible');
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        ui.classList.remove('visible');
      }, 2800);
    }

    document.addEventListener('mousemove', show);
    document.addEventListener('keydown', show);
  }

  /* ─────────────────────────────
     7. ACCIONES
  ───────────────────────────── */
  function bindActions() {
    // Download
    document.querySelector('[data-action="download"]')
      .addEventListener('click', () => {
        if (!images[currentIndex]) return;
        const link = document.createElement('a');
        link.href = images[currentIndex].src;
        link.download = `vault-${String(currentIndex + 1).padStart(3, '0')}.jpg`;
        link.click();
      });

    // Info panel
    const panel = document.getElementById('infoPanel');

    document.querySelector('[data-action="info"]')
      .addEventListener('click', () => {
        panel.classList.toggle('open');
        if (panel.classList.contains('open')) {
          renderInfoPanel(currentIndex);
        }
      });

    // Close panel via its own close button (if present)
    panel.addEventListener('click', (e) => {
      if (e.target.closest('.vault-info-close')) {
        panel.classList.remove('open');
      }
    });
  }

  /* ─────────────────────────────
     8. INFO PANEL — render editorial content
  ───────────────────────────── */
  function renderInfoPanel(index) {
    const panel = document.getElementById('infoPanel');
    const img   = images[index];
    if (!img) return;

    const metaRows = [
      { key: 'Número', value: `${String(index + 1).padStart(2, '0')} / ${String(images.length).padStart(2, '0')}` },
      img.year       && { key: 'Año',        value: img.year },
      img.medium     && { key: 'Técnica',    value: img.medium },
      img.dimensions && { key: 'Dimensiones', value: img.dimensions },
    ].filter(Boolean);

    panel.innerHTML = `
      <div class="vault-info-panel-inner">
        <button class="vault-info-close">Cerrar</button>

        <div class="vault-info-eyebrow">Collector's Vault</div>

        <h2 class="vault-info-title">${img.title || img.alt}</h2>
        ${img.medium ? `<div class="vault-info-subtitle">${img.medium}</div>` : ''}

        <div class="vault-info-rule"></div>

        ${img.description
          ? `<p class="vault-info-body">${img.description}</p>`
          : ''}

        ${metaRows.length > 0
          ? `<div style="margin-top: 32px;">
              ${metaRows.map(row => `
                <div class="vault-info-meta-row">
                  <span class="vault-info-meta-key">${row.key}</span>
                  <span class="vault-info-meta-value">${row.value}</span>
                </div>
              `).join('')}
            </div>`
          : ''}
      </div>
    `;
  }

  /* ─────────────────────────────
     9. KEYBOARD NAVIGATION
  ───────────────────────────── */
  function bindKeyboard() {
    document.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        const next = (currentIndex + 1) % images.length;
        showImage(next);
      }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        const prev = (currentIndex - 1 + images.length) % images.length;
        showImage(prev);
      }
      if (e.key === 'Escape') {
        document.getElementById('infoPanel').classList.remove('open');
        document.getElementById('vaultTray').classList.remove('open');
      }
      if (e.key === 'i' || e.key === 'I') {
        const panel = document.getElementById('infoPanel');
        panel.classList.toggle('open');
        if (panel.classList.contains('open')) renderInfoPanel(currentIndex);
      }
    });
  }

  /* ─────────────────────────────
     10. CUSTOM CURSOR
  ───────────────────────────── */
  function initCursor() {
    const cursor = document.createElement('div');
    cursor.className = 'vault-cursor';
    document.body.appendChild(cursor);

    let cx = window.innerWidth / 2;
    let cy = window.innerHeight / 2;
    let tx = cx;
    let ty = cy;
    let rafId;

    document.addEventListener('mousemove', (e) => {
      tx = e.clientX;
      ty = e.clientY;
    });

    function loop() {
      // Smooth lag for outer ring
      cx += (tx - cx) * 0.12;
      cy += (ty - cy) * 0.12;

      cursor.style.transform = `translate(${cx}px, ${cy}px)`;
      // Inner dot tracks exactly via CSS pseudo-element positioning
      cursor.style.left = `${tx}px`;
      cursor.style.top  = `${ty}px`;

      rafId = requestAnimationFrame(loop);
    }

    loop();

    // Hide on leave
    document.addEventListener('mouseleave', () => {
      cursor.style.opacity = '0';
    });
    document.addEventListener('mouseenter', () => {
      cursor.style.opacity = '1';
    });
  }

  /* ─────────────────────────────
     11. TRAY LABEL
  ───────────────────────────── */
  function injectTrayLabel() {
    const tray = document.getElementById('vaultTray');
    if (!tray.querySelector('.vault-tray-label')) {
      const label = document.createElement('div');
      label.className = 'vault-tray-label';
      label.textContent = 'Obras';
      tray.insertBefore(label, tray.firstChild);
    }
  }

  /* ─────────────────────────────
     12. NAV HINT
  ───────────────────────────── */
  function injectNavHint() {
    if (images.length > 1) {
      const hint = document.createElement('div');
      hint.className = 'vault-nav-hint';
      hint.textContent = '← → Navegar';
      document.body.appendChild(hint);
    }
  }

  /* ─────────────────────────────
     13. LOADER SCREEN
  ───────────────────────────── */
  function initLoader() {
    const loader = document.createElement('div');
    loader.className = 'vault-loader';
    loader.innerHTML = `<div class="vault-loader-mark">Vault</div>`;
    document.body.appendChild(loader);
    return loader;
  }

  function dismissLoader(loader) {
    setTimeout(() => {
      loader.classList.add('is-done');
      setTimeout(() => loader.remove(), 700);
    }, 400);
  }


  /* ─────────────────────────────
     10b. SUBTLE PARALLAX — image floats on mouse movement
     Very low magnitude: 8px max travel, slow lerp.
     Gives the image a physical "floating object" quality.
  ───────────────────────────── */
  function bindParallax() {
    const imgEl   = document.getElementById('vaultImage');
    const glowEl  = document.getElementById('vaultImageGlow');
    if (!imgEl) return;

    let px = 0, py = 0; // current position (lerped)
    let tx = 0, ty = 0; // target position
    let rafId;
    const MAX  = 8;  // max px travel each axis
    const LERP = 0.04; // smoothing — lower = slower/dreamier

    document.addEventListener('mousemove', (e) => {
      const cx = window.innerWidth  / 2;
      const cy = window.innerHeight / 2;
      tx = ((e.clientX - cx) / cx) * MAX;
      ty = ((e.clientY - cy) / cy) * MAX;
    });

    function tick() {
      px += (tx - px) * LERP;
      py += (ty - py) * LERP;

      // Only apply transform if image is visible (don't interfere with transitions)
      if (imgEl.classList.contains('is-visible')) {
        imgEl.style.transform = `translate(${px.toFixed(2)}px, ${py.toFixed(2)}px) scale(1)`;
        if (glowEl) {
          // Glow counter-moves slightly — parallax depth layer
          glowEl.style.transform = `translate(calc(-50% + ${(-px * 0.4).toFixed(2)}px), calc(-50% + ${(-py * 0.4).toFixed(2)}px)) scale(1.1)`;
        }
      }

      rafId = requestAnimationFrame(tick);
    }

    tick();

    // Pause parallax when tray or panel is open to avoid z-fighting
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        tx = 0; ty = 0;
      }
    });
  }

  /* ─────────────────────────────
     INIT
  ───────────────────────────── */
  async function init() {
    const loader = initLoader();
    const state  = await waitForSubscription();
    handleAccess(state);

    initCursor();

    // Allow renderer to paint images
    setTimeout(() => {
      hydrateImages();
      injectTrayLabel();
      injectNavHint();
      showImage(0, /* skipAnim */ true);
      bindTray();
      bindOverlay();
      bindActions();
      bindKeyboard();
      bindParallax();
      dismissLoader(loader);
    }, 200);
  }

  init();

})();