/* =============================================================
   GRID STUDIO — SERVICIOS — servicios.js
   Fixes:
     · Modal no se cierra al interactuar dentro
     · Error al cargar plan no bloquea los packs
     · Servicios puntuales fijan el servicio solicitado
     · Servicios puntuales y servicios a medida usan flujos separados
============================================================= */

'use strict';

// === CONFIG ==================================================
const API_BASE = 'http://localhost:3000/api';
const ROUTE_LOGIN = '/src/pages/loginRegistro/login.html';

const PLAN_RANK = { starter: 1, studio: 2, atelier: 3 };

// === AUTH HELPERS ============================================
function getToken() {
  return localStorage.getItem('token') || null;
}

function isLoggedIn() {
  return Boolean(getToken());
}

function authHeaders(extra = {}) {
  const token = getToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  };
}

// === UTILS ===================================================
function redirectToLogin() {
  window.location.href = ROUTE_LOGIN;
}

function labelFor(planCode) {
  const map = {
    starter: 'Pack Branding',
    studio: 'Pack Temporada',
    atelier: 'Pack Marca Completa',
  };
  return map[planCode] || planCode || 'plan';
}

function showFormError(errEl, msg) {
  if (!errEl) return;
  errEl.textContent = msg;
  errEl.hidden = false;
}

function clearFormError(errEl) {
  if (!errEl) return;
  errEl.textContent = '';
  errEl.hidden = true;
}

function setRequired(el, required) {
  if (!el) return;
  if (required) el.setAttribute('required', '');
  else el.removeAttribute('required');
}

function setHidden(el, hidden = true) {
  if (!el) return;
  el.hidden = hidden;
}

// === MODALES =================================================
window.openModal = function (id) {
  const overlay = document.getElementById(id);
  if (!overlay) return;

  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';

  const firstInput = overlay.querySelector('input, select, textarea');
  if (firstInput && !firstInput.disabled && !firstInput.hidden) {
    setTimeout(() => firstInput.focus(), 120);
  }
};

window.closeModal = function (overlay) {
  if (!overlay) return;

  overlay.classList.remove('open');

  overlay.querySelectorAll('[data-form-error]').forEach((el) => {
    el.hidden = true;
    el.textContent = '';
  });

  overlay.querySelectorAll('[type="submit"]').forEach((btn) => {
    if (btn.dataset.originalText) btn.textContent = btn.dataset.originalText;
    btn.disabled = false;
  });

  if (overlay.id === 'contact-modal') {
    resetOneshotModalState();
  }

  if (!document.querySelector('.modal-overlay.open')) {
    document.body.style.overflow = '';
  }
};

function initModalSystem() {
  document.querySelectorAll('.modal-overlay').forEach((overlay) => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        closeModal(overlay);
      }
    });
  });

  document.querySelectorAll('.modal').forEach((modal) => {
    modal.addEventListener('click', (e) => e.stopPropagation());
  });

  document.querySelectorAll('[data-close-modal]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const overlay = btn.closest('.modal-overlay');
      if (overlay) closeModal(overlay);
    });
  });
}

// === ESC =====================================================
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-overlay.open').forEach(closeModal);
  }
});

// === TOAST ===================================================
let toastTimeout;

function showToast(msg, kind = 'ok') {
  const toast = document.getElementById('toast');
  if (!toast) return;

  const msgEl = toast.querySelector('.toast__msg');
  const iconEl = toast.querySelector('.toast__icon');

  if (msgEl) msgEl.textContent = msg;
  if (iconEl) iconEl.textContent = kind === 'error' ? '!' : '✓';

  toast.classList.toggle('toast--error', kind === 'error');
  toast.classList.add('show');

  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => toast.classList.remove('show'), 4000);
}

// === BACKEND: PLANES =========================================
async function fetchUserPlan() {
  const res = await fetch(`${API_BASE}/user/plan`, {
    headers: authHeaders(),
  });

  if (res.status === 401) return { authError: true };
  if (res.status === 404) return { current: null };
  if (res.status === 204) return { current: null };

  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const data = await res.json();
      message = data?.error || message;
    } catch {}
    throw new Error(message);
  }

  try {
    const data = await res.json();
    return data && typeof data === 'object' ? data : { current: null };
  } catch {
    return { current: null };
  }
}

