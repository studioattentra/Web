/* =========================================================
   Interface behaviour
   loader · navigation · reveals · counters · chart · tilt
   magnetic buttons · cursor · card spotlight
   ========================================================= */

(function () {
  'use strict';

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  /* ------------------------------------------------ loader */
  const loader = $('#loader');
  const heroTitle = $('.hero__title');
  if (loader) document.body.classList.add('is-loading');

  function finishLoading() {
    if (!loader) return;
    loader.classList.add('is-done');
    document.body.classList.remove('is-loading');
    heroTitle && heroTitle.classList.add('is-in');
    // hero reveals follow the headline
    $$('.hero .reveal').forEach((el) => {
      el.style.setProperty('--d', (parseInt(el.dataset.delay || 0, 10) + 300) + 'ms');
      el.classList.add('is-in');
    });
    setTimeout(() => $('#chart') && $('#chart').classList.add('is-in'), 500);
    setTimeout(startDashCounters, 900);
  }

  const minimum = reduced ? 0 : 1900;
  const started = performance.now();
  const ready = () => {
    const wait = Math.max(0, minimum - (performance.now() - started));
    setTimeout(finishLoading, wait);
  };
  if (!loader) {
    // sub-pages: no intro, reveal everything in view straight away
  } else if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(ready);
    setTimeout(ready, 3500); // safety net if fonts stall
  } else {
    window.addEventListener('load', ready);
  }

  /* -------------------------------------------- navigation */
  const nav = $('#nav');
  const burger = $('#burger');
  const mobileMenu = $('#mobileMenu');
  const isSubPage = document.body.classList.contains('page');
  let lastY = window.scrollY;

  function onScroll() {
    if (!nav) return;
    const y = window.scrollY;
    if (!isSubPage) nav.classList.toggle('is-scrolled', y > 40);
    if (y > 500 && y > lastY + 6 && mobileMenu && !mobileMenu.classList.contains('is-open')) {
      nav.classList.add('is-hidden');
    } else if (y < lastY - 6 || y < 200) {
      nav.classList.remove('is-hidden');
    }
    lastY = y;
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  function toggleMenu(force) {
    const open = typeof force === 'boolean' ? force : !mobileMenu.classList.contains('is-open');
    mobileMenu.classList.toggle('is-open', open);
    burger.classList.toggle('is-open', open);
    burger.setAttribute('aria-expanded', String(open));
    mobileMenu.setAttribute('aria-hidden', String(!open));
    document.body.style.overflow = open ? 'hidden' : '';
  }
  if (burger && mobileMenu) {
    burger.addEventListener('click', () => toggleMenu());
    $$('a', mobileMenu).forEach((a) => a.addEventListener('click', () => toggleMenu(false)));
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && mobileMenu.classList.contains('is-open')) { toggleMenu(false); burger.focus(); } });
  }

  // active link tracking
  const sections = ['hero', 'services', 'calculators', 'case-studies', 'about'].map((id) => document.getElementById(id)).filter(Boolean);
  const navLinks = $$('.nav__links a');
  const sectionObserver = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      const id = e.target.id === 'hero' ? 'top' : e.target.id;
      navLinks.forEach((a) => a.classList.toggle('is-active', a.getAttribute('href') === '#' + id));
    });
  }, { rootMargin: '-40% 0px -55% 0px' });
  sections.forEach((s) => sectionObserver.observe(s));

  $('#toTop') && $('#toTop').addEventListener('click', () => window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' }));

  /* ----------------------------------------------- reveals */
  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      const el = e.target;
      el.style.setProperty('--d', (el.dataset.delay || 0) + 'ms');
      el.classList.add('is-in');
      revealObserver.unobserve(el);
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
  $$('.reveal').forEach((el) => {
    if (el.closest('.hero')) return; // handled after the loader
    revealObserver.observe(el);
  });

  /* ---------------------------------------------- counters */
  const fmt = (v, el) => {
    const dec = parseInt(el.dataset.decimals || 0, 10);
    const n = dec ? v.toFixed(dec) : Math.round(v).toString();
    return el.dataset.format === 'comma' ? n.replace(/\B(?=(\d{3})+(?!\d))/g, ',') : n;
  };
  const easeOut = (t) => 1 - Math.pow(1 - t, 4);

  function countUp(el, duration = 2200) {
    if (el.dataset.done) return;
    el.dataset.done = '1';
    const target = parseFloat(el.dataset.count);
    if (reduced) { el.textContent = fmt(target, el); return; }
    const t0 = performance.now();
    const tick = (now) => {
      const p = Math.min(1, (now - t0) / duration);
      el.textContent = fmt(target * easeOut(p), el);
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  function startDashCounters() {
    $$('.dash [data-count]').forEach((el, i) => setTimeout(() => countUp(el, 2000), i * 180));
  }

  const counterObserver = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      countUp(e.target, 2400);
      counterObserver.unobserve(e.target);
    });
  }, { threshold: 0.5 });
  $$('.stats [data-count]').forEach((el) => counterObserver.observe(el));

  /* ------------------------------------------------- chart */
  // Illustrative demo data in GBP thousands, Jan–May 2026. Not client figures.
  const SERIES = {
    revenue:  { label: 'Revenue · Jan–May 2026',       def: 'Sales invoiced each month, excluding VAT.',                      data: [31.2, 33.8, 36.1, 40.4, 44.9] },
    expenses: { label: 'Expenses · Jan–May 2026',      def: 'Operating costs incurred each month, excluding VAT.',           data: [15.1, 14.6, 14.9, 13.8, 13.9] },
    profit:   { label: 'Profit / Loss · Jan–May 2026', def: 'Revenue less expenses for each month, before corporation tax.', data: [16.1, 19.2, 21.2, 26.6, 31.0] },
    cashflow: { label: 'Cash flow · Jan–May 2026',     def: 'Net movement in bank balances each month after tax payments.',  data: [9.4, 12.8, 7.9, 18.3, 22.6] },
  };
  const chart = $('#chart');
  const chartLine = $('#chartLine');
  const chartArea = $('.chart__area');
  const chartDot = $('#chartDot');
  const chartHalo = $('#chartHalo');
  const chartLabel = $('#chartLabel');
  const chartDef = $('#chartDef');

  function toPoints(data) {
    const max = Math.max(...Object.values(SERIES).map((s) => Math.max(...s.data)));
    const W = 320, top = 10, bottom = 118;
    return data.map((v, i) => [i * (W / (data.length - 1)), bottom - (v / max) * (bottom - top)]);
  }
  function smoothPath(pts) {
    let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
      const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
      const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
      d += ` C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
    }
    return d;
  }
  function applySeries(pts) {
    const d = smoothPath(pts);
    chartLine.setAttribute('d', d);
    chartArea.setAttribute('d', `${d} L320,130 L0,130 Z`);
  }

  if (chart && chartLine) {
    let current = toPoints(SERIES.profit.data);
    applySeries(current);

    // first draw: stroke reveal with a travelling dot
    if (!reduced) {
      const len = chartLine.getTotalLength();
      chartLine.style.strokeDasharray = len;
      chartLine.style.strokeDashoffset = len;
      let start = null;
      const drawMs = 2600, delayMs = 400;
      function moveDot(now) {
        if (!chart.classList.contains('is-in')) { requestAnimationFrame(moveDot); return; }
        if (start === null) start = now + delayMs;
        const p = Math.min(1, Math.max(0, (now - start) / drawMs));
        const eased = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
        const pt = chartLine.getPointAtLength(chartLine.getTotalLength() * eased);
        chartDot.setAttribute('cx', pt.x); chartDot.setAttribute('cy', pt.y);
        chartHalo.setAttribute('cx', pt.x); chartHalo.setAttribute('cy', pt.y);
        if (p < 1) requestAnimationFrame(moveDot); else chart.classList.add('is-drawn');
      }
      requestAnimationFrame(moveDot);
    } else {
      chart.classList.add('is-drawn');
    }

    // series switching with an eased morph
    let morphRaf;
    $$('.dash__tabs [data-series]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const key = btn.dataset.series;
        const target = toPoints(SERIES[key].data);
        $$('.dash__tabs [data-series]').forEach((b) => { b.classList.toggle('is-active', b === btn); b.setAttribute('aria-selected', String(b === btn)); });
        chartLabel.textContent = SERIES[key].label;
        chartDef.textContent = SERIES[key].def;
        chartLine.style.strokeDasharray = ''; chartLine.style.strokeDashoffset = '';
        chartLine.style.animation = 'none';
        const from = current.map((p) => p.slice());
        const t0 = performance.now();
        cancelAnimationFrame(morphRaf);
        const step = (now) => {
          const p = reduced ? 1 : Math.min(1, (now - t0) / 700);
          const e = 1 - Math.pow(1 - p, 3);
          current = from.map((pt, i) => [pt[0], pt[1] + (target[i][1] - pt[1]) * e]);
          applySeries(current);
          const last = current[current.length - 1];
          chartDot.setAttribute('cx', last[0]); chartDot.setAttribute('cy', last[1]);
          chartHalo.setAttribute('cx', last[0]); chartHalo.setAttribute('cy', last[1]);
          if (p < 1) morphRaf = requestAnimationFrame(step);
        };
        morphRaf = requestAnimationFrame(step);
      });
    });
  }

  /* -------------------------------------------- calculators */
  // UK VAT standard rate. Effective from 4 January 2011 (HMRC). Update here only if the rate changes.
  const UK_VAT_STANDARD_RATE = 0.20;
  const UK_VAT_RATE_EFFECTIVE = '4 January 2011';
  $$('[data-vat-rate]').forEach((el) => { el.textContent = (UK_VAT_STANDARD_RATE * 100).toFixed(0) + '%'; });
  $$('[data-vat-date]').forEach((el) => { el.textContent = UK_VAT_RATE_EFFECTIVE; });

  const gbp = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const pct = (v) => (Number.isFinite(v) ? v.toFixed(1) + '%' : '—');
  const num = (form, name) => {
    const el = form.elements[name];
    const v = parseFloat(el.value);
    const bad = el.value !== '' && (!Number.isFinite(v) || v < 0);
    el.setAttribute('aria-invalid', String(bad));
    return el.value === '' ? NaN : v;
  };
  const setOut = (form, key, val) => { const el = form.querySelector(`[data-out="${key}"]`); if (el) el.textContent = val; };
  const setError = (form, msg) => { const el = form.querySelector('[data-error]'); el.textContent = msg || ''; el.hidden = !msg; };

  function bindCalc(form, compute) {
    if (!form) return;
    const run = () => compute(form);
    form.addEventListener('input', run);
    form.addEventListener('submit', (e) => { e.preventDefault(); run(); });
    run();
  }

  bindCalc($('#calcMargin'), (f) => {
    const revenue = num(f, 'revenue'), cogs = num(f, 'cogs'), opex = num(f, 'opex');
    if ([revenue, cogs, opex].some((v) => Number.isNaN(v))) { setError(f, 'Enter revenue, cost of sales and operating expenses.'); ['gross', 'grossPct', 'net', 'netPct'].forEach((k) => setOut(f, k, '—')); return; }
    if ([revenue, cogs, opex].some((v) => v < 0)) { setError(f, 'Values cannot be negative.'); return; }
    if (revenue === 0) { setError(f, 'Revenue must be greater than zero to calculate a margin.'); ['grossPct', 'netPct'].forEach((k) => setOut(f, k, '—')); setOut(f, 'gross', gbp.format(-cogs)); setOut(f, 'net', gbp.format(-cogs - opex)); return; }
    setError(f, '');
    const gross = revenue - cogs, net = gross - opex;
    setOut(f, 'gross', gbp.format(gross));
    setOut(f, 'grossPct', pct(gross / revenue * 100));
    setOut(f, 'net', gbp.format(net));
    setOut(f, 'netPct', pct(net / revenue * 100));
  });

  bindCalc($('#calcBreakEven'), (f) => {
    const fixed = num(f, 'fixed'), cm = num(f, 'cm'), price = num(f, 'price');
    if (Number.isNaN(fixed) || Number.isNaN(cm)) { setError(f, 'Enter fixed costs and a contribution margin percentage.'); setOut(f, 'revenue', '—'); setOut(f, 'units', '—'); return; }
    if (fixed < 0 || cm < 0) { setError(f, 'Values cannot be negative.'); return; }
    if (cm === 0 || cm > 100) { setError(f, 'Contribution margin must be between 0 and 100%.'); setOut(f, 'revenue', '—'); setOut(f, 'units', '—'); return; }
    setError(f, '');
    const rev = fixed / (cm / 100);
    setOut(f, 'revenue', gbp.format(rev));
    setOut(f, 'units', Number.isFinite(price) && price > 0 ? Math.ceil(rev / price).toLocaleString('en-GB') + ' units' : 'Enter a selling price');
  });

  bindCalc($('#calcVat'), (f) => {
    const amount = num(f, 'amount');
    const mode = f.elements.mode.value;
    if (Number.isNaN(amount)) { setError(f, 'Enter an amount.'); ['net', 'vat', 'gross'].forEach((k) => setOut(f, k, '—')); return; }
    if (amount < 0) { setError(f, 'Amount cannot be negative.'); return; }
    setError(f, '');
    let net, gross;
    if (mode === 'add') { net = amount; gross = amount * (1 + UK_VAT_STANDARD_RATE); }
    else { gross = amount; net = amount / (1 + UK_VAT_STANDARD_RATE); }
    setOut(f, 'net', gbp.format(net));
    setOut(f, 'vat', gbp.format(gross - net));
    setOut(f, 'gross', gbp.format(gross));
  });

  /* -------------------------------------------------- tilt */
  const dash = $('#dash');
  if (dash && finePointer && !reduced) {
    const wrap = dash.parentElement;
    let rx = 0, ry = 0, tx = 0, ty = 0, raf;
    const update = () => {
      rx += (tx - rx) * 0.08;
      ry += (ty - ry) * 0.08;
      dash.style.transform = `rotateX(${rx.toFixed(3)}deg) rotateY(${ry.toFixed(3)}deg)`;
      if (Math.abs(tx - rx) > 0.01 || Math.abs(ty - ry) > 0.01) raf = requestAnimationFrame(update);
      else raf = null;
    };
    const kick = () => { if (!raf) raf = requestAnimationFrame(update); };
    wrap.addEventListener('pointermove', (e) => {
      const r = dash.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5;
      const py = (e.clientY - r.top) / r.height - 0.5;
      tx = -py * 7; ty = px * 9;
      kick();
    });
    wrap.addEventListener('pointerleave', () => { tx = 0; ty = 0; kick(); });
  }

  /* --------------------------------------------- magnetic */
  if (finePointer && !reduced) {
    $$('[data-magnetic]').forEach((el) => {
      let raf;
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        const x = (e.clientX - r.left - r.width / 2) * 0.25;
        const y = (e.clientY - r.top - r.height / 2) * 0.35;
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(() => { el.style.transform = `translate(${x}px, ${y}px)`; });
      });
      el.addEventListener('pointerleave', () => {
        cancelAnimationFrame(raf);
        el.style.transform = '';
      });
    });
  }

  /* ----------------------------------------------- cursor */
  const cursor = $('#cursor');
  if (cursor && finePointer && !reduced) {
    let cx = window.innerWidth / 2, cy = window.innerHeight / 2, mx = cx, my = cy, shown = false;
    window.addEventListener('pointermove', (e) => {
      mx = e.clientX; my = e.clientY;
      if (!shown) { shown = true; cursor.classList.add('is-visible'); cx = mx; cy = my; }
    }, { passive: true });
    document.addEventListener('pointerleave', () => cursor.classList.remove('is-visible'));
    document.addEventListener('pointerenter', () => shown && cursor.classList.add('is-visible'));
    const hoverables = 'a, button, [data-magnetic], .card, .post, .dash__stat';
    document.addEventListener('pointerover', (e) => cursor.classList.toggle('is-hover', !!e.target.closest(hoverables)));
    (function follow() {
      cx += (mx - cx) * 0.18; cy += (my - cy) * 0.18;
      cursor.style.translate = `${cx}px ${cy}px`;
      requestAnimationFrame(follow);
    })();
  }

  /* ------------------------------------------ card spotlight */
  if (finePointer) {
    $$('.card').forEach((card) => {
      card.addEventListener('pointermove', (e) => {
        const r = card.getBoundingClientRect();
        card.style.setProperty('--mx', ((e.clientX - r.left) / r.width * 100) + '%');
        card.style.setProperty('--my', ((e.clientY - r.top) / r.height * 100) + '%');
      });
    });
  }

  /* ------------------------------------ about media parallax */
  const aboutMedia = $('.about__media');
  const aboutScene = aboutMedia && $('.scene', aboutMedia);
  if (aboutScene && !reduced) {
    const parallax = () => {
      const r = aboutMedia.getBoundingClientRect();
      if (r.bottom < 0 || r.top > window.innerHeight) return;
      const p = (r.top + r.height / 2 - window.innerHeight / 2) / window.innerHeight;
      aboutScene.style.transform = `scale(1.12) translateY(${(p * -6).toFixed(2)}%)`;
    };
    window.addEventListener('scroll', parallax, { passive: true });
    parallax();
  }

  /* ----------------------------------- case-study feed */
  const homePosts = $('#homePosts');
  if (homePosts && homePosts.dataset.feed && window.fetch) {
    const escapeHtml = (v) => String(v).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    fetch(homePosts.dataset.feed, { cache: 'no-cache' })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((feed) => {
        const posts = (feed.posts || []).slice(0, 3);
        if (!posts.length) return;
        homePosts.innerHTML = posts.map((p, i) => `
          <article class="post glass reveal is-in" data-delay="${i * 120}" data-category="${escapeHtml(p.category.toLowerCase())}">
            <a href="${escapeHtml(p.url.replace(/^\//, ''))}" class="post__wrap">
              <div class="post__media"><img src="${escapeHtml(p.image.replace(/^\//, ''))}" alt="${escapeHtml(p.image_alt || '')}" width="1200" height="800" loading="lazy"><span class="tag">${escapeHtml(p.category)}</span></div>
              <div class="post__body">
                <h3>${escapeHtml(p.title)}</h3>
                <p class="post__excerpt">${escapeHtml(p.excerpt)}</p>
                <div class="post__meta"><span>${escapeHtml(p.author)}</span><span><time datetime="${escapeHtml(p.date)}">${new Date(p.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })}</time></span><span>${p.reading_time} min read</span><i aria-hidden="true">→</i></div>
              </div>
            </a>
          </article>`).join('');
      })
      .catch(() => { /* static markup stays in place */ });
  }

  const filterGroup = $('.filters');
  if (filterGroup) {
    const cards = $$('#postList .post');
    const empty = $('#postsEmpty');
    filterGroup.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-filter]');
      if (!btn) return;
      $$('[data-filter]', filterGroup).forEach((b) => b.classList.toggle('is-active', b === btn));
      const f = btn.dataset.filter;
      let shown = 0;
      cards.forEach((c) => { const on = f === 'all' || c.dataset.category === f; c.hidden = !on; if (on) shown++; });
      if (empty) empty.hidden = shown > 0;
    });
  }

  /* ------------------------------------------ enquiry form */
  const enquiry = $('#enquiryForm');
  if (enquiry) {
    const status = $('#enquiryStatus');
    const FIRM_EMAIL = 'mumeraijaz.writer@gmail.com'; // delivery address for the email fallback; change here when the firm mailbox goes live
    const fieldError = (el, msg) => {
      let err = el.parentElement.querySelector('.field__error');
      if (!msg) { if (err) err.remove(); el.removeAttribute('aria-invalid'); el.removeAttribute('aria-describedby'); return; }
      if (!err) { err = document.createElement('small'); err.className = 'field__error'; err.id = el.id + '-error'; el.parentElement.appendChild(err); }
      err.textContent = msg;
      el.setAttribute('aria-invalid', 'true');
      el.setAttribute('aria-describedby', err.id);
    };
    const validate = () => {
      let first = null;
      const check = (el, ok, msg) => { fieldError(el, ok ? '' : msg); if (!ok && !first) first = el; };
      const name = enquiry.elements.name, email = enquiry.elements.email, service = enquiry.elements.service, message = enquiry.elements.message, consent = enquiry.elements.consent;
      check(name, name.value.trim().length > 1, 'Please enter your name.');
      check(email, /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim()), 'Please enter a valid email address.');
      check(service, service.value !== '', 'Please choose a service.');
      check(message, message.value.trim().length > 9, 'Please tell us a little about what you need (at least 10 characters).');
      check(consent, consent.checked, 'Please confirm you agree to us using your details to respond.');
      if (first) first.focus();
      return !first;
    };
    enquiry.querySelectorAll('input, select, textarea').forEach((el) => el.addEventListener('input', () => fieldError(el, '')));

    let sending = false, lastSent = 0;
    const submitBtn = enquiry.querySelector('button[type="submit"]');
    enquiry.addEventListener('submit', async (e) => {
      e.preventDefault();
      status.classList.remove('is-error');
      if (sending) return;
      if (Date.now() - lastSent < 30000) { status.textContent = 'Your enquiry was just sent. Please wait a moment before sending another.'; return; }
      if (!validate()) { status.textContent = 'Please check the highlighted fields.'; status.classList.add('is-error'); return; }
      if (enquiry.elements.website.value) return; // honeypot
      sending = true; submitBtn.disabled = true;
      const data = new FormData(enquiry);
      // trim and cap every value client-side as well (the host-side handler is the real limit)
      for (const [k, v] of Array.from(data.entries())) if (typeof v === 'string') data.set(k, v.trim().slice(0, k === 'message' ? 2000 : 160));
      status.textContent = 'Sending…';
      // 1) the site's own handler (api/contact.php on the live server) answers with JSON
      try {
        const res = await fetch(enquiry.getAttribute('action'), { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/json' }, body: new URLSearchParams(data).toString(), credentials: 'same-origin' });
        const isJson = (res.headers.get('content-type') || '').includes('application/json');
        if (isJson) {
          const out = await res.json();
          if (out.ok) {
            status.textContent = 'Thank you. Your enquiry has been sent; we reply within 24 hours.';
            enquiry.reset();
            lastSent = Date.now(); sending = false; submitBtn.disabled = false;
            return;
          }
          if (out.fields) Object.entries(out.fields).forEach(([k, msg]) => { const el = enquiry.elements[k]; if (el) fieldError(el, msg); });
          if (res.status !== 503) {
            status.textContent = out.error || 'Something went wrong. Please try again.';
            status.classList.add('is-error');
            sending = false; submitBtn.disabled = false;
            return;
          }
          // 503 = handler not configured yet → fall through to the email fallback
        }
      } catch (err) { /* handler unreachable (preview, local file, outage) → fall through */ }
      // 2) mailto fallback
      const subject = encodeURIComponent(`Enquiry: ${data.get('service')} — ${data.get('name')}`);
      const body = encodeURIComponent(
        `Name: ${data.get('name')}\nBusiness email: ${data.get('email')}\nCompany: ${data.get('company') || '-'}\nService interest: ${data.get('service')}\n\n${data.get('message')}\n\nConsent to contact: yes`);
      window.location.href = `mailto:${FIRM_EMAIL}?subject=${subject}&body=${body}`;
      status.textContent = 'Your email app should open with the enquiry filled in. If it does not, email us at ' + FIRM_EMAIL + '.';
      lastSent = Date.now(); sending = false; submitBtn.disabled = false;
    });
  }

  /* --------------------------------- service detail links */
  $$('[data-detail]').forEach((a) => {
    a.addEventListener('click', () => {
      const d = document.getElementById(a.dataset.detail);
      if (d && d.tagName === 'DETAILS') d.open = true;
    });
  });

  /* ---------------------------------- smooth anchor offset */
  $$('a[href^="#"]').forEach((a) => {
    a.addEventListener('click', (e) => {
      const id = a.getAttribute('href');
      if (id === '#' || id === '#top') { e.preventDefault(); window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' }); return; }
      const target = document.querySelector(id);
      if (!target) return;
      e.preventDefault();
      const top = target.getBoundingClientRect().top + window.scrollY - 72;
      window.scrollTo({ top, behavior: reduced ? 'auto' : 'smooth' });
    });
  });
})();
