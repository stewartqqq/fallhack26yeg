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
    analyzingMs: 1600,
    personalityLockedMs: 1100,
    recognizingMs: 700,
    toastMs: 1400,
  },

  pet: {
    bodyRadius: 34,  // px on stage; drawn circle is scaled to this
    groundOffset: 28, // ground line distance from bottom of stage
    strokeWidth: 3,
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
