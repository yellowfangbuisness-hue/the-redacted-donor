# The Redacted Donor

Open **The Redacted Donor.app** on an Apple silicon Mac running macOS 13 or later. Choose **Begin investigation** to take Mateo’s seat across from the recruiter. Progress saves on the device. **Continue investigation** restores the case, evidence, purchases and position. After the rescue the same button opens the completed dossier.

The project also includes the entire offline game in `index.html`. Open it directly in a WebGL 2-capable desktop browser. The app and each browser maintain their own saves. The game loads its geometry, title illustration, shaders and synthesized audio locally.

## Playing

| Input | Action |
| --- | --- |
| W A S D | Walk |
| Mouse, click-drag or arrow keys | Look |
| E or click while facing a nearby object | Interact |
| Hold E | Pound the window or peel its film |
| C | Toggle crouch |
| Shift | Run |
| B or Tab | Open the lab coat kit |
| J | Read recovered clues and action cards |
| Esc or P | Pause |
| Drag or use arrows during inspection | Rotate the exhibit |
| F during inspection | Turn the exhibit over |

The touch controls provide a movement stick, drag-to-look, a crouch button and an interaction button. The native View menu supports full screen.

## Case sequence

- In **The Blind Street**, pound on the window, then take the pocket watch from the west bench. The watch adds the clinic clock to the HUD.
- Each file opens with the detective examining a document under the desk lamp. Turning it over starts Mateo’s memory. A briefing card lists the case question, the rules and all six leads, each marked ☀ day, ☾ night or ◐ any time.
- **The Golden Ticket:** read the ad, collect carbon paper, align the carbon copy (drag puzzle), read the ledger at night, emboss the receipt, hide it under the radiator. The detective then opens the drawer with 409, checks the recruitment archive and pins the lead.
- **The Cold Room:** examine the window prints and cooler stencil at night, take the seal impression, find the key glint, match the seal to a gate ticket (ticket puzzle), hide the key. The detective retrieves the key, opens the closet, checks the freight tag and pins the lead.
- **The Redacted Donor:** read the printer ribbon and waiver at night, copy the radio frequency, find the advocate’s card, tune the receiver to 640 kHz (dial puzzle), leave the card in the printer. The detective checks the call log, pins the lead, radios the team and strips the window tint.

## Cutscenes, searching and navigation

Major beats play a short cutscene. Scene changes (entering or leaving a memory, taking the watch, closing a case) use a negative-energy transition: the image inverts with burning white outlines, the frame ripples, and ink tendrils close in before receding on the new scene. The guard's stare bleeds the same ink in from the edges. The camera eases to a framed shot, letterbox bars slide in with a caption, and a screen effect matches the moment: a flash and evidence stamp, a sepia memory ripple, an iris close, radio static or dawn light. The beats are the intake door locking, taking the watch, entering a memory, solving each puzzle, hiding evidence, opening the drawer and closet, recovering the key, corroborating a lead, closing a case file, the radio call and the dawn ending. Press E, Space or Esc to skip.

A records annex opens through a doorway in the south partition. It holds patient-file shelving, a waiting bench, a coat rack, a typist’s desk, a safe, an examination gurney behind a screen, and a medicine cabinet. Twelve props across the clinic can be searched, including a wanted poster beside the street window (`src/art/wanted.jpg`), for +25 points each. Each one reveals a short document about the clinic. The journal counts them, and the map marks unsearched ones with a dot.

An arrow on the screen edge points toward the current lead whenever it is off screen, with the distance beneath. The recruiter and guard are sculpted 3D figures, and props use rounded, lit geometry.

## Three rooms and the gates between them

