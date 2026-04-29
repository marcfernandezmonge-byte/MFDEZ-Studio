/**
 * ═══════════════════════════════════════════════════════════
 * REGISTER PREMIUM — register.js
 * Derivado de login.js v4 — arquitectura modular idéntica.
 * ─────────────────────────────────────────────────────────
 * Módulos:
 *   1. PARTÍCULAS  — canvas de polvo digital (idéntico a login)
 *   2. GLARE       — luz que sigue el cursor en el panel
 *   3. ENTRADA     — blur reveal animado al cargar
 *   4. FORMULARIO  — validación completa, toggles pw ×2,
 *                    barra de fuerza, submit con simulación
 *   5. UTILIDADES  — prevent zoom iOS
 * ─────────────────────────────────────────────────────────
 * Punto de integración backend documentado en módulo 4.
 * POST /api/auth/register  →  { name, email, password }
 * ═══════════════════════════════════════════════════════════
 */

'use strict';


/* ══════════════════════════════════════════════════════
   1. PARTÍCULAS DIGITALES — canvas#bgParticles
   ──────────────────────────────────────────────────────
   Idéntico a login.js — sistema visual compartido.
   ~55 puntos de luz flotantes con parpadeo sinusoidal.
   Paleta: azul eléctrico / cian / violeta / blanco-azulado.
══════════════════════════════════════════════════════ */
(function initParticles() {
  const canvas = document.getElementById('bgParticles');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  let W, H, particles, raf;

  const COLORS = [
    'rgba(0,  143, 245,',   // azul eléctrico
    'rgba(0,  200, 230,',   // cian
    'rgba(120, 80, 255,',   // violeta
    'rgba(200,220, 255,',   // blanco-azulado
  ];

  function particleCount() {
    return Math.round((W * H) / 20000);
  }

  function createParticle() {
    const color = COLORS[Math.floor(Math.random() * COLORS.length)];
    return {
      x:     Math.random() * W,
      y:     Math.random() * H,
      vx:    (Math.random() - 0.5) * 0.18,
      vy:    (Math.random() - 0.5) * 0.14,
      r:     Math.random() * 1.1 + 0.3,
      base:  Math.random() * 0.55 + 0.15,
      amp:   Math.random() * 0.25,
      freq:  Math.random() * 0.012 + 0.004,
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
      p.x += p.vx;
      p.y += p.vy;

      /* Rebote en bordes — envolvimiento suave */
      if (p.x < 0) p.x = W;
      if (p.x > W) p.x = 0;
      if (p.y < 0) p.y = H;
      if (p.y > H) p.y = 0;

      const alpha = p.base + Math.sin(t * p.freq + p.phase) * p.amp;

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `${p.color}${Math.max(0, Math.min(1, alpha)).toFixed(3)})`;
      ctx.fill();
    }

    raf = requestAnimationFrame(draw);
  }

  resize();
  raf = requestAnimationFrame(draw);

  /* Resize con debounce — evita reconstrucción continua */
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
   Actualiza --gx y --gy en el panel con la posición
   relativa del cursor (0–100%).
   ID actualizado: registerPanel / panelGlare.
══════════════════════════════════════════════════════ */
(function initPanelGlare() {
  const panel = document.getElementById('registerPanel');
  const glare = document.getElementById('panelGlare');
  if (!panel || !glare) return;

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
   Doble rAF para que el browser pinte el estado inicial
   (opacity:0 + blur) antes de añadir .is-visible.
   IDs: registerPanel + animLogo (panel-header).
══════════════════════════════════════════════════════ */
const registerPanel = document.getElementById('registerPanel');
const animLogo      = document.getElementById('animLogo');

function runEntranceAnimation() {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      registerPanel.classList.add('is-visible');
      if (animLogo) animLogo.classList.add('is-visible');
    });
  });
}

window.addEventListener('DOMContentLoaded', runEntranceAnimation);


/* ══════════════════════════════════════════════════════
   4. FORMULARIO DE REGISTRO
   ──────────────────────────────────────────────────────
   Campos: name · email · password · confirmPassword · terms
   Extras respecto al login:
     · Toggle en ambos campos de contraseña
     · Barra de fuerza de contraseña (4 niveles)
     · Estado .has-match en confirmPassword
     · Validación de coincidencia de contraseñas
     · Validación de aceptación de términos
══════════════════════════════════════════════════════ */

