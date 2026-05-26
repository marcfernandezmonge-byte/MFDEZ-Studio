/**
 * ═══════════════════════════════════════════════════════════
 * DASHBOARD — dashboard.js  v2
 * ─────────────────────────────────────────────────────────
 * Módulos:
 *   1. SESIÓN      — verificación de token
 *   2. USUARIO     — carga, renderizado y rol
 *   3. LOGOUT      — limpieza + fade-out + redirección
 *   4. SERVICIOS   — carga y render de servicios contratados
 *   5. MEMBRESÍA   — estado del Collector's Club del usuario
 *   6. ADMIN       — secciones y datos solo para rol admin
 *   7. NAVEGACIÓN  — sidebar + secciones + card-link-btn
 *   8. PARTÍCULAS  — canvas fondo (idéntico al login)
 *   9. ENTRADA     — animación is-ready
 * ═══════════════════════════════════════════════════════════
 */

'use strict';

/* ── RUTAS ── */
const ROUTE_LOGIN = '/src/pages/loginRegistro/login.html';
// Soporta tanto localhost como 127.0.0.1 (Live Server puede usar cualquiera)
const API_BASE = 'http://localhost:3000/api';


/* ══════════════════════════════════════════════════════
   1. VERIFICACIÓN DE SESIÓN
   Protección del dashboard — sin token → login inmediato.
══════════════════════════════════════════════════════ */
(function checkSession() {
  const token = localStorage.getItem('token');
  if (!token) {
    window.location.replace(ROUTE_LOGIN);
    throw new Error('No autenticado — redirigiendo al login.');
  }
})();


/* ══════════════════════════════════════════════════════
   2. USUARIO — carga, render y detección de rol
══════════════════════════════════════════════════════ */
let currentUser = { id: '', name: 'Usuario', email: '', role: 'client', isSubscribed: false };
const adminOverviewState = {
  users: [],
  members: [],
  inboxUsers: [],
  userMessages: [],
  selectedUserId: null,
  selectedMessageId: null,
};

/**
 * Carga la identidad autenticada desde el backend (/api/me).
 * Esta es la ÚNICA fuente de verdad para `role` en el frontend.
 *
 * Seguridad: si la llamada falla por red, se usa el cache local SOLO para
 * mostrar nombre/email — el rol NUNCA se restaura desde localStorage,
 * siempre cae a 'client'. Así no es posible escalar a admin editando
 * localStorage.
 */
