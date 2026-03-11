(function () {
  /* ==========================================
     DATA
     ========================================== */
  var images = [
    { src: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/1-xSiKZa0Z1pqugWpktoLlIluNUd79E1.jpg", alt: "Formula cars racing into sunset at circuit straight", number: "01", title: "Perfección" },
    { src: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/6-bMGjmviM8zIOAHsZXh0lLNdwC9TmtG.jpg", alt: "Supercross riders at starting gate with pyrotechnics", number: "02", title: "Salida Explosiva" },
    { src: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/%40mfdezphoto-4450-bt9QB19qwPsE9G1PLRrMBuJmle8LvC.jpg", alt: "Motocross rider on red bike with sunset and crowd in background", number: "03", title: "Barro y Oro" },
    { src: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/2-CeZgob7w3DaalRZHrxOxmJcYkjzd1K.jpg", alt: "Motorcycle rider cornering at sunset on circuit", number: "04", title: "El Último Atardecer" },    
    { src: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/%40mfdezphoto-3449-2-ngKzLKlSsM4Pfie2951JlJUVNLOIKh.jpg", alt: "Enduro rider jumping over dirt mound with crowd watching", number: "05", title: "Al Vuelo" },    
    { src: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/3-bLpL45uJh6zqGEq0skJIH2HFyIt0Xj.jpg", alt: "World champion motorcycle rider celebrating with team", number: "06", title: "Pasión y Gloria" },    
    { src: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/7-fRLdnKzP1MUMFUqhqSF7VXWNT5ZISy.jpg", alt: "Aerial view of GT car in pit lane with driver running", number: "007", title: "Alta Tensión" },
    { src: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/4-xgXc9PX0ufl88cAa8XzdVz9VQMRE2S.jpg", alt: "GT car racing through corner seen through foliage", number: "08", title: "Caos y Naturaleza" },
    { src: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/5-YCyxD3hJabIvjUZ4q1laSYerEiymrU.jpg", alt: "Motorcycle racer kneeling beside bike in pit lane", number: "09", title: "Solo Ante El Peligro" },
    { src: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/10-tnc5KtdLVWvyddQbx5d8r45KiAdSjR.jpg", alt: "Motorcycle rider doing wheelie on track straight", number: "10", title: "Mirada de Campeón" },
    { src: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/_DSC3178-7-ac7d1fd0-1000-4D63B10zSVpogvU8XyMx26PbJ8BYil.jpg", alt: "Solo race car on Catalunya circuit at golden hour", number: "11", title: "Iluminado" },
    { src: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/11-owNhJMKjsbxk2mMtLEu4uNbgsmLaHD.jpg", alt: "Formula race start at Circuit de Barcelona-Catalunya", number: "12", title: "Catalunya" },       
    { src: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/9-AZKJYMAIoFvqsacz07nlNZrDprRQ69.jpg", alt: "Race car captured with dramatic motion blur effect", number: "13", title: "Movimiento" },    
    { src: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/8-8CtZBbRpdYudMThknL0wPgMlF9RBYm.jpg", alt: "GT race grid start with multiple cars entering turn", number: "14", title: "Dominio de Equipo" },
    { src: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/13-o6E2W0LsjaBsZtESNZXIcormEBOiAo.jpg", alt: "Orange GT car at high speed with dramatic motion blur", number: "15", title: "Velocidad" }
  ];

  var COLS = 3;

  function chunkArray(arr, size) {
    var chunks = [];
    for (var i = 0; i < arr.length; i += size) {
      chunks.push(arr.slice(i, i + size));
    }
    return chunks;
  }

  var rows = chunkArray(images, COLS);
  var totalRows = rows.length;

  function getRowStyles(distance) {
    var abs = Math.abs(distance);
    if (abs === 0) return { scale: 1, opacity: 1, blur: 0, imgMaxHeight: "28vh" };
    if (abs === 1) return { scale: 0.85, opacity: 0.55, blur: 1.5, imgMaxHeight: "13vh" };
    return { scale: 0.7, opacity: 0.3, blur: 3, imgMaxHeight: "8vh" };
  }


  /* ==========================================
   STATE
   ========================================== */
  var activeRow = 0;
  var expandedItem = null;
  var isClosing = false;
  var isTransitioning = false;
  var scrollThreshold = 40; 
  var lastWheelTime = 0;

  /* ==========================================
     DOM REFS
     ========================================== */
  var container = document.getElementById("ag-container");
  var scene = document.getElementById("ag-scene");
  var indicator = document.getElementById("ag-indicator");
  var counterCurrent = document.getElementById("ag-counter-current");
  var counterTotal = document.getElementById("ag-counter-total");
  var hint = document.getElementById("ag-hint");
  var overlay = document.getElementById("ag-overlay");
  var expandedEl = document.getElementById("ag-expanded");
  var expandedImg = document.getElementById("ag-expanded-img");
  var expandedNumber = document.getElementById("ag-expanded-number");
  var expandedTitle = document.getElementById("ag-expanded-title");


  /* ==========================================
     BUILD DOM
     ========================================== */
  function buildScene() {
    scene.innerHTML = "";

    rows.forEach(function (row, rowIndex) {
      var rowEl = document.createElement("div");
      rowEl.className = "ag-row";
      rowEl.setAttribute("data-row", rowIndex);

      row.forEach(function (img, colIndex) {
        var btn = document.createElement("button");
        btn.className = "ag-card";
        btn.type = "button";
        btn.setAttribute("aria-label", "View " + img.title);
        btn.setAttribute("data-row", rowIndex);
        btn.setAttribute("data-col", colIndex);

        var wrap = document.createElement("div");
        wrap.className = "ag-card__img-wrap";

        var imgEl = document.createElement("img");
        imgEl.src = img.src;
        imgEl.alt = img.alt;
        imgEl.loading = "lazy";
        wrap.appendChild(imgEl);

        var info = document.createElement("div");
        info.className = "ag-card__info";

        var numEl = document.createElement("span");
        numEl.className = "ag-card__number";
        numEl.textContent = img.number;

        var titleEl = document.createElement("h3");
        titleEl.className = "ag-card__title";
        titleEl.textContent = img.title;

        info.appendChild(numEl);
        info.appendChild(titleEl);

        btn.appendChild(wrap);
        btn.appendChild(info);
        rowEl.appendChild(btn);

        btn.addEventListener("click", function () {
          handleItemClick(rowIndex, colIndex);
        });
      });

      scene.appendChild(rowEl);
    });
  }

  function buildIndicator() {
    indicator.innerHTML = "";
    for (var i = 0; i < totalRows; i++) {
      var dot = document.createElement("button");
      dot.className = "ag-indicator__dot";
      dot.type = "button";
      dot.setAttribute("aria-label", "Go to row " + (i + 1));
      dot.setAttribute("data-dot", i);
      (function (idx) {
        dot.addEventListener("click", function () {
          setActiveRow(idx);
        });
      })(i);
      indicator.appendChild(dot);
    }
  }

  counterTotal.textContent = String(totalRows).padStart(2, "0");


  /* ==========================================
     RENDER
     ========================================== */
  function render() {
    var rowEls = scene.querySelectorAll(".ag-row");

    rowEls.forEach(function (rowEl, rowIndex) {
      var distance = rowIndex - activeRow;
      var isActive = distance === 0;
      var styles = getRowStyles(distance);

      rowEl.style.transform = "scale(" + styles.scale + ")";
      rowEl.style.opacity = styles.opacity;
      rowEl.style.filter = styles.blur > 0 ? "blur(" + styles.blur + "px)" : "none";

      if (isActive) {
        rowEl.classList.add("ag-row--active");
      } else {
        rowEl.classList.remove("ag-row--active");
      }

      /* Bracket: only on active row */
      var existingBracket = rowEl.querySelector(".ag-row__bracket");
      if (isActive && !existingBracket) {
        var bracket = document.createElement("div");
        bracket.className = "ag-row__bracket";
        bracket.setAttribute("aria-hidden", "true");

        var leftLine = document.createElement("span");
        leftLine.className = "ag-row__bracket-left";
        var rightLine = document.createElement("span");
        rightLine.className = "ag-row__bracket-right";

        bracket.appendChild(leftLine);
        bracket.appendChild(rightLine);
        rowEl.appendChild(bracket);
      } else if (!isActive && existingBracket) {
        existingBracket.remove();
      }

      /* Cards */
      var cards = rowEl.querySelectorAll(".ag-card");
      cards.forEach(function (card) {
        var imgEl = card.querySelector(".ag-card__img-wrap img");
        var infoEl = card.querySelector(".ag-card__info");

        imgEl.style.maxHeight = styles.imgMaxHeight;

        if (isActive) {
          card.classList.add("ag-card--selectable");
          card.setAttribute("tabindex", "0");
          if (infoEl) infoEl.style.display = "";
        } else {
          card.classList.remove("ag-card--selectable");
          card.setAttribute("tabindex", "-1");
          if (infoEl) infoEl.style.display = "none";
        }
      });
    });

    counterCurrent.textContent = String(activeRow + 1).padStart(2, "0");

    var dots = indicator.querySelectorAll(".ag-indicator__dot");
    dots.forEach(function (dot, i) {
      if (i === activeRow) {
        dot.classList.add("ag-indicator__dot--active");
      } else {
        dot.classList.remove("ag-indicator__dot--active");
      }
    });

    if (activeRow > 0) {
      hint.classList.add("ag-hint--hidden");
    } else {
      hint.classList.remove("ag-hint--hidden");
    }
  }


  /* ==========================================
     SET ACTIVE ROW
     ========================================== */
  function setActiveRow(index) {
    if (index < 0) index = 0;
    if (index >= totalRows) index = totalRows - 1;
    activeRow = index;
    render();
  }


  /* ==========================================
      ITEM CLICK
      ========================================== */
  function handleItemClick(rowIndex, colIndex) {
    if (expandedItem || isClosing) return;

    if (rowIndex !== activeRow) {
      setActiveRow(rowIndex);
      return;
    }

    document.body.classList.add('ag-is-expanded');

    var img = rows[rowIndex][colIndex];
    expandedItem = { row: rowIndex, col: colIndex };
    expandedImg.src = img.src;
    expandedImg.alt = img.alt;
    
    expandedNumber.textContent = img.number;
    
    if (img.number.trim() === '007') {
      expandedNumber.classList.add('is-bond');
    } else {
      expandedNumber.classList.remove('is-bond');
    }

    expandedTitle.textContent = img.title;
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-label", img.title);

    overlay.classList.add("ag-overlay--visible");
    overlay.classList.remove("ag-overlay--closing");
  }


  /* ==========================================
     CLOSE OVERLAY
     ========================================== */
  function handleClose() {
    if (!expandedItem || isClosing) return;
    isClosing = true;

    document.body.classList.remove('ag-is-expanded');

    overlay.classList.add("ag-overlay--closing");
    overlay.classList.remove("ag-overlay--visible");

    setTimeout(function () {
      expandedItem = null;
      isClosing = false;
      overlay.classList.remove("ag-overlay--closing");
      overlay.removeAttribute("aria-modal");
      overlay.removeAttribute("aria-label");
    }, 400);
  }

  overlay.addEventListener("click", function () {
    handleClose();
  });


  /* ==========================================
   SCROLL WHEEL
   ========================================== */
  container.addEventListener("wheel", function (e) {
    e.preventDefault();
    if (expandedItem || isClosing) return;

    var now = Date.now();
    if (now - lastWheelTime < 600) return; 

    if (Math.abs(e.deltaY) > scrollThreshold) {
      var direction = e.deltaY > 0 ? 1 : -1;
      var nextRow = activeRow + direction;

      if (nextRow >= 0 && nextRow < totalRows) {
        lastWheelTime = now;
        setActiveRow(nextRow);
      }
    }
  }, { passive: false });

  /* ==========================================
     KEYBOARD
     ========================================== */
  window.addEventListener("keydown", function (e) {
    if ((expandedItem || isClosing) && e.key === "Escape") {
      handleClose();
      return;
    }
    if (expandedItem) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveRow(activeRow + 1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveRow(activeRow - 1);
    }
  });


  /* ==========================================
     INIT & PRELOADER (Dinámico y Fluido)
     ========================================== */
  function initGallery() {
    buildScene();
    buildIndicator();
    render();
    
    preloadGalleryImages();
  }

  function preloadGalleryImages() {
    var allImgs = scene.querySelectorAll(".ag-card__img-wrap img");
    var totalImages = allImgs.length;
    var loadedCount = 0;
    var visualPercent = 0;

    // Buscamos los elementos del DOM (ahora seguros aunque falten)
    var loaderMain = document.getElementById("ag-loader") || document.querySelector(".ag-loader__logo-wrap");
    var logoFill = document.getElementById("ag-loader-logo-fill");
    var loaderText = document.getElementById("ag-loader-text");
    var loaderBar = document.getElementById("ag-loader-bar");

    if (totalImages === 0) {
      finishLoading(loaderMain, logoFill);
      return;
    }

    // Animación de relleno dinámica
    var fakeProgressInterval = setInterval(function() {
      // El porcentaje real de las imágenes que ya están listas
      var realPercent = Math.floor((loadedCount / totalImages) * 100);
      
      if (visualPercent < 100) {
          // Lógica de aceleración: Salta más rápido si va por detrás del realPercent
          var diff = realPercent - visualPercent;
          var step = Math.max(0.8, diff * 0.2); // Nunca se para del todo, persigue al real
          
          // Un poco de aleatoriedad para dar feeling arcade de carga de recursos
          if (Math.random() > 0.6) step += Math.random() * 2;
          
          visualPercent += step;
          
          // Topes de seguridad
          if (visualPercent > 100) visualPercent = 100;
          if (visualPercent > realPercent && realPercent < 100) visualPercent = realPercent;

          // Animación SVG: reducimos el clip-path
          if (logoFill) {
            var clipRight = 100 - visualPercent;
            logoFill.style.clipPath = "inset(0 " + clipRight + "% 0 0)";
            
            // Incrementamos sutilmente el brillo a medida que avanza
            var glow = (visualPercent / 100) * 0.8;
          }

          // Si tuvieras textos/barras, también se animarían (opcional)
          if (loaderText) loaderText.textContent = "LOADING " + Math.floor(visualPercent).toString().padStart(2, '0') + "%";
          if (loaderBar) loaderBar.style.width = visualPercent + "%";
      }

      // Finalizar cuando visual y real llegan al 100%
      if (visualPercent >= 100 && loadedCount >= totalImages) {
        clearInterval(fakeProgressInterval);
        // Pequeña pausa antes de dar el flashazo final
        setTimeout(function() {
          finishLoading(loaderMain, logoFill);
        }, 150); 
      }
    }, 35); 

    // Proceso de carga real de las imágenes
    allImgs.forEach(function(img) {
      img.removeAttribute('loading');
      const checkLoad = () => {
        img.decode().then(() => { loadedCount++; }).catch(() => { loadedCount++; });
      };
      if (img.complete) {
        checkLoad();
      } else {
        img.onload = checkLoad;
        img.onerror = () => loadedCount++; // Suma incluso si hay error para no bloquear la carga
      }
    });
  }

  function finishLoading(loaderMain, logoFill) {
    // 1. EFECTO POP FINAL: El logo hace un "latido" y brilla de color blanco/azul
    if (logoFill) {
      logoFill.classList.add("is-loaded");
      logoFill.style.transition = "all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)";
      logoFill.style.transform = "scale(1.08)"; // Pequeño latido
    }

    // 2. DESAPARECER EL LOADER Y MOSTRAR ESCENA
    setTimeout(function () {
      if (loaderMain) {
        // Usamos tanto la clase CSS como estilos en línea por seguridad
        loaderMain.classList.add("ag-loader--hidden"); 
        loaderMain.style.transform = "translateY(-100vh)";
        loaderMain.style.opacity = "0";
      }
      
      // Reiniciamos la animación de la galería para que entre suavemente
      scene.style.animation = 'none';
      scene.offsetHeight; 
      scene.style.animation = "agSceneEntrance 1.2s cubic-bezier(0.16, 1, 0.3, 1) forwards";
    }, 700); // 700ms para admirar el latido antes de que el telón suba
  }

  // IMPORTANTE: Arrancamos todo
  initGallery();
})();