/* ── Referencias al DOM ── */
const registerForm     = document.getElementById('registerForm');
const nameInput        = document.getElementById('name');
const emailInput       = document.getElementById('email');
const passwordInput    = document.getElementById('password');
const confirmInput     = document.getElementById('confirmPassword');
const termsInput       = document.getElementById('terms');
const togglePassBtn    = document.getElementById('togglePassword');
const toggleConfirmBtn = document.getElementById('toggleConfirm');
const submitBtn        = document.getElementById('submitBtn');
const fieldName        = document.getElementById('fieldName');
const fieldEmail       = document.getElementById('fieldEmail');
const fieldPassword    = document.getElementById('fieldPassword');
const fieldConfirm     = document.getElementById('fieldConfirm');
const fieldTerms       = document.getElementById('fieldTerms');
const strengthWrap     = document.getElementById('strengthWrap');
const strengthBar      = document.getElementById('strengthBar');

/* ══ Toggle visibilidad de contraseña (reutilizable) ══
   Función genérica para cualquier par btn + input.
   Elimina la duplicación que habría con dos handlers.      */
function setupPasswordToggle(btn, input) {
  if (!btn || !input) return;

  btn.addEventListener('click', () => {
    const isPassword = input.type === 'password';
    input.type = isPassword ? 'text' : 'password';

    const eyeShow = btn.querySelector('.eye-icon--show');
    const eyeHide = btn.querySelector('.eye-icon--hide');
    if (eyeShow) eyeShow.style.display = isPassword ? 'none'  : 'block';
    if (eyeHide) eyeHide.style.display = isPassword ? 'block' : 'none';

    btn.setAttribute(
      'aria-label',
      isPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'
    );
  });
}

setupPasswordToggle(togglePassBtn,    passwordInput);
setupPasswordToggle(toggleConfirmBtn, confirmInput);


/* ══ Fuerza de contraseña — 4 niveles ══
   Algoritmo acumulativo:
     +1 si >= 6 chars   (longitud mínima)
     +1 si >= 10 chars  (longitud buena)
     +1 si tiene mayúscula O número
     +1 si tiene carácter especial                          */
function getPasswordStrength(pw) {
  if (!pw || pw.length === 0) return 0;
  let score = 0;
  if (pw.length >= 6)                          score++;
  if (pw.length >= 10)                         score++;
  if (/[A-Z]/.test(pw) || /[0-9]/.test(pw))   score++;
  if (/[^A-Za-z0-9]/.test(pw))                score++;
  return Math.min(score, 4);
}

passwordInput.addEventListener('input', () => {
  clearFieldError(fieldPassword);

  const pw       = passwordInput.value;
  const level    = getPasswordStrength(pw);
  const isActive = pw.length > 0;

  strengthWrap.classList.toggle('is-active', isActive);

  if (isActive) {
    strengthBar.setAttribute('data-level', String(level));
  } else {
    strengthBar.removeAttribute('data-level');
  }

  /* Actualizar coincidencia si confirm ya tiene valor */
  if (confirmInput.value) {
    updateMatchState();
  }
});


/* ══ Estado de coincidencia — feedback positivo ══
   Aplica .has-match cuando los campos coinciden,
   eliminando .has-error si estaba presente.               */
function updateMatchState() {
  const matches = confirmInput.value === passwordInput.value
                  && confirmInput.value.length > 0;

  if (matches) {
    fieldConfirm.classList.remove('has-error');
    fieldConfirm.classList.add('has-match');
    const errEl = fieldConfirm.querySelector('.field-error');
    if (errEl) errEl.textContent = '';
  } else {
    fieldConfirm.classList.remove('has-match');
  }
}

confirmInput.addEventListener('input', () => {
  clearFieldError(fieldConfirm);
  updateMatchState();
});