The clinic is three rooms joined by doors that open as the story advances.
- **Room 1, the intake lobby** (the original office) holds Case 1. After Case 1 is pinned, the lab door stays shut until the detective cuts the recruitment terminal's lure server (wire it to the moderators, then snip three cables) and sprays the door keypad with **luminol** (150 points) to read the latent code 4 0 9.
- **Room 2, the phlebotomy lab** holds Case 2: the transit chest with seal K7, the lab radiator hiding the closet key, the padlocked supply closet (code 0 4 0, the gate ticket's departure time), a centrifuge bench and a blood-draw chair. The **UV flashbulb** (200 points) is needed to read the painted-over stencil and the handprints. After Case 2, the detective shreds the surgeon's transplant-tourism licence and stamps an Istanbul Declaration ethics hold on Mateo's file, which opens the dispatch door.
- **Room 3, the dispatch office** holds Case 3: the teleprinter ribbon, the bleached waiver (UV), the duty roster and the advocate's card. The climax is breaking the emergency glass for the dispatch key, tuning the vacuum-tube ham radio's frequency and squelch dials until the oscilloscope trace is clean, and peeling the window tint at dawn by dragging it down in strips.

Every interaction is hands-on: click an object, then drag, pull, turn, spray or smash in its own view. Guards patrol the lab and dispatch office with a floor sight cone (4 m by day, 3.5 m at night, 20% less with crepe soles). Crouch behind furniture, or pick up a beaker or paperweight, hold the mouse to aim and release to throw it; the crash pulls a guard away for six seconds. The watch overdrive (250 points, O key) flips day and night anywhere and jams the guards briefly. A recorded day/night sting (`src/audio/daynight.mp3`) plays 2.5 seconds before every shift change.

**Veteran Investigator Mode** (title screen, pause menu or the HUD button under the points) leaves the default game untouched and adds: about 1.5× reading size with no italics, a 2× loupe over documents, large buttons in place of every drag, click-and-hold instead of rapid clicking, 20% brighter nights, a brass pulse on interactive objects, a 30% slower patrol and a 2.5 s yellow warning with a heartbeat before a guard's stare starts to count. Any open document, journal or inspection already pauses the clock.

## Day–night and the guard

One second of play advances the clinic clock fifteen minutes. Each day or night shift lasts 48 seconds. The HUD dial shows the sun or moon and the time until the next shift. Night turns the room blue and moonlit. Day brings warm light through the blinds. Sitting on the staff bench skips straight to the next shift. Night leads collected in the first eight seconds of a night earn a +50 bonus.

The guard telegraphs in stages. Footsteps and keys play first, with an eye banner reading “Footsteps approaching”. Next, an amber search cone sweeps the floor from the east door. If he sees you, the banner turns red and shakes, the screen closes in with a red vignette and scan lines, glare comes from the door, and a meter fills. Crouch (C) or break line of sight before it fills, or you lose a composure bulb. Losing all three ends the file: −50 points, retry from the desk.

## Development

The shipped app and single-file game are ready to run. To rebuild them from source, install the versions of Three.js and esbuild in `package.json`, then run `npm run build`. `npm run build:mac` also compiles the AppKit host and packages the Apple silicon app. It requires the macOS Command Line Tools. `INK_TOOLCHAIN` can point to a separate directory containing those Node dependencies. The build keeps `mars-rehearsal.html` in sync with the main game for existing local links.

`src/campaign.js` owns scoring, clue prerequisites, checkpoints and purchases. `src/game.js` runs the first-person controls, interactions and HUD. `src/room.js` and `src/props.js` build the office and animate its occupants. `src/renderer.js` applies the split-toned noir grade, day–night lighting and dawn pass. `src/shifts.js` owns the clock and guard patrol. `src/fieldwork.js` holds the three hands-on puzzles. `src/floorplan.js` holds collision footprints and draws the journal map. `src/annex.js` builds the lab and dispatch-office furniture. `src/tactile.js` holds the hands-on interaction views. `src/stealth.js` runs the roaming guards and throwables. `src/figures.js` builds the 3D characters. `native/Game.swift` handles the desktop window, relative mouse and application lifecycle. `src/casebook.js` contains the authored case files, dialogue evidence and advocacy cards.

## Title art

The built-in image generator produced `src/art/title.jpg` using this prompt.

> Use case: illustration-story. Asset type: the background key art of the opening menu of an independent noir detective video game, wide 16:9 landscape. Make a beautifully hand-inked 1930s urban crime graphic-novel cover, a tense real human mystery, with bold silhouette, extremely deliberate editorial illustration, fine engraved crosshatched brush lines, dry brush marks, distressed lithograph speckling, crisp shapes, very limited palette of deep brown-black, amber and parchment. Strong dramatic chiaroscuro anchored on the RIGHT TWO THIRDS. View from behind and slightly below a solitary detective in a fedora and long trench coat standing in a dark clinic records office, framed by a massive glowing street-facing window with old Venetian blinds, rain streaks, warm silhouetted city buildings and cables. The figure is dark with beautiful amber rim lighting, centered at roughly x=71 percent; silhouette of angular fedora brim and coat shoulders unmistakable. A single vintage desk lamp and stacked folders in the lower right, painted texture and slanting light and shadows across desk, paper edges, polished wooden floor. The LEFT THIRD should fall away organically into a near-black office doorway with subtle ink grain and shadow, very sparse, suitable for placing title and menu later. Illustrate edge-to-edge. Analog story-driven game poster. No text, lettering, words, logo, border, UI, buttons, faces in close-up or weapons.

## Online records (Supabase)
- Project `redacted-donor` in the **Oak Hackathon database** org (ref `raemznzmcfzqwtuskwvq`, ap-south-1); schema in `supabase/schema.sql`. URL and publishable key are baked in by `build.mjs` (override with `SUPABASE_URL` / `SUPABASE_KEY`); the CSP `connect-src` allows only that URL.
- No sign-in: each device makes a random secret key (`redacted-donor.cloud.key` in localStorage). The database stores only its SHA-256 hash.
- Tables (`players`, `scores`, `runs`, `saves`) have no direct write access. Writes go through functions that hash the key and act only on that player: `set_name`, `submit_score` (plausibility checks, 20 s throttle, returns board place), `log_run`, `push_save` / `pull_save`, `load_save_by_code`. Names and scores are public; key hashes, runs and saves are not.
- `src/cloud.js`: small fetch client with a local outbox, so offline results upload later. The game never waits on the network.
- **Accounts** (title menu → *Sign in* / *Account · NAME*): email + password, or investigator ID + password (stored as `<id>@players.redacted-donor.app`), or keep playing as a guest. "Confirm email" is **off** in Supabase Auth because the built-in mailer only reaches team members. Signed in, `player_for()` uses `players.user_id`, so progress, cloud save and best scores follow the account; a new account takes over the device's guest progress. Signing out resets the device to a fresh guest. `my_stats()` feeds the account page.
- Signing in on a device that already has a save opens **Your progress**: transfer that save to the account (replacing the account's) or delete it (use the account's save, or start fresh). A deleted save is kept from coming back by a local "ignore cloud saves before" timestamp. Every player row has a name: the database defaults it to `Agent NNNN`; new accounts use the investigator ID, the guest's name, or the start of the email.
- `players.email` mirrors the account's sign-in email (filled by `player_for()`); it is not readable through the API, only in the dashboard. Investigator-ID accounts show `<id>@players.redacted-donor.app`; guests are blank.
- **Privacy policy / Terms of service**: text in `src/legal.js`, opened from the Account page. The Privacy page has **Delete my account and online data**, which calls `delete_me()` (removes the player row, its scores, runs and save, and the auth user).
- UI: title **Records** (standard/veteran leaderboards + load a 12-char transfer code), ending **Submit to the record**, pause **Cloud save on/off** with the transfer code.

## 3D hands-on puzzles (replaces the 2D `tactile.js` views)
- `src/hands.js`: every puzzle is built from real meshes at the object's place in the room. `openHands()` in `game.js` flies the camera in (`cutscene` mode `stay`), opens the rig, and shows only a slim bar (`#hands`: title, hint, what was found, Veteran buttons, Step back). When the rig reports done, the original game effect runs as before (`tactileAfter`).
- Puzzles are authored on a "board": x 0–560, y 0–320 (mm), z in metres toward the viewer. Table puzzles lie flat, wall puzzles stand upright; `pose()` places the rig and camera from where the player stands.
- 19 kinds: `pile`, `drawer`, `press`, `slot`, `tumbler`, `smash`, `spray`, `watch`, `dials`, `wires`, `shred`, `peel`, `rubbing`, `torn`, `torch`, `align` (carbon copy), `tickets` (freight tickets), `thread` (corkboard), and `read` (pick up a paper from a searched prop and read it in the world).
- Veteran mode: the camera sits 10% closer and each puzzle offers buttons or a hold button instead of drags.
- Still 2D: the opening contract dialogue, pause/journal/kit/records/account menus, and the case-closed "action dossier". `board()`, `workBody()` and the `.tx-*` CSS rules are now unreachable leftovers.

## Redesign brief (`~/Downloads/message (1).txt`, "The Silent Donor") — progress
- **Stage 1, visuals — done.** `renderer.js` shader: sunbeams through the west window, lamp glow, world-anchored dust motes that only show in light, soft bleed off bright things, distance haze, print grain and paper tooth. Detective scenes (`DETECTIVE_STAGES` in `game.js`, `uDetective`) go near-black navy with a warm overhead spotlight and a dusty beam on the evidence board. Mateo's memory scenes are darker with a heavier vignette, and the lamp pools flicker in bursts (off in Veteran mode and with reduced motion). `room.js`: floorboards, furniture wood, and walls (striped wallpaper, damp streaks, picture rail, panel grain, skirting) repainted at 2× density with anisotropic filtering.
- **Stage 2, tension — done.** Standard game: a puzzle no longer pauses the clinic (`handsLive` in `frame()`; guards use `eyeAt()`, the spot where the player stood), loud puzzle sounds call `stealth.distract()`, roaming guards linger and double back at random, their footsteps play by distance (`audio.footstep`), and the arrow, world markers and "where" line are hidden by CSS (`#game:not([data-comfort=on])`). The objective is the case question. Losing the last composure bulb to a guard in a memory runs `caughtByGuard()`: the last lead is removed, the clock jumps a shift, 50 points go, and `state.alarm` makes guards faster and sharper for the rest of the case; no restart. Veteran mode keeps the pause, the markers and regular patrols.
- **Stage 3, story — done.** Awareness is written into the documents (job ad, passport receipt, freight tag) and a notebook page per case (`cases[i].lesson`, shown with the 3D `read` card after the corkboard thread). The rescue no longer destroys anything: the terminal puzzle reports the lure ads and unplugs the record drives; the old shredder is a photostat that copies the forged consent form before the ethics-hold stamp.
- **Stage 4, debrief — done.** `src/debrief.js`: a three-question check before the opening scene (skippable) and again after the debrief, a Recognise / Understand / Respond debrief of cards to turn, links to UNODC, WHO and NOTTO, and a results page with before/after scores. Answers live in `state.quiz` in the save; they are not sent online.
- **Remaining brief items — done.** Evidence board (`props.js`): a pinned card per exhibit in `state.exhibits`, Mateo's portrait, a yellow FILE 409 tag once the receipt is in, and a red thread through each closed case; shown in detective scenes only. Set dressing (`annex.js`): rusting instrument tray, drip stand, strip lights, a leak bucket, a padlocked records store, and three searchable story props (curios `contracts`, `storage`, `consents`). A cut-out orderly stands in the lab on Mateo's night shifts and turns to face the player (`annex.face`). Standard game: every 45–85 s a guard comes in through the corridor door and walks the lobby (`room1` route, `lobbyOn` in `driveStealth`). Being caught also sets `state.benchWatched`, which disables the staff-bench time skip for the case. The rescue (`glass` and `radio` stages) runs on `state.rescueLeft`: 4 minutes, 8 in Veteran mode; at zero the player returns to the dispatch door and loses 50 points.
- **Still not done from the brief:** lost routes other than the bench, and rust or wear on the existing furniture models.

## Spatial hand tracking (optional webcam mode)
- **Off by default; mouse and keyboard are untouched and keep working while it is on.** Toggle: "Spatial hand tracking" on the title screen and "Hand tracking" in the top-right HUD (`.spatial-toggle`). `setSpatial()` in `game.js` sets `inputMode` (`'mouse'` | `'spatial'`); `frame()` calls `driveSpatial(now)` only in spatial mode.
- `src/spatial.js`: `createSpatial()` owns the camera and the MediaPipe hand landmarker (tasks-vision 0.10.14 from jsDelivr, model from storage.googleapis.com, fetched only when turned on). `Gestures.feed(landmarks, t)` turns landmarks into `{pointer, pinch, down, up, bang, two}` with One-Euro smoothing and pinch hysteresis. `drawHands()` paints the corner skeleton view (`#spatialView`).
- Gestures: **pinch** = press (interact in the room; grab/drag inside a 3D puzzle via `hands.pointer()`, release drops, a drawer let go early springs shut); **fist pushed at the camera** = bang on the street window; **two pinching hands** = turn/tilt the document under the lamp, or rotate/scale the notebook page (`hands.twist()`); circular pinch-drag turns tumblers and radio dials because those already follow the pointer. The amber sphere (`handCursor`) marks the pinch point in the 3D scene.
- No camera, permission refused or model download failed → message on screen, toggle returns to Off, mouse carries on.
- `build.mjs` CSP now also allows `https://cdn.jsdelivr.net` (script + connect), `https://storage.googleapis.com` (connect) and `'wasm-unsafe-eval'`. Privacy policy has a camera entry (`src/legal.js`).
- Test seam: open `index.html?spatialtest` and call `window.__spatial.feed(landmarks, t)` to drive the game with scripted hands (no camera needed).
- **Not verified:** real hands on a real camera (thresholds in `Gestures` may need tuning: pinch .28/.42 of hand size, bang growth rate 1.8/s), and the Mac app, whose `file://` page is expected to have no camera access and so falls back to the mouse.