async function postPlanRequest(planCode, notes) {
  const res = await fetch(`${API_BASE}/user/plan/request`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ planCode, notes }),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const err = new Error(data.error || `HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }

  return data;
}

// === BACKEND: ONESHOTS =======================================
async function postServiceRequest(serviceCode, notes) {
  const res = await fetch(`${API_BASE}/user/services/request`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ serviceCode, notes }),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const err = new Error(data.error || `HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }

  return data;
}

// === ESTADO DE PLAN ==========================================
async function refreshPlanState() {
  if (!isLoggedIn()) {
    applyPackStates({ kind: 'guest' });
    renderBanner(null);
    return;
  }

  try {
    const data = await fetchUserPlan();

    if (data.authError) {
      applyPackStates({ kind: 'guest' });
      renderBanner(null);
      return;
    }

    const current = data?.current || null;

    if (!current) {
      applyPackStates({ kind: 'none' });
      renderBanner({ kind: 'none' });
      return;
    }

    if (current.status === 'pending') {
      applyPackStates({ kind: 'pending', currentCode: current.planCode });
      renderBanner({ kind: 'pending', planCode: current.planCode });
      return;
    }

    if (current.status === 'active') {
      applyPackStates({ kind: 'active', currentCode: current.planCode });
      renderBanner({ kind: 'active', planCode: current.planCode });
      return;
    }

    applyPackStates({ kind: 'none' });
    renderBanner({ kind: 'none' });
  } catch (err) {
    console.error('[servicios] refreshPlanState →', err.message);
    applyPackStates({ kind: 'none' });
    renderBanner({ kind: 'error' });
  }
}

function applyPackStates({ kind, currentCode = null }) {
  document.querySelectorAll('.pack-block').forEach((pack) => {
    const code = pack.dataset.planCode;
    const cta = pack.querySelector('.pack-cta');
    if (!code || !cta) return;

    setPackUI(pack, cta, computePackState(kind, code, currentCode));
  });
}

function computePackState(globalKind, packCode, currentCode) {
  if (globalKind === 'guest') return 'guest';
  if (globalKind === 'error') return 'available';
  if (globalKind === 'none') return 'available';

  if (globalKind === 'pending') {
    if (packCode === currentCode) return 'pending-self';
    return 'locked-pending';
  }

  if (globalKind === 'active') {
    if (packCode === currentCode) return 'current';
    return 'locked-active';
  }

  return 'available';
}

function setPackUI(pack, cta, state) {
  pack.classList.remove(
    'pack-block--current',
    'pack-block--pending',
    'pack-block--locked'
  );

  cta.disabled = false;
  cta.dataset.intent = '';

  switch (state) {
    case 'guest':
      cta.textContent = 'Inicia sesión para solicitar →';
      cta.dataset.intent = 'login';
      break;
    case 'available':
      cta.textContent = 'Solicitar servicio →';
      cta.dataset.intent = 'request';
      break;
    case 'current':
      cta.textContent = 'Tu plan actual';
      cta.disabled = true;
      pack.classList.add('pack-block--current');
      break;
    case 'locked-active':
      cta.textContent = 'Ya tienes un plan activo';
      cta.disabled = true;
      pack.classList.add('pack-block--locked');
      break;
    case 'pending-self':
      cta.textContent = 'Solicitud pendiente';
      cta.disabled = true;
      pack.classList.add('pack-block--pending');
      break;
    case 'locked-pending':
      cta.textContent = 'Plan pendiente — espera revisión';
      cta.disabled = true;
      pack.classList.add('pack-block--locked');
      break;
    default:
      cta.textContent = 'Solicitar servicio →';
      cta.dataset.intent = 'request';
  }
}