async function loadUser() {
  const token = localStorage.getItem('token');

  // Pre-render con cache local (solo identidad visual, NUNCA rol elevado).
  try {
    const raw = localStorage.getItem('user');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        currentUser = {
          id:           parsed.id    || '',
          name:         parsed.name  || 'Usuario',
          email:        parsed.email || '',
          role:         'client',       // ← nunca admin desde cache
          isSubscribed: false,
        };
      }
    }
  } catch { /* JSON malformado — fallback silencioso */ }

  // Fuente autoritativa: /api/me.
  try {
    const res = await fetch(`${API_BASE}/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.status === 401) {
      // Token inválido o expirado → forzar login.
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.replace(ROUTE_LOGIN);
      return;
    }

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json();
    const u    = data && data.user ? data.user : {};

    currentUser = {
      id:           u.id    || '',
      name:         u.name  || 'Usuario',
      email:        u.email || '',
      role:         u.role === 'admin' ? 'admin' : 'client',
      isSubscribed: Boolean(u.isSubscribed),
    };

    // Refrescar cache local (sin rol — se ignora al recargar).
    try {
      localStorage.setItem('user', JSON.stringify({
        id: currentUser.id, name: currentUser.name, email: currentUser.email,
      }));
    } catch { /* quota / privacy — no es bloqueante */ }

  } catch (err) {
    console.warn('[dashboard] loadUser → /api/me falló, modo degradado client:', err.message);
    // Mantener currentUser tal como quedó del pre-render (rol forzado a 'client').
  }

  renderUser();
  applyRoleVisibility();
}

function renderUser() {
  const { name, email, role } = currentUser;

  const initial  = name.trim().charAt(0).toUpperCase() || '?';
  const hour     = new Date().getHours();
  const greeting = hour < 6 ? 'Buenas noches' : hour < 13 ? 'Buenos días' : hour < 20 ? 'Buenas tardes' : 'Buenas noches';
  const now      = new Date();
  const timeStr  = now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

  setText('userAvatarInitial', initial);
  setText('headerUserName',   name);
  setText('welcomeGreeting',  greeting);
  setText('welcomeUser',      name);
  setText('loginTime',        timeStr);
  setText('cardEmail',        email || '—');

  /* Rol en header */
  const roleEl = document.getElementById('headerUserRole');
  if (roleEl) {
    roleEl.textContent  = role === 'admin' ? 'Admin' : 'Miembro';
    roleEl.className    = role === 'admin' ? 'user-role user-role--admin' : 'user-role';
  }
}

function applyRoleVisibility() {
  /* Admin nav section — visible solo si role=admin */
  const adminNav = document.getElementById('adminNavSection');
  const adminOverviewShell = document.getElementById('adminOverviewShell');
  const adminUsersPanel = document.getElementById('adminOverviewUsersPanel');
  const adminSidePanel = document.getElementById('adminOverviewSidePanel');
  const isAdmin = currentUser.role === 'admin';

  if (adminNav) {
    isAdmin ? adminNav.removeAttribute('hidden') : adminNav.setAttribute('hidden', '');
  }

  /* Ocultar / mostrar nav items y secciones por rol vía data-role-hide */
  document.querySelectorAll('[data-role-hide]').forEach((el) => {
    const hideFor = el.getAttribute('data-role-hide');
    if (hideFor === currentUser.role) {
      el.setAttribute('hidden', '');
    } else {
      el.removeAttribute('hidden');
    }
  });

  if (adminOverviewShell) {
    /* Admin → grid 3fr/2fr (panel principal + detalle).
       Cliente → layout integrado: lista + hilo apilados, sin grid agresivo. */
    adminOverviewShell.classList.toggle('is-admin-layout', isAdmin);
    adminOverviewShell.classList.toggle('is-client-layout', !isAdmin);
    adminOverviewShell.style.cssText = '';
  }

  /* Admin: panel de usuarios + panel de detalle separado.
     Cliente: SOLO panel de mensajes con expansión inline.
     El panel de detalle inferior se elimina por completo para cliente —
     evita duplicación de jerarquía y feel de "ticket SaaS". */
  if (adminUsersPanel) adminUsersPanel.removeAttribute('hidden');
  if (adminSidePanel) {
    isAdmin ? adminSidePanel.removeAttribute('hidden') : adminSidePanel.setAttribute('hidden', '');
  }

  renderOverviewTableHead();
}

function renderOverviewTableHead() {
  const headRow = document.getElementById('adminOverviewUsersHeadRow');
  if (!headRow) return;

  if (currentUser.role === 'admin') {
    headRow.innerHTML = `
      <th>Users</th>
      <th>User Email</th>
      <th>Role</th>
      <th>Message State</th>`;
    return;
  }

  headRow.innerHTML = `
    <th>Mensaje</th>
    <th>Fecha</th>
    <th>Estado</th>`;
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

/* ══════════════════════════════════════════════════════
   3. LOGOUT
══════════════════════════════════════════════════════ */
document.getElementById('logoutBtn')?.addEventListener('click', performLogout);

function performLogout() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');

  const root = document.getElementById('dashRoot');
  if (root) {
    root.style.transition = 'opacity 320ms ease, transform 320ms var(--ease-smooth, cubic-bezier(.4,0,.2,1))';
    root.style.opacity    = '0';
    root.style.transform  = 'scale(0.98) translateY(5px)';
  }
  setTimeout(() => { window.location.href = ROUTE_LOGIN; }, 340);
}


/* ══════════════════════════════════════════════════════
   4. SERVICIOS CONTRATADOS
   ──────────────────────────────────────────────────────
   Intenta cargar desde el backend:
     GET /api/user/services  (Authorization: Bearer <token>)
   Si el backend no responde o no hay servicios reales,
   cae al mock de demo para desarrollo.
══════════════════════════════════════════════════════ */

/* ── Estado operacional del usuario — única fuente de verdad ─────────
   Devuelve true si el dashboard debe renderizar como "con actividad".
   Tiene en cuenta:
     • rol admin            → siempre operacional
     • entitlements         → cualquier estado distinto de cancelled
     • services (legacy + oneshot requests pending/approved/active/...)
   Llamado por renderServicesList Y renderEntitlements para
   garantizar coherencia entre ambas secciones. */
function hasOperationalServiceState(services, entitlements) {
  if (currentUser && currentUser.role === 'admin') return true;

  const hasServices = Array.isArray(services)
    && services.some((s) => s && s.status !== 'rejected' && s.status !== 'cancelled');

  const hasEntitlements = Array.isArray(entitlements)
    && entitlements.some((e) => e && e.status !== 'cancelled');

  return hasServices || hasEntitlements;
}

async function loadServices() {
  let services = [];
  let entitlements = [];
  const token = localStorage.getItem('token');

  try {
    const res = await fetch(`${API_BASE}/user/services`, {
      headers: {  Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const data = await res.json();
      services = Array.isArray(data.services) ? data.services : [];
      entitlements = Array.isArray(data.entitlements) ? data.entitlements : [];
    } else {
      services = getMockServices();
    }
  } catch {
    services = getMockServices();
  }

  renderServicesOverview(services);
  renderServicesList(services, entitlements);
  renderEntitlements(entitlements, services);
}

/* ── Datos de demo (se eliminarán cuando el backend esté listo) ── */
function getMockServices() {
  return [
    {
      id: 'svc-001',
      name: 'Pack Temporada',
      type: 'Paquete',
      status: 'active',
      price: '€8.500',
      startDate: '2025-01-15',
      endDate: '2025-12-15',
      events: { covered: 5, total: 8 },
    },
    {
      id: 'svc-002',
      name: 'Pack Branding',
      type: 'Paquete',
      status: 'completed',
      price: '€1.800',
      startDate: '2024-10-01',
      endDate: '2024-11-15',
    },
    {
      id: 'svc-003',
      name: 'Shoot Especial — Media Day',
      type: 'Servicio puntual',
      status: 'progress',
      price: '€450',
      startDate: '2025-03-18',
    },
  ];
}

/* ══════════════════════════════════════════════════════
   CANONICAL FRONTEND PRICE MAP  (presentación únicamente)
   ──────────────────────────────────────────────────────
   El dashboard se comporta como una capa de PRESENTACIÓN — los precios
   mostrados aquí se alinean SIEMPRE con la página /servicios, sin importar
   qué valor histórico guarde el snapshot en MongoDB.

   Reglas:
     · NUNCA modifica la API, los snapshots ni el monto persistido en
       `payments` — sólo lo que se ve en pantalla.
     · Cuando se introduce un plan o servicio nuevo en /servicios, AÑADIR
       su entrada aquí. Este mapa es el equivalente UI de los seeds del
       backend.

   Lookup:
     1. `resolveCanonicalPrice(code, fallback)` — uso recomendado cuando el
        código está disponible (tablas admin: r.planCode, r.serviceCode).
     2. Si sólo se dispone del nombre (p. ej. "Mis Servicios" no recibe
        `code` en el payload), `resolveCanonicalPrice(nombre, fallback)`
        intenta primero el código y luego un alias por nombre, cubriendo
        snapshots históricos ("Starter", "Sesión Fotográfica", etc.).
══════════════════════════════════════════════════════ */

const CANONICAL_SERVICE_PRICES = {
  starter:            '€1.800',
  studio:             '€8.500 / temporada',
  atelier:            '€15.000 / año',

  'photo-session':    'Desde €650',
  'logo-design':      'Desde €80',
  'special-shoot':    'Desde €350',
  'web-landing':      'Desde €800',
  'creative-consult': 'Presupuesto personalizado',
};

// Alias por nombre — incluye tanto los nombres canónicos actuales como los
// nombres HISTÓRICOS que pudieron quedar en snapshots antes de corregir el
// catálogo. Permite que requests viejas también muestren el precio actual.
const CANONICAL_NAME_TO_CODE = {
  // Plans — históricos + canónicos
  'Starter':               'starter',
  'Pack Branding':         'starter',
  'PACK BRANDING':         'starter',
  'Studio':                'studio',
  'Pack Temporada':        'studio',
  'PACK TEMPORADA':        'studio',
  'Atelier':               'atelier',
  'Pack Marca Completa':   'atelier',
  'PACK MARCA COMPLETA':   'atelier',

  // Services — históricos + canónicos
  'Sesión Fotográfica':    'photo-session',
  'Fin de Semana Carrera': 'photo-session',
  'Diseño de Logo':        'logo-design',
  'Diseño Rápido':         'logo-design',
  'Shoots Especiales':     'special-shoot',
  'Landing Page':          'web-landing',
  'Digital / Web':         'web-landing',
  'Digital':               'web-landing',
  'Consultoría Creativa':  'creative-consult',
  'Proyecto a medida':     'creative-consult',
};

/**
 * Devuelve el precio canónico para `codeOrName`.
 * Acepta indistintamente el `code` (recomendado) o el `name` del snapshot.
 * Si nada coincide, devuelve `fallback` (string formateado del snapshot).
 */
function resolveCanonicalPrice(codeOrName, fallback) {
  if (codeOrName == null) return fallback || '';
  const key = String(codeOrName).trim();
  if (!key) return fallback || '';

  // 1) Lookup directo por código.
  if (CANONICAL_SERVICE_PRICES[key]) return CANONICAL_SERVICE_PRICES[key];

  // 2) Lookup por nombre → código → precio (cubre snapshots históricos).
  const aliasCode = CANONICAL_NAME_TO_CODE[key];
  if (aliasCode && CANONICAL_SERVICE_PRICES[aliasCode]) {
    return CANONICAL_SERVICE_PRICES[aliasCode];
  }

  return fallback || '';
}

/* ══════════════════════════════════════════════════════
   CANONICAL FRONTEND NAME MAP  (presentación únicamente)
   ──────────────────────────────────────────────────────
   Equivalente "name" del mapa de precios. Garantiza que la etiqueta
   mostrada en el dashboard coincida SIEMPRE con la página /servicios,
   incluso para snapshots históricos que persistieron nombres antiguos
   (p. ej. "Starter", "Sesión Fotográfica", "Diseño de Logo").
   No toca BD, snapshots ni API — sólo el string visible.
══════════════════════════════════════════════════════ */

const CANONICAL_SERVICE_NAMES = {
  starter:            'Pack Branding',
  studio:             'Pack Temporada',
  atelier:            'Pack Marca Completa',

  'photo-session':    'Fin de Semana Carrera',
  'logo-design':      'Diseño Rápido',
  'special-shoot':    'Shoots Especiales',
  'web-landing':      'Digital / Web',
  'creative-consult': 'Proyecto a medida',
};

/**
 * Devuelve el nombre canónico para `codeOrName`.
 * Estrategia idéntica al resolver de precios:
 *   1. Si recibimos un código conocido, devolvemos su nombre canónico.
 *   2. Si recibimos un nombre, lo mapeamos a su código vía
 *      CANONICAL_NAME_TO_CODE y devolvemos el nombre canónico de ese código.
 *   3. Fallback: snapshot original (no rompe nada si aparece algo nuevo).
 */
function resolveCanonicalName(codeOrName, fallback) {
  if (codeOrName == null) return fallback || '';
  const key = String(codeOrName).trim();
  if (!key) return fallback || '';

  // 1) Lookup directo por código.
  if (CANONICAL_SERVICE_NAMES[key]) return CANONICAL_SERVICE_NAMES[key];

  // 2) Lookup por nombre → código → nombre canónico.
  const aliasCode = CANONICAL_NAME_TO_CODE[key];
  if (aliasCode && CANONICAL_SERVICE_NAMES[aliasCode]) {
    return CANONICAL_SERVICE_NAMES[aliasCode];
  }

  return fallback || '';
}

/* ── Render: tarjetas de resumen en el overview ── */
function renderServicesOverview(services) {
  const active    = services.filter(s => s.status === 'active').length;
  const inProgress= services.filter(s => s.status === 'progress').length;
  const total     = services.length;

  setText('servicesActiveCount',  String(active));
  setText('servicesPendingCount', String(inProgress));
  setText('servicesTotalCount',   String(total));

  /* Contador del nav sidebar */
  const navCount = document.getElementById('navServicesCount');
  if (navCount) navCount.textContent = String(total);
}

/* ── Render: lista completa de servicios ──
   Empty state solo si NO hay servicios contratados, NI entitlements,
   NI solicitudes (las requests ya vienen embebidas en `services` como
   oneshots desde /api/user/services con cualquier estado). */
function renderServicesList(services, entitlements) {
  const emptyEl = document.getElementById('servicesEmpty');
  const listEl  = document.getElementById('servicesList');
  if (!emptyEl || !listEl) return;

  const list = Array.isArray(services) ? services : [];
  const isOperational = hasOperationalServiceState(services, entitlements);

  if (!isOperational) {
    emptyEl.removeAttribute('hidden');
    listEl.setAttribute('hidden', '');
    listEl.innerHTML = '';
    return;
  }

  emptyEl.setAttribute('hidden', '');
  listEl.removeAttribute('hidden');
  listEl.innerHTML = list.map(buildServiceItemHTML).join('');
}

function buildServiceItemHTML(svc) {
  const statusMap = {
    active:    { label: 'Activo',     cls: 'service-status--active'    },
    progress:  { label: 'En curso',   cls: 'service-status--progress'  },
    pending:   { label: 'Pendiente',  cls: 'service-status--progress'  },
    completed: { label: 'Completado', cls: 'service-status--completed' },
  };
  const st = statusMap[svc.status] || statusMap['progress'];

  const dateStr = svc.startDate
    ? new Date(svc.startDate).toLocaleDateString('es-ES', { year: 'numeric', month: 'short', day: 'numeric' })
    : '—';

  /* Barra de progreso para Pack Temporada */
  let progressHTML = '';
  if (svc.events) {
    const pct = Math.round((svc.events.covered / svc.events.total) * 100);
    progressHTML = `
      <div class="service-progress-wrap">
        <div class="service-progress-label">${svc.events.covered} / ${svc.events.total} eventos cubiertos</div>
        <div class="service-progress-track">
          <div class="service-progress-fill" style="width: ${pct}%"></div>
        </div>
      </div>`;
  }

  // Precio + nombre canónicos (capa de presentación). El payload de
  // /api/user/services no incluye `code`, así que resolvemos por nombre con
  // fallback al snapshot histórico — los nombres antiguos se reescriben.
  const displayPrice = resolveCanonicalPrice(svc.code || svc.name, svc.price);
  const displayName  = resolveCanonicalName (svc.code || svc.name, svc.name);

  return `
    <div class="service-item">
      <div class="service-item-left">
        <span class="service-item-type">${escapeHTML(svc.type)}</span>
        <span class="service-item-name">${escapeHTML(displayName)}</span>
        <div class="service-item-meta">
          <span class="service-meta-chip">
            <svg width="10" height="10" viewBox="0 0 12 12" fill="none" aria-hidden="true">
              <rect x="1" y="2.5" width="10" height="8.5" rx="1.5" stroke="currentColor" stroke-width="1.1"/>
              <path d="M4 1v3M8 1v3M1 5.5h10" stroke="currentColor" stroke-width="1.1" stroke-linecap="round"/>
            </svg>
            ${dateStr}
          </span>
          ${svc.endDate ? `<span class="service-meta-chip">
            <svg width="10" height="10" viewBox="0 0 12 12" fill="none" aria-hidden="true">
              <circle cx="6" cy="6" r="4.5" stroke="currentColor" stroke-width="1.1"/>
              <path d="M6 4v2.5L8 8" stroke="currentColor" stroke-width="1.1" stroke-linecap="round"/>
            </svg>
            Hasta ${new Date(svc.endDate).toLocaleDateString('es-ES', { month: 'short', year: 'numeric' })}
          </span>` : ''}
        </div>
        ${progressHTML}
      </div>
      <div class="service-item-right">
        <span class="service-status ${st.cls}">${st.label}</span>
        <span class="service-price">${escapeHTML(displayPrice)}</span>
      </div>
    </div>`;
}

function getAuthHeaders() {
  const token = localStorage.getItem('token');
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}
/* ══════════════════════════════════════════════════════
   5. MEMBRESÍA COLLECTOR'S CLUB
   ──────────────────────────────────────────────────────
   Intenta cargar desde backend. Fallback a localStorage
   o estado inactivo si no hay datos.
══════════════════════════════════════════════════════ */
async function loadMembership() {
  let membership = null;
  const token = localStorage.getItem('token');
  try {
    const res = await fetch(`${API_BASE}/user/membership`, {
      headers: getAuthHeaders(),
    });
    if (res.ok) {
      const data = await res.json();
      membership = data.membership || null;
    } else {
      membership = getMockMembership();
    }
  } catch {
    membership = getMockMembership();
  }

  renderMembership(membership);
  renderMembershipOverview(membership);
}

function getMockMembership() {
  /* Devuelve null para mostrar estado inactivo en el mock.
     Cambia esto a un objeto para probar el estado activo:
     return { active: true, since: '2025-01-12', renewal: '2026-01-12', plan: 'Mensual · 15€/mes' }; */
  return null;
}

function renderMembershipOverview(membership) {
  const tag  = document.getElementById('membershipTag');
  const desc = document.getElementById('membershipDesc');
  if (!tag || !desc) return;

  if (membership?.active) {
    tag.textContent  = 'Activo';
    tag.className    = 'card-tag card-tag--gold';
    desc.textContent = `Miembro desde ${formatDate(membership.since)}. Próxima renovación: ${formatDate(membership.renewal)}.`;
  } else {
    tag.textContent  = 'Inactivo';
    tag.className    = 'card-tag';
    tag.style.cssText = 'background:rgba(255,255,255,.05);color:var(--text-muted);border:1px solid rgba(255,255,255,.07);';
    desc.textContent = 'No eres miembro del Collector\'s Club. Únete para acceder a contenido exclusivo.';
  }
}

function renderMembership(membership) {
  const activeEl   = document.getElementById('membershipActive');
  const inactiveEl = document.getElementById('membershipInactive');
  if (!activeEl || !inactiveEl) return;

  if (membership?.active) {
    inactiveEl.setAttribute('hidden', '');
    activeEl.removeAttribute('hidden');
    setText('membershipCardName', currentUser.name);
    setText('memberSince',        formatDate(membership.since));
    setText('memberRenewal',      formatDate(membership.renewal));
    setText('memberPlan',         membership.plan || '—');
  } else {
    activeEl.setAttribute('hidden', '');
    inactiveEl.removeAttribute('hidden');
  }
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch { return dateStr; }
}


/* ══════════════════════════════════════════════════════
   6. ADMIN — datos y render
   Solo se ejecuta si role === 'admin'
══════════════════════════════════════════════════════ */
async function loadAdminData() {
  if (currentUser.role !== 'admin') return;

  await Promise.allSettled([
    loadAdminUsers(),
    loadAdminClubMembers(),
    loadInbox(),           // ← chat inbox replaces old contact-form inbox
    loadAdminPlanRequests(),
    loadAdminServiceRequests(),
  ]);
  initChatListeners();     // ← chat input / send / close listeners
  initAdminRequestsListeners();
}

async function loadUserOverviewData() {
  if (currentUser.role === 'admin') return;

  try {
    const res = await fetch(`${API_BASE}/messages/me`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json();
    adminOverviewState.userMessages = Array.isArray(data.messages) ? data.messages : [];

    /* Cliente: por defecto NADA expandido — feel calmado.
       El usuario decide qué hilo abrir pulsando. */
    adminOverviewState.selectedMessageId = null;

    renderAdminOverviewUsers();
  } catch (err) {
    console.error('[Overview] loadUserOverviewData error:', err);
    adminOverviewState.userMessages = [];
    adminOverviewState.selectedMessageId = null;
    renderAdminOverviewUsers('Error al cargar tus mensajes.');
  }
}

async function loadAdminUsers() {
  const tbody = document.getElementById('usersTableBody');
  if (!tbody) return;

  try {
    const res = await fetch(`${API_BASE}/admin/users`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
    });
    if (!res.ok) throw new Error();
    const data = await res.json();
    const users = Array.isArray(data.users) ? data.users : [];
    adminOverviewState.users = users;
    tbody.innerHTML = users.length
      ? users.map(u => `
          <tr>
            <td>${escapeHTML(u.name || '—')}</td>
            <td>${escapeHTML(u.email || '—')}</td>
            <td><span class="admin-badge admin-badge--${u.role === 'admin' ? 'admin' : 'user'}">${u.role || 'client'}</span></td>
            <td>${formatDate(u.createdAt)}</td>
            <td><span class="admin-badge admin-badge--${u.active !== false ? 'active' : 'inactive'}">${u.active !== false ? 'Activo' : 'Inactivo'}</span></td>
          </tr>`).join('')
      : '<tr class="admin-table-empty"><td colspan="5">No hay usuarios registrados.</td></tr>';
    renderAdminOverviewUsers();
  } catch {
    tbody.innerHTML = '<tr class="admin-table-empty"><td colspan="5">Error al cargar usuarios. Verifica la conexión con el backend.</td></tr>';
    adminOverviewState.users = [];
    renderAdminOverviewUsers('Error al cargar usuarios.');
  }
}

async function loadAdminClubMembers() {
  const tbody = document.getElementById('membersTableBody');
  if (!tbody) return;

  try {
    const res = await fetch(`${API_BASE}/admin/club-members`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
    });
    if (!res.ok) throw new Error();
    const data = await res.json();
    const members = Array.isArray(data.members) ? data.members : [];
    adminOverviewState.members = members;

    /* Stats */
    const active  = members.filter(m => m.active).length;
    const pending = members.filter(m => !m.active).length;
    setText('adminActiveMembers',  String(active));
    setText('adminPendingMembers', String(pending));
    setText('adminTotalRevenue',   data.revenueMonth ? `€${data.revenueMonth}` : '—');

    tbody.innerHTML = members.length
      ? members.map(m => `
          <tr>
            <td>${escapeHTML(m.name || '—')}</td>
            <td>${escapeHTML(m.plan || '—')}</td>
            <td>${formatDate(m.since)}</td>
            <td>${formatDate(m.renewal)}</td>
            <td><span class="admin-badge admin-badge--${m.active ? 'active' : 'inactive'}">${m.active ? 'Activo' : 'Inactivo'}</span></td>
            <td>
              <button class="btn-admin-toggle" data-member-id="${escapeHTML(m.id || '')}" data-active="${m.active}">
                ${m.active ? 'Desactivar' : 'Activar'}
              </button>
            </td>
          </tr>`).join('')
      : '<tr class="admin-table-empty"><td colspan="6">No hay miembros registrados.</td></tr>';

    /* Toggle handlers */
    tbody.querySelectorAll('.btn-admin-toggle').forEach(btn => {
      btn.addEventListener('click', () => toggleMemberStatus(btn));
    });
    renderAdminOverviewDetail();
  } catch {
    tbody.innerHTML = '<tr class="admin-table-empty"><td colspan="6">Error al cargar miembros. Verifica la conexión con el backend.</td></tr>';
    adminOverviewState.members = [];
    renderAdminOverviewDetail();
  }
}

async function toggleMemberStatus(btn) {
  const memberId = btn.dataset.memberId;
  const isActive = btn.dataset.active === 'true';
  if (!memberId) return;

  btn.disabled     = true;
  btn.textContent  = '…';

  try {
    const res = await fetch(`${API_BASE}/admin/club-members/${memberId}/toggle`, {
      method:  'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization:  `Bearer ${localStorage.getItem('token')}`,
      },
      body: JSON.stringify({ active: !isActive }),
    });
    if (res.ok) {
      /* Recargar la tabla */
      await loadAdminClubMembers();
    } else {
      btn.disabled    = false;
      btn.textContent = isActive ? 'Desactivar' : 'Activar';
    }
  } catch {
    btn.disabled    = false;
    btn.textContent = isActive ? 'Desactivar' : 'Activar';
  }
}


/* ══════════════════════════════════════════════════════
   6.5 ENTITLEMENTS (roles de servicio)
   ──────────────────────────────────────────────────────
   Capa separada: NO mezcla User.role ni Collectors Club.
   Consume data.entitlements de GET /api/user/services.
   Admin: GET/PATCH bajo /api/admin/entitlements.
══════════════════════════════════════════════════════ */

const ENT_STATUS_MAP = {
  active:    { label: 'Activo',     cls: 'service-status--active'    },
  expired:   { label: 'Expirado',   cls: 'service-status--progress'  },
  completed: { label: 'Completado', cls: 'service-status--completed' },
  cancelled: { label: 'Cancelado',  cls: 'service-status--progress'  },
};

function entStatusBadge(status) {
  const s = ENT_STATUS_MAP[status] || { label: status || '—', cls: 'service-status--progress' };
  return `<span class="service-status ${s.cls}">${escapeHTML(s.label)}</span>`;
}

function entValidityText(e) {
  if (!e.validUntil) return 'Sin caducidad';
  const d = new Date(e.validUntil);
  if (Number.isNaN(d.getTime())) return '—';
  return `Hasta ${d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}`;
}

/* ── Usuario: bloque "Mis roles activos" en Overview ── */
function renderEntitlements(entitlements, services) {
  const block  = document.getElementById('entitlementsBlock');
  const grid   = document.getElementById('entitlementsGrid');
  const empty  = document.getElementById('entitlementsEmpty');
  if (!block || !grid || !empty) return;

  /* Admin no tiene roles personales → bloque entero oculto.
     Consistente con el resolver: para admin nunca se muestra
     estado vacío de cliente. */
  if (currentUser && currentUser.role === 'admin') {
    block.setAttribute('hidden', '');
    return;
  }
  block.removeAttribute('hidden');

  /* Filtrar a los visibles para usuario: nunca mostrar 'cancelled' */
  const visible = (entitlements || []).filter(e => e.status !== 'cancelled');
  const isOperational = hasOperationalServiceState(services, entitlements);

  /* Empty del bloque sólo si NO hay nada operativo. Si el usuario tiene
     servicios pero aún no entitlements (p.ej. solicitud pendiente),
     ocultamos ambos sub-elementos para evitar mensaje falso. */
  if (!visible.length) {
    grid.setAttribute('hidden', '');
    grid.innerHTML = '';
    if (isOperational) {
      empty.setAttribute('hidden', '');
    } else {
      empty.removeAttribute('hidden');
    }
    return;
  }

  empty.setAttribute('hidden', '');
  grid.removeAttribute('hidden');
  grid.innerHTML = visible.map(buildEntitlementCardHTML).join('');
}

function buildEntitlementCardHTML(e) {
  const snap = e.serviceSnapshot || {};
  // Nombre canónico vía mapa frontend (serviceCode siempre disponible en
  // entitlements). Fallback: snapshot.name → serviceCode → entitlementKey.
  const rawName = snap.name || e.serviceCode || e.entitlementKey || 'Servicio';
  const name    = resolveCanonicalName(e.serviceCode || snap.name, rawName);
  const granted = e.grantedAt
    ? new Date(e.grantedAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
    : '—';
  return `
    <div class="entitlement-card dash-card">
      <div class="entitlement-card-header">
        <span class="entitlement-key">${escapeHTML(e.entitlementKey || '')}</span>
        ${entStatusBadge(e.status)}
      </div>
      <p class="entitlement-name">${escapeHTML(name)}</p>
      <div class="entitlement-meta">
        <span class="entitlement-meta-row"><span class="entitlement-meta-label">Vigencia:</span> ${escapeHTML(entValidityText(e))}</span>
        <span class="entitlement-meta-row"><span class="entitlement-meta-label">Concedido:</span> ${escapeHTML(granted)}</span>
      </div>
    </div>`;
}

/* ── Admin: sección "Roles de servicio" ── */
let adminEntitlementsState = { items: [], loading: false };

async function loadAdminEntitlements() {
  if (currentUser.role !== 'admin') return;

  const tbody = document.getElementById('entitlementsTableBody');
  if (!tbody) return;

  const statusSel   = document.getElementById('entFilterStatus');
  const categorySel = document.getElementById('entFilterCategory');
  const q = new URLSearchParams();
  if (statusSel && statusSel.value)     q.set('status',   statusSel.value);
  if (categorySel && categorySel.value) q.set('category', categorySel.value);
  const qs = q.toString();

  adminEntitlementsState.loading = true;
  tbody.innerHTML = '<tr class="admin-table-empty"><td colspan="7">Cargando roles de servicio…</td></tr>';

  try {
    const res = await fetch(`${API_BASE}/admin/entitlements${qs ? `?${qs}` : ''}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const items = Array.isArray(data.entitlements) ? data.entitlements : [];
    adminEntitlementsState.items = items;
    renderAdminEntitlementsStats(items);
    renderAdminEntitlementsTable(items);
  } catch (err) {
    console.error('[adminEntitlements] error:', err);
    tbody.innerHTML = '<tr class="admin-table-empty"><td colspan="7">Error al cargar roles de servicio.</td></tr>';
    setText('entStatActive',    '—');
    setText('entStatExpired',   '—');
    setText('entStatCompleted', '—');
    setText('entStatCancelled', '—');
  } finally {
    adminEntitlementsState.loading = false;
  }
}

