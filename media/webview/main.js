// doodle in distress webview: one state machine drives everything.
(function () {
  const vscode = acquireVsCodeApi();
  const CFG = window.SIDEKICK;
  const T = CFG.text;

  const $ = (id) => document.getElementById(id);
  const onboarding = $('onboarding');
  const card = $('card');
  const noteEl = $('note');

  // ---------------------------------------------------------------------------
  // State machine
  // ---------------------------------------------------------------------------
  const state = {
    stage: CFG.stages[0],
    parts: {},   // partName -> strokes (arrays of {x, y} in pad pixels)
    timers: [],  // cleared on every stage change so forced skips never leave stale callbacks
    busy: false, // true while a drawing submission is being handled
    petX: null,  // where the pet stands on stage (null = center); kept from wherever it last rolled to
    bodyAngle: 0, // body rotation it ended up at after rolling, so the drawing doesn't snap back
  };

  function later(ms, fn) {
    state.timers.push(setTimeout(fn, ms));
  }

  function goTo(stage) {
    state.timers.forEach(clearTimeout);
    state.timers = [];
    state.busy = false;
    state.stage = stage;
    vscode.postMessage({ type: 'stage', stage });
    render();
    enterStage(stage);
  }

  // What happens when a story stage starts (also when skipped to with Ctrl+Alt+N).
  function enterStage(stage) {
    const L = T.lines;
    if (stage === 'eyes') {
      // still ranting (mouth stage) — keep it going until the eyes are drawn
      if (!window.Speech.busy()) rantOn();
    } else if (stage === 'inspect') {
      walker.mode = 'idle';
      window.Speech.say(L.eyes, startInspect); // "…oh. so THIS is what you look like", then off to the code
    } else if (stage === 'highFive') {
      state.codeReady = false;
      window.Speech.say(L.goodJob, () => {
        walker.highFive();
        setNote(T.notes.highFive);
      });
    }
  }

  // Mouth stage rant: after the main rant, it keeps going with one loop line at a time.
  let rantIndex = 0;
  function rantOn() {
    later(CFG.timing.rantPauseMs, () => {
      if (state.stage !== 'eyes') return;
      const loop = T.lines.mouthLoop;
      window.Speech.say([loop[rantIndex++ % loop.length]], rantOn);
    });
  }

  function next() {
    const i = CFG.stages.indexOf(state.stage);
    if (i < CFG.stages.length - 1) goTo(CFG.stages[i + 1]);
  }

  function reset() {
    state.parts = {};
    punch.active = false;
    state.codeReady = false;
    state.petAway = false;
    state.petX = null;
    state.bodyAngle = 0;
    resetRoll();
    window.Speech.clear();
    clearPad();
    goTo(CFG.stages[0]);
  }

  const ONBOARDING = ['title', 'character', 'analyzing', 'sprite'];

  function render() {
    const s = state.stage;
    onboarding.innerHTML = '';
    if (s === 'title') renderTitle();
    else if (s === 'character') renderCharacter();
    else if (s === 'analyzing') renderAnalyzing();
    else if (s === 'sprite') renderSprite();

    card.classList.toggle('hidden', ONBOARDING.includes(s));
    $('btn-submit').classList.toggle('hidden', !(s === 'coding' && state.codeReady));
    // the highFive note only appears once it actually asks for the high five
    if (s === 'highFive') setNote(null);
    else showNote();
  }

  // ---------------------------------------------------------------------------
  // Onboarding screens
  // ---------------------------------------------------------------------------
  const ICONS = {
    smirk: '<circle cx="30" cy="30" r="22"/><path d="M21 26h4M35 26h4"/><path d="M20 38q10 5 20-4"/>',
    evil: '<circle cx="30" cy="30" r="22"/><path d="M17 20l9 5M43 20l-9 5"/><circle cx="23" cy="30" r="1.5"/><circle cx="37" cy="30" r="1.5"/><path d="M20 39l4 3 4-3 4 3 4-3 4 3"/>',
    kind: '<circle cx="30" cy="30" r="22"/><path d="M19 27q3-4 6 0M35 27q3-4 6 0"/><path d="M20 36q10 10 20 0"/>',
    stick: '<circle cx="30" cy="22" r="13"/><path d="M38 23h3"/><path d="M29 35l-3 8 4 8h5" /><path d="M31 35l-4 8 3 8h4" opacity=".45"/>',
    blob: '<path d="M12 46q-3-28 18-30 21 2 18 30-18 6-36 0z"/><circle cx="24" cy="30" r="1.5"/><circle cx="36" cy="30" r="1.5"/><path d="M27 37q3 2 6 0"/>',
    ghost: '<path d="M16 50V26q0-16 14-16t14 16v24l-5-5-4 5-5-5-5 5-4-5z"/><circle cx="25" cy="26" r="2"/><circle cx="35" cy="26" r="2"/>',
    pencil: '<path d="M18 42l22-22 5 5-22 22-6 1z"/><path d="M37 23l5 5"/>',
  };

  function choiceButton({ icon, name, desc, extraClass }, onClick) {
    const b = document.createElement('button');
    b.className = 'choice' + (extraClass ? ' ' + extraClass : '');
    b.innerHTML = `<svg viewBox="0 0 60 60">${ICONS[icon]}</svg><div class="name"></div>`;
    clumsy(b.querySelector('.name'), name);
    if (desc) {
      const d = document.createElement('div');
      d.className = 'desc';
      d.textContent = desc; // small text stays straight so it's readable
      b.appendChild(d);
    }
    b.addEventListener('click', () => onClick(b));
    return b;
  }

  function title(text) {
    const h = document.createElement('h1');
    h.className = 'ob-title';
    clumsy(h, text);
    return h;
  }

  // Chalkboard title card: the heading writes itself on letter by letter, then
  // draws its own underline, before the subtitle and the clickable CTA fade in.
  // CTA click advances to onboarding.
  function renderTitle() {
    const T0 = T.title;
    const wrap = document.createElement('div');
    wrap.className = 'title-stage';

    const headingWrap = document.createElement('div');
    headingWrap.className = 'title-heading-wrap';
    const heading = document.createElement('h1');
    heading.className = 'title-heading';
    headingWrap.appendChild(heading);

    const underline = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    underline.setAttribute('class', 'title-underline');
    underline.setAttribute('viewBox', '0 0 600 24');
    underline.setAttribute('preserveAspectRatio', 'none');
    underline.innerHTML = '<path d="M4,12 Q150,2 300,12 T596,10"/>';
    headingWrap.appendChild(underline);

    const sub = document.createElement('div');
    sub.className = 'title-sub';

    const cta = document.createElement('button');
    cta.type = 'button';
    cta.className = 'title-cta';

    wrap.append(headingWrap, sub, cta);
    onboarding.appendChild(wrap);

    const letters = clumsy(heading, T0.heading, { write: true });
    clumsy(sub, T0.subtitle);
    clumsy(cta, T0.cta);
    // Text + arrow share one inner wrapper so they idle-wiggle together,
    // independently of the button's own hover/press transform.
    const ctaInner = cta.firstElementChild;
    ctaInner.className = 'cta-inner';
    ctaInner.insertAdjacentHTML('beforeend', '<span class="cta-arrow">→</span>');
    cta.addEventListener('click', () => {
      if (cta.classList.contains('clicking')) return;
      cta.classList.add('clicking');
      Sound.pop(true);
      later(240, next);
    });

    // Wait a frame for layout (and the webfont) to settle before measuring letters.
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const hwRect = headingWrap.getBoundingClientRect();
      // Each letter's own box: it's wiped open from x0 to x1, so wider letters
      // take proportionally longer to appear, like a real stroke.
      const boxes = letters.map(({ el, newWord }) => {
        const r = el.getBoundingClientRect();
        return { el, newWord, width: r.width };
      });

      // Pace by letter width (wide letters take longer to trace) plus a small
      // travel gap before each one — bigger between words, like lifting the pen.
      const spans = boxes.map((b, i) => ({
        trace: Math.max(b.width, 7),
        gap: i === 0 ? 10 : b.newWord ? 15 : 3.5,
      }));
      const units = spans.reduce((a, s) => a + s.trace + s.gap, 0);
      const perUnit = CFG.timing.titleWriteMs / Math.max(units, 1);
      let acc = 0;
      const sched = spans.map((s) => {
        const gapStart = acc;
        const traceStart = (acc += s.gap * perUnit);
        const traceEnd = (acc += s.trace * perUnit);
        return { gapStart, traceStart, traceEnd };
      });
      const writeEnd = acc;

      const underlinePath = underline.querySelector('path');
      const ulLen = Math.ceil(underlinePath.getTotalLength());
      underlinePath.style.transition = 'none';
      underlinePath.style.strokeDasharray = String(ulLen);
      underlinePath.style.strokeDashoffset = String(ulLen);

      const PAUSE = 260, DRAG = 700; // beat after the last letter, then the underline
      const clamp01 = (p) => (p < 0 ? 0 : p > 1 ? 1 : p);
      const smooth = (p) => p * p * (3 - 2 * p);

      // One clock drives the whole card: no per-letter timers or restarted CSS
      // transitions, so the reveal never stalls between letters.
      const shown = new Array(boxes.length).fill(-1);
      const revealLetter = (i, p) => {
        if (p === shown[i]) return;
        shown[i] = p;
        const el = boxes[i].el;
        if (p >= 1) {
          el.style.clipPath = 'none';
          el.style.filter = 'none';
        } else {
          el.style.clipPath = `inset(-30% ${((1 - p) * 100).toFixed(1)}% -30% -12%)`;
          el.style.filter = `blur(${((1 - p) * 1.1).toFixed(2)}px)`;
        }
      };

      let start = performance.now();
      let finished = false;
      function tick(now) {
        // Bail out if the stage moved on (reset/skip) while we were animating.
        if (!headingWrap.isConnected || state.stage !== 'title') return;
        const t = now - start;

        if (t < writeEnd) {
          for (let i = 0; i < boxes.length; i++) {
            const s = sched[i];
            const span = Math.max(s.traceEnd - s.traceStart, 1);
            revealLetter(i, clamp01((t - s.traceStart) / span));
          }
        } else {
          for (let i = 0; i < boxes.length; i++) revealLetter(i, 1);
          const a = t - writeEnd;
          if (a >= PAUSE) {
            const p = clamp01((a - PAUSE) / DRAG);
            underlinePath.style.strokeDashoffset = String((ulLen * (1 - smooth(p))).toFixed(1));
            if (p >= 1 && !finished) {
              finished = true;
              headingWrap.classList.add('idle'); // gentle settle wiggle once written
              later(220, () => {
                sub.classList.add('show');
                later(500, () => sub.classList.add('idle'));
              });
              later(620, () => cta.classList.add('show'));
              return; // animation complete, stop the loop
            }
          }
        }
        requestAnimationFrame(tick);
      }

      start = performance.now();
      requestAnimationFrame(tick);
    }));
  }

  function renderCharacter() {
    const row = document.createElement('div');
    row.className = 'choices';
    for (const opt of T.character.options) {
      // Illusion of choice: every option leads to the same passive-aggressive coworker.
      row.appendChild(choiceButton({ icon: opt.face, name: opt.name, desc: opt.desc }, () => next()));
    }
    onboarding.append(title(T.character.title), row);
  }

  function renderAnalyzing() {
    const sub = document.createElement('div');
    sub.className = 'ob-sub';
    const bar = document.createElement('div');
    bar.className = 'progress';
    const fill = document.createElement('div');
    bar.appendChild(fill);
    const heading = title(T.analyzing.title);
    onboarding.append(heading, bar, sub);

    const ms = CFG.timing.analyzingMs;
    // Fill in stalls and bursts, segment by segment.
    let prevT = 0;
    for (const [tf, pf] of CFG.timing.analyzingCurve) {
      const start = prevT * ms, dur = (tf - prevT) * ms;
      later(start + 30, () => {
        fill.style.transitionDuration = dur + 'ms';
        fill.style.transitionTimingFunction = 'cubic-bezier(.2,.8,.3,1)';
        fill.style.width = pf * 100 + '%';
      });
      prevT = tf;
    }

    const steps = T.analyzing.steps;
    steps.forEach((step, i) => later((ms / steps.length) * i, () => (sub.textContent = step + '…')));

    later(ms, () => {
      clumsy(heading, T.analyzing.locked);
      heading.classList.add('ob-locked');
      bar.remove();
      sub.remove();
    });
    later(ms + CFG.timing.personalityLockedMs, next);
  }

  function renderSprite() {
    const row = document.createElement('div');
    row.className = 'choices';
    for (const p of T.sprite.presets) {
      // Presets are just for show: clicking one only selects it.
      row.appendChild(
        choiceButton({ icon: p.id, name: p.name }, (btn) => {
          row.querySelectorAll('.choice').forEach((c) => c.classList.remove('selected'));
          btn.classList.add('selected');
        })
      );
    }
    row.appendChild(choiceButton({ icon: 'pencil', name: T.sprite.drawOwn, extraClass: 'draw-own' }, () => next()));
    onboarding.append(title(T.sprite.title), row);
  }

  // ---------------------------------------------------------------------------
  // Clumsy lettering: each letter gets a small random tilt and hop, like we
  // wrote it by hand. Seeded by the text so a label wobbles the same way every time.
  // ---------------------------------------------------------------------------
  // opts.write: if set, letters start invisible/blurred (caller reveals them
  // itself — see renderTitle) instead of appearing all at once. Returns each
  // letter's element plus whether it starts a new word, for pacing reveals.
  function clumsy(el, text, opts = {}) {
    let seed = 0;
    for (const ch of text) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
    const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32) * 2 - 1;

    // One inner span so spaces survive inside flex containers.
    const inner = document.createElement('span');
    el.replaceChildren(inner);
    const letters = [];
    text.split(' ').forEach((word, wi) => {
      if (wi) inner.append(' ');
      const w = document.createElement('span');
      w.className = 'cw';
      [...word].forEach((ch, ci) => {
        const l = document.createElement('span');
        l.className = 'cl';
        l.textContent = ch;
        l.style.transform = `translateY(${(rand() * 1.8).toFixed(1)}px) rotate(${(rand() * 6).toFixed(1)}deg)`;
        if (opts.write) {
          // Clipped from the right = not drawn yet. The caller opens the clip
          // per frame (see renderTitle) for a left-to-right wipe — no CSS
          // transition here, it would lag a frame behind the loop.
          l.style.clipPath = 'inset(-30% 100% -30% -12%)';
          l.style.filter = 'blur(1.1px)';
        }
        w.appendChild(l);
        letters.push({ el: l, newWord: wi > 0 && ci === 0 });
      });
      inner.appendChild(w);
    });
    return letters;
  }

  // ---------------------------------------------------------------------------
  // App note (top-right): tells you what to draw next. This is the app talking;
  // the creature itself talks in a cloud (speech.js).
  // ---------------------------------------------------------------------------
  let noteTimer;
  function setNote(text) {
    if (!text) return noteEl.classList.add('hidden');
    clumsy(noteEl, text);
    noteEl.classList.remove('hidden');
    // replay the little "pop" so changes get noticed
    noteEl.classList.remove('pop');
    void noteEl.offsetWidth;
    noteEl.classList.add('pop');
  }
  function showNote() {
    clearTimeout(noteTimer);
    setNote(T.notes[state.stage]);
  }
  /** Temporarily replace the note, then go back to the stage's note. */
  function flashNote(text) {
    setNote(text);
    Sound.pop(false);
    clearTimeout(noteTimer);
    noteTimer = setTimeout(showNote, CFG.timing.flashNoteMs);
  }

  // ---------------------------------------------------------------------------
  // Drawing pad: captures raw strokes
  // ---------------------------------------------------------------------------
  const pad = $('pad');
  const padCtx = pad.getContext('2d');
  const padHint = $('pad-hint');
  let strokes = [];
  let current = null;

  function fitCanvas(canvas, ctx) {
    const dpr = window.devicePixelRatio || 1;
    const r = canvas.getBoundingClientRect();
    canvas.width = Math.max(1, Math.round(r.width * dpr));
    canvas.height = Math.max(1, Math.round(r.height * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return r;
  }

  function padPoint(e) {
    const r = pad.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  pad.addEventListener('pointerdown', (e) => {
    pad.setPointerCapture(e.pointerId);
    current = [padPoint(e)];
    strokes.push(current);
    padHint.classList.add('hidden');
    drawPad();
  });
  pad.addEventListener('pointermove', (e) => {
    if (!current) return;
    current.push(padPoint(e));
    drawPad();
  });
  const endStroke = () => (current = null);
  pad.addEventListener('pointerup', endStroke);
  pad.addEventListener('pointercancel', endStroke);

  function drawPad() {
    const r = pad.getBoundingClientRect();
    padCtx.clearRect(0, 0, r.width, r.height);
    drawStrokes(padCtx, strokes, cssVar('--ink'), 2.5);
  }

  function clearPad() {
    strokes = [];
    current = null;
    padHint.classList.remove('hidden');
    drawPad();
  }

  function submitDrawing(drawn) {
    const part = CFG.drawPart[state.stage];
    if (!part || state.busy) return; // not a drawing stage, or already submitting
    if (!drawn.length) return flashNote(T.draw.empty);

    state.parts[part] = drawn;
    if (part === 'body') resetRoll(); // start rolling from the middle
    if (part === 'leg1') resetHop();
    if (part === 'leg2') walker.reset({ x: hop.cx, angle: hop.angle }); // gets up by itself, then walks
    if (part === 'mouth') window.Speech.say(T.lines.mouth, rantOn); // first words: an existential rant
    clearPad();
    Sound.pop(true);
    next();
  }

  $('btn-done').addEventListener('click', () => submitDrawing(strokes));
  $('btn-clear').addEventListener('click', clearPad);
  $('btn-submit').addEventListener('click', () => vscode.postMessage({ type: 'submitCode' }));

  // ---------------------------------------------------------------------------
  // Stage rendering (one canvas, requestAnimationFrame)
  // ---------------------------------------------------------------------------
  const stage = $('stage');
  const ctx = stage.getContext('2d');
  let stageSize = { width: 0, height: 0 };

  function resize() {
    stageSize = fitCanvas(stage, ctx);
    fitCanvas(pad, padCtx);
    drawPad();
  }
  const ro = new ResizeObserver(resize);
  ro.observe(document.body);
  ro.observe(pad); // pad has no size while the card is hidden

  function cssVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  function drawStrokes(c, list, color, width) {
    c.strokeStyle = color;
    c.lineWidth = width;
    c.lineCap = 'round';
    c.lineJoin = 'round';
    for (const s of list) {
      c.beginPath();
      c.moveTo(s[0].x, s[0].y);
      if (s.length === 1) c.lineTo(s[0].x + 0.1, s[0].y);
      for (let i = 1; i < s.length; i++) c.lineTo(s[i].x, s[i].y);
      c.stroke();
    }
  }

  // Fill the area enclosed by the strokes (so the body hides the scenery behind it).
  function fillStrokes(c, list, color) {
    c.fillStyle = color;
    c.beginPath();
    for (const s of list) {
      c.moveTo(s[0].x, s[0].y);
      for (let i = 1; i < s.length; i++) c.lineTo(s[i].x, s[i].y);
    }
    c.fill();
  }

  // Normalize strokes: scale so the larger side equals `size`, and move the anchor
  // point ('center' of bbox, or 'top' = topmost point) to (0, 0).
  function normalize(list, size, anchor = 'center') {
    const pts = list.flat();
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of pts) {
      minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
    }
    const k = size / Math.max(maxX - minX, maxY - minY, 1);
    let ax = (minX + maxX) / 2, ay = (minY + maxY) / 2;
    if (anchor === 'top') {
      const top = pts.reduce((a, b) => (b.y < a.y ? b : a));
      ax = top.x; ay = top.y;
    }
    return list.map((s) => s.map((p) => ({ x: (p.x - ax) * k, y: (p.y - ay) * k })));
  }

  // Static placement of drawn parts (Phase 3). Animation comes in Phase 4.
  // Draws the pet standing on (cx, groundY) with body radius r.
  const blink = { until: 0, next: 0 };
  function updateBlink(now) {
    if (now < blink.next) return;
    blink.until = now + 120;
    blink.next = now + 1800 + Math.random() * 3500;
  }

  // legPose (optional): { a1, a2 } leg angles around the hips, { lift1, lift2 } foot lift.
  function drawPet(c, cx, groundY, r, P = state.parts, legPose = null) {
    const strokeWidth = CFG.pet.strokeWidth * (r / CFG.pet.bodyRadius);
    const legLen = r * 1.1;
    const cy = groundY - legLen - r;
    const ink = cssVar('--ink');

    const place = (strokes, x, y, size, anchor, color, fill, angle = 0) => {
      const n = normalize(strokes, size, anchor);
      c.save();
      c.translate(x, y);
      c.rotate(angle);
      if (fill) fillStrokes(c, n, fill);
      drawStrokes(c, n, color, strokeWidth);
      c.restore();
    };

    // One leg stands in the middle; once the second is drawn, the first shifts
    // right and the second goes on the left.
    const hipY = cy + r - 2;
    const spread = P.leg2 ? r * CFG.pet.legSpread : 0;
    const L = legPose || { a1: 0, a2: 0, lift1: 0, lift2: 0 };
    if (P.leg1) place(P.leg1, cx + spread, hipY - L.lift1, legLen, 'top', ink, null, L.a1);
    if (P.leg2) place(P.leg2, cx - spread, hipY - L.lift2, legLen, 'top', ink, null, L.a2);
    if (P.body) place(P.body, cx, cy, r * 2, 'center', ink, cssVar('--bg'), state.bodyAngle);
    if (P.mouth) {
      const mx = cx + r * 0.55, my = cy + r * 0.15;
      const open = Math.sin((performance.now() / 1000) * CFG.speech.mouthHz * Math.PI * 2) > 0;
      if (c === ctx && window.Speech.talking() && open) {
        c.save();
        c.beginPath();
        c.ellipse(mx, my, r * 0.11, r * 0.17, 0, 0, Math.PI * 2);
        c.fillStyle = cssVar('--bg');
        c.fill();
        c.strokeStyle = ink;
        c.lineWidth = strokeWidth;
        c.stroke();
        c.restore();
      } else place(P.mouth, mx, my, r * 0.4, 'center', ink);
    }
    if (P.eyes) {
      // blinks every few seconds (squashed flat for a moment)
      const ex = cx + r * 0.3, ey = cy - r * 0.3;
      if (c === ctx && performance.now() < blink.until) {
        c.save();
        c.translate(ex, ey);
        c.scale(1, 0.12);
        place(P.eyes, 0, 0, r * 0.5, 'center', ink);
        c.restore();
      } else place(P.eyes, ex, ey, r * 0.5, 'center', ink);
    }
  }

  // Clumsy rolling with real-ish physics. The body pivots about whichever point
  // of the drawn shape is currently lowest, so it never sinks below the ground
  // and lumpy drawings bob, rock, and get stuck. It pushes itself in uneven
  // bursts, rests (slipping back a bit), and bonks off the walls.
  // frustration goes up every push that gets nowhere (pushes get harder); later stages can read it.
  const roll = { x: null, angle: 0, omega: 0, dir: 1, phase: 'rest', phaseLeft: 0, effort: 0, pushFromX: 0, frustration: 0, shape: null, src: null };
  const rand = (lo, hi) => lo + Math.random() * (hi - lo);

  function resetRoll() {
    Object.assign(roll, { x: null, angle: 0, omega: 0, dir: 1, phase: 'rest', phaseLeft: 0.4, effort: 0, frustration: 0 });
  }

  // Normalized body points (centered at 0,0), cached per drawing.
  function rollShape() {
    if (roll.src !== state.parts.body) {
      roll.src = state.parts.body;
      roll.shape = normalize(state.parts.body, CFG.pet.bodyRadius * 2, 'center');
      roll.points = roll.shape.flat();
    }
    return roll.points;
  }

  // Lowest point of the shape at the current angle, relative to the center.
  function contactPoint(points, angle) {
    const cos = Math.cos(angle), sin = Math.sin(angle);
    let best = null;
    for (const p of points) {
      const x = p.x * cos - p.y * sin;
      const y = p.x * sin + p.y * cos;
      if (!best || y > best.y) best = { x, y };
    }
    return best;
  }

  function updateRoll(dt, cardLeft) {
    const R = CFG.roll;
    const r = CFG.pet.bodyRadius;
    const min = 24 + r;
    const max = Math.max(min, cardLeft - r - 12);
    if (roll.x == null) roll.x = (min + max) / 2;
    const points = rollShape();

    // Effort state machine: push → rest → push…, with random lengths and strength.
    roll.phaseLeft -= dt;
    if (roll.phaseLeft <= 0) {
      if (roll.phase === 'push') {
        const progress = (roll.x - roll.pushFromX) * roll.dir;
        roll.frustration = progress < R.stuckPx ? Math.min(roll.frustration + 1, R.maxFrustration) : 0;
        roll.phase = 'rest';
        roll.phaseLeft = rand(...R.restSec);
      } else {
        roll.phase = 'push';
        roll.phaseLeft = rand(...R.pushSec);
        roll.pushFromX = roll.x;
        roll.effort =
          R.pushAccel * (1 + rand(-R.pushJitter, R.pushJitter)) * (1 + R.frustrationBoost * roll.frustration);
      }
    }
    let motor = 0;
    if (roll.phase === 'push') motor = roll.dir * roll.effort;
    else if (roll.phase === 'rest') motor = -roll.dir * roll.effort * R.slipBack;

    // Gravity tips it toward whichever side its center hangs over the contact point.
    const c = contactPoint(points, roll.angle);
    const gravity = (-c.x / r) * R.gravity;

    roll.omega += (motor + gravity - R.friction * roll.omega) * dt;
    roll.angle += roll.omega * dt;
    // Rolling without slipping about the contact point: center moves by ω × height.
    roll.x += roll.omega * c.y * dt;

    // Walls. A real hit bounces it back and dazes it; just leaning on the wall doesn't.
    if (roll.x > max || roll.x < min) {
      const atRight = roll.x > max;
      roll.x = atRight ? max : min;
      const speed = Math.abs(roll.omega);
      if (atRight ? roll.omega > 0 : roll.omega < 0) roll.omega = -roll.omega * R.wallBounce;
      roll.dir = atRight ? -1 : 1;
      if (speed > 1 && roll.phase !== 'stunned') {
        roll.phase = 'stunned';
        roll.phaseLeft = R.stunnedSec;
        Sound.thud();
      }
    }
  }

  // Draws the user's drawn body rotated about its center, lifted so its
  // lowest point sits exactly on the ground line.
  function drawRollingCircle(c, groundY) {
    const lift = contactPoint(rollShape(), roll.angle).y;
    c.save();
    c.translate(roll.x, groundY - lift);
    c.rotate(roll.angle);
    fillStrokes(c, roll.shape, cssVar('--bg'));
    drawStrokes(c, roll.shape, cssVar('--ink'), CFG.pet.strokeWidth);
    c.restore();
  }

  // ---------------------------------------------------------------------------
  // One leg: wobbles, hops, loses balance, falls over, struggles back up.
  // The pose is a rotation of the whole (rigid) pet. While the foot is the lowest
  // point it pivots on the foot; tipped far enough, the body hits the ground and
  // it rolls on the body instead. So it never sinks below the ground line.
  // ---------------------------------------------------------------------------
  const hop = { footX: 0, cx: 0, angle: 0, lift: 0, squash: 0, dir: 1, phase: 'balance', t: 0, dur: 1, from: 0, hopsLeft: 0, tries: 0, omega: 0, legSrc: null, D: 0 };

  // fallen = true: the new leg sticks out sideways from the circle lying on the ground,
  // and it can't get itself up. false: starts standing (e.g. after you helped it up).
  function resetHop(fallen = true) {
    Object.assign(hop, { angle: 0, lift: 0, squash: 0, dir: 1, omega: 0 });
    hop.cx = state.petX ?? stageSize.width / 2;
    const D = footDistance();
    if (fallen) {
      const r = CFG.pet.bodyRadius;
      hop.fallDir = roll.dir || 1;
      hop.lying = Math.acos(Math.min(1, r / D)) * hop.fallDir;
      hop.angle = hop.lying;
      setHopPhase('lie');
    } else setHopPhase('balance');
    hop.footX = hop.cx - D * Math.sin(hop.angle);
  }

  // You picked it up and put it down: it ends up on its foot and wobbles upright.
  function helpUp() {
    hop.lift = 0;
    hop.squash = 0;
    setHopPhase('settle', CFG.oneLeg.settleSec);
  }

  // Distance from body center to the foot, measured from the actual leg drawing.
  // Also caches every point of the drawn pet (body + leg, relative to the body
  // center) so we can find its true lowest point at any tilt.
  function footDistance() {
    if (hop.legSrc !== state.parts.leg1 || hop.bodySrc !== state.parts.body || hop.bodyAngle !== state.bodyAngle) {
      const r = CFG.pet.bodyRadius;
      const leg = normalize(state.parts.leg1, r * 1.1, 'top').flat().map((p) => ({ x: p.x, y: p.y + r - 2 }));
      const cos = Math.cos(state.bodyAngle), sin = Math.sin(state.bodyAngle);
      const body = normalize(state.parts.body, r * 2, 'center').flat()
        .map((p) => ({ x: p.x * cos - p.y * sin, y: p.x * sin + p.y * cos }));
      hop.D = Math.max(...leg.map((p) => p.y));
      hop.points = [...body, ...leg];
      hop.legSrc = state.parts.leg1;
      hop.bodySrc = state.parts.body;
      hop.bodyAngle = state.bodyAngle;
    }
    return hop.D;
  }

  // How far below the body center the lowest point of the drawing is at this tilt.
  function lowestAt(angle) {
    const cos = Math.cos(angle), sin = Math.sin(angle);
    let low = -Infinity;
    for (const p of hop.points) low = Math.max(low, p.x * sin + p.y * cos);
    return low;
  }

  function setHopPhase(phase, dur) {
    const H = CFG.oneLeg;
    const defaults = {
      balance: () => rand(...H.balanceSec),
      crouch: () => H.crouchSec,
      air: () => rand(...H.airSec),
      land: () => H.landSec,
      lie: () => rand(...H.lieSec),
    };
    hop.phase = phase;
    hop.t = 0;
    hop.from = hop.angle;
    hop.dur = dur ?? (defaults[phase] ? defaults[phase]() : 1);
  }

  const ease = (t) => t * t * (3 - 2 * t);

  function updateHop(dt, cardLeft) {
    const H = CFG.oneLeg;
    const r = CFG.pet.bodyRadius;
    const D = footDistance();
    const touch = Math.acos(Math.min(1, r / D)); // tilt at which the body hits the ground
    const min = 24 + r + 10;
    const max = Math.max(min, cardLeft - r - 20);
    hop.t += dt;
    const k = Math.min(1, hop.t / hop.dur);
    const prevAngle = hop.angle;

    switch (hop.phase) {
      case 'balance': {
        // a wobble that gets worse the longer it stands there
        const amp = H.wobble[0] + (H.wobble[1] - H.wobble[0]) * k;
        hop.angle = hop.from * (1 - ease(Math.min(1, k * 4))) + amp * Math.sin(hop.t * H.wobbleHz * Math.PI * 2) + amp * 0.4 * Math.sin(hop.t * 7.3);
        hop.squash = 0;
        if (k >= 1) {
          hop.hopsLeft = 1 + Math.floor(Math.random() * H.maxHops);
          if (hop.footX > max - 40) hop.dir = -1;
          else if (hop.footX < min + 40) hop.dir = 1;
          else if (Math.random() < 0.25) hop.dir = -hop.dir;
          setHopPhase('crouch');
        }
        break;
      }
      case 'crouch':
        hop.squash = H.squash * ease(k);
        hop.angle = hop.from + (hop.dir * 0.08 - hop.from) * ease(k);
        if (k >= 1) {
          hop.hopDist = rand(...H.hopDist) * hop.dir;
          hop.hopH = rand(...H.hopHeight);
          setHopPhase('air');
        }
        break;
      case 'air':
        hop.footX = Math.max(min, Math.min(max, hop.footX + (hop.hopDist * dt) / hop.dur));
        hop.lift = hop.hopH * 4 * k * (1 - k);
        hop.squash = -0.12 * Math.sin(Math.PI * k); // stretch mid-air
        hop.angle = hop.from + hop.dir * 0.12 * Math.sin(Math.PI * k) + (Math.random() - 0.5) * 0.03;
        if (k >= 1) {
          hop.lift = 0;
          setHopPhase('land');
        }
        break;
      case 'land':
        hop.squash = H.squash * Math.sin(Math.PI * k);
        if (k >= 1) {
          hop.squash = 0;
          if (--hop.hopsLeft > 0) setHopPhase('crouch');
          else if (Math.random() < H.fallChance) {
            // usually falls forward, but never into a nearby wall
            let fall = Math.random() < 0.7 ? hop.dir : -hop.dir;
            if (hop.footX + fall * D * 1.4 > max || hop.footX + fall * D * 1.4 < min) fall = -fall;
            hop.omega = fall * H.tipKick;
            setHopPhase('tip', 99);
          } else setHopPhase('balance');
        }
        break;
      case 'tip':
        // inverted pendulum on the foot: tips over faster and faster
        hop.omega += H.tipGravity * Math.sin(hop.angle) * dt;
        hop.angle += hop.omega * dt;
        if (Math.abs(hop.angle) >= touch) {
          hop.fallDir = Math.sign(hop.angle);
          hop.angle = touch * hop.fallDir;
          hop.lying = hop.angle;
          setHopPhase('flop', H.flopSec);
        }
        break;
      case 'flop': {
        // body slams down, rolls a bit further, rocks back
        hop.angle = hop.lying + hop.fallDir * H.flopOver * Math.sin(Math.PI * k) * (1 - 0.6 * k);
        if (k >= 1) setHopPhase('lie');
        break;
      }
      case 'lie':
        hop.angle = hop.lying + (k < 0.6 && Math.random() < 0.1 ? (Math.random() - 0.5) * 0.08 : 0); // twitch
        if (k >= 1) {
          // Can't do it alone (getUpChance 0): it needs you to pick it up.
          if (Math.random() < H.getUpChance) setHopPhase('getUp', H.getUpSec);
          else {
            hop.tryAmp = rand(...H.tryAmp);
            setHopPhase('tryUp', rand(...H.failSec));
          }
        }
        break;
      case 'tryUp':
        // strains part of the way up… and flops back down
        hop.angle = hop.lying * (1 - hop.tryAmp * Math.sin(Math.PI * k));
        if (k >= 1) setHopPhase('lie');
        break;
      case 'getUp':
        // swings up past upright, a little too far
        hop.angle = hop.lying + (-hop.fallDir * H.overshoot - hop.lying) * ease(k);
        if (k >= 1) setHopPhase('settle', H.settleSec);
        break;
      case 'settle':
        // damped wobble back to upright
        hop.angle = hop.from * Math.cos(k * Math.PI * 3) * (1 - k);
        if (k >= 1) setHopPhase('balance');
        break;
    }

    // Position from the pose: pivot on the foot, or roll on the body once it's down.
    if (D * Math.cos(hop.angle) >= r) {
      hop.cx = hop.footX + D * Math.sin(hop.angle);
    } else {
      hop.cx += r * (hop.angle - prevAngle);
    }
    // keep the whole body on the open stage
    hop.cx = Math.max(24 + r, Math.min(cardLeft - r - 8, hop.cx));
    hop.footX = hop.cx - D * Math.sin(hop.angle);
  }

  function drawHop(c, groundY) {
    const r = CFG.pet.bodyRadius;
    const D = footDistance();
    footDistance(); // make sure the point cache is fresh
    const cy = groundY - lowestAt(hop.angle) - hop.lift; // the real lowest point touches the ground
    c.save();
    c.translate(hop.cx, cy);
    c.rotate(hop.angle);
    // squash/stretch around the foot
    c.translate(0, D);
    c.scale(1 + hop.squash * 0.6, 1 - hop.squash);
    c.translate(0, -D);
    drawPet(c, 0, r * 1.1 + r, r); // body centered on the origin
    c.restore();
  }

  // ---------------------------------------------------------------------------
  // Poke/drag: click or drag the pet itself — it flinches, yelps, and
  // (if dragged) gets picked up and dropped back into the simulation.
  // ---------------------------------------------------------------------------
  const poke = { dragging: false, pointerId: null, grabOffset: 0, targetX: null, moved: false, lastX: 0, vx: 0, tilt: 0, lift: 0 };

  function petFlinch(big) {
    poke.tilt = (Math.random() < 0.5 ? -1 : 1) * (big ? 0.5 : 0.3);
    poke.lift = big ? 10 : 5;
    if (big) Sound.thud();
    else Sound.pop(false);
    // Only complains if it has a mouth (and isn't already mid-sentence), in its own cloud.
    const lines = T.lines.poke;
    if (state.parts.mouth && !window.Speech.busy()) window.Speech.say([lines[Math.floor(Math.random() * lines.length)]]);
  }

  let petScreenX = 0, petScreenY = 0, petHitR = 0;
  function pokeHit(x, y) {
    const dx = x - petScreenX, dy = y - petScreenY;
    return dx * dx + dy * dy <= petHitR * petHitR;
  }

  stage.addEventListener('pointerdown', (e) => {
    if (ONBOARDING.includes(state.stage) || state.petAway || punch.active) return;
    if (!pokeHit(e.offsetX, e.offsetY)) return;
    if (state.stage === 'highFive' && walker.phase === 'highFive') return highFive(e.offsetX, e.offsetY);
    stage.setPointerCapture(e.pointerId);
    poke.dragging = true;
    poke.pointerId = e.pointerId;
    poke.grabOffset = e.offsetX - petScreenX;
    poke.moved = false;
    poke.lastX = e.offsetX;
    poke.vx = 0;
  });
  stage.addEventListener('pointermove', (e) => {
    if (!poke.dragging || e.pointerId !== poke.pointerId) return;
    if (Math.abs(e.offsetX - poke.lastX) > 2) poke.moved = true;
    poke.vx = e.offsetX - poke.lastX;
    poke.lastX = e.offsetX;
    // Keep it on the open stage: between the left edge and the drawing card.
    const r = CFG.pet.bodyRadius;
    const cardLeft = card.classList.contains('hidden') ? stageSize.width : card.offsetLeft;
    const min = 24 + r, max = Math.max(min, cardLeft - r - 12);
    poke.targetX = Math.max(min, Math.min(max, e.offsetX - poke.grabOffset));
  });
  function endPoke(e) {
    if (!poke.dragging || e.pointerId !== poke.pointerId) return;
    poke.dragging = false;
    poke.targetX = null;
    petFlinch(poke.moved);
    if (state.parts.leg1 && !state.parts.leg2) helpUp(); // picked up = helped up
    else if (walking()) walker.release();
  }
  stage.addEventListener('pointerup', endPoke);
  stage.addEventListener('pointercancel', endPoke);

  // You high-fived it. It can't take it: falls over, stays down, bitter.
  // The "high five" is more of a punch: it gets launched into the screen, tumbling in 3D,
  // and lands far away, tiny, on its back. Then it says its bitter lines from back there.
  const punch = { active: false };
  function highFive(clickX, clickY) {
    Sound.thud();
    Sound.pop(true);
    const r = CFG.pet.bodyRadius;
    const cardLeft = card.classList.contains('hidden') ? stageSize.width : card.offsetLeft;
    const groundY = stageSize.height - CFG.pet.groundOffset;
    const P = CFG.punch;
    const horizon = groundY * P.horizon;
    Object.assign(punch, {
      active: true,
      t0: performance.now(),
      clickX, clickY,
      x0: walker.x,
      y0: groundY - r * 1.55,          // middle of the standing pet
      fx: walker.x + (cardLeft / 2 - walker.x) * 0.2,
      horizon, groundY,
      leaving: null, gone: false,
      fy: horizon + (groundY - horizon) * P.farScale - r * P.farScale, // lying far away, on the far "ground"
      dir: walker.dir,
    });
    goTo('done');
    // bitter lines from where it landed, then it gets up and hops away into the abyss
    later((P.impactSec + P.flySec) * 1000 + 900, () => window.Speech.say(T.lines.bitter, startLeaving));
  }

  // Where things stand at a given depth (scale s): smaller = further away = closer to the horizon.
  const feetAt = (s) => punch.horizon + (punch.groundY - punch.horizon) * s;
  const standingY = (s) => feetAt(s) - CFG.pet.bodyRadius * 1.55 * s; // center of the standing pet
  const lyingY = (s) => feetAt(s) - CFG.pet.bodyRadius * s;          // center of the pet on its back

  function startLeaving() {
    // get up (still facing the way it was), then turn towards the left edge
    walker.reset({ x: punch.x0, dir: punch.dir });
    punch.leaving = { phase: 'getUp', t: 0, x: punch.fx, s: CFG.punch.farScale, last: performance.now() };
  }

  // After its last words: gets up, then slow, sad hops off to the left, each one a bit further
  // into the distance, until it's gone.
  function leaving(now, lying) {
    const L = CFG.punch.leave;
    const lv = punch.leaving;
    const dt = Math.min(0.05, (now - lv.last) / 1000);
    lv.last = now;
    lv.t += dt;
    const out = { x: lv.x, s: lv.s, y: standingY(lv.s), rz: 0, sx: 1, sy: 1 };
    if (lv.phase === 'getUp') {
      const k = Math.min(1, lv.t / L.getUpSec);
      const e = k * k * (3 - 2 * k);
      out.rz = lying * (1 - e) + 0.15 * Math.sin(k * Math.PI * 3) * (1 - k);
      out.y = lyingY(lv.s) + (standingY(lv.s) - lyingY(lv.s)) * e;
      if (k >= 1) Object.assign(lv, { phase: walker.dir === -1 ? 'rest' : 'turn', t: 0 });
    } else if (lv.phase === 'turn') {
      // paper-flip around to face the left edge
      const k = Math.min(1, lv.t / 0.3);
      out.sx = Math.cos(Math.PI * k);
      if (k >= 1) {
        walker.reset({ x: punch.x0, dir: -1 });
        out.sx = 1;
        Object.assign(lv, { phase: 'rest', t: 0 });
      }
    } else if (lv.phase === 'rest') {
      out.sy = lv.t < 0.12 ? 1 - 0.18 * Math.sin(Math.PI * lv.t / 0.12) : 1; // landing squash
      if (lv.t >= L.restSec) {
        Object.assign(lv, { phase: 'hop', t: 0, fromX: lv.x, fromS: lv.s, toX: lv.x - L.stepPx * lv.s, toS: lv.s * L.shrink });
      }
    } else if (lv.phase === 'hop') {
      const k = Math.min(1, lv.t / L.hopSec);
      out.s = lv.fromS + (lv.toS - lv.fromS) * k;
      out.x = lv.fromX + (lv.toX - lv.fromX) * k;
      out.y = standingY(out.s) - L.hopHeight * out.s * Math.sin(Math.PI * k);
      out.sy = 1 + 0.08 * Math.sin(Math.PI * k);
      if (k >= 1) {
        Object.assign(lv, { phase: 'rest', t: 0, x: lv.toX, s: lv.toS });
        // off the edge, or too small to see: gone into the abyss
        if (lv.x < -CFG.pet.bodyRadius * 3 * lv.s || lv.s < 0.05) punch.gone = true;
      }
    }
    return out;
  }

  function drawPunch(c, now, groundY) {
    const P = CFG.punch;
    const el = (now - punch.t0) / 1000;
    let s = 1, x = punch.x0, y = punch.y0, sx = 1, sy = 1, rz = 0;
    const lying = -punch.dir * Math.PI / 2; // ends up on its back
    if (el < P.impactSec) {
      // squashed toward you for a split second
      s = 1 + 0.18 * Math.sin(Math.PI * el / P.impactSec);
    } else if (el < P.impactSec + P.flySec) {
      const k = (el - P.impactSec) / P.flySec;
      const e = 1 - Math.pow(1 - k, 2); // fast at first, then drifts into the distance
      s = 1 + (P.farScale - 1) * e;
      x = punch.x0 + (punch.fx - punch.x0) * e;
      y = punch.y0 + (punch.fy - punch.y0) * e - P.arc * Math.sin(Math.PI * k);
      // 3D tumble: flipping head over heels (x axis) and spinning around (y axis)
      sy = Math.cos(2 * Math.PI * P.flipsX * e);
      sx = Math.cos(2 * Math.PI * P.spinsY * e);
      rz = lying * e;
    } else {
      // lands, bounces, lies there
      const k = el - P.impactSec - P.flySec;
      s = P.farScale;
      x = punch.fx;
      y = punch.fy - P.bounce * P.farScale * Math.abs(Math.sin(k * 9)) * Math.exp(-k * 5);
      rz = lying + (Math.random() < 0.01 ? 0.08 : 0); // the odd twitch
      sy = k < 0.12 ? 1 - 0.3 * Math.sin(Math.PI * k / 0.12) : 1;
      if (punch.leaving) ({ x, y, s, rz, sx, sy } = leaving(now, lying));
      if (punch.gone) return;
    }
    punch.x = x;
    punch.y = y;
    punch.s = s;
    c.save();
    c.translate(x, y);
    c.rotate(rz);
    c.scale(s * sx, s * sy);
    c.translate(-punch.x0, -punch.y0);
    walker.draw(c, groundY);
    c.restore();

    // impact burst where you clicked
    if (el < P.burstSec) {
      const k = el / P.burstSec;
      c.save();
      c.strokeStyle = cssVar('--ink');
      c.lineWidth = 3;
      c.lineCap = 'round';
      c.globalAlpha = 1 - k;
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2 + 0.3;
        const r0 = 10 + 30 * k, r1 = r0 + 14 * (1 - k) + 6;
        c.beginPath();
        c.moveTo(punch.clickX + Math.cos(a) * r0, punch.clickY + Math.sin(a) * r0);
        c.lineTo(punch.clickX + Math.cos(a) * r1, punch.clickY + Math.sin(a) * r1);
        c.stroke();
      }
      c.restore();
    }
  }

  // Rotates whatever drawFn() draws around (pivotX, pivotY) by the current poke tilt.
  function drawWithPoke(drawFn, pivotX, pivotY) {
    if (!poke.tilt) return drawFn();
    ctx.save();
    ctx.translate(pivotX, pivotY);
    ctx.rotate(poke.tilt);
    ctx.translate(-pivotX, -pivotY);
    drawFn();
    ctx.restore();
  }

  // Two legs: walking (walk.js).
  const walker = window.createWalker({ CFG, state, normalize, drawPet });
  const walking = () => !!state.parts.leg2; // walker draws it from now on (walks, or stands while talking)

  let lastFrameT = null;
  function frame(t) {
    const dt = lastFrameT == null ? 0 : Math.min((t - lastFrameT) / 1000, 0.05);
    lastFrameT = t;
    const { width, height } = stageSize;
    ctx.clearRect(0, 0, width, height);
    ctx.save();
    if (punch.active) {
      const el = (performance.now() - punch.t0) / 1000;
      const shake = CFG.punch.shake * Math.max(0, 1 - el / CFG.punch.shakeSec);
      if (shake > 0) ctx.translate((Math.random() - 0.5) * 2 * shake, (Math.random() - 0.5) * 2 * shake);
    }

    if (!ONBOARDING.includes(state.stage)) {
      const groundY = height - CFG.pet.groundOffset;
      window.Scenery.draw(ctx, dt, t, width, groundY, cssVar('--ink'));
      ctx.strokeStyle = cssVar('--ink-muted');
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(24, groundY);
      ctx.lineTo(width - 24, groundY);
      ctx.stroke();

      if (poke.dragging) {
        poke.lift += (14 - poke.lift) * 0.25;
        const targetTilt = Math.max(-0.5, Math.min(0.5, -poke.vx * 0.05));
        poke.tilt += (targetTilt - poke.tilt) * 0.3;
        poke.vx *= 0.8;
      } else {
        poke.tilt *= 0.86;
        poke.lift *= 0.86;
      }

      if (!state.petAway) {
        // Free space ends at the drawing card; the pet starts centered in it.
        const cardLeft = card.classList.contains('hidden') ? width : card.offsetLeft;
        // Just a circle so far (drawn, no legs yet): it rolls around.
        if (state.parts.body && !state.parts.leg1) {
          if (poke.dragging && poke.targetX != null) roll.x = poke.targetX;
          else updateRoll(dt, cardLeft);
          petScreenX = roll.x;
          petScreenY = groundY - CFG.pet.bodyRadius;
          petHitR = CFG.pet.bodyRadius * 1.5;
          drawWithPoke(() => drawRollingCircle(ctx, groundY - poke.lift), petScreenX, groundY);
          state.petX = roll.x;
          state.bodyAngle = roll.angle;
        } else if (state.parts.leg1 && !state.parts.leg2) {
          // One leg: hop, fall, can't get up. Picked up: it dangles upright wherever you drag it.
          if (poke.dragging) {
            if (poke.targetX != null) hop.cx = poke.targetX;
            hop.angle *= 0.85; // hangs straight down from your "hand"
            hop.footX = hop.cx - footDistance() * Math.sin(hop.angle);
          } else updateHop(dt, cardLeft);
          petScreenX = hop.cx;
          petScreenY = groundY - CFG.pet.bodyRadius * 1.6;
          petHitR = CFG.pet.bodyRadius * 1.7;
          drawWithPoke(() => drawHop(ctx, groundY - poke.lift), hop.cx, groundY);
          state.petX = hop.footX;
        } else if (punch.active) {
          drawPunch(ctx, performance.now(), groundY);
        } else if (walking()) {
          // Two legs: walks around (blind) until it has a mouth, then stands and talks.
          // Picked up: legs kick in the air.
          const r = CFG.pet.bodyRadius;
          if (state.parts.mouth && walker.phase !== 'highFive') walker.mode = 'idle';
          updateBlink(performance.now());
          if (poke.dragging) walker.drag(poke.targetX ?? walker.x, t);
          else walker.update(dt, 24 + r, Math.max(24 + r, cardLeft - r - 12));
          petScreenX = walker.x;
          petScreenY = groundY - r * 1.6;
          petHitR = r * 1.7;
          if (walker.phase === 'highFive') {
            // easy to hit: the body or the raised leg (the "hand" it's offering)
            petScreenX = walker.x + walker.dir * r * 0.6;
            petHitR = r * 2.3;
          }
          drawWithPoke(() => walker.draw(ctx, groundY - poke.lift), walker.x, groundY);
          state.petX = walker.x;
        } else {
          if (poke.dragging && poke.targetX != null) state.petX = poke.targetX;
          const cx = state.petX ?? cardLeft / 2;
          petScreenX = cx;
          petScreenY = groundY - CFG.pet.bodyRadius * 1.6;
          petHitR = CFG.pet.bodyRadius * 1.7;
          drawWithPoke(() => drawPet(ctx, cx, groundY - poke.lift, CFG.pet.bodyRadius), cx, groundY);
        }
        // The creature's words, in a cloud next to its mouth.
        const r = CFG.pet.bodyRadius;
        const px = state.petX ?? cardLeft / 2;
        const mouthY = groundY - r * 1.1 - r + r * 0.15;
        const facing = walking() ? walker.dir : 1; // mouth is on the side it faces
        // punched far away: talk from wherever it ended up
        const ax = punch.active ? punch.x + r * punch.s : px + facing * r * 0.55;
        const ay = punch.active ? punch.y - r * punch.s : mouthY;
        window.Speech.draw(ctx, t, ax, ay, cardLeft, cssVar('--bubble-ink'), cssVar('--bubble-bg'));
      }
    }
    ctx.restore(); // (shake)
    requestAnimationFrame(frame);
  }

  // ---------------------------------------------------------------------------
  // Chat heist: export the pet as a PNG for the desktop overlay window
  // ---------------------------------------------------------------------------
  // Stand-in stickman, used when nothing has been drawn yet.
  function defaultParts() {
    const circle = [];
    for (let a = 0; a <= Math.PI * 2 + 0.3; a += 0.25) {
      const wob = 1 + Math.sin(a * 3) * 0.04;
      circle.push({ x: Math.cos(a) * 40 * wob, y: Math.sin(a) * 38 * wob });
    }
    const leg = [{ x: 0, y: 0 }, { x: -6, y: 18 }, { x: 2, y: 36 }, { x: 16, y: 37 }];
    return {
      body: [circle],
      leg1: [leg],
      leg2: [leg.map((p) => ({ x: p.x + 4, y: p.y }))],
      mouth: [[{ x: 0, y: 0 }, { x: 12, y: -1 }]],
    };
  }

  const PNG_MARGIN = 10; // empty space around the pet in the exported PNG (feet sit this far above its bottom)
  function petPng() {
    const r = CFG.pet.bodyRadius * CFG.heist.petScale;
    const margin = PNG_MARGIN;
    const w = r * 2 + margin * 2;
    const h = r * 2 + r * 1.1 + margin * 2;
    const density = 2; // render at 2x so it stays crisp on HiDPI screens
    const c = document.createElement('canvas');
    c.width = Math.ceil(w * density);
    c.height = Math.ceil(h * density);
    const g = c.getContext('2d');
    g.scale(density, density);
    drawPet(g, w / 2, h - margin, r, state.parts.body ? state.parts : defaultParts());
    return c.toDataURL('image/png').split(',')[1];
  }

  // ---------------------------------------------------------------------------
  // Messages from the extension (hidden keybindings)
  // ---------------------------------------------------------------------------
  window.addEventListener('message', (e) => {
    const msg = e.data;
    if (msg.type === 'next') next();
    else if (msg.type === 'reset') reset();
    else if (msg.type === 'getHeist') {
      vscode.postMessage({
        type: 'heist', id: msg.id, png: petPng(), heist: CFG.heist,
        panel: heistPanel(), margin: PNG_MARGIN, endScale: 1 / CFG.heist.petScale,
      });
    } else if (msg.type === 'petAway') {
      if (!msg.away) landPetAt(msg.landX);
      state.petAway = msg.away;
    } else if (msg.type === 'inspectDone') {
      landPetAt(msg.landX);
      state.petAway = false;
      goTo('coding');
      window.Speech.say(T.lines.inspectDone);
    } else if (msg.type === 'rageQuit') {
      // you deleted everything: it talks you out of it and pastes the code back
      if (state.stage !== 'coding') return;
      window.Speech.say(T.lines.dontGiveUp, () => vscode.postMessage({ type: 'restoreCode' }));
    } else if (msg.type === 'restored') {
      later(CFG.timing.hintDelayMs, () => window.Speech.say(T.lines.hint));
    } else if (msg.type === 'codeReady') {
      state.codeReady = msg.ready;
      render();
    } else if (msg.type === 'submitResult') {
      if (msg.ok) goTo('highFive');
      else window.Speech.say([...T.lines.wrong, ...T.lines.hint]);
    } else if (msg.type === 'replay') {
      // Phase 8: submit recorded strokes for the current part.
      vscode.postMessage({ type: 'log', text: 'replay not implemented yet' });
    }
  });

  document.querySelectorAll('.btn').forEach((b) => clumsy(b, b.textContent));
  clumsy($('pad-hint'), $('pad-hint').textContent);
  // .title-cta is excluded: its own click handler plays a sound.
  document.addEventListener('pointerdown', (e) => {
    if (e.target.closest('.btn, .choice')) Sound.click();
  });
  // Where this panel sits on the screen. Pointer events carry both screen and
  // panel coordinates, so any click or drawing stroke tells us. The chat heist
  // uses it to jump out of, and land back in, the exact right spot.
  let screenOffset = null;
  const trackOffset = (e) => (screenOffset = { x: e.screenX - e.clientX, y: e.screenY - e.clientY });
  document.addEventListener('pointerdown', trackOffset, true);
  document.addEventListener('pointermove', trackOffset, true);

  // Where the pet is (and where it may land) in screen coordinates, for the overlay.
  function heistPanel() {
    if (!screenOffset) return null;
    const r = CFG.pet.bodyRadius;
    const cardLeft = card.classList.contains('hidden') ? stageSize.width : card.offsetLeft;
    return {
      petX: screenOffset.x + (state.petX ?? cardLeft / 2),
      groundY: screenOffset.y + stageSize.height - CFG.pet.groundOffset,
      minX: screenOffset.x + 24 + r,
      maxX: screenOffset.x + cardLeft - r - 12,
      left: screenOffset.x,
      top: screenOffset.y,
      width: stageSize.width,
    };
  }

  // The editor sits right above the panel, so the panel's screen rect tells the overlay where the code is.
  function startInspect() {
    const panel = heistPanel();
    if (!panel) {
      // never touched the panel, so we don't know where it is on screen: skip the trip
      goTo('coding');
      window.Speech.say(T.lines.inspectDone);
      return;
    }
    state.petAway = true;
    vscode.postMessage({
      type: 'inspect', png: petPng(), panel, margin: PNG_MARGIN, endScale: 1 / CFG.heist.petScale,
      inspect: CFG.inspect, lines: T.lines.inspect,
    });
  }

  // The overlay dropped the pet back into the panel at screen x: continue from there.
  function landPetAt(screenX) {
    if (screenX == null || !screenOffset) return;
    const x = screenX - screenOffset.x;
    state.petX = x;
    roll.x = x;
    if (state.parts.leg1 && !state.parts.leg2) resetHop(false); // lands upright, then carries on hopping
    else if (walking()) walker.reset({ x });
  }

  resize();
  goTo(state.stage);
  requestAnimationFrame(frame);
})();
