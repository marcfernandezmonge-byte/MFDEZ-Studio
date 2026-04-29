/**
 * ═══════════════════════════════════════════════════════════
 * LOGIN PREMIUM — login.js  v4
 * ─────────────────────────────────────────────────────────
 * Módulos:
 *   1. PARTÍCULAS  — canvas de polvo digital en el fondo
 *   2. GLARE       — luz que sigue el cursor en el panel
 *   3. ENTRADA     — blur reveal animado al cargar
 *   4. FORMULARIO  — validación, toggle pw, submit
 *   5. NAVEGACIÓN  — forgotLink, guestBtn
 * ═══════════════════════════════════════════════════════════
 */

'use strict';

/* ══════════════════════════════════════════════════════
   1. PARTÍCULAS DIGITALES — canvas#bgParticles
   ──────────────────────────────────────────────────────
   Crea ~55 puntos de luz flotantes muy sutiles.
   Cada partícula tiene:
   • posición y velocidad aleatoria
   • tamaño entre 0.3 y 1.4 px
   • opacity oscillante (parpadeo suave)
   • color en la paleta azul / cian / blanco
   GPU-friendly: solo dibuja sobre canvas 2D.
   Soporta resize sin memory leaks.
══════════════════════════════════════════════════════ */
(function initParticles() {
  const canvas = document.getElementById('bgParticles');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  let W, H, particles, raf;

  /* Paleta de colores de las partículas */
  const COLORS = [
    'rgba(0,  143, 245,',  // azul eléctrico
    'rgba(0,  200, 230,',  // cian
    'rgba(120, 80, 255,',  // violeta
    'rgba(200,220, 255,',  // blanco-azulado
  ];

  /* Cantidad adaptada a la pantalla */
  function particleCount() {
    return Math.round((W * H) / 20000);
  }

  function createParticle() {
    const color = COLORS[Math.floor(Math.random() * COLORS.length)];
    return {
      x:    Math.random() * W,
      y:    Math.random() * H,
      vx:   (Math.random() - 0.5) * 0.18,  // muy lentas
      vy:   (Math.random() - 0.5) * 0.14,
      r:    Math.random() * 1.1 + 0.3,      // radio 0.3–1.4 px
      base: Math.random() * 0.55 + 0.15,    // opacity base
      amp:  Math.random() * 0.25,           // amplitud del parpadeo
      freq: Math.random() * 0.012 + 0.004,  // frecuencia parpadeo
      phase: Math.random() * Math.PI * 2,
      color,
    };
  }

  function resize() {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
    particles = Array.from({ length: particleCount() }, createParticle);
  }

  function draw(t) {
    ctx.clearRect(0, 0, W, H);

    for (const p of particles) {
      /* Mover */
      p.x += p.vx;
      p.y += p.vy;

      /* Rebote suave en bordes */
      if (p.x < 0) p.x = W;
      if (p.x > W) p.x = 0;
      if (p.y < 0) p.y = H;
      if (p.y > H) p.y = 0;

      /* Parpadeo sinusoidal */
      const alpha = p.base + Math.sin(t * p.freq + p.phase) * p.amp;

      /* Dibujar */
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `${p.color}${Math.max(0, Math.min(1, alpha)).toFixed(3)})`;
      ctx.fill();
    }

    raf = requestAnimationFrame(draw);
  }

  /* Init */
  resize();
  raf = requestAnimationFrame(draw);

  /* Resize con debounce para evitar reconstrucción continua */
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      cancelAnimationFrame(raf);
      resize();
      raf = requestAnimationFrame(draw);
    }, 120);
  });
})();


/* ══════════════════════════════════════════════════════
   2. GLARE — luz que sigue el cursor en el panel
   ──────────────────────────────────────────────────────
   Actualiza las custom properties --gx --gy en el panel
   con la posición relativa del cursor (0–100%).
   La transición CSS suaviza el movimiento.
   Al salir del panel, la opacidad cae a 0 vía CSS hover.
══════════════════════════════════════════════════════ */
(function initPanelGlare() {
  const panel = document.getElementById('loginPanel');
  const glare = document.getElementById('panelGlare');
  if (!panel || !glare) return;

  /* Throttle: solo actualiza en requestAnimationFrame */
  let ticking = false;
  let mx = 0, my = 0;

  panel.addEventListener('mousemove', (e) => {
    const rect = panel.getBoundingClientRect();
    mx = ((e.clientX - rect.left) / rect.width)  * 100;
    my = ((e.clientY - rect.top)  / rect.height) * 100;

    if (!ticking) {
      requestAnimationFrame(() => {
        glare.style.setProperty('--gx', `${mx.toFixed(1)}%`);
        glare.style.setProperty('--gy', `${my.toFixed(1)}%`);
        ticking = false;
      });
      ticking = true;
    }
  });
})();


