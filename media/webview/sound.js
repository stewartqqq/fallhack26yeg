// Tiny procedural sound effects via Web Audio — no audio files, fully offline.
window.Sound = (function () {
  let ctx;
  function ac() {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  // Browsers block audio until the page has been interacted with. Nudge the
  // context awake on the first gesture so the title card isn't silent forever.
  const wake = () => { try { ac(); } catch (e) { /* no audio device */ } };
  ['pointerdown', 'keydown'].forEach((e) => addEventListener(e, wake, { once: true }));

  // A short tone with a quick attack/decay envelope.
  function tone(freq, ms, { type = 'square', gain = 0.05, slide = 0 } = {}) {
    const c = ac();
    const osc = c.createOscillator();
    const amp = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, c.currentTime);
    if (slide) osc.frequency.linearRampToValueAtTime(Math.max(20, freq + slide), c.currentTime + ms / 1000);
    amp.gain.setValueAtTime(gain, c.currentTime);
    amp.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + ms / 1000);
    osc.connect(amp).connect(c.destination);
    osc.start();
    osc.stop(c.currentTime + ms / 1000 + 0.02);
  }

  return {
    click() { tone(520, 35, { type: 'square', gain: 0.03 }); },
    pop(success) { tone(success ? 820 : 420, 80, { type: 'sine', gain: 0.05, slide: success ? 180 : -80 }); },
    thud() { tone(90, 130, { type: 'triangle', gain: 0.09, slide: -30 }); },
    blip() { tone(760 + Math.random() * 120, 30, { type: 'square', gain: 0.02 }); },
  };
})();
