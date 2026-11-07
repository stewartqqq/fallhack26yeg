// All tunable stuff lives here: stage order, timings, sizes, and every line of text.
// Edit freely — main.js only reads from this object.
window.SIDEKICK = {
  // Fixed stage order. Ctrl+Alt+N walks this list, Ctrl+Alt+R jumps to the first entry.
  stages: [
    'character', // onboarding Q1: pick a personality
    'analyzing', // fake "personality engine" progress bar
    'sprite',    // onboarding Q2: pick a sprite or draw your own
    'circle',    // draw the body
    'oneLeg',
    'twoLegs',
    'mouth',
    'eyes',
    'coding',
    'roasted',
    'tokens',
    'pointing',
    'solved',
  ],

  // Which body part the next drawing becomes, per stage (fake recognition).
  drawPart: {
    circle: 'body',
    oneLeg: 'legLeft',
    twoLegs: 'legRight',
    mouth: 'mouth',
    eyes: 'eyes',
  },
  partLabel: {
    body: 'Circle',
    legLeft: 'Leg',
    legRight: 'Leg',
    mouth: 'Mouth',
    eyes: 'Eyes',
  },

  timing: {
    analyzingMs: 5200,        // total time the fake progress bar takes
    personalityLockedMs: 2600, // how long "Personality locked in" stays up
    // Fake progress bar: [fraction of time, fraction filled]. Stalls and bursts so it looks real.
    analyzingCurve: [[0.1, 0.16], [0.28, 0.22], [0.4, 0.27], [0.48, 0.61], [0.66, 0.68], [0.8, 0.71], [0.9, 0.96], [1, 1]],
    recognizingMs: 700,
    toastMs: 1400,
  },

  pet: {
    bodyRadius: 34,  // px on stage; drawn circle is scaled to this
    groundOffset: 28, // ground line distance from bottom of stage
    strokeWidth: 3,
  },

  // Phase 4: once the circle is drawn (and until the first leg is), the body
  // tries to roll around. Real rolling physics: the lowest point of the drawn
  // shape always touches the ground, so lumpy circles bob and get stuck.
  // It pushes in clumsy bursts, rests (and slips back), and bonks off walls.
  roll: {
    pushAccel: 10,           // rad/s² of effort while pushing
    pushJitter: 0.6,         // ± fraction of random variation per push
    pushSec: [0.3, 1.1],     // random push duration range
    restSec: [0.25, 0.9],    // random rest duration range
    slipBack: 0.25,          // while resting, rolls back with this fraction of push effort
    gravity: 35,             // how hard lumps tip it over (torque per px of offset)
    stuckPx: 15,             // a push that moves less than this counts as failed...
    frustrationBoost: 0.5,   // ...and makes the next push this much harder (stacks)
    maxFrustration: 4,
    friction: 2.2,           // rolling resistance
    wallBounce: 0.4,         // fraction of spin kept after bonking a wall
    stunnedSec: 0.7,         // dazed after a wall bonk
  },

  // Chat heist (Ctrl+Alt+I): pet leaves the panel, hops to the AI chat, kicks it shut.
  // Positions are in screen units relative to the VS Code window (DPI-scaled, so ~CSS px).
  heist: {
    line: 'Do it yourself.',
    petScale: 1.4,          // overlay pet size vs. panel pet
    startXFrac: 0.4,        // where the pet leaves the panel: fraction of window width
    startYFromBottom: 60,   // ...and px above the window's bottom edge
    chatXFromRight: 260,    // where it lands, just left of the chat: px from window's right edge
    chatYFrac: 0.4,         // ...and fraction of window height
  },

  text: {
    character: {
      title: 'Pick your sidekick’s personality',
      options: [
        { id: 'roast', name: 'Roast but helpful', desc: 'Mean about it. Right about it.', face: 'smirk' },
        { id: 'evil', name: 'Evil', desc: 'Wants to watch your build burn.', face: 'evil' },
        { id: 'kind', name: 'Kind & supporting', desc: 'Believes in you. Unconditionally.', face: 'kind' },
      ],
    },
    analyzing: {
      title: 'Analyzing personality…',
      steps: ['reading your commit history', 'judging your variable names', 'calibrating sarcasm'],
      locked: 'Personality locked in: Evil Joker.',
    },
    sprite: {
      title: 'Choose a body',
      presets: [
        { id: 'stick', name: 'Stickman' },
        { id: 'blob', name: 'Blob' },
        { id: 'ghost', name: 'Ghost' },
      ],
      drawOwn: 'Draw your own',
    },
    draw: {
      empty: 'draw something first, genius',
      recognizing: 'Recognizing…',
      detected: (label) => `${label} detected!`,
    },
  },
};
