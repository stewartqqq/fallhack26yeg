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
      trees.push({ x, h, kind: r() < 0.4 ? 'pine' : 'round' });
      x += cfg.treeGap[0] + r() * (cfg.treeGap[1] - cfg.treeGap[0]);
    }
    const clouds = [];
    for (let i = 0; i < cfg.clouds; i++) {
      clouds.push({ x: r() * width, y: 30 + r() * groundY * 0.25, w: 36 + r() * 24 });
    }
    const tufts = [];
    x = 10 + r() * 30;
    while (x < width) {
      const blades = 2;
      tufts.push({ x, blades, h: 5 + r() * 6, seed: r() * 10 });
      x += cfg.grassGap[0] + r() * (cfg.grassGap[1] - cfg.grassGap[0]);
    }
    layout = { width, groundY, trees, clouds, tufts };
  }

  // ---------- doodle helpers ----------

  // Minimal shapes: one stroke each, no jitter.

  // Cloud: flat bottom, two humps on top, drawn as one clean outline.
  function drawCloud(c, x, y, w) {
    const a1 = x - w * 0.2, r1 = w * 0.3;  // big left hump
    const a2 = x + w * 0.22, r2 = w * 0.28; // smaller right hump
    // where the humps meet
    const mx = (r1 * r1 - r2 * r2 + a2 * a2 - a1 * a1) / (2 * (a2 - a1));
    const my = -Math.sqrt(Math.max(0, r1 * r1 - (mx - a1) ** 2));
    c.beginPath();
    c.moveTo(a1 - r1, y);
    c.lineTo(a2 + r2, y);
    c.arc(a2, y, r2, 0, Math.atan2(my, mx - a2), true);
    c.arc(a1, y, r1, Math.atan2(my, mx - a1), Math.PI, true);
    c.stroke();
  }

  function drawTree(c, tr, groundY) {
    const { x, h } = tr;
    c.beginPath();
    if (tr.kind === 'round') {
      const rr = h * 0.3;
      const top = groundY - h + rr;
      c.moveTo(x, groundY);
      c.lineTo(x, top + rr);
      c.moveTo(x + rr, top);
      c.arc(x, top, rr, 0, Math.PI * 2);
    } else {
      const trunk = h * 0.15;
      c.moveTo(x, groundY);
      c.lineTo(x, groundY - trunk);
      c.moveTo(x - h * 0.22, groundY - trunk);
      c.lineTo(x, groundY - h);
      c.lineTo(x + h * 0.22, groundY - trunk);
      c.closePath();
    }
    c.stroke();
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
      drawCloud(c, cl.x, cl.y, cl.w);
    }

    // trees
    c.globalAlpha = cfg.treeAlpha;
    c.lineWidth = 1.8;
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
