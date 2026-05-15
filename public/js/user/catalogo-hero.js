/**
 * BiblioNet Catalog Hero — Premium Interactions
 * Handles: typing animation, floating 3D books, golden particles
 */
(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', init);

  function init() {
    animateTitle();
    createFloatingBooks();
    createParticles();
    observeNavbarScroll();
  }

  /* ── Topbar Scroll Toggle ──────────────────────────────────── */
  function observeNavbarScroll() {
    var hero = document.querySelector('.biblionet-hero');
    var topbar = document.getElementById('cat-topbar');
    if (!hero || !topbar) return;

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          topbar.classList.remove('topbar--scrolled');
        } else {
          topbar.classList.add('topbar--scrolled');
        }
      });
    }, { threshold: 0.05 });

    observer.observe(hero);
  }

  /* ── Typing Animation ─────────────────────────────────────── */
  function animateTitle() {
    const el = document.getElementById('hero-biblionet');
    if (!el) return;
    const text = el.textContent;
    el.textContent = '';
    text.split('').forEach(function (ch, i) {
      var span = document.createElement('span');
      span.textContent = ch;
      span.className = 'char';
      span.style.animationDelay = (0.8 + i * 0.1) + 's';
      el.appendChild(span);
    });
  }

  /* ── Floating 3D Books ─────────────────────────────────────── */
  function createFloatingBooks() {
    var container = document.getElementById('hero-books');
    if (!container) return;

    // Rich leather/cloth cover colors with accent for spine detail
    var coverStyles = [
      { base: '#2C1810', accent: '#D4A853', spine: '#1A0E08' },
      { base: '#0B2B26', accent: '#8CC6A4', spine: '#062018' },
      { base: '#3B1054', accent: '#C79BDB', spine: '#250A38' },
      { base: '#1A2840', accent: '#7BA0C9', spine: '#0E1928' },
      { base: '#5C1A1A', accent: '#E8A87C', spine: '#3A0F0F' },
      { base: '#1C3A2A', accent: '#B8D4A8', spine: '#0F2419' },
      { base: '#3D2B1A', accent: '#D4B896', spine: '#261A0F' },
      { base: '#1A2A3A', accent: '#88B4D4', spine: '#0E1A28' }
    ];

    // Book positions — carefully placed around edges, never over center
    // rx: slight tilt, ry: shows spine/pages, rz: slight lean
    // Left-side books: positive ry shows right page-edge
    // Right-side books: negative ry shows spine
    var positions = [
      { left: 2,  top: 8,  scale: 0.95, rx: -8,  ry: 40,  rz: -4, w: 120, h: 165 },
      { left: 5,  top: 55, scale: 0.75, rx: 6,   ry: 35,  rz: 3,  w: 100, h: 145 },
      { left: 10, top: 78, scale: 0.8,  rx: -5,  ry: 45,  rz: -2, w: 110, h: 155 },
      { left: 82, top: 6,  scale: 0.9,  rx: 8,   ry: -40, rz: 4,  w: 115, h: 160 },
      { left: 88, top: 50, scale: 0.75, rx: -6,  ry: -35, rz: -3, w: 100, h: 140 },
      { left: 78, top: 76, scale: 0.9,  rx: 5,   ry: -45, rz: 2,  w: 120, h: 165 },
      { left: 0,  top: 34, scale: 0.65, rx: 10,  ry: 50,  rz: 5,  w: 90,  h: 130 },
      { left: 92, top: 30, scale: 0.7,  rx: -8,  ry: -42, rz: -3, w: 100, h: 140 }
    ];

    positions.forEach(function (pos, i) {
      var style = coverStyles[i % coverStyles.length];
      var book = buildRealisticBook(pos, style);
      container.appendChild(book);

      // Gentle floating animation
      var yDrift = 12 + Math.random() * 12;
      var dur = 8000 + Math.random() * 6000;
      book.animate([
        { transform: book.style.transform },
        { transform: book.style.transform.replace(
            /translateY\([^)]+\)/,
            'translateY(' + (-yDrift) + 'px)'
          ).replace(
            /rotateZ\([^)]+\)/,
            'rotateZ(' + (pos.rz + (Math.random() * 3 - 1.5)) + 'deg)'
          )
        }
      ], {
        duration: dur,
        iterations: Infinity,
        direction: 'alternate',
        easing: 'ease-in-out'
      });
    });
  }

  function buildRealisticBook(pos, style) {
    var DEPTH = 36; // thick book for visible page edges

    var el = document.createElement('div');
    el.className = 'fl-book';
    el.style.width = pos.w + 'px';
    el.style.height = pos.h + 'px';
    el.style.left = pos.left + '%';
    el.style.top = pos.top + '%';
    el.style.transform = 'translateY(0px) scale(' + pos.scale + ') rotateX(' + pos.rx + 'deg) rotateY(' + pos.ry + 'deg) rotateZ(' + pos.rz + 'deg)';
    el.style.opacity = 0;
    el.style.animation = 'heroFadeUp 1.2s ease-out ' + (1 + Math.random() * 1.5) + 's forwards';

    // ── Back Cover ──
    var back = document.createElement('div');
    back.className = 'fl-book__face fl-book__back';
    back.style.width = pos.w + 'px';
    back.style.height = pos.h + 'px';
    back.style.background = style.base;
    back.style.transform = 'translateZ(0px)';

    // ── Spine (left face) ──
    var spine = document.createElement('div');
    spine.className = 'fl-book__face fl-book__spine';
    spine.style.width = DEPTH + 'px';
    spine.style.height = pos.h + 'px';
    spine.style.background = 'linear-gradient(to right, ' + style.spine + ', ' + style.base + ' 40%, ' + style.spine + ')';
    spine.style.transform = 'rotateY(90deg) translateZ(0px) translateX(' + (DEPTH / 2) + 'px)';
    // Spine gold lines
    spine.innerHTML = '<div class="spine-line" style="background:' + style.accent + '"></div><div class="spine-line" style="background:' + style.accent + '"></div>';

    // ── Page block (right edge — visible page edges) ──
    var pageEdge = document.createElement('div');
    pageEdge.className = 'fl-book__face fl-book__page-edge';
    pageEdge.style.width = DEPTH + 'px';
    pageEdge.style.height = (pos.h - 8) + 'px';
    pageEdge.style.transform = 'rotateY(90deg) translateZ(' + (pos.w - 1) + 'px) translateX(' + (DEPTH / 2) + 'px)';

    // ── Page block (bottom edge) ──
    var pageBottom = document.createElement('div');
    pageBottom.className = 'fl-book__face fl-book__page-bottom';
    pageBottom.style.width = (pos.w - 6) + 'px';
    pageBottom.style.height = DEPTH + 'px';
    pageBottom.style.transform = 'rotateX(-90deg) translateZ(' + (pos.h - 3) + 'px) translateY(' + (DEPTH / 2) + 'px)';

    // ── Page block (top edge) ──
    var pageTop = document.createElement('div');
    pageTop.className = 'fl-book__face fl-book__page-top';
    pageTop.style.width = (pos.w - 6) + 'px';
    pageTop.style.height = DEPTH + 'px';
    pageTop.style.transform = 'rotateX(90deg) translateZ(3px) translateY(-' + (DEPTH / 2) + 'px)';

    // ── Front Cover ──
    var front = document.createElement('div');
    front.className = 'fl-book__face fl-book__front';
    front.style.width = pos.w + 'px';
    front.style.height = pos.h + 'px';
    front.style.background = style.base;
    front.style.transform = 'translateZ(' + DEPTH + 'px)';
    // Cover embossed detail
    front.innerHTML = '<div class="cover-detail" style="border-color:' + style.accent + '"><div class="cover-title-line" style="background:' + style.accent + '"></div><div class="cover-title-line short" style="background:' + style.accent + '"></div></div>';

    el.appendChild(back);
    el.appendChild(spine);
    el.appendChild(pageEdge);
    el.appendChild(pageBottom);
    el.appendChild(pageTop);
    el.appendChild(front);

    return el;
  }

  /* ── Golden Particles ──────────────────────────────────────── */
  function createParticles() {
    var canvas = document.getElementById('hero-particles');
    if (!canvas) return;
    var ctx = canvas.getContext('2d');
    var particles = [];
    var PARTICLE_COUNT = 40;

    function resize() {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    }
    resize();
    window.addEventListener('resize', resize);

    // Init particles
    for (var i = 0; i < PARTICLE_COUNT; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        r: 1 + Math.random() * 2,
        dx: (Math.random() - 0.5) * 0.3,
        dy: -0.2 - Math.random() * 0.3,
        alpha: 0.15 + Math.random() * 0.35,
        pulse: Math.random() * Math.PI * 2
      });
    }

    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach(function (p) {
        p.x += p.dx;
        p.y += p.dy;
        p.pulse += 0.015;

        // Wrap around
        if (p.y < -10) { p.y = canvas.height + 10; p.x = Math.random() * canvas.width; }
        if (p.x < -10) p.x = canvas.width + 10;
        if (p.x > canvas.width + 10) p.x = -10;

        var a = p.alpha * (0.6 + 0.4 * Math.sin(p.pulse));
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(212, 175, 105, ' + a + ')';
        ctx.fill();

        // Soft glow
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * 3, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(212, 175, 105, ' + (a * 0.15) + ')';
        ctx.fill();
      });
      requestAnimationFrame(draw);
    }
    draw();
  }
})();