function renderBanner(state) {
  const banner = document.getElementById('plan-banner');
  if (!banner) return;

  const msgEl = banner.querySelector('.plan-banner__msg');

  banner.classList.remove(
    'plan-banner--none',
    'plan-banner--active',
    'plan-banner--pending',
    'plan-banner--error'
  );

  if (!state) {
    banner.hidden = true;
    return;
  }

  switch (state.kind) {
    case 'none':
      banner.classList.add('plan-banner--none');
      msgEl.textContent = 'Aún no tienes un plan asignado. Elige uno abajo.';
      break;
    case 'active':
      banner.classList.add('plan-banner--active');
      msgEl.textContent = `Plan actual: ${labelFor(state.planCode)} · activo`;
      break;
    case 'pending':
      banner.classList.add('plan-banner--pending');
      msgEl.textContent = `Solicitud pendiente: ${labelFor(state.planCode)} · en revisión`;
      break;
    case 'error':
      banner.classList.add('plan-banner--error');
      msgEl.textContent = 'No pudimos cargar el estado de tu plan, pero puedes solicitar uno igualmente.';
      break;
    default:
      banner.hidden = true;
      return;
  }

  banner.hidden = false;
}

// === ONESHOT / CUSTOM MODE ===================================
function resetOneshotModalState() {
  const overlay = document.getElementById('contact-modal');
  if (!overlay) return;

  const form = overlay.querySelector('#oneshot-form');
  const titleEl = overlay.querySelector('[data-modal-title]');
  const labelEl = overlay.querySelector('[data-modal-label]');
  const descEl = overlay.querySelector('[data-modal-desc]');
  const acceptText = overlay.querySelector('[data-accept-text]');

  const serviceGroup = overlay.querySelector('[data-field-group="service"]');
  const customGroup = overlay.querySelector('[data-field-group="projectType"]');
  const payRefGroup = overlay.querySelector('[data-field-group="paymentRef"]');
  const budgetGroup = overlay.querySelector('[data-field-group="budget"]');

  const serviceSelect = overlay.querySelector('#os-service');
  const customSelect = overlay.querySelector('#os-project-type');
  const payRefField = overlay.querySelector('#os-payref');
  const budgetField = overlay.querySelector('#os-budget');
  const notesField = overlay.querySelector('#os-notes');
  const lockNote = overlay.querySelector('#os-service-lock-note');

  if (form) {
    delete form.dataset.lockedServiceCode;
    delete form.dataset.lockedServiceLabel;
    delete form.dataset.requestMode;
    form.reset();
  }

  if (serviceSelect) {
    serviceSelect.disabled = false;
    serviceSelect.removeAttribute('aria-disabled');
    serviceSelect.value = '';
  }

  if (customSelect) {
    customSelect.value = '';
  }

  if (payRefField) payRefField.value = '';
  if (budgetField) budgetField.value = '';

  if (lockNote) {
    lockNote.hidden = true;
    lockNote.textContent = '';
  }

  setHidden(serviceGroup, false);
  setHidden(customGroup, true);
  setHidden(payRefGroup, false);
  setHidden(budgetGroup, true);

  setRequired(serviceSelect, true);
  setRequired(customSelect, false);
  setRequired(payRefField, false);
  setRequired(budgetField, false);

  if (notesField) {
    notesField.placeholder = 'Cuéntanos los detalles del encargo...';
  }

  if (titleEl) titleEl.textContent = 'Solicita tu servicio.';
  if (labelEl) labelEl.textContent = 'Servicio puntual';
  if (descEl) descEl.textContent = 'Rellena los detalles. Confirmamos disponibilidad en 24h.';
  if (acceptText) {
    acceptText.textContent = 'Acepto que esta solicitud puede generar un cargo según la tarifa del servicio seleccionado.';
  }
}

function ensureServiceOption(select, serviceCode, customLabel) {
  if (!select || !serviceCode) return;

  const exists = Array.from(select.options).some((o) => o.value === serviceCode);

  if (!exists) {
    const opt = document.createElement('option');
    opt.value = serviceCode;
    opt.textContent = customLabel || serviceCode;
    opt.dataset.dynamicOption = 'true';
    select.appendChild(opt);
  }

  select.value = serviceCode;
}

