// Two legs: it walks! Much better than with one leg, still a bit awkward.
// Rigid paper-cutout parts: each leg swings around its hip, the whole pet tilts.
// The stance foot stays planted while the body moves over it (no sliding feet),
// the swing foot lifts and swings forward. Uneven steps, the odd stumble, pauses,
// paper-flip turns. It's blind, so it walks into walls, falls on its back, flails,
// gets up, and turns around. Tunables live in config.js → twoLegs.
window.createWalker = function ({ CFG, state, normalize, drawPet }) {
  const H = () => CFG.twoLegs;
  const rand = (lo, hi) => lo + Math.random() * (hi - lo);
  const lerp = (a, b, t) => a + (b - a) * t;
  const ease = (t) => t * t * (3 - 2 * t);
  const rot = (p, a) => {
    const c = Math.cos(a), s = Math.sin(a);
    return { x: p.x * c - p.y * s, y: p.x * s + p.y * c };
  };

  // Pose, in the pet's "facing" frame (+x = the way it faces). World x = cx + dir * x.
  const w = {
    cx: 0, dir: 1, flip: 1,   // body center x, facing (+1 right / -1 left), turn animation
    angle: 0,                 // whole-pet tilt (+ = leaning forward)
    a1: 0, a2: 0,             // leg angles around the hips (+ = foot swings back)
    lift1: 0, lift2: 0,       // swing foot lift
    stance: 1, footX: 0,      // planted leg and its foot's world x
    phase: 'stand', t: 0, dur: 1, from: 0,
    step: null, stepsLeft: 0, fallSign: 0, lying: 0, omega: 0, afterUp: null, tries: 0,
  };

  // ---------- geometry (cached per drawing) ----------
  let geo = null;
  function geometry() {
    const P = state.parts;
    if (geo && geo.src1 === P.leg1 && geo.src2 === P.leg2 && geo.srcB === P.body && geo.bodyAngle === state.bodyAngle) return geo;
    const r = CFG.pet.bodyRadius, legLen = r * 1.1, hipY = r - 2, spread = r * CFG.pet.legSpread;
    const body = normalize(P.body, r * 2, 'center').flat().map((p) => rot(p, state.bodyAngle));
    const leg = (L) => normalize(L, legLen, 'top').flat();
    const l1 = leg(P.leg1), l2 = leg(P.leg2);
    const foot = (pts) => pts.reduce((a, b) => (b.y > a.y ? b : a)); // a leg's lowest point is its foot
    geo = {
      src1: P.leg1, src2: P.leg2, srcB: P.body, bodyAngle: state.bodyAngle,
      r, legLen, hipY, body, l1, l2, f1: foot(l1), f2: foot(l2),
      hip1: { x: spread, y: hipY }, hip2: { x: -spread, y: hipY }, // same spots drawPet uses
    };
    return geo;
  }

  // A leg point in the facing frame (before the whole-pet tilt).
  function legPoint(i, p) {
    const g = geometry();
    const hip = i === 1 ? g.hip1 : g.hip2;
    const q = rot(p, i === 1 ? w.a1 : w.a2);
    return { x: hip.x + q.x, y: hip.y + q.y - (i === 1 ? w.lift1 : w.lift2) };
  }

  // Lowest point of the whole pet at tilt `a` (relative to body center), and which part it's on.
  function lowest(a) {
    const g = geometry();
    let best = null;
    const consider = (local, tag) => {
      const q = rot(local, a);
      if (!best || q.y > best.y) best = { x: q.x, y: q.y, local, tag };
    };
    for (const p of g.body) consider(p, 'body');
    for (const p of g.l1) consider(legPoint(1, p), 'leg');
    for (const p of g.l2) consider(legPoint(2, p), 'leg');
    return best;
  }

  // Tilt the whole pet while it's on the ground: pivot on a foot, or roll on the body.
  function tiltTo(a) {
    const c = lowest(w.angle);
    if (c.tag === 'body') w.cx += w.dir * geometry().r * (a - w.angle);
    else {
      const contactX = w.cx + w.dir * c.x;
      w.cx = contactX - w.dir * rot(c.local, a).x;
    }
    w.angle = a;
  }

  function stanceFoot() {
    const g = geometry();
    return rot(legPoint(w.stance, w.stance === 1 ? g.f1 : g.f2), w.angle);
  }

  // Tilt at which the body touches the ground (legs straight).
  function touchAngle() {
    const g = geometry();
    const D = g.hipY + Math.max(g.f1.y, g.f2.y);
    return Math.acos(Math.min(1, g.r / D));
  }

  function setPhase(phase, dur) {
    w.phase = phase;
    w.t = 0;
    w.from = w.angle;
    w.dur = dur;
    w.fromA1 = w.a1;
    w.fromA2 = w.a2;
  }

  // ---------- behaviour ----------
  function startWalking() {
    w.stepsLeft = Math.round(rand(...H().stepsInARow));
    startStep();
  }

  function startStep() {
    const h = H();
    // the leg that's further forward plants; the other one swings
    w.stance = w.a1 <= w.a2 ? 1 : 2;
    const stumble = Math.random() < h.stumbleChance;
    const A = rand(...h.stepAngle) * (stumble ? 0.5 : 1);
    w.step = {
      to1: w.stance === 1 ? A : -A,
      to2: w.stance === 1 ? -A : A,
      liftH: rand(...h.liftHeight),
      jolt: stumble ? h.stumbleJolt : 0,
      trip: Math.random() < h.tripChance,
    };
    w.lift1 = w.lift2 = 0;
    w.footX = w.cx + w.dir * stanceFoot().x;
    setPhase('step', rand(...h.stepSec) * (stumble ? 0.65 : 1));
  }

  function fall(sign, kick, afterUp) {
    w.fallSign = sign;
    w.omega = sign * kick;
    w.afterUp = afterUp;
    w.lift1 = w.lift2 = 0;
    setPhase('tip', 99);
  }

  function update(dt, min, max) {
    const h = H();
    w.t += dt;
    const k = Math.min(1, w.t / w.dur);
    const relaxLegs = (amt) => {
      w.a1 = lerp(w.fromA1, 0, amt);
      w.a2 = lerp(w.fromA2, 0, amt);
    };

    switch (w.phase) {
      case 'stand': {
        relaxLegs(ease(Math.min(1, k * 4)));
        w.angle = lerp(w.from, 0, ease(Math.min(1, k * 3))) + 0.02 * Math.sin(w.t * 3);
        if (k >= 1) {
          if (Math.random() < h.turnChance) setPhase('turn', h.turnSec);
          else startWalking();
        }
        break;
      }
      case 'turn':
        w.flip = Math.cos(Math.PI * k); // paper cutout flipping over
        if (k >= 1) {
          w.dir = -w.dir;
          w.flip = 1;
          if (w.afterUp === 'turn') w.afterUp = null;
          startWalking();
        }
        break;
      case 'step': {
        const s = w.step;
        const e = lerp(k, ease(k), 0.6);
        w.a1 = lerp(w.fromA1, s.to1, e);
        w.a2 = lerp(w.fromA2, s.to2, e);
        const lift = s.liftH * Math.sin(Math.PI * k);
        w.lift1 = w.stance === 1 ? 0 : lift;
        w.lift2 = w.stance === 2 ? 0 : lift;
        w.angle = h.lean + h.bob * Math.sin(2 * Math.PI * k) + s.jolt * Math.sin(Math.PI * k);
        // the planted foot stays put, the body moves over it
        w.cx = w.footX - w.dir * stanceFoot().x;
        // blind: walks right into the wall
        if (w.cx > max || w.cx < min) {
          w.cx = Math.max(min, Math.min(max, w.cx));
          window.Sound && window.Sound.thud();
          fall(-1, h.bonkKick, 'turn'); // bonk, falls on its back
          break;
        }
        if (k >= 1) {
          w.lift1 = w.lift2 = 0;
          if (s.trip) fall(1, h.tipKick, null); // tripped over nothing
          else if (--w.stepsLeft > 0) startStep();
          else setPhase('stand', rand(...h.standSec));
        }
        break;
      }
      case 'tip': {
        relaxLegs(Math.min(1, w.t * 6));
        w.omega += h.tipGravity * Math.sin(w.angle || w.fallSign * 0.01) * dt;
        const a = w.angle + w.omega * dt;
        const touch = touchAngle();
        if (Math.abs(a) >= touch) {
          tiltTo(touch * w.fallSign);
          w.lying = w.angle;
          setPhase('flop', h.flopSec);
        } else tiltTo(a);
        break;
      }
      case 'flop':
        tiltTo(w.lying + w.fallSign * h.flopOver * Math.sin(Math.PI * k) * (1 - 0.6 * k));
        if (k >= 1) setPhase('lie', rand(...h.lieSec));
        break;
      case 'lie':
        // legs flail in the air
        w.a1 = h.flail * Math.sin(w.t * 15);
        w.a2 = -h.flail * Math.sin(w.t * 15 + 1.3);
        if (k >= 1) {
          const fail = w.tries === 0 && Math.random() < h.failFirstTry;
          w.tries = fail ? 1 : 0;
          setPhase(fail ? 'tryUp' : 'getUp', fail ? h.failSec : h.getUpSec);
        }
        break;
      case 'tryUp':
        relaxLegs(Math.min(1, k * 3));
        tiltTo(w.lying * (1 - 0.5 * Math.sin(Math.PI * k)));
        if (k >= 1) setPhase('lie', 0.35);
        break;
      case 'getUp':
        relaxLegs(Math.min(1, k * 3));
        tiltTo(lerp(w.lying, -w.fallSign * h.overshoot, ease(k)));
        if (k >= 1) setPhase('settle', h.settleSec);
        break;
      case 'settle':
        relaxLegs(Math.min(1, k * 3));
        tiltTo(w.from * Math.cos(k * Math.PI * 3) * (1 - k));
        if (k >= 1) {
          if (w.afterUp === 'turn') setPhase('turn', h.turnSec);
          else setPhase('stand', rand(...h.standSec) * 0.5);
        }
        break;
    }
    w.cx = Math.max(min, Math.min(max, w.cx));
  }

  // ---------- public ----------
  return {
    get x() { return w.cx; },
    get phase() { return w.phase; }, // for debugging

    /** Start walking at body-center x. `angle` > 0.2: it was lying down and gets up first. */
    reset({ x, angle = 0, dir = 1 }) {
      Object.assign(w, { cx: x, dir, flip: 1, angle, a1: 0, a2: 0, lift1: 0, lift2: 0, tries: 1, afterUp: null });
      if (Math.abs(angle) > 0.2) {
        w.fallSign = Math.sign(angle);
        w.lying = angle;
        setPhase('lie', 0.5); // finally able to stand: no failed attempt this time
      } else setPhase('stand', 0.6);
    },

    update(dt, min, max) {
      update(dt, min, max);
    },

    /** Picked up: dangles upright under your cursor, legs kicking. */
    drag(x, t) {
      w.cx = x;
      w.angle *= 0.85;
      w.a1 = 0.45 * Math.sin(t / 60);
      w.a2 = -0.45 * Math.sin(t / 60 + 1.3);
      w.lift1 = w.lift2 = 0;
    },

    /** Put down: lands on its feet, wobbles, carries on. */
    release() {
      w.tries = 0;
      setPhase('settle', H().settleSec);
    },

    draw(c, groundY) {
      const g = geometry();
      const cy = groundY - lowest(w.angle).y;
      c.save();
      c.translate(w.cx, cy);
      c.scale(w.dir * w.flip, 1);
      c.rotate(w.angle);
      drawPet(c, 0, g.legLen + g.r, g.r, state.parts, { a1: w.a1, a2: w.a2, lift1: w.lift1, lift2: w.lift2 });
      c.restore();
    },
  };
};
