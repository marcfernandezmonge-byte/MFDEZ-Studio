/* ================================================================
   1. DEPTH FIELD HERO — cinematic scroll physics
================================================================ */
(function DepthField() {

  const canvas = document.getElementById('tunnelCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  let W = 0, H = 0;

  /* ────────────────────────────────────────────
     CONSTANTES
  ────────────────────────────────────────────── */
  const RING_COUNT           = 18;
  const TUNNEL_DEPTH         = 2000;
  const FOV                  = 500;
  const MIN_SIDES            = 3;
  const MAX_SIDES            = 8;
  const MORPH_CYCLE          = 10000;
  const PARTICLE_COUNT       = 80;
  const LOGO_FOCAL_Z         = 80;
  const MAX_TETRAS           = 4;

  // ── Motor de física ──
  const HERO_SCROLL_DISTANCE = 2400;  // px virtuales para completar heroProgress 0→1
  const FRICTION             = 0.91;  // fricción por frame (sobre dt normalizado)
  const ACCELERATION         = 0.22;  // input → velocity
  const DRIFT_STRENGTH       = 14;    // amplitud del camera drift en px
  const FOG_BASE             = 0.0012;
  const FOG_MAX              = 0.0038;
  const MOMENTUM_SCALE       = 0.55;  // cuánto del velocity se transfiere al scroll real

  /* ────────────────────────────────────────────
     ESTADO GLOBAL
  ────────────────────────────────────────────── */
  let time = 0, lastTime = 0, rotation = 0;
  let mouseX = 0, mouseY = 0;
  let focalX = 0, focalY = 0;        // punto de fuga (cursor + drift)
  let lightPulse = 0;

  // ── Motor de física ──────────────────────────
  let scrollInput    = 0;    // input crudo acumulado (wheel delta)
  let scrollVelocity = 0;    // velocidad física actual
  let scrollPosition = 0;    // posición virtual 0 → HERO_SCROLL_DISTANCE
  let heroProgress   = 0;    // narrativa 0 → 1
  let visualScroll   = 0;    // alimenta el túnel (cíclico, no acotado)

  // ── Camera drift ─────────────────────────────
  let cameraOffsetX  = 0;
  let cameraOffsetY  = 0;

  // ── Fog dinámico ─────────────────────────────
  let fogDensity     = FOG_BASE;

  // ── Lock / unlock ────────────────────────────
  let heroLocked     = false;   // se activa en init cuando el hero es visible
  let heroCompleted  = false;   // true cuando heroProgress alcanza 1
  let heroEl         = null;

  // ── Touch tracking ───────────────────────────
  let touchStartY    = 0;
  let touchLastY     = 0;

  // ── PATCH v5: Logo fill system ───────────────
  // Sistema de partículas internas que rellenan la silueta del logo
  // con una onda que parte desde el centro hacia los bordes.
  // Totalmente reversible: depende exclusivamente de heroProgress.
  const LOGO_FILL_START    = 0.32;   // heroProgress donde comienza el relleno
  const LOGO_FILL_END      = 0.55;   // heroProgress = logo 100% blanco
  const LOGO_FILL_WAVE     = 0.002;  // velocidad de onda: mayor dist. = mayor delay
  const LOGO_FILL_COUNT    = 600;    // total de partículas de relleno
  const LOGO_FILL_JITTER_Z = 16;     // jitter en Z para volumen orgánico

  // Centro del logo en espacio del túnel (se calcula en buildLogoFill)
  let logoFillCenterX = 0;
  let logoFillCenterY = 0;

  // Array de partículas de relleno
  // Cada partícula: { x, y, jitterZ, waveDelay, r, progress }
  let logoFillParticles = [];

  /* ────────────────────────────────────────────
     HELPERS
  ────────────────────────────────────────────── */
  const clamp    = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const norm     = (v, a, b)   => clamp((v - a) / (b - a), 0, 1);
  const easeOut3 = t => 1 - Math.pow(1 - t, 3);
  const easeOut5 = t => 1 - Math.pow(1 - t, 5);
  const easeIn3  = t => t * t * t;
  const easeIn5  = t => t * t * t * t * t;
  const lerp     = (a, b, t) => a + (b - a) * t;

  /* ────────────────────────────────────────────
     PROYECCIÓN 3D → 2D
  ────────────────────────────────────────────── */
  function project(x, y, z) {
    const scale = FOV / (FOV + Math.max(z, -FOV + 1));
    return { x: focalX + x * scale, y: focalY + y * scale, scale };
  }

  /* ────────────────────────────────────────────
     FOG — usa fogDensity dinámica
  ────────────────────────────────────────────── */
  const fog = z => Math.max(0, Math.exp(-Math.max(z, 0) * fogDensity));

  /* ────────────────────────────────────────────
     RESIZE
  ────────────────────────────────────────────── */
  function resize() {
    W = canvas.width  = canvas.offsetWidth;
    H = canvas.height = canvas.offsetHeight;
    computeLogoSegs();
    assignSegsToNodes();
    buildLogoFill();  // PATCH v5: reconstruir partículas de fill al cambiar dimensiones
  }
  window.addEventListener('resize', resize);

  /* ════════════════════════════════════════════
     MOTOR DE FÍSICA — NUEVAS FUNCIONES
  ════════════════════════════════════════════ */

  /**
   * lockHeroScroll
   * Activa el modo captura: el hero intercepta wheel y touch.
   * El scroll real de la página queda congelado.
   */
  function lockHeroScroll() {
    if (heroLocked) return;
    heroLocked = true;
    document.body.style.overflow = 'hidden';
  }

  /**
   * unlockHeroScroll
   * Libera el scroll de la página.
   * Transfiere el momentum acumulado al scroll real (momentum release).
   */
  function unlockHeroScroll() {
    if (!heroLocked) return;
    heroLocked = false;
    document.body.style.overflow = '';

    // Momentum release: transferir velocidad residual al scroll de página
    if (scrollVelocity > 1) {
      const release = scrollVelocity * MOMENTUM_SCALE;
      // Ejecutar en el siguiente frame para evitar conflicto con el event actual
      requestAnimationFrame(() => window.scrollBy({ top: release, behavior: 'auto' }));
    }
    scrollVelocity = 0;
    scrollInput    = 0;
  }

  /**
   * handleHeroWheel — PATCH v5: acepta input negativo (scroll hacia arriba)
   * Si heroCompleted Y la dirección es hacia adelante, pasar al scroll real.
   * Si la dirección es hacia atrás (rewind), capturar siempre.
   */
  function handleHeroWheel(e) {
    const raw = e.deltaMode === 1 ? e.deltaY * 20 : e.deltaY;

    // PATCH hardening: una vez completado el hero, NUNCA volver a capturar.
    // Evita el bug "enganchado al hero" al hacer scroll arriba rápidamente.
    if (heroCompleted) return;

    e.preventDefault();
    scrollInput += raw * ACCELERATION;
  }

  /**
   * handleHeroTouchStart / Move — PATCH v5: acepta movimiento hacia arriba
   */
  function handleHeroTouchStart(e) {
    touchStartY = touchLastY = e.touches[0].clientY;
  }

  function handleHeroTouchMove(e) {
    // PATCH hardening: una vez completado el hero, no capturar más touch.
    if (heroCompleted) return;

    const dy = touchLastY - e.touches[0].clientY;
    e.preventDefault();
    scrollInput += dy * ACCELERATION * 2.5;
    touchLastY   = e.touches[0].clientY;
  }

  /**
   * updateScrollPhysics — PATCH v5: bidireccional + hero rewind
   *
   * CAMBIOS:
   *  - Eliminada restricción `Math.max(0, scrollVelocity)`.
   *    El scroll puede ir hacia adelante y hacia atrás.
   *  - scrollPosition se clampea en [0, HERO_SCROLL_DISTANCE]:
   *    no puede salir del rango narrativo del hero.
   *  - visualScroll acepta delta positivo o negativo:
   *    el túnel puede retroceder visualmente.
   *  - heroCompleted se resetea cuando heroProgress baja de 0.95
   *    para permitir re-entrar al hero haciendo scroll hacia arriba.
   *  - El lock se restaura si heroProgress baja por debajo de 1.
   */
  function updateScrollPhysics(dt) {
    const dtNorm = dt / 16;

    // Acumular input en velocity (sin restricción de signo)
    scrollVelocity += scrollInput;
    scrollInput     = 0;

    // Fricción simétrica
    scrollVelocity *= Math.pow(FRICTION, dtNorm);
    if (Math.abs(scrollVelocity) < 0.05) scrollVelocity = 0;

    // delta: positivo = avance, negativo = retroceso
    const delta = scrollVelocity;

    // Actualizar posición virtual — clamp en [0, HERO_SCROLL_DISTANCE]
    scrollPosition = clamp(
      scrollPosition + delta * dtNorm,
      0,
      HERO_SCROLL_DISTANCE
    );

    // heroProgress derivado de scrollPosition
    heroProgress = clamp(scrollPosition / HERO_SCROLL_DISTANCE, 0, 1);

    // visualScroll bidireccional — el túnel responde al sentido del scroll
    // Se usa Math.abs para el decaimiento pero se aplica el signo del delta
    visualScroll += delta * dtNorm * 0.32;
    // Fricción sobre visualScroll: mayor cuando hay retroceso para evitar mareo
    const vsFriction = delta < 0 ? 0.82 : 0.88;
    visualScroll *= Math.pow(vsFriction, dtNorm);
    // Clamp suave: no permitir valores extremadamente negativos
    visualScroll = Math.max(visualScroll, -6);

    // Detectar fin del hero (primera vez que llega a 1)
    if (heroProgress >= 1 && !heroCompleted) {
      heroCompleted = true;
      unlockHeroScroll();
    }

    // PATCH hardening: el rewind-relock se ha eliminado.
    // Causaba que la página quedara "enganchada" al volver rápido al hero.
    // Una vez completado, el hero deja de capturar input definitivamente.
  }

  /**
   * updateTunnelMotion
   * Camera drift procedural — movimiento orgánico del punto de fuga.
   * Combina posición del cursor con una onda sinusoidal suave.
   */
  function updateTunnelMotion(dt) {
    const dtNorm   = dt / 16;
    const t        = time / 1000;  // tiempo en segundos

    // Drift sinusoidal — frecuencias ligeramente distintas en X e Y
    // para que el movimiento nunca sea perfectamente circular
    const driftX = Math.sin(t * 0.28) * DRIFT_STRENGTH * (0.5 + visualScroll * 0.04);
    const driftY = Math.cos(t * 0.19) * DRIFT_STRENGTH * (0.5 + visualScroll * 0.03);

    cameraOffsetX += (driftX - cameraOffsetX) * 0.035 * dtNorm;
    cameraOffsetY += (driftY - cameraOffsetY) * 0.035 * dtNorm;

    // Punto de fuga = cursor (con inercia) + drift procedural
    const targetX = (mouseX || W * 0.5) + cameraOffsetX;
    const targetY = (mouseY || H * 0.5) + cameraOffsetY;

    focalX += (targetX - focalX) * 0.04 * dtNorm;
    focalY += (targetY - focalY) * 0.04 * dtNorm;

    // Limitar desplazamiento máximo del punto de fuga
    const maxD = W * 0.26, maxDy = H * 0.26;
    focalX = W*0.5 + Math.max(-maxD,  Math.min(maxD,  focalX - W*0.5));
    focalY = H*0.5 + Math.max(-maxDy, Math.min(maxDy, focalY - H*0.5));
  }

  /**
   * updateFogDensity
   * Fog dinámico — aumenta con la velocidad para simular hiper-velocidad.
   */
  function updateFogDensity() {
    const velocityFactor = clamp(Math.abs(scrollVelocity) / 40, 0, 1);
    const targetFog      = lerp(FOG_BASE, FOG_MAX, easeIn3(velocityFactor));
    fogDensity           = lerp(fogDensity, targetFog, 0.08);
  }

  /* ════════════════════════════════════════════
     CAPA 2 — ANILLOS
  ════════════════════════════════════════════ */
  function polyVerts(cx, cy, r, sides, aOff) {
    const n = Math.ceil(sides), v = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + aOff;
      v.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
    }
    return v;
  }

  const rings = Array.from({ length: RING_COUNT }, (_, i) => ({
    z:        (i / RING_COUNT) * TUNNEL_DEPTH,
    phase:    (i / RING_COUNT) * Math.PI * 2,
    vertices: [],
    projX: 0, projY: 0, projScale: 1,
  }));

  function updateRings(dt) {
    const speed = visualScroll * 0.32;

    for (const r of rings) {
      r.z -= speed * dt * 0.06;

      // Reciclado cíclico — túnel infinito
      if (r.z < -(FOV * 0.5)) {
        r.z += TUNNEL_DEPTH;
        r.phase    = Math.random() * Math.PI * 2;
        r.vertices = [];
      }

      const morphT = (time / MORPH_CYCLE + r.phase / (Math.PI * 2)) % 1;
      const sides  = MIN_SIDES + (MAX_SIDES - MIN_SIDES) * (0.5 + 0.5 * Math.sin(morphT * Math.PI * 2));
      const radius = Math.min(W, H) * 0.35 * (1 - (r.z / TUNNEL_DEPTH) * 0.5);
      const f      = fog(r.z);
      const op     = f * (0.25 + lightPulse * 0.55);

      if (op < 0.01) { r.vertices = []; continue; }

      const proj = project(0, 0, r.z);
      r.projX = proj.x; r.projY = proj.y; r.projScale = proj.scale;

      const verts = polyVerts(proj.x, proj.y, radius * proj.scale, sides, rotation + r.phase * 0.1);
      r.vertices  = verts;
      if (verts.length < 2) continue;

      ctx.beginPath();
      ctx.moveTo(verts[0].x, verts[0].y);
      for (let i = 1; i < verts.length; i++) ctx.lineTo(verts[i].x, verts[i].y);
      ctx.closePath();
      const b = Math.floor(lerp(155, 255, lightPulse));
      ctx.strokeStyle = `rgba(${b},${b},${b},${op})`;
      ctx.lineWidth   = Math.max(0.3, proj.scale * 1.2);
      ctx.stroke();

      // Nodos accent
      if (lightPulse > 0.55 && f > 0.22) {
        const no = ((lightPulse - 0.55) / 0.45) * f;
        ctx.fillStyle = `rgba(0,143,245,${no * 0.85})`;
        for (const v of verts) {
          ctx.beginPath();
          ctx.arc(v.x, v.y, 1.5 * proj.scale, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Motion stretch
      if (visualScroll > 5) {
        const so = Math.min(visualScroll / 30, 0.28) * f;
        const sv = polyVerts(proj.x, proj.y + visualScroll * 0.35 * proj.scale, radius * proj.scale * 0.94, sides, rotation + r.phase * 0.1);
        if (sv.length >= 2) {
          ctx.beginPath();
          ctx.moveTo(sv[0].x, sv[0].y);
          for (const s of sv) ctx.lineTo(s.x, s.y);
          ctx.closePath();
          ctx.strokeStyle = `rgba(255,255,255,${so})`;
          ctx.lineWidth   = 0.4;
          ctx.stroke();
        }
      }
    }
  }

  /* ════════════════════════════════════════════
     CAPA 1 — PARTÍCULAS con parallax de profundidad
  ════════════════════════════════════════════ */
  const particles = Array.from({ length: PARTICLE_COUNT }, () => makeParticle(true));

  function makeParticle(init) {
    const sp = Math.min(W || 800, H || 600) * 0.42;
    return {
      x:    (Math.random() - 0.5) * sp,
      y:    (Math.random() - 0.5) * sp,
      z:    init ? Math.random() * TUNNEL_DEPTH : TUNNEL_DEPTH,
      size: 0.5 + Math.random() * 1.5,
      dx:   (Math.random() - 0.5) * 0.008,
      dy:   (Math.random() - 0.5) * 0.008,
    };
  }

  function updateParticles(dt) {
    const speed   = visualScroll * 0.32;
    const warping = visualScroll > 8;

    for (const p of particles) {
      // PATCH: parallax de profundidad
      // Partículas más cercanas al usuario (z pequeño) avanzan más rápido
      const depthFactor = 1 + (1 - p.z / TUNNEL_DEPTH) * 0.55;
      p.z -= speed * dt * 0.06 * depthFactor;
      p.x += p.dx * dt;
      p.y += p.dy * dt;

      if (p.z < -(FOV * 0.5)) Object.assign(p, makeParticle(false));

      const f = fog(p.z);
      const o = f * 0.55;
      if (o < 0.02) continue;

      const pr = project(p.x, p.y, p.z);

      if (warping) {
        const pf = project(p.x, p.y, p.z + 55);
        ctx.beginPath();
        ctx.moveTo(pr.x, pr.y);
        ctx.lineTo(pf.x, pf.y);
        ctx.strokeStyle = `rgba(242,242,242,${o})`;
        ctx.lineWidth   = p.size * 0.45;
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.arc(pr.x, pr.y, Math.max(0.3, p.size * pr.scale), 0, Math.PI * 2);
        ctx.fillStyle = `rgba(242,242,242,${o})`;
        ctx.fill();
      }
    }
  }

  /* ════════════════════════════════════════════
     LOGO — PATHS SVG → SEGMENTOS
  ════════════════════════════════════════════ */
  const SVG_W = 647, SVG_H = 301;

  const RAW = [
    /* M */
    [246.874,41.647, 300.543,0.429  ],[300.543,0.429,  300.543,300.972],
    [300.543,300.972,246.874,300.972],[246.874,300.972,246.874,109.483],
    [246.874,109.483,194.065,149.842],[194.065,149.842,150.271,183.760],
    [150.271,183.760,106.478,149.842],[106.478,149.842,53.668, 109.483],
    [53.668, 109.483,53.668, 300.972],[53.668, 300.972,0,      300.972],
    [0,      300.972,0,      0.429  ],[0,      0.429,  53.668, 41.647 ],
    [53.668, 41.647, 150.271,115.924],[150.271,115.924,246.874,41.647 ],
    /* F */
    [420.749,0,      540.0,  0      ],[540.0,  0,      640.575,0      ],
    [640.575,0,      640.575,53.668 ],[640.575,53.668, 421.179,53.668 ],
    [421.179,53.668, 400.0,  63.0   ],[400.0,  63.0,   393.701,75.0   ],
    [393.701,75.0,   393.701,109.054],[393.701,109.054,586.907,109.054],
    [586.907,109.054,586.907,162.722],[586.907,162.722,393.271,162.722],
    [393.271,162.722,393.271,300.543],[393.271,300.543,340.032,300.543],
    [340.032,300.543,340.032,81.147 ],[340.032,81.147, 355.0,  30.0   ],
    [355.0,  30.0,   420.749,0      ],
  ];

  let logoSegs = [];

  function svgToSpace(sx, sy) {
    const sc = (W * 0.38) / SVG_W;
    return { x: (sx - SVG_W * 0.5) * sc, y: (sy - SVG_H * 0.5) * sc };
  }

  function computeLogoSegs() {
    logoSegs = RAW.map((s, i) => {
      const p1 = svgToSpace(s[0], s[1]);
      const p2 = svgToSpace(s[2], s[3]);
      return {
        logoPos:   { x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y },
        tunnelPos: {
          x1: p1.x + (Math.random()-0.5)*180, y1: p1.y + (Math.random()-0.5)*180,
          x2: p2.x + (Math.random()-0.5)*180, y2: p2.y + (Math.random()-0.5)*180,
          z: 300 + Math.random() * 900,
        },
        progress: 0,
        homeRing: null,
        homeNode: 0,
      };
    });
  }

  function assignSegsToNodes() {
    if (!logoSegs.length || !rings.length) return;
    const sorted = rings.slice().sort((a,b) => Math.abs(a.z - LOGO_FOCAL_Z*3) - Math.abs(b.z - LOGO_FOCAL_Z*3));
    const pool   = sorted.slice(0, 10);
    logoSegs.forEach((seg, i) => {
      seg.homeRing = pool[i % pool.length];
      seg.homeNode = i % 6;
    });
  }

  /* ────────────────────────────────────────────
     LOGO — FUNCIONES DE CONTROL POR HERO PROGRESS
  ────────────────────────────────────────────── */

  /**
   * _logoSegProgress
   * Calcula el progress de un segmento según heroProgress y su stagger.
   *
   * Fase 1 (0.00 → 0.35): aparición — zoom in desde fondo del túnel
   * Fase 2 (0.35 → 0.60): hold — logo visible y estable
   * Fase 3 (0.60 → 1.00): salida — zoom hacia cámara, atraviesa la pantalla
   */
  function _logoSegProgress(segOffset) {
    const APPEAR_START = 0.02;
    const APPEAR_END   = 0.35;
    const HOLD_END     = 0.60;
    const DISS_END     = 0.98;
    const hp = heroProgress;

    if (hp < APPEAR_START + segOffset) return 0;
    if (hp < APPEAR_END)  return easeOut5(norm(hp, APPEAR_START + segOffset, APPEAR_END));
    if (hp < HOLD_END)    return 1;
    if (hp < DISS_END)    return 1 - easeIn5(norm(hp, HOLD_END, DISS_END - segOffset * 0.5));
    return 0;
  }

  /**
   * _logoFocalZ
   * Z del logo en el espacio del túnel.
   *
   * Fase aparición:   TUNNEL_DEPTH*0.4 → LOGO_FOCAL_Z  (emerge desde el fondo)
   * Fase hold:        LOGO_FOCAL_Z
   * Fase salida:      LOGO_FOCAL_Z → -FOV*0.8  (atraviesa la cámara)
   */
  function _logoFocalZ() {
    const hp = heroProgress;
    if (hp < 0.35) {
      // Emerge desde profundidad
      return lerp(TUNNEL_DEPTH * 0.4, LOGO_FOCAL_Z, easeOut5(norm(hp, 0.0, 0.35)));
    }
    if (hp < 0.60) return LOGO_FOCAL_Z;
    // Se lanza hacia la cámara
    return lerp(LOGO_FOCAL_Z, -FOV * 0.85, easeIn5(norm(hp, 0.60, 0.98)));
  }

  /**
   * _logoOpacity
   * Opacidad global del logo por heroProgress.
   */
  function _logoOpacity() {
    const hp = heroProgress;
    if (hp < 0.02)  return 0;
    if (hp < 0.12)  return norm(hp, 0.02, 0.12);
    if (hp < 0.55)  return 1;
    if (hp < 0.98)  return 1 - easeIn3(norm(hp, 0.55, 0.98));
    return 0;
  }

  /* ════════════════════════════════════════════
     CAPA 3a — updateLogoDepth (reemplaza updateLogo)
     Logo con profundidad Z real — emerge y atraviesa la cámara
  ════════════════════════════════════════════ */
  function updateLogoDepth() {
    const total     = logoSegs.length;
    const globalOp  = _logoOpacity();
    const focalZ    = _logoFocalZ();  // Z del logo en el espacio 3D

    if (globalOp < 0.01) return;

    for (let i = 0; i < total; i++) {
      const seg       = logoSegs[i];
      const segOffset = (i / total) * 0.08;
      seg.progress    = _logoSegProgress(segOffset);

      const p = seg.progress;
      if (p < 0.01) continue;

      // Posición del nodo home (origen disperso en el túnel)
      let tX1, tY1, tX2, tY2, tZ;
      const ring = seg.homeRing;
      if (ring && ring.vertices && ring.vertices.length > 1) {
        const ni1 = seg.homeNode % ring.vertices.length;
        const ni2 = (seg.homeNode + 1) % ring.vertices.length;
        tX1 = ring.vertices[ni1].x; tY1 = ring.vertices[ni1].y;
        tX2 = ring.vertices[ni2].x; tY2 = ring.vertices[ni2].y;
        tZ  = ring.z;
      } else {
        const tp  = seg.tunnelPos;
        const pr1 = project(tp.x1, tp.y1, tp.z);
        const pr2 = project(tp.x2, tp.y2, tp.z);
        tX1 = pr1.x; tY1 = pr1.y; tX2 = pr2.x; tY2 = pr2.y; tZ = tp.z;
      }

      // Logo position con Z dinámico (profundidad real)
      const lp   = seg.logoPos;
      const lpr1 = project(lp.x1, lp.y1, focalZ);
      const lpr2 = project(lp.x2, lp.y2, focalZ);

      // Interpolación: desde nodo del túnel hasta posición del logo
      const cx1 = lerp(tX1, lpr1.x, p);
      const cy1 = lerp(tY1, lpr1.y, p);
      const cx2 = lerp(tX2, lpr2.x, p);
      const cy2 = lerp(tY2, lpr2.y, p);

      // Opacidad combinada
      const fv  = fog(lerp(tZ, Math.max(focalZ, 0), p));
      const base = p < 0.08 ? 0 : Math.pow(p, 0.5) * globalOp;
      const op  = Math.min(base * Math.max(fv, 0.1), 1);
      if (op < 0.02) continue;

      // Grosor dinámico: crece cuando el logo se acerca a la cámara (fase salida)
      const exitFactor = heroProgress > 0.60 ? easeIn3(norm(heroProgress, 0.60, 0.98)) : 0;
      const lineW      = lerp(0.3, 1.6, p) * lerp(1.0, 2.8, exitFactor);

      const b = Math.floor(lerp(170, 255, lightPulse));
      ctx.beginPath();
      ctx.moveTo(cx1, cy1);
      ctx.lineTo(cx2, cy2);
      ctx.strokeStyle = `rgba(${b},${b},${b},${op})`;
      ctx.lineWidth   = Math.max(0.2, lineW);
      ctx.stroke();

      // Nodos accent en fase hold
      if (p > 0.78 && lightPulse > 0.35 && heroProgress < 0.60) {
        const no = ((p - 0.78) / 0.22) * ((lightPulse - 0.35) / 0.65) * 0.9;
        ctx.fillStyle = `rgba(0,143,245,${no})`;
        ctx.beginPath(); ctx.arc(cx1, cy1, 1.6, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(cx2, cy2, 1.6, 0, Math.PI*2); ctx.fill();
      }
    }
  }

  /* ════════════════════════════════════════════
     CAPA 3b — TETRAEDROS con parallax
  ════════════════════════════════════════════ */
  const tetras = [];
  let tetraTimer = 0;

  function spawnTetra() {
    if (tetras.length >= MAX_TETRAS) return;
    const valid = rings.filter(r => r.vertices && r.vertices.length > 1 && r.z > 150);
    if (!valid.length) return;
    const ring = valid[Math.floor(Math.random() * valid.length)];
    const ni   = Math.floor(Math.random() * ring.vertices.length);
    const node = ring.vertices[ni];
    // depth: cuánto más rápido se mueve este tetraedro (parallax)
    const depth = 0.8 + Math.random() * 0.6;
    tetras.push({
      x: node.x - focalX, y: node.y - focalY, z: ring.z,
      size: 9 + Math.random() * 14,
      rx: Math.random() * Math.PI * 2, ry: Math.random() * Math.PI * 2,
      rs: (Math.random() - 0.5) * 0.022,
      life: 0, maxLife: 100 + Math.random() * 80,
      depth,  // factor de parallax
    });
  }

  function updateTetras(dt) {
    tetraTimer += dt * 0.06;
    if (tetraTimer > 2.5) {
      if (visualScroll > 0.5 && Math.random() < 0.35) spawnTetra();
      tetraTimer = 0;
    }

    const speed = visualScroll * 0.32;

    for (let i = tetras.length - 1; i >= 0; i--) {
      const t = tetras[i];
      // PATCH: parallax de profundidad
      t.z -= speed * dt * 0.06 * t.depth;
      t.rx += t.rs * dt * 0.06;
      t.ry += t.rs * 1.4 * dt * 0.06;
      t.life += dt * 0.06;

      if (t.z < -40 || t.life > t.maxLife) { tetras.splice(i, 1); continue; }

      const ln = t.life / t.maxLife;
      const lf = ln < 0.2 ? ln/0.2 : ln > 0.8 ? (1-ln)/0.2 : 1;
      const f  = fog(t.z);
      const op = lf * f * 0.55;
      if (op < 0.02) continue;

      const pr = project(t.x, t.y, t.z);
      const sc = pr.scale * t.size;
      const a  = { x: pr.x,                         y: pr.y - sc };
      const b  = { x: pr.x - sc*0.866,               y: pr.y + sc*0.5 };
      const c  = { x: pr.x + sc*0.866,               y: pr.y + sc*0.5 };
      const d  = { x: pr.x + Math.cos(t.rx)*sc*0.5,  y: pr.y - sc*0.7 + Math.sin(t.ry)*sc*0.3 };

      const br = Math.floor(lerp(150, 220, lightPulse));
      ctx.strokeStyle = `rgba(${br},${br},${br},${op})`;
      ctx.lineWidth   = 0.5;
      for (const [p1, p2] of [[a,b],[b,c],[c,a],[a,d],[b,d],[c,d]]) {
        ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke();
      }
    }
  }

  /* ════════════════════════════════════════════
     PATCH v5 — LOGO FILL SYSTEM
     Partículas internas del logo con onda desde el centro.
     100% reversible: todo depende de heroProgress en tiempo real.
  ════════════════════════════════════════════ */

  /**
   * buildLogoFill
   * Distribuye LOGO_FILL_COUNT partículas sobre los segmentos del logo.
   * Calcula el centro del logo y el waveDelay de cada partícula
   * (proporcional a su distancia al centro → efecto onda).
   *
   * Se llama en resize() tras computeLogoSegs(), y en init().
   */
  function buildLogoFill() {
    logoFillParticles = [];

    // Calcular el bounding box del logo en espacio del túnel
    // para obtener el centro exacto
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;

    RAW.forEach(s => {
      const p1 = svgToSpace(s[0], s[1]);
      const p2 = svgToSpace(s[2], s[3]);
      minX = Math.min(minX, p1.x, p2.x);
      maxX = Math.max(maxX, p1.x, p2.x);
      minY = Math.min(minY, p1.y, p2.y);
      maxY = Math.max(maxY, p1.y, p2.y);
    });

    logoFillCenterX = (minX + maxX) * 0.5;
    logoFillCenterY = (minY + maxY) * 0.5;

    const logoW = maxX - minX;
    const logoH = maxY - minY;

    // Distribuir partículas uniformemente dentro del bounding box del logo
    // usando distribución quasi-aleatoria (Halton-like) para evitar clustering
    for (let i = 0; i < LOGO_FILL_COUNT; i++) {
      // Posición aleatoria dentro del bounding box
      const px = minX + (i / LOGO_FILL_COUNT + Math.random() * (1 / LOGO_FILL_COUNT)) * logoW;
      const py = minY + Math.random() * logoH;

      // Distancia al centro → waveDelay
      const dist      = Math.hypot(px - logoFillCenterX, py - logoFillCenterY);
      const waveDelay = dist * LOGO_FILL_WAVE;

      // Jitter Z para volumen
      const jitterZ = (Math.random() - 0.5) * 2 * LOGO_FILL_JITTER_Z;

      // Radio varía para dar textura orgánica
      const r = 0.8 + Math.random() * 1.2;

      logoFillParticles.push({ px, py, jitterZ, waveDelay, r, progress: 0 });
    }
  }

  /**
   * updateLogoFill
   * Recalcula el progress de cada partícula según heroProgress.
   * La onda parte desde el centro (waveDelay = 0) hacia los bordes.
   *
   * Completamente reversible: si heroProgress baja, progress baja.
   * No almacena estados — todo se deriva de heroProgress en cada frame.
   *
   * @param {number} hp  heroProgress actual (0→1)
   */
  function updateLogoFill(hp) {
    // Solo activo en la ventana [FILL_START, FILL_END]
    // Con margen para suavizar entrada y salida
    const MARGIN = 0.08;
    if (hp < LOGO_FILL_START - MARGIN || hp > LOGO_FILL_END + MARGIN) {
      // Fast-reset: solo si hay algo que limpiar
      if (logoFillParticles.length > 0 && logoFillParticles[0].progress > 0) {
        for (const p of logoFillParticles) p.progress = 0;
      }
      return;
    }

    // Tamaño de la ventana de transición de cada partícula individual
    const WINDOW = 0.055;

    for (const p of logoFillParticles) {
      // Inicio de esta partícula = FILL_START + su delay de onda
      const pStart = LOGO_FILL_START + p.waveDelay;
      // Su ventana de transición
      const t = clamp((hp - pStart) / WINDOW, 0, 1);
      p.progress = easeOut3(t);
    }
  }

  /**
   * renderLogoFill
   * Dibuja las partículas de relleno del logo.
   * Usa la misma proyección 3D que updateLogoDepth.
   * Color interpola de gris-blanco → blanco puro según progress.
   *
   * Debe llamarse DESPUÉS de updateLogoDepth para que las partículas
   * aparezcan sobre los segmentos de contorno.
   */
  function renderLogoFill() {
    const globalOp = _logoOpacity();
    const focalZ   = _logoFocalZ();

    if (globalOp < 0.01 || heroProgress < LOGO_FILL_START - 0.08) return;

    for (const p of logoFillParticles) {
      if (p.progress < 0.01) continue;

      // Z con jitter para profundidad orgánica
      const pz  = focalZ + p.jitterZ;
      const pr  = project(p.px, p.py, pz);

      // Radio escalado con perspectiva
      const r   = Math.max(0.2, p.r * pr.scale * lerp(0.5, 1.3, p.progress));

      // Color: [160,165,170] (gris frío) → [255,255,255] (blanco puro)
      const cv  = Math.round(lerp(160, 255, p.progress));

      // Opacidad combinada: progress * global * fog
      const f   = fog(Math.max(pz, 0));
      const op  = p.progress * globalOp * f * 0.88;
      if (op < 0.02) continue;

      ctx.fillStyle = `rgba(${cv},${cv},${cv},${op})`;
      ctx.beginPath();
      ctx.arc(pr.x, pr.y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /* ════════════════════════════════════════════
     LOOP PRINCIPAL — integra nuevos sistemas
  ════════════════════════════════════════════ */
  function loop(now) {
    const dt = Math.min(now - lastTime, 50);
    lastTime = now;
    time    += dt;

    rotation += 0.000042 * dt;

    // ── Nuevos sistemas (orden importante) ──
    updateScrollPhysics(dt);   // física del scroll
    updateTunnelMotion(dt);    // camera drift + punto de fuga
    updateFogDensity();        // fog dinámico por velocidad

    // lightPulse ligado al movimiento — usa valor absoluto (bidireccional)
    const sL = clamp(Math.abs(scrollVelocity) / 22, 0, 1);
    lightPulse = Math.min(1, 0.28 + sL * 0.72);

    // Fondo
    ctx.fillStyle = '#0B0E12';
    ctx.fillRect(0, 0, W, H);

    // Glow radial sutil
    const grad = ctx.createRadialGradient(focalX, focalY, 0, focalX, focalY, Math.max(W,H)*0.65);
    grad.addColorStop(0, `rgba(0,18,38,${0.015 + lightPulse*0.022})`);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // Capas de render
    updateParticles(dt);
    updateRings(dt);
    updateLogoDepth();          // segmentos SVG del logo
    updateLogoFill(heroProgress);  // PATCH v5: actualizar partículas wave fill
    renderLogoFill();              // PATCH v5: dibujar fill encima del contorno
    updateTetras(dt);

    requestAnimationFrame(loop);
  }

  /* ════════════════════════════════════════════
     INIT + LISTENERS
  ════════════════════════════════════════════ */
  function init() {
    heroEl = document.querySelector('.hero');
    resize();
    focalX = W * 0.5; focalY = H * 0.5;
    mouseX = W * 0.5; mouseY = H * 0.5;
    lastTime = performance.now();

    // Registrar captura de input en el hero
    if (heroEl) {
      heroEl.addEventListener('wheel',      handleHeroWheel,      { passive: false });
      heroEl.addEventListener('touchstart', handleHeroTouchStart, { passive: true  });
      heroEl.addEventListener('touchmove',  handleHeroTouchMove,  { passive: false });
    }

    // Bloquear scroll al iniciar (si el hero está en viewport)
    const rect = heroEl ? heroEl.getBoundingClientRect() : null;
    if (rect && rect.top <= 0 && rect.bottom > 0) {
      lockHeroScroll();
    } else if (rect && rect.top >= 0) {
      // Usuario empieza desde arriba — lock cuando el hero entra en viewport
      lockHeroScroll();
    }

    requestAnimationFrame(loop);
  }

  window.addEventListener('mousemove', e => { mouseX = e.clientX; mouseY = e.clientY; });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})(); /* fin DepthField */


/* ================================================================
   2. FLIP SECTION — sin cambios
================================================================ */
document.addEventListener('DOMContentLoaded', () => {

  const flipSection = document.getElementById('flip-section');
  const flipCard    = document.getElementById('flip-card');
  const face1       = document.querySelector('.flip-face--front');
  const face2       = document.querySelector('.flip-face--back');
  const text1       = document.querySelector('.flip-face--front .flip-text-center');
  const text2       = document.querySelector('.flip-face--back  .flip-text-center');

  let targetProgress  = 0;
  let currentProgress = 0;

  const easeInOutCubic = x => x < 0.5 ? 4*x*x*x : 1 - Math.pow(-2*x+2, 3) / 2;

  const renderFlip = () => {
    if (!flipSection || !flipCard || !face1 || !face2) return;

    const rect = flipSection.getBoundingClientRect();
    const wh   = window.innerHeight;

    if (rect.top <= 0 && rect.bottom >= wh) {
      targetProgress = Math.abs(rect.top) / (rect.height - wh);
    } else if (rect.top > 0) {
      targetProgress = 0;
    } else {
      targetProgress = 1;
    }

    currentProgress += (targetProgress - currentProgress) * 0.08;
    const progress   = easeInOutCubic(currentProgress);
    const rotY       = progress * -180;
    const range      = 115;
    const f1X        = progress * range;
    const f2X        = (1 - progress) * -range;

    flipCard.style.transform = `translateZ(${Math.sin(currentProgress * Math.PI) * -300}px)`;
    face1.style.transform    = `translateX(${f1X}vw) rotateY(${rotY}deg)`;
    face2.style.transform    = `translateX(${f2X}vw) rotateY(${rotY + 180}deg)`;

    if (text1 && text2) {
      const a1 = rotY * Math.PI / 180;
      const a2 = (rotY + 180) * Math.PI / 180;
      const t1X = -f1X * Math.cos(a1), t1Z = -f1X * Math.sin(a1);
      const t2X = -f2X * Math.cos(a2), t2Z = -f2X * Math.sin(a2);

      if (progress < 0.5) {
        text1.style.visibility = 'visible';
        text1.style.transform  = `translateX(${t1X}vw) translateZ(${t1Z}vw)`;
        text2.style.visibility = 'hidden';
      } else {
        text1.style.visibility = 'hidden';
        text2.style.visibility = 'visible';
        text2.style.transform  = `translateX(${t2X}vw) translateZ(${t2Z}vw)`;
      }
    }

    requestAnimationFrame(renderFlip);
  };

  requestAnimationFrame(renderFlip);

  /* ================================================================
     3. SCROLL REVEAL — sin cambios
  ================================================================ */
  const revealTargets = document.querySelectorAll(
    '.offer__header, .offer__card, .cta-section, .section-divider'
  );
  revealTargets.forEach(el => el.classList.add('reveal'));

  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        revealObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

  revealTargets.forEach(el => revealObserver.observe(el));

  document.querySelectorAll('.offer__card').forEach((card, i) => {
    card.style.transitionDelay = `${i * 80}ms`;
  });

  /* ================================================================
     4. CTA — sin cambios
  ================================================================ */
  const ctaLetters = document.querySelectorAll('.cta__letter');

  ctaLetters.forEach((letter, i) => {
    letter.addEventListener('mouseenter', () => {
      letter.style.transform = 'translateY(-8px)';
      letter.style.color     = 'var(--fg)';
      const prev = ctaLetters[i - 1];
      const next = ctaLetters[i + 1];
      if (prev) { prev.style.transform = 'translateY(-4px)'; prev.style.color = 'rgba(242,242,242,0.55)'; }
      if (next) { next.style.transform = 'translateY(-4px)'; next.style.color = 'rgba(242,242,242,0.55)'; }
    });
    letter.addEventListener('mouseleave', () => {
      letter.style.transform = '';
      letter.style.color     = '';
      const prev = ctaLetters[i - 1];
      const next = ctaLetters[i + 1];
      if (prev) { prev.style.transform = ''; prev.style.color = ''; }
      if (next) { next.style.transform = ''; next.style.color = ''; }
    });
  });

}); /* fin DOMContentLoaded */