/* ══════════════════════════════════════════════════════
   3. ANIMACIÓN DE ENTRADA
   ──────────────────────────────────────────────────────
   Doble rAF para garantizar que el browser ya pintó
   el estado inicial antes de aplicar is-visible.
══════════════════════════════════════════════════════ */
const loginPanel    = document.getElementById('loginPanel');
const animLogo      = document.getElementById('animLogo');   // reutilizado = panel-header

function runEntranceAnimation() {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      loginPanel.classList.add('is-visible');
      if (animLogo) animLogo.classList.add('is-visible');
    });
  });
}

window.addEventListener('DOMContentLoaded', runEntranceAnimation);


/* ══════════════════════════════════════════════════════
   4. FORMULARIO
   ──────────────────────────────────────────────────────
   IDs preservados exactamente — no rompe lógica anterior.
══════════════════════════════════════════════════════ */
const loginForm     = document.getElementById('loginForm');
const emailInput    = document.getElementById('email');
const passwordInput = document.getElementById('password');
const togglePassBtn = document.getElementById('togglePassword');
const submitBtn     = document.getElementById('submitBtn');
const fieldEmail    = document.getElementById('fieldEmail');
const fieldPassword = document.getElementById('fieldPassword');

/* ── Toggle visibilidad contraseña ── */
togglePassBtn.addEventListener('click', () => {
  const isPassword = passwordInput.type === 'password';
  passwordInput.type = isPassword ? 'text' : 'password';

  const eyeShow = togglePassBtn.querySelector('.eye-icon--show');
  const eyeHide = togglePassBtn.querySelector('.eye-icon--hide');
  eyeShow.style.display = isPassword ? 'none'  : 'block';
  eyeHide.style.display = isPassword ? 'block' : 'none';

  togglePassBtn.setAttribute(
    'aria-label',
    isPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'
  );
});

/* ── Validación ── */
function setFieldError(group, message) {
  group.classList.add('has-error');
  const el = group.querySelector('.field-error');
  if (el) el.textContent = message;
}

function clearFieldError(group) {
  group.classList.remove('has-error');
  const el = group.querySelector('.field-error');
  if (el) el.textContent = '';
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

emailInput.addEventListener('input',    () => clearFieldError(fieldEmail));
passwordInput.addEventListener('input', () => clearFieldError(fieldPassword));

function validateForm() {
  let isValid = true;

  if (!emailInput.value.trim()) {
    setFieldError(fieldEmail, 'El correo es obligatorio.');
    isValid = false;
  } else if (!isValidEmail(emailInput.value)) {
    setFieldError(fieldEmail, 'Introduce un correo válido.');
    isValid = false;
  }

  if (!passwordInput.value) {
    setFieldError(fieldPassword, 'La contraseña es obligatoria.');
    isValid = false;
  } else if (passwordInput.value.length < 6) {
    setFieldError(fieldPassword, 'Mínimo 6 caracteres.');
    isValid = false;
  }

  return isValid;
}

/* ── Shake de error ── */
function shakePanel() {
  loginPanel.classList.remove('shake');
  void loginPanel.offsetWidth;
  loginPanel.classList.add('shake');
  loginPanel.addEventListener('animationend', () => {
    loginPanel.classList.remove('shake');
  }, { once: true });
}

/* ── Estado de carga ── */
function setLoadingState(isLoading) {
  submitBtn.classList.toggle('is-loading', isLoading);
  submitBtn.disabled = isLoading;
  submitBtn.setAttribute('aria-busy', String(isLoading));
}

/* ── Submit ── */
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  clearFieldError(fieldEmail);
  clearFieldError(fieldPassword);

  if (!validateForm()) {
    shakePanel();
    return;
  }

  setLoadingState(true);

  try {
    // ─── BACKEND: POST /api/auth/login ───────────────────────────────────
    // URL absoluta obligatoria: el frontend corre en Live Server (puerto 5500)
    // y el backend en localhost:3000. Una ruta relativa enviaría la petición
    // al puerto 5500, que devuelve HTML → "Unexpected end of JSON input".
    const response = await fetch('http://localhost:3000/api/auth/login', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        email:    emailInput.value.trim(),
        password: passwordInput.value,
      }),
    });

    // Parseo seguro: si el backend devuelve una respuesta vacía o no-JSON
    // por cualquier error inesperado, response.json() lanzaría
    // "Unexpected end of JSON input". El try/catch lo captura sin romper el flujo.
    let data = null;
    try {
      data = await response.json();
    } catch {
      data = null;
    }

    if (!response.ok) {
      throw new Error(data?.message || 'Credenciales incorrectas');
    }

    // Guardar token, datos de usuario y redirigir al dashboard
    localStorage.setItem('token', data.token);
    if (data.user) {
      localStorage.setItem('user', JSON.stringify(data.user));
    }
    handleLoginSuccess();
    // ─────────────────────────────────────────────────────────────────────

  } catch (error) {
    handleLoginError(error.message || 'Error de autenticación.');
  } finally {
    setLoadingState(false);
  }
});