function renderAdminEntitlementsStats(items) {
  const count = (st) => items.filter(e => e.status === st).length;
  setText('entStatActive',    String(count('active')));
  setText('entStatExpired',   String(count('expired')));
  setText('entStatCompleted', String(count('completed')));
  setText('entStatCancelled', String(count('cancelled')));
}

function renderAdminEntitlementsTable(items) {
  const tbody = document.getElementById('entitlementsTableBody');
  if (!tbody) return;

  if (!items.length) {
    tbody.innerHTML = '<tr class="admin-table-empty"><td colspan="7">No hay roles de servicio que coincidan con el filtro.</td></tr>';
    return;
  }

  tbody.innerHTML = items.map(e => {
    const snap = e.serviceSnapshot || {};
    const userLabel = e.user
      ? `${escapeHTML(e.user.username || e.user.email || '—')}<br><span class="admin-cell-sub">${escapeHTML(e.user.email || '')}</span>`
      : '<span class="admin-cell-sub">—</span>';
    const grantedAt = formatDate(e.grantedAt);
    const validity  = entValidityText(e);
    const isTerminal = ['expired', 'completed', 'cancelled'].includes(e.status);
    const actions = isTerminal
      ? '<span class="admin-cell-sub">—</span>'
      : `
        <button class="btn-admin-toggle" data-ent-action="complete" data-ent-id="${escapeHTML(e.id)}">Completar</button>
        <button class="btn-admin-toggle" data-ent-action="revoke"   data-ent-id="${escapeHTML(e.id)}">Revocar</button>
      `;
    return `
      <tr>
        <td>${userLabel}</td>
        <td><span class="admin-badge admin-badge--user">${escapeHTML(e.entitlementKey || '')}</span></td>
        <td>${escapeHTML(resolveCanonicalName(e.serviceCode || snap.name, snap.name || e.serviceCode || '—'))}<br><span class="admin-cell-sub">${escapeHTML(e.category || '')}</span></td>
        <td>${entStatusBadge(e.status)}</td>
        <td>${escapeHTML(validity)}</td>
        <td>${escapeHTML(grantedAt)}</td>
        <td class="admin-actions-cell">${actions}</td>
      </tr>`;
  }).join('');

  tbody.querySelectorAll('[data-ent-action]').forEach(btn => {
    btn.addEventListener('click', () => handleEntitlementAction(btn));
  });
}

async function handleEntitlementAction(btn) {
  const id     = btn.getAttribute('data-ent-id');
  const action = btn.getAttribute('data-ent-action');
  if (!id || !action) return;

  let url, body = null;
  if (action === 'revoke') {
    const reason = window.prompt('Motivo de la revocación (opcional):', '') || '';
    url = `${API_BASE}/admin/entitlements/${encodeURIComponent(id)}/revoke`;
    body = JSON.stringify({ reason });
  } else if (action === 'complete') {
    if (!window.confirm('¿Marcar este rol como completado?')) return;
    url = `${API_BASE}/admin/entitlements/${encodeURIComponent(id)}/complete`;
  } else {
    return;
  }

  btn.disabled = true;
  try {
    const res = await fetch(url, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization:  `Bearer ${localStorage.getItem('token')}`,
      },
      body,
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      throw new Error(d.error || `HTTP ${res.status}`);
    }
    await loadAdminEntitlements();
  } catch (err) {
    console.error('[adminEntitlements] action error:', err);
    window.alert(`No se pudo ${action === 'revoke' ? 'revocar' : 'completar'}: ${err.message}`);
    btn.disabled = false;
  }
}

function initAdminEntitlementsListeners() {
  document.getElementById('btnRefreshEntitlements')?.addEventListener('click', () => loadAdminEntitlements());
  document.getElementById('entFilterStatus')?.addEventListener('change',       () => loadAdminEntitlements());
  document.getElementById('entFilterCategory')?.addEventListener('change',     () => loadAdminEntitlements());
}


/* ══════════════════════════════════════════════════════
   6.6 ADMIN — SOLICITUDES (PLAN + SERVICIOS)
   ──────────────────────────────────────────────────────
   Visibilidad y ciclo de vida de las requests recibidas.
   Endpoints:
     GET   /api/admin/plans
     PATCH /api/admin/plans/:id/{approve|reject|complete}
     GET   /api/admin/service-requests
     PATCH /api/admin/service-requests/:id/{approve|reject|complete}
   Sólo se ejecuta si currentUser.role === 'admin'.
══════════════════════════════════════════════════════ */

const PLAN_REQ_STATUS_MAP = {
  pending:   { label: 'Pendiente',  cls: 'service-status--progress'  },
  active:    { label: 'Aprobada',   cls: 'service-status--active'    },
  completed: { label: 'Completada', cls: 'service-status--completed' },
  rejected:  { label: 'Rechazada',  cls: 'service-status--progress'  },
  cancelled: { label: 'Cancelada',  cls: 'service-status--progress'  },
  expired:   { label: 'Expirada',   cls: 'service-status--progress'  },
};

const SVC_REQ_STATUS_MAP = {
  pending:   { label: 'Pendiente',  cls: 'service-status--progress'  },
  approved:  { label: 'Aprobada',   cls: 'service-status--active'    },
  completed: { label: 'Completada', cls: 'service-status--completed' },
  rejected:  { label: 'Rechazada',  cls: 'service-status--progress'  },
  cancelled: { label: 'Cancelada',  cls: 'service-status--progress'  },
};

function _reqStatusBadge(status, map) {
  const s = map[status] || { label: status || '—', cls: 'service-status--progress' };
  return `<span class="service-status ${s.cls}">${escapeHTML(s.label)}</span>`;
}

function _reqUserCell(r) {
  if (!r.user) return '<span class="admin-cell-sub">—</span>';
  const main = escapeHTML(r.user.username || r.user.email || '—');
  const sub  = r.user.email ? `<br><span class="admin-cell-sub">${escapeHTML(r.user.email)}</span>` : '';
  return `${main}${sub}`;
}

/**
 * Formato canónico de precio mostrado en tablas admin.
 * IDÉNTICO al `formatCatalogPrice` del backend (UserController.js) para que
 * el admin vea EXACTAMENTE el mismo string que el usuario en /servicios y en
 * "Mis Servicios".  "€1.800", "€8.500 / temporada", "€15.000 / año".
 */
function _formatCatalogPrice(price, currency, interval) {
  if (price === undefined || price === null || price === '') return '';
  let numFmt;
  try {
    numFmt = new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: currency || 'EUR',
      maximumFractionDigits: 0,
    });
  } catch { return `${price} ${currency || ''}`.trim(); }
  const base = numFmt.format(price);
  const INTERVAL_LABEL = { season: 'temporada', year: 'año', month: 'mes', project: null };
  const label = interval
    ? (INTERVAL_LABEL[interval] !== undefined ? INTERVAL_LABEL[interval] : interval)
    : null;
  return label ? `${base} / ${label}` : base;
}

/** Línea masked card · brand · holder. Vacía si no hay pago vinculado. */
function _reqPaymentLine(r) {
  const p = r.paymentSnapshot;
  if (!p || !p.last4) return '';
  const brand = String(p.brand || 'card').toUpperCase();
  const last4 = String(p.last4).padStart(4, '•');
  const holder = (p.holder || '').trim();
  const holderTxt = holder ? ` · ${escapeHTML(holder)}` : '';
  return `<br><span class="admin-cell-sub admin-cell-sub--pay">💳 ${escapeHTML(brand)} •••• ${escapeHTML(last4)}${holderTxt}</span>`;
}

function _reqNotesCell(r) {
  const userNotes  = (r.notes || '').trim();
  const adminNotes = (r.adminNotes || '').trim();
  const parts = [];
  if (userNotes)  parts.push(`<span class="admin-cell-sub">${escapeHTML(userNotes.slice(0, 140))}${userNotes.length > 140 ? '…' : ''}</span>`);
  if (adminNotes) parts.push(`<span class="admin-cell-sub admin-cell-sub--admin">↳ ${escapeHTML(adminNotes.slice(0, 100))}${adminNotes.length > 100 ? '…' : ''}</span>`);
  return parts.length ? parts.join('<br>') : '<span class="admin-cell-sub">—</span>';
}

/* ── State ── */
const adminRequestsState = {
  plans:    { items: [], loading: false },
  services: { items: [], loading: false },
};

