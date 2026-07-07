/* AMIEL.STUDIO 2.0 — motion system
   Purposeful, tactile: stickers slap on, prints settle, paper lifts.
   Content is fully readable without JS; reduced motion opts out entirely. */

(function () {
  "use strict";

  /* ---------- mobile menu (always active) ---------- */
  var burger = document.querySelector(".nav-burger");
  var menu = document.getElementById("mobileMenu");
  if (burger && menu) {
    burger.addEventListener("click", function () {
      var open = document.body.classList.toggle("menu-open");
      burger.setAttribute("aria-expanded", open ? "true" : "false");
      burger.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    });
    menu.querySelectorAll("a").forEach(function (a) {
      a.addEventListener("click", function () {
        document.body.classList.remove("menu-open");
        burger.setAttribute("aria-expanded", "false");
      });
    });
  }

  /* ---------- photography carousel (always active) ----------
     Buttons jump to the neighbouring print's exact snap position;
     scrolling to a non-snap offset would fight the mandatory snap. */
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
      var target = items[Math.max(0, Math.min(items.length - 1, idx + dir))];
      /* direct assignment + CSS scroll-behavior: smooth — programmatic
         smooth scrolling gets cancelled by mandatory snap in some engines */
      track.scrollLeft = target.offsetLeft + target.offsetWidth / 2 - track.clientWidth / 2;
    }

    var prev = car.querySelector(".carousel-btn--prev");
    var next = car.querySelector(".carousel-btn--next");
    if (prev) prev.addEventListener("click", function () { go(-1); });
    if (next) next.addEventListener("click", function () { go(1); });
  });

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

  /* ---------- helpers ---------- */
  function stickerIn(targets, vars) {
    return gsap.to(targets, Object.assign({
      opacity: 1,
      y: 0,
      scale: 1,
      rotation: 0,
      duration: 0.7,
      ease: "back.out(1.5)",
      clearProps: "transform",
      overwrite: "auto"
    }, vars || {}));
  }

  /* prime every reveal target: slightly dropped, scaled and twisted,
     like a sticker hovering above the page before it lands */
  gsap.utils.toArray("[data-reveal]").forEach(function (el, i) {
    gsap.set(el, {
      opacity: 0,
      y: 34,
      scale: 0.97,
      rotation: (i % 2 ? 1 : -1) * 1.6
    });
  });

  /* ---------- hero load sequence ---------- */
  var heroTargets = gsap.utils.toArray(".hero [data-reveal]");
  if (heroTargets.length) {
    stickerIn(heroTargets, { stagger: 0.09, delay: 0.15 });
  }

  /* nav drops in */
  gsap.from(".nav-pill", { y: -70, opacity: 0, duration: 0.8, ease: "power3.out", clearProps: "all" });

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

  /* ---------- magnetic buttons (fine pointers only) ---------- */
  if (window.matchMedia("(pointer: fine)").matches) {
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
