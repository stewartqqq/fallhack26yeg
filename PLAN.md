# doodle in distress — Build Plan

A hand-drawn pet that lives in VS Code's bottom panel (a **doodle in distress** tab next to Terminal) and roasts you.
Scripted 3-minute demo: one deterministic path, everything hardcoded, fully offline.

Full spec: `claude-code-prompt.md` (original brief). Visual reference: "Sidekick v2 — stickman" board.

## Status at a glance
| Phase | | |
| --- | --- | --- |
| 1 Scaffold | ✅ done | |
| 2 Onboarding | ✅ done | |
| 3 Drawing → parts | ✅ mostly | tune against real drawings, decide on eyes |
| 4 Movement (circle, one leg, two legs) | ✅ done | |
| 4.5 Look, sound, interaction | ✅ done | scenery, sounds, poke/drag |
| 5 Speech + mouth/eyes | 🟡 half | cloud + mouth lines done; screaming shake + eyes stage left |
| 6 Editor integration | ⬜ todo | |
| 7 Solved + confetti | ⬜ todo | |
| 8 Recorded drawings | ⬜ todo | |
| 8.5 Chat heist | ✅ works live | fallback version left |
| 9 Demo polish | ⬜ todo | |

## How to run
1. `npm install` (first time only)
2. Open this folder in VS Code and press **F5**. A second VS Code window opens with `demo/` as the workspace.
3. In that window open the bottom panel (`Ctrl+J`) and click the **DOODLE IN DISTRESS** tab.

After changing webview files: `Ctrl+R` in the dev window. After adding a new file or changing `extension.ts` / `overlay.ps1`: close the dev window and F5 again.

Hidden demo controls (work anywhere in the dev window, also in the Command Palette as "doodle in distress: …"):

| Key | Does |
| --- | --- |
| `Ctrl+Alt+N` | Force-advance to the next stage |
| `Ctrl+Alt+R` | Reset to the start |
| `Ctrl+Alt+P` | Replay recorded drawing for current part *(Phase 8, not built)* |
| `Ctrl+Alt+I` / `Ctrl+Alt+C` | Open AI chat → chat heist |

## File map
| File | What's in it |
| --- | --- |
| `src/extension.ts` | Panel view, keybinding commands, overlay process, (later) editor detection + decorations |
| `media/webview/config.js` | **All** text, timings, sizes, stage order, animation tunables. Edit jokes here. |
| `media/webview/main.js` | State machine, onboarding, drawing pad, notes, rolling, one leg, poke/drag, stage loop |
| `media/webview/walk.js` | Two-legged walking |
| `media/webview/speech.js` | The creature's speech cloud |
| `media/webview/scenery.js` | Background doodles (trees, clouds, birds, grass) |
| `media/webview/sound.js` | Procedural sound effects (Web Audio, no files) |
| `media/webview/style.css` | Styles. All colors/fonts are CSS variables in `:root` (swap for Figma) |
| `media/overlay.ps1` | Chat heist: transparent always-on-top window (PowerShell + WPF) |
| `media/fonts/` | Gloria Hallelujah (hand-drawn font, OFL license, bundled for offline) |
| `demo/two_sum.py` | The file we "code" in during the demo |

## Stage order
`character → analyzing → sprite → circle → oneLeg → twoLegs → mouth → eyes → coding → roasted → tokens → pointing → solved`

## Phases

### Phase 1 — Scaffold ✅
- [x] Extension + bottom panel webview view ("doodle in distress" tab beside Terminal)
- [x] State machine skeleton in webview, stage reported back to extension
- [x] Hidden keybindings: next / reset / replay (replay is a stub)
- [x] Hand-drawn font bundled, wobbly per-letter lettering, colors in CSS variables

### Phase 2 — Onboarding ✅
- [x] Q1: pick personality: Roast but helpful / Evil / Kind & supporting (all route to the same roaster)
- [x] Fake "Analyzing personality…" progress bar (long, stalls and bursts) → "Personality locked in: passive-aggressive coworker."
- [x] Q2: pick a preset sprite (Stickman / Blob / Ghost, show-only, just selectable) or **Draw your own** (the real path)
- [x] Cards and titles pop in