/* ────────────────────────────────────────────────────
   PLAN REQUESTS
──────────────────────────────────────────────────── */
async function loadAdminPlanRequests() {
  if (currentUser.role !== 'admin') return;

  const tbody = document.getElementById('planRequestsTableBody');
  if (!tbody) return;

  const statusSel = document.getElementById('planReqFilterStatus');
  const q = new URLSearchParams();
  if (statusSel && statusSel.value) q.set('status', statusSel.value);
  const qs = q.toString();

  adminRequestsState.plans.loading = true;
  tbody.innerHTML = '<tr class="admin-table-empty"><td colspan="6">Cargando solicitudes de planes…</td></tr>';

  try {
    const res = await fetch(`${API_BASE}/admin/plans${qs ? `?${qs}` : ''}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data  = await res.json();
    const items = Array.isArray(data.requests) ? data.requests : [];
    adminRequestsState.plans.items = items;
    renderPlanRequestsStats(items);
    renderPlanRequestsTable(items);
    _updateNavRequestsBadges();
  } catch (err) {
    console.error('[adminPlanRequests] error:', err);
    tbody.innerHTML = '<tr class="admin-table-empty"><td colspan="6">Error al cargar solicitudes de planes.</td></tr>';
    setText('planReqStatPending',   '—');
    setText('planReqStatActive',    '—');
    setText('planReqStatCompleted', '—');
    setText('planReqStatRejected',  '—');
  } finally {
    adminRequestsState.plans.loading = false;
  }
}

function renderPlanRequestsStats(items) {
  const count = (st) => items.filter(r => r.status === st).length;
  setText('planReqStatPending',   String(count('pending')));
  setText('planReqStatActive',    String(count('active')));
  setText('planReqStatCompleted', String(count('completed')));
  setText('planReqStatRejected',  String(count('rejected')));
}

function renderPlanRequestsTable(items) {
  const tbody = document.getElementById('planRequestsTableBody');
  if (!tbody) return;

  if (!items.length) {
    tbody.innerHTML = '<tr class="admin-table-empty"><td colspan="6">No hay solicitudes con este filtro.</td></tr>';
    return;
  }

  tbody.innerHTML = items.map((r) => {
    const snap = r.planSnapshot || {};
    // Nombre canónico vía mapa frontend (planCode siempre presente en admin).
    // Fallback: snapshot.name o planCode literal.
    const displayName = resolveCanonicalName(r.planCode || snap.name, snap.name || r.planCode || '—');
    const planLabel   = escapeHTML(displayName);
    // Precio canónico vía mapa frontend.
    // Fallback: precio formateado desde el snapshot histórico.
    const snapshotPrice = _formatCatalogPrice(snap.price, snap.currency, snap.interval);
    const displayPrice  = resolveCanonicalPrice(r.planCode || snap.name, snapshotPrice);
    const priceLine = displayPrice
      ? `<br><span class="admin-cell-sub">${escapeHTML(displayPrice)}</span>`
      : '';
    const payLine   = _reqPaymentLine(r);
    const requested = formatDate(r.requestedAt);
    const actions   = _planRequestActions(r);

    return `
      <tr>
        <td>${_reqUserCell(r)}</td>
        <td>${planLabel}${priceLine}${payLine}</td>
        <td>${escapeHTML(requested)}</td>
        <td>${_reqNotesCell(r)}</td>
        <td>${_reqStatusBadge(r.status, PLAN_REQ_STATUS_MAP)}</td>
        <td class="admin-actions-cell">${actions}</td>
      </tr>`;
  }).join('');

  tbody.querySelectorAll('[data-plan-req-action]').forEach((btn) => {
    btn.addEventListener('click', () => handlePlanRequestAction(btn));
  });
}

function _planRequestActions(r) {
  if (r.status === 'pending') {
    return `
      <button class="btn-admin-toggle" data-plan-req-action="approve" data-plan-req-id="${escapeHTML(r.id)}">Aprobar</button>
      <button class="btn-admin-toggle" data-plan-req-action="reject"  data-plan-req-id="${escapeHTML(r.id)}">Rechazar</button>
    `;
  }
  if (r.status === 'active') {
    return `<button class="btn-admin-toggle" data-plan-req-action="complete" data-plan-req-id="${escapeHTML(r.id)}">Marcar completada</button>`;
  }
  return '<span class="admin-cell-sub">—</span>';
}

async function handlePlanRequestAction(btn) {
  const id     = btn.getAttribute('data-plan-req-id');
  const action = btn.getAttribute('data-plan-req-action');
  if (!id || !action) return;

  let url, body = null, confirmMsg;
  if (action === 'approve') {
    confirmMsg = '¿Aprobar esta solicitud de plan?';
    url = `${API_BASE}/admin/plans/${encodeURIComponent(id)}/approve`;
  } else if (action === 'reject') {
    const reason = window.prompt('Motivo del rechazo (opcional):', '') || '';
    url  = `${API_BASE}/admin/plans/${encodeURIComponent(id)}/reject`;
    body = JSON.stringify({ reason });
  } else if (action === 'complete') {
    confirmMsg = '¿Marcar esta solicitud como completada?';
    url = `${API_BASE}/admin/plans/${encodeURIComponent(id)}/complete`;
  } else {
    return;
  }

  if (confirmMsg && !window.confirm(confirmMsg)) return;

  btn.disabled = true;
  try {
    const res = await fetch(url, {
      method:  'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization:  `Bearer ${localStorage.getItem('token')}`,
      },
      body,
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      throw new Error(d.error || `HTTP ${res.status}`);
    }
    await loadAdminPlanRequests();
  } catch (err) {
    console.error('[adminPlanRequests] action error:', err);
    window.alert(`No se pudo completar la acción: ${err.message}`);
    btn.disabled = false;
  }
}

/* ────────────────────────────────────────────────────
   SERVICE REQUESTS
──────────────────────────────────────────────────── */
async function loadAdminServiceRequests() {
  if (currentUser.role !== 'admin') return;

  const tbody = document.getElementById('serviceRequestsTableBody');
  if (!tbody) return;

  const statusSel = document.getElementById('svcReqFilterStatus');
  const q = new URLSearchParams();
  if (statusSel && statusSel.value) q.set('status', statusSel.value);
  const qs = q.toString();

  adminRequestsState.services.loading = true;
  tbody.innerHTML = '<tr class="admin-table-empty"><td colspan="6">Cargando solicitudes de servicios…</td></tr>';

  try {
    const res = await fetch(`${API_BASE}/admin/service-requests${qs ? `?${qs}` : ''}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data  = await res.json();
    const items = Array.isArray(data.requests) ? data.requests : [];
    adminRequestsState.services.items = items;
    renderServiceRequestsStats(items);
    renderServiceRequestsTable(items);
    _updateNavRequestsBadges();
  } catch (err) {
    console.error('[adminServiceRequests] error:', err);
    tbody.innerHTML = '<tr class="admin-table-empty"><td colspan="6">Error al cargar solicitudes de servicios.</td></tr>';
    setText('svcReqStatPending',   '—');
    setText('svcReqStatApproved',  '—');
    setText('svcReqStatCompleted', '—');
    setText('svcReqStatRejected',  '—');
  } finally {
    adminRequestsState.services.loading = false;
  }
}

function renderServiceRequestsStats(items) {
  const count = (st) => items.filter(r => r.status === st).length;
  setText('svcReqStatPending',   String(count('pending')));
  setText('svcReqStatApproved',  String(count('approved')));
  setText('svcReqStatCompleted', String(count('completed')));
  setText('svcReqStatRejected',  String(count('rejected')));
}

function renderServiceRequestsTable(items) {
  const tbody = document.getElementById('serviceRequestsTableBody');
  if (!tbody) return;

  if (!items.length) {
    tbody.innerHTML = '<tr class="admin-table-empty"><td colspan="6">No hay solicitudes con este filtro.</td></tr>';
    return;
  }

  tbody.innerHTML = items.map((r) => {
    const snap = r.serviceSnapshot || {};
    // Nombre canónico vía mapa frontend (serviceCode disponible en admin).
    const displayName = resolveCanonicalName(r.serviceCode || snap.name, snap.name || r.serviceCode || '—');
    const svcLabel    = escapeHTML(displayName);
    // Precio canónico vía mapa frontend.
    const snapshotPrice = _formatCatalogPrice(snap.price, snap.currency, null);
    const displayPrice  = resolveCanonicalPrice(r.serviceCode || snap.name, snapshotPrice);
    const subLine   = snap.category || displayPrice
      ? `<br><span class="admin-cell-sub">${escapeHTML(snap.category || '')}${displayPrice ? ` · ${escapeHTML(displayPrice)}` : ''}</span>`
      : '';
    const payLine   = _reqPaymentLine(r);
    const requested = formatDate(r.requestedAt);
    const actions   = _serviceRequestActions(r);

    return `
      <tr>
        <td>${_reqUserCell(r)}</td>
        <td>${svcLabel}${subLine}${payLine}</td>
        <td>${escapeHTML(requested)}</td>
        <td>${_reqNotesCell(r)}</td>
        <td>${_reqStatusBadge(r.status, SVC_REQ_STATUS_MAP)}</td>
        <td class="admin-actions-cell">${actions}</td>
      </tr>`;
  }).join('');

  tbody.querySelectorAll('[data-svc-req-action]').forEach((btn) => {
    btn.addEventListener('click', () => handleServiceRequestAction(btn));
  });
}

function _serviceRequestActions(r) {
  if (r.status === 'pending') {
    return `
      <button class="btn-admin-toggle" data-svc-req-action="approve" data-svc-req-id="${escapeHTML(r.id)}">Aprobar</button>
      <button class="btn-admin-toggle" data-svc-req-action="reject"  data-svc-req-id="${escapeHTML(r.id)}">Rechazar</button>
    `;
  }
  if (r.status === 'approved') {
    return `<button class="btn-admin-toggle" data-svc-req-action="complete" data-svc-req-id="${escapeHTML(r.id)}">Marcar completada</button>`;
  }
  return '<span class="admin-cell-sub">—</span>';
}

async function handleServiceRequestAction(btn) {
  const id     = btn.getAttribute('data-svc-req-id');
  const action = btn.getAttribute('data-svc-req-action');
  if (!id || !action) return;

  let url, body = null, confirmMsg;
  if (action === 'approve') {
    confirmMsg = '¿Aprobar esta solicitud? Se generará el rol de servicio asociado.';
    url = `${API_BASE}/admin/service-requests/${encodeURIComponent(id)}/approve`;
  } else if (action === 'reject') {
    const reason = window.prompt('Motivo del rechazo (opcional):', '') || '';
    url  = `${API_BASE}/admin/service-requests/${encodeURIComponent(id)}/reject`;
    body = JSON.stringify({ reason });
  } else if (action === 'complete') {
    confirmMsg = '¿Marcar esta solicitud como completada?';
    url = `${API_BASE}/admin/service-requests/${encodeURIComponent(id)}/complete`;
  } else {
    return;
  }

  if (confirmMsg && !window.confirm(confirmMsg)) return;

  btn.disabled = true;
  try {
    const res = await fetch(url, {
      method:  'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization:  `Bearer ${localStorage.getItem('token')}`,
      },
      body,
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      throw new Error(d.error || `HTTP ${res.status}`);
    }
    await loadAdminServiceRequests();
    // Refrescar también entitlements porque approve crea uno nuevo.
    if (action === 'approve') loadAdminEntitlements();
  } catch (err) {
    console.error('[adminServiceRequests] action error:', err);
    window.alert(`No se pudo completar la acción: ${err.message}`);
    btn.disabled = false;
  }
}

/* ────────────────────────────────────────────────────
   Badges del sidebar — solicitudes pendientes
──────────────────────────────────────────────────── */
function _updateNavRequestsBadges() {
  const planPending = adminRequestsState.plans.items.filter(r => r.status === 'pending').length;
  const svcPending  = adminRequestsState.services.items.filter(r => r.status === 'pending').length;

  const planBadge = document.getElementById('navPlanRequestsCount');
  if (planBadge) planBadge.textContent = String(planPending);

  const svcBadge = document.getElementById('navServiceRequestsCount');
  if (svcBadge) svcBadge.textContent = String(svcPending);
}

function initAdminRequestsListeners() {
  document.getElementById('btnRefreshPlanRequests')?.addEventListener('click',    () => loadAdminPlanRequests());
  document.getElementById('planReqFilterStatus')   ?.addEventListener('change',   () => loadAdminPlanRequests());
  document.getElementById('btnRefreshServiceRequests')?.addEventListener('click', () => loadAdminServiceRequests());
  document.getElementById('svcReqFilterStatus')    ?.addEventListener('change',   () => loadAdminServiceRequests());
}


/* ══════════════════════════════════════════════════════
   7. NAVEGACIÓN
   ──────────────────────────────────────────────────────
   Gestiona .nav-item + .dash-section + .card-link-btn
   + mobile drawer
══════════════════════════════════════════════════════ */
(function initNav() {
  const navItems = document.querySelectorAll('.nav-item');
  const sections = document.querySelectorAll('.dash-section');

  function activateSection(sectionKey) {
    /* Actualizar nav */
    navItems.forEach(i => {
      i.classList.remove('is-active');
      i.removeAttribute('aria-current');
    });
    const activeItem = [...navItems].find(i => i.dataset.section === sectionKey);
    if (activeItem) {
      activeItem.classList.add('is-active');
      activeItem.setAttribute('aria-current', 'page');
    }

    /* Mostrar sección */
    const targetId = 'section' + capitalize(sectionKey);
    sections.forEach(s => {
      const isTarget = s.id === targetId;
      s.classList.toggle('is-active', isTarget);
      isTarget ? s.removeAttribute('hidden') : s.setAttribute('hidden', '');
    });

    closeMobileSidebar();
  }

  /* Nav items */
  navItems.forEach(item => {
    item.addEventListener('click', () => activateSection(item.dataset.section));
  });

  /* card-link-btn — navegan a sección sin ser nav-items */
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-nav]');
    if (btn) activateSection(btn.dataset.nav);
  });

  /* Mobile sidebar */
  const sidebar  = document.getElementById('dashSidebar');
  const overlay  = document.getElementById('sidebarOverlay');
  const toggle   = document.getElementById('mobileMenuToggle');

  function openMobileSidebar() {
    sidebar?.classList.add('is-open');
    overlay?.classList.add('is-open');
    overlay?.removeAttribute('aria-hidden');
    toggle?.setAttribute('aria-label', 'Cerrar menú');
    document.body.style.overflow = 'hidden';
  }

  function closeMobileSidebar() {
    sidebar?.classList.remove('is-open');
    overlay?.classList.remove('is-open');
    overlay?.setAttribute('aria-hidden', 'true');
    toggle?.setAttribute('aria-label', 'Abrir menú');
    document.body.style.overflow = '';
  }

  toggle?.addEventListener('click', () => {
    sidebar?.classList.contains('is-open') ? closeMobileSidebar() : openMobileSidebar();
  });
  overlay?.addEventListener('click', closeMobileSidebar);

  function capitalize(str) { return str.charAt(0).toUpperCase() + str.slice(1); }
})();


