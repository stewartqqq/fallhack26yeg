// Digital Sidekick webview: one state machine drives everything.
(function () {
  const vscode = acquireVsCodeApi();
  const CFG = window.SIDEKICK;
  const T = CFG.text;

  const $ = (id) => document.getElementById(id);
  const onboarding = $('onboarding');
  const card = $('card');
  const toastEl = $('toast');

  // ---------------------------------------------------------------------------
  // State machine
  // ---------------------------------------------------------------------------
  const state = {
    stage: CFG.stages[0],
    parts: {},   // partName -> strokes (arrays of {x, y} in pad pixels)
    timers: [],  // cleared on every stage change so forced skips never leave stale callbacks
    busy: false, // true while a fake "Recognizing…" is in flight
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
  }

  function next() {
    const i = CFG.stages.indexOf(state.stage);
    if (i < CFG.stages.length - 1) goTo(CFG.stages[i + 1]);
  }

  function reset() {
    state.parts = {};
    clearPad();
    hideToast();
    goTo(CFG.stages[0]);
  }

  const ONBOARDING = ['character', 'analyzing', 'sprite'];

  function render() {
    const s = state.stage;
    onboarding.innerHTML = '';
    if (s === 'character') renderCharacter();
    else if (s === 'analyzing') renderAnalyzing();
    else if (s === 'sprite') renderSprite();

    card.classList.toggle('hidden', ONBOARDING.includes(s));
    const tokensVisible = ['roasted', 'tokens', 'pointing'].includes(s);
    $('btn-tokens').classList.toggle('hidden', !tokensVisible);
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
    b.innerHTML =
      `<svg viewBox="0 0 60 60">${ICONS[icon]}</svg>` +
      `<div class="name">${name}</div>` +
      (desc ? `<div class="desc">${desc}</div>` : '');
    b.addEventListener('click', () => onClick(b));
    return b;
  }

  function title(text) {
    const h = document.createElement('h1');
    h.className = 'ob-title';
    h.textContent = text;
    return h;
  }

  function renderCharacter() {
    const row = document.createElement('div');
    row.className = 'choices';
    for (const opt of T.character.options) {
      // Illusion of choice: every option leads to the same evil joker.
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
    fill.style.transitionDuration = ms + 'ms';
    requestAnimationFrame(() => requestAnimationFrame(() => (fill.style.width = '100%')));

    const steps = T.analyzing.steps;
    steps.forEach((step, i) => later((ms / steps.length) * i, () => (sub.textContent = step + '…')));

    later(ms, () => {
      heading.textContent = T.analyzing.locked;
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
  // Toast
  // ---------------------------------------------------------------------------
  let toastTimer;
  function toast(text, ms = CFG.timing.toastMs) {
    clearTimeout(toastTimer);
    toastEl.textContent = text;
    toastEl.classList.remove('hidden');
    if (ms) toastTimer = setTimeout(hideToast, ms);
  }
  function hideToast() {
    clearTimeout(toastTimer);
    toastEl.classList.add('hidden');
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
    if (!drawn.length) return toast(T.draw.empty);

    state.parts[part] = drawn;
    state.busy = true;
    clearPad();
    toast(T.draw.recognizing, 0);
    later(CFG.timing.recognizingMs, () => {
      toast(T.draw.detected(CFG.partLabel[part]));
      next();
    });
  }

  $('btn-done').addEventListener('click', () => submitDrawing(strokes));
  $('btn-clear').addEventListener('click', clearPad);
  $('btn-tokens').addEventListener('click', () => {
    // Phase 6: fake usage-limit modal.
  });

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
  function drawPet() {
    const { bodyRadius: r, groundOffset, strokeWidth } = CFG.pet;
    const groundY = stageSize.height - groundOffset;
    const legLen = r * 1.1;
    const cx = stageSize.width / 2;
    const cy = groundY - legLen - r;
    const ink = cssVar('--ink');
    const muted = cssVar('--ink-muted');
    const P = state.parts;

    const place = (strokes, x, y, size, anchor, color) => {
      ctx.save();
      ctx.translate(x, y);
      drawStrokes(ctx, normalize(strokes, size, anchor), color, strokeWidth);
      ctx.restore();
    };

    if (P.legRight) place(P.legRight, cx + 3, cy + r - 2, legLen, 'top', muted); // back leg
    if (P.legLeft) place(P.legLeft, cx - 3, cy + r - 2, legLen, 'top', ink);
    if (P.body) place(P.body, cx, cy, r * 2, 'center', ink);
    if (P.mouth) place(P.mouth, cx + r * 0.55, cy + r * 0.15, r * 0.4, 'center', ink);
    if (P.eyes) place(P.eyes, cx + r * 0.3, cy - r * 0.3, r * 0.5, 'center', ink);
  }

  function frame() {
    const { width, height } = stageSize;
    ctx.clearRect(0, 0, width, height);

    if (!ONBOARDING.includes(state.stage)) {
      const groundY = height - CFG.pet.groundOffset;
      ctx.strokeStyle = cssVar('--ink-muted');
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(24, groundY);
      ctx.lineTo(width - 24, groundY);
      ctx.stroke();
      drawPet();
    }
    requestAnimationFrame(frame);
  }

  // ---------------------------------------------------------------------------
  // Messages from the extension (hidden keybindings)
  // ---------------------------------------------------------------------------
  window.addEventListener('message', (e) => {
    const msg = e.data;
    if (msg.type === 'next') next();
    else if (msg.type === 'reset') reset();
    else if (msg.type === 'replay') {
      // Phase 8: submit recorded strokes for the current part.
      vscode.postMessage({ type: 'log', text: 'replay not implemented yet' });
    }
  });

  resize();
  goTo(state.stage);
  requestAnimationFrame(frame);
})();
