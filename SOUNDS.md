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
- **Menus:** `ui-hover` (your soft click), `ui-press`.
- **Guard and atmosphere (added 2026-11-15, from your files):** `guard` is your single footstep, trimmed, played pitched down by a random amount each step; `gaze` is your guard-spot sound, played the moment a guard sees you; `tension` is the 30-second creepy track, looped loudly with a strong heartbeat from that moment until 7 seconds after he last saw you; `amb-room` is the horror basement ambience (mono, 56 kbps, about 1 MB), which now plays all the time, with `amb-memory` layered on top during Mateo's memories.
- **Detective's room music (added 2026-11-15, from your files):** `jazz` (late night club) and `jazz-1` (jazz noir), mono 56 kbps, about 1.1 MB and 1.3 MB. They play one after the other, quietly, whenever you are the detective; they drop out in Mateo's memories and while the chase music plays, and the basement ambience sits back under them.
- **Heartbeat:** no longer a fixed beat. It follows the danger: slow and soft when a guard is merely close, faster and louder as he notices you, fastest and loudest while he is watching or chasing (`pulse` in `game.js`).
- **Your recordings (added 2026-11-15):** `select` and `select-1` play at random when picking up a minor item (clutter in the desk puzzle, a throwable, a kit purchase); `select-major` (the long one) plays when taking an important item (the pocket watch, the found document in the desk puzzle, the glass-case key, the closet key); `points` plays whenever the score goes up; `clink` to `clink-3` are the four clinks cut from `glass clinking`, used when a glass ashtray lands and in the puzzles' glass items.