/* ══════════════════════════════════════════════════════
   8. PARTÍCULAS — canvas#bgParticles
══════════════════════════════════════════════════════ */
(function initParticles() {
  const canvas = document.getElementById('bgParticles');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  let W, H, particles, raf;

  const COLORS = [
    'rgba(0, 143, 245,', 'rgba(0, 200, 230,',
    'rgba(120, 80, 255,', 'rgba(200, 220, 255,',
  ];

  function count()  { return Math.round((W * H) / 22000); }

  function make() {
    const color = COLORS[Math.floor(Math.random() * COLORS.length)];
    return {
      x: Math.random() * W, y: Math.random() * H,
      vx: (Math.random() - 0.5) * 0.18, vy: (Math.random() - 0.5) * 0.14,
      r: Math.random() * 1.1 + 0.3, base: Math.random() * 0.55 + 0.15,
      amp: Math.random() * 0.25, freq: Math.random() * 0.012 + 0.004,
      phase: Math.random() * Math.PI * 2, color,
    };
  }

  function resize() {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
    particles = Array.from({ length: count() }, make);
  }

  function draw(t) {
    ctx.clearRect(0, 0, W, H);
    for (const p of particles) {
      p.x += p.vx; p.y += p.vy;
      if (p.x < 0) p.x = W; if (p.x > W) p.x = 0;
      if (p.y < 0) p.y = H; if (p.y > H) p.y = 0;
      const a = Math.max(0, Math.min(1, p.base + Math.sin(t * p.freq + p.phase) * p.amp));
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `${p.color}${a.toFixed(3)})`; ctx.fill();
    }
    raf = requestAnimationFrame(draw);
  }

  resize(); raf = requestAnimationFrame(draw);

  let timer;
  window.addEventListener('resize', () => {
    clearTimeout(timer);
    timer = setTimeout(() => { cancelAnimationFrame(raf); resize(); raf = requestAnimationFrame(draw); }, 120);
  });
})();


/* ══════════════════════════════════════════════════════
   9. ENTRADA + CARGA INICIAL
══════════════════════════════════════════════════════ */


/* ══════════════════════════════════════════════════════
   MÓDULO: ADMIN MESSAGES INBOX  v1
   ──────────────────────────────────────────────────────
   GET   /api/messages              → lista (admin)
   PATCH /api/messages/:id/read     → marcar leído
   PATCH /api/messages/:id/archive  → archivar
   Solo activo si currentUser.role === 'admin'
══════════════════════════════════════════════════════ */

const inboxState = {
  messages:     [],
  filtered:     [],
  selectedId:   null,
  activeFilter: 'all',
  loading:      false,
};