function openOneshotModal({ serviceCode, customLabel, lockService = false, mode = 'service' }) {
  const overlay = document.getElementById('contact-modal');
  if (!overlay) return;

  resetOneshotModalState();

  const form = overlay.querySelector('#oneshot-form');
  const lockNote = overlay.querySelector('#os-service-lock-note');
  const titleEl = overlay.querySelector('[data-modal-title]');
  const labelEl = overlay.querySelector('[data-modal-label]');
  const descEl = overlay.querySelector('[data-modal-desc]');
  const acceptText = overlay.querySelector('[data-accept-text]');

  const serviceGroup = overlay.querySelector('[data-field-group="service"]');
  const customGroup = overlay.querySelector('[data-field-group="projectType"]');
  const payRefGroup = overlay.querySelector('[data-field-group="paymentRef"]');
  const budgetGroup = overlay.querySelector('[data-field-group="budget"]');

  const serviceSelect = overlay.querySelector('#os-service');
  const customSelect = overlay.querySelector('#os-project-type');
  const notesField = overlay.querySelector('#os-notes');

  if (form) form.dataset.requestMode = mode;

  if (mode === 'custom') {
    if (form) {
      form.dataset.lockedServiceCode = 'creative-consult';
      form.dataset.lockedServiceLabel = customLabel || 'Proyecto a medida';
    }

    setHidden(serviceGroup, true);
    setHidden(customGroup, false);
    setHidden(payRefGroup, true);
    setHidden(budgetGroup, false);

    setRequired(serviceSelect, false);
    setRequired(customSelect, true);

    if (titleEl) titleEl.textContent = customLabel || 'Cuéntanos tu proyecto';
    if (labelEl) labelEl.textContent = 'Proyecto a medida';
    if (descEl) descEl.textContent = 'Descríbenos tu idea y te preparamos una propuesta personalizada.';
    if (acceptText) {
      acceptText.textContent = 'Acepto que esta solicitud se usará para preparar una propuesta y presupuesto orientativo, sin compromiso inmediato de contratación.';
    }
    if (notesField) {
      notesField.placeholder = 'Objetivo, entregables, campeonato, necesidades de marca, contenido o comunicación...';
    }
  } else {
    setHidden(serviceGroup, false);
    setHidden(customGroup, true);
    setHidden(payRefGroup, false);
    setHidden(budgetGroup, true);

    setRequired(serviceSelect, true);
    setRequired(customSelect, false);

    ensureServiceOption(serviceSelect, serviceCode, customLabel);

    if (titleEl) {
      titleEl.textContent = customLabel
        ? `Solicita: ${customLabel}`
        : 'Solicita tu servicio.';
    }

    if (labelEl) {
      labelEl.textContent = 'Servicio puntual';
    }

    if (descEl) {
      descEl.textContent = 'Rellena los detalles. Confirmamos disponibilidad en 24h.';
    }

    if (lockService && form && serviceSelect && serviceCode) {
      form.dataset.lockedServiceCode = serviceCode;
      form.dataset.lockedServiceLabel = customLabel || serviceCode;
      serviceSelect.disabled = true;
      serviceSelect.setAttribute('aria-disabled', 'true');

      if (lockNote) {
        lockNote.hidden = false;
        lockNote.textContent = `Servicio fijado: ${customLabel || serviceCode}`;
      }
    }
  }

  openModal('contact-modal');
}

// === DELEGACIÓN DE CLICKS ====================================
document.addEventListener('click', (e) => {
  const packBtn = e.target.closest('[data-pack-cta]');
  if (packBtn) {
    const intent = packBtn.dataset.intent;

    if (intent === 'login' || !isLoggedIn()) {
      e.preventDefault();
      redirectToLogin();
      return;
    }

    if (packBtn.disabled) return;

    const modalId = packBtn.dataset.modalTarget;
    if (modalId) openModal(modalId);
    return;
  }

  const oneshotBtn = e.target.closest('[data-service-cta]');
  if (!oneshotBtn) return;

  if (!isLoggedIn()) {
    e.preventDefault();
    redirectToLogin();
    return;
  }

  const serviceCode = oneshotBtn.dataset.serviceCta || '';
  const customLabel = oneshotBtn.dataset.serviceLabel || null;
  const mode =
    oneshotBtn.dataset.requestMode ||
    (oneshotBtn.closest('.service-card') ? 'service' : 'custom');
  const fromServiceCard = Boolean(oneshotBtn.closest('.service-card'));

  openOneshotModal({
    serviceCode,
    customLabel,
    lockService: mode === 'service' && fromServiceCard,
    mode,
  });
});