/* ══ Helpers de validación de campos ══ */
function setFieldError(group, message) {
  group.classList.remove('has-match'); /* limpia éxito si había */
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

/* Limpiar errores al editar */
nameInput.addEventListener('input',   () => clearFieldError(fieldName));
emailInput.addEventListener('input',  () => clearFieldError(fieldEmail));
termsInput.addEventListener('change', () => clearFieldError(fieldTerms));


/* ══ Validación completa del formulario ══ */
function validateForm() {
  let isValid = true;

  /* ── Nombre ── */
  const nameVal = nameInput.value.trim();
  if (!nameVal) {
    setFieldError(fieldName, 'El nombre es obligatorio.');
    isValid = false;
  } else if (nameVal.length < 2) {
    setFieldError(fieldName, 'El nombre debe tener al menos 2 caracteres.');
    isValid = false;
  }

  /* ── Email ── */
  if (!emailInput.value.trim()) {
    setFieldError(fieldEmail, 'El correo es obligatorio.');
    isValid = false;
  } else if (!isValidEmail(emailInput.value)) {
    setFieldError(fieldEmail, 'Introduce un correo válido.');
    isValid = false;
  }

  /* ── Contraseña ── */
  if (!passwordInput.value) {
    setFieldError(fieldPassword, 'La contraseña es obligatoria.');
    isValid = false;
  } else if (passwordInput.value.length < 6) {
    setFieldError(fieldPassword, 'Mínimo 6 caracteres.');
    isValid = false;
  }

  /* ── Confirmar contraseña ── */
  if (!confirmInput.value) {
    setFieldError(fieldConfirm, 'Confirma tu contraseña.');
    isValid = false;
  } else if (confirmInput.value !== passwordInput.value) {
    setFieldError(fieldConfirm, 'Las contraseñas no coinciden.');
    isValid = false;
  }

  /* ── Términos ── */
  if (!termsInput.checked) {
    setFieldError(fieldTerms, 'Debes aceptar los términos para continuar.');
    isValid = false;
  }

  return isValid;
}


/* ══ Shake del panel en error ══ */
function shakePanel() {
  registerPanel.classList.remove('shake');
  void registerPanel.offsetWidth; /* fuerza reflow para reiniciar animación */
  registerPanel.classList.add('shake');
  registerPanel.addEventListener('animationend', () => {
    registerPanel.classList.remove('shake');
  }, { once: true });
}


/* ══ Estado de carga ══ */
function setLoadingState(isLoading) {
  submitBtn.classList.toggle('is-loading', isLoading);
  submitBtn.disabled = isLoading;
  submitBtn.setAttribute('aria-busy', String(isLoading));
}


/* ══ Submit ══ */
registerForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  /* Limpiar todos los errores */
  [fieldName, fieldEmail, fieldPassword, fieldConfirm, fieldTerms]
    .forEach(clearFieldError);

  if (!validateForm()) {
    shakePanel();
    return;
  }

  setLoadingState(true);

  try {
    // ─── BACKEND: POST /api/auth/register ────────────────────────────────
    // URL absoluta obligatoria: el frontend corre en Live Server (puerto 5500)
    // y el backend en localhost:3000. Una ruta relativa enviaría la petición
    // al puerto 5500, que devuelve HTML → "Unexpected end of JSON input".
    const response = await fetch('http://localhost:3000/api/auth/register', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        name:     nameInput.value.trim(),
        email:    emailInput.value.trim(),
        password: passwordInput.value,
      }),
    });

    // Parseo seguro: si el backend devuelve una respuesta vacía o HTML por
    // error inesperado, response.json() lanzaría "Unexpected end of JSON input".
    // El try/catch lo captura y data queda como null para que el throw sea seguro.
    let data = null;
    try {
      data = await response.json();
    } catch {
      data = null;
    }

    if (!response.ok) {
      throw new Error(data?.message || 'Error en el registro');
    }

    // Guardar token, datos de usuario y redirigir al dashboard
    localStorage.setItem('token', data.token);
    if (data.user) {
      localStorage.setItem('user', JSON.stringify(data.user));
    }
    handleRegisterSuccess();
    // ─────────────────────────────────────────────────────────────────────

  } catch (error) {
    handleRegisterError(error.message || 'Error al crear la cuenta.');
  } finally {
    setLoadingState(false);
  }
});


/* ══ Éxito: panel sube y desaparece ══ */
function handleRegisterSuccess() {
  registerPanel.style.transition = 'opacity 380ms ease, transform 380ms var(--ease-smooth)';
  registerPanel.style.opacity    = '0';
  registerPanel.style.transform  = 'scale(1.015) translateY(-10px)';

  setTimeout(() => {
    window.location.href = '/src/pages/dashboard/dashboard.html';
  }, 420);
}


/* ══ Error de servidor: mensaje en email + shake ══ */
function handleRegisterError(message) {
  setFieldError(fieldEmail, message);
  shakePanel();
  emailInput.focus();
}


/* ══ Focus halo — data-attr para extensibilidad CSS ══ */
[nameInput, emailInput, passwordInput, confirmInput].forEach(input => {
  input.addEventListener('focus', () => {
    input.closest('.field-group')?.setAttribute('data-focused', 'true');
  });
  input.addEventListener('blur', () => {
    input.closest('.field-group')?.removeAttribute('data-focused');
  });
});




/* ══════════════════════════════════════════════════════
   5. UTILIDADES
══════════════════════════════════════════════════════ */

/* Prevent zoom en double-tap iOS */
let lastTouch = 0;
document.addEventListener('touchend', (e) => {
  const now = Date.now();
  if (now - lastTouch < 300) e.preventDefault();
  lastTouch = now;
}, { passive: false });