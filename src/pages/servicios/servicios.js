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

  // Salir del paso de pago: limpia el bloque inyectado y reaparecen los
  // campos del paso 1 en cualquier formulario abierto.
  overlay.querySelectorAll('form[data-form-kind]').forEach((form) => {
    if (form.dataset.currentStep === 'payment') resetFormStepState(form);
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

// === CARD PAYMENT STEP =======================================
// Inyección programática del paso de pago en cada formulario de
// request (oneshot + planes). NO modifica el HTML existente: oculta
// los campos del paso 1 y añade un bloque de tarjeta. Visualmente
// alineado con Collector's Club (mismo léxico, mismas inputs).

function buildPaymentBlock() {
  const wrap = document.createElement('div');
  wrap.setAttribute('data-payment-block', 'true');
  wrap.innerHTML = `
    <div class="pay-step__head">
      <span class="pay-step__eyebrow">Paso 2 de 2 · Pago</span>
      <h4 class="pay-step__title">Datos de tarjeta</h4>
      <p class="pay-step__sub">
        Pasarela <strong>simulada</strong>. Validamos formato (Luhn + caducidad + CVC) y guardamos
        únicamente marca y últimos 4 dígitos. Tu PAN y CVC nunca se almacenan.
        El cargo real sólo se confirma tras la revisión del estudio.
      </p>
    </div>
    <div class="form-group">
      <label class="form-label">Nombre del titular</label>
      <input class="form-input" type="text" data-pay-field="holder"
             placeholder="Como aparece en la tarjeta" maxlength="60" autocomplete="cc-name">
    </div>
    <div class="form-group">
      <label class="form-label">Número de tarjeta</label>
      <input class="form-input" type="text" data-pay-field="number"
             placeholder="1234 5678 9012 3456" maxlength="19" inputmode="numeric" autocomplete="off">
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Caducidad</label>
        <input class="form-input" type="text" data-pay-field="expiry"
               placeholder="MM/AA" maxlength="5" inputmode="numeric" autocomplete="off">
      </div>
      <div class="form-group">
        <label class="form-label">CVC</label>
        <input class="form-input" type="password" data-pay-field="cvc"
               placeholder="•••" maxlength="4" inputmode="numeric" autocomplete="off">
      </div>
    </div>
    <button type="button" class="pay-step__back" data-pay-back>← Volver a detalles</button>
  `;

  // Formateo en vivo: agrupar número 4-4-4-4 y caducidad MM/AA.
  const numEl = wrap.querySelector('[data-pay-field="number"]');
  if (numEl) {
    numEl.addEventListener('input', () => {
      const d = numEl.value.replace(/\D+/g, '').slice(0, 19);
      numEl.value = d.match(/.{1,4}/g)?.join(' ') || '';
    });
  }
  const expEl = wrap.querySelector('[data-pay-field="expiry"]');
  if (expEl) {
    expEl.addEventListener('input', () => {
      const d = expEl.value.replace(/\D+/g, '').slice(0, 4);
      expEl.value = d.length >= 3 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
    });
  }

  return wrap;
}

function transitionToPaymentStep(form) {
  console.log('[servicios] → transitionToPaymentStep', { kind: form.dataset.formKind });

  // Idempotente: si ya estamos en payment, no duplicar el bloque.
  if (form.dataset.currentStep === 'payment') {
    console.warn('[servicios] transitionToPaymentStep: ya estaba en payment');
    return;
  }

  // 1. Ocultar (no remover) los campos del paso 1 — preserva valores.
  //    Usamos atributo + clase para resistir cualquier override de CSS.
  const directChildren = Array.from(form.children);
  let hidden = 0;
  directChildren.forEach((el) => {
    if (el.matches('.form-group, .form-row, .form-check')) {
      el.setAttribute('hidden', '');
      el.setAttribute('data-hidden-during-pay', '1');
      el.classList.add('is-step-hidden');
      hidden++;
    }
  });
  console.log('[servicios] paso 1: campos ocultos =', hidden);

  // 2. Inyectar el bloque de pago antes del error/submit.
  const errEl = form.querySelector('[data-form-error]');
  const block = buildPaymentBlock();
  if (errEl) form.insertBefore(block, errEl);
  else form.appendChild(block);

  // 3. Estado + botón.
  form.dataset.currentStep = 'payment';
  form.classList.add('is-paying');
  const btn = form.querySelector('[type="submit"]');
  if (btn) {
    if (!btn.dataset.detailsLabel) btn.dataset.detailsLabel = btn.textContent;
    btn.textContent = 'Pagar y solicitar →';
  }

  // 4. Wire "back" button.
  block.querySelector('[data-pay-back]')?.addEventListener('click', () => {
    transitionBackToDetails(form);
  });

  // 5. Focus.
  setTimeout(() => block.querySelector('[data-pay-field="holder"]')?.focus(), 80);

  // 6. Scroll del modal al inicio del bloque para que se vea sin duda.
  const modalEl = form.closest('.modal');
  if (modalEl) {
    setTimeout(() => {
      const rect = block.getBoundingClientRect();
      const modalRect = modalEl.getBoundingClientRect();
      modalEl.scrollTop += (rect.top - modalRect.top) - 24;
    }, 60);
  }

  console.log('[servicios] paso 2 inyectado:', Boolean(form.querySelector('[data-payment-block]')));
}

function transitionBackToDetails(form) {
  console.log('[servicios] ← transitionBackToDetails');

  form.querySelectorAll('[data-payment-block]').forEach((el) => el.remove());

  form.querySelectorAll('[data-hidden-during-pay]').forEach((el) => {
    el.removeAttribute('hidden');
    el.removeAttribute('data-hidden-during-pay');
    el.classList.remove('is-step-hidden');
  });

  form.dataset.currentStep = 'details';
  form.classList.remove('is-paying');

  const btn = form.querySelector('[type="submit"]');
  if (btn && btn.dataset.detailsLabel) btn.textContent = btn.dataset.detailsLabel;
}

function collectCardFromForm(form) {
  const block = form.querySelector('[data-payment-block]');
  if (!block) return null;
  const holderRaw = block.querySelector('[data-pay-field="holder"]')?.value || '';
  const numberRaw = block.querySelector('[data-pay-field="number"]')?.value || '';
  const expiryRaw = block.querySelector('[data-pay-field="expiry"]')?.value || '';
  const cvcRaw    = block.querySelector('[data-pay-field="cvc"]')?.value || '';

  const number = numberRaw.replace(/\s+/g, '');
  const [mm, yy] = expiryRaw.split('/').map((s) => (s || '').trim());

  return {
    holder:   holderRaw.trim(),
    number,
    expMonth: parseInt(mm, 10) || null,
    expYear:  parseInt(yy, 10) || null,
    cvc:      cvcRaw,
  };
}

/** Validación cliente mínima — el backend revalida con PaymentPolicy. */
function validateCardShape(card) {
  if (!card) return 'Datos de tarjeta requeridos.';
  if (!card.holder || card.holder.length < 2) return 'Indica el nombre del titular.';
  if (!/^\d{13,19}$/.test(card.number)) return 'Número de tarjeta inválido.';
  if (!card.expMonth || card.expMonth < 1 || card.expMonth > 12) return 'Caducidad inválida.';
  if (!card.expYear) return 'Caducidad inválida.';
  if (!/^\d{3,4}$/.test(String(card.cvc))) return 'CVC inválido.';
  return null;
}

function resetFormStepState(form) {
  if (!form) return;
  transitionBackToDetails(form);
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

async function postPlanRequest(planCode, notes, card) {
  const res = await fetch(`${API_BASE}/user/plan/request`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ planCode, notes, card }),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const err = new Error(data.error || `HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }

  // El backend real debe devolver { request: { id, status, planCode, ... } }.
  // Si llega el shape legacy del stub ({ ok:true, body, version }) la solicitud
  // NO se ha persistido — tratarlo como error para no engañar al usuario.
  if (!data || !data.request || !data.request.id) {
    const err = new Error('La solicitud no se registró correctamente. Inténtalo de nuevo.');
    err.status = 502;
    throw err;
  }

  return data;
}

// === BACKEND: ONESHOTS =======================================
async function postServiceRequest(serviceCode, notes, card) {
  const res = await fetch(`${API_BASE}/user/services/request`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ serviceCode, notes, card }),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const err = new Error(data.error || `HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }

  if (!data || !data.request || !data.request.id) {
    const err = new Error('La solicitud no se registró correctamente. Inténtalo de nuevo.');
    err.status = 502;
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
// Flujo de dos pasos:
//   Paso 1 (details): el botón "Continuar al pago" valida detalles y
//                     transiciona al paso 2.
//   Paso 2 (payment): valida los datos de tarjeta cliente-side y envía
//                     todo al backend (request + card en un solo POST).
document.addEventListener('submit', async (e) => {
  const form = e.target.closest('form[data-form-kind]');
  if (!form) return;

  e.preventDefault();
  e.stopPropagation();

  const kind  = form.dataset.formKind;
  const step  = form.dataset.currentStep || 'details';
  const btn   = form.querySelector('[type="submit"]');
  const errEl = form.querySelector('[data-form-error]');

  console.log('[servicios] submit captured', { kind, step });
  clearFormError(errEl);

  if (!isLoggedIn()) {
    redirectToLogin();
    return;
  }

  // ─── PASO 1: DETAILS ─────────────────────────────────────────
  if (step !== 'payment') {
    if (!form.reportValidity()) return;

    const accept = form.querySelector('input[name="acceptCharge"]');
    if (accept && !accept.checked) {
      showFormError(errEl, 'Debes aceptar las condiciones para continuar.');
      return;
    }

    // Para oneshot: validar también la coherencia de modo antes de pagar.
    if (kind === 'oneshot') {
      const requestMode = form.dataset.requestMode || 'service';
      const lockedServiceCode    = form.dataset.lockedServiceCode || '';
      const selectedServiceCode  = form.querySelector('#os-service')?.value || '';
      const projectType          = (form.querySelector('#os-project-type')?.value || '').trim();
      if (requestMode === 'custom' && !projectType) {
        showFormError(errEl, 'Selecciona un tipo de proyecto a medida.');
        return;
      }
      if (requestMode !== 'custom' && !lockedServiceCode && !selectedServiceCode) {
        showFormError(errEl, 'Selecciona un servicio puntual.');
        return;
      }
    }

    transitionToPaymentStep(form);
    return;
  }

  // ─── PASO 2: PAYMENT ────────────────────────────────────────
  const card = collectCardFromForm(form);
  const cardErr = validateCardShape(card);
  if (cardErr) {
    showFormError(errEl, cardErr);
    return;
  }

  const originalText = btn ? btn.textContent : null;
  if (btn) {
    if (!btn.dataset.originalText) btn.dataset.originalText = originalText;
    btn.disabled = true;
    btn.textContent = 'Procesando pago…';
  }

  try {
    if (kind === 'plan') {
      await submitPlanForm(form, card);
      resetFormStepState(form);
      form.reset();
      closeModal(form.closest('.modal-overlay'));
      showToast('Solicitud de plan enviada. Te avisaremos al aprobarla.');
      await refreshPlanState();
    } else if (kind === 'oneshot') {
      await submitOneshotForm(form, card);
      resetFormStepState(form);
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

    // Errores de tarjeta del backend → mantener al usuario en el paso de pago
    // para que pueda corregir, sin perder los detalles ya rellenados.
    const isCardError = err.status === 400 && (Array.isArray(err.fields) ? err.fields.length : true);
    if (!isCardError) {
      // Errores no relacionados con la tarjeta (404 plan no encontrado,
      // 409 plan ya pendiente, etc.) → volver al paso 1 para que el usuario
      // pueda revisar/cambiar contexto.
      resetFormStepState(form);
    }

    showFormError(errEl, err.message || 'No se pudo enviar la solicitud.');
    showToast(err.message || 'Error al enviar', 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = btn.dataset.originalText || originalText;
    }
  }
});

async function submitPlanForm(form, card) {
  const planCode = form.dataset.planCode;
  if (!planCode) throw new Error('Falta data-plan-code en el formulario.');

  const notes = (form.querySelector('[name="notes"]')?.value || '').trim();
  await postPlanRequest(planCode, notes, card);
}

async function submitOneshotForm(form, card) {
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

    await postServiceRequest('creative-consult', notesLines.join('\n'), card);
    return;
  }

  if (!serviceCode) throw new Error('Selecciona un servicio puntual.');

  notesLines.push(`Fecha: ${dateFrom}${dateTo ? ` → ${dateTo}` : ''}`);
  notesLines.push(`Observaciones: ${obs}`);
  if (paymentRef) notesLines.push(`Ref. pago: ${paymentRef}`);
  notesLines.push('Acepta cargo: sí');

  await postServiceRequest(serviceCode, notesLines.join('\n'), card);
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
  'Season 2026 · Active',
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

  // Self-test: confirma en consola que el wiring de pago está activo.
  // Si NO ves esta línea al cargar /servicios, tu navegador está sirviendo
  // una versión cacheada del JS — fuerza un hard-refresh (Ctrl+Shift+R).
  console.log('[servicios] payment-step v2 wired ✓',
    'forms=' + document.querySelectorAll('form[data-form-kind]').length);
});