### Phase 3 — Drawing → parts on stage ✅ (mostly)
- [x] Drawing pad in a big card (full panel height), stroke capture, Done / Clear
- [x] App note in the top-right says what to draw next. Always the app talking, never the creature:
      "draw a circle." → "now draw a leg." → "give it another leg. and perhaps help it stand up." →
      "give it a mouth." → "now draw the eyes." (`config.js → text.notes`)
- [x] Normalize strokes (scale + anchor) and place parts on the pet; first leg centered, second leg spreads them
- [x] Pet keeps its position (and the circle's rotation) as parts are added
- [ ] Tune attachment points/sizes against real trackpad drawings
- [ ] Decide eyes vs. no-eyes (see open questions)

### Phase 4 — Movement ✅
- [x] **circle**: rolls with physics, pivoting on the lowest point of the drawn shape (never sinks below ground;
      lumpy drawings bob and get stuck). Pushes in clumsy bursts, rests and slips back, bonks off walls.
      `roll.frustration` rises with every failed push. **Hook it up to angry lines (Phase 5).**
- [x] **one leg**: starts fallen (leg sticking out), keeps trying to get up and failing. **Picking it up
      helps it stand.** Then it wobbles, hops 1–3 times, tips over, slams down, and needs help again.
      Pose sits on the true lowest point of the drawing. Tunables: `config.js → oneLeg`
- [x] **two legs** (`walk.js`): drawing the 2nd leg makes it get up by itself. Real walk cycle (planted foot
      never slides, swing foot lifts), lean + bob, uneven steps, stumbles, pauses, paper-flip turns.
      Blind: walks into walls, falls on its back with legs flailing, gets up (sometimes 2nd try), turns
      around. Rarely trips over nothing. Tunables: `config.js → twoLegs`

### Phase 4.5 — Look, sound, interaction ✅
- [x] Minimal doodle scenery: a few faint trees, two clouds, two birds, grass tufts (`scenery.js`)
- [x] Pet body is filled, so scenery doesn't show through it
- [x] Sounds (`sound.js`): button clicks, pop on submitting a part, low pop on empty Done, thud on wall bonks
- [x] Poke/drag the pet: click = flinch, drag = pick it up (stays within the stage). Works in every stage.
      Once it has a mouth it complains in its cloud (`config.js → text.lines.poke`)

### Phase 5 — Speech bubbles + mouth/eyes 🟡
- [x] Creature speaks in a **cloud** (big round bumps, roomy padding, beside the pet, puffs point at the
      mouth), typewriter text (`speech.js`). App hints stay in the square note, so it's clear who's talking
- [x] Mouth flaps (oval, like the "Talking" frame) while text types
- [x] mouth stage: line sequence plays when the mouth is drawn (`config.js → text.lines.mouth`)
- [ ] mouth stage: screaming shake (and decide: keep walking while talking, or stand still as now)
- [ ] eyes stage: blink, look around, look at editor → coding
- [ ] Existential-crisis lines + rolling-frustration rant (see joke ideas)

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

### Phase 8.5 — Chat heist ✅ (works live)
`Ctrl+Alt+I` opens the AI chat; the pet jumps out of its panel, hops up the screen to the chat, says
"Do it yourself.", kicks it shut, and falls straight back down into the panel, where it stays.

How it works:
- The extension spawns `media/overlay.ps1` at startup: a transparent, click-through, always-on-top WPF
  window that never takes focus. Messages are tab-separated lines over stdin/stdout.
- The webview exports the pet as a PNG, plus where it is on screen. It learns its own screen position
  from pointer events (any drawing stroke or click), so no manual calibration is needed.
- The pet starts at panel size where it really is, grows a bit, hops to the chat, wind-up → kick →
  impact hold → recoil (extension closes the chat on "kick"), then falls into the panel below the kick,
  shrinking back to panel size. The panel pet continues from exactly that spot.
- We own the shortcut, because extensions can't detect "chat opened" in general (clicking the chat icon
  fires no event). Commands: `workbench.action.chat.open`, `workbench.action.closeAuxiliaryBar`.

- [x] Overlay window, kick choreography, chat open/close, pet PNG export
- [x] Starts from and lands back at the pet's real spot (no teleport)
- [ ] Fallback if the overlay misbehaves live: in-panel version (pet leaps off the top of the panel, chat
      closes, pet falls back in and says the line), behind a config flag

Notes: Windows only. Assumes VS Code zoom is at default (`Ctrl+0`). Without any click in the panel yet,
it falls back to guessed positions (`config.js → heist`).

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
