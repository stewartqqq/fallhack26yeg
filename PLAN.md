# doodle in distress — Build Plan

A hand-drawn pet that lives in VS Code's bottom panel (a **doodle in distress** tab next to Terminal) and roasts you.
Scripted 3-minute demo: one deterministic path, everything hardcoded, fully offline.

Full spec: `claude-code-prompt.md` (original brief). Visual reference: "Sidekick v2 — stickman" board.

## How to run
1. `npm install` (first time only)
2. Open this folder in VS Code and press **F5**. A second VS Code window opens with `demo/` as the workspace.
3. In that window open the bottom panel (`Ctrl+J`) and click the **DOODLE IN DISTRESS** tab.

Hidden demo controls (work anywhere in the dev window, also in the Command Palette as "doodle in distress: …"):

| Key | Does |
| --- | --- |
| `Ctrl+Alt+N` | Force-advance to the next stage |
| `Ctrl+Alt+R` | Reset to the start |
| `Ctrl+Alt+P` | Replay recorded drawing for current part *(Phase 8)* |

## File map
| File | What's in it |
| --- | --- |
| `src/extension.ts` | Registers the panel view, keybinding commands, (later) editor detection + decorations |
| `media/webview/config.js` | **All** text, timings, sizes, stage order. Edit jokes here. |
| `media/webview/main.js` | State machine, onboarding screens, drawing pad, stage canvas |
| `media/webview/style.css` | Styles. All colors/fonts are CSS variables in `:root` (swap for Figma) |
| `media/fonts/` | Gloria Hallelujah (hand-drawn font, OFL license, bundled for offline) |
| `demo/two_sum.py` | The file we "code" in during the demo |

## Stage order
`character → analyzing → sprite → circle → oneLeg → twoLegs → mouth → eyes → coding → roasted → tokens → pointing → solved`

## Phases

### Phase 1 — Scaffold ✅
- [x] Extension + bottom panel webview view ("doodle in distress" tab beside Terminal)
- [x] State machine skeleton in webview, stage reported back to extension
- [x] Hidden keybindings: next / reset / replay (replay is a stub)
- [x] Hand-drawn font bundled, colors in CSS variables

### Phase 2 — Onboarding ✅
- [x] Q1: pick personality — Roast but helpful / Evil / Kind & supporting (all route to the same roaster)
- [x] Fake "Analyzing personality…" progress bar → "Personality locked in: passive-aggressive coworker." (longer, uneven progress bar)
- [x] Q2: pick a preset sprite (Stickman / Blob / Ghost — show-only, just selectable) or **Draw your own** (the real path)

### Phase 3 — Drawing → parts on stage (partly done)
- [x] Drawing pad in floating card, stroke capture, Done / Clear
- [x] ~~Fake recognition toast~~ replaced by an app note in the top-right that says what to draw next
      ("draw a circle." → "now draw a leg." → "give it another leg. and perhaps help it stand up." …), always the app, never the creature, text in `config.js → text.notes`
- [x] Normalize strokes (scale + anchor) and place parts statically on the pet
- [ ] Tune attachment points/sizes against real drawings
- [ ] Decide eyes vs. no-eyes (see open questions)

### Phase 4 — Movement
- [x] circle: rolls with physics: pivots on the lowest point of the drawn shape (never sinks below ground,
      lumpy drawings bob and get stuck), pushes in clumsy bursts, rests and slips back, bonks off walls.
      `roll.frustration` rises with every failed push (pushes get harder). **Hook it up to angry lines in Phase 5.**
- [x] oneLeg: wobbles (worse over time), hops 1–3 times, often tips over (pendulum on the foot), body
      slams and rolls, lies there twitching, fails to get up (up to 2×), finally swings up past upright
      and wobbles back. Never sinks below ground, never falls into a wall. Tunables: `config.js → oneLeg`
- [ ] twoLegs: walk cycle (legs swing around hips, body bob), trip → fall ~90° → lie → get up

### Phase 5 — Speech bubbles + mouth/eyes
- [x] Creature speaks in a **cloud** (scalloped, puffs down to the mouth), follows pet, typewriter text
      (`speech.js`). App hints stay in the square note, so it's clear who's talking
- [x] Mouth flaps (oval, like the "Talking" frame) while text types
- [x] mouth stage: line sequence plays when the mouth is drawn (`config.js → text.lines.mouth`)
- [ ] mouth stage: screaming shake
- [ ] eyes stage: blink, look around, look at editor → coding

