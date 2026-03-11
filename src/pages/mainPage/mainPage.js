document.addEventListener('DOMContentLoaded', () => {
  const flipSection = document.getElementById('flip-section');
  const flipCard = document.getElementById('flip-card');
  const face1 = document.querySelector('.flip-face--front');
  const face2 = document.querySelector('.flip-face--back');
  const text1 = document.querySelector('.flip-face--front .flip-text-center');
  const text2 = document.querySelector('.flip-face--back .flip-text-center');

  let targetProgress = 0;
  let currentProgress = 0;

  const easeInOutCubic = (x) => x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;

  const render = () => {
    if (!flipSection || !flipCard || !face1 || !face2) return;

    const rect = flipSection.getBoundingClientRect();
    const windowHeight = window.innerHeight;

    if (rect.top <= 0 && rect.bottom >= windowHeight) {
      const maxScroll = rect.height - windowHeight;
      targetProgress = Math.abs(rect.top) / maxScroll;
    } else if (rect.top > 0) {
      targetProgress = 0;
    } else {
      targetProgress = 1;
    }

    currentProgress += (targetProgress - currentProgress) * 0.08;
    const progress = easeInOutCubic(currentProgress);

    // 1. Movimiento de profundidad del contenedor para dar espacio al giro
    const zDepth = Math.sin(currentProgress * Math.PI) * -300; 
    flipCard.style.transform = `translateZ(${zDepth}px)`;

    // 2. Rotación y Desplazamiento
    const rotY = progress * -180; 
    const movementRange = 115; // Ampliado para asegurar que las fotos salgan de la pantalla

    const face1X = progress * movementRange;
    face1.style.transform = `translateX(${face1X}vw) rotateY(${rotY}deg)`;

    const face2X = (1 - progress) * -movementRange;
    face2.style.transform = `translateX(${face2X}vw) rotateY(${rotY + 180}deg)`;

    // 3. Compensación de los textos (Ancla central perfecta)
    const angle1 = rotY * Math.PI / 180;
    const t1X = -face1X * Math.cos(angle1);
    const t1Z = -face1X * Math.sin(angle1);

    const angle2 = (rotY + 180) * Math.PI / 180;
    const t2X = -face2X * Math.cos(angle2);
    const t2Z = -face2X * Math.sin(angle2);

    // 4. CORTE PERFECTO (Sin opacidades ni fading)
    // Cambiamos instantáneamente la visibilidad justo a la mitad del giro (a los -90 grados exactos)
    // Eliminamos el "+ 100px" del translateZ para evitar el efecto "péndulo" y que sea rotación pura.
    if (text1 && text2) {
      if (progress < 0.5) {
        text1.style.visibility = 'visible';
        text1.style.transform = `translateX(${t1X}vw) translateZ(${t1Z}vw)`;
        
        text2.style.visibility = 'hidden';
      } else {
        text1.style.visibility = 'hidden';
        
        text2.style.visibility = 'visible';
        text2.style.transform = `translateX(${t2X}vw) translateZ(${t2Z}vw)`;
      }
    }

    window.requestAnimationFrame(render);
  };

  window.requestAnimationFrame(render);
});