/* ── Cargar mensajes desde el backend ── */
async function loadAdminMessages() {
  if (currentUser.role !== 'admin') return;
  inboxState.loading = true;
  _inboxSetLoading(true);

  try {
    const res = await fetch(`${API_BASE}/messages`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    inboxState.messages = Array.isArray(data.messages) ? data.messages : [];
    _updateInboxCounts(data.counts || null);
    _applyInboxFilter(inboxState.activeFilter);
  } catch (err) {
    console.error('[Inbox] Error al cargar:', err);
    _inboxSetLoading(false, true);
  } finally {
    inboxState.loading = false;
  }
}

/* ── Aplicar filtro y re-renderizar lista ── */
function _applyInboxFilter(filter) {
  inboxState.activeFilter = filter;
  inboxState.filtered = filter === 'all'
    ? [...inboxState.messages]
    : inboxState.messages.filter(m => m.estado === filter);

  // Nuevos primero, luego por fecha descendente
  inboxState.filtered.sort((a, b) => {
    if (a.estado === 'nuevo' && b.estado !== 'nuevo') return -1;
    if (b.estado === 'nuevo' && a.estado !== 'nuevo') return  1;
    return new Date(b.fecha) - new Date(a.fecha);
  });

  _renderInboxList();
  _updateFilterTabs();
}

/* ── Estado cargando / error en el panel vacío ── */
function _inboxSetLoading(isLoading, isError) {
  const empty = document.getElementById('inboxEmptyState');
  if (!empty) return;
  empty.style.display = '';
  const t = empty.querySelector('.inbox-empty-title');
  const d = empty.querySelector('.inbox-empty-desc');
  if (isError) {
    if (t) t.textContent = 'Error al cargar';
    if (d) d.textContent = 'Verifica que el backend esté activo en el puerto configurado.';
  } else if (isLoading) {
    if (t) t.textContent = 'Cargando…';
    if (d) d.textContent = 'Obteniendo mensajes del servidor.';
  }
}

/* ── Renderiza la lista de mensajes ── */
function _renderInboxList() {
  const panel = document.getElementById('inboxListPanel');
  const empty = document.getElementById('inboxEmptyState');
  if (!panel) return;

  panel.querySelectorAll('.inbox-msg-item').forEach(el => el.remove());

  if (!inboxState.filtered.length) {
    if (empty) {
      empty.style.display = '';
      const t = empty.querySelector('.inbox-empty-title');
      const d = empty.querySelector('.inbox-empty-desc');
      if (t) t.textContent = 'Sin mensajes';
      if (d) d.textContent = inboxState.activeFilter === 'all'
        ? 'Los mensajes del formulario de contacto aparecerán aquí.'
        : `No hay mensajes con estado "${inboxState.activeFilter}".`;
    }
    _updateNavMessagesBadge();
    return;
  }

  if (empty) empty.style.display = 'none';
  inboxState.filtered.forEach(msg => panel.appendChild(_buildInboxItem(msg)));
  _updateNavMessagesBadge();

  // Mantener selección si sigue visible
  if (inboxState.selectedId) {
    const still = inboxState.filtered.find(m => m.id === inboxState.selectedId);
    still ? _highlightItem(inboxState.selectedId) : _closeDetail();
  }
}

/* ── Construye un item DOM de la lista ── */
function _buildInboxItem(msg) {
  const item     = document.createElement('div');
  const isUnread = msg.estado === 'nuevo';
  const isActive = inboxState.selectedId === msg.id;
  item.className  = `inbox-msg-item${isUnread ? ' is-unread' : ''}${isActive ? ' is-selected' : ''}`;
  item.dataset.id = msg.id;
  item.setAttribute('role', 'listitem');
  item.setAttribute('tabindex', '0');

  const preview = (msg.mensaje || '').slice(0, 75).replace(/\n/g, ' ');
  const hasMore = (msg.mensaje || '').length > 75;

  item.innerHTML = `
    <div class="inbox-item-top">
      <div class="inbox-item-sender">
        <span class="inbox-item-avatar">${escapeHTML((msg.nombre || '?').charAt(0).toUpperCase())}</span>
        <span class="inbox-item-name">${escapeHTML(msg.nombre || '—')}</span>
      </div>
      <div class="inbox-item-right">
        <span class="inbox-item-date">${_fmtShort(msg.fecha)}</span>
        ${isUnread ? '<span class="inbox-item-badge">NEW</span>' : ''}
      </div>
    </div>
    <p class="inbox-item-preview">${escapeHTML(preview)}${hasMore ? '…' : ''}</p>`;

  item.addEventListener('click',   () => _openMessage(msg.id));
  item.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') _openMessage(msg.id); });
  return item;
}

/* ── Abrir mensaje: mostrar detalle + marcar leído ── */
async function _openMessage(id) {
  const msg = inboxState.messages.find(m => m.id === id);
  if (!msg) return;
  inboxState.selectedId = id;
  _highlightItem(id);
  _renderDetail(msg);
  if (msg.estado === 'nuevo') await _markRead(id);
}

/* ── Renderiza el panel de detalle ── */
function _renderDetail(msg) {
  document.getElementById('inboxDetailEmpty')  ?.setAttribute('hidden', '');
  document.getElementById('inboxDetailContent')?.removeAttribute('hidden');

  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

  set('detailAvatar', (msg.nombre || '?').charAt(0).toUpperCase());
  set('detailName',   msg.nombre    || '—');
  set('detailEmail',  msg.userEmail || '—');
  set('detailDate',   _fmtFull(msg.fecha));
  set('detailBody',   msg.mensaje   || '—');

  // Chip de estado
  const chip = document.getElementById('detailEstado');
  if (chip) {
    const labels = { nuevo: 'Nuevo', leido: 'Leído', archivado: 'Archivado' };
    chip.textContent = labels[msg.estado] || msg.estado;
    chip.className   = `inbox-estado-chip inbox-estado-chip--${msg.estado || 'leido'}`;
  }

  // Botón archivar
  const archBtn = document.getElementById('btnArchiveMsg');
  if (archBtn) {
    const isArchived = msg.estado === 'archivado';
    archBtn.disabled     = isArchived;
    archBtn.dataset.msgId = msg.id;
    archBtn.innerHTML = `<svg width="13" height="13" viewBox="0 0 16 16" fill="none">
      <path d="M2 4h12v1.5H2zM3.5 5.5l.5 8h8l.5-8" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M6 8.5h4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
      ${isArchived ? 'Archivado' : 'Archivar'}`;
    archBtn.onclick = () => _archiveMessage(msg.id);
  }
}

/* ── Cierra el panel de detalle ── */
function _closeDetail() {
  inboxState.selectedId = null;
  document.getElementById('inboxDetailEmpty')  ?.removeAttribute('hidden');
  document.getElementById('inboxDetailContent')?.setAttribute('hidden', '');
}

/* ── Resalta el ítem activo ── */
function _highlightItem(id) {
  document.querySelectorAll('.inbox-msg-item').forEach(el => {
    el.classList.toggle('is-selected', el.dataset.id === String(id));
  });
}

/* ── PATCH /api/messages/:id/read ── */
async function _markRead(id) {
  try {
    const res = await fetch(`${API_BASE}/messages/${id}/read`, {
      method:  'PATCH',
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
    });
    if (!res.ok) return;

    const msg = inboxState.messages.find(m => m.id === id);
    if (!msg) return;
    msg.estado = 'leido';

    // Actualizar item de la lista
    const el = document.querySelector(`.inbox-msg-item[data-id="${id}"]`);
    el?.classList.remove('is-unread');
    el?.querySelector('.inbox-item-badge')?.remove();

    // Actualizar chip en el detalle
    if (inboxState.selectedId === id) {
      const chip = document.getElementById('detailEstado');
      if (chip) { chip.textContent = 'Leído'; chip.className = 'inbox-estado-chip inbox-estado-chip--leido'; }
    }

    _updateNavMessagesBadge();
    _updateInboxCounts(null);
  } catch (err) { console.error('[Inbox] markRead error:', err); }
}

/* ── PATCH /api/messages/:id/archive ── */
async function _archiveMessage(id) {
  const btn = document.getElementById('btnArchiveMsg');
  if (btn) { btn.disabled = true; btn.textContent = '…'; }

  try {
    const res = await fetch(`${API_BASE}/messages/${id}/archive`, {
      method:  'PATCH',
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const msg = inboxState.messages.find(m => m.id === id);
    if (msg) msg.estado = 'archivado';

    // Re-renderizar lista (el mensaje puede salir del filtro activo)
    _applyInboxFilter(inboxState.activeFilter);

    // Actualizar detalle si sigue abierto
    if (inboxState.selectedId === id) {
      _renderDetail(inboxState.messages.find(m => m.id === id) || { estado: 'archivado', id });
    }
  } catch (err) {
    console.error('[Inbox] archive error:', err);
    if (btn) {
      btn.disabled  = false;
      btn.innerHTML = `<svg width="13" height="13" viewBox="0 0 16 16" fill="none">
        <path d="M2 4h12v1.5H2zM3.5 5.5l.5 8h8l.5-8" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M6 8.5h4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>Archivar`;
    }
  }
}

/* ── Actualiza contadores de filtros ── */
function _updateInboxCounts(counts) {
  const c = counts || {
    nuevo: inboxState.messages.filter(m => m.estado === 'nuevo').length,
  };
  const el = document.getElementById('filterCountNuevo');
  if (el) {
    el.textContent  = String(c.nuevo || 0);
    el.style.display = (c.nuevo || 0) > 0 ? '' : 'none';
  }
}

/* ── Actualiza el badge del sidebar ── */
function _updateNavMessagesBadge() {
  const badge  = document.getElementById('navMessagesBadge');
  if (!badge) return;
  const unread = inboxState.messages.filter(m => m.estado === 'nuevo').length;
  badge.textContent  = String(unread);
  badge.style.display = unread > 0 ? '' : 'none';
}

/* ── Actualiza estilos de las tabs de filtro ── */
function _updateFilterTabs() {
  document.querySelectorAll('.inbox-filter-tab').forEach(tab => {
    const active = tab.dataset.filter === inboxState.activeFilter;
    tab.classList.toggle('is-active', active);
    tab.setAttribute('aria-selected', String(active));
  });
}

/* ── Registra listeners del inbox (llamado una vez desde loadAdminData) ── */
function initInboxListeners() {
  // Tabs de filtro
  document.getElementById('inboxFilterTabs')?.addEventListener('click', (e) => {
    const tab = e.target.closest('.inbox-filter-tab');
    if (tab && tab.dataset.filter) _applyInboxFilter(tab.dataset.filter);
  });

  // Botón Actualizar
  document.getElementById('btnRefreshMessages')?.addEventListener('click', () => loadAdminMessages());
}

/* ── Fecha corta para lista ── */
function _fmtShort(dateStr) {
  if (!dateStr) return '—';
  try {
    const d      = new Date(dateStr);
    const diffMs = Date.now() - d;
    const min    = Math.floor(diffMs / 60000);
    const hrs    = Math.floor(diffMs / 3600000);
    const days   = Math.floor(diffMs / 86400000);
    if (min  <  1) return 'Ahora';
    if (min  < 60) return `${min}min`;
    if (hrs  < 24) return d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    if (days <  2) return 'Ayer';
    return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
  } catch { return '—'; }
}

/* ── Fecha completa para el detalle ── */
function _fmtFull(dateStr) {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleString('es-ES', {
      day: '2-digit', month: 'long', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch { return dateStr; }
}


window.addEventListener('DOMContentLoaded', async () => {
  /* 1. Identidad autoritativa desde /api/me ANTES de cualquier render
        dependiente de rol (admin nav, secciones admin, etc.). */
  await loadUser();

  /* 2. Animación de entrada */
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      document.getElementById('dashRoot')?.classList.add('is-ready');
    });
  });

  /* 3. Cargar datos en paralelo (ahora con el rol ya resuelto en MongoDB) */
  await Promise.allSettled([
    loadServices(),
    loadMembership(),
    loadAdminData(),
    loadUserOverviewData(),
    loadSubscriptionActions(),
  ]);

  /* 4. Form de cambio de contraseña — listener único */
  initPasswordForm();
});

/* ══════════════════════════════════════════════════════
   SEGURIDAD — Cambio de contraseña
   PATCH /api/user/password  { currentPassword, newPassword }
══════════════════════════════════════════════════════ */
function initPasswordForm() {
  const form = document.getElementById('passwordForm');
  if (!form) return;

  const inputCurrent = document.getElementById('pwdCurrent');
  const inputNew     = document.getElementById('pwdNew');
  const inputConfirm = document.getElementById('pwdConfirm');
  const submitBtn    = document.getElementById('pwdSubmit');
  const feedback     = document.getElementById('pwdFeedback');

  function setFeedback(message, kind) {
    if (!feedback) return;
    if (!message) {
      feedback.hidden = true;
      feedback.textContent = '';
      feedback.classList.remove('is-success', 'is-error');
      return;
    }
    feedback.hidden = false;
    feedback.textContent = message;
    feedback.classList.toggle('is-success', kind === 'success');
    feedback.classList.toggle('is-error',   kind === 'error');
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    setFeedback('', null);

    const currentPassword = (inputCurrent?.value || '').trim();
    const newPassword     = (inputNew?.value     || '').trim();
    const confirmPassword = (inputConfirm?.value || '').trim();

    if (!currentPassword || !newPassword || !confirmPassword) {
      setFeedback('Completa todos los campos.', 'error');
      return;
    }
    if (newPassword.length < 6) {
      setFeedback('La nueva contraseña debe tener al menos 6 caracteres.', 'error');
      return;
    }
    if (newPassword !== confirmPassword) {
      setFeedback('La nueva contraseña y su confirmación no coinciden.', 'error');
      return;
    }
    if (newPassword === currentPassword) {
      setFeedback('La nueva contraseña debe ser distinta de la actual.', 'error');
      return;
    }

    submitBtn.disabled = true;
    const originalLabel = submitBtn.textContent;
    submitBtn.textContent = 'Guardando…';
    [inputCurrent, inputNew, inputConfirm].forEach((el) => { if (el) el.disabled = true; });

    try {
      const res = await fetch(`${API_BASE}/user/password`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setFeedback(data.error || `No se pudo actualizar la contraseña (HTTP ${res.status}).`, 'error');
        return;
      }

      setFeedback(data.message || 'Contraseña actualizada correctamente.', 'success');
      form.reset();
    } catch (err) {
      console.error('[security] changePassword error:', err);
      setFeedback('Error de conexión. Inténtalo de nuevo.', 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = originalLabel;
      [inputCurrent, inputNew, inputConfirm].forEach((el) => { if (el) el.disabled = false; });
    }
  });
}

/* ── Utilidades ── */
function escapeHTML(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* Prevent double-tap zoom iOS */
let lastTouch = 0;
document.addEventListener('touchend', (e) => {
  const now = Date.now();
  if (now - lastTouch < 300) e.preventDefault();
  lastTouch = now;
}, { passive: false });


/* ══════════════════════════════════════════════════════
   MÓDULO: ADMIN CHAT INBOX  v1
   ──────────────────────────────────────────────────────
   GET  /api/messages/admin          → lista de usuarios con mensajes
   GET  /api/messages/user/:userId   → historial de conversación
   POST /api/messages/admin/reply    → enviar respuesta admin
   Solo activo si currentUser.role === 'admin'
══════════════════════════════════════════════════════ */

const chatState = {
  selectedUserId:  null,
  inboxUsers:      [],
  pollingInterval: null,
  sending:         false,
};

/* ─────────────────────────────────────────
   loadInbox()
   Fetch GET /api/messages/admin → lista de
   usuarios que han enviado mensajes.
───────────────────────────────────────── */
async function loadInbox() {
  if (currentUser.role !== 'admin') return;

  _chatSetListLoading(true);

  try {
    const res = await fetch(`${API_BASE}/messages/admin`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    chatState.inboxUsers = Array.isArray(data) ? data : (data.users || []);
    adminOverviewState.inboxUsers = chatState.inboxUsers;
    renderInbox(chatState.inboxUsers);
    renderAdminOverviewUsers();
    renderAdminOverviewDetail();
  } catch (err) {
    console.error('[Chat] loadInbox error:', err);
    _chatShowListError('Error al cargar mensajes. Verifica la conexión.');
    adminOverviewState.inboxUsers = [];
    renderAdminOverviewUsers();
    renderAdminOverviewDetail();
  } finally {
    _chatSetListLoading(false);
  }
}

function renderAdminOverviewUsers(errorMessage = '') {
  const body = document.getElementById('adminOverviewUsersBody');
  if (!body || currentUser.role !== 'admin') return;

  const users = adminOverviewState.users;
  if (errorMessage) {
    body.innerHTML = `<tr class="admin-overview-empty-row"><td colspan="4">${escapeHTML(errorMessage)}</td></tr>`;
    return;
  }

  if (!users.length) {
    body.innerHTML = '<tr class="admin-overview-empty-row"><td colspan="4">No hay usuarios para mostrar.</td></tr>';
    return;
  }

  if (!adminOverviewState.selectedUserId) {
    adminOverviewState.selectedUserId = String(users[0].id || '');
  }

  body.innerHTML = users.map((user) => {
    const userId = String(user.id || '');
    const summary = adminOverviewState.inboxUsers.find((item) => String(item.userId) === userId);
    const unreadCount = summary?.unreadCount || 0;
    const messageState = unreadCount > 0
      ? `<span class="admin-overview-chip admin-overview-chip--unread">${unreadCount} nuevo${unreadCount > 1 ? 's' : ''}</span>`
      : `<span class="admin-overview-chip admin-overview-chip--idle">${summary ? 'Conversación' : 'Sin mensajes'}</span>`;

    return `
      <tr class="admin-overview-row ${adminOverviewState.selectedUserId === userId ? 'is-selected' : ''}" data-admin-user-id="${escapeHTML(userId)}">
        <td>
          <div class="admin-overview-user">
            <span class="admin-overview-user__avatar">${escapeHTML((user.name || '?').charAt(0).toUpperCase())}</span>
            <div class="admin-overview-user__meta">
              <span class="admin-overview-user__name">${escapeHTML(user.name || 'Usuario')}</span>
              <span class="admin-overview-user__hint">Pulsa para gestionar</span>
            </div>
          </div>
        </td>
        <td>${escapeHTML(user.email || '—')}</td>
        <td><span class="admin-overview-chip ${user.role === 'admin' ? 'admin-overview-chip--admin' : 'admin-overview-chip--user'}">${escapeHTML(user.role || 'client')}</span></td>
        <td>${messageState}</td>
      </tr>`;
  }).join('');

  body.querySelectorAll('[data-admin-user-id]').forEach((row) => {
    row.addEventListener('click', () => {
      adminOverviewState.selectedUserId = row.dataset.adminUserId;
      renderAdminOverviewUsers();
      renderAdminOverviewDetail();
    });
  });

  renderAdminOverviewDetail();
}

function renderAdminOverviewDetail() {
  const emptyEl = document.getElementById('adminOverviewDetailEmpty');
  const detailEl = document.getElementById('adminOverviewDetail');
  if (!emptyEl || !detailEl || currentUser.role !== 'admin') return;

  const selectedId = String(adminOverviewState.selectedUserId || '');
  const user = adminOverviewState.users.find((item) => String(item.id) === selectedId);

  if (!user) {
    emptyEl.removeAttribute('hidden');
    detailEl.setAttribute('hidden', '');
    detailEl.innerHTML = '';
    return;
  }

  const member = adminOverviewState.members.find((item) => String(item.id) === selectedId);
  const summary = adminOverviewState.inboxUsers.find((item) => String(item.userId) === selectedId);

  emptyEl.setAttribute('hidden', '');
  detailEl.removeAttribute('hidden');
  detailEl.innerHTML = `
    <div class="admin-overview-detail__hero">
      <span class="admin-overview-panel__eyebrow">Usuario seleccionado</span>
      <div class="admin-overview-detail__name">${escapeHTML(user.name || 'Usuario')}</div>
      <div class="admin-overview-detail__email">${escapeHTML(user.email || '—')}</div>
    </div>

    <div class="admin-overview-detail__grid">
      <div class="admin-overview-detail__item">
        <span class="admin-overview-detail__label">Rol</span>
        <span class="admin-overview-detail__value">${escapeHTML(user.role || 'client')}</span>
      </div>
      <div class="admin-overview-detail__item">
        <span class="admin-overview-detail__label">Mensajes pendientes</span>
        <span class="admin-overview-detail__value">${summary?.unreadCount || 0}</span>
      </div>
      <div class="admin-overview-detail__item">
        <span class="admin-overview-detail__label">Membresía</span>
        <span class="admin-overview-detail__value">${member ? (member.active ? 'Activa' : 'Inactiva') : 'Sin datos'}</span>
      </div>
      <div class="admin-overview-detail__item">
        <span class="admin-overview-detail__label">Último mensaje</span>
        <span class="admin-overview-detail__value">${escapeHTML(summary?.lastDate ? formatDate(summary.lastDate) : 'Sin actividad')}</span>
      </div>
    </div>

    <div class="admin-overview-actions">
      <button class="admin-overview-action" data-nav="adminUsuarios">Abrir ficha de usuario</button>
      <button class="admin-overview-action" data-nav="adminMessages">Abrir conversación</button>
      <button class="admin-overview-action" data-nav="adminClub">Gestionar membresía</button>
    </div>`;
}

/* ─────────────────────────────────────────
   renderInbox(users)
   Populate the left panel with user rows.
───────────────────────────────────────── */
function renderInbox(users) {
  const panel = document.getElementById('inboxListPanel');
  const empty = document.getElementById('inboxEmptyState');
  if (!panel) return;

  /* Remove old user items */
  panel.querySelectorAll('.inbox-user-item').forEach(el => el.remove());

  /* Update sidebar unread badge */
  const totalUnread = users.reduce((acc, u) => acc + (u.unreadCount || 0), 0);
  const badge = document.getElementById('navMessagesBadge');
  if (badge) {
    badge.textContent   = String(totalUnread);
    badge.style.display = totalUnread > 0 ? '' : 'none';
  }

  /* Update unread summary in section header */
  const summary = document.getElementById('inboxUnreadSummary');
  const countEl = document.getElementById('inboxUnreadCount');
  if (summary && countEl) {
    countEl.textContent   = String(totalUnread);
    summary.style.display = totalUnread > 0 ? '' : 'none';
  }

  if (!users.length) {
    if (empty) {
      empty.style.display = '';
      const t = empty.querySelector('.inbox-empty-title');
      const d = empty.querySelector('.inbox-empty-desc');
      if (t) t.textContent = 'Sin mensajes';
      if (d) d.textContent = 'No hay conversaciones activas.';
    }
    return;
  }

  if (empty) empty.style.display = 'none';
  users.forEach(u => panel.appendChild(_buildUserItem(u)));

  /* Restore selected highlight */
  if (chatState.selectedUserId) {
    _highlightUserItem(chatState.selectedUserId);
  }
}

/* Build a single user row in the left panel */
function _buildUserItem(u) {
  const item      = document.createElement('div');
  const isActive  = chatState.selectedUserId === String(u.userId);
  const hasUnread = (u.unreadCount || 0) > 0;

  item.className  = `inbox-user-item${isActive ? ' is-selected' : ''}${hasUnread ? ' is-unread' : ''}`;
  item.dataset.userId = String(u.userId);
  item.setAttribute('role', 'listitem');
  item.setAttribute('tabindex', '0');

  const initial  = (u.userEmail || '?').charAt(0).toUpperCase();
  const preview  = (u.lastMessage || '').slice(0, 60).replace(/\n/g, ' ');
  const hasMore  = (u.lastMessage || '').length > 60;
  const dateStr  = _fmtShort(u.lastDate);

  item.innerHTML = `
    <div class="inbox-user-top">
      <div class="inbox-user-left">
        <span class="inbox-item-avatar">${escapeHTML(initial)}</span>
        <div class="inbox-user-meta">
          <span class="inbox-user-email">${escapeHTML(u.userEmail || '—')}</span>
          <span class="inbox-user-role">${escapeHTML(u.role || 'client')}</span>
        </div>
      </div>
      <div class="inbox-user-right">
        <span class="inbox-item-date">${dateStr}</span>
        ${hasUnread ? `<span class="inbox-item-badge">${u.unreadCount}</span>` : ''}
      </div>
    </div>
    <p class="inbox-item-preview">${escapeHTML(preview)}${hasMore ? '…' : ''}</p>
  `;

  item.addEventListener('click',   () => openUserChat(u.userId));
  item.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') openUserChat(u.userId);
  });

  return item;
}

/* ─────────────────────────────────────────
   openUserChat(userId)
   Fetch conversation and show chat panel.
───────────────────────────────────────── */
async function openUserChat(userId) {
  const uid = String(userId);

  /* Stop previous polling */
  stopChatPolling();

  chatState.selectedUserId = uid;
  _highlightUserItem(uid);

  /* Show chat panel, hide empty state */
  const chatPanel  = document.getElementById('chat-panel');
  const detailEmpty = document.getElementById('inboxDetailEmpty');
  if (detailEmpty) detailEmpty.setAttribute('hidden', '');
  if (chatPanel)   chatPanel.removeAttribute('hidden');

  /* Set header info */
  const user = chatState.inboxUsers.find(u => String(u.userId) === uid);
  const email   = user?.userEmail || uid;
  const initial = email.charAt(0).toUpperCase();
  setText('chatAvatar',    initial);
  setText('chatUserEmail', email);
  setText('chatUserStatus', user?.role ? `Rol: ${user.role}` : 'Usuario');

  /* Show loading state */
  _chatShowLoading(true);

  try {
    const messages = await _fetchChatHistory(uid);
    renderMessages(messages);
  } catch (err) {
    console.error('[Chat] openUserChat error:', err);
    _chatShowError('No se pudo cargar la conversación.');
  }

  /* Start polling */
  startChatPolling(uid);
}

/* Fetch chat history from backend */
async function _fetchChatHistory(userId) {
  const res = await fetch(`${API_BASE}/messages/user/${userId}`, {
    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return Array.isArray(data) ? data : (data.messages || []);
}

/* ─────────────────────────────────────────
   renderMessages(messages)
   Render message bubbles in #chat-messages.
   USER messages → align left
   ADMIN messages → align right
───────────────────────────────────────── */
function renderMessages(messages) {
  const container = document.getElementById('chat-messages');
  if (!container) return;

  _chatShowLoading(false);
  container.innerHTML = '';

  if (!messages.length) {
    container.innerHTML = `
      <div class="chat-no-messages">
        <svg width="22" height="22" viewBox="0 0 16 16" fill="none">
          <path d="M2 3.5A1.5 1.5 0 0 1 3.5 2h9A1.5 1.5 0 0 1 14 3.5v7A1.5 1.5 0 0 1 12.5 12H9l-3 2.5V12H3.5A1.5 1.5 0 0 1 2 10.5v-7Z" stroke="currentColor" stroke-width="1"/>
        </svg>
        <p>Sin mensajes aún. ¡Sé el primero en escribir!</p>
      </div>`;
    return;
  }

  /* Group messages by date and render */
  let lastDate = null;
  messages.forEach(msg => {
    const msgDate = _dateKey(msg.createdAt || msg.date || msg.fecha);
    if (msgDate !== lastDate) {
      lastDate = msgDate;
      const divider = document.createElement('div');
      divider.className   = 'chat-date-divider';
      divider.textContent = _fmtDateLabel(msg.createdAt || msg.date || msg.fecha);
      container.appendChild(divider);
    }
    container.appendChild(_buildBubble(msg));
  });

  /* Scroll to bottom */
  container.scrollTop = container.scrollHeight;
}

/* Build a single message bubble */
function _buildBubble(msg) {
  const isAdmin  = msg.sender === 'admin' || msg.role === 'admin' || msg.isAdmin === true;
  const bubble   = document.createElement('div');
  bubble.className = `chat-bubble-wrap ${isAdmin ? 'chat-bubble-wrap--admin' : 'chat-bubble-wrap--user'}`;

  const timeStr = _fmtTime(msg.createdAt || msg.date || msg.fecha);
  const text    = msg.message || msg.mensaje || msg.content || '';

  bubble.innerHTML = `
    <div class="chat-bubble">
      <p class="chat-bubble-text">${escapeHTML(text)}</p>
      <span class="chat-bubble-time">${timeStr}</span>
    </div>`;
  return bubble;
}

/* ─────────────────────────────────────────
   sendAdminMessage()
   POST /api/messages/admin/reply
───────────────────────────────────────── */
async function sendAdminMessage() {
  if (!chatState.selectedUserId || chatState.sending) return;

  const input = document.getElementById('chat-input');
  const sendBtn = document.getElementById('chat-send');
  const message = (input?.value || '').trim();
  if (!message) return;

  chatState.sending = true;
  if (sendBtn) {
    sendBtn.disabled  = true;
    sendBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="1.4" stroke-dasharray="3 3"/></svg>`;
  }

  try {
    const res = await fetch(`${API_BASE}/messages/admin/reply`, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        Authorization:   `Bearer ${localStorage.getItem('token')}`,
      },
      body: JSON.stringify({
        userId:  chatState.selectedUserId,
        message: message,
      }),
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    /* Clear input */
    if (input) { input.value = ''; input.style.height = 'auto'; }

    /* Optimistically append to UI */
    const container = document.getElementById('chat-messages');
    const noMsgEl   = container?.querySelector('.chat-no-messages');
    if (noMsgEl) noMsgEl.remove();

    if (container) {
      const bubble = _buildBubble({
        message:   message,
        sender:    'admin',
        createdAt: new Date().toISOString(),
      });
      container.appendChild(bubble);
      container.scrollTop = container.scrollHeight;
    }

    /* Refresh inbox list (unread counts may change) */
    loadInbox();

  } catch (err) {
    console.error('[Chat] sendAdminMessage error:', err);
    _showChatNotification('Error al enviar el mensaje. Inténtalo de nuevo.', 'error');
  } finally {
    chatState.sending = false;
    if (sendBtn) {
      sendBtn.disabled  = false;
      sendBtn.innerHTML = `<svg width="15" height="15" viewBox="0 0 16 16" fill="none"><path d="M14 2L2 7.5L7 8.5M14 2L9 14L7 8.5M14 2L7 8.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    }
  }
}

/* ─────────────────────────────────────────
   startChatPolling(userId) / stopChatPolling()
   Every 5 s re-fetch chat if it's open.
───────────────────────────────────────── */
function startChatPolling(userId) {
  stopChatPolling();
  chatState.pollingInterval = setInterval(async () => {
    if (!chatState.selectedUserId) return;
    try {
      const messages = await _fetchChatHistory(chatState.selectedUserId);
      const container = document.getElementById('chat-messages');
      if (!container) return;
      /* Only re-render if count changed to avoid scroll jump */
      const currentCount = container.querySelectorAll('.chat-bubble-wrap').length;
      if (messages.length !== currentCount) {
        renderMessages(messages);
      }
    } catch (err) {
      console.error('[Chat] polling error:', err);
    }
  }, 5000);
}

function stopChatPolling() {
  if (chatState.pollingInterval) {
    clearInterval(chatState.pollingInterval);
    chatState.pollingInterval = null;
  }
}

/* ─────────────────────────────────────────
   initChatListeners()
   Wire send button, Enter key, close, refresh.
───────────────────────────────────────── */
function initChatListeners() {
  /* Send button */
  document.getElementById('chat-send')?.addEventListener('click', sendAdminMessage);

  /* Enter to send (Shift+Enter = newline) */
  document.getElementById('chat-input')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendAdminMessage();
    }
  });

  /* Auto-resize textarea */
  document.getElementById('chat-input')?.addEventListener('input', (e) => {
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  });

  /* Close chat panel */
  document.getElementById('chatCloseBtn')?.addEventListener('click', () => {
    stopChatPolling();
    chatState.selectedUserId = null;
    document.getElementById('chat-panel')?.setAttribute('hidden', '');
    document.getElementById('inboxDetailEmpty')?.removeAttribute('hidden');
    document.querySelectorAll('.inbox-user-item').forEach(el => el.classList.remove('is-selected'));
  });

  /* Refresh inbox */
  document.getElementById('btnRefreshMessages')?.addEventListener('click', () => {
    loadInbox();
    if (chatState.selectedUserId) {
      _fetchChatHistory(chatState.selectedUserId)
        .then(renderMessages)
        .catch(err => console.error('[Chat] refresh error:', err));
    }
  });
}

