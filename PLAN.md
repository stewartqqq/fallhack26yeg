# Digital Sidekick — Build Plan

A hand-drawn evil pet that lives in VS Code's bottom panel (a **Sidekick** tab next to Terminal).
Scripted 3-minute demo: one deterministic path, everything hardcoded, fully offline.

Full spec: `claude-code-prompt.md` (original brief). Visual reference: "Sidekick v2 — stickman" board.

## How to run
1. `npm install` (first time only)
2. Open this folder in VS Code and press **F5**. A second VS Code window opens with `demo/` as the workspace.
3. In that window open the bottom panel (`Ctrl+J`) and click the **SIDEKICK** tab.

Hidden demo controls (work anywhere in the dev window, also in the Command Palette as "Sidekick: …"):

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
- [x] Extension + bottom panel webview view ("Sidekick" tab beside Terminal)
- [x] State machine skeleton in webview, stage reported back to extension
- [x] Hidden keybindings: next / reset / replay (replay is a stub)
- [x] Hand-drawn font bundled, colors in CSS variables

### Phase 2 — Onboarding ✅
- [x] Q1: pick personality — Roast but helpful / Evil / Kind & supporting (all route to the evil joker)
- [x] Fake "Analyzing personality…" progress bar → "Personality locked in: Evil Joker 😈"
- [x] Q2: pick a preset sprite (Stickman / Blob / Ghost — show-only, just selectable) or **Draw your own** (the real path)

### Phase 3 — Drawing → parts on stage (partly done)
- [x] Drawing pad in floating card, stroke capture, Done / Clear
- [x] Fake recognition toast: "Recognizing… ✓ Leg detected!"
- [x] Normalize strokes (scale + anchor) and place parts statically on the pet
- [ ] Tune attachment points/sizes against real drawings
- [ ] Decide eyes vs. no-eyes (see open questions)

### Phase 4 — Movement
- [ ] circle: rolls left/right across full stage, rotating, bouncing off edges
- [ ] oneLeg: pinned on the leg, scoots and tips back
- [ ] twoLegs: walk cycle (legs swing around hips, body bob), trip → fall ~90° → lie → get up

### Phase 5 — Speech bubbles + mouth/eyes
- [ ] Bubble (white rounded, hand font, tail to pet), follows pet, typewriter text
- [ ] Mouth animates while text types
- [ ] mouth stage: screaming shake + line sequence
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

### Phase 9 — Demo polish
- [ ] Apply Figma styling
- [ ] `DEMO.md`: exact run-through script + keybindings
- [ ] Full rehearsal on the demo machine (font sizes, panel height, trackpad drawing)

## Open questions
- **Eyes**: the v2 stickman board has no eyes (side-view, one-line mouth), but the script has an eyes stage ("...oh. So THIS is what you look like."). Keep it, or drop it and move those lines elsewhere?
- **Line number**: the buggy line in `demo/two_sum.py` is actually line 9, not 10. We compute it from the document anyway.
