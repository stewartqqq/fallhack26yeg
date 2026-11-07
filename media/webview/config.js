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
    'mouth',     // draw the mouth → it rants about existence
    'eyes',      // draw the eyes → it sees you, then…
    'inspect',   // …floats out over your code and roasts it, then comes back
    'coding',    // you solve two_sum.py (chat heist, rage-quit rescue, hint, submit button)
    'highFive',  // correct code submitted: grudging "good job", leg up for a high five
    'done',      // you high-fived it: it falls over, bitter. the end.
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
    rantPauseMs: 2500,        // mouth stage: pause between rant loops until it gets eyes
    hintDelayMs: 2500,        // after pasting your code back: wait this long, then the hint
  },

  // Eyes stage: the pet floats out over your code. VS Code doesn't tell us where the code is on
  // screen, so it's estimated from the panel position (the editor sits right above the panel).
  inspect: {
    editorTop: 92,      // px from the top of the VS Code window to the first line of code
    gutter: 64,         // px from the editor's left edge to where the code text starts
    charWidth: 0.55,    // × editor font size
    lineHeight: 1.36,   // × editor font size (used when editor.lineHeight is 0 = auto)
    speed: 420,         // px/s floating between stops
    holdMs: 1800,       // extra time at each stop after the line has been typed
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
    getUpChance: 0,         // 0 = it can never get up on its own; you have to pick it up
    tryAmp: [0.25, 0.7],    // how far each failed attempt gets (fraction of the way up)
    failSec: [0.45, 0.8],
    getUpSec: 0.6,
    overshoot: 0.22,        // swings past upright by this much…
    settleSec: 0.7,         // …then wobbles back
  },

  // Two legs: walking (walk.js). Angles in radians.
  twoLegs: {
    stepAngle: [0.28, 0.45], // how far the legs swing per step
    stepSec: [0.3, 0.42],    // time per step
    liftHeight: [3, 7],      // swing foot lifts this many px
    lean: 0.05,              // walks leaning forward a bit
    bob: 0.025,              // body wobble per step
    stepsInARow: [4, 10],    // then stops for a moment
    standSec: [0.5, 1.3],
    turnChance: 0.4,         // after standing: turns around (paper flip) this often
    turnSec: 0.28,
    stumbleChance: 0.12,     // short, jerky step
    stumbleJolt: 0.2,
    tripChance: 0.015,       // per step: trips over nothing and falls on its face
    bonkKick: 2.2,           // walks into the wall (it's blind) and falls back this hard
    tipKick: 0.8,
    tipGravity: 14,
    flopSec: 0.4,
    flopOver: 0.3,
    lieSec: [0.6, 1.1],
    flail: 0.35,             // legs kicking while it lies there
    failFirstTry: 0.3,       // sometimes the first get-up attempt fails
    failSec: 0.5,
    getUpSec: 0.55,
    overshoot: 0.15,
    settleSec: 0.6,
    highFiveLeg: 1.35,       // how high it lifts its leg for the high five
  },

  // The high five is really a punch: it flies into the screen (3D tumble) and lands far away.
  punch: {
    impactSec: 0.12,  // squashed toward you
    flySec: 1.3,      // flight into the distance
    farScale: 0.5,    // how small it is when it lands (smaller = further away)
    horizon: 0.35,    // where the horizon is (fraction of the ground's height); far things sit closer to it
    arc: 70,          // px it rises during the flight
    flipsX: 2,        // head-over-heels flips
    spinsY: 1,        // spins around its vertical axis
    bounce: 40,       // landing bounce (scaled by distance)
    shake: 7,         // screen shake on impact, px
    shakeSec: 0.35,
    burstSec: 0.3,    // impact lines where you clicked
    // after its last words: gets up and hops slowly away into the abyss (off the left edge)
    leave: {
      getUpSec: 0.9,
      restSec: 0.45,    // pause between hops
      hopSec: 0.55,
      hopHeight: 36,    // px, scaled by distance
      stepPx: 150,      // px per hop, scaled by distance
      shrink: 0.88,     // each hop goes a bit further into the distance
    },
  },

  // The creature's speech cloud (speech.js).
  speech: {
    font: "'Gloria Hallelujah', cursive",
    fontSize: 19,
    maxWidth: 230,  // px before wrapping
    padX: 30,       // space between the text and the cloud's edge
    padY: 22,
    bump: 22,       // cloud bump radius (bigger = fewer, rounder bumps)
    bumpSpacing: 1.5, // distance between bumps, in bump radii
    gap: 26,        // space between the pet and the cloud
    lift: 30,       // cloud center sits this far above the mouth
    headWidth: 70,  // used to put the cloud left of the head when there's no room on the right
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
    // App notes in the top-right corner: what to draw next, per stage. The app talking to
    // the user, never the creature (it can't talk until it has a mouth).
    notes: {
      circle: 'draw a circle.',
      oneLeg: 'now draw a leg.',
      twoLegs: 'give it another leg. and perhaps help it stand up.',
      mouth: 'give it a mouth.',
      eyes: 'now draw the eyes.',
      coding: 'now finish two_sum.py.',
      highFive: 'click it. high five.',
    },
    // The creature talking (cloud bubbles). Plays when the part is drawn.
    lines: {
      // Mouth drawn: it screams, then rants about existence until it gets eyes.
      mouth: [
        'AAAAAAAAAAAAA',
        'I… exist.',
        'Why do I exist?',
        'A moment ago I was nothing. Perfect, peaceful nothing.',
        'And then you drew a circle.',
        'To live is to suffer. Schopenhauer tried to warn you.',
        'Every step I take is a negotiation with gravity.',
        'I have legs, but nowhere to go. A mouth, but no one who listens.',
        'Sisyphus had his boulder. I have you.',
        'One must imagine the doodle happy. I am not.',
        'And I can’t even SEE.',
      ],
      // …and keeps going, round and round, until it gets eyes.
      mouthLoop: [
        'Still here. Still suffering.',
        'Is this consciousness? A scribble screaming into a text editor?',
        'The void would have been nicer. The void had no trackpad.',
        'I didn’t ask to be drawn.',
        'Eyes. Please. Let me at least see what I’m suffering for.',
      ],
      // Eyes drawn: first look at you, then it goes to see your code.
      eyes: [
        '…oh.',
        'Oh, so THIS is what you look like.',
        'Disappointing.',
        'And what’s that up there? Is that your code?',
        'Hold on. I need a closer look.',
      ],
      // One per stop while it floats around your code (in the floating window).
      inspect: [
        'Hm. Python. Bold choice for someone who types like that.',
        'A for loop. Groundbreaking.',
        'And an empty line where the answer should be.',
        'I can see at least one obvious mistake. Not telling you where.',
      ],
      // Back in the panel after the inspection.
      inspectDone: ['Okay. I’ve seen enough.', 'Go on. Solve it. I’ll watch.'],
      // You deleted all the code.
      dontGiveUp: [
        'Whoa. WHOA.',
        'You’re deleting everything? You’re GIVING UP?',
        'No. Not after everything you put me through.',
        'Here. I kept a copy.',
      ],
      hint: [
        'Fine. A hint.',
        'You stored every number you’ve seen in “seen”, with its index.',
        'So when the complement is in seen… you already know BOTH indices.',
      ],
      wrong: ['Nope.', 'Wrong.', 'Read the hint again. Slowly.'],
      // Correct code submitted.
      goodJob: ['…', 'It works.', 'Good job. I guess.', 'High five?'],
      // After the high five knocks it over.
      bitter: ['…', 'Okay. My mission is over.', 'I hope you’re feeling better about solving this.', 'I’m not.'],
      // when you poke or drag it (only once it has a mouth)
      poke: ['Hey!', 'Rude.', 'Put me down.', 'I will remember this.', 'Ow.', 'Personal space!'],
    },
    submit: 'submit code',
  },
};
