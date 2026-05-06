(function () {
  'use strict';

  const REDIRECT_URL = '/src/pages/collectorsClub/collectorsClub.html';
  const SUBSCRIBER_STATE = 'subscriber';
  const ACCESS_TIMEOUT_MS = 8000;
  const GALLERY_TIMEOUT_MS = 5000;
  const UI_HIDE_DELAY_MS = 2400;

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

  function ready(callback) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', callback, { once: true });
      return;
    }

    callback();
  }

  function cacheElements() {
    els.page = document.querySelector('.vault-page');
    els.gallery = document.getElementById('vaultGallery');
    els.tray = document.getElementById('vaultTray');
    els.trayTrigger = document.getElementById('vaultTrayTrigger');
    els.infoPanel = document.getElementById('vaultInfoPanel');
    els.status = document.getElementById('vaultStatus');
    els.metaCount = document.getElementById('vaultMetaCount');
    els.metaTitle = document.getElementById('vaultMetaTitle');
    els.frontImage = document.getElementById('vaultImageFront');
    els.backImage = document.getElementById('vaultImageBack');
    els.infoButton = document.querySelector('[data-action="info"]');
    els.downloadButton = document.querySelector('[data-action="download"]');
    els.clickZones = document.querySelectorAll('[data-direction]');
  }

  function waitForSubscriptionState() {
    return new Promise((resolve) => {
      const existing = document.documentElement.dataset.ccSubscriptionState;
      if (existing && existing !== 'checking') {
        resolve(existing);
        return;
      }

      const observer = new MutationObserver(() => {
        const nextState = document.documentElement.dataset.ccSubscriptionState;
        if (!nextState || nextState === 'checking') return;
        observer.disconnect();
        clearTimeout(timer);
        resolve(nextState);
      });

      observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['data-cc-subscription-state'],
      });

      const timer = setTimeout(() => {
        observer.disconnect();
        resolve(document.documentElement.dataset.ccSubscriptionState || 'locked');
      }, ACCESS_TIMEOUT_MS);
    });
  }

  function waitForRenderedGallery() {
    return new Promise((resolve) => {
      const readImages = () => Array.from(els.gallery.querySelectorAll('.cc-vault-gallery__item img'));
      const existing = readImages();
      if (existing.length) {
        resolve(existing);
        return;
      }

      const observer = new MutationObserver(() => {
        const images = readImages();
        if (!images.length) return;
        observer.disconnect();
        clearTimeout(timer);
        resolve(images);
      });

      observer.observe(els.gallery, { childList: true, subtree: true });

      const timer = setTimeout(() => {
        observer.disconnect();
        resolve(readImages());
      }, GALLERY_TIMEOUT_MS);
    });
  }

  function redirectToCollectorsClub() {
    window.location.replace(REDIRECT_URL);
  }

  function textFrom(value, fallback) {
    const text = String(value || '').trim();
    return text || fallback;
  }

  function fileNameFromUrl(src) {
    try {
      const url = new URL(src, window.location.origin);
      const lastPart = url.pathname.split('/').filter(Boolean).pop();
      return lastPart ? decodeURIComponent(lastPart) : '';
    } catch {
      return '';
    }
  }

  function hydrateImages() {
    const items = Array.from(els.gallery.querySelectorAll('.cc-vault-gallery__item'));

    state.images = items
      .map((item, index) => {
        const img = item.querySelector('img');
        if (!img) return null;

        const edition = textFrom(item.dataset.edition, `Vault #${String(index + 1).padStart(2, '0')}`);
        const alt = textFrom(img.alt, edition);
        const src = img.currentSrc || img.src || img.getAttribute('src');
        const fileName = fileNameFromUrl(src);

        item.classList.add('vault-thumb');
        item.dataset.vaultIndex = String(index);
        item.type = 'button';
        item.setAttribute('aria-label', edition);

        img.loading = index === 0 ? 'eager' : 'lazy';
        img.decoding = 'async';
        img.draggable = false;

        return { src, alt, edition, fileName };
      })
      .filter(Boolean);

    els.trayTrigger.textContent = `Coleccion (${state.images.length})`;
    els.trayTrigger.setAttribute('aria-label', `Abrir coleccion, ${state.images.length} imagenes`);
  }

  function wrapIndex(index) {
    const total = state.images.length;
    if (!total) return 0;
    return (index + total) % total;
  }

  function visibleImage() {
    return state.activeLayer === 0 ? els.frontImage : els.backImage;
  }

  function hiddenImage() {
    return state.activeLayer === 0 ? els.backImage : els.frontImage;
  }

  function imageReady(img) {
    if (img.complete && img.naturalWidth > 0) return Promise.resolve();

    return new Promise((resolve) => {
      img.addEventListener('load', resolve, { once: true });
      img.addEventListener('error', resolve, { once: true });
    });
  }

  async function renderMainImage(index, options = {}) {
    const image = state.images[index];
    if (!image || state.displayedIndex === index) {
      visibleImage().classList.toggle('is-preview', options.preview === true);
      updateMeta(index, options.preview === true);
      return;
    }

    const token = ++state.transitionToken;
    const next = options.immediate ? visibleImage() : hiddenImage();
    const current = visibleImage();

    next.classList.remove('is-visible', 'is-preview');
    next.src = image.src;
    next.alt = image.alt;
    next.setAttribute('aria-hidden', 'false');

    await imageReady(next);
    if (token !== state.transitionToken) return;

    next.classList.toggle('is-preview', options.preview === true);
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
    els.metaCount.textContent = isPreview ? `Preview ${position} / ${total}` : `${position} / ${total}`;
    els.metaTitle.textContent = image.edition;
  }

  function updateThumbState() {
    els.gallery.querySelectorAll('.cc-vault-gallery__item').forEach((item, index) => {
      item.classList.toggle('is-active', index === state.currentIndex);
      item.classList.toggle('is-previewed', index === state.hoveredIndex);
    });

    els.gallery.classList.toggle('is-previewing', state.hoveredIndex !== null);
  }

  function preloadNeighbors(index) {
    if (state.images.length < 2) return;

    [wrapIndex(index - 1), wrapIndex(index + 1)].forEach((nextIndex) => {
      const image = state.images[nextIndex];
      if (!image) return;
      const preload = new Image();
      preload.decoding = 'async';
      preload.src = image.src;
    });
  }

  function commitImage(index, options = {}) {
    const nextIndex = wrapIndex(index);
    state.currentIndex = nextIndex;
    state.hoveredIndex = null;
    updateThumbState();
    const renderPromise = renderMainImage(nextIndex, { immediate: options.immediate === true });
    preloadNeighbors(nextIndex);

    if (els.infoPanel.classList.contains('is-open')) {
      renderInfoPanel(nextIndex);
    }

    return renderPromise;
  }

  function previewImage(index) {
    const nextIndex = wrapIndex(index);
    if (nextIndex === state.currentIndex && state.hoveredIndex === null) return;

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
      if (els.tray.classList.contains('is-open') || els.infoPanel.classList.contains('is-open')) return;
      els.page.classList.remove('is-ui-visible');
    }, UI_HIDE_DELAY_MS);
  }

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

    const extensionMatch = image.fileName.match(/\.[a-z0-9]+$/i);
    const extension = extensionMatch ? extensionMatch[0] : '.jpg';
    const link = document.createElement('a');

    link.href = image.src;
    link.download = `${sanitizeFileName(image.edition)}${extension}`;
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

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
    close.textContent = 'Close';
    close.addEventListener('click', () => setInfoOpen(false));
    els.infoPanel.appendChild(close);

    appendText(els.infoPanel, 'vault-info__eyebrow', "Collector's Vault");
    appendText(els.infoPanel, 'vault-info__title', image.edition, 'h2');
    appendText(els.infoPanel, 'vault-info__body', image.alt, 'p');

    const rows = document.createElement('div');
    rows.className = 'vault-info__rows';

    [
      ['Edition', image.edition],
      ['Position', `${String(index + 1).padStart(2, '0')} / ${String(state.images.length).padStart(2, '0')}`],
      ['File', image.fileName || 'Image asset'],
    ].forEach(([key, value]) => {
      const row = document.createElement('div');
      row.className = 'vault-info__row';
      appendText(row, 'vault-info__key', key, 'span');
      appendText(row, 'vault-info__value', value, 'span');
      rows.appendChild(row);
    });

    els.infoPanel.appendChild(rows);
  }

  function bindTray() {
    els.trayTrigger.addEventListener('click', () => {
      setTrayOpen(!els.tray.classList.contains('is-open'));
    });

    els.gallery.querySelectorAll('.cc-vault-gallery__item').forEach((item, index) => {
      item.addEventListener('pointerenter', () => previewImage(index));
      item.addEventListener('focus', () => previewImage(index));
      item.addEventListener('click', (event) => {
        event.preventDefault();
        commitImage(index);
        setTrayOpen(false);
      });
    });

    els.gallery.addEventListener('pointerleave', clearPreview);
    els.gallery.addEventListener('focusout', (event) => {
      if (!els.gallery.contains(event.relatedTarget)) clearPreview();
    });

    document.addEventListener('click', (event) => {
      if (!els.tray.classList.contains('is-open')) return;
      if (els.tray.contains(event.target) || els.trayTrigger.contains(event.target)) return;
      setTrayOpen(false);
    });
  }

  function bindNavigation() {
    els.clickZones.forEach((zone) => {
      zone.addEventListener('click', () => {
        const delta = zone.dataset.direction === 'next' ? 1 : -1;
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
        if (els.infoPanel.classList.contains('is-open')) setInfoOpen(false);
        if (els.tray.classList.contains('is-open')) setTrayOpen(false);
      }
    });
  }

  function bindOverlay() {
    ['mousemove', 'pointerdown', 'touchstart'].forEach((eventName) => {
      document.addEventListener(eventName, showOverlayUi, { passive: true });
    });

    els.downloadButton.addEventListener('click', downloadCurrentImage);
    els.infoButton.addEventListener('click', () => {
      setInfoOpen(!els.infoPanel.classList.contains('is-open'));
    });
  }

  function hideStatus() {
    els.status.classList.add('is-hidden');
    els.page.dataset.vaultReady = 'true';
    setTimeout(() => {
      els.status.hidden = true;
    }, 260);
  }

  async function init() {
    cacheElements();

    const subscriptionState = await waitForSubscriptionState();
    if (subscriptionState !== SUBSCRIBER_STATE) {
      redirectToCollectorsClub();
      return;
    }

    await waitForRenderedGallery();
    hydrateImages();

    if (!state.images.length) {
      els.status.querySelector('span').textContent = 'No vault images found';
      return;
    }

    bindTray();
    bindNavigation();
    bindOverlay();
    await commitImage(0, { immediate: true });
    hideStatus();
  }

  ready(init);
})();
