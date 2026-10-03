(function () {
  "use strict";

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

  /* ---------- Navigation ---------- */

  var nav = $("#nav");
  var burger = $("#burger");
  var menu = $("#menu");
  var links = $$(".nav__links a");
  var sections = $$("main section[id]");

  function onScroll() {
    nav.classList.toggle("is-scrolled", window.scrollY > 24);
    var y = window.scrollY + window.innerHeight * 0.35;
    var current = sections[0];
    for (var i = 0; i < sections.length; i++) {
      if (sections[i].offsetTop <= y) current = sections[i];
    }
    var id = "#" + current.id;
    links.forEach(function (a) {
      a.classList.toggle("is-active", a.getAttribute("href") === id);
    });
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  function closeMenu() {
    burger.classList.remove("is-open");
    menu.classList.remove("is-open");
    burger.setAttribute("aria-expanded", "false");
    document.body.style.overflow = "";
  }
  burger.addEventListener("click", function () {
    var open = !menu.classList.contains("is-open");
    burger.classList.toggle("is-open", open);
    menu.classList.toggle("is-open", open);
    burger.setAttribute("aria-expanded", String(open));
    document.body.style.overflow = open ? "hidden" : "";
  });
  $$("a", menu).forEach(function (a) { a.addEventListener("click", closeMenu); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeMenu(); });

  /* ---------- Scroll reveals & counters ---------- */

  function formatNumber(n, decimals) {
    var fixed = n.toFixed(decimals);
    var parts = fixed.split(".");
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return parts.join(".");
  }

  function countUp(el) {
    var target = parseFloat(el.getAttribute("data-count"));
    var decimals = parseInt(el.getAttribute("data-decimals") || "0", 10);
    if (reduceMotion) { el.textContent = formatNumber(target, decimals); return; }
    var duration = 1600;
    var start = null;
    function step(ts) {
      if (!start) start = ts;
      var p = Math.min((ts - start) / duration, 1);
      var eased = 1 - Math.pow(1 - p, 4);
      el.textContent = formatNumber(target * eased, decimals);
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  var counted = [];
  function runCounters(root) {
    $$("[data-count]", root).forEach(function (el) {
      if (counted.indexOf(el) !== -1) return;
      counted.push(el);
      countUp(el);
    });
  }

  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-in");
        runCounters(entry.target);
        io.unobserve(entry.target);
      });
    }, { rootMargin: "0px 0px -10% 0px", threshold: 0.12 });
    $$(".reveal").forEach(function (el) { io.observe(el); });
    $$(".numbers__list li").forEach(function (el) { io.observe(el); });
  } else {
    $$(".reveal").forEach(function (el) { el.classList.add("is-in"); });
    runCounters(document);
  }

  // Hero dashboard figures start shortly after the panels rise in.
  var dash = $(".dash");
  if (dash) setTimeout(function () { runCounters(dash); }, reduceMotion ? 0 : 700);

  /* ---------- Quick calculator ---------- */

  var calc = $("#calc");
  if (calc) {
    var out = $("#calcOut");
    var result = $(".calc__result", calc);
    var money = function (input) {
      var n = parseFloat(String(input.value).replace(/[^0-9.\-]/g, "")) || 0;
      input.value = "$" + formatNumber(n, 0);
      return n;
    };
    var compute = function () {
      var revenue = money(calc.revenue);
      var expenses = money(calc.expenses);
      var rate = parseFloat(calc.rate.value) / 100;
      var profit = revenue - expenses;
      var net = profit > 0 ? profit * (1 - rate) : profit;
      var sign = net < 0 ? "−" : "";
      out.textContent = sign + formatNumber(Math.abs(net), 0);
      result.classList.remove("is-updating");
      void result.offsetWidth;
      result.classList.add("is-updating");
    };
    calc.addEventListener("submit", function (e) { e.preventDefault(); compute(); });
    $$("input", calc).forEach(function (i) { i.addEventListener("blur", function () { money(i); }); });
    calc.rate.addEventListener("change", compute);
    compute();
    result.classList.remove("is-updating");
  }

  /* ---------- Pointer highlights (glass cards, buttons) ---------- */

  var finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  if (finePointer) {
    $$(".glass, .btn").forEach(function (el) {
      el.addEventListener("pointermove", function (e) {
        var r = el.getBoundingClientRect();
        el.style.setProperty("--mx", (e.clientX - r.left) + "px");
        el.style.setProperty("--my", (e.clientY - r.top) + "px");
      });
    });

    if (!reduceMotion) {
      $$("[data-magnetic]").forEach(function (el) {
        var strength = 0.22;
        el.addEventListener("pointermove", function (e) {
          var r = el.getBoundingClientRect();
          var x = e.clientX - (r.left + r.width / 2);
          var y = e.clientY - (r.top + r.height / 2);
          el.style.transform = "translate(" + x * strength + "px," + y * strength + "px)";
        });
        el.addEventListener("pointerleave", function () { el.style.transform = ""; });
      });
    }
  }

  /* ---------- Hero silk canvas ---------- */

  var canvas = $("#silk");
  if (canvas && !reduceMotion && canvas.getContext) {
    var ctx = canvas.getContext("2d");
    var w = 0, h = 0, t = 0, raf = 0, visible = true;
    var LINES = 26;

    function resize() {
      var dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function draw() {
      raf = 0;
      if (!visible || document.hidden) return;
      t += 0.0028;
      ctx.clearRect(0, 0, w, h);
      ctx.lineWidth = 1;
      var step = w > 900 ? 18 : 24;
      for (var i = 0; i < LINES; i++) {
        var p = i / (LINES - 1);
        var amp = h * (0.08 + p * 0.1);
        var base = h * (0.22 + p * 0.62);
        var alpha = 0.035 + (1 - Math.abs(p - 0.5) * 2) * 0.075;
        ctx.strokeStyle = "rgba(0,75,73," + alpha.toFixed(3) + ")";
        ctx.beginPath();
        for (var x = -step; x <= w + step; x += step) {
          var nx = x / w;
          var y = base
            + Math.sin(nx * 3.1 + t * 1.4 + p * 4.2) * amp * 0.55
            + Math.sin(nx * 6.7 - t * 0.9 + p * 8.5) * amp * 0.22
            + Math.cos(nx * 1.4 + t * 0.6 + p * 2.0) * amp * 0.4;
          if (x === -step) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      raf = requestAnimationFrame(draw);
    }

    function start() { if (!raf && visible && !document.hidden) raf = requestAnimationFrame(draw); }

    resize();
    window.addEventListener("resize", function () { resize(); start(); }, { passive: true });
    document.addEventListener("visibilitychange", start);
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (entries) {
        visible = entries[0].isIntersecting;
        start();
      }, { threshold: 0 }).observe(canvas);
    }
    start();
  }

  /* ---------- Footer year ---------- */

  var year = $("#year");
  if (year) year.textContent = String(new Date().getFullYear());
})();
