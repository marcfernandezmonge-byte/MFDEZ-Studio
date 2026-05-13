(function () {
  'use strict';

  /* ─────────────────────────────────────────
     CONSTANTS
     ───────────────────────────────────────── */
  const REDIRECT_URL       = '/src/pages/collectorsClub/collectorsClub.html';
  const SUBSCRIBER_STATE   = 'subscriber';
  const ACCESS_TIMEOUT_MS  = 8000;
  const UI_HIDE_DELAY_MS   = 3400;

  // EXACT same asset base used in collectorsClub.js
  const ASSET_BASE = '/public/images/club/';

  function assetPath(fileName) {
    return `${ASSET_BASE}${encodeURIComponent(fileName).replace(/%2F/g, '/')}`;
  }

  /* ─────────────────────────────────────────
     STATIC IMAGE MANIFEST
     ───────────────────────────────────────── */
  const VAULT_IMAGES_MANIFEST = [
    {
      src: '@mfdezphoto- (1).jpg',
      edition: 'Vault #01',
      title: 'Circuit de Barcelona — P2 Grid',
      alt: 'LMP2 race car #43 on the grid at Circuit de Barcelona-Catalunya',
      fileName: '@mfdezphoto- (1).jpg',
    },
    {
      src: '@mfdezphoto--2.jpg',
      edition: 'Vault #02',
      title: 'Pit Lane — Driver Fitting',
      alt: 'Driver seated in LMP2 cockpit',
      fileName: '@mfdezphoto--2.jpg',
    },
    {
      src: '@mfdezphoto-4.jpg',
      edition: 'Vault #03',
      title: 'Ferrari 296 GT3 — Richard Mille',
      alt: 'Richard Mille Ferrari 296 GT3',
      fileName: '@mfdezphoto-4.jpg',
    },
    {
      src: '@mfdezphoto--7.jpg',
      edition: 'Vault #04',
      title: 'Enduro — Crowd & Motul Berm',
      alt: 'Motocross rider at hard enduro event',
      fileName: '@mfdezphoto--7.jpg',
    },
    {
      src: '@mfdezphoto--96.jpg',
      edition: 'Vault #05',
      title: 'Formula 4 — Pit Exit',
      alt: 'Formula 4 single-seater exiting pit lane',
      fileName: '@mfdezphoto--96.jpg',
    },
  ];

  /* ─────────────────────────────────────────
     ACCESS LAYER
     ───────────────────────────────────────── */
  const VaultAccess = {

    waitForSubscription() {
      return new Promise((resolve) => {

        if (typeof window.ccVaultAPI?.getSubscriptionState === 'function') {
          resolve(window.ccVaultAPI.getSubscriptionState());
          return;
        }

        const readAttr = () =>
          document.documentElement.dataset.ccSubscriptionState;

        const current = readAttr();

        if (current && current !== 'checking') {
          resolve(current);
          return;
        }

        const observer = new MutationObserver(() => {
          const next = readAttr();

          if (!next || next === 'checking') return;

          observer.disconnect();
          clearTimeout(timer);

          resolve(next);
        });

        observer.observe(document.documentElement, {
          attributes: true,
          attributeFilter: ['data-cc-subscription-state'],
        });

        const timer = setTimeout(() => {
          observer.disconnect();
          resolve(readAttr() || 'locked');
        }, ACCESS_TIMEOUT_MS);
      });
    },

    async getImages() {

      if (typeof window.ccVaultAPI?.getVaultImages === 'function') {
        try {
          const images = await window.ccVaultAPI.getVaultImages();

          if (Array.isArray(images) && images.length) {
            return images;
          }
        } catch {}
      }

      try {
        const res = await fetch('/public/data/vault-images.json');

        if (res.ok) {
          const data = await res.json();

          if (Array.isArray(data) && data.length) {
            return data;
          }
        }
      } catch {}

      return VAULT_IMAGES_MANIFEST;
    },
  };

  /* ─────────────────────────────────────────
     STATE
     ───────────────────────────────────────── */
  const state = {
    currentIndex: 0,
    hoveredIndex: null,
    displayedIndex: -1,
    activeLayer: 0,
    images: [],
    transitionToken: 0,
    uiTimer: 0,
  };

  const els = {};

  /* ─────────────────────────────────────────
     READY
     ───────────────────────────────────────── */
  function ready(callback) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', callback, { once: true });
      return;
    }

    callback();
  }

  /* ─────────────────────────────────────────
     CACHE DOM
     ───────────────────────────────────────── */
  function cacheElements() {
    els.page           = document.querySelector('.vault-page');
    els.gallery        = document.getElementById('vaultGallery');
    els.tray           = document.getElementById('vaultTray');
    els.trayTrigger    = document.getElementById('vaultTrayTrigger');
    els.infoPanel      = document.getElementById('vaultInfoPanel');
    els.status         = document.getElementById('vaultStatus');
    els.metaCount      = document.getElementById('vaultMetaCount');
    els.metaTitle      = document.getElementById('vaultMetaTitle');
    els.frontImage     = document.getElementById('vaultImageFront');
    els.backImage      = document.getElementById('vaultImageBack');
    els.infoButton     = document.querySelector('[data-action="info"]');
    els.downloadButton = document.querySelector('[data-action="download"]');
    els.clickZones     = document.querySelectorAll('[data-direction]');
  }

  /* ─────────────────────────────────────────
     THUMB CREATION
     ───────────────────────────────────────── */
  function createVaultThumb(image, index) {

    const btn = document.createElement('button');

    btn.type = 'button';
    btn.className = 'vault-thumb';
    btn.dataset.vaultIndex = String(index);
    btn.setAttribute('aria-label', image.edition);

    const img = document.createElement('img');

    img.className = 'vault-thumb__image';

    // FIXED
    img.src = assetPath(image.src);

    img.alt = image.alt;
    img.loading = index === 0 ? 'eager' : 'lazy';
    img.decoding = 'async';
    img.draggable = false;

    btn.appendChild(img);

    return btn;
  }

  function renderThumbnails(images) {

    els.gallery.innerHTML = '';

    const fragment = document.createDocumentFragment();

    images.forEach((image, index) => {
      fragment.appendChild(createVaultThumb(image, index));
    });

    els.gallery.appendChild(fragment);

    els.trayTrigger.textContent = `Archivo (${images.length})`;

    els.trayTrigger.setAttribute(
      'aria-label',
      `Abrir archivo, ${images.length} imágenes`
    );
  }

  /* ─────────────────────────────────────────
     IMAGE ENGINE
     ───────────────────────────────────────── */
  function wrapIndex(index) {
    const total = state.images.length;

    if (!total) return 0;

    return (index + total) % total;
  }

  function visibleImage() {
    return state.activeLayer === 0
      ? els.frontImage
      : els.backImage;
  }

  function hiddenImage() {
    return state.activeLayer === 0
      ? els.backImage
      : els.frontImage;
  }

  function imageReady(img) {

    if (img.complete && img.naturalWidth > 0) {
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      img.addEventListener('load', resolve, { once: true });
      img.addEventListener('error', resolve, { once: true });
    });
  }

  async function renderMainImage(index, options = {}) {

    const image = state.images[index];

    if (!image || state.displayedIndex === index) {

      visibleImage().classList.toggle(
        'is-preview',
        options.preview === true
      );

      updateMeta(index, options.preview === true);

      return;
    }

    const token = ++state.transitionToken;

    const next = options.immediate
      ? visibleImage()
      : hiddenImage();

    const current = visibleImage();

    next.classList.remove('is-visible', 'is-preview');

    // FIXED
    next.src = assetPath(image.src);

    next.alt = image.alt;
    next.setAttribute('aria-hidden', 'false');

    await imageReady(next);

    if (token !== state.transitionToken) return;

    next.classList.toggle(
      'is-preview',
      options.preview === true
    );

    next.classList.add('is-visible');

    if (!options.immediate) {

      current.classList.remove('is-visible', 'is-preview');

      current.setAttribute('aria-hidden', 'true');

      state.activeLayer = state.activeLayer === 0 ? 1 : 0;
    }

    state.displayedIndex = index;

    updateMeta(index, options.preview === true);
  }

  function updateMeta(index, isPreview) {

    const image = state.images[index];

    if (!image) return;

    const total = String(state.images.length).padStart(2, '0');

    const position = String(index + 1).padStart(2, '0');

    els.metaCount.textContent = isPreview
      ? `Vista previa ${position} / ${total}`
      : `${position} / ${total}`;

    els.metaTitle.textContent = image.edition;
  }

  function updateThumbState() {

    els.gallery.querySelectorAll('.vault-thumb').forEach((thumb, index) => {

      thumb.classList.toggle(
        'is-active',
        index === state.currentIndex
      );

      thumb.classList.toggle(
        'is-previewed',
        index === state.hoveredIndex
      );
    });

    els.gallery.classList.toggle(
      'is-previewing',
      state.hoveredIndex !== null
    );

    // Page-level focus state — entire chamber retreats during preview
    els.page.classList.toggle(
      'is-focusing',
      state.hoveredIndex !== null
    );
  }

  function preloadNeighbors(index) {

    if (state.images.length < 2) return;

    [
      wrapIndex(index - 1),
      wrapIndex(index + 1),
    ].forEach((nextIndex) => {

      const image = state.images[nextIndex];

      if (!image) return;

      const preload = new Image();

      preload.decoding = 'async';

      // FIXED
      preload.src = assetPath(image.src);
    });
  }

  function commitImage(index, options = {}) {

    const nextIndex = wrapIndex(index);

    state.currentIndex = nextIndex;
    state.hoveredIndex = null;

    updateThumbState();

    const renderPromise = renderMainImage(nextIndex, {
      immediate: options.immediate === true,
    });

    preloadNeighbors(nextIndex);

    if (els.infoPanel.classList.contains('is-open')) {
      renderInfoPanel(nextIndex);
    }

    return renderPromise;
  }

  function previewImage(index) {

    const nextIndex = wrapIndex(index);

    if (
      nextIndex === state.currentIndex &&
      state.hoveredIndex === null
    ) return;

    state.hoveredIndex = nextIndex;

    updateThumbState();

    renderMainImage(nextIndex, { preview: true });
  }

  function clearPreview() {

    if (state.hoveredIndex === null) return;

    state.hoveredIndex = null;

    updateThumbState();

    renderMainImage(state.currentIndex);
  }

  /* ─────────────────────────────────────────
     PANELS
     ───────────────────────────────────────── */
  function setTrayOpen(open) {

    els.tray.classList.toggle('is-open', open);

    els.page.classList.toggle('is-tray-open', open);

    els.tray.setAttribute('aria-hidden', String(!open));

    els.trayTrigger.setAttribute('aria-expanded', String(open));

    if (!open) clearPreview();

    showOverlayUi();
  }

  function setInfoOpen(open) {

    els.infoPanel.classList.toggle('is-open', open);

    els.page.classList.toggle('is-info-open', open);

    els.infoPanel.setAttribute('aria-hidden', String(!open));

    els.infoButton.setAttribute('aria-expanded', String(open));

    if (open) renderInfoPanel(state.currentIndex);

    showOverlayUi();
  }

  function showOverlayUi() {

    els.page.classList.add('is-ui-visible');

    clearTimeout(state.uiTimer);

    state.uiTimer = setTimeout(() => {

      if (
        els.tray.classList.contains('is-open') ||
        els.infoPanel.classList.contains('is-open')
      ) return;

      els.page.classList.remove('is-ui-visible');

    }, UI_HIDE_DELAY_MS);
  }

  /* ─────────────────────────────────────────
     DOWNLOAD
     ───────────────────────────────────────── */
  function sanitizeFileName(value) {

    return String(value || 'vault-image')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80) || 'vault-image';
  }

  function downloadCurrentImage() {

    const image = state.images[state.currentIndex];

    if (!image) return;

    const ext =
      (image.fileName || '')
        .match(/\.[a-z0-9]+$/i)?.[0] ?? '.jpg';

    const link = document.createElement('a');

    // FIXED
    link.href = assetPath(image.src);

    link.download = `${sanitizeFileName(image.edition)}${ext}`;

    document.body.appendChild(link);

    link.click();

    link.remove();
  }

  /* ─────────────────────────────────────────
     INFO PANEL
     ───────────────────────────────────────── */
  function appendText(parent, className, text, tagName = 'div') {

    const node = document.createElement(tagName);

    node.className = className;
    node.textContent = text;

    parent.appendChild(node);

    return node;
  }

  function renderInfoPanel(index) {

    const image = state.images[index];

    if (!image) return;

    els.infoPanel.innerHTML = '';

    const close = document.createElement('button');

    close.type = 'button';
    close.className = 'vault-info__close';
    close.textContent = 'Cerrar';

    close.addEventListener('click', () => setInfoOpen(false));

    els.infoPanel.appendChild(close);

    appendText(
      els.infoPanel,
      'vault-info__eyebrow',
      'Archivo del Coleccionista'
    );

    appendText(
      els.infoPanel,
      'vault-info__title',
      image.edition,
      'h2'
    );

    appendText(
      els.infoPanel,
      'vault-info__body',
      image.alt,
      'p'
    );

    const rows = document.createElement('div');

    rows.className = 'vault-info__rows';

    [
      ['Edici\u00f3n', image.edition],
      [
        'Posici\u00f3n',
        `${String(index + 1).padStart(2, '0')} / ${String(state.images.length).padStart(2, '0')}`,
      ],
      ['Archivo', image.fileName || 'Imagen'],
    ].forEach(([key, value]) => {

      const row = document.createElement('div');

      row.className = 'vault-info__row';

      appendText(row, 'vault-info__key', key, 'span');
      appendText(row, 'vault-info__value', value, 'span');

      rows.appendChild(row);
    });

    els.infoPanel.appendChild(rows);
  }

  /* ─────────────────────────────────────────
     EVENTS
     ───────────────────────────────────────── */
  function bindTray() {

    els.trayTrigger.addEventListener('click', () => {

      setTrayOpen(
        !els.tray.classList.contains('is-open')
      );
    });

    els.gallery.querySelectorAll('.vault-thumb').forEach((thumb, index) => {

      thumb.addEventListener('pointerenter', () => previewImage(index));

      thumb.addEventListener('focus', () => previewImage(index));

      thumb.addEventListener('click', (event) => {

        event.preventDefault();

        commitImage(index);

        setTrayOpen(false);
      });
    });

    els.gallery.addEventListener('pointerleave', clearPreview);

    els.gallery.addEventListener('focusout', (event) => {

      if (!els.gallery.contains(event.relatedTarget)) {
        clearPreview();
      }
    });

    document.addEventListener('click', (event) => {

      if (!els.tray.classList.contains('is-open')) return;

      if (
        els.tray.contains(event.target) ||
        els.trayTrigger.contains(event.target)
      ) return;

      setTrayOpen(false);
    });
  }

  function bindNavigation() {

    els.clickZones.forEach((zone) => {

      zone.addEventListener('click', () => {

        const delta =
          zone.dataset.direction === 'next'
            ? 1
            : -1;

        commitImage(state.currentIndex + delta);
      });
    });

    document.addEventListener('keydown', (event) => {

      showOverlayUi();

      if (event.key === 'ArrowRight') {
        event.preventDefault();
        commitImage(state.currentIndex + 1);
      }

      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        commitImage(state.currentIndex - 1);
      }

      if (event.key === 'Escape') {

        if (els.infoPanel.classList.contains('is-open')) {
          setInfoOpen(false);
        }

        if (els.tray.classList.contains('is-open')) {
          setTrayOpen(false);
        }
      }
    });
  }

  function bindOverlay() {

    ['mousemove', 'pointerdown', 'touchstart'].forEach((name) => {

      document.addEventListener(
        name,
        showOverlayUi,
        { passive: true }
      );
    });

    els.downloadButton.addEventListener(
      'click',
      downloadCurrentImage
    );

    els.infoButton.addEventListener('click', () => {

      setInfoOpen(
        !els.infoPanel.classList.contains('is-open')
      );
    });
  }

  /* ─────────────────────────────────────────
     ARCHITECTURAL PARALLAX
     Slow mouse-driven depth shift on the atmosphere.
     Updates CSS custom properties --mx and --my,
     normalized to [-1, 1] range. The CSS transforms
     apply the resulting offsets via calc() with slow
     transitions (2.4s) for monumental inertia.
     ───────────────────────────────────────── */
  function bindParallax() {

    // Respect user preferences and small viewports
    if (
      window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
      window.matchMedia('(pointer: coarse)').matches
    ) return;

    const atmosphere = document.querySelector('.vault-atmosphere');
    if (!atmosphere) return;

    let rafId = null;
    let targetX = 0;
    let targetY = 0;
    let currentX = 0;
    let currentY = 0;

    function tick() {
      // Eased follow — gravitational lag for monumental feel
      currentX += (targetX - currentX) * 0.04;
      currentY += (targetY - currentY) * 0.04;

      atmosphere.style.setProperty('--mx', currentX.toFixed(3));
      atmosphere.style.setProperty('--my', currentY.toFixed(3));

      // Stop the loop once we are close enough to target
      if (
        Math.abs(targetX - currentX) > 0.002 ||
        Math.abs(targetY - currentY) > 0.002
      ) {
        rafId = requestAnimationFrame(tick);
      } else {
        rafId = null;
      }
    }

    function onPointerMove(event) {
      const w = window.innerWidth || 1;
      const h = window.innerHeight || 1;

      // Normalize to [-1, 1] then dampen to [-0.6, 0.6]
      targetX = ((event.clientX / w) * 2 - 1) * 0.6;
      targetY = ((event.clientY / h) * 2 - 1) * 0.6;

      if (rafId === null) {
        rafId = requestAnimationFrame(tick);
      }
    }

    document.addEventListener('pointermove', onPointerMove, { passive: true });

    // Slow return-to-center on pointer leave
    document.addEventListener('pointerleave', () => {
      targetX = 0;
      targetY = 0;
      if (rafId === null) rafId = requestAnimationFrame(tick);
    });
  }

  /* ─────────────────────────────────────────
     STATUS
     ───────────────────────────────────────── */
  function hideStatus() {

    els.status.classList.add('is-hidden');

    els.page.dataset.vaultReady = 'true';

    setTimeout(() => {
      els.status.hidden = true;
    }, 1400);
  }

  /* ─────────────────────────────────────────
     INIT
     ───────────────────────────────────────── */
  async function init() {

    cacheElements();

    const subscriptionState =
      await VaultAccess.waitForSubscription();

    if (subscriptionState !== SUBSCRIBER_STATE) {

      window.location.replace(REDIRECT_URL);

      return;
    }

    const images = await VaultAccess.getImages();

    state.images = images;

    if (!state.images.length) {

      els.status.querySelector('span').textContent =
        'Archivo vacío';

      return;
    }

    renderThumbnails(state.images);

    bindTray();
    bindNavigation();
    bindOverlay();
    bindParallax();

    await commitImage(0, { immediate: true });

    hideStatus();
  }

  ready(init);

})();