/* AMIEL.STUDIO 2.0 — motion system
   Purposeful, tactile: stickers slap on, prints settle, paper lifts.
   Content is fully readable without JS; reduced motion opts out entirely. */

(function () {
  "use strict";

  /* ---------- cube navigator (always active) ----------
     Replaces the old dropdown menu: a small sticker cube (CSS 3D) spins
     inside the nav pill; clicking it opens a fullscreen overlay where the
     big cube can be dragged, and tapping a face jumps to its section
     (case-study pages jump back to home.html). Built entirely in JS so
     the markup stays clean without it; with reduced motion the cube
     holds still but stays fully usable. */
  (function () {
    var btn = document.getElementById("cubeNav");
    if (!btn) return;

    /* clean theme wants a light-grey outlined cube whose faces bloom with a
       pink gradient on hover; bold keeps its hot-pink sticker faces */
    var cubeClean = document.documentElement.getAttribute("data-theme") === "clean";
    var faceBg = cubeClean ? "#E7E7EA" : "var(--pink)";
    var faceBorder = cubeClean ? "2px solid rgba(20, 20, 24, .16)" : "3px solid var(--ink, #16161a)";
    var faceText = cubeClean ? "var(--ink, #1a1a1a)" : "var(--white, #fff)";
    /* clean hover: a white→pink wash. NOTE the pink is the literal signature
       accent (#ff80cb), not var(--pink): the clean theme remaps --pink to ink,
       so var(--pink) here would render white→black. bold hover uses the beige
       paper token with black text — both are defined by setActiveFace below. */
    var faceHoverBg = "linear-gradient(150deg, rgba(255, 255, 255, .95) 0%, #ff80cb 100%)";

    var HALF = 80, PERSPECTIVE = 1400, STAGE = 340, SVG_SIZE = 360, CORNER_R = 10, STROKE = 9;
    var DOCK_SCALE = 0.17, DOCK_SIZE = 48;
    var NS = "http://www.w3.org/2000/svg";
    var stillCube = window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
                    /[?&]noanim/.test(location.search);
    var FACES = [
      { label: "product", tag: "#PRODUCTDESIGN", target: "#product", transform: "rotateY(0deg) translateZ(" + HALF + "px)" },
      { label: "experience", tag: "#EXPERIENCE", target: "#experience", transform: "rotateY(90deg) translateZ(" + HALF + "px)" },
      { label: "social", tag: "#SOCIALDESIGN", target: "#social", transform: "rotateY(180deg) translateZ(" + HALF + "px)" },
      { label: "photography", tag: "#MASTEROFDISASTER", target: "#photography", transform: "rotateY(-90deg) translateZ(" + HALF + "px)" },
      { label: "about", tag: "#PROJECTLEAD", target: "#about", transform: "rotateX(90deg) translateZ(" + HALF + "px)" },
      { label: "say hi", tag: "#MAKER", target: "#contact", transform: "rotateX(-90deg) translateZ(" + HALF + "px)" }
    ];

    /* cube corners rotated + perspective-projected into 2D */
    function projectCorners(rxDeg, ryDeg) {
      var rx = rxDeg * Math.PI / 180, ry = ryDeg * Math.PI / 180;
      var cx = Math.cos(rx), sx = Math.sin(rx), cy = Math.cos(ry), sy = Math.sin(ry);
      var pts = [];
      for (var ix = -1; ix <= 1; ix += 2)
        for (var iy = -1; iy <= 1; iy += 2)
          for (var iz = -1; iz <= 1; iz += 2) {
            var x = ix * HALF, y = iy * HALF, z = iz * HALF;
            var x1 = x * cy + z * sy, z1 = -x * sy + z * cy;
            var y2 = y * cx - z1 * sx, z2 = y * sx + z1 * cx;
            var s = PERSPECTIVE / (PERSPECTIVE - z2);
            pts.push([x1 * s, y2 * s]);
          }
      return pts;
    }

    function convexHull(points) {
      var pts = points.slice().sort(function (a, b) { return a[0] - b[0] || a[1] - b[1]; });
      var n = pts.length, i;
      function cross(o, a, b) { return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]); }
      var lower = [];
      for (i = 0; i < n; i++) {
        while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], pts[i]) <= 0) lower.pop();
        lower.push(pts[i]);
      }
      var upper = [];
      for (i = n - 1; i >= 0; i--) {
        while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], pts[i]) <= 0) upper.pop();
        upper.push(pts[i]);
      }
      lower.pop(); upper.pop();
      return lower.concat(upper);
    }

    function roundedHullPath(h, r) {
      var n = h.length;
      if (n < 3) return "";
      var d = "";
      for (var i = 0; i < n; i++) {
        var p0 = h[(i - 1 + n) % n], p1 = h[i], p2 = h[(i + 1) % n];
        var v1x = p1[0] - p0[0], v1y = p1[1] - p0[1], l1 = Math.hypot(v1x, v1y) || 1;
        var v2x = p2[0] - p1[0], v2y = p2[1] - p1[1], l2 = Math.hypot(v2x, v2y) || 1;
        var rr = Math.min(r, l1 / 2, l2 / 2);
        var ax = p1[0] - v1x / l1 * rr, ay = p1[1] - v1y / l1 * rr;
        var bx = p1[0] + v2x / l2 * rr, by = p1[1] + v2y / l2 * rr;
        d += (i === 0 ? "M" : "L") + ax.toFixed(1) + "," + ay.toFixed(1);
        d += "Q" + p1[0].toFixed(1) + "," + p1[1].toFixed(1) + " " + bx.toFixed(1) + "," + by.toFixed(1);
      }
      return d + "Z";
    }

    var noSelect = { userSelect: "none", webkitUserSelect: "none" };

    /* the stage holds shadow + cube + outline; docked in the nav pill it
       is scaled down and click-through so the button handles the tap */
    var stage = document.createElement("div");
    Object.assign(stage.style, {
      width: STAGE + "px", height: STAGE + "px",
      position: "absolute", left: "50%", top: "50%",
      transform: "translate(-50%, -50%) scale(" + DOCK_SCALE + ")",
      transition: "transform .22s cubic-bezier(.34, 1.56, .64, 1)",
      display: "flex", alignItems: "center", justifyContent: "center",
      overflow: "visible", perspective: PERSPECTIVE + "px",
      touchAction: "none", pointerEvents: "none"
    }, noSelect);
    var DOCK_SCALE_HOVER = 0.20;

    function makeSvg() {
      var svg = document.createElementNS(NS, "svg");
      svg.setAttribute("width", SVG_SIZE);
      svg.setAttribute("height", SVG_SIZE);
      svg.setAttribute("viewBox", -SVG_SIZE / 2 + " " + -SVG_SIZE / 2 + " " + SVG_SIZE + " " + SVG_SIZE);
      Object.assign(svg.style, {
        position: "absolute", left: "50%", top: "50%",
        transform: "translate(-50%, -50%)", pointerEvents: "none"
      });
      return svg;
    }

    /* shadow layer BEHIND the cube — pink-filled so the drop shadow
       can't shine through the cube itself */
    var shadowSvg = makeSvg();
    shadowSvg.innerHTML =
      '<defs><filter id="cubeSoftShadow" x="-40%" y="-40%" width="180%" height="180%">' +
      '<feDropShadow dx="0" dy="6" stdDeviation="7" style="flood-color:var(--navy-ink);flood-opacity:.28"/>' +
      '</filter></defs>' +
      '<path style="fill:var(--pink);stroke:var(--ink,#16161a);stroke-width:' + STROKE +
      ';stroke-linejoin:round;stroke-linecap:round" filter="url(#cubeSoftShadow)"/>';
    var shadowPath = shadowSvg.querySelector("path");

    var scene = document.createElement("div");
    Object.assign(scene.style, {
      width: HALF * 2 + "px", height: HALF * 2 + "px",
      position: "relative", transformStyle: "preserve-3d"
    });

    /* only one face is ever "active" (hovered on desktop, finger-over on
       touch). setActiveFace lights the given face and unlights the previous
       one; each face stashes its own on/off closures (colours differ per
       theme) so this stays theme-agnostic. */
    var activeFace = null;
    function setActiveFace(f) {
      if (activeFace === f) return;
      if (activeFace && activeFace.__faceOff) activeFace.__faceOff();
      activeFace = f;
      if (f && f.__faceOn) f.__faceOn();
    }

    FACES.forEach(function (face) {
      var f = document.createElement("div");
      f.setAttribute("data-face-target", face.target);
      Object.assign(f.style, {
        position: "absolute", width: HALF * 2 + "px", height: HALF * 2 + "px",
        boxSizing: "border-box", background: faceBg,
        border: faceBorder,
        transform: face.transform,
        display: "flex", alignItems: "center", justifyContent: "center",
        backfaceVisibility: "hidden", cursor: "var(--cursor-point)",
        transition: "background .25s ease-out"
      }, noSelect);
      var tag = document.createElement("div");
      tag.textContent = face.tag;
      Object.assign(tag.style, {
        position: "absolute", top: "8px", left: "8px",
        fontSize: "8px", fontFamily: "'Droid Sans Mono', monospace", fontWeight: "700",
        color: faceText, pointerEvents: "none"
      }, noSelect);
      var label = document.createElement("div");
      label.textContent = face.label;
      Object.assign(label.style, {
        fontSize: "15px", fontWeight: "700", color: faceText,
        fontFamily: "'Unbounded', sans-serif", textAlign: "center",
        padding: "0 8px", pointerEvents: "none"
      }, noSelect);
      /* active-face styling: bold → beige paper face + black text; clean →
         white→pink wash (text already ink). Stashed on the node so touch
         hit-testing (which can't rely on pointerenter during a drag) can
         drive the same states. */
      f.__faceOn = function () {
        if (cubeClean) {
          f.style.background = faceHoverBg;
        } else {
          f.style.background = "var(--paper)";
          tag.style.color = "var(--ink)";
          label.style.color = "var(--ink)";
        }
      };
      f.__faceOff = function () {
        f.style.background = faceBg;
        tag.style.color = faceText;
        label.style.color = faceText;
      };
      f.addEventListener("pointerenter", function () { setActiveFace(f); });
      f.addEventListener("pointerleave", function () { if (activeFace === f) setActiveFace(null); });
      f.appendChild(tag);
      f.appendChild(label);
      scene.appendChild(f);
    });

    /* outline layer ABOVE the cube */
    var hullSvg = makeSvg();
    hullSvg.innerHTML =
      '<path style="fill:none;stroke:var(--ink,#16161a);stroke-width:' + STROKE +
      ';stroke-linejoin:round;stroke-linecap:round"/>';
    var hullPath = hullSvg.querySelector("path");

    stage.appendChild(shadowSvg);
    stage.appendChild(scene);
    stage.appendChild(hullSvg);

    /* docked button in the nav pill */
    btn.hidden = false;
    Object.assign(btn.style, {
      width: DOCK_SIZE + "px", height: DOCK_SIZE + "px", flex: "0 0 auto",
      position: "relative", background: "transparent", border: "none",
      padding: "0", cursor: "pointer", overflow: "visible"
    });
    btn.appendChild(stage);

    /* fullscreen overlay for the big draggable cube */
    var overlay = document.createElement("div");
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-label", "Cube navigator");
    overlay.hidden = true;
    /* explicit display toggling — an inline display:flex would override
       the hidden attribute and permanently block the page */
    Object.assign(overlay.style, {
      position: "fixed", inset: "0", zIndex: "400",
      display: "none", alignItems: "center", justifyContent: "center",
      background: "hsla(209, 60%, 8%, .55)", touchAction: "none"
    });
    var closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "carousel-btn";
    closeBtn.setAttribute("aria-label", "Close navigator");
    closeBtn.textContent = "✕";
    Object.assign(closeBtn.style, { position: "absolute", top: "1.25rem", right: "1.25rem" });
    overlay.appendChild(closeBtn);
    document.body.appendChild(overlay);

    var expanded = false;
    function openCube() {
      expanded = true;
      overlay.hidden = false;
      overlay.style.display = "flex";
      overlay.insertBefore(stage, closeBtn);
      /* scale the cube up as far as the smaller viewport side allows */
      var big = Math.min(1.6, Math.max(1, (Math.min(window.innerWidth, window.innerHeight) - 48) / STAGE));
      Object.assign(stage.style, {
        position: "relative", left: "auto", top: "auto",
        transform: "scale(" + big + ")", pointerEvents: "auto"
      });
      overlay.style.cursor = "grab";
      btn.setAttribute("aria-expanded", "true");
      closeBtn.focus();
    }
    function closeCube() {
      expanded = false;
      setActiveFace(null);
      overlay.hidden = true;
      overlay.style.display = "none";
      btn.appendChild(stage);
      Object.assign(stage.style, {
        position: "absolute", left: "50%", top: "50%",
        transform: "translate(-50%, -50%) scale(" + DOCK_SCALE + ")",
        pointerEvents: "none", cursor: ""
      });
      btn.setAttribute("aria-expanded", "false");
      btn.focus();
    }

    /* ---- kill the "click-through" ghost click (touch only) ----
       A face is chosen on pointerup, and closeCube() removes the overlay in
       that same handler. On touch the browser then fires a synthesized click
       at the same coordinates — and with the overlay already gone it lands on
       whatever project card sits underneath, opening it as well. (Desktop is
       immune: there the click target is derived from the still-present overlay
       at mousedown/up, not re-hit-tested afterwards.) So right before we close,
       we swallow exactly one upcoming click in the capture phase. */
    function swallowNextClick() {
      var cleanup = function () {
        window.removeEventListener("click", kill, true);
        clearTimeout(timer);
      };
      var kill = function (ev) {
        ev.stopPropagation();
        ev.preventDefault();
        cleanup();
      };
      var timer = setTimeout(cleanup, 700);
      window.addEventListener("click", kill, true);
    }

    btn.addEventListener("click", function () { if (!expanded) openCube(); });

    /* nudge the docked cube slightly larger on hover/focus so it reads as
       an interactive navigator, not decoration */
    function dockScale(s) {
      if (expanded) return;
      stage.style.transform = "translate(-50%, -50%) scale(" + s + ")";
    }
    btn.addEventListener("pointerenter", function () { dockScale(DOCK_SCALE_HOVER); });
    btn.addEventListener("pointerleave", function () { dockScale(DOCK_SCALE); });
    btn.addEventListener("focus", function () { dockScale(DOCK_SCALE_HOVER); });
    btn.addEventListener("blur", function () { dockScale(DOCK_SCALE); });
    /* two ways out: the ✕, or a tap on empty space beside the cube (handled in
       pointerup). Only a *tap* (no drag) closes, so a stray release while
       rotating the cube can't dismiss the navigator. ESC stays inert. */
    closeBtn.addEventListener("click", closeCube);

    var rotX = -20, rotY = 30;
    function updateCube() {
      scene.style.transform = "rotateX(" + rotX + "deg) rotateY(" + rotY + "deg)";
      var d = roundedHullPath(convexHull(projectCorners(rotX, rotY)), CORNER_R);
      hullPath.setAttribute("d", d);
      shadowPath.setAttribute("d", d);
    }

    /* drag to rotate — anywhere on the open overlay (except the ✕),
       so the cube steers easily without having to grab it precisely */
    var draggingCube = false, movedCube = false, prevX = 0, prevY = 0;
    /* touch has no hover, so light the face under the finger by hit-testing */
    function touchFaceAt(e) {
      if (!e.pointerType || e.pointerType === "mouse") return;
      var h = document.elementFromPoint(e.clientX, e.clientY);
      setActiveFace(h && h.closest ? h.closest("[data-face-target]") : null);
    }
    overlay.addEventListener("pointerdown", function (e) {
      if (e.target === closeBtn) return;
      e.preventDefault();
      draggingCube = true;
      movedCube = false;
      prevX = e.clientX; prevY = e.clientY;
      overlay.style.cursor = "grabbing";
      touchFaceAt(e);
    });
    stage.addEventListener("dragstart", function (e) { e.preventDefault(); });
    window.addEventListener("pointermove", function (e) {
      if (!draggingCube) return;
      var dx = e.clientX - prevX, dy = e.clientY - prevY;
      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) movedCube = true;
      rotY += dx * 0.4;
      rotX -= dy * 0.4;
      prevX = e.clientX; prevY = e.clientY;
      updateCube();
      touchFaceAt(e);
    });
    window.addEventListener("pointerup", function (e) {
      if (!draggingCube) return;
      draggingCube = false;
      overlay.style.cursor = "grab";
      if (movedCube) { setActiveFace(null); return; }
      /* tap without drag = navigate to the tapped face's section */
      var hit = document.elementFromPoint(e.clientX, e.clientY);
      var face = hit && hit.closest ? hit.closest("[data-face-target]") : null;
      if (!face) {
        /* a tap on empty space beside the cube closes the navigator (the ✕
           still works too); a tap on the cube body between faces leaves it open */
        if (hit && !stage.contains(hit)) { swallowNextClick(); closeCube(); }
        return;
      }
      var anchor = face.getAttribute("data-face-target");
      var section = document.querySelector(anchor);
      swallowNextClick();
      closeCube();
      if (section) section.scrollIntoView({ behavior: stillCube ? "auto" : "smooth", block: "start" });
      else location.href = "home.html" + anchor;
    });

    /* idle spin — gentle in the pill, calmer when expanded */
    if (!stillCube) {
      (function idle() {
        requestAnimationFrame(idle);
        if (!draggingCube) {
          rotY += expanded ? 0.15 : 0.3;
          updateCube();
        }
      })();
    }
    updateCube();
  })();

  /* ---------- cursor gradient dot (clean theme, fine pointers) ----------
     A soft pink glow eases along behind the pointer — the clean theme's
     lone spot of colour, made kinetic. Skipped on touch / coarse pointers
     and when reduced motion is requested. */
  (function () {
    if (document.documentElement.getAttribute("data-theme") !== "clean") return;
    if (!window.matchMedia("(pointer: fine)").matches) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    var dot = document.createElement("div");
    dot.className = "cursor-glow";
    dot.setAttribute("aria-hidden", "true");
    document.body.appendChild(dot);

    var tx = 0, ty = 0, x = 0, y = 0, primed = false;
    window.addEventListener("pointermove", function (e) {
      if (e.pointerType && e.pointerType !== "mouse") return;
      tx = e.clientX; ty = e.clientY;
      if (!primed) { primed = true; x = tx; y = ty; dot.style.opacity = "1"; }
    });
    document.addEventListener("mouseleave", function () { dot.style.opacity = "0"; });

    (function follow() {
      requestAnimationFrame(follow);
      x += (tx - x) * 0.18;
      y += (ty - y) * 0.18;
      dot.style.transform = "translate(-50%, -50%) translate(" + x + "px, " + y + "px)";
    })();
  })();

  /* ---------- photography carousel (always active) ----------
     Buttons jump to the neighbouring print's exact snap position;
     scrolling to a non-snap offset would fight the mandatory snap.
     Past either end the index wraps around, so every carousel loops. */
  document.querySelectorAll(".photo-carousel").forEach(function (car) {
    var track = car.querySelector(".photo-carousel__track");
    if (!track) return;

    function go(dir) {
      var items = Array.prototype.slice.call(track.querySelectorAll(".print"));
      if (!items.length) return;
      var mid = track.scrollLeft + track.clientWidth / 2;
      var idx = 0, best = Infinity;
      items.forEach(function (it, i) {
        var d = Math.abs(it.offsetLeft + it.offsetWidth / 2 - mid);
        if (d < best) { best = d; idx = i; }
      });
      var target = items[(idx + dir + items.length) % items.length];
      /* direct assignment + CSS scroll-behavior: smooth — programmatic
         smooth scrolling gets cancelled by mandatory snap in some engines */
      track.scrollLeft = target.offsetLeft + target.offsetWidth / 2 - track.clientWidth / 2;
    }

    var prev = car.querySelector(".carousel-btn--prev");
    var next = car.querySelector(".carousel-btn--next");
    if (prev) prev.addEventListener("click", function () { go(-1); });
    if (next) next.addEventListener("click", function () { go(1); });

    /* arrow keys move the focused track print by print */
    track.addEventListener("keydown", function (e) {
      if (e.key === "ArrowRight") { e.preventDefault(); go(1); }
      if (e.key === "ArrowLeft") { e.preventDefault(); go(-1); }
    });
  });

  /* ---------- photography lightbox (always active) ----------
     Click a print to view it big; backdrop / ESC close, arrows navigate.
     Built entirely in JS so the page stays clean without it. */
  (function () {
    var section = document.querySelector(".photography");
    if (!section) return;
    var imgs = Array.prototype.slice.call(section.querySelectorAll(".photo-carousel__track img"));
    if (!imgs.length) return;

    var box = document.createElement("div");
    box.className = "lightbox";
    box.setAttribute("role", "dialog");
    box.setAttribute("aria-modal", "true");
    box.setAttribute("aria-label", "Photo viewer");
    box.hidden = true;
    box.innerHTML =
      '<button class="carousel-btn lightbox__close" type="button" aria-label="Close photo viewer">✕</button>' +
      '<button class="carousel-btn lightbox__prev" type="button" aria-label="Previous photo">←</button>' +
      '<figure class="lightbox__stage"><img class="lightbox__img" alt=""><figcaption class="lightbox__count"></figcaption></figure>' +
      '<button class="carousel-btn lightbox__next" type="button" aria-label="Next photo">→</button>';
    document.body.appendChild(box);

    var big = box.querySelector(".lightbox__img");
    var counter = box.querySelector(".lightbox__count");
    var current = 0;
    var lastFocus = null;

    function show(i) {
      current = (i + imgs.length) % imgs.length;
      big.src = imgs[current].currentSrc || imgs[current].src;
      big.alt = imgs[current].alt;
      counter.textContent = (current + 1) + " / " + imgs.length;
    }
    function open(i) {
      lastFocus = document.activeElement;
      show(i);
      box.hidden = false;
      document.body.classList.add("lightbox-open");
      box.querySelector(".lightbox__close").focus();
    }
    function close() {
      box.hidden = true;
      document.body.classList.remove("lightbox-open");
      if (lastFocus && lastFocus.focus) lastFocus.focus();
    }

    imgs.forEach(function (img, i) {
      var print = img.closest(".print") || img;
      print.setAttribute("tabindex", "0");
      print.setAttribute("role", "button");
      print.setAttribute("aria-label", "Enlarge photo: " + img.alt);
      print.addEventListener("click", function () { open(i); });
      print.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(i); }
      });
    });

    box.addEventListener("click", function (e) { if (e.target === box) close(); });
    box.querySelector(".lightbox__close").addEventListener("click", close);
    box.querySelector(".lightbox__prev").addEventListener("click", function () { show(current - 1); });
    box.querySelector(".lightbox__next").addEventListener("click", function () { show(current + 1); });

    document.addEventListener("keydown", function (e) {
      if (box.hidden) return;
      if (e.key === "Escape") close();
      if (e.key === "ArrowLeft") show(current - 1);
      if (e.key === "ArrowRight") show(current + 1);
      if (e.key === "Tab") {
        /* keep focus cycling inside the dialog */
        var btns = box.querySelectorAll("button");
        var first = btns[0], last = btns[btns.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });
  })();

  /* ---------- language toggle EN ⇄ DE (always active) ----------
     One central dictionary keyed by whitespace-normalized English text
     (curly quotes/apostrophes flattened to straight ones). A tree walker
     swaps matching text nodes in place and restores the original English
     on toggle. New page copy must get a dictionary entry here, otherwise
     it simply stays English. Hashtags/keywords are deliberately not
     translated (#PRODUCTDESIGNER / #PROBLEMSOLVER stay as they are). */
  (function () {
    var btn = document.getElementById("langToggle");
    if (!btn) return;

    var DICT = {
      /* --- shared: header / nav / cube --- */
      "Skip to content": "Zum Inhalt springen",
      "product": "produkt",
      "experience": "erfahrung",
      "social": "sozial",
      "photography": "fotografie",
      "about": "über mich",
      "say hi": "sag hallo",

      /* --- shared: footer / project scaffolding --- */
      "got a wild idea? a stage? a factory? ↓": "eine wilde idee? eine bühne? eine fabrik? ↓",
      "made with care, tape & hot pink": "gemacht mit sorgfalt, klebeband & hot pink",
      "location": "standort",
      "contact": "kontakt",
      "Wien, Austria": "Wien, Österreich",
      "St. Gallen, Switzerland": "St. Gallen, Schweiz",
      "Interdisciplinary designer & project lead — between the workshop, the museum and the football pitch.": "Interdisziplinärer Designer & Projektleiter — zwischen Werkstatt, Museum und Fußballplatz.",
      "next project ↓": "nächstes projekt ↓",
      "in cooperation with": "in kooperation mit",
      "← back to product": "← zurück zu produkt",
      "← back to experience": "← zurück zu erfahrung",
      "← back to social": "← zurück zu sozial",

      /* --- index: hero --- */
      "✳ Wien · St. Gallen — open for projects": "✳ Wien · St. Gallen — offen für projekte",
      "Interdisciplinary": "Interdisziplinärer",
      "designer": "Designer",
      "project lead": "Projektleiter",
      "— turning technical precision and social dynamics into products, spaces and cultural moments.": "— ich mache aus technischer Präzision und sozialen Dynamiken Produkte, Räume und kulturelle Momente.",
      "see the work": "arbeit ansehen",

      /* --- index: intro / services --- */
      "I help organizations": "Ich helfe Organisationen,",
      "visualize innovation": "Innovation sichtbar zu machen",
      "and execute": "und",
      "complex cultural projects": "komplexe Kulturprojekte umzusetzen",
      "— combining technical precision with a deep understanding of": "— technische Präzision kombiniert mit einem tiefen Verständnis für",
      "social dynamics": "soziale Dynamiken",
      "Professional product development — from first sketch to production-ready CAD and photoreal rendering.": "Professionelle Produktentwicklung — von der ersten Skizze bis zu produktionsreifem CAD und fotorealistischem Rendering.",
      "Social Design Strategy": "Social-Design-Strategie",
      "Community-driven projects at the intersection of art and urban life — designed with people, not just for them.": "Community-getriebene Projekte an der Schnittstelle von Kunst und Stadtleben — gestaltet mit Menschen, nicht nur für sie.",
      "Participation · Curation · Research": "Partizipation · Kuration · Recherche",
      "Project Management": "Projektmanagement",
      "Budgets, stakeholders and interdisciplinary teams — carried from first vision to public launch.": "Budgets, Stakeholder und interdisziplinäre Teams — begleitet von der ersten Vision bis zum öffentlichen Launch.",
      "Fundings · Stakeholders · Launch": "Förderungen · Stakeholder · Launch",

      /* --- index: product --- */
      "Industrial design with an engineer's patience — modelled, rendered, prototyped, shipped.": "Industriedesign mit der Geduld eines Ingenieurs — modelliert, gerendert, prototypisiert, ausgeliefert.",
      "A versatile collection of 3D modeling and photorealistic rendering projects showcasing technical expertise in product and interior design.": "Eine vielseitige Sammlung von 3D-Modelling- und fotorealistischen Rendering-Projekten — technisches Know-how in Produkt- und Interiordesign.",
      "An award-winning, high-speed Hyperloop pod featuring custom linear induction motors and a lightweight carbon structure developed at ETH Zurich.": "Ein preisgekrönter High-Speed-Hyperloop-Pod mit eigens entwickelten Linear-Induktionsmotoren und leichter Carbonstruktur, entwickelt an der ETH Zürich.",
      "A hybrid bicycle pedal that seamlessly integrates safety lighting and a mechanical anti-theft locking mechanism into a single, streamlined component.": "Ein hybrides Fahrradpedal, das Sicherheitsbeleuchtung und ein mechanisches Diebstahlschloss nahtlos in einem einzigen Bauteil vereint.",
      "A modular, 3D-printed football that utilizes integrated magnets to function as an interactive puzzle, a tactile fidget toy, or a minimalist design object.": "Ein modularer, 3D-gedruckter Fußball mit integrierten Magneten — interaktives Puzzle, taktiles Fidget Toy und minimalistisches Designobjekt zugleich.",

      /* --- index: experience --- */
      "Curated events, installations and collective experiments — the master-of-disaster department.": "Kuratierte Events, Installationen und kollektive Experimente — die Master-of-Disaster-Abteilung.",
      "A curated social and physical arena that utilizes physical training and artistic performance to explore radical proximity, vulnerability, and the boundaries of consent.": "Eine kuratierte soziale und körperliche Arena, die Training und künstlerische Performance nutzt, um radikale Nähe, Verletzlichkeit und die Grenzen von Konsens zu erforschen.",
      "view project": "projekt ansehen",
      "A critical design installation that uses the aesthetic of a public bath to confront users with the impact of the global fashion industry and promote reflection on individual consumption habits.": "Eine Critical-Design-Installation, die mit der Ästhetik eines öffentlichen Bades den Einfluss der globalen Modeindustrie erfahrbar macht und zur Reflexion über das eigene Konsumverhalten anregt.",
      "An immersive multimedia exhibition and event series that merges grassroots football culture with contemporary photography and live music performances in the heart of Floridsdorf.": "Eine immersive Multimedia-Ausstellung und Eventreihe, die Grassroots-Fußballkultur mit zeitgenössischer Fotografie und Live-Musik im Herzen von Floridsdorf verbindet.",
      "A design collective that challenges the perfectionism of a performance-driven society through \"Naïv-Design,\" prioritizing intuition, humor, and the spontaneous joy of creation over rigid functionality.": "Ein Designkollektiv, das mit „Naïv-Design“ den Perfektionismus der Leistungsgesellschaft herausfordert — Intuition, Humor und spontane Schaffensfreude statt starrer Funktionalität.",

      /* --- index: social --- */
      "Design as a public tool — teaching, speculating and experimenting with communities.": "Design als öffentliches Werkzeug — lehren, spekulieren und experimentieren mit Communities.",
      "Speculative workshops and a \"Farm to Fork\" dinner exploring the food cultures of tomorrow — visions preserved as vacuum-sealed reflections.": "Spekulative Workshops und ein „Farm to Fork“-Dinner zu den Esskulturen von morgen — Visionen, vakuumiert konserviert.",
      "Empowering secondary-school students to critically analyze packaging through field research and AI-generated emotional imagery.": "Schüler:innen analysieren Verpackungen kritisch — mit Feldforschung und KI-generierten, emotionalen Bildern.",
      "Football as a \"physical intervention\" that lets young people practically experience and co-design democratic values and decision-making.": "Fußball als „physische Intervention“: Junge Menschen erleben und gestalten demokratische Werte und Entscheidungen ganz praktisch.",
      "Material research that transforms synthetic textile waste into reusable building blocks against the ecological impact of clothing exports.": "Materialforschung, die synthetische Textilabfälle in wiederverwendbare Bausteine verwandelt — gegen die ökologischen Folgen von Kleiderexporten.",

      /* --- index: photography --- */
      "#portrait #product #art #master — prints from the studio darkroom.": "#portrait #product #art #master — prints aus der studio-dunkelkammer.",

      /* --- index: about --- */
      "Interdisciplinary designer holding a": "Interdisziplinärer Designer mit einem",
      "Master's degree": "Master-Abschluss",
      "from the University of Applied Arts Vienna and a": "der Universität für angewandte Kunst Wien und einem",
      "Bachelor's degree": "Bachelor-Abschluss",
      "from the Zurich University of the Arts. Specialized in bridging the gap between technical product design (CAD/3D) and socially impactful Social Design. Expert in leading complex projects at the intersection of art, technology, and urban innovation.": "der Zürcher Hochschule der Künste. Spezialisiert darauf, die Lücke zwischen technischem Produktdesign (CAD/3D) und gesellschaftlich wirksamem Social Design zu schließen. Erfahren in der Leitung komplexer Projekte an der Schnittstelle von Kunst, Technologie und urbaner Innovation.",
      "Graphic": "Grafik",
      "Languages": "Sprachen",
      "DE (native) · EN (C1)": "DE (Muttersprache) · EN (C1)",
      "Cycling": "Radfahren",
      "hands-free": "freihändig",
      "download CV": "CV herunterladen",
      "download portfolio": "portfolio herunterladen",
      "CV — the paper trail": "CV — die papierspur",
      "Education": "Ausbildung",
      "MA Social Design — Arts as Urban Innovation": "MA Social Design — Arts as Urban Innovation",
      "University of Applied Arts · Vienna · 2023 — 2025": "Universität für angewandte Kunst · Wien · 2023 — 2025",
      "Focus: systemic and participatory design.": "Fokus: systemisches und partizipatives Design.",
      "BA Industrial / Product Design": "BA Industrie- / Produktdesign",
      "Zurich University of the Arts (ZHdK) · 2016 — 2020": "Zürcher Hochschule der Künste (ZHdK) · 2016 — 2020",
      "Focus: product development, CAD design and manufacturing technology.": "Fokus: Produktentwicklung, CAD-Design und Fertigungstechnik.",
      "Also true": "Auch wahr",
      "further": "außerdem",
      "Archives, graphics & hospitality": "Archive, Grafik & Gastfreundschaft",
      "Architectural archivist, graphic design intern, professional photography — plus eight years of high-volume hosting at Plaza Bar Zurich and bar leadership at Vibez St. Gallen.": "Architekturarchivar, Grafikdesign-Praktikant, professionelle Fotografie — plus acht Jahre Hochbetrieb als Gastgeber in der Plaza Bar Zürich und Barleitung im Vibez St. Gallen.",
      "Experience": "Erfahrung",
      "selected": "auswahl",
      "Project Manager — Kulturverein 1210": "Projektmanager — Kulturverein 1210",
      "Vienna · 2025 — 2026": "Wien · 2025 — 2026",
      "Directing interdisciplinary cultural projects; curation, event management and stakeholder communication; budgets and public grants incl. European Capital of Democracy Vienna.": "Leitung interdisziplinärer Kulturprojekte; Kuration, Eventmanagement und Stakeholder-Kommunikation; Budgets und öffentliche Förderungen inkl. European Capital of Democracy Vienna.",
      "Project-Based Teaching — Museum für Gestaltung": "Projektbasierter Unterricht — Museum für Gestaltung",
      "Zurich · 2021 — 2022": "Zürich · 2021 — 2022",
      "Workshop design under the \"Museumjung\" framework; translating design theory into accessible, critical formats.": "Workshop-Design im Rahmen von „Museumjung“; Designtheorie übersetzt in zugängliche, kritische Formate.",
      "Freelance Designer & Co-Founder — slightly Studio": "Freier Designer & Mitgründer — slightly Studio",
      "Zurich · 2019 — 2023": "Zürich · 2019 — 2023",
      "Studio leadership around \"Naïv Design\" and experimental products; grants acquired to sustain creative research.": "Studioleitung rund um „Naïv Design“ und experimentelle Produkte; Förderungen eingeworben, um kreative Forschung zu tragen.",
      "Industrial Designer — Swissloop": "Industriedesigner — Swissloop",
      "ETH Zurich · 2018 — 2019": "ETH Zürich · 2018 — 2019",
      "Co-developed an innovative Hyperloop pod; multiple industry prizes at the European Hyperloop Week.": "Mitentwicklung eines innovativen Hyperloop-Pods; mehrere Industriepreise bei der European Hyperloop Week.",

      /* --- index: collaborations --- */
      "collaborations & fundings": "kollaborationen & förderungen",
      "the good company this work has kept": "die gute gesellschaft dieser arbeit",

      /* --- random 3D --- */
      "A diverse collection of 3D modeling and rendering projects spanning product and interior design. This ongoing series demonstrates technical versatility across various industrial design tools to create high-fidelity digital visualizations.": "Eine vielfältige Sammlung von 3D-Modelling- und Rendering-Projekten aus Produkt- und Interiordesign. Diese fortlaufende Serie zeigt technische Vielseitigkeit über verschiedene Industriedesign-Tools hinweg — für hochwertige digitale Visualisierungen.",

      /* --- 1210 Pop-Up --- */
      "Lead on scenography and curation, I transformed a local space into an urban hub for the football and culture club 1210 Wien. The project turned a traditional photo exhibition into a three-day community event (Nov 6–8, 2025), integrating local musical talent with a distinct visual language that celebrates the intersection of sport, art, and district identity.": "Verantwortlich für Szenografie und Kuration habe ich einen lokalen Raum in einen urbanen Treffpunkt für den Fußball- und Kulturverein 1210 Wien verwandelt. Das Projekt machte aus einer klassischen Fotoausstellung ein dreitägiges Community-Event (6.–8. Nov 2025) — mit lokalen Musiktalenten und einer eigenständigen visuellen Sprache, die die Schnittstelle von Sport, Kunst und Bezirksidentität feiert.",
      "Working as the lead project manager and scenographer, I designed this exhibition to serve as a physical manifesto for the club's motto: \"Fussball. Kunst. Kultur.\" Hosted at Schleifgasse 11, the project aimed to create a low-threshold cultural space that feels as authentic as a locker room but as curated as a contemporary gallery.": "Als leitender Projektmanager und Szenograf habe ich diese Ausstellung als physisches Manifest für das Vereinsmotto „Fussball. Kunst. Kultur.“ gestaltet. In der Schleifgasse 11 entstand ein niederschwelliger Kulturraum — so authentisch wie eine Umkleidekabine, so kuratiert wie eine zeitgenössische Galerie.",
      "Immersive Scenography.": "Immersive Szenografie.",
      "The room design translated football's visual DNA into an urban gallery setting, featuring high-contrast black-and-white checkered walls, yellow accents, and a football net suspended across the ceiling to define the space.": "Das Raumdesign übersetzte die visuelle DNA des Fußballs in eine urbane Galerie — mit kontrastreichen schwarz-weiß karierten Wänden, gelben Akzenten und einem Fußballnetz, das unter der Decke den Raum definiert.",
      "Curated Event Series.": "Kuratierte Eventreihe.",
      "Rather than a static display, the exhibition functioned as a stage. I curated a lineup of local music artists who performed live, transforming the viewing experience into a vibrant social event that attracted a diverse neighborhood audience.": "Statt einer statischen Schau funktionierte die Ausstellung als Bühne. Ich kuratierte ein Line-up lokaler Musiker:innen, die live auftraten — aus dem Ausstellungsbesuch wurde ein lebendiges soziales Event für ein vielfältiges Publikum aus der Nachbarschaft.",
      "Tactile Installation.": "Taktile Installation.",
      "To bridge the gap between art and play, I integrated a patch of artificial turf with a goal-like setup and footballs, encouraging visitors of all ages—from local children to club veterans—to physically interact with the space.": "Um Kunst und Spiel zu verbinden, integrierte ich ein Stück Kunstrasen mit Tor-Aufbau und Fußbällen — Besucher:innen jeden Alters, vom Kind aus dem Viertel bis zum Vereinsveteranen, konnten den Raum körperlich erleben.",
      "Visual Documentation.": "Visuelle Dokumentation.",
      "The walls showcased portraits and snapshots of the 1210 community, documenting the faces and places that define the club's presence in Vienna's 21st district.": "Die Wände zeigten Porträts und Schnappschüsse der 1210-Community — Gesichter und Orte, die die Präsenz des Vereins im 21. Wiener Bezirk prägen.",
      "Identity & Merch.": "Identität & Merch.",
      "The exhibition also functioned as a flagship for the club's aesthetic, incorporating a presentation of \"1210 Wien\" merchandise (shirts, sweaters) and local products (branded wine), creating a holistic brand experience for the visitors.": "Die Ausstellung war zugleich Flagship für die Ästhetik des Vereins — mit „1210 Wien“-Merchandise (Shirts, Sweater) und lokalen Produkten (eigener Wein) als ganzheitliches Markenerlebnis.",
      "Social Cohesion.": "Sozialer Zusammenhalt.",
      "By blending sport-related visuals with artistic performances, the project successfully created a meeting point for different social groups, fostering community pride and cultural exchange within Floridsdorf.": "Durch die Mischung aus Sport-Visuals und künstlerischen Performances entstand ein Treffpunkt für unterschiedliche soziale Gruppen — Community-Stolz und kultureller Austausch mitten in Floridsdorf.",

      /* --- Kick&Vote --- */
      "As the project lead for 1210 Wien, I developed \"Kick&Vote\" as a response to digital passivity, using the football pitch as an experiential space for co-determination. Funded by the Democracy Capital Vienna, the project engaged youth in Floridsdorf to explore social barriers, negotiate collective rules, and take active responsibility for their local community.": "Als Projektleiter für 1210 Wien habe ich „Kick&Vote“ als Antwort auf digitale Passivität entwickelt — der Fußballplatz als Erfahrungsraum für Mitbestimmung. Gefördert von der Demokratiehauptstadt Wien beschäftigte das Projekt Jugendliche in Floridsdorf damit, soziale Barrieren zu erkunden, gemeinsame Regeln auszuhandeln und aktiv Verantwortung für ihre Nachbarschaft zu übernehmen.",
      "Democratic Rule-Making.": "Demokratische Regelfindung.",
      "Through tournaments and workshops, participants were encouraged to question traditional football rules and develop new, collective game forms that prioritize inclusion and shared decision-making.": "In Turnieren und Workshops hinterfragten die Teilnehmenden klassische Fußballregeln und entwickelten neue, kollektive Spielformen, die Inklusion und gemeinsames Entscheiden in den Mittelpunkt stellen.",
      "Critical Social Discourse.": "Kritischer gesellschaftlicher Diskurs.",
      "The project extended beyond play, including a film screening of Offside to facilitate discussions on cultural barriers, political frameworks, and the systemic disadvantage of women in sports.": "Über das Spiel hinaus gab es u. a. ein Screening des Films Offside — als Anstoß für Gespräche über kulturelle Barrieren, politische Rahmenbedingungen und die systematische Benachteiligung von Frauen im Sport.",
      "Bridging Urban Subcultures.": "Brücken zwischen urbanen Subkulturen.",
      "At the \"Underground\" pitch beneath the A22 motorway, the project hosted graffiti workshops that brought together sprayers, skaters, and footballers, fostering creative exchange across different social groups.": "Am „Underground“-Platz unter der A22 brachten Graffiti-Workshops Sprayer:innen, Skater:innen und Fußballer:innen zusammen — kreativer Austausch über soziale Gruppen hinweg.",
      "Public Interaction.": "Öffentliche Interaktion.",
      "Interactive posters and public interventions in shared spaces prompted youth to engage with the fundamental pillars of democracy in their everyday environment.": "Interaktive Plakate und Interventionen im öffentlichen Raum luden Jugendliche ein, sich im Alltag mit den Grundpfeilern der Demokratie auseinanderzusetzen.",
      "Empowerment & Sustainability.": "Empowerment & Nachhaltigkeit.",
      "The project culminated in a final tournament in January 2026. The two winning teams were awarded prize money to realize their own community projects in local youth centers, ensuring that the democratic principles experienced on the pitch lead to real-world impact.": "Den Abschluss bildete ein Finalturnier im Januar 2026. Die beiden Siegerteams erhielten Preisgelder, um eigene Community-Projekte in lokalen Jugendzentren umzusetzen — damit die auf dem Platz erlebten demokratischen Prinzipien echte Wirkung entfalten.",
      "Multidisciplinary Collaboration.": "Multidisziplinäre Zusammenarbeit.",
      "Realized in cooperation with partners such as Wiener Jugendzentren, Bahnfrei, and Fachstelle Demokratie, this project represents a holistic approach to social design and neighborhood activation.": "Realisiert mit Partnern wie den Wiener Jugendzentren, Bahnfrei und der Fachstelle Demokratie steht das Projekt für einen ganzheitlichen Ansatz von Social Design und Nachbarschaftsaktivierung.",

      /* --- Kleiderbad --- */
      "This experiential digital installation addresses the ecological crisis of the global fashion industry. By transforming old garments into immersive bathtubs, the project provides a space to confront the consequences of mass consumption through a meditative, sensory experience.": "Diese erfahrbare digitale Installation widmet sich der ökologischen Krise der globalen Modeindustrie. Alte Kleidung wird zu immersiven Badewannen — ein Raum, um sich den Folgen des Massenkonsums in einer meditativen, sinnlichen Erfahrung zu stellen.",
      "Immersive Installation.": "Immersive Installation.",
      "The project adopts the aesthetic of a bathhouse, where tubs filled with textiles invite visitors to engage sensually with the materials they often consume unconsciously.": "Das Projekt übernimmt die Ästhetik eines Badehauses: Mit Textilien gefüllte Wannen laden dazu ein, sich sinnlich mit Materialien auseinanderzusetzen, die wir oft unbewusst konsumieren.",
      "Spatial Design & Privacy.": "Raumdesign & Privatsphäre.",
      "The room is centered around a skylight, with four bathtubs arranged in a pentagon layout to ensure visitors feel protected and avoid direct eye contact, fostering a private space for reflection.": "Der Raum zentriert sich um ein Oberlicht; vier Badewannen im Pentagon-Layout sorgen dafür, dass sich Besucher:innen geschützt fühlen und direkten Blickkontakt vermeiden — ein privater Raum zur Reflexion.",
      "TexBrick Material Innovation.": "TexBrick-Materialinnovation.",
      "A core component of the project is \"TexBrick,\" a material developed through research into the environmental impact of synthetic textile waste on landfills and groundwater.": "Kernstück des Projekts ist „TexBrick“ — ein Material, entwickelt aus der Forschung zu den Umweltfolgen synthetischer Textilabfälle für Deponien und Grundwasser.",
      "Sustainable Research.": "Nachhaltige Forschung.",
      "Developed in collaboration with Timo Flury, the TexBrick experiments involved melting synthetic textile scraps with polypropylene (PP) to find a high-utility, reusable purpose for non-recyclable fibers.": "Gemeinsam mit Timo Flury entwickelt: In den TexBrick-Experimenten wurden synthetische Textilreste mit Polypropylen (PP) verschmolzen, um nicht recycelbaren Fasern einen nützlichen, wiederverwendbaren Zweck zu geben.",
      "Technical Execution.": "Technische Umsetzung.",
      "The installation was meticulously realized using Fusion360, Blender, and Photoshop to visualize a community space where visitors are reminded that while they \"sit in the same tub,\" they are individually responsible for their consumption footprints .": "Die Installation wurde detailliert mit Fusion360, Blender und Photoshop umgesetzt — ein Gemeinschaftsraum, der daran erinnert: Wir „sitzen in derselben Wanne“, sind aber individuell für unseren Konsum-Fußabdruck verantwortlich.",

      /* --- Love Fight Club --- */
      "This project transforms an intimate basement space into a provocative stage for curated events that challenge societal norms through the lens of physicality. Developed for the Wiener Festwochen, it creates a unique environment for community building through shared effort, dialogue, and performance.": "Dieses Projekt verwandelt einen intimen Kellerraum in eine provokante Bühne für kuratierte Events, die gesellschaftliche Normen durch die Linse der Körperlichkeit herausfordern. Entwickelt für die Wiener Festwochen entsteht ein einzigartiger Raum für Community-Building durch gemeinsame Anstrengung, Dialog und Performance.",
      "Love Fight Club (LFC) is both a physical venue and a social experiment designed to explore how physicality can serve as a gateway to feeling love in its most radical, unromanticized forms. Hosted in the basement of the Funkhaus as a response to the \"Republic of Love,\" this project provides an arena for controlled confrontation and embodied connection.": "Love Fight Club (LFC) ist Ort und soziales Experiment zugleich: Wie kann Körperlichkeit ein Zugang sein, Liebe in ihren radikalsten, unromantisierten Formen zu spüren? Im Keller des Funkhauses, als Antwort auf die „Republik der Liebe“, bietet das Projekt eine Arena für kontrollierte Konfrontation und verkörperte Verbindung.",
      "Multifaceted Programming.": "Vielseitiges Programm.",
      "The club hosts a diverse schedule of activities, ranging from boxing and wrestling activations to artistic performances, film screenings, and critical discussions on intimacy and masculinity.": "Der Club bespielt ein breites Programm — von Box- und Wrestling-Aktivierungen über künstlerische Performances und Filmscreenings bis zu kritischen Gesprächen über Intimität und Männlichkeit.",
      "A Manifesto of Proximity.": "Ein Manifest der Nähe.",
      "The project's core philosophy reclaims \"Fight\" as a tool for playful aggression and making power dynamics visible, while \"Love\" is reframed as a physical experience of radical proximity and mutual trust": "Die Kernphilosophie holt sich „Fight“ zurück — als Werkzeug für spielerische Aggression und das Sichtbarmachen von Machtdynamiken — während „Love“ als körperliche Erfahrung radikaler Nähe und gegenseitigen Vertrauens neu gerahmt wird",
      "Social Design at its Core.": "Social Design im Kern.",
      "As a Master's project in Social Design, LFC focuses on curation, spatial design, and community management to build a platform where connection is forged through shared sweat and dialogue .": "Als Masterprojekt im Social Design setzt LFC auf Kuration, Raumgestaltung und Community-Management — eine Plattform, auf der Verbindung durch gemeinsamen Schweiß und Dialog entsteht.",
      "Safety and Controlled Play.": "Sicherheit und kontrolliertes Spiel.",
      "LFC maintains strict boundaries to distance itself from real violence, instead creating a safe stage where controlled \"play\" with the elements of aggression can open new perspectives on empathy and care.": "LFC zieht klare Grenzen zu realer Gewalt und schafft stattdessen eine sichere Bühne, auf der kontrolliertes „Spiel“ mit Elementen der Aggression neue Perspektiven auf Empathie und Fürsorge öffnet.",
      "Collective Resistance.": "Kollektiver Widerstand.",
      "The club serves as a space for collective resistance, questioning rigid gender norms and performance-driven societal expectations through collective movement and presence.": "Der Club ist ein Raum kollektiven Widerstands — starre Geschlechternormen und Leistungsdruck werden durch gemeinsame Bewegung und Präsenz hinterfragt.",

      /* --- Light-Lock --- */
      "In the dense urban environments of Switzerland, the bicycle is an indispensable tool for mobility—yet theft and poor visibility remain constant challenges. LightLock addresses these issues by fundamentally rethinking the bicycle pedal as a multi-functional safety device.": "In den dichten urbanen Räumen der Schweiz ist das Fahrrad ein unverzichtbares Mobilitätswerkzeug — doch Diebstahl und schlechte Sichtbarkeit bleiben ständige Herausforderungen. LightLock denkt das Fahrradpedal grundlegend neu: als multifunktionales Sicherheitsgerät.",
      "Dynamic Visibility.": "Dynamische Sichtbarkeit.",
      "While riding, the integrated LEDs project a red cone of light onto the ground. This light area moves dynamically with the pedaling motion, significantly increasing the cyclist's visual footprint and safety in traffic.": "Während der Fahrt projizieren integrierte LEDs einen roten Lichtkegel auf den Boden. Diese Lichtfläche bewegt sich dynamisch mit der Tretbewegung und vergrößert sichtbare Präsenz — und damit Sicherheit — im Verkehr deutlich.",
      "Integrated Security.": "Integrierte Sicherheit.",
      "When the bike is stationary, the pedal serves as a primary lock. The angled arm is rotated between the wheel spokes and secured, locking the drivetrain and the lighting system simultaneously.": "Steht das Rad, wird das Pedal zum Hauptschloss: Der abgewinkelte Arm wird zwischen die Speichen gedreht und gesichert — Antrieb und Lichtsystem sind gleichzeitig verriegelt.",
      "Engineering & Development.": "Engineering & Entwicklung.",
      "Created in 2019 in collaboration with Nicola Borrer, the project focused on the radical optimization of essential bike parts.": "2019 gemeinsam mit Nicola Borrer entwickelt, fokussierte das Projekt auf die radikale Optimierung essenzieller Fahrradteile.",
      "Technical Precision.": "Technische Präzision.",
      "The design process utilized Solidworks and Keyshot, supported by FEM simulations to verify the structural integrity of the pedal and the locking mechanism under mechanical stress.": "Der Designprozess nutzte Solidworks und Keyshot, unterstützt von FEM-Simulationen, um die strukturelle Integrität von Pedal und Schließmechanismus unter mechanischer Last zu verifizieren.",

      /* --- Slightly Studio --- */
      "slightly Studio is a creative laboratory that values \"doing over thinking,\" producing objects that are intentionally \"only a little bit functional\" to reclaim the playful essence of the design process.": "slightly Studio ist ein kreatives Labor, das „Machen vor Denken“ stellt — mit Objekten, die absichtlich „nur ein bisschen funktional“ sind, um die spielerische Essenz des Designprozesses zurückzuerobern.",
      "Founded as a playful counterpoint to the meticulously structured and functional projects of academic design, slightly Studio focuses on humorous processes and fast, pragmatic solutions. Embracing the philosophy that \"Form Follows Fun,\" the studio creates \"slightly serious\" objects that encourage a decelerated, intuitive approach to making and experiencing design.": "Gegründet als spielerischer Gegenpol zu den akribisch strukturierten, funktionalen Projekten des akademischen Designs, setzt slightly Studio auf humorvolle Prozesse und schnelle, pragmatische Lösungen. Nach der Philosophie „Form Follows Fun“ entstehen „slightly serious“ Objekte, die zu einem entschleunigten, intuitiven Machen und Erleben von Design einladen.",
      "The \"Naïv-Design\" Manifesto.": "Das „Naïv-Design“-Manifest.",
      "The studio operates under a core set of guiding principles: being intuitive, simple, and \"felt from the gut,\" ensuring that the joy of doing always takes precedence over over-analytical perfectionism.": "Das Studio folgt einem Set an Leitprinzipien: intuitiv, einfach und „aus dem Bauch heraus“ — die Freude am Tun steht immer über überanalytischem Perfektionismus.",
      "Foundation with slightly sTable.": "Gründung mit slightly sTable.",
      "The studio's philosophy was first embodied by \"slightly sTable,\" a three-legged coffee table made of oak, steel pipes, and tennis balls, created out of a simple need for a living room table.": "Die Philosophie nahm zuerst Gestalt an als „slightly sTable“ — ein dreibeiniger Couchtisch aus Eiche, Stahlrohren und Tennisbällen, entstanden aus dem simplen Bedürfnis nach einem Wohnzimmertisch.",
      "Global Design Adventure.": "Globales Design-Abenteuer.",
      "The project \"slightly Adventure\" took the studio's vision on a motorcycle journey from Zurich to Bali, where spontaneous stops allowed for collaborative creation with local artisans along the way.": "Das Projekt „slightly Adventure“ brachte die Vision des Studios auf eine Motorradreise von Zürich nach Bali — spontane Stopps ermöglichten gemeinsames Gestalten mit lokalen Handwerker:innen entlang des Weges.",
      "Cross-Cultural Exchange (slightly sweet).": "Interkultureller Austausch (slightly sweet).",
      "In an opal workshop in Cappadocia, the team designed an opal ice cream cone; despite initial skepticism from the local masters, the project eventually united the entire workshop in a shared moment of creative enthusiasm.": "In einer Opal-Werkstatt in Kappadokien entwarf das Team eine Eistüte aus Opal; trotz anfänglicher Skepsis der lokalen Meister vereinte das Projekt am Ende die ganze Werkstatt in einem gemeinsamen Moment kreativer Begeisterung.",
      "Sustaining the Joy of Making.": "Die Freude am Machen erhalten.",
      "Supported by grants, the collective (Benjamin Amiel and Nicolà Borrer) continues to develop unique products that celebrate a different understanding of design, aiming to pass on their creative joy to a wider audience.": "Mit Förderungen im Rücken entwickelt das Kollektiv (Benjamin Amiel und Nicolà Borrer) weiter einzigartige Produkte, die ein anderes Designverständnis feiern — und ihre kreative Freude an ein breiteres Publikum weitergeben.",

      /* --- SnapBall --- */
      "An interactive design object that merges state-of-the-art additive manufacturing with a clever magnetic mechanism. Sold under the brand SnapBall, this project combines play, stress relief, and aesthetics into one iconic, geometric form.": "Ein interaktives Designobjekt, das modernste additive Fertigung mit einem cleveren Magnetmechanismus verbindet. Unter der Marke SnapBall vereint das Projekt Spiel, Stressabbau und Ästhetik in einer ikonischen, geometrischen Form.",
      "Precision Engineering & Manufacturing.": "Präzisions-Engineering & Fertigung.",
      "Each ball is produced using high-precision 3D printing. It consists of geometrically exact segments with hidden, high-performance neodymium magnets that allow for intuitive disassembly and a satisfying \"click\" during reassembly.": "Jeder Ball entsteht im hochpräzisen 3D-Druck. Er besteht aus geometrisch exakten Segmenten mit versteckten Hochleistungs-Neodym-Magneten — für intuitives Zerlegen und ein befriedigendes „Klick“ beim Zusammensetzen.",
      "Tactile Multi-functionality.": "Taktile Multifunktionalität.",
      "The object is designed for versatility. It serves as a challenging 3D puzzle, a soothing desk-side fidget toy, or—thanks to the magnetic segments—functional individual magnets. The tactile feedback of the magnets provides a unique haptic experience.": "Das Objekt ist auf Vielseitigkeit ausgelegt: forderndes 3D-Puzzle, beruhigendes Fidget Toy am Schreibtisch oder — dank der magnetischen Segmente — funktionale Einzelmagnete. Das taktile Feedback der Magnete sorgt für ein einzigartiges haptisches Erlebnis.",
      "Aesthetic Design Language.": "Ästhetische Designsprache.",
      "While staying true to the classic hexagonal-pentagonal DNA of a football, the characteristic 3D-printed surface texture adds a contemporary, technical aesthetic that elevates it to a piece of modern decor.": "Treu zur klassischen Hexagon-Pentagon-DNA des Fußballs fügt die charakteristische 3D-Druck-Textur eine zeitgemäße, technische Ästhetik hinzu — und macht ihn zum modernen Einrichtungsobjekt.",
      "Full-Cycle Product Management.": "Produktmanagement über den ganzen Zyklus.",
      "This project encompasses the entire product lifecycle, from the initial CAD construction and material testing to in-house production and global distribution via platforms like Etsy under the label SnapBall.": "Das Projekt umfasst den gesamten Produktlebenszyklus — von der ersten CAD-Konstruktion und Materialtests über die eigene Produktion bis zum weltweiten Vertrieb über Plattformen wie Etsy unter dem Label SnapBall.",

      /* --- Swissloop --- */
      "As part of a multidisciplinary team of approximately 25 students from ETH Zurich and other universities, I contributed to the independent design, manufacturing, and testing of a next-generation Hyperloop pod. The project focused on creating a functional, floating pod capable of revolutionizing long-distance mobility.": "Als Teil eines multidisziplinären Teams von rund 25 Studierenden der ETH Zürich und anderer Hochschulen habe ich an Design, Fertigung und Test eines Hyperloop-Pods der nächsten Generation mitgewirkt. Ziel war ein funktionaler, schwebender Pod, der die Langstreckenmobilität revolutionieren kann.",
      "Integrated Design Approach.": "Integrierter Designansatz.",
      "My contribution focused on Industrial and Graphic Design, bridging the gap between high-end engineering and a cohesive visual identity.": "Mein Beitrag lag im Industrie- und Grafikdesign — als Brücke zwischen High-End-Engineering und einer stimmigen visuellen Identität.",
      "Technological Innovation.": "Technologische Innovation.",
      "The pod features a custom-developed linear induction motor and modular subsystems designed for maximum efficiency and stability.": "Der Pod verfügt über einen eigens entwickelten Linear-Induktionsmotor und modulare Subsysteme für maximale Effizienz und Stabilität.",
      "Lightweight Engineering.": "Leichtbau-Engineering.",
      "The structure utilized a lightweight carbon fiber frame and a self-manufactured carbon fiber shell to minimize weight and optimize performance.": "Die Struktur setzte auf einen leichten Carbonrahmen und eine selbst gefertigte Carbonschale, um Gewicht zu minimieren und Performance zu optimieren.",
      "Award-Winning Excellence.": "Preisgekrönte Exzellenz.",
      "The pod's performance at the European Hyperloop Week 2021 in Valencia earned several prestigious honors, including awards for Best Electronic Subsystem, Best Propulsion, Best Levitation, and Best Overall Design.": "Bei der European Hyperloop Week 2021 in Valencia holte der Pod mehrere renommierte Auszeichnungen — u. a. für Best Electronic Subsystem, Best Propulsion, Best Levitation und Best Overall Design.",
      "Industry Recognition.": "Anerkennung aus der Industrie.",
      "The team also received industry awards for power electronics from Nevomo and thermal management from Würth Elektronik.": "Zudem erhielt das Team Industriepreise für Leistungselektronik von Nevomo und Thermomanagement von Würth Elektronik.",
      "Design Ecosystem.": "Design-Ökosystem.",
      "The development process was supported by professional design and visualization tools, including Fusion360, Keyshot, InDesign, and Sketchbook.": "Der Entwicklungsprozess wurde von professionellen Design- und Visualisierungstools getragen — darunter Fusion360, Keyshot, InDesign und Sketchbook.",

      /* --- Tex-Brick --- */
      "TexBrick is an industrial design and geo-design project that addresses the environmental crisis of discarded synthetic clothing. By combining textile scraps with recycled polypropylene, the project creates a functional composite material that offers a sustainable alternative to the pollution caused by textile landfills in developing countries.": "TexBrick ist ein Industriedesign- und Geo-Design-Projekt zur Umweltkrise ausrangierter synthetischer Kleidung. Aus Textilresten und recyceltem Polypropylen entsteht ein funktionaler Verbundwerkstoff — eine nachhaltige Alternative zur Verschmutzung durch Textildeponien in Entwicklungsländern.",
      "TexBrick began as an investigation into the lifecycle of synthetic used clothing and its devastating impact on the environment. When textiles are exported and discarded in developing countries, they often end up in landfills where erosion releases synthetic fibers into the groundwater, contaminating entire ecosystems.": "TexBrick begann als Untersuchung des Lebenszyklus synthetischer Altkleider und ihrer verheerenden Umweltfolgen. Werden Textilien in Entwicklungsländer exportiert und entsorgt, landen sie oft auf Deponien, wo Erosion synthetische Fasern ins Grundwasser freisetzt und ganze Ökosysteme kontaminiert.",
      "Environmental Context.": "Ökologischer Kontext.",
      "The project highlights the dual problem of ecological pollution from textile waste and the destruction of local textile industries in the Global South due to the second-hand market.": "Das Projekt zeigt das doppelte Problem: ökologische Verschmutzung durch Textilabfälle und die Zerstörung lokaler Textilindustrien im Globalen Süden durch den Secondhand-Markt.",
      "Material Experimentation.": "Materialexperimente.",
      "Developed in 2019 in collaboration with Timo Flury, the research involved a series of experiments to find a new, durable purpose for synthetic rags.": "2019 gemeinsam mit Timo Flury entwickelt, umfasste die Forschung eine Reihe von Experimenten, um synthetischen Lumpen einen neuen, langlebigen Zweck zu geben.",
      "Technical Process.": "Technischer Prozess.",
      "The team experimented with melting textiles using their own plastic content and testing various natural binders, ultimately concluding that Polypropylene (PP) offered the best results.": "Das Team experimentierte mit dem Schmelzen von Textilien über ihren eigenen Kunststoffanteil und testete verschiedene natürliche Bindemittel — am Ende lieferte Polypropylen (PP) die besten Ergebnisse.",
      "Recycling Potential.": "Recyclingpotenzial.",
      "By using PP—a plastic with a low melting point and high recycling potential—the process creates solid blocks from varied textile scraps.": "Mit PP — einem Kunststoff mit niedrigem Schmelzpunkt und hohem Recyclingpotenzial — entstehen aus unterschiedlichsten Textilresten massive Blöcke.",
      "Design Tools.": "Design-Tools.",
      "The project's conceptualization and visual series of experimental blocks were realized using Onshape and Keyshot.": "Konzeption und visuelle Serie der Experimentalblöcke entstanden mit Onshape und Keyshot.",
      "TexBrick represents a shift toward \"Geo-Design,\" where the designer's role expands to include systemic solutions for global waste streams.": "TexBrick steht für einen Wandel hin zum „Geo-Design“ — die Rolle des Designers erweitert sich um systemische Lösungen für globale Abfallströme.",

      /* --- Verpackung Verpackung --- */
      "How does packaging influence our choices, and what remains once the product is gone?. This project was designed as a \"Project Instruction\" (Projektunterricht) to engage youth with the visual and ecological impact of our consumption habits.": "Wie beeinflusst Verpackung unsere Entscheidungen — und was bleibt, wenn das Produkt weg ist? Dieses Projekt wurde als Projektunterricht konzipiert, um Jugendliche mit den visuellen und ökologischen Folgen unserer Konsumgewohnheiten zu beschäftigen.",
      "In cooperation with the Museum für Gestaltung Zürich, this project led students to examine everyday packaging through the lenses of sustainability, marketing, and design. By combining hands-on field research at waste facilities with DALL-E 2 image generation, the students transformed mundane trash into a subject of critical reflection and artistic analysis.": "In Kooperation mit dem Museum für Gestaltung Zürich untersuchten Schüler:innen Alltagsverpackungen durch die Linsen Nachhaltigkeit, Marketing und Design. Feldforschung in Entsorgungsanlagen kombiniert mit DALL-E-2-Bildgenerierung machte aus profanem Müll ein Thema kritischer Reflexion und künstlerischer Analyse.",
      "Multi-Perspective Analysis.": "Analyse aus mehreren Perspektiven.",
      "Students investigated current product packaging regarding sustainability, marketing, design, protection, and information content.": "Die Schüler:innen untersuchten aktuelle Produktverpackungen in Bezug auf Nachhaltigkeit, Marketing, Design, Schutz und Informationsgehalt.",
      "Structured Field Research.": "Strukturierte Feldforschung.",
      "The process included photographic documentation, research walks to analyze real-world marketing, and a visit to the Hagenholz waste incineration plant in Zurich to witness the end of the packaging life cycle.": "Der Prozess umfasste fotografische Dokumentation, Recherche-Spaziergänge zur Analyse realer Werbung und einen Besuch der Kehrichtverwertungsanlage Hagenholz in Zürich — das Ende des Verpackungslebenszyklus live.",
      "AI Imagery (DALL-E 2).": "KI-Bilder (DALL-E 2).",
      "To explore the sensory and emotional side of design, students collected associations which were then translated by DALL-E 2 into images that visually mirror the \"mood\" of the packaging.": "Um die sinnliche und emotionale Seite von Design zu erkunden, sammelten die Schüler:innen Assoziationen, die DALL-E 2 in Bilder übersetzte — visuelle Spiegel der „Stimmung“ einer Verpackung.",
      "The Pattern Fans (Musterfächer).": "Die Musterfächer.",
      "The results were synthesized into physical \"Pattern Fans\" where products (like Coca-Cola or McDonald's fries) were rated using a 5-point symbol system for criteria such as Design, Sustainability, and Marketing.": "Die Ergebnisse wurden zu physischen Musterfächern verdichtet, in denen Produkte (wie Coca-Cola oder McDonald's-Pommes) mit einem 5-Punkte-Symbolsystem nach Kriterien wie Design, Nachhaltigkeit und Marketing bewertet wurden.",
      "DesignScouts Exhibition.": "DesignScouts-Ausstellung.",
      "The project culminated in a public presentation of the findings and the created fans at the Museum für Gestaltung Zürich.": "Den Abschluss bildete eine öffentliche Präsentation der Ergebnisse und Fächer im Museum für Gestaltung Zürich.",

      /* --- Food for Future Thoughts --- */
      "What will we eat in the future, and how do we imagine that future today? Food for Future Thoughts is an experimental mediation project designed to involve young people as active participants in the discourse on future food culture.": "Was essen wir in Zukunft — und wie stellen wir uns diese Zukunft heute vor? Food for Future Thoughts ist ein experimentelles Vermittlungsprojekt, das junge Menschen als aktive Teilnehmende in den Diskurs über zukünftige Esskultur einbindet.",
      "This experiential and speculative design project, developed in collaboration with culinary and fashion students, explores how our dietary needs and interests might evolve. Through workshops and a \"Farm to Fork\" banquet, the project preserves the thoughts and culinary identities of young people, making their visions for the future of food tangible.": "Dieses erfahrungsbasierte, spekulative Designprojekt — entwickelt mit Gastronomie- und Mode-Studierenden — erkundet, wie sich unsere Ernährungsbedürfnisse und Interessen entwickeln könnten. In Workshops und einem „Farm to Fork“-Bankett konserviert das Projekt Gedanken und kulinarische Identitäten junger Menschen und macht ihre Visionen für die Zukunft des Essens greifbar.",
      "Collaborative Workshops.": "Kollaborative Workshops.",
      "In partnership with gastronomy students from HLMW9, the project used workshops to discuss the eating cultures of the past and present, exploring ways to preserve traditions while envisioning future perspectives.": "Gemeinsam mit Gastronomie-Schüler:innen der HLMW9 wurden in Workshops Esskulturen von gestern und heute diskutiert — wie lassen sich Traditionen bewahren und zugleich Zukunftsperspektiven entwerfen?",
      "Speculative Scenarios.": "Spekulative Szenarien.",
      "Using AI tools like Midjourney, the students' thoughts, fears, and priorities were translated into visual scenarios, revealing possible developments in future dietary habits and lifestyles.": "Mit KI-Tools wie Midjourney wurden Gedanken, Ängste und Prioritäten der Schüler:innen in visuelle Szenarien übersetzt — mögliche Entwicklungen künftiger Ess- und Lebensgewohnheiten.",
      "\"Farm to Fork\" Dinner: The process culminated in a self-organized banquet where various stations represented the cultural diversity of the class, merging traditional culinary skills with forward-looking ideas.": "„Farm to Fork“-Dinner: Der Prozess gipfelte in einem selbst organisierten Bankett, bei dem verschiedene Stationen die kulturelle Vielfalt der Klasse repräsentierten — traditionelles Küchenhandwerk trifft zukunftsgerichtete Ideen.",
      "The Act of Preservation.": "Der Akt des Konservierens.",
      "To \"conserve\" the event, individual thoughts, menu identities, and atmospheric impressions were vacuum-sealed, creating a metaphorical time capsule of the students' creativity and the evening's impact.": "Um den Abend zu „konservieren“, wurden einzelne Gedanken, Menü-Identitäten und atmosphärische Eindrücke vakuumiert — eine metaphorische Zeitkapsel der Kreativität der Schüler:innen und der Wirkung des Abends."
    };

    var swaps = null;

    function normalize(s) {
      return s
        .replace(/[‘’]/g, "'")
        .replace(/[“”„]/g, '"')
        .replace(/\s+/g, " ")
        .trim();
    }

    /* walk every text node once and remember both language versions,
       preserving the node's original leading/trailing whitespace */
    function collect() {
      swaps = [];
      var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
      var node;
      while ((node = walker.nextNode())) {
        var raw = node.nodeValue;
        var de = DICT[normalize(raw)];
        if (!de) continue;
        swaps.push({
          node: node,
          en: raw,
          de: raw.match(/^\s*/)[0] + de + raw.match(/\s*$/)[0]
        });
      }
    }

    function apply(lang) {
      if (!swaps) collect();
      swaps.forEach(function (s) { s.node.nodeValue = lang === "de" ? s.de : s.en; });
      document.documentElement.lang = lang;
      btn.textContent = lang === "de" ? "EN" : "DE";
      btn.setAttribute("aria-pressed", lang === "de" ? "true" : "false");
      try { localStorage.setItem("amiel-lang", lang); } catch (e) { /* storage blocked — session only */ }
    }

    var lang = "en";
    try { lang = localStorage.getItem("amiel-lang") || "en"; } catch (e) {}
    if (lang === "de") apply("de");

    btn.addEventListener("click", function () {
      lang = lang === "de" ? "en" : "de";
      apply(lang);
    });
  })();

  /* theme switch — "bold" (Die-Cut Studio) ⇄ "clean" (Quiet Editorial).
     The data-theme attribute is set by an inline <head> snippet before
     first paint (no FOUC); this button only persists the new choice and
     reloads so CSS and the motion choreography re-init together. */
  (function () {
    var btn = document.getElementById("themeToggle");
    if (!btn) return;

    var theme = document.documentElement.getAttribute("data-theme") || "bold";
    /* label the destination, like the language toggle: on bold it reads
       CLEAN and takes you to clean, on clean it reads BOLD */
    btn.textContent = theme === "clean" ? "BOLD" : "CLEAN";
    btn.setAttribute("aria-pressed", theme === "clean" ? "true" : "false");

    btn.addEventListener("click", function () {
      var next = theme === "clean" ? "bold" : "clean";
      try { localStorage.setItem("amiel-theme", next); } catch (e) { /* storage blocked — session only */ }
      /* a ?theme= param in the URL would override the new choice on
         reload — strip it before reloading */
      if (/[?&]theme=/.test(location.search)) {
        var qs = location.search
          .replace(/([?&])theme=(clean|bold)&?/, "$1")
          .replace(/[?&]$/, "");
        history.replaceState(null, "", location.pathname + qs + location.hash);
      }
      location.reload();
    });
  })();

  /* dev helper: ?only=<id|class> isolates one section for review */
  var only = location.search.match(/[?&]only=([a-z-]+)/);
  if (only) {
    document.querySelectorAll("main > section, main > footer").forEach(function (s) {
      if (s.id !== only[1] && !s.classList.contains(only[1])) s.style.display = "none";
    });
  }

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var noAnim = /[?&]noanim/.test(location.search);
  if (reduceMotion || noAnim || typeof gsap === "undefined") return;

  gsap.registerPlugin(ScrollTrigger);
  document.documentElement.classList.add("anim-ready");

  /* two motion languages on the same data-reveal/data-parallax hooks:
     bold = tactile sticker slaps, clean = calm editorial fades */
  var themeClean = document.documentElement.getAttribute("data-theme") === "clean";

  /* ---------- helpers ---------- */
  function stickerIn(targets, vars) {
    var base = themeClean
      ? { opacity: 1, y: 0, duration: 0.55, ease: "power2.out", clearProps: "transform", overwrite: "auto" }
      : { opacity: 1, y: 0, scale: 1, rotation: 0, duration: 0.7, ease: "back.out(1.5)", clearProps: "transform", overwrite: "auto" };
    return gsap.to(targets, Object.assign(base, vars || {}));
  }

  /* prime every reveal target — bold: slightly dropped, scaled and
     twisted like a hovering sticker; clean: a soft rise, nothing more */
  gsap.utils.toArray("[data-reveal]").forEach(function (el, i) {
    gsap.set(el, themeClean
      ? { opacity: 0, y: 24 }
      : { opacity: 0, y: 34, scale: 0.97, rotation: (i % 2 ? 1 : -1) * 1.6 });
  });

  /* ---------- hero load sequence ---------- */
  var heroTargets = gsap.utils.toArray(".hero [data-reveal]");
  if (heroTargets.length) {
    stickerIn(heroTargets, { stagger: 0.09, delay: 0.15 });
  }

  /* nav enters — bold drops in, clean simply fades */
  if (themeClean) {
    gsap.from(".nav-pill", { opacity: 0, duration: 0.6, ease: "power2.out", clearProps: "all" });
  } else {
    gsap.from(".nav-pill", { y: -70, opacity: 0, duration: 0.8, ease: "power3.out", clearProps: "all" });
  }

  /* ---------- scroll reveals (everything below the hero) ---------- */
  ScrollTrigger.batch(
    gsap.utils.toArray("[data-reveal]").filter(function (el) {
      return !el.closest(".hero");
    }),
    {
      start: "top 86%",
      once: true,
      onEnter: function (batch) {
        stickerIn(batch, { stagger: 0.1 });
      }
    }
  );

  /* bold-only scroll flourishes — clean stays perfectly still while
     scrolling: no parallax, no drifting columns, no title tilt */
  if (!themeClean) {

    /* ---------- hero parallax drift ---------- */
    gsap.utils.toArray("[data-parallax]").forEach(function (el) {
      var strength = parseFloat(el.getAttribute("data-parallax")) || 5;
      gsap.to(el, {
        yPercent: strength,
        ease: "none",
        scrollTrigger: {
          trigger: el.closest("section") || el,
          start: "top top",
          end: "bottom top",
          scrub: 0.6
        }
      });
    });

    /* ---------- photography columns: differential scroll speeds ---------- */
    gsap.utils.toArray(".photo-col").forEach(function (col) {
      var speed = parseFloat(col.getAttribute("data-speed")) || 1;
      if (speed === 1) return;
      gsap.fromTo(col,
        { y: 0 },
        {
          y: function () { return (1 - speed) * 260; },
          ease: "none",
          scrollTrigger: {
            trigger: col.closest(".photography"),
            start: "top bottom",
            end: "bottom top",
            scrub: 0.8,
            invalidateOnRefresh: true
          }
        }
      );
    });

    /* ---------- section titles get a tiny scrub tilt for life ---------- */
    gsap.utils.toArray(".sec-title").forEach(function (title) {
      gsap.fromTo(title,
        { xPercent: -1.5 },
        {
          xPercent: 1.5,
          ease: "none",
          scrollTrigger: {
            trigger: title,
            start: "top bottom",
            end: "bottom top",
            scrub: 1.2
          }
        }
      );
    });
  }

  /* ---------- clean · scroll block interaction (touch only) ----------
     On fine pointers the clean theme's pink light trails the cursor; on
     coarse-pointer touch devices there is no cursor, so instead each project
     block reacts to scroll: as it crosses the middle band it grows a touch and
     takes a soft, light pink edge tint (its own ScrollTrigger). Coupled to
     scroll position, never :hover, so it works without a pointer. Gate is a
     reliable feature test — (hover: none) and (pointer: coarse) — not a
     viewport width, so a narrow desktop window is never mistaken for touch.
     (An earlier build also drew a continuous pink line down the right edge;
     that was removed — it originated from a screenshot annotation, not an
     intended design element.) */
  if (themeClean &&
      window.matchMedia("(hover: none) and (pointer: coarse)").matches) {
    var glowHero = document.querySelector(".hero");
    var glowFooter = document.querySelector(".site-footer");
    /* the project blocks that react to scroll: product tiles, experience rows
       and the social collage cards (the visible surface there is the inner
       .card, the rounded, overflow-clipped element) */
    var glowCards = [];
    gsap.utils.toArray(".product-card, .work-row, .collage-card").forEach(function (card) {
      var surface = card.classList.contains("collage-card") ? card.querySelector(".card") : card;
      if (surface) glowCards.push(surface);
    });
    if (glowHero && glowFooter && glowCards.length) {
      document.documentElement.classList.add("scroll-glow-on");

      /* per block: the pink intensity is a bell curve of the block's distance
         from the viewport centre — it eases up as the block nears the middle,
         peaks dead centre, then eases back down, instead of an abrupt on/off.
         Each block gets a wide ScrollTrigger (active the whole time it is on
         screen); on every scroll frame we recompute a Gaussian of how far its
         centre sits from the viewport centre and write it to --glow-i, which
         CSS turns into the edge-tint opacity and a slight scale. */
      var GLOW_SIGMA = 0.42;   // bell width (fraction of half-viewport) — larger = flatter, gentler curve
      glowCards.forEach(function (card) {
        card.classList.add("glow-card");
        var edge = document.createElement("span");
        edge.className = "glow-card__edge";
        edge.setAttribute("aria-hidden", "true");
        card.appendChild(edge);

        function setGlow() {
          var vh = window.innerHeight || document.documentElement.clientHeight;
          if (!vh) return;
          var r = card.getBoundingClientRect();
          /* 0 when the block's centre is on the viewport centre, ≈1 when it is
             a half-viewport away; the Gaussian decays smoothly past that */
          var dist = Math.abs((r.top + r.height / 2) - vh / 2) / (vh / 2);
          var g = Math.exp(-(dist * dist) / (2 * GLOW_SIGMA * GLOW_SIGMA));
          card.style.setProperty("--glow-i", (g < 0.001 ? 0 : g).toFixed(3));
        }

        ScrollTrigger.create({
          trigger: card,
          start: "top bottom",
          end: "bottom top",
          onUpdate: setGlow,
          onRefresh: setGlow,
          /* off-screen: make sure the tint is fully gone at both extremes */
          onLeave: function () { card.style.setProperty("--glow-i", "0"); },
          onLeaveBack: function () { card.style.setProperty("--glow-i", "0"); }
        });
        setGlow();
      });
    }
  }

  /* ---------- active nav link tracking ---------- */
  var navLinks = document.querySelectorAll(".nav-links a[href^='#']");
  navLinks.forEach(function (link) {
    var target = document.querySelector(link.getAttribute("href"));
    if (!target) return;
    ScrollTrigger.create({
      trigger: target,
      start: "top 45%",
      end: "bottom 45%",
      onToggle: function (self) {
        if (self.isActive) {
          navLinks.forEach(function (l) { l.classList.remove("is-active"); });
          link.classList.add("is-active");
        } else {
          link.classList.remove("is-active");
        }
      }
    });
  });

  /* ---------- header shadow once scrolled ---------- */
  ScrollTrigger.create({
    start: 80,
    onUpdate: function (self) {
      document.querySelector(".site-header").classList.toggle("is-tucked", self.scroll() > 80);
    }
  });

  /* ---------- magnetic buttons (bold only, fine pointers only) ---------- */
  if (!themeClean && window.matchMedia("(pointer: fine)").matches) {
    document.querySelectorAll(".btn, .nav-cta").forEach(function (btn) {
      var qx = gsap.quickTo(btn, "x", { duration: 0.35, ease: "power3.out" });
      var qy = gsap.quickTo(btn, "y", { duration: 0.35, ease: "power3.out" });
      btn.addEventListener("mousemove", function (e) {
        var r = btn.getBoundingClientRect();
        qx((e.clientX - r.left - r.width / 2) * 0.18);
        qy((e.clientY - r.top - r.height / 2) * 0.25);
      });
      btn.addEventListener("mouseleave", function () { qx(0); qy(0); });
    });
  }

  /* deep links: anything that sits above the viewport when we arrive
     never crosses the batch start line — reveal it instantly */
  function revealAboveViewport() {
    gsap.utils.toArray("[data-reveal]").forEach(function (el) {
      if (el.getBoundingClientRect().bottom < 0) {
        gsap.set(el, { opacity: 1, clearProps: "transform" });
      }
    });
  }
  revealAboveViewport();

  /* refresh once everything (incl. the arcade gif) is truly loaded */
  window.addEventListener("load", function () {
    ScrollTrigger.refresh();
    revealAboveViewport();
  });
})();
