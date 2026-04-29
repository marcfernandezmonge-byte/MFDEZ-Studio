/**
 * contacto.js — Frontend del formulario de contacto
 * ─────────────────────────────────────────────────────────────────────────────
 * Responsabilidad:
 *   1. Cursor personalizado
 *   2. Envío del formulario al backend vía POST /api/messages
 *   3. Gestión de estados: loading → éxito / error
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use strict';

/* ══════════════════════════════════════════════════════
   CONFIG
══════════════════════════════════════════════════════ */
const API_BASE = 'http://localhost:3000';  // Ajustar si cambia el puerto


/* ══════════════════════════════════════════════════════
   1. CURSOR PERSONALIZADO
══════════════════════════════════════════════════════ */
(function initCursor() {
  const dot  = document.getElementById('cursorDot');
  const ring = document.getElementById('cursorRing');
  if (!dot || !ring) return;

  let rx = 0, ry = 0;  // posición suavizada del ring

  document.addEventListener('mousemove', (e) => {
    // Dot sigue el cursor exacto
    dot.style.left = `${e.clientX}px`;
    dot.style.top  = `${e.clientY}px`;

    // Ring con lerp suave via requestAnimationFrame
    rx += (e.clientX - rx) * 0.12;
    ry += (e.clientY - ry) * 0.12;
    ring.style.left = `${rx}px`;
    ring.style.top  = `${ry}px`;
  });

  // Agrandar ring sobre elementos interactivos
  document.querySelectorAll('a, button, input, textarea').forEach(el => {
    el.addEventListener('mouseenter', () => {
      ring.style.width  = '52px';
      ring.style.height = '52px';
      ring.style.borderColor = 'rgba(0,143,245,0.7)';
    });
    el.addEventListener('mouseleave', () => {
      ring.style.width  = '32px';
      ring.style.height = '32px';
      ring.style.borderColor = 'rgba(0,143,245,0.45)';
    });
  });
})();


/* ══════════════════════════════════════════════════════
   2. FORMULARIO DE CONTACTO
   ──────────────────────────────────────────────────────
   Flujo:
     1. Validar campos y token de sesión
     2. POST http://localhost:3000/api/messages
        Headers: Content-Type + Authorization: Bearer <token>
        Body:    { nombre, mensaje }
     3. Mostrar éxito o error en #formStatus
══════════════════════════════════════════════════════ */
(function initContactForm() {
  const form      = document.getElementById('contactForm');
  const statusEl  = document.getElementById('formStatus');
  const submitBtn = form?.querySelector('.btn-submit');

  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const nombre  = document.getElementById('nombre')?.value.trim()  || '';
    const mensaje = document.getElementById('mensaje')?.value.trim() || '';

    /* ── Validación básica ── */
    if (nombre.length < 2) {
      showStatus('El nombre debe tener al menos 2 caracteres.', 'error');
      return;
    }
    if (mensaje.length < 5) {
      showStatus('El mensaje debe tener al menos 5 caracteres.', 'error');
      return;
    }

    /* ── Token de autenticación ── */
    const token = localStorage.getItem('token');
    if (!token) {
      showStatus('Debes iniciar sesión para enviar un mensaje.', 'error');
      return;
    }

    /* ── Estado de carga ── */
    setLoading(true);

    try {
      console.log('[Contacto] POST /api/messages →', { nombre, mensaje });

      const response = await fetch(`${API_BASE}/api/messages`, {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ nombre, mensaje }),
      });

      /* ── Parsear respuesta ── */
      let data = {};
      try {
        data = await response.json();
      } catch {
        data = {};
      }

      console.log('[Contacto] Respuesta del servidor:', response.status, data);

      if (!response.ok) {
        const msg = data.message || `Error ${response.status} al enviar el mensaje.`;
        throw new Error(msg);
      }

      /* ── Éxito ── */
      showStatus('Mensaje enviado ✓', 'success');
      form.reset();

    } catch (error) {
      console.error('[Contacto] Error en POST /api/messages:', error);
      showStatus(error.message || 'Error al enviar. Inténtalo de nuevo.', 'error');
    } finally {
      setLoading(false);
    }
  });

  /* ── Helpers ── */
  function setLoading(isLoading) {
    if (!submitBtn) return;
    submitBtn.disabled = isLoading;
    const label = submitBtn.querySelector('span:first-child');
    if (label) label.textContent = isLoading ? 'Enviando…' : 'Enviar mensaje';
  }

  function showStatus(message, type) {
    if (!statusEl) return;
    statusEl.textContent = message;
    statusEl.style.color = type === 'error' ? '#F45C5C' : 'var(--accent, #008FF5)';
    statusEl.classList.add('visible');

    // Ocultar automáticamente después de 5 s
    clearTimeout(statusEl._hideTimer);
    statusEl._hideTimer = setTimeout(() => {
      statusEl.classList.remove('visible');
    }, 5000);
  }
})();