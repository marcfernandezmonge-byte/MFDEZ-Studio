/* ── Custom cursor ── */
const dot  = document.getElementById('cursorDot');
const ring = document.getElementById('cursorRing');
let mx = 0, my = 0, rx = 0, ry = 0;
let rafStarted = false;

document.addEventListener('mousemove', e => {
  mx = e.clientX;
  my = e.clientY;

  // Posicionar el dot de forma inmediata
  dot.style.left = mx + 'px';
  dot.style.top  = my + 'px';

  // Arrancar el loop del ring solo la primera vez
  if (!rafStarted) {
    rafStarted = true;
    animateRing();
  }
});

function animateRing() {
  rx += (mx - rx) * 0.12;
  ry += (my - ry) * 0.12;
  ring.style.left = rx + 'px';
  ring.style.top  = ry + 'px';
  requestAnimationFrame(animateRing);
}

// Expandir ring sobre elementos interactivos
document.querySelectorAll('a, button, input, textarea').forEach(el => {
  el.addEventListener('mouseenter', () => {
    ring.style.width       = '52px';
    ring.style.height      = '52px';
    ring.style.borderColor = 'rgba(0,143,245,0.85)';
  });
  el.addEventListener('mouseleave', () => {
    ring.style.width       = '32px';
    ring.style.height      = '32px';
    ring.style.borderColor = 'rgba(0,143,245,0.45)';
  });
});

/* ── Form submit ── */
const form   = document.getElementById('contactForm');
const status = document.getElementById('formStatus');

if (form) {
  form.addEventListener('submit', e => {
    e.preventDefault();
    const btn = form.querySelector('.btn-submit');
    btn.disabled      = true;
    btn.style.opacity = '0.5';

    setTimeout(() => {
      status.classList.add('visible');
      btn.disabled      = false;
      btn.style.opacity = '';
      form.reset();
      setTimeout(() => status.classList.remove('visible'), 3500);
    }, 900);
  });
}
