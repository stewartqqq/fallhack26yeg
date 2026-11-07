// Background doodles for the stage: trees, clouds, birds, grass tufts.
// Purely decorative; nothing here interacts with the pet. Tunables live in config.js → scenery.
window.Scenery = (function () {
  const S = () => window.SIDEKICK.scenery;

  // Small seeded RNG so the layout is the same every frame (and every reload) for a given width.
  function rng(seed) {
    return function () {
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  let layout = null; // { width, groundY, trees, clouds, tufts }
  let birds = [];

  // ---------- layout (static stuff) ----------

  function build(width, groundY) {
    const cfg = S();
    const r = rng(Math.round(width) * 7 + 3);
    const trees = [];
    let x = 30 + r() * 60;
    while (x < width - 20) {
      const h = cfg.treeHeight[0] + r() * (cfg.treeHeight[1] - cfg.treeHeight[0]);
      trees.push({ x, h, kind: r() < 0.35 ? 'pine' : 'round', seed: Math.floor(r() * 1e6), lean: (r() - 0.5) * 0.08 });
      x += cfg.treeGap[0] + r() * (cfg.treeGap[1] - cfg.treeGap[0]);
    }
    const clouds = [];
    for (let i = 0; i < cfg.clouds; i++) {
      clouds.push({ x: r() * width, y: 18 + r() * groundY * 0.25, w: 40 + r() * 40, seed: Math.floor(r() * 1e6) });
    }
    const tufts = [];
    x = 10 + r() * 30;
    while (x < width) {
      const blades = 2 + Math.floor(r() * 3);
      tufts.push({ x, blades, h: 5 + r() * 6, seed: r() * 10 });
      x += cfg.grassGap[0] + r() * (cfg.grassGap[1] - cfg.grassGap[0]);
    }
    layout = { width, groundY, trees, clouds, tufts };
  }

  // ---------- doodle helpers ----------

  // Wobbly closed loop around (cx, cy). bumps > 0 gives a scalloped (cloud/canopy) edge.
  function blob(c, cx, cy, rx, ry, seed, bumps) {
    const r = rng(seed);
    const n = 28;
    const phase = r() * 6;
    c.beginPath();
    for (let i = 0; i <= n + 1; i++) {
      const a = (i / n) * Math.PI * 2;
      let k = 1 + (r() - 0.5) * 0.08;
      if (bumps) k += Math.abs(Math.sin(a * bumps + phase)) * 0.18;
      const px = cx + Math.cos(a) * rx * k;
      const py = cy + Math.sin(a) * ry * k;
      i ? c.lineTo(px, py) : c.moveTo(px, py);
    }
    c.stroke();
  }

  function wobblyLine(c, x0, y0, x1, y1, seed) {
    const r = rng(seed);
    c.beginPath();
    c.moveTo(x0, y0);
    const steps = 4;
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      c.lineTo(x0 + (x1 - x0) * t + (i < steps ? (r() - 0.5) * 2 : 0), y0 + (y1 - y0) * t);
    }
    c.stroke();
  }

  function drawTree(c, tr, groundY) {
    const { x, h, seed, lean } = tr;
    c.save();
    c.translate(x, groundY);
    c.rotate(lean);
    if (tr.kind === 'round') {
      const trunkH = h * 0.45;
      wobblyLine(c, -3, 0, -2, -trunkH, seed);
      wobblyLine(c, 3, 0, 2, -trunkH, seed + 1);
      wobblyLine(c, 0, -trunkH * 0.6, 8, -trunkH * 0.9, seed + 2); // little branch
      const rr = h * 0.32;
      blob(c, 0, -trunkH - rr * 0.7, rr, rr * 0.9, seed, 5);
    } else {
      const trunkH = h * 0.18;
      wobblyLine(c, -2, 0, -2, -trunkH, seed);
      wobblyLine(c, 2, 0, 2, -trunkH, seed + 1);
      // zig-zag pine: three stacked triangles
      const w = h * 0.28;
      for (let i = 0; i < 3; i++) {
        const base = -trunkH - i * h * 0.24;
        const ww = w * (1 - i * 0.22);
        c.beginPath();
        c.moveTo(-ww, base);
        c.lineTo(0, base - h * 0.36);
        c.lineTo(ww, base);
        c.closePath();
        c.stroke();
      }
    }
    c.restore();
  }

  function drawBird(c, b, t) {
    const flap = Math.sin(t * b.flapSpeed + b.phase);
    const w = b.size;
    const tip = -w * 0.55 * flap; // wing tips go up and down
    c.save();
    c.translate(b.x, b.y + Math.sin(t * 0.8 + b.phase) * 3);
    c.scale(b.vx < 0 ? -1 : 1, 1);
    c.beginPath();
    c.moveTo(-w, tip);
    c.quadraticCurveTo(-w * 0.45, -w * 0.35, 0, 0);
    c.quadraticCurveTo(w * 0.45, -w * 0.35, w, tip);
    c.stroke();
    c.restore();
  }

  function spawnBird(width, groundY, fromEdge) {
    const cfg = S();
    const dir = Math.random() < 0.7 ? 1 : -1;
    const speed = cfg.birdSpeed[0] + Math.random() * (cfg.birdSpeed[1] - cfg.birdSpeed[0]);
    return {
      x: fromEdge ? (dir > 0 ? -20 - Math.random() * width * 0.5 : width + 20 + Math.random() * width * 0.5) : Math.random() * width,
      y: 20 + Math.random() * groundY * 0.4,
      vx: dir * speed,
      size: 5 + Math.random() * 3,
      flapSpeed: 7 + Math.random() * 4,
      phase: Math.random() * 6,
    };
  }

  // ---------- per frame ----------

  function draw(c, dt, t, width, groundY, ink) {
    const cfg = S();
    if (!layout || layout.width !== width || layout.groundY !== groundY) {
      build(width, groundY);
      birds = Array.from({ length: cfg.birds }, () => spawnBird(width, groundY, false));
    }
    const time = t / 1000;
    c.save();
    c.strokeStyle = ink;
    c.lineCap = 'round';
    c.lineJoin = 'round';

    // clouds (slow drift, wrap around)
    c.globalAlpha = cfg.cloudAlpha;
    c.lineWidth = 1.8;
    for (const cl of layout.clouds) {
      cl.x += cfg.cloudSpeed * dt;
      if (cl.x - cl.w > width) cl.x = -cl.w;
      blob(c, cl.x, cl.y, cl.w * 0.5, cl.w * 0.2, cl.seed, 3);
    }

    // trees
    c.globalAlpha = cfg.treeAlpha;
    c.lineWidth = 2;
    for (const tr of layout.trees) drawTree(c, tr, groundY);

    // birds
    c.globalAlpha = cfg.birdAlpha;
    c.lineWidth = 1.8;
    for (let i = 0; i < birds.length; i++) {
      const b = birds[i];
      b.x += b.vx * dt;
      if ((b.vx > 0 && b.x > width + 40) || (b.vx < 0 && b.x < -40)) birds[i] = spawnBird(width, groundY, true);
      drawBird(c, b, time);
    }

    // grass tufts along the ground, swaying a touch
    c.globalAlpha = cfg.grassAlpha;
    c.lineWidth = 1.5;
    for (const g of layout.tufts) {
      const sway = Math.sin(time * 1.5 + g.seed) * 1.5;
      c.beginPath();
      for (let k = 0; k < g.blades; k++) {
        const spread = (k - (g.blades - 1) / 2) * 3;
        c.moveTo(g.x + spread * 0.4, groundY);
        c.lineTo(g.x + spread + sway, groundY - g.h * (k % 2 ? 0.75 : 1));
      }
      c.stroke();
    }
    c.restore();
  }

  return { draw };
})();