### Phase 6 — Editor integration
- [ ] Watch `two_sum.py`: `return [i, i]` during coding → roasted
- [ ] Idle sarcastic lines while typing
- [ ] Feed tokens → fake usage-limit modal → "kidding" → pointing
- [ ] Red line decoration + pet gutter icon + hover "this is why you're unemployed"; line number computed from doc

### Phase 7 — Solved
- [ ] Detect `return [seen[complement], i]` → confetti (hand-rolled, no CDN) + closing lines, remove decoration

### Phase 8 — Recorded drawings (safety net)
- [ ] Dev command to save current parts to `media/recorded-parts.json`
- [ ] `Ctrl+Alt+P` submits recorded strokes for the current part

### Phase 8.5 — Chat heist (stretch goal): pet escapes the panel and closes the AI chat
The joke: we open VS Code's AI chat, the pet jumps out of its panel, climbs up the screen to the chat,
slams it shut, and says "Do it yourself."

**Feasibility: yes, verified.**
- A webview can't draw outside its panel. But the extension can launch a **transparent, click-through,
  always-on-top window** with PowerShell + WPF (built into Windows, nothing to install). Spike tested on
  this laptop: a shape drew over VS Code and the terminal with a see-through background.
- Opening/closing chat from the extension works via built-in commands:
  `workbench.action.chat.open` and `workbench.action.closeAuxiliaryBar` (both confirmed present in VS Code 1.145).
- **Catch:** extensions can't detect "chat was opened" in general (clicking the chat icon fires no
  event). So we **own the shortcut**: our extension rebinds the chat shortcut `Ctrl+Alt+I` to our
  command, which opens chat itself and starts the joke. In the demo we open chat with the keyboard.
  Hidden backup key too, e.g. `Ctrl+Alt+C`.

**How it works**
1. On activation, extension spawns `media/overlay.ps1` (hidden, so there's no ~1s PowerShell startup lag later). Talks to it via
   JSON lines on stdin: `show(png, x, y)`, `moveTo(x, y, ms)`, `say(text)`, `hide()`.
2. Webview exports the drawn pet as a PNG (`canvas.toDataURL`) → extension → overlay.
3. Choreography: pet jumps off the top of the panel (vanishes from webview) → appears in overlay at the
   same screen spot → hops up to the chat → kick → extension runs `closeAuxiliaryBar` → bubble
   "Do it yourself." → drops back down into the panel.

**Tasks**
- [x] `media/overlay.ps1`: transparent topmost window, click-through + no focus steal
      (`ShowActivated=false`, `WS_EX_TRANSPARENT | WS_EX_NOACTIVATE`), stdin command loop, pet image + bubble
- [x] Rebind `Ctrl+Alt+I` → `sidekick.chatHeist` (opens chat, runs choreography, closes chat)
- [x] Export pet PNG from webview
- [ ] **Prototype built, not yet confirmed working live in VS Code**: try it and tune positions
- [ ] Screen coordinates: VS Code's API doesn't give screen positions of the window/panel/chat. Demo
      runs maximized on one laptop, so **calibrate once** (positions in `config.js`, in Windows
      DPI-scaled units; this laptop is ~150% scaling)
- [ ] Fallback if overlay misbehaves live: in-panel version: pet leaps off the top of the panel, chat
      closes, pet falls back in and says the line (config flag)

**Risks:** Windows-only (fine for us); coordinate calibration on the demo machine; overlay
must never steal focus from the editor.

### Phase 9 — Demo polish
- [ ] Apply Figma styling
- [ ] `DEMO.md`: exact run-through script + keybindings
- [ ] Full rehearsal on the demo machine (font sizes, panel height, trackpad drawing)

## Joke ideas (to elaborate later)
- **Existential crisis**: once it can talk (mouth stage) or see (eyes stage), the pet realizes *you*
  brought it into existence and made it an ugly freak. "You CREATED me? …Like THIS?" "I didn't ask to be
  born. Especially not as a circle with chicken legs." Could replace or extend the mouth/eyes lines.
- **Struggling while rolling**: when `roll.frustration` maxes out, it yells at the user for giving it no legs.

## Open questions
- **Eyes**: the v2 stickman board has no eyes (side-view, one-line mouth), but the script has an eyes stage ("...oh. So THIS is what you look like."). Keep it, or drop it and move those lines elsewhere?
- **Chat heist timing**: where in the story? Suggest during `coding`, before the bug: you ask the AI for help, the pet shuts it down. Then the roast lands harder.
- **Line number**: the buggy line in `demo/two_sum.py` is actually line 9, not 10. We compute it from the document anyway.