// === SUBMIT DE FORMULARIOS ===================================
document.addEventListener('submit', async (e) => {
  const form = e.target.closest('form[data-form-kind]');
  if (!form) return;

  e.preventDefault();

  const kind = form.dataset.formKind;
  const btn = form.querySelector('[type="submit"]');
  const errEl = form.querySelector('[data-form-error]');

  clearFormError(errEl);

  if (!form.reportValidity()) return;

  const accept = form.querySelector('input[name="acceptCharge"]');
  if (accept && !accept.checked) {
    showFormError(errEl, 'Debes aceptar las condiciones para continuar.');
    return;
  }

  if (!isLoggedIn()) {
    redirectToLogin();
    return;
  }

  const originalText = btn ? btn.textContent : null;
  if (btn) {
    if (!btn.dataset.originalText) btn.dataset.originalText = originalText;
    btn.disabled = true;
    btn.textContent = 'Enviando...';
  }

  try {
    if (kind === 'plan') {
      await submitPlanForm(form);
      form.reset();
      closeModal(form.closest('.modal-overlay'));
      showToast('Solicitud de plan enviada. Te avisaremos al aprobarla.');
      await refreshPlanState();
    } else if (kind === 'oneshot') {
      await submitOneshotForm(form);
      form.reset();
      closeModal(form.closest('.modal-overlay'));
      showToast('Solicitud enviada — te contactamos en 24h.');
    } else {
      showFormError(errEl, `Formulario no soportado: ${kind}`);
    }
  } catch (err) {
    console.error('[servicios] submit error →', err);

    if (err.status === 401) {
      redirectToLogin();
      return;
    }

    showFormError(errEl, err.message || 'No se pudo enviar la solicitud.');
    showToast(err.message || 'Error al enviar', 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = originalText;
    }
  }
});

async function submitPlanForm(form) {
  const planCode = form.dataset.planCode;
  if (!planCode) throw new Error('Falta data-plan-code en el formulario.');

  const notes = (form.querySelector('[name="notes"]')?.value || '').trim();
  await postPlanRequest(planCode, notes);
}

async function submitOneshotForm(form) {
  const requestMode = form.dataset.requestMode || 'service';
  const selectedServiceCode = form.querySelector('#os-service')?.value || '';
  const lockedServiceCode = form.dataset.lockedServiceCode || '';
  const serviceCode = lockedServiceCode || selectedServiceCode;

  const projectType = (form.querySelector('#os-project-type')?.value || '').trim();
  const dateFrom = form.querySelector('[name="dateFrom"]')?.value || '';
  const dateTo = form.querySelector('[name="dateTo"]')?.value || '';
  const obs = (form.querySelector('[name="notes"]')?.value || '').trim();
  const paymentRef = (form.querySelector('[name="paymentRef"]')?.value || '').trim();
  const budget = (form.querySelector('[name="budgetRange"]')?.value || '').trim();

  if (!dateFrom) throw new Error('Indica al menos una fecha.');
  if (!obs) throw new Error('Añade información para la solicitud.');

  const notesLines = [];

  if (requestMode === 'custom') {
    if (!projectType) throw new Error('Selecciona un tipo de proyecto a medida.');

    notesLines.push('Modo: proyecto a medida');
    notesLines.push(`Tipo de proyecto: ${projectType}`);
    notesLines.push(`Fecha orientativa: ${dateFrom}${dateTo ? ` → ${dateTo}` : ''}`);
    if (budget) notesLines.push(`Presupuesto orientativo: ${budget}`);
    notesLines.push(`Briefing: ${obs}`);
    notesLines.push('Condición aceptada: solicitud de propuesta / presupuesto');

    await postServiceRequest('creative-consult', notesLines.join('\n'));
    return;
  }

  if (!serviceCode) throw new Error('Selecciona un servicio puntual.');

  notesLines.push(`Fecha: ${dateFrom}${dateTo ? ` → ${dateTo}` : ''}`);
  notesLines.push(`Observaciones: ${obs}`);
  if (paymentRef) notesLines.push(`Ref. pago: ${paymentRef}`);
  notesLines.push('Acepta cargo: sí');

  await postServiceRequest(serviceCode, notesLines.join('\n'));
}

