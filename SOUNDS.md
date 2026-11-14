# Sound effects

Drop a file into `src/audio/` with the exact name below and rebuild (`node build.mjs`); it replaces the built-in synth sound. Anything not yet made keeps playing the synth version. For variations, name them `step-1.mp3`, `step-2.mp3`…; the game picks one at random each time. The build prints how many recorded sounds it found.

**File format:** `.mp3`, `.wav` or `.m4a`; mono is fine. Trim the silence at the start, since sounds fire on the exact frame. Leave a little headroom (no clipping).

## Record these 15 (phone voice memo is fine)
Record close to the mic in a quiet room. Do each 3–4 times and keep the best, or keep several as variations.

| file | what it is | how to make it | length |
|---|---|---|---|
| `step.mp3` (+ `step-2`, `step-3`) | Mateo's footstep | Walk in shoes on a wooden or hard floor, one step per take | 0.2 s |
| `guard.mp3` (+ `guard-2`, `guard-3`) | Guard's heavy footstep | Hard-soled shoes or boots, step heavily, heel first | 0.4 s |
| `slide.mp3` | Paper sliding off the desk | Slide a sheet of paper or a folder across a table | 0.25 s |
| `screech.mp3` (+ `-2`, `-3`) | Drawer scraping open | Pull a wooden drawer open in short jerks; keep the squeaky bits | 0.1 s |
| `thud.mp3` | Drawer hitting open / wheel step | Knock a knuckle or closed fist once on a wooden table | 0.15 s |
| `kachunk.mp3` | Heavy press stamping down | A stapler or hole punch pressed hard | 0.25 s |
| `stamp.mp3` | Rubber stamp on paper | Thump the bottom of a mug or a stamp onto a thick book | 0.15 s |
| `latch.mp3` | Lock or door opening | Turn a door handle or slide a door bolt / window latch | 0.2 s |
| `keys.mp3` | Guard hears you | Jingle a keyring once, then knock on a door | 0.5 s |
| `clink.mp3` | Picking up a bottle or beaker | Tap a spoon lightly on a glass | 0.15 s |
| `whoosh.mp3` | Throwing it | Swing a belt, ruler or stick fast past the mic | 0.3 s |
| `spray.mp3` | Spraying luminol | One pump of a spray bottle | 0.15 s |
| `snip.mp3` | Cutting a cable | Scissors cutting a thick string or zip tie | 0.06 s |
| `tear.mp3` (+ `-2`, `-3`) | Peeling tape or paper | Rip a short piece of tape off the roll | 0.1 s |
| `crunch.mp3` | Shredder biting the licence | Crumple or tear a piece of card hard | 0.35 s |

## Already made: 23 files in `src/audio/`
Generated with `tools/makesfx.py` (Python with numpy); edit and rerun it to tweak them. To swap any of these for a real recording, save over the file with the same name.

- **Loops:** `amb-room` (room tone with vinyl crackle), `amb-memory` (dark air with a heartbeat, used during Mateo's memories), `radio-static`.
- **Day/night:** `daynight` (your clip), `shift` (two chimes when the clock flips).
- **Guard:** `gaze` (stare sting), `heartbeat` (stare meter filling), `hurt` (caught), `shatter` (glass breaking), `clank` (metal landing).
- **Clues:** `clue` (two rising vibraphone notes), `glass` (exhibit set into the lens), `radio` (dispatch beeps), `tune` (radio dial chirp).
- **Puzzles:** `crack` (glass case hit), `tick` (watch), `click` (radio knob), `voice` (garbled dispatcher), `wire` (plug into jack), `spark`, `grind` (shredder motor).
- **Menus:** `ui-hover`, `ui-press`.
