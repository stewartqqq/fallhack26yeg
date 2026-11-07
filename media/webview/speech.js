// The creature's speech: a scalloped cloud drawn on the stage canvas that follows the pet,
// with typewriter text. (App hints use the square note in the corner instead, so you can
// always tell who's talking.) Tunables live in config.js → speech.
window.Speech = (function () {
  const S = () => window.SIDEKICK.speech;

  let queue = [];
  let line = null; // { text, start }
  let lastT = 0;

  function say(lines) {
    queue = lines.slice();
    line = null;
    startNext(lastT);
  }

  function clear() {
    queue = [];
    line = null;
  }

  function startNext(t) {
    line = queue.length ? { text: queue.shift(), start: t } : null;
  }

  function shown(t) {
    return Math.min(line.text.length, Math.floor((t - line.start) / S().charMs));
  }

  /** True while a line is on screen or queued. */
  function busy() {
    return !!line || queue.length > 0;
  }

  /** True while letters are still appearing (drives the mouth flapping). */
  function talking() {
    return !!line && shown(lastT) < line.text.length;
  }

  function wrap(c, text, maxW) {
    const words = text.split(' ');
    const lines = [];
    let cur = '';
    for (const w of words) {
      const test = cur ? cur + ' ' + w : w;
      if (cur && c.measureText(test).width > maxW) {
        lines.push(cur);
        cur = w;
      } else cur = test;
    }
    lines.push(cur);
    return lines;
  }

  // Seeded per-letter wobble so the text looks hand-written (same idea as clumsy() in main.js).
  function jitter(i) {
    const x = Math.sin(i * 12.9898) * 43758.5453;
    return (x - Math.floor(x)) * 2 - 1;
  }

  /**
   * Update + draw. (ax, ay) is the pet's mouth; maxX is where free stage space ends.
   */
  function draw(c, t, ax, ay, maxX, ink, paper) {
    lastT = t;
    if (!line) return;
    const cfg = S();
    const n = shown(t);
    const typedFor = cfg.charMs * line.text.length;
    if (t - line.start > typedFor + cfg.holdMs + line.text.length * cfg.holdPerCharMs) {
      startNext(t);
      if (!line) return;
    }

    c.save();
    c.font = `${cfg.fontSize}px ${cfg.font}`;
    // Size the cloud for the full line so it doesn't grow while typing.
    const lines = wrap(c, line.text, cfg.maxWidth);
    const lh = cfg.fontSize * 1.25;
    const textW = Math.max(...lines.map((l) => c.measureText(l).width));
    const textH = lines.length * lh;
    const w = textW + cfg.padX * 2;
    const h = textH + cfg.padY * 2;
    const bump = cfg.bump;

    // Beside the pet (right of the mouth, or left of the head if there's no room),
    // a little higher than the mouth, kept on screen.
    const rx = w / 2, ry = h / 2;
    const reach = rx + bump; // cloud's half-width including bumps
    const roomRight = maxX - 8 - (ax + cfg.gap);
    const roomLeft = ax - cfg.headWidth - cfg.gap - 8;
    const fits = Math.max(roomRight, roomLeft) >= reach * 2;
    const right = roomRight >= reach * 2 || (!fits && roomRight >= roomLeft);
    let cx = right ? ax + cfg.gap + reach : ax - cfg.headWidth - cfg.gap - reach;
    cx = Math.max(reach + 8, Math.min(maxX - reach - 8, cx));
    // Squeezed in next to the head: go as high as possible so it covers less of it.
    const top = ry + bump + 6;
    const cy = fits ? Math.max(top, ay - cfg.lift) : top;

    // Cloud outline: stroke a ring of bumps, then fill over their insides.
    const count = Math.max(6, Math.round((Math.PI * (rx + ry)) / (bump * cfg.bumpSpacing)));
    const bumps = [];
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2;
      bumps.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry, bump * (0.85 + 0.3 * Math.abs(jitter(i + 7)))]);
    }
    // Tail: two little puffs from the cloud's edge toward the mouth.
    const toMouth = Math.atan2(ay - cy, ax - cx);
    const ex = cx + Math.cos(toMouth) * (rx + bump * 0.6);
    const ey = cy + Math.sin(toMouth) * (ry + bump * 0.6);
    const puffs = [
      [ex + (ax - ex) * 0.3, ey + (ay - ey) * 0.3, 6],
      [ex + (ax - ex) * 0.68, ey + (ay - ey) * 0.68, 3.5],
    ];

    c.lineWidth = 2.5;
    c.strokeStyle = ink;
    c.fillStyle = paper;
    for (const [x, y, r] of [...bumps, ...puffs]) {
      c.beginPath();
      c.arc(x, y, r, 0, Math.PI * 2);
      c.stroke();
    }
    for (const [x, y, r] of [...bumps, ...puffs]) {
      c.beginPath();
      c.arc(x, y, r - 1.2, 0, Math.PI * 2);
      c.fill();
    }
    c.beginPath();
    c.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    c.fill();

    // Typed text, letter by letter with a little wobble.
    c.fillStyle = ink;
    c.textBaseline = 'middle';
    let left = n;
    let k = 0;
    lines.forEach((l, li) => {
      let x = cx - c.measureText(l).width / 2;
      const y = cy - (lines.length - 1) * lh / 2 + li * lh;
      for (const ch of l) {
        if (left-- <= 0) break;
        c.save();
        c.translate(x, y + jitter(k) * 1.2);
        c.rotate(jitter(k + 99) * 0.06);
        c.fillText(ch, 0, 0);
        c.restore();
        x += c.measureText(ch).width;
        k++;
      }
      left--; // the space eaten by wrapping
    });
    c.restore();
  }

  return { say, clear, busy, talking, draw };
})();
