# doodle in distress

A VS Code extension where you draw your own pet, one body part at a time. It lives in a tab next to the terminal, struggles with whatever body you gave it, and roasts your code once it can see.

Built for a hackathon. It runs one scripted demo path and works fully offline.

## How it goes
1. **Personality test.** Pick a personality: roast but helpful, evil, or kind & supporting. It doesn't matter which; you always get a passive-aggressive coworker.
2. **Draw it yourself.** Draw a circle, then a leg, then another leg, then a mouth. The pet uses your actual strokes.
3. **Watch it suffer.** A circle can only roll. One leg isn't much better. Once it has a mouth, it starts complaining.
4. **Get roasted.** It watches you code, laughs at your bug, and tries to sell you tokens before it shows you the bug.

## Run it
```
npm install
```
Open this folder in VS Code and press **F5**. In the window that opens, open the bottom panel (`Ctrl+J`) and click the **doodle in distress** tab.

After changing code, press `Ctrl+R` in that window to reload.

## Demo controls (hidden)
| Key | Does |
| --- | --- |
| `Ctrl+Alt+N` | Skip to the next stage |
| `Ctrl+Alt+R` | Start over |
| `Ctrl+Alt+P` | Replay a recorded drawing *(not built yet)* |
| `Ctrl+Alt+I` / `Ctrl+Alt+C` | Open the AI chat; the pet leaves its panel and closes it (Windows only) |

## Where things are
- `media/webview/config.js`: all text, jokes, timings and sizes
- `media/webview/main.js`: stages, drawing pad, pet
- `media/webview/scenery.js`: background doodles
- `media/webview/style.css`: look and feel (colors and fonts are CSS variables)
- `media/overlay.ps1`: the floating window used for the chat joke
- `src/extension.ts`: VS Code side (panel, shortcuts, editor hooks)
- `demo/two_sum.py`: the file we code in during the demo

Progress and next steps: [PLAN.md](PLAN.md).

Font: [Gloria Hallelujah](https://fonts.google.com/specimen/Gloria+Hallelujah) (SIL Open Font License, bundled).