/* ── Éxito: panel sube y desaparece ── */
function handleLoginSuccess() {
  loginPanel.style.transition = 'opacity 380ms ease, transform 380ms var(--ease-smooth)';
  loginPanel.style.opacity    = '0';
  loginPanel.style.transform  = 'scale(1.015) translateY(-10px)';

  setTimeout(() => {
    window.location.href = '/src/pages/dashboard/dashboard.html';
    loginPanel.style.transition = '';
    loginPanel.style.opacity    = '';
    loginPanel.style.transform  = '';
  }, 420);
}

/* ── Error: mensaje + shake + limpiar campo ── */
function handleLoginError(message) {
  setFieldError(fieldPassword, message);
  shakePanel();
  passwordInput.value = '';
  passwordInput.focus();
}

/* ── Focus halo — data-attr para extensibilidad CSS ── */
[emailInput, passwordInput].forEach(input => {
  input.addEventListener('focus', () => {
    input.closest('.field-group')?.setAttribute('data-focused', 'true');
  });
  input.addEventListener('blur', () => {
    input.closest('.field-group')?.removeAttribute('data-focused');
  });
});



/* ══════════════════════════════════════════════════════
   5. NAVEGACIÓN
══════════════════════════════════════════════════════ */

/* "¿La olvidaste?" — valida email y llama al backend de recuperación */
const forgotLink = document.getElementById('forgotLink');
if (forgotLink) {
  forgotLink.addEventListener('click', async (e) => {
    e.preventDefault();

    if (!emailInput.value.trim() || !isValidEmail(emailInput.value)) {
      setFieldError(fieldEmail, 'Introduce tu correo primero.');
      emailInput.focus();
      return;
    }

    // ─── BACKEND: POST /api/auth/recover-password ────────────────────────
    try {
      forgotLink.style.pointerEvents = 'none';
      forgotLink.textContent         = 'Enviando…';

      const response = await fetch('http://localhost:3000/api/auth/recover-password', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email: emailInput.value.trim() }),
      });

      // Parseo seguro — mismo patrón defensivo que en login
      let data = null;
      try {
        data = await response.json();
      } catch {
        data = null;
      }

      // Mostrar el mensaje del backend (genérico por seguridad)
      setFieldError(fieldEmail, data?.message || 'Revisa tu bandeja de entrada.');
      fieldEmail.querySelector('.field-error').style.color = 'var(--color-success, #4ade80)';

    } catch {
      setFieldError(fieldEmail, 'No se pudo enviar el enlace. Inténtalo de nuevo.');
    } finally {
      forgotLink.style.pointerEvents = '';
      forgotLink.textContent         = '¿La olvidaste?';
    }
    // ─────────────────────────────────────────────────────────────────────
  });
}

/* Acceso sin sesión — fade-out + redirección */
const guestBtn = document.getElementById('guestBtn');
if (guestBtn) {
  guestBtn.addEventListener('click', () => {
    loginPanel.style.transition = 'opacity 300ms ease, transform 300ms var(--ease-smooth)';
    loginPanel.style.opacity    = '0';
    loginPanel.style.transform  = 'scale(0.985) translateY(8px)';

    setTimeout(() => {
      window.location.href = '../../pages/mainPage/mainPage.html';
    }, 320);
  });
}

/* Prevent zoom en double-tap iOS */
let lastTouch = 0;
document.addEventListener('touchend', (e) => {
  const now = Date.now();
  if (now - lastTouch < 300) e.preventDefault();
  lastTouch = now;
}, { passive: false });