// === REVEAL ==================================================
const revealObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        revealObserver.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.1, rootMargin: '0px 0px -60px 0px' }
);

document.querySelectorAll('.reveal').forEach((el, i) => {
  el.style.transitionDelay = `${(i % 4) * 0.08}s`;
  revealObserver.observe(el);
});

// === SMOOTH ANCHOR SCROLL ====================================
document.querySelectorAll('a[href^="#"]').forEach((link) => {
  link.addEventListener('click', (e) => {
    const id = link.getAttribute('href').slice(1);
    const target = document.getElementById(id);
    if (!target) return;

    e.preventDefault();
    const nav = document.querySelector('nav, .nav-bar, header');
    const offset = (nav?.offsetHeight || 0) + 20;
    const top = target.getBoundingClientRect().top + window.scrollY - offset;

    window.scrollTo({ top, behavior: 'smooth' });
  });
});

// === HERO TITLE STAGGER ======================================
const heroLines = document.querySelectorAll('.hero__title-line');

heroLines.forEach((line, i) => {
  line.style.opacity = '0';
  line.style.transform = 'translateY(30px)';
  line.style.transition = `opacity 0.7s ease ${0.15 + i * 0.1}s, transform 0.7s ease ${0.15 + i * 0.1}s`;
});

window.addEventListener('load', () => {
  heroLines.forEach((line) => {
    line.style.opacity = '1';
    line.style.transform = 'translateY(0)';
  });

  document.querySelectorAll('.hero .reveal').forEach((el, i) => {
    setTimeout(() => el.classList.add('visible'), 600 + i * 100);
  });
});

// === PACK VISUAL HOVER PARALLAX ==============================
document.querySelectorAll('.pack-block').forEach((block) => {
  const visual = block.querySelector('.pack-block__visual');
  if (!visual) return;

  block.addEventListener('mousemove', (e) => {
    const rect = block.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    visual.style.transform = `translate(${x * 8}px, ${y * 8}px)`;
  });

  block.addEventListener('mouseleave', () => {
    visual.style.transform = '';
    visual.style.transition = 'transform 0.5s ease';
  });

  block.addEventListener('mouseenter', () => {
    visual.style.transition = 'transform 0.1s linear';
  });
});

// === SERVICE CARD MAGNETIC BUTTON ============================
document.querySelectorAll('.service-card__btn').forEach((btn) => {
  btn.addEventListener('mousemove', (e) => {
    const rect = btn.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;
    btn.style.transform = `translate(${x * 0.18}px, ${y * 0.18}px)`;
  });

  btn.addEventListener('mouseleave', () => {
    btn.style.transform = '';
  });
});

// === TELEMETRY DATA TICKER ===================================
const labels = [
  'Season 2024 · Active',
  '7 Campeonatos · Cubiertos',
  '120+ Eventos · Entregados',
  'Próxima cita · Disponible',
];

const labelText = document.querySelector('.hero__label span:last-child');

if (labelText) {
  let li = 0;
  setInterval(() => {
    li = (li + 1) % labels.length;
    labelText.style.opacity = '0';
    labelText.style.transform = 'translateY(-6px)';

    setTimeout(() => {
      labelText.textContent = labels[li];
      labelText.style.opacity = '1';
      labelText.style.transform = 'translateY(0)';
    }, 300);
  }, 3500);

  labelText.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
}

// === BOOT ====================================================
document.addEventListener('DOMContentLoaded', () => {
  initModalSystem();
  resetOneshotModalState();
  refreshPlanState();
});