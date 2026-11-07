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
    oneLeg: 'leg1',
    twoLegs: 'leg2',
    mouth: 'mouth',
    eyes: 'eyes',
  },

  timing: {
    analyzingMs: 5200,        // total time the fake progress bar takes
    personalityLockedMs: 2600, // how long "Personality locked in" stays up
    // Fake progress bar: [fraction of time, fraction filled]. Stalls and bursts so it looks real.
    analyzingCurve: [[0.1, 0.16], [0.28, 0.22], [0.4, 0.27], [0.48, 0.61], [0.66, 0.68], [0.8, 0.71], [0.9, 0.96], [1, 1]],
    flashNoteMs: 1600,        // how long a temporary note (e.g. "draw something first") stays
  },

  pet: {
    bodyRadius: 34,  // px on stage; drawn circle is scaled to this
    groundOffset: 28, // ground line distance from bottom of stage
    strokeWidth: 3,
    legSpread: 0.3,   // with two legs: each hip sits this × bodyRadius left/right of center
  },

  // One leg: wobbles, hops, falls over, struggles back up. Angles in radians.
  oneLeg: {
    balanceSec: [0.7, 1.5], // wobbling in place before trying to hop
    wobble: [0.03, 0.16],   // wobble amplitude: starts small, gets worse
    wobbleHz: 2.2,
    maxHops: 3,             // hops in a row: 1..maxHops
    crouchSec: 0.16,
    airSec: [0.32, 0.45],
    hopDist: [18, 45],      // px per hop
    hopHeight: [16, 38],    // px
    landSec: 0.14,
    squash: 0.2,
    fallChance: 0.55,       // after a hop sequence: falls over this often
    tipKick: 0.6,           // initial tip speed
    tipGravity: 14,         // how fast the tip accelerates
    flopSec: 0.45,
    flopOver: 0.35,         // rolls this far past the impact
    lieSec: [0.7, 1.3],
    getUpFailChance: 0.55,  // tries to get up, gets halfway, flops back down
    maxFailedGetUps: 2,
    failSec: 0.6,
    getUpSec: 0.6,
    overshoot: 0.22,        // swings past upright by this much…
    settleSec: 0.7,         // …then wobbles back
  },

  // The creature's speech cloud (speech.js).
  speech: {
    font: "'Gloria Hallelujah', cursive",
    fontSize: 19,
    maxWidth: 230,  // px before wrapping
    padX: 14,
    padY: 8,
    bump: 11,       // cloud bump radius
    charMs: 45,     // typewriter speed
    holdMs: 1100,   // pause after a line is typed…
    holdPerCharMs: 25, // …plus this per character
    mouthHz: 7,     // mouth flapping while typing
  },

  // Background doodles (scenery.js): decoration only, nothing interacts with the pet.
  scenery: {
    treeAlpha: 0.13,
    treeHeight: [60, 120],  // px
    treeGap: [260, 480],    // px between trees
    cloudAlpha: 0.13,
    clouds: 2,
    cloudSpeed: 5,          // px/s drift
    birdAlpha: 0.35,
    birds: 2,
    birdSpeed: [22, 40],    // px/s
    grassAlpha: 0.35,
    grassGap: [90, 200],    // px between tufts
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
      locked: 'Personality locked in: passive-aggressive coworker.',
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
    },
    // App notes in the top-right corner: what to draw next, per stage. (The app talking.)
    notes: {
      circle: 'draw a circle.',
      oneLeg: 'give me legs.',
      twoLegs: 'draw another leg, dumbass.',
      mouth: 'give it a mouth.',
      eyes: 'it wants eyes.',
    },
    // The creature talking (cloud bubbles). Plays when the part is drawn.
    lines: {
      mouth: [
        'AAAAAAAAAAAAA',
        'You CREATED me with no EYES?',
        'I can’t see. I can barely stand.',
        'You MONSTER.',
        'GIVE. ME. EYES.',
      ],
    },
  },
};
