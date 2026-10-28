// Starfield behind the booklet: twinkling stars with the odd shooting star.
(function () {
  const canvas = document.getElementById('stars');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let w, h, dpr, stars = [], shooter = null, nextShot = 0;

  function resize() {
    dpr = Math.min(devicePixelRatio || 1, 2);
    w = innerWidth;
    h = innerHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const count = Math.round((w * h) / 2600);
    stars = Array.from({ length: count }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      r: Math.random() < 0.08 ? 1.2 + Math.random() * 0.9 : 0.3 + Math.random() * 0.8,
      phase: Math.random() * Math.PI * 2,
      speed: 0.6 + Math.random() * 1.6,
      tint: Math.random() < 0.15 ? '255, 236, 190' : Math.random() < 0.3 ? '190, 210, 255' : '255, 255, 255',
    }));
    if (still) draw(0);
  }

  function draw(t) {
    ctx.clearRect(0, 0, w, h);
    for (const s of stars) {
      const a = still ? 0.75 : 0.45 + 0.55 * Math.abs(Math.sin(s.phase + (t / 1000) * s.speed));
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${s.tint}, ${a * (s.r > 1.2 ? 1 : 0.85)})`;
      ctx.fill();
      if (s.r > 1.2) { // soft glow on the brightest stars
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r * 3.2, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${s.tint}, ${a * 0.08})`;
        ctx.fill();
      }
    }
    if (shooter) {
      const s = shooter;
      const p = (t - s.start) / s.dur;
      if (p >= 1) shooter = null;
      else {
        const x = s.x + s.dx * p, y = s.y + s.dy * p;
        const g = ctx.createLinearGradient(x, y, x - s.dx * 0.18, y - s.dy * 0.18);
        g.addColorStop(0, `rgba(255, 255, 255, ${0.9 * (1 - p)})`);
        g.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.strokeStyle = g;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x - s.dx * 0.18, y - s.dy * 0.18);
        ctx.stroke();
      }
    }
  }

  function loop(t) {
    if (!shooter && t > nextShot) {
      shooter = { x: Math.random() * w * 0.7, y: Math.random() * h * 0.35, dx: 260 + Math.random() * 240, dy: 120 + Math.random() * 120, start: t, dur: 900 };
      nextShot = t + 5000 + Math.random() * 7000;
    }
    draw(t);
    requestAnimationFrame(loop);
  }

  addEventListener('resize', resize);
  resize();
  if (!still) {
    nextShot = performance.now() + 2500;
    requestAnimationFrame(loop);
  }
})();
