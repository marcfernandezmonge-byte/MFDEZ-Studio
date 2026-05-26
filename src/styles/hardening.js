/* ================================================================
   MFDEZ STUDIO — hardening.js
   Pasada FINAL de polish global. Ligero, defensivo y no-intrusivo.
   - Bloquea click derecho SOLO sobre imágenes (no sobre la página).
   - Bloquea drag de imágenes (gesto + dataTransfer).
   - Bloquea selección por click sostenido sobre imágenes.
   - NO interfiere con sliders, modales, lightbox ni navegación.
================================================================ */
(function MFDEZHardening() {
  'use strict';

  // ─── 1. Drag de imágenes ─────────────────────────────────────
  // No usamos capture:true para no interferir con sliders que
  // tengan su propio handler en mousedown/pointerdown.
  document.addEventListener('dragstart', function (e) {
    const t = e.target;
    if (t && (t.tagName === 'IMG' || t.tagName === 'PICTURE' || t.tagName === 'VIDEO')) {
      e.preventDefault();
    }
  });

  // ─── 2. Context menu solo en imágenes ────────────────────────
  // Permitimos click derecho en el resto de la web (inspeccionar,
  // copiar texto, etc.); solo bloqueamos sobre contenido visual.
  document.addEventListener('contextmenu', function (e) {
    const t = e.target;
    if (!t) return;

    // Imagen directa
    if (t.tagName === 'IMG' || t.tagName === 'PICTURE' || t.tagName === 'VIDEO') {
      e.preventDefault();
      return;
    }

    // Elemento con background-image (hero cards, vault, etc.)
    // Solo si la página lo marca con [data-protected] para no
    // bloquear contextmenu en zonas que el dev quiera permitir.
    if (t.closest && t.closest('[data-protected]')) {
      e.preventDefault();
    }
  });

  // ─── 3. Defensa anti-selección sobre imágenes ────────────────
  // Algunos navegadores permiten arrastrar tras un mousedown
  // largo. Cancelamos selectstart únicamente cuando arranca
  // sobre un <img>.
  document.addEventListener('selectstart', function (e) {
    const t = e.target;
    if (t && t.tagName === 'IMG') {
      e.preventDefault();
    }
  });

  // ─── 4. Asignar draggable=false a imágenes ya en DOM ─────────
  // Es defensa en profundidad: CSS lo hace ya, pero el atributo
  // HTML evita el ghost drag en Firefox y Edge legacy.
  function harden(img) {
    try {
      img.setAttribute('draggable', 'false');
    } catch (_) { /* noop */ }
  }

  function init() {
    document.querySelectorAll('img').forEach(harden);

    // Observa imágenes añadidas dinámicamente (vault, dashboard, etc.)
    if (typeof MutationObserver === 'function') {
      const mo = new MutationObserver(function (records) {
        for (const r of records) {
          r.addedNodes && r.addedNodes.forEach(function (node) {
            if (!node || node.nodeType !== 1) return;
            if (node.tagName === 'IMG') {
              harden(node);
            } else if (node.querySelectorAll) {
              node.querySelectorAll('img').forEach(harden);
            }
          });
        }
      });
      mo.observe(document.documentElement, { childList: true, subtree: true });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