/* ── Helpers ── */

function _highlightUserItem(userId) {
  document.querySelectorAll('.inbox-user-item').forEach(el => {
    el.classList.toggle('is-selected', el.dataset.userId === String(userId));
  });
}

function _chatSetListLoading(isLoading) {
  const empty = document.getElementById('inboxEmptyState');
  if (!empty) return;
  if (isLoading) {
    empty.style.display = '';
    const t = empty.querySelector('.inbox-empty-title');
    const d = empty.querySelector('.inbox-empty-desc');
    if (t) t.textContent = 'Cargando…';
    if (d) d.textContent = 'Obteniendo conversaciones del servidor.';
  }
}

function _chatShowListError(msg) {
  const empty = document.getElementById('inboxEmptyState');
  if (!empty) return;
  empty.style.display = '';
  const t = empty.querySelector('.inbox-empty-title');
  const d = empty.querySelector('.inbox-empty-desc');
  if (t) t.textContent = 'Error';
  if (d) d.textContent = msg;
}

function _chatShowLoading(show) {
  const loading   = document.getElementById('chatLoading');
  const container = document.getElementById('chat-messages');
  if (!loading || !container) return;
  loading.style.display = show ? 'flex' : 'none';
}

function _chatShowError(msg) {
  _chatShowLoading(false);
  const container = document.getElementById('chat-messages');
  if (!container) return;
  container.innerHTML = `<div class="chat-no-messages chat-error"><p>${escapeHTML(msg)}</p></div>`;
}

function _showChatNotification(msg, type = 'info') {
  const existing = document.getElementById('chatNotification');
  if (existing) existing.remove();

  const el = document.createElement('div');
  el.id        = 'chatNotification';
  el.className = `chat-notification chat-notification--${type}`;
  el.textContent = msg;
  document.getElementById('chat-panel')?.appendChild(el);
  setTimeout(() => el.remove(), 4000);
}

function _dateKey(dateStr) {
  if (!dateStr) return '';
  try { return new Date(dateStr).toDateString(); } catch { return ''; }
}

function _fmtDateLabel(dateStr) {
  if (!dateStr) return '';
  try {
    const d    = new Date(dateStr);
    const diff = Math.floor((Date.now() - d) / 86400000);
    if (diff === 0) return 'Hoy';
    if (diff === 1) return 'Ayer';
    return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' });
  } catch { return ''; }
}

function _fmtTime(dateStr) {
  if (!dateStr) return '';
  try {
    return new Date(dateStr).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  } catch { return ''; }
}

function truncateText(value, maxLength = 72) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, Math.max(0, maxLength - 1)).trim()}…`;
}

function renderAdminOverviewUsers(errorMessage = '') {
  const body = document.getElementById('adminOverviewUsersBody');
  if (!body) return;

  if (currentUser.role === 'admin') {
    const users = adminOverviewState.users;
    if (errorMessage) {
      body.innerHTML = `<tr class="admin-overview-empty-row"><td colspan="4">${escapeHTML(errorMessage)}</td></tr>`;
      return;
    }

    if (!users.length) {
      body.innerHTML = '<tr class="admin-overview-empty-row"><td colspan="4">No hay usuarios para mostrar.</td></tr>';
      return;
    }

    if (!adminOverviewState.selectedUserId) {
      adminOverviewState.selectedUserId = String(users[0].id || '');
    }

    body.innerHTML = users.map((user) => {
      const userId = String(user.id || '');
      const summary = adminOverviewState.inboxUsers.find((item) => String(item.userId) === userId);
      const unreadCount = summary?.unreadCount || 0;
      const messageState = unreadCount > 0
        ? `<span class="admin-overview-chip admin-overview-chip--unread">${unreadCount} nuevo${unreadCount > 1 ? 's' : ''}</span>`
        : `<span class="admin-overview-chip admin-overview-chip--idle">${summary ? 'Conversación' : 'Sin mensajes'}</span>`;

      return `
        <tr class="admin-overview-row ${adminOverviewState.selectedUserId === userId ? 'is-selected' : ''}" data-admin-user-id="${escapeHTML(userId)}">
          <td>
            <div class="admin-overview-user">
              <span class="admin-overview-user__avatar">${escapeHTML((user.name || '?').charAt(0).toUpperCase())}</span>
              <div class="admin-overview-user__meta">
                <span class="admin-overview-user__name">${escapeHTML(user.name || 'Usuario')}</span>
                <span class="admin-overview-user__hint">Pulsa para gestionar</span>
              </div>
            </div>
          </td>
          <td>${escapeHTML(user.email || '—')}</td>
          <td><span class="admin-overview-chip ${user.role === 'admin' ? 'admin-overview-chip--admin' : 'admin-overview-chip--user'}">${escapeHTML(user.role || 'client')}</span></td>
          <td>${messageState}</td>
        </tr>`;
    }).join('');

    body.querySelectorAll('[data-admin-user-id]').forEach((row) => {
      row.addEventListener('click', () => {
        adminOverviewState.selectedUserId = row.dataset.adminUserId;
        renderAdminOverviewUsers();
        renderAdminOverviewDetail();
      });
    });

    renderAdminOverviewDetail();
    return;
  }

  /* ──────────────────────────────────────────────────────
     Render cliente: inbox compacto con expansión INLINE.
     Sin panel detalle aparte — la fila se abre dentro
     de la propia tabla mostrando el hilo cacheado.
     ────────────────────────────────────────────────────── */
  const messages = adminOverviewState.userMessages;
  body.classList.add('is-client-inbox');

  if (errorMessage) {
    body.innerHTML = `<tr class="admin-overview-empty-row"><td colspan="3">${escapeHTML(errorMessage)}</td></tr>`;
    return;
  }

  if (!messages.length) {
    body.innerHTML = '<tr class="admin-overview-empty-row"><td colspan="3">Todavía no has enviado mensajes desde contacto.</td></tr>';
    return;
  }

  // Por defecto NADA expandido — el usuario decide al pulsar.
  const expandedId = String(adminOverviewState.selectedMessageId || '');
  const anyExpanded = Boolean(expandedId);

  body.innerHTML = messages.map((item) => {
    const messageId   = String(item.id || '');
    const isExpanded  = messageId === expandedId;
    const isDimmed    = anyExpanded && !isExpanded;
    const statusClass = item.responded ? 'admin-overview-chip--responded' : 'admin-overview-chip--pending';
    const statusLabel = item.responded ? 'Respondido' : 'Sin responder';
    const hint        = item.responded ? 'Respuesta disponible · pulsa para abrir' : 'Pendiente de respuesta · pulsa para abrir';

    const rowClasses = [
      'admin-overview-row',
      'client-inbox-row',
      isExpanded ? 'is-expanded' : '',
      isDimmed   ? 'is-dimmed'   : '',
    ].filter(Boolean).join(' ');

    return `
      <tr class="${rowClasses}" data-user-message-id="${escapeHTML(messageId)}">
        <td>
          <div class="client-inbox-row__msg">
            <span class="client-inbox-row__preview">${escapeHTML(truncateText(item.preview || 'Mensaje sin contenido', 88))}</span>
            <span class="client-inbox-row__hint">${escapeHTML(hint)}</span>
          </div>
        </td>
        <td class="client-inbox-row__date">${escapeHTML(formatDate(item.fecha))}</td>
        <td><span class="admin-overview-chip ${statusClass}">${statusLabel}</span></td>
      </tr>
      <tr class="client-inbox-thread-row ${isDimmed ? 'is-dimmed' : ''}" data-thread-for="${escapeHTML(messageId)}" ${isExpanded ? '' : 'hidden'}>
        <td colspan="3">
          <div class="client-inbox-thread" data-thread-content="${escapeHTML(messageId)}">
            ${isExpanded ? '<div class="client-inbox-thread__loading">Cargando…</div>' : ''}
          </div>
        </td>
      </tr>`;
  }).join('');

  body.querySelectorAll('[data-user-message-id]').forEach((row) => {
    row.addEventListener('click', () => toggleClientInboxThread(row.dataset.userMessageId));
  });

  // Si había uno expandido, cargar (o repintar desde cache) su contenido.
  if (expandedId) loadClientInboxThread(expandedId);
}

/* ── Toggle expansión inline (cliente) ── */
function toggleClientInboxThread(messageId) {
  const id      = String(messageId || '');
  const current = String(adminOverviewState.selectedMessageId || '');
  adminOverviewState.selectedMessageId = (current === id) ? null : id;
  renderAdminOverviewUsers();
}

/* ── Carga del hilo (con cache) y render dentro de la fila expandida ── */
adminOverviewState.threadsCache = adminOverviewState.threadsCache || {};

async function loadClientInboxThread(messageId) {
  const target = document.querySelector(`[data-thread-content="${cssEscape(messageId)}"]`);
  if (!target) return;

  const cached = adminOverviewState.threadsCache[messageId];
  if (cached) {
    target.innerHTML = buildClientInboxThreadHTML(cached);
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/messages/me/${messageId}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const thread = data.thread || null;
    if (!thread) throw new Error('empty');
    adminOverviewState.threadsCache[messageId] = thread;
    target.innerHTML = buildClientInboxThreadHTML(thread);
  } catch (err) {
    console.error('[clientInbox] thread load error:', err.message);
    target.innerHTML = '<div class="client-inbox-thread__error">No se pudo cargar el mensaje.</div>';
  }
}

function buildClientInboxThreadHTML(thread) {
  const responses = Array.isArray(thread.responses) ? thread.responses : [];
  const repliesHTML = responses.length
    ? responses.map((r) => `
        <div class="client-inbox-thread__reply">
          <div class="client-inbox-thread__head">
            <span class="client-inbox-thread__author">Respuesta del estudio</span>
            <span class="client-inbox-thread__time">${escapeHTML(formatDate(r.fecha))}</span>
          </div>
          <p class="client-inbox-thread__body">${escapeHTML(r.mensaje || '—')}</p>
        </div>`).join('')
    : '<div class="client-inbox-thread__pending">Aún sin respuesta.</div>';

  return `
    <div class="client-inbox-thread__mine">
      <div class="client-inbox-thread__head">
        <span class="client-inbox-thread__author">Tu mensaje</span>
        <span class="client-inbox-thread__time">${escapeHTML(formatDate(thread.fecha))}</span>
      </div>
      <p class="client-inbox-thread__body">${escapeHTML(thread.mensaje || '—')}</p>
    </div>
    ${repliesHTML}`;
}

/* Util: CSS.escape polyfill mínimo para IDs Mongo (a-z0-9). */
function cssEscape(value) {
  if (window.CSS && typeof window.CSS.escape === 'function') return window.CSS.escape(value);
  return String(value).replace(/[^a-zA-Z0-9_-]/g, '\\$&');
}

async function renderAdminOverviewDetail() {
  const emptyEl = document.getElementById('adminOverviewDetailEmpty');
  const detailEl = document.getElementById('adminOverviewDetail');
  if (!emptyEl || !detailEl) return;

  /* Cliente: el panel inferior se ha eliminado a favor de la
     expansión inline. No hay nada que renderizar aquí. */
  if (currentUser.role !== 'admin') {
    return;
  }

  if (currentUser.role === 'admin') {
    const selectedId = String(adminOverviewState.selectedUserId || '');
    const user = adminOverviewState.users.find((item) => String(item.id) === selectedId);

    if (!user) {
      emptyEl.removeAttribute('hidden');
      detailEl.setAttribute('hidden', '');
      detailEl.innerHTML = '';
      return;
    }

    const member = adminOverviewState.members.find((item) => String(item.id) === selectedId);
    const summary = adminOverviewState.inboxUsers.find((item) => String(item.userId) === selectedId);

    emptyEl.setAttribute('hidden', '');
    detailEl.removeAttribute('hidden');
    detailEl.innerHTML = `
      <div class="admin-overview-detail__hero">
        <span class="admin-overview-panel__eyebrow">Usuario seleccionado</span>
        <div class="admin-overview-detail__name">${escapeHTML(user.name || 'Usuario')}</div>
        <div class="admin-overview-detail__email">${escapeHTML(user.email || '—')}</div>
      </div>

      <div class="admin-overview-detail__grid">
        <div class="admin-overview-detail__item">
          <span class="admin-overview-detail__label">Rol</span>
          <span class="admin-overview-detail__value">${escapeHTML(user.role || 'client')}</span>
        </div>
        <div class="admin-overview-detail__item">
          <span class="admin-overview-detail__label">Mensajes pendientes</span>
          <span class="admin-overview-detail__value">${summary?.unreadCount || 0}</span>
        </div>
        <div class="admin-overview-detail__item">
          <span class="admin-overview-detail__label">Membresía</span>
          <span class="admin-overview-detail__value">${member ? (member.active ? 'Activa' : 'Inactiva') : 'Sin datos'}</span>
        </div>
        <div class="admin-overview-detail__item">
          <span class="admin-overview-detail__label">Último mensaje</span>
          <span class="admin-overview-detail__value">${escapeHTML(summary?.lastDate ? formatDate(summary.lastDate) : 'Sin actividad')}</span>
        </div>
      </div>

      <div class="admin-overview-actions">
        <button class="admin-overview-action" data-nav="adminUsuarios">Abrir ficha de usuario</button>
        <button class="admin-overview-action" data-nav="adminMessages">Abrir conversación</button>
        <button class="admin-overview-action" data-nav="adminClub">Gestionar membresía</button>
      </div>`;
    return;
  }

  const selectedId = String(adminOverviewState.selectedMessageId || '');
  if (!selectedId) {
    emptyEl.removeAttribute('hidden');
    detailEl.setAttribute('hidden', '');
    detailEl.innerHTML = '';
    return;
  }

  emptyEl.setAttribute('hidden', '');
  detailEl.removeAttribute('hidden');
  detailEl.innerHTML = `
    <div class="admin-overview-detail__hero">
      <span class="admin-overview-panel__eyebrow">Detalle del mensaje</span>
      <div class="admin-overview-detail__name">Cargando detalle…</div>
      <div class="admin-overview-detail__email">${escapeHTML(currentUser.email || '—')}</div>
    </div>`;

  try {
    const res = await fetch(`${API_BASE}/messages/me/${selectedId}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json();
    const thread = data.thread || null;
    if (!thread) throw new Error('Thread vacío');

    const statusLabel = thread.responded ? 'Respondido' : 'Sin responder';
    const statusClass = thread.responded ? 'admin-overview-chip--responded' : 'admin-overview-chip--pending';
    const responsesHTML = thread.responses?.length
      ? thread.responses.map((response) => `
          <article class="message-thread-block message-thread-block--reply">
            <div class="message-thread-block__head">
              <span class="message-thread-block__label">Respuesta del admin</span>
              <span class="message-thread-block__date">${escapeHTML(formatDate(response.fecha))}</span>
            </div>
            <p class="message-thread-block__body">${escapeHTML(response.mensaje || 'Sin contenido')}</p>
          </article>`).join('')
      : `
          <div class="message-thread-empty">
            Aún no hay respuesta a este mensaje.
          </div>`;

    detailEl.innerHTML = `
      <div class="admin-overview-detail__hero">
        <span class="admin-overview-panel__eyebrow">Detalle del mensaje</span>
        <div class="admin-overview-detail__name">${thread.responded ? 'Has recibido una respuesta' : 'Mensaje enviado'}</div>
        <div class="admin-overview-detail__email">${escapeHTML(formatDate(thread.fecha))}</div>
      </div>

      <div class="admin-overview-detail__grid">
        <div class="admin-overview-detail__item">
          <span class="admin-overview-detail__label">Estado</span>
          <span class="admin-overview-detail__value"><span class="admin-overview-chip ${statusClass}">${statusLabel}</span></span>
        </div>
        <div class="admin-overview-detail__item">
          <span class="admin-overview-detail__label">Respuesta</span>
          <span class="admin-overview-detail__value">${thread.responded ? 'Disponible' : 'Pendiente'}</span>
        </div>
      </div>

      ${thread.responded ? `<div class="message-thread-notice">${escapeHTML(thread.aviso || 'Tienes una respuesta del administrador')}</div>` : ''}

      <article class="message-thread-block">
        <div class="message-thread-block__head">
          <span class="message-thread-block__label">Mensaje enviado</span>
          <span class="message-thread-block__date">${escapeHTML(formatDate(thread.fecha))}</span>
        </div>
        <p class="message-thread-block__body">${escapeHTML(thread.mensaje || 'Sin contenido')}</p>
      </article>

      ${responsesHTML}`;
  } catch (err) {
    console.error('[Overview] renderAdminOverviewDetail error:', err);
    emptyEl.removeAttribute('hidden');
    detailEl.setAttribute('hidden', '');
    detailEl.innerHTML = '';
    const emptyText = emptyEl.querySelector('p');
    if (emptyText) emptyText.textContent = 'No se pudo cargar el detalle del mensaje';
  }
}

/* ══════════════════════════════════════════════════════
   SUSCRIPCIÓN — cancelar cuenta y eliminar cuenta
   Se inyecta dinámicamente tras la tarjeta de membresía.
══════════════════════════════════════════════════════ */
async function loadSubscriptionActions() {
  let container = document.getElementById('subscriptionActions');
  if (!container) {
    const anchor = document.getElementById('membershipActive')
                || document.getElementById('membershipInactive');
    if (!anchor) return;
    container = document.createElement('div');
    container.id = 'subscriptionActions';
    anchor.insertAdjacentElement('afterend', container);
  }

  let subscription = null;
  try {
    const res = await fetch(`${API_BASE}/user/subscription`, {
      headers: getAuthHeaders(),
    });
    if (res.ok) {
      const data = await res.json();
      subscription = data.subscription || null;
    }
  } catch { /* sin backend → silencio */ }

  _renderSubscriptionActions(container, subscription);
}

function _renderSubscriptionActions(container, sub) {
  const isActive = Boolean(sub?.active);
  container.innerHTML = `
    <div style="margin-top:1.25rem;padding:1.25rem 1.5rem;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);border-radius:10px;">
      <p style="font-size:.75rem;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:rgba(255,255,255,.4);margin:0 0 .6rem;">Suscripción</p>
      <p style="font-size:.9rem;color:rgba(255,255,255,.7);margin:0 0 1rem;">
        Estado: <strong style="color:#fff">${isActive ? 'Activa' : 'Inactiva'}</strong>
        ${isActive && sub?.renewal ? ` · Renovación: <strong style="color:#fff">${formatDate(sub.renewal)}</strong>` : ''}
      </p>
      <div style="display:flex;gap:.6rem;flex-wrap:wrap;">
        ${isActive ? `<button id="btnCancelSub" style="padding:.45rem 1rem;border-radius:6px;font-size:.82rem;font-weight:600;cursor:pointer;background:rgba(255,255,255,.07);color:rgba(255,255,255,.8);border:1px solid rgba(255,255,255,.1);">Cancelar suscripción</button>` : ''}
        <button id="btnDeleteAccount" style="padding:.45rem 1rem;border-radius:6px;font-size:.82rem;font-weight:600;cursor:pointer;background:rgba(229,40,30,.1);color:#e5281e;border:1px solid rgba(229,40,30,.2);">Eliminar mi cuenta</button>
      </div>
    </div>`;

  document.getElementById('btnCancelSub')?.addEventListener('click', async () => {
    if (!confirm('¿Seguro que quieres cancelar tu suscripción?')) return;
    const btn = document.getElementById('btnCancelSub');
    if (btn) { btn.disabled = true; btn.textContent = '…'; }
    try {
      const res = await fetch(`${API_BASE}/user/cancel-subscription`, {
        method: 'POST', headers: getAuthHeaders(),
      });
      if (res.ok) {
        await Promise.allSettled([loadMembership(), loadSubscriptionActions()]);
      } else {
        const d = await res.json();
        alert(d.error || 'Error al cancelar');
        if (btn) { btn.disabled = false; btn.textContent = 'Cancelar suscripción'; }
      }
    } catch {
      alert('Error de conexión');
      if (btn) { btn.disabled = false; btn.textContent = 'Cancelar suscripción'; }
    }
  });

  document.getElementById('btnDeleteAccount')?.addEventListener('click', async () => {
    if (!confirm('¿Seguro que quieres eliminar tu cuenta? Esta acción es irreversible.')) return;
    const btn = document.getElementById('btnDeleteAccount');
    if (btn) { btn.disabled = true; btn.textContent = '…'; }
    try {
      const res = await fetch(`${API_BASE}/user/delete-account`, {
        method: 'DELETE', headers: getAuthHeaders(),
      });
      if (res.ok) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/src/pages/loginRegistro/login.html';
      } else {
        const d = await res.json();
        alert(d.error || 'Error al eliminar cuenta');
        if (btn) { btn.disabled = false; btn.textContent = 'Eliminar mi cuenta'; }
      }
    } catch {
      alert('Error de conexión');
      if (btn) { btn.disabled = false; btn.textContent = 'Eliminar mi cuenta'; }
    }